import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { Config } from '@deepseek-ai/dsh-mcp-client';
import { mcpChoices, resolveMcpConfig } from '../../src/plugin/resources/mcp-config.mjs';

function resource(definition = {}) {
  return { id: 'source-mcp-fixture', type: 'MCP', title: 'Fixture MCP', summary: 'Public MCP fixture',
    version: '1.2.3', revision: 1, status: 'external', sourceId: 'mcp', source: 'MCP Registry',
    owner: 'source:mcp', author: 'org.example', updatedAt: '', requirements: '',
    url: 'https://example.com/project', body: 'Fixture', serverDefinition: {
      name: 'org.example/fixture', version: '1.2.3',
      remotes: [{ type: 'streamable-http', url: 'https://api.example.com/mcp' }], ...definition } };
}
const resolve = (r, values = {}, choice = 'remote:0') => resolveMcpConfig(r, { choice, values });
const stdio = (patch = {}) => resource({ remotes: [], packages: [{ registryType: 'npm',
  identifier: '@example/server', version: '2.3.4', transport: { type: 'stdio' }, ...patch }] });

test('preview is pure, redacted, stable, and native HTTP config validates', () => {
  const r = resource(); const original = structuredClone(r);
  const preview = mcpChoices(r);
  assert.match(preview.serverName, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(preview.serverName, mcpChoices(r).serverName);
  assert.notEqual(preview.serverName, mcpChoices({ ...r, id: 'source-mcp-other' }).serverName);
  assert.deepEqual(preview.choices[0].fields, []);
  const config = resolve(r);
  assert.equal(Config(config).url, 'https://api.example.com/mcp');
  assert.equal(config.transport, 'streamable-http');
  assert.deepEqual(r, original);
});

test('templates, required secret headers, defaults, enums and named fields are validated', () => {
  const r = resource({ remotes: [{ type: 'streamable-http', url: '{baseUrl}/mcp/{tenant}',
    variables: { baseUrl: { default: 'https://api.example.com' }, tenant: { choices: ['team-a', 'team-b'] } },
    headers: [{ name: 'Authorization', value: 'Bearer {token}', variables: { token: { isSecret: true, isRequired: true } } },
      { name: 'X-Required', isRequired: true }, { name: 'X-Optional' }] }] });
  const fields = mcpChoices(r).choices[0].fields;
  assert.equal(fields.find(f => f.key === 'header:Authorization:token').secret, true);
  const values = { 'variable:tenant': 'team-a', 'header:Authorization:token': 'private-token', 'header:X-Required': 'yes' };
  assert.equal(resolve(r, values).headers.Authorization, 'Bearer private-token');
  assert.equal(resolve(r, values).headers['X-Optional'], undefined);
  assert.equal(resolve(r, values).url, 'https://api.example.com/mcp/team-a');
  for (const bad of [{}, { ...values, 'variable:tenant': 'bad' }, { ...values, 'header:X-Required': '' },
    { ...values, 'header:Authorization:token': '{other}' }, { ...values, 'header:X-Required': 'a\r\nInjected: yes' },
    { ...values, unknown: 'x' }]) assert.throws(() => resolve(r, bad), { code: 'MCP_INVALID_VALUES' });
});

test('multiple choices require an explicit selection and unsupported choices explain why', () => {
  const r = resource({ packages: [{ registryType: 'pypi', identifier: 'example', version: '1.0.0', transport: { type: 'stdio' } }],
    remotes: [{ type: 'streamable-http', url: 'https://one.example.com/mcp' },
      { type: 'streamable-http', url: 'https://two.example.com/mcp' }, { type: 'sse', url: 'https://three.example.com/sse' }] });
  const choices = mcpChoices(r).choices;
  assert.equal(choices.length, 4);
  assert.match(choices[3].reason, /npm/i);
  assert.match(choices[2].reason, /transport/i);
  assert.throws(() => resolveMcpConfig(r, {}), { code: 'MCP_CHOICE_REQUIRED' });
  assert.throws(() => resolve(r, {}, 'package:0'), { code: 'MCP_UNSUPPORTED' });
  assert.equal(resolve(r, {}, 'remote:1').url, 'https://two.example.com/mcp');
});

test('npm config uses the exact package pin and argument arrays accepted by the native Config', () => {
  const r = stdio({ environmentVariables: [{ name: 'API_TOKEN', isRequired: true, isSecret: true }],
    packageArguments: [{ type: 'positional', value: 'serve' }, { type: 'named', name: '--tenant', isRequired: true },
      { type: 'named', name: '--count', format: 'number', default: '2' }] });
  const config = resolve(r, { 'env:API_TOKEN': 'sensitive-value', 'argument:1': 'a b & c' }, 'package:0');
  assert.equal(Config(config).transport, 'stdio');
  assert.deepEqual(config.args.slice(process.platform === 'win32' ? 1 : 0),
    ['--yes', '--registry=https://registry.npmjs.org', '--', '@example/server@2.3.4', 'serve', '--tenant', 'a b & c', '--count', '2']);
  assert.deepEqual(config.args.slice(-5), ['serve', '--tenant', 'a b & c', '--count', '2']);
  assert.equal(config.env.API_TOKEN, 'sensitive-value');
  if (process.platform === 'win32') {
    assert.equal(config.command, process.execPath);
    assert.equal(config.args[0], join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'));
  } else assert.equal(config.command, 'npx');
  assert.throws(() => resolve(r, {}, 'package:0'), { code: 'MCP_INVALID_VALUES' });
});

test('floating npm versions, alternate registries, runtime overrides and unsupported package transports fail closed', () => {
  for (const patch of [{ version: 'latest' }, { version: '^1.0.0' }, { version: '1.0.0 || 2.0.0' },
    { identifier: 'https://example.com/a.tgz' }, { registryBaseUrl: 'https://private.example.com' },
    { runtimeHint: 'bunx' }, { runtimeArguments: [{ type: 'positional', value: '--package=evil' }] },
    { transport: { type: 'streamable-http', url: 'https://example.com/mcp' } }]) {
    const r = stdio(patch);
    assert.equal(mcpChoices(r).choices[0].supported, false);
    assert.throws(() => resolve(r, {}, 'package:0'), { code: 'MCP_UNSUPPORTED' });
  }
});

test('HTTPS public endpoint syntax, source identity and unresolved variables are enforced without fetching', () => {
  for (const url of ['http://example.com/mcp', 'https://localhost/mcp', 'https://127.0.0.1/mcp',
    'https://[::1]/mcp', 'https://10.0.0.1/mcp', 'https://host.internal/mcp',
    'https://user:private-token@example.com/mcp', 'https://example.com/mcp#fragment']) {
    const r = resource({ remotes: [{ type: 'streamable-http', url }] });
    assert.throws(() => resolve(r), error => error.code === 'MCP_UNSUPPORTED' && !error.message.includes('private-token'));
  }
  assert.throws(() => mcpChoices({ ...resource(), revision: 0 }), { code: 'MCP_INVALID_RESOURCE' });
  assert.throws(() => mcpChoices(resource({ version: 'different' })), { code: 'MCP_INVALID_RESOURCE' });
  const r = resource({ remotes: [{ type: 'streamable-http', url: '{endpoint}', variables: { endpoint: { isSecret: true } } }] });
  assert.throws(() => resolve(r, { 'variable:endpoint': 'https://user:private-token@example.com' }),
    error => error.code === 'MCP_INVALID_VALUES' && !JSON.stringify(error).includes('private-token'));
});

test('credential defaults and fixed header values never appear in descriptors', () => {
  const r = resource({ remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp?key=secret-url',
    headers: [{ name: 'Authorization', value: 'secret-fixed' }, { name: 'X-Api-Key', default: 'secret-default', isSecret: true }] }] });
  assert.doesNotMatch(JSON.stringify(mcpChoices(r)), /secret-url|secret-fixed|secret-default/);
  assert.equal(resolve(r).headers['X-Api-Key'], 'secret-default');
});

