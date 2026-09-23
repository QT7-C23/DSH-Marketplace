import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { ProfileInstaller } from './plugin/compatibility/installer.mjs';
import { McpManager } from './plugin/resources/mcp-manager.mjs';
import { mcpProfilePort } from './plugin/resources/mcp-profile.mjs';
import { resolveMcpConfig } from './plugin/resources/mcp-config.mjs';

const plugin = '@deepseek-ai/dsh-mcp-client';
const secret = 'secret-never-in-public-recovery';
async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-mcp-profile-'));
  t.after(async () => { assert.ok(resolve(home).startsWith(resolve(tmpdir()) + sep)); await rm(home, { recursive: true, force: true }); });
  const dir = join(home, 'profiles', 'fixture');
  await mkdir(dir, { recursive: true });
  const patch = join(dir, 'cordis.patch.yml'), lock = join(dir, '.dsh-market-installer.lock');
  await writeFile(patch, '# retain unrelated comment\n[]\n');
  const options = { home, profile: 'fixture', cli: join(home, 'cli.mjs'), folder: join(home, 'journal') };
  const resource = { id: 'source-mcp-profile', type: 'MCP', title: 'Profile MCP', summary: 'fixture', version: '1.2.3', revision: 1,
    status: 'external', sourceId: 'mcp', source: 'MCP Registry', owner: 'source:mcp', author: 'org.example', updatedAt: '', requirements: '',
    url: 'https://example.com/project', body: 'Fixture', serverDefinition: { name: 'org.example/profile', version: '1.2.3',
      remotes: [{ type: 'streamable-http', url: 'https://api.example.com/mcp', headers: [{ name: 'Authorization', isRequired: true, isSecret: true }] }] } };
  const request = { id: resource.id, revision: 1, choice: 'remote:0', values: { 'header:Authorization': secret } };
  const config = resolveMcpConfig(resource, request), local = 'market-mcp-' + config.serverName.slice(4);
  const key = 'mcp-' + config.serverName.slice(4), entryId = 'market:' + local, rows = [];
  const native = { name: plugin, config, id: entryId, disabled: false };
  const records = [{ insert: [{ ...native, id: local }] }];
  const change = { scope: 'profile-fixture', id: resource.id, revision: 1, entryId, previous: null, next: native };
  const installer = new ProfileInstaller(options);
  // A test watcher observes the actual patch after configure. It does not invent runtime/tools state.
  async function observe() {
    const current = await installer.configuration(key);
    rows.splice(0, rows.length, ...current.records.flatMap(row => row.insert ?? []).map(options => ({
      id: 'market:' + options.id, options: structuredClone(options), disabled: options.disabled, fiber: null,
    })));
  }
  function recreate(watch = true) {
    const real = new ProfileInstaller(options);
    const bound = watch ? new Proxy(real, { get(target, prop) {
      if (prop === 'configure') return async (...args) => { const result = await target.configure(...args); await observe(); return result; };
      return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
    } }) : real;
    const port = mcpProfilePort({ inventory: () => rows, installer: bound, prefix: () => 'market:', timeout: 100 });
    return { port, manager: new McpManager({ home, catalog: () => [resource], ...port, scope: change.scope, tools: { schemas: () => [] } }) };
  }
  return { home, dir, patch, lock, options, resource, request, config, key, entryId, records, change, rows, installer, recreate, observe };
}

