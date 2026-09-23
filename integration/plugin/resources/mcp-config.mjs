import { createHash } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isIP } from 'node:net';
import { sourceResource, validPackageReference } from '../../../sources/contracts.mjs';

const fail = (code, message) => Object.assign(Error(message), { code });
const invalid = () => fail('MCP_INVALID_VALUES', 'MCP parameters are missing or invalid; check the declared fields.');
const unsupported = message => fail('MCP_UNSUPPORTED', message);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const variableName = /^[A-Za-z_][A-Za-z0-9_]*$/;
const sensitive = /authorization|token|secret|password|credential|api.?key/i;
const text = value => typeof value === 'string' && value.length <= 8192 && !/[\x00-\x1f\x7f]/.test(value);
const exactVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const list = value => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 64) throw unsupported('MCP descriptor list is invalid or too large.');
  return value;
};
function descriptor(spec) {
  if (!object(spec) || !['string', 'number', 'boolean', 'filepath'].includes(spec.format ?? 'string')
    || ['isRequired', 'isSecret'].some(k => spec[k] !== undefined && typeof spec[k] !== 'boolean')
    || spec.isRepeated === true) throw unsupported('MCP input descriptor is unsupported.');
  if (spec.choices !== undefined && (!Array.isArray(spec.choices) || spec.choices.length > 64 || !spec.choices.every(text))) throw unsupported('MCP input choices are invalid.');
  if (spec.default !== undefined && !text(spec.default)) throw unsupported('MCP input default is invalid.');
}
function checkedValue(raw, field, choices) {
  if (raw === undefined || raw === '') {
    if (field.required) throw invalid();
    return undefined;
  }
  if (!text(raw) || /\{[A-Za-z_][A-Za-z0-9_]*\}|\$\{/.test(raw)
    || choices && !choices.includes(raw)
    || field.format === 'number' && (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(Number(raw)))
    || field.format === 'boolean' && !['true', 'false'].includes(raw)) throw invalid();
  return raw;
}

function checkedResource(resource) {
  try {
    sourceResource(resource);
    const server = resource.serverDefinition;
    if (resource.type !== 'MCP' || !['mcp', 'community'].includes(resource.sourceId) || !object(server)
      || !/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(server.name) || server.name.length > 200
      || server.version !== resource.version || /^(latest|\.|\.\.)$/i.test(server.version)) throw Error();
    return server;
  } catch { throw fail('MCP_INVALID_RESOURCE', 'A valid pinned MCP Registry resource is required.'); }
}

// Syntactic public DNS endpoints only: no DNS lookup or endpoint request during preview.
function endpoint(value) {
  if (!text(value) || /[{}\\\s]/.test(value)) throw invalid();
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || isIP(host) || host.includes(':')
    || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
    || /(?:^|\.)(?:localhost|local|localdomain|internal|intranet|lan|corp|home|test|invalid|onion)$/.test(host)
    || host.endsWith('.home.arpa')) throw invalid();
  return value;
}

