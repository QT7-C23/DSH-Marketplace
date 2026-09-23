import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, mkdir, symlink, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { McpManager } from '../../src/plugin/resources/mcp-manager.mjs';
import { mcpChoices } from '../../src/plugin/resources/mcp-config.mjs';

function resource() {
  return { id: 'source-mcp-fixture', type: 'MCP', title: 'Fixture MCP', summary: 'MCP fixture',
    version: '1.2.3', revision: 1, status: 'external', sourceId: 'mcp', source: 'MCP Registry',
    owner: 'source:mcp', author: 'org.example', updatedAt: '', requirements: '',
    url: 'https://example.com/project', body: 'Fixture', serverDefinition: { name: 'org.example/fixture', version: '1.2.3',
      remotes: [{ type: 'streamable-http', url: 'https://api.example.com/mcp', headers: [{ name: 'Authorization', isRequired: true, isSecret: true }] }] } };
}
// Only the public Loader surface exists. Runtime state/tools are independent observations.
function ports() {
  const rows = [], calls = [], schemas = [];
  const loader = { *entries() { yield* rows; },
    async create(options) { calls.push(['create', structuredClone(options)]); const id = `entry-${calls.length}`;
      rows.push({ id, options: { id, ...structuredClone(options) }, get disabled() { return !!this.options.disabled; } }); return id; },
    async update(id, options) { calls.push(['update', id, structuredClone(options)]); Object.assign(rows.find(r => r.id === id).options, structuredClone(options)); },
    async remove(id) { calls.push(['remove', id]); rows.splice(rows.findIndex(r => r.id === id), 1); } };
  return { rows, calls, schemas, loader, tools: { schemas: () => structuredClone(schemas) } };
}
async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-mcp-manager-'));
  t.after(async () => { assert.ok(resolve(home).startsWith(resolve(tmpdir()) + sep)); await rm(home, { recursive: true, force: true }); });
  const r = resource(), p = ports();
  const patchPath = join(home, 'native-patch.json'), persistenceLog = [];
  // A real durable test port. Production supplies guarded official profile patch persistence.
  const persistence = { async apply(change) {
    persistenceLog.push(structuredClone(change));
    let records = { unmanaged: { config: 'preserve-me' } };
    try { records = JSON.parse(await readFile(patchPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const key = `${change.scope}:${change.id}`, previous = records[key] ?? null;
    if (JSON.stringify(previous) !== JSON.stringify(change.next)) assert.deepEqual(previous, change.previous, 'durable config drift');
    if (change.next === null) delete records[key]; else records[key] = change.next;
    const temp = patchPath + '.tmp'; await writeFile(temp, JSON.stringify(records)); await rename(temp, patchPath);
  } };
  const options = { home, catalog: () => [r], loader: p.loader, tools: p.tools, persistence };
  const manager = new McpManager(options);
  const request = { id: r.id, revision: r.revision, choice: 'remote:0', values: { 'header:Authorization': 'secret-never-in-inventory' } };
  return { home, r, p, options, manager, request, persistence, persistenceLog, patchPath };
}

test('prepare pins catalog revision, connect persists ownership, inventory needs real public tool evidence', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.manager.read(), []);
  const preview = await f.manager.prepare(f.request);
  assert.equal(preview.id, f.r.id); assert.equal(preview.choices[0].fields[0].secret, true);
  assert.equal(f.p.calls.length, 0);
  const result = await f.manager.run({ ...f.request, action: 'connect' });
  assert.equal(result.state, 'configured');
  assert.equal(f.p.calls[0][1].disabled, true);
  assert.equal(f.p.rows[0].options.config.headers.Authorization, 'secret-never-in-inventory');
  f.p.rows[0].fiber = { state: 2 };
  assert.equal((await f.manager.read())[0].state, 'configured');
  f.p.schemas.push({ name: 'mcp__unmanaged__tool' });
  assert.equal((await f.manager.read())[0].state, 'configured');
  const tool = `mcp__${preview.serverName}__search`;
  f.p.schemas.push({ name: tool });
  const [row] = await new McpManager(f.options).read();
  assert.equal(row.state, 'registered'); assert.deepEqual(row.tools, [tool]);
  assert.deepEqual(row.runtime, { entryId: f.p.rows[0].id, serverName: preview.serverName });
  assert.deepEqual(Object.keys(row).sort(), ['id', 'name', 'revision', 'runtime', 'state', 'tools', 'version']);
  assert.doesNotMatch(JSON.stringify(row), /secret-never|headers|config|[A-Z]:\\/);
  for (const name of await readdir(join(f.home, 'community/mcp-manager'))) {
    if (name.endsWith('.json')) assert.doesNotMatch(await readFile(join(f.home, 'community/mcp-manager', name), 'utf8'), /secret-never/);
  }
  f.p.rows[0].fiber.state = 1; assert.equal((await f.manager.read())[0].state, 'connecting');
  f.p.rows[0].fiber.state = 3; assert.equal((await f.manager.read())[0].state, 'failed');
});