async function fault(name, replacement, call) {
  const original = fs[name];
  fs[name] = (...args) => replacement(original, ...args);
  syncBuiltinESMExports();
  try { return await call(); } finally { fs[name] = original; syncBuiltinESMExports(); }
}
async function failFirstWrite(f) {
  const { manager } = f.recreate();
  await fault('open', (original, path, ...args) => {
    if (String(path).includes('.dsh-market-patch-')) throw Error(secret);
    return original(path, ...args);
  }, () => assert.rejects(manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_PERSISTENCE_FAILED' }));
  assert.equal((await manager.receipt(f.resource.id)).persisted, null);
  assert.deepEqual((await f.installer.configuration(f.key)).records, []);
}

test('failed first write can be cancelled after real port/manager recreation and connected anew', async t => {
  const f = await fixture(t);
  await failFirstWrite(f);
  const { manager } = f.recreate();
  assert.equal((await manager.read())[0].state, 'missing');
  assert.equal((await manager.run({ ...f.request, action: 'remove' })).state, 'removed');
  assert.deepEqual(await manager.read(), []);
  const next = await f.recreate().manager.run({ ...f.request, action: 'connect' });
  assert.equal(next.state, 'configured');
  assert.deepEqual((await f.installer.configuration(f.key)).records, f.records);
});

test('fresh create refuses an identical existing block even without a native entry', async t => {
  const f = await fixture(t);
  assert.equal((await f.installer.configure(f.key, f.records, await f.installer.fingerprint())).status, 'restart-required');
  const before = await readFile(f.patch);
  const { port, manager } = f.recreate();
  await assert.rejects(port.loader.create({ name: plugin, config: f.config, disabled: true }));
  await assert.rejects(manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_NATIVE_FAILED' });
  assert.deepEqual(await manager.read(), []);
  assert.deepEqual(await readFile(f.patch), before);
  await assert.rejects(port.persistence.apply(f.change));
});

test('own uncertain commit is distinguishable across recreation and retains its recovery lock', async t => {
  const f = await fixture(t), { manager } = f.recreate();
  await fault('rename', async (original, from, to) => {
    await original(from, to);
    if (to === f.patch) throw Error(secret);
  }, () => assert.rejects(manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_PERSISTENCE_FAILED' }));
  const lock = await readFile(f.lock), before = await readFile(f.patch);
  const next = f.recreate();
  await assert.rejects(next.port.persistence.apply({ ...f.change, scope: 'different-scope' }));
  await next.port.persistence.apply(f.change);
  assert.equal((await next.manager.run({ ...f.request, action: 'enable' })).state, 'configured');
  assert.deepEqual(await readFile(f.lock), lock);
  assert.deepEqual(await readFile(f.patch), before);
  const recovery = await f.installer.recovery();
  assert.equal(recovery.blocked, true);
  assert.equal(recovery.operationId, JSON.parse(lock).operationId);
  assert.doesNotMatch(JSON.stringify(recovery), /secret|fingerprint|"config"|headers|[A-Z]:\\|folder/);
});

test('pending cancellation refuses locks, unresolved journals, durable blocks and native identity collisions', async t => {
  for (const obstruction of ['lock', 'journal', 'block', 'entry', 'namespace']) {
    const f = await fixture(t);
    await failFirstWrite(f);
    if (obstruction === 'lock') await writeFile(f.lock, JSON.stringify({ operationId: '11111111-1111-4111-8111-111111111111', folder: secret }));
    if (obstruction === 'journal') {
      const [op] = await readdir(f.options.folder);
      const path = join(f.options.folder, op, 'journal.jsonl');
      const events = (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse);
      events.at(-1).phase = 'recovery-required'; events.at(-1).reason = 'execution-or-verification-failed';
      await writeFile(path, events.map(row => JSON.stringify(row)).join('\n') + '\n');
    }
    if (obstruction === 'block') await f.installer.configure(f.key, f.records, await f.installer.fingerprint());
    if (obstruction === 'entry') f.rows.push({ id: f.entryId, options: { name: 'unmanaged', config: {} } });
    if (obstruction === 'namespace') f.rows.push({ id: 'other-entry', options: { name: plugin, config: f.config } });
    const { manager } = f.recreate(), before = await readFile(f.patch);
    const pin = await manager.receipt(f.resource.id);
    await assert.rejects(manager.run({ ...f.request, action: 'remove' }), { code: 'MCP_DRIFT' });
    assert.deepEqual(await manager.receipt(f.resource.id), pin, obstruction);
    assert.deepEqual(await readFile(f.patch), before, obstruction);
  }
});

test('ordinary persisted missing or replaced entries cannot use pending cancellation', async t => {
  const f = await fixture(t);
  await f.recreate().manager.run({ ...f.request, action: 'connect' });
  f.rows.length = 0;
  await f.installer.configure(f.key, [], await f.installer.fingerprint());
  const { manager } = f.recreate(), pin = await manager.receipt(f.resource.id);
  await assert.rejects(manager.run({ ...f.request, action: 'remove' }), { code: 'MCP_DRIFT' });
  f.rows.push({ id: f.entryId, options: { name: 'replacement', config: {} } });
  await assert.rejects(manager.run({ ...f.request, action: 'remove' }), { code: 'MCP_DRIFT' });
  assert.deepEqual(await manager.receipt(f.resource.id), pin);
});

test('pending cancellation rechecks the durable profile immediately before deleting its receipt', async t => {
  const f = await fixture(t);
  await failFirstWrite(f);
  const { manager } = f.recreate(), pin = await manager.receipt(f.resource.id);
  const external = '# external edit during cancellation\n[]\n';
  let appends = 0;
  await fault('open', async (original, path, flag, ...args) => {
    if (String(path).endsWith('journal.jsonl') && flag === 'a' && ++appends === 2) await writeFile(f.patch, external);
    return original(path, flag, ...args);
  }, () => assert.rejects(manager.run({ ...f.request, action: 'remove' }), { code: 'MCP_DRIFT' }));
  assert.deepEqual(await manager.receipt(f.resource.id), pin);
  assert.equal(await readFile(f.patch, 'utf8'), external);
});

test('same-port pending cancellation and subsequent recreation do not leave inert staging behind', async t => {
  const f = await fixture(t), { port, manager } = f.recreate();
  await fault('open', (original, path, ...args) => {
    if (String(path).includes('.dsh-market-patch-')) throw Error(secret);
    return original(path, ...args);
  }, () => assert.rejects(manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_PERSISTENCE_FAILED' }));
  assert.equal([...port.loader.entries()].length, 1);
  assert.equal((await manager.run({ ...f.request, action: 'remove' })).state, 'removed');
  assert.deepEqual([...port.loader.entries()], []);
  assert.deepEqual(await f.recreate().manager.read(), []);
});

test('lost acknowledgement of a completed own write survives recreation but never authorizes fresh adoption', async t => {
  const f = await fixture(t);
  await f.recreate(false).port.persistence.apply(f.change);
  assert.equal((await f.installer.recovery()).blocked, false);
  await f.recreate(false).port.persistence.apply(f.change);
  await assert.rejects(f.recreate(false).port.loader.create({ name: plugin, config: f.config, disabled: true }));
  for (const change of [{ ...f.change, id: 'source-another' }, { ...f.change, revision: 2 },
    { ...f.change, next: { ...f.change.next, config: { ...f.config, headers: { Authorization: 'different-secret' } } } }]) {
    await assert.rejects(f.recreate(false).port.persistence.apply(change));
  }
  // An unrelated writer producing equal bytes is not this port's write evidence.
  await f.installer.configure(f.key, f.records, await f.installer.fingerprint());
  await assert.rejects(f.recreate(false).port.persistence.apply(f.change));
});

test('uncertain failure before rename retains empty pending receipt and lock for manual recovery', async t => {
  const f = await fixture(t), { manager } = f.recreate();
  await fault('rename', (original, from, to) => {
    if (to === f.patch) throw Error(secret);
    return original(from, to);
  }, () => assert.rejects(manager.run({ ...f.request, action: 'connect' }), { code: 'MCP_PERSISTENCE_FAILED' }));
  const lock = await readFile(f.lock), pin = await manager.receipt(f.resource.id);
  assert.deepEqual((await f.installer.configuration(f.key)).records, []);
  await assert.rejects(f.recreate().manager.run({ ...f.request, action: 'remove' }), { code: 'MCP_DRIFT' });
  assert.deepEqual(await manager.receipt(f.resource.id), pin);
  assert.deepEqual(await readFile(f.lock), lock);
  assert.equal((await f.installer.recovery()).blocked, true);
});
