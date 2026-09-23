import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const plugin = '@deepseek-ai/dsh-mcp-client';
const fail = () => Error('MCP profile configuration changed or did not converge; inspect the owned profile operation.');

/** Official profile patches are durable truth; the host watcher owns native activation. */
export function mcpProfilePort({ inventory, installer, prefix, timeout = 20000 }) {
  const staging = new Map();
  const location = entryId => {
    const base = prefix();
    if (typeof entryId !== 'string' || !entryId.startsWith(base)) throw fail();
    const local = entryId.slice(base.length);
    if (!/^market-mcp-[a-f0-9]{28}$/.test(local)) throw fail();
    return { local, key: 'mcp-' + local.slice('market-mcp-'.length) };
  };
  const rows = () => {
    const actual = [...inventory()];
    for (const row of actual) staging.delete(row.id);
    return [...actual, ...staging.values()];
  };
  async function observed(id, disabled) {
    const deadline = Date.now() + timeout;
    do {
      const row = [...inventory()].find(row => row.id === id);
      if (disabled === null ? !row : row && row.disabled === disabled) { staging.delete(id); return; }
      await delay(100);
    } while (Date.now() < deadline);
    throw fail();
  }
  const loader = {
    entries: rows,
    create: async options => {
      if (options.name !== plugin || options.disabled !== true || !/^dsh_[a-f0-9]{28}$/.test(options.config?.serverName)) throw fail();
      const local = 'market-mcp-' + options.config.serverName.slice(4), id = prefix() + local;
      // A new claim must start empty, even if an older operation wrote identical bytes.
      if ((await installer.configuration(location(id).key)).records.length || (await installer.recovery()).blocked) throw fail();
      if (rows().some(row => row.id === id || row.options.id === local)) throw fail();
      staging.set(id, { id, options: { ...structuredClone(options), id: local }, disabled: true, fiber: null });
      return id;
    },
    update: async (id, options) => {
      if (Object.keys(options).length !== 1 || typeof options.disabled !== 'boolean') throw fail();
      await observed(id, options.disabled);
    },
    remove: id => observed(id, null),
  };
  const persistence = { apply: async ({ scope, id, revision, entryId, previous, next }) => {
    const { local, key } = location(entryId);
    if (typeof scope !== 'string' || !scope || scope.length > 200 || !/^source-[a-z0-9-]{1,100}$/.test(id)
      || !Number.isSafeInteger(revision) || revision < 1) throw fail();
    const records = options => options ? [{ insert: [{ ...structuredClone(options), id: local }] }] : [];
    const desired = records(next), prior = records(previous);
    const owner = createHash('sha256').update(JSON.stringify([scope, id, revision, entryId])).digest('hex');
    const current = await installer.configuration(key, { owner, previous: prior, next: desired });
    if (isDeepStrictEqual(current.records, desired)) {
      if (current.owned || previous !== null && !current.blocked && isDeepStrictEqual(current.records, prior)) return;
      throw fail();
    }
    if (current.blocked || !isDeepStrictEqual(current.records, prior)) throw fail();
    const result = await installer.configure(key, desired, current.fingerprint, { owner, previous: prior });
    if (result.status !== 'restart-required' || !isDeepStrictEqual((await installer.configuration(key)).records, desired)) throw fail();
  }, cancelPending: async ({ entryId, serverName }, cancel) => {
    const { local, key } = location(entryId);
    if (serverName !== 'dsh_' + local.slice('market-mcp-'.length)) throw fail();
    const absent = () => ![...inventory()].some(row => row.id === entryId || row.options?.id === local || row.options?.config?.serverName === serverName);
    if (!absent()) throw fail();
    const result = await installer.cancelPendingConfiguration(key, async () => {
      if (!absent()) throw fail();
      const staged = staging.get(entryId);
      staging.delete(entryId);
      try { await cancel(); }
      catch (error) { if (staged) staging.set(entryId, staged); throw error; }
    });
    if (result.status !== 'cancelled') throw fail();
  } };
  return { loader, persistence };
}