test('enable, disable and remove affect only the owned entry and retain identity across manager restarts', async t => {
  const f = await fixture(t);
  await f.p.loader.create({ name: '@deepseek-ai/dsh-mcp-client', config: { serverName: 'unmanaged', headers: { Authorization: 'other-secret' } } });
  const unrelated = structuredClone(f.p.rows[0].options);
  await f.manager.run({ ...f.request, action: 'connect' });
  assert.equal((await f.manager.run({ ...f.request, action: 'disable' })).state, 'disabled');
  assert.equal((await new McpManager(f.options).run({ ...f.request, action: 'enable' })).state, 'configured');
  assert.equal((await f.manager.run({ ...f.request, action: 'remove' })).state, 'removed');
  assert.deepEqual(await f.manager.read(), []);
  assert.deepEqual(f.p.rows.map(r => r.options), [unrelated]);
});

test('unmanaged namespace collision and config drift never permit mutation or expose secrets', async t => {
  const f = await fixture(t);
  await f.p.loader.create({ name: '@deepseek-ai/dsh-mcp-client', config: { serverName: mcpChoices(f.r).serverName } });
  const before = f.p.calls.length;
  await assert.rejects(f.manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_CONFLICT' });
  assert.equal(f.p.calls.length, before);
  f.p.rows.length = 0;
  await f.manager.run({ ...f.request, action: 'connect' });
  f.p.rows[0].options.config.headers.Authorization = 'drift-secret';
  assert.equal((await f.manager.read())[0].state, 'modified');
  const count = f.p.calls.length;
  for (const action of ['connect', 'enable', 'disable', 'remove']) {
    await assert.rejects(f.manager.run({ ...f.request, action }), error => error.code === 'MCP_DRIFT' && !error.message.includes('drift-secret'));
  }
  assert.equal(f.p.calls.length, count);
});

test('stale revisions, caller config and invalid fields fail before any loader mutation', async t => {
  const f = await fixture(t);
  await assert.rejects(f.manager.prepare({ ...f.request, revision: 2 }), { code: 'MCP_REVISION_CONFLICT' });
  await assert.rejects(f.manager.run({ ...f.request, action: 'connect', values: {} }), { code: 'MCP_INVALID_VALUES' });
  await assert.rejects(f.manager.run({ ...f.request, action: 'connect', config: { url: 'https://evil.example.com' } }), { code: 'MCP_INVALID_REQUEST' });
  assert.equal(f.p.calls.length, 0);
});

test('loader failures are sanitized and persisted ownership permits later disable/remove', async t => {
  const f = await fixture(t);
  const update = f.p.loader.update;
  f.p.loader.update = async (...args) => { await update(...args); throw Error('Authorization: secret-never-in-inventory https://user:password@private'); };
  await assert.rejects(f.manager.run({ ...f.request, action: 'connect' }), error => error.code === 'MCP_NATIVE_FAILED' && !/secret-never|password/.test(error.message));
  f.p.loader.update = update;
  assert.equal((await new McpManager(f.options).read()).length, 1);
  await f.manager.run({ ...f.request, action: 'remove' });
  assert.equal(f.p.rows.length, 0);
});

test('concurrent managers serialize ownership with an exclusive filesystem lock', async t => {
  const f = await fixture(t);
  let enter, release;
  const entered = new Promise(r => { enter = r; }), waiting = new Promise(r => { release = r; });
  const create = f.p.loader.create;
  f.p.loader.create = async options => { enter(); await waiting; return create(options); };
  const first = f.manager.run({ ...f.request, action: 'connect' });
  await entered;
  await assert.rejects(new McpManager(f.options).run({ ...f.request, action: 'connect' }), { code: 'MCP_BUSY' });
  release(); await first;
  assert.equal(f.p.calls.filter(c => c[0] === 'create').length, 1);
});

test('ownership storage rejects symlink roots and corrupt receipts without changing loader entries', async t => {
  const f = await fixture(t);
  const outside = join(f.home, 'outside'); await mkdir(outside);
  await symlink(outside, join(f.home, 'community'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_STORAGE_UNSAFE' });
  assert.equal(f.p.calls.length, 0); assert.deepEqual(await readdir(outside), []);
});

test('corrupt receipts and missing owned entries fail closed', async t => {
  const f = await fixture(t);
  await f.manager.run({ ...f.request, action: 'connect' });
  f.p.rows.length = 0;
  assert.equal((await f.manager.read())[0].state, 'missing');
  await assert.rejects(f.manager.run({ ...f.request, action: 'enable' }), { code: 'MCP_DRIFT' });
  const folder = join(f.home, 'community/mcp-manager');
  const file = (await readdir(folder)).find(name => name.endsWith('.json'));
  await writeFile(join(folder, file), '{"credential":"secret-never-in-inventory"}');
  await assert.rejects(f.manager.read(), error => error.code === 'MCP_STORAGE_UNSAFE' && !error.message.includes('secret-never'));
});

test('receipts are scoped to the caller-selected native tree', async t => {
  const f = await fixture(t), secondPorts = ports();
  const second = new McpManager({ ...f.options, scope: 'second-preset', loader: secondPorts.loader, tools: secondPorts.tools });
  await f.manager.run({ ...f.request, action: 'connect' });
  assert.deepEqual(await second.read(), []);
  await second.run({ ...f.request, action: 'connect' });
  await second.run({ ...f.request, action: 'remove' });
  assert.equal((await f.manager.read()).length, 1);
  assert.equal(f.p.rows.length, 1); assert.equal(secondPorts.rows.length, 0);
});

test('null ownership records are corrupt, never silently treated as unowned', async t => {
  const f = await fixture(t);
  await f.manager.run({ ...f.request, action: 'connect' });
  const folder = join(f.home, 'community/mcp-manager');
  const file = (await readdir(folder)).find(name => name.endsWith('.json'));
  await writeFile(join(folder, file), 'null');
  await assert.rejects(f.manager.read(), { code: 'MCP_STORAGE_UNSAFE' });
});

test('catalog definition drift blocks enabling but permits cleanup; local injection drift still refuses mutation', async t => {
  const f = await fixture(t);
  await f.manager.run({ ...f.request, action: 'connect' });
  f.r.serverDefinition.remotes[0].url = 'https://different.example.com/mcp';
  await assert.rejects(f.manager.run({ ...f.request, action: 'enable' }), { code: 'MCP_DRIFT' });
  assert.equal((await f.manager.run({ ...f.request, action: 'disable' })).state, 'disabled');
  f.r.serverDefinition.remotes[0].url = 'https://api.example.com/mcp';
  f.p.rows[0].options.inject = ['different-service'];
  assert.equal((await f.manager.read())[0].state, 'modified');
  await assert.rejects(f.manager.run({ ...f.request, action: 'remove' }), { code: 'MCP_DRIFT' });
});

test('owned cleanup survives catalog updates, withdrawal and initial connection failure', async t => {
  for (const variation of ['updated', 'withdrawn', 'failed-withdrawn']) {
    const f = await fixture(t);
    const update = f.p.loader.update;
    if (variation === 'failed-withdrawn') {
      f.p.loader.update = async () => { throw Error('transport unavailable'); };
      await assert.rejects(f.manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_NATIVE_FAILED' });
      f.p.loader.update = update;
    } else await f.manager.run({ ...f.request, action: 'connect' });
    if (variation === 'updated') f.r.revision = 2;
    else f.manager.catalog = () => [];
    await assert.rejects(f.manager.run({ ...f.request, revision: 2, action: 'disable' }), { code: 'MCP_REVISION_CONFLICT' });
    assert.equal((await f.manager.run({ ...f.request, action: 'disable' })).state, 'disabled');
    assert.equal((await f.manager.run({ ...f.request, action: 'remove' })).state, 'removed');
    assert.equal(f.p.rows.length, 0);
  }
});

test('tool registration is an observation, never a transport health claim', async t => {
  const f = await fixture(t);
  await f.manager.run({ ...f.request, action: 'connect' });
  f.p.rows[0].fiber = { state: 2 };
  f.p.schemas.push({ name: `mcp__${mcpChoices(f.r).serverName}__search` });
  assert.equal((await f.manager.read())[0].state, 'registered');
  // The public surfaces remain identical during native reconnect backoff.
  assert.equal((await f.manager.read())[0].state, 'registered');
  f.p.schemas.length = 0;
  assert.equal((await f.manager.read())[0].state, 'configured');
});

test('mutations require an explicit durable port; native Loader methods alone make no persistence promise', async t => {
  const f = await fixture(t);
  const manager = new McpManager({ ...f.options, persistence: undefined });
  assert.equal((await manager.prepare(f.request)).id, f.r.id);
  await assert.rejects(manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_PERSISTENCE_REQUIRED' });
  assert.equal(f.p.calls.length, 0);
});

test('durable changes precede live enable/disable/remove and preserve unmanaged patch entries', async t => {
  const f = await fixture(t), update = f.p.loader.update, remove = f.p.loader.remove;
  f.p.loader.update = async (id, options) => {
    const records = JSON.parse(await readFile(f.patchPath, 'utf8'));
    assert.equal(records[`default:${f.r.id}`].disabled, options.disabled);
    return update(id, options);
  };
  f.p.loader.remove = async id => {
    assert.equal(JSON.parse(await readFile(f.patchPath, 'utf8'))[`default:${f.r.id}`], undefined);
    return remove(id);
  };
  await f.manager.run({ ...f.request, action: 'connect' });
  assert.equal(f.persistenceLog[0].previous, null);
  assert.equal(f.persistenceLog[0].next.config.headers.Authorization, 'secret-never-in-inventory');
  await f.manager.run({ ...f.request, action: 'disable' });
  await f.manager.run({ ...f.request, action: 'enable' });
  await f.manager.run({ ...f.request, action: 'remove' });
  assert.equal(f.persistenceLog.length, 4);
  assert.deepEqual(JSON.parse(await readFile(f.patchPath, 'utf8')), { unmanaged: { config: 'preserve-me' } });
});

test('persistence failure cannot activate or mutate a live client and never leaks config', async t => {
  const f = await fixture(t), apply = f.persistence.apply;
  f.persistence.apply = async () => { throw Error('secret-never-in-inventory profile/path Authorization'); };
  await assert.rejects(f.manager.run({ ...f.request, action: 'connect' }), error => error.code === 'MCP_PERSISTENCE_FAILED' && !/secret-never|profile\/path/.test(error.message));
  assert.equal(f.p.rows[0].disabled, true);
  assert.equal(f.p.calls.filter(c => c[0] === 'update').length, 0);
  f.persistence.apply = apply;
  await f.manager.run({ ...f.request, action: 'enable' });
  f.persistence.apply = async () => { throw Error('private'); };
  for (const action of ['disable', 'remove']) await assert.rejects(f.manager.run({ ...f.request, action }), { code: 'MCP_PERSISTENCE_FAILED' });
  assert.equal(f.p.rows[0].disabled, false);
  assert.equal(f.p.rows.length, 1);
});

test('remove accepts a patch watcher completing removal during durable persistence', async t => {
  const f = await fixture(t);
  await f.manager.run({ ...f.request, action: 'connect' });
  await f.p.loader.create({ name: 'unmanaged-plugin', config: { untouched: true } });
  const unmanaged = structuredClone(f.p.rows[1].options), apply = f.persistence.apply;
  f.persistence.apply = async change => {
    await apply(change);
    if (change.next === null) f.p.rows.splice(f.p.rows.findIndex(row => row.id === change.entryId), 1);
  };
  const result = await f.manager.run({ ...f.request, action: 'remove' });
  assert.equal(result.state, 'removed');
  assert.equal(f.p.calls.filter(call => call[0] === 'remove').length, 0);
  assert.deepEqual(await f.manager.read(), []);
  assert.deepEqual(f.p.rows.map(row => row.options), [unmanaged]);
  assert.equal((await readdir(join(f.home, 'community/mcp-manager'))).filter(name => name.endsWith('.json')).length, 0);
  assert.deepEqual(JSON.parse(await readFile(f.patchPath, 'utf8')), { unmanaged: { config: 'preserve-me' } });
});

test('remove still refuses a changed same-id entry after durable persistence', async t => {
  const f = await fixture(t);
  await f.manager.run({ ...f.request, action: 'connect' });
  const apply = f.persistence.apply;
  f.persistence.apply = async change => {
    await apply(change);
    if (change.next === null) f.p.rows[0].options.config.headers.Authorization = 'replacement-secret';
  };
  await assert.rejects(f.manager.run({ ...f.request, action: 'remove' }), { code: 'MCP_DRIFT' });
  assert.equal(f.p.calls.filter(call => call[0] === 'remove').length, 0);
  assert.equal(f.p.rows[0].options.config.headers.Authorization, 'replacement-secret');
  assert.equal((await f.manager.read())[0].state, 'modified');
});