function inputs() {
  const fields = new Map();
  function add(key, label, spec = {}, required = false, secret = false) {
    descriptor(spec);
    if (fields.size >= 128) throw unsupported('MCP input descriptor is too large.');
    const values = spec.choices;
    const field = { key, label, required: required || spec.isRequired === true,
      secret: secret || spec.isSecret === true || sensitive.test(label), format: spec.format ?? 'string' };
    if (values && !field.secret) field.choices = [...values];
    if (spec.default !== undefined && !field.secret) field.default = spec.default;
    if (fields.has(key)) throw unsupported('MCP input names conflict.');
    fields.set(key, { field, fallback: spec.default, choices: values });
    return values => values.get(key);
  }
  function template(value, specs = {}, prefix = 'variable', secret = false) {
    if (!text(value) || !object(specs) || Object.keys(specs).length > 64 || value.includes('${')) throw unsupported('MCP template is invalid.');
    const used = new Set([...value.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(match => match[1]));
    if (/[{}]/.test(value.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, ''))) throw unsupported('MCP template syntax is unsupported.');
    const getters = new Map();
    for (const name of new Set([...Object.keys(specs), ...used])) {
      if (!variableName.test(name)) throw unsupported('MCP variable name is invalid.');
      const spec = specs[name] ?? {};
      descriptor(spec);
      if (spec.value !== undefined) {
        if (spec.variables !== undefined) throw unsupported('Nested fixed MCP variable templates are unsupported.');
        let fixed;
        try { fixed = checkedValue(spec.value, { required: used.has(name) || spec.isRequired === true, format: spec.format ?? 'string' }, spec.choices); }
        catch { throw unsupported('A fixed MCP variable is invalid.'); }
        getters.set(name, () => fixed);
      } else getters.set(name, add(`${prefix}:${name}`, name, spec, used.has(name), secret));
    }
    return values => value.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => getters.get(name)(values));
  }
  function named(spec, key, label, secret = false) {
    descriptor(spec);
    if (spec.value !== undefined) {
      const field = { required: spec.isRequired === true, format: spec.format ?? 'string' };
      if (!/[{}]/.test(spec.value)) {
        try { checkedValue(spec.value, field, spec.choices); } catch { throw unsupported('A fixed MCP field is invalid.'); }
      }
      const read = template(spec.value, spec.variables, key, secret || spec.isSecret === true || sensitive.test(label));
      return values => checkedValue(read(values), field, spec.choices);
    }
    if (spec.variables !== undefined) throw unsupported('MCP variables require a value template.');
    return add(key, label, spec, false, secret);
  }
  function resolve(values) {
    if (!object(values) || Object.keys(values).some(key => !fields.has(key))) throw invalid();
    const result = new Map();
    for (const [key, { field, fallback, choices }] of fields) {
      const raw = Object.hasOwn(values, key) ? values[key] : fallback;
      result.set(key, checkedValue(raw, field, choices));
    }
    return result;
  }
  return { add, named, template, resolve, fields: () => [...fields.values()].map(item => item.field) };
}

function remotePlan(remote, input) {
  if (!object(remote) || remote.type !== 'streamable-http') throw unsupported('Only the Streamable HTTP remote transport is supported.');
  const url = input.template(remote.url, remote.variables);
  if (!/[{}]/.test(remote.url)) {
    try { endpoint(remote.url); } catch { throw unsupported('MCP endpoint must be an HTTPS public DNS URL without credentials or a fragment.'); }
  }
  const seen = new Set();
  const headers = list(remote.headers).map(header => {
    if (!object(header) || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(header.name)
      || /^(host|content-length|connection|transfer-encoding)$/i.test(header.name) || seen.has(header.name.toLowerCase())) throw unsupported('MCP header names are invalid or conflicting.');
    seen.add(header.name.toLowerCase());
    return [header.name, input.named(header, `header:${header.name}`, header.name, true)];
  });
  return values => ({ transport: 'streamable-http', url: endpoint(url(values)),
    headers: Object.fromEntries(headers.map(([name, read]) => [name, read(values)]).filter(([, value]) => value !== undefined)) });
}

