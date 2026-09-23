import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, opendir, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { mcpChoices, resolveMcpConfig } from './mcp-config.mjs';

const plugin = '@deepseek-ai/dsh-mcp-client';
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (code, message) => Object.assign(Error(message), { code });
const unsafe = () => fail('MCP_STORAGE_UNSAFE', 'MCP ownership storage is unsafe or invalid; inspect the private receipts before retrying.');
const drift = () => fail('MCP_DRIFT', 'The owned MCP entry is missing or changed. Restore its recorded configuration or resolve ownership manually; no entry was overwritten.');
const conflict = () => fail('MCP_CONFLICT', 'This MCP resource or namespace already exists. Use enable/disable for an owned entry; resolve unmanaged conflicts manually.');
const nativeFailure = () => fail('MCP_NATIVE_FAILED', 'The native MCP operation failed. Inspect host diagnostics locally; saved ownership is retained for recovery.');
const same = (a, b) => a?.dev === b?.dev && a?.ino === b?.ino;
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^source-[a-z0-9-]{1,100}$/;
const entryPattern = /^[A-Za-z0-9_.:-]{1,256}$/;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function fingerprint(value) {
  const text = JSON.stringify(canonical(value));
  if (!text || text.length > 256 * 1024) throw drift();
  return digest(text);
}
function entryPin(entry) {
  const { id, disabled, ...options } = entry.options;
  return fingerprint(options);
}
function definitionPin(resource) {
  return fingerprint({ version: resource.version, serverDefinition: resource.serverDefinition });
}
async function present(path) {
  try { return await lstat(path, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function directory(path, create = false) {
  const chain = [];
  for (let part = resolve(path); ; part = dirname(part)) {
    chain.push(part);
    if (part === dirname(part)) break;
  }
  for (const part of chain.reverse()) {
    let stat = await present(part);
    if (!stat) {
      if (!create) return false;
      try { await mkdir(part, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      stat = await present(part);
    }
    if (!stat?.isDirectory() || stat.isSymbolicLink()) throw unsafe();
  }
  return true;
}
async function readJson(path) {
  if (!await directory(dirname(path))) return null;
  const stat = await present(path);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n || stat.size > 16384n) throw unsafe();
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await file.stat({ bigint: true });
    if (!same(opened, stat) || opened.size !== stat.size || opened.nlink !== 1n) throw unsafe();
    const bytes = Buffer.alloc(Number(stat.size) + 1);
    let used = 0;
    while (used < bytes.length) {
      const result = await file.read(bytes, used, bytes.length - used, used);
      if (!result.bytesRead) break;
      used += result.bytesRead;
    }
    if (used !== Number(stat.size)) throw unsafe();
    try {
      const value = JSON.parse(bytes.subarray(0, used).toString('utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw unsafe();
      return value;
    } catch { throw unsafe(); }
  } finally { await file.close(); }
}
async function writeNew(path, content) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  try { await file.writeFile(content); await file.sync(); return await file.stat({ bigint: true }); }
  finally { await file.close(); }
}
async function native(call) {
  try { return await call(); } catch { throw nativeFailure(); }
}

/**
 * Bind ONE public loader tree and its matching ToolRegistry. The caller owns host/preset
 * selection. Loader mutations alone do not prove persistence in rc.2.
 * `scope` must be a stable trusted preset/profile identifier when several trees share home.
 * Receipts store ownership and fingerprints, never connection credentials or native config.
 */
export class McpManager {
  constructor({ home, catalog, loader, tools, persistence, scope = 'default' }) {
    if (typeof home !== 'string' || !isAbsolute(home) || typeof scope !== 'string' || !scope || scope.length > 200
      || typeof catalog !== 'function' || !['entries', 'create', 'update', 'remove'].every(key => typeof loader?.[key] === 'function')
      || typeof tools?.schemas !== 'function' || persistence !== undefined && typeof persistence?.apply !== 'function') throw fail('MCP_INVALID_PORT', 'MCP management requires a trusted home, stable scope, catalog, public loader tree and matching tool registry.');
    this.root = join(resolve(home), 'community', 'mcp-manager');
    this.scope = digest(scope);
    this.scopeName = scope;
    this.catalog = catalog;
    this.loader = loader;
    this.tools = tools;
    this.persistence = persistence;
  }

  async boundary(call) {
    try { return await call(); }
    catch (error) {
      if (typeof error.code === 'string' && error.code.startsWith('MCP_')) throw error;
      throw unsafe();
    }
  }
  file(id) { return join(this.root, `${this.scope}-${digest(id)}.json`); }
  validateReceipt(pin, file) {
    if (!pin || pin.schema !== 1 || pin.scope !== this.scope || !idPattern.test(pin.id)
      || !Number.isSafeInteger(pin.revision) || pin.revision < 1 || typeof pin.name !== 'string' || pin.name.length > 80
      || typeof pin.version !== 'string' || !pin.version || pin.version.length > 40
      || !entryPattern.test(pin.entryId) || !hashPattern.test(pin.fingerprint) || !hashPattern.test(pin.definition)
      || pin.serverName !== 'dsh_' + digest(pin.id).slice(0, 28) || this.file(pin.id) !== file
      || !/^(remote|package):\d+$/.test(pin.choice)
      || ![null, 'enabled', 'disabled', 'removed'].includes(pin.persisted)
      || Object.keys(pin).some(key => !['schema', 'scope', 'id', 'revision', 'name', 'version', 'entryId', 'serverName', 'fingerprint', 'definition', 'choice', 'persisted'].includes(key))) throw unsafe();
    return pin;
  }
  async receipt(id) {
    const file = this.file(id), pin = await readJson(file);
    return pin === null ? null : this.validateReceipt(pin, file);
  }
  async receipts() {
    if (!await directory(this.root)) return [];
    const result = [];
    let count = 0;
    for await (const entry of await opendir(this.root)) {
      if (++count > 4096) throw unsafe();
      if (!entry.name.startsWith(this.scope + '-') || !entry.name.endsWith('.json')) continue;
      if (!/^[a-f0-9]{64}-[a-f0-9]{64}\.json$/.test(entry.name)) throw unsafe();
      const file = join(this.root, entry.name), pin = await readJson(file);
      if (pin) result.push(this.validateReceipt(pin, file));
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }
  async locked(call) {
    await directory(this.root, true);
    const path = join(this.root, this.scope + '.lock');
    let stat;
    try { stat = await writeNew(path, JSON.stringify({ pid: process.pid })); }
    catch (error) {
      if (error.code === 'EEXIST') throw fail('MCP_BUSY', 'MCP management is in progress for this scope. Retry after it finishes; inspect an interrupted lock before manually clearing it.');
      throw error;
    }
    try { return await call(); }
    finally {
      await directory(this.root);
      if (same(await present(path), stat)) await unlink(path);
    }
  }
  async save(pin, previous = null) {
    const path = this.file(pin.id), temp = join(this.root, `${this.scope}-${randomUUID()}.tmp`);
    const check = async () => {
      await directory(this.root);
      const current = await this.receipt(pin.id);
      if (fingerprint(current) !== fingerprint(previous)) throw unsafe();
    };
    await check();
    const stat = await writeNew(temp, JSON.stringify(pin) + '\n');
    try {
      await check();
      await rename(temp, path);
    } finally {
      await directory(this.root);
      if (same(await present(temp), stat)) await unlink(temp);
    }
  }
  async entries() {
    return native(() => {
      const entries = [];
      for (const entry of this.loader.entries()) {
        if (entries.length >= 10000) throw Error();
        entries.push(entry);
      }
      return entries;
    });
  }
  async resource({ id, revision }) {
    if (!idPattern.test(id) || !Number.isSafeInteger(revision) || revision < 1) throw fail('MCP_INVALID_REQUEST', 'A resource id and pinned revision are required.');
    const resources = await native(() => this.catalog());
    if (!Array.isArray(resources)) throw nativeFailure();
    const found = resources.filter(resource => resource.id === id);
    if (found.length !== 1) throw fail('MCP_RESOURCE_NOT_FOUND', 'The MCP resource is not uniquely available in the catalog.');
    if (found[0].revision !== revision) throw fail('MCP_REVISION_CONFLICT', 'The MCP catalog revision changed. Refresh before applying a connection change.');
    const resource = structuredClone(found[0]);
    mcpChoices(resource);
    return resource;
  }
  owned(pin, entries) {
    const found = entries.filter(entry => entry.id === pin.entryId);
    if (found.length !== 1) throw drift();
    const entry = found[0];
    if (entry.options.name !== plugin || entry.options.config?.serverName !== pin.serverName || entryPin(entry) !== pin.fingerprint
      || entries.some(other => other !== entry && other.options.config?.serverName === pin.serverName)) throw drift();
    return entry;
  }
  async project(pin, entries) {
    const row = { id: pin.id, name: pin.name, revision: pin.revision, version: pin.version,
      state: 'configured', tools: [], runtime: { entryId: pin.entryId, serverName: pin.serverName } };
    let entry;
    try { entry = this.owned(pin, entries); }
    catch { return { ...row, state: entries.some(entry => entry.id === pin.entryId) ? 'modified' : 'missing' }; }
    if (entry.disabled) return { ...row, state: 'disabled' };
    if (entry.fiber?.state === 3) return { ...row, state: 'failed' };
    if ([0, 1].includes(entry.fiber?.state)) return { ...row, state: 'connecting' };
    if (entry.fiber?.state !== 2) return row;
    const schemas = await native(() => this.tools.schemas());
    if (!Array.isArray(schemas) || schemas.length > 50000) throw nativeFailure();
    const prefix = `mcp__${pin.serverName}__`;
    row.tools = [...new Set(schemas.map(schema => schema.name).filter(name => typeof name === 'string'
      && /^[A-Za-z0-9_-]{1,64}$/.test(name) && name.startsWith(prefix) && name.length > prefix.length))].sort();
    if (row.tools.length) row.state = 'registered';
    return row;
  }

  /**
   * Private durable port: apply({scope,id,revision,entryId,previous,next}) => Promise<void>.
   * previous/next are complete native EntryOptions (or null), including secrets. Never
   * expose them over inventory APIs. The port must guard ownership + exact previous
   * state, accept an already-equal next state for retries, preserve unrelated config,
   * and resolve only once official profile configuration is durably written. A failure
   * may be uncertain: retry the same desired action before attempting its inverse.
   */
  async persist(pin, entry, desired) {
    const { id, disabled, ...options } = structuredClone(entry.options);
    const nativeOptions = state => state === null || state === 'removed' ? null
      : { ...options, id: pin.entryId, disabled: state === 'disabled' };
    try {
      await this.persistence.apply({ scope: this.scopeName, id: pin.id, revision: pin.revision, entryId: pin.entryId,
        previous: nativeOptions(pin.persisted), next: nativeOptions(desired) });
    } catch {
      throw fail('MCP_PERSISTENCE_FAILED', 'Durable MCP configuration could not be confirmed; no live change was applied. Retry the same desired action or inspect the guarded profile patch locally.');
    }
    const next = { ...pin, persisted: desired };
    await this.save(next, pin);
    return next;
  }

  removed(pin) {
    return { id: pin.id, name: pin.name, revision: pin.revision, version: pin.version, state: 'removed', tools: [],
      runtime: { entryId: pin.entryId, serverName: pin.serverName } };
  }

  /** Metadata only; unmanaged loader entries are never returned. */
  async read() {
    return this.boundary(async () => {
      const pins = await this.receipts(), entries = await this.entries();
      return Promise.all(pins.map(pin => this.project(pin, entries)));
    });
  }
  async prepare(request) {
    return this.boundary(async () => {
      const resource = await this.resource(request);
      return { id: resource.id, name: resource.title, revision: resource.revision, version: resource.version, ...mcpChoices(resource) };
    });
  }
  async run(request) {
    return this.boundary(async () => {
      if (!request || Object.keys(request).some(key => !['action', 'id', 'revision', 'choice', 'values'].includes(key))
        || !['connect', 'enable', 'disable', 'remove'].includes(request.action)
        || !idPattern.test(request.id) || !Number.isSafeInteger(request.revision) || request.revision < 1) throw fail('MCP_INVALID_REQUEST', 'Use a declared MCP management action and resource identity.');
      if (!this.persistence) throw fail('MCP_PERSISTENCE_REQUIRED', 'MCP changes require an explicit durable profile configuration port; native Loader mutations alone are not persistent.');
      const cleanup = ['disable', 'remove'].includes(request.action);
      const resource = cleanup ? null : await this.resource(request);
      // Resolve only on connect: enable/disable/remove operate on the persisted owned config.
      const config = request.action === 'connect' ? resolveMcpConfig(resource, request) : null;
      return this.locked(async () => {
        let pin = await this.receipt(request.id);
        const entries = await this.entries();
        if (pin) {
          if (cleanup && pin.revision !== request.revision) throw fail('MCP_REVISION_CONFLICT', 'The installed MCP revision changed. Refresh the installed list before cleanup.');
          if (!cleanup && (pin.revision !== resource.revision || pin.version !== resource.version || pin.definition !== definitionPin(resource))) throw drift();
          if (request.action === 'remove' && pin.persisted === null && typeof this.persistence.cancelPending === 'function') {
            try {
              await this.persistence.cancelPending({ scope: this.scopeName, id: pin.id, revision: pin.revision,
                entryId: pin.entryId, serverName: pin.serverName }, async () => {
                if ((await this.entries()).some(entry => entry.id === pin.entryId || entry.options.config?.serverName === pin.serverName)
                  || fingerprint(await this.receipt(pin.id)) !== fingerprint(pin)) throw drift();
                await unlink(this.file(pin.id));
              });
            } catch { throw drift(); }
            return this.removed(pin);
          }
          if (request.action === 'remove' && pin.persisted === 'removed' && !entries.some(entry => entry.id === pin.entryId)) {
            await unlink(this.file(request.id));
            return this.removed(pin);
          }
          this.owned(pin, entries);
        }
        if (request.action === 'connect') {
          if (pin || entries.some(entry => entry.options.config?.serverName === config.serverName)) throw conflict();
          // Create disabled first: a receipt failure must not leave an unowned executable client.
          const entryId = await native(() => this.loader.create({ name: plugin, config, disabled: true }));
          const created = (await this.entries()).find(entry => entry.id === entryId);
          if (!entryPattern.test(entryId) || entries.some(entry => entry.id === entryId) || !created || !created.disabled || created.options.name !== plugin
            || fingerprint(created.options.config) !== fingerprint(config)) throw nativeFailure();
          pin = { schema: 1, scope: this.scope, id: resource.id, revision: resource.revision, name: resource.title,
            version: resource.version, serverName: config.serverName, entryId, fingerprint: entryPin(created),
            definition: definitionPin(resource), choice: request.choice ?? mcpChoices(resource).choices.find(item => item.supported).id, persisted: null };
          await this.save(pin);
          pin = await this.persist(pin, this.owned(pin, await this.entries()), 'enabled');
          this.owned(pin, await this.entries());
          await native(() => this.loader.update(entryId, { disabled: false }));
        } else {
          if (!pin) throw fail('MCP_NOT_OWNED', 'This manager has no ownership receipt for the requested MCP resource.');
          pin = await this.persist(pin, this.owned(pin, await this.entries()), request.action === 'remove' ? 'removed' : request.action === 'disable' ? 'disabled' : 'enabled');
          const current = await this.entries();
          if (request.action === 'remove') {
            // The durable patch watcher may already have removed the live entry.
            if (current.some(entry => entry.id === pin.entryId)) {
              this.owned(pin, current);
              await native(() => this.loader.remove(pin.entryId));
            }
            if ((await this.entries()).some(entry => entry.id === pin.entryId)) throw nativeFailure();
            await this.receipt(request.id);
            await unlink(this.file(request.id));
            return this.removed(pin);
          }
          this.owned(pin, current);
          await native(() => this.loader.update(pin.entryId, { disabled: request.action === 'disable' }));
        }
        return this.project(pin, await this.entries());
      });
    });
  }
}