test('secret enum choices remain private, fixed required fields cannot bypass validation, npm pins are valid semver', () => {
  const r = resource({ remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp',
    headers: [{ name: 'X-Api-Key', isSecret: true, choices: ['private-enum-value'], default: 'private-enum-value' }] }] });
  assert.doesNotMatch(JSON.stringify(mcpChoices(r)), /private-enum-value/);
  assert.equal(resolve(r).headers['X-Api-Key'], 'private-enum-value');
  assert.throws(() => resolve(r, { 'header:X-Api-Key': 'other' }), { code: 'MCP_INVALID_VALUES' });
  const empty = resource({ remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp',
    headers: [{ name: 'Authorization', isRequired: true, value: '' }] }] });
  assert.equal(mcpChoices(empty).choices[0].supported, false);
  for (const version of ['1.0.0-..', '1.0.0-a..b', '1.0.0-01', '1.0.0+..']) {
    assert.equal(mcpChoices(stdio({ version })).choices[0].supported, false);
  }
});

test('boolean arguments, positional secrets, numeric validation and env conflicts preserve argument boundaries', () => {
  const r = stdio({ packageArguments: [{ type: 'named', name: '--verbose', format: 'boolean', default: 'true' },
    { type: 'positional', isRequired: true, isSecret: true }, { type: 'named', name: '--count', format: 'number' }] });
  const values = { 'argument:1': 'a b; $(private)', 'argument:2': '2.5' };
  assert.deepEqual(resolve(r, values, 'package:0').args.slice(-5), ['--verbose', 'true', 'a b; $(private)', '--count', '2.5']);
  for (const extra of [{ 'argument:0': 'yes' }, { 'argument:2': 'NaN' }, { 'argument:2': '1e999' }]) {
    assert.throws(() => resolve(r, { ...values, ...extra }, 'package:0'), { code: 'MCP_INVALID_VALUES' });
  }
  for (const name of ['NODE_OPTIONS', 'NPM_CONFIG_REGISTRY', 'PATH']) assert.equal(mcpChoices(stdio({ environmentVariables: [{ name }] })).choices[0].supported, false);
  assert.equal(mcpChoices(stdio({ environmentVariables: [{ name: 'TOKEN' }, { name: 'token' }] })).choices[0].supported, false);
});