function npmPlan(pkg, input) {
  if (!object(pkg) || pkg.registryType !== 'npm') throw unsupported('Only the npm package registry is supported.');
  if (pkg.transport?.type !== 'stdio') throw unsupported('Only npm stdio packages are supported; remote transports must be declared as remotes.');
  if (!validPackageReference({ name: pkg.identifier, version: pkg.version }) || !exactVersion.test(pkg.version)
    || pkg.version.split('+')[0].split('-').slice(1).join('-').split('.').some(part => /^0\d+$/.test(part))) throw unsupported('An exact npm package name and version are required.');
  if (pkg.registryBaseUrl !== undefined && !/^https:\/\/registry\.npmjs\.org\/?$/.test(pkg.registryBaseUrl)) throw unsupported('Only the public npm registry is supported.');
  if (pkg.runtimeHint !== undefined && pkg.runtimeHint !== 'npx') throw unsupported('Only the npx npm runtime is supported.');
  if (list(pkg.runtimeArguments).some(arg => arg?.type !== 'positional' || !['-y', '--yes'].includes(arg.value)
    || Object.keys(arg).some(key => !['type', 'value', 'description'].includes(key)))) throw unsupported('Custom npm runtime arguments are unsupported because they can override the package pin.');
  const envNames = new Set();
  const env = list(pkg.environmentVariables).map(field => {
    if (!object(field) || !variableName.test(field.name) || field.name.length > 128 || envNames.has(field.name.toLowerCase())
      || /^(?:node_options|node_path|path|pathext|comspec|npm_.+)$/i.test(field.name)) throw unsupported('MCP environment names conflict with each other or the pinned npm runtime.');
    envNames.add(field.name.toLowerCase());
    return [field.name, input.named(field, `env:${field.name}`, field.name)];
  });
  const args = list(pkg.packageArguments).map((arg, index) => {
    if (!object(arg) || !['named', 'positional'].includes(arg.type) || arg.isRepeated === true
      || arg.type === 'named' && !/^-{1,2}[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(arg.name)) throw unsupported('MCP package argument shape is unsupported.');
    return { arg, read: input.named(arg, `argument:${index}`, arg.type === 'named' ? arg.name : `Argument ${index + 1}`) };
  });
  return values => {
    const argumentsList = args.flatMap(({ arg, read }) => {
      const value = read(values);
      if (value === undefined) return [];
      return arg.type === 'named' ? [arg.name, value] : [value];
    });
    const launcher = npmLauncher();
    return { transport: 'stdio', command: launcher.command,
      args: [...launcher.args, '--yes', '--registry=https://registry.npmjs.org', '--', `${pkg.identifier}@${pkg.version}`, ...argumentsList],
      env: Object.fromEntries(env.map(([name, read]) => [name, read(values)]).filter(([, value]) => value !== undefined)), cwd: '' };
  };
}

function npmLauncher() {
  if (process.platform !== 'win32') return { command: 'npx', args: [] };
  // The SDK uses cross-spawn, which sends .cmd shims through cmd.exe. Use Node's own npm JS entry.
  const root = dirname(process.execPath), parts = ['node_modules', 'npm', 'bin', 'npx-cli.js'];
  let path = root;
  try {
    for (const part of parts) {
      path = join(path, part);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || (part === 'npx-cli.js' ? !stat.isFile() : !stat.isDirectory())) throw Error();
    }
  } catch { throw unsupported('Windows npm launch requires npx-cli.js in the trusted Node installation. Repair that installation before connecting.'); }
  return { command: process.execPath, args: [path] };
}

function plans(resource) {
  const server = checkedResource(resource);
  const serverName = 'dsh_' + createHash('sha256').update(resource.id).digest('hex').slice(0, 28);
  const choices = [];
  for (const [kind, rows] of [['remote', list(server.remotes)], ['package', list(server.packages)]]) {
    rows.forEach((item, index) => {
      const input = inputs();
      const descriptor = { id: `${kind}:${index}`, label: `${kind === 'remote' ? 'Remote' : 'npm package'} ${index + 1}`,
        transport: kind === 'remote' ? 'streamable-http' : 'stdio', supported: true, fields: [] };
      try {
        const build = kind === 'remote' ? remotePlan(item, input) : npmPlan(item, input);
        descriptor.fields = input.fields();
        choices.push({ descriptor, resolve: values => ({ ...build(input.resolve(values)), serverName, toolCallTimeoutMs: 60000, failOnStartupError: true }) });
      } catch (error) {
        choices.push({ descriptor: { ...descriptor, supported: false, reason: error.code === 'MCP_UNSUPPORTED' ? error.message : 'MCP descriptor is unsupported.' } });
      }
    });
  }
  if (!choices.length) choices.push({ descriptor: { id: 'unsupported', label: 'MCP', supported: false,
    reason: 'No supported transport or package was declared.', fields: [] } });
  return { serverName, choices };
}

/** Pure descriptor projection. Values use each field's exact key; secret defaults are omitted. */
export function mcpChoices(resource) {
  const plan = plans(resource);
  return { serverName: plan.serverName, choices: plan.choices.map(item => item.descriptor) };
}

/** Resolve catalog-owned declarations into the pinned native dsh-mcp-client Config input. */
export function resolveMcpConfig(resource, { choice, values = {} } = {}) {
  const plan = plans(resource);
  const supported = plan.choices.filter(item => item.descriptor.supported);
  const selected = choice === undefined && supported.length === 1 ? supported[0] : plan.choices.find(item => item.descriptor.id === choice);
  if (!selected) throw fail('MCP_CHOICE_REQUIRED', 'Select one of the declared MCP connection choices.');
  if (!selected.resolve) throw unsupported(selected.descriptor.reason);
  return selected.resolve(values);
}