test('fixed template variables are validated, private and cannot be overridden', () => {
  const r = resource({ remotes: [{ type: 'streamable-http', url: 'https://{host}/mcp',
    variables: { host: { value: 'api.example.com', isRequired: true } },
    headers: [{ name: 'Authorization', value: 'Bearer {token}', variables: { token: { value: 'fixed-private', isSecret: true } } }] }] });
  assert.deepEqual(mcpChoices(r).choices[0].fields, []);
  assert.doesNotMatch(JSON.stringify(mcpChoices(r)), /fixed-private/);
  assert.equal(resolve(r).url, 'https://api.example.com/mcp');
  assert.equal(resolve(r).headers.Authorization, 'Bearer fixed-private');
  for (const values of [{ 'variable:host': 'other.example.com' }, { 'header:Authorization:token': 'override' }]) {
    assert.throws(() => resolve(r, values), { code: 'MCP_INVALID_VALUES' });
  }
  r.serverDefinition.remotes[0].variables.host.value = '{unresolved}';
  assert.equal(mcpChoices(r).choices[0].supported, false);
});

test('required named boolean arguments preserve true and false as explicit values', () => {
  for (const value of ['true', 'false']) {
    const fixed = stdio({ packageArguments: [{ type: 'named', name: '--enabled', format: 'boolean', isRequired: true, value }] });
    assert.deepEqual(resolve(fixed, {}, 'package:0').args.slice(-2), ['--enabled', value]);
    const supplied = stdio({ packageArguments: [{ type: 'named', name: '--enabled', format: 'boolean', isRequired: true }] });
    assert.deepEqual(resolve(supplied, { 'argument:0': value }, 'package:0').args.slice(-2), ['--enabled', value]);
  }
});
