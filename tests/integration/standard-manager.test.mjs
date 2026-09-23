import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtensionManager } from '../../src/plugin/compatibility/manager.mjs';
import { standardRuntimePort } from '../../src/plugin/compatibility/ports.mjs';
import { standardFixture } from '../helpers/standard-test-fixture.mjs';

test('manager delegates standard toggles to the owned port and exposes desired/actual plus adoption notice without private plans', async () => {
  const target = { name: 'standard-test', version: '1.0.0', routes: ['dsh-std'], packageManifest: {}, standardManifest: { id: 'test.standard' } };
  const calls = [];
  const manager = new ExtensionManager({ environment: { profile: 'web' }, packages: { read: async () => [target] },
    installer: { fingerprint: async () => 'profile' }, native: { read: async () => [], toggle: () => { throw Error('wrong route'); } },
    standard: { adapter: () => ({}), read: async () => [{ id: 'test.standard', version: '1.0.0', facets: [{ name: 'host', state: 'active' }] }],
      management: async () => ({ state: 'active', packages: [{ name: target.name, desired: 'disabled', actual: 'enabled', restartRequired: true, toggleable: true }] }),
      prepareToggle: async (name, enabled) => ({ name, enabled, firstAdoption: true, private: 'private-core-config' }),
      toggle: async (plan, fingerprint) => { calls.push([plan, fingerprint]); return { status: 'restart-required' }; } } });
  const read = await manager.read();
  assert.equal(read.items[0].state, 'restart-required'); assert.equal(read.items[0].desired, 'disabled');
  assert.equal(read.items[0].actual, 'enabled'); assert.equal(read.items[0].toggleable, true);
  const plan = await manager.prepare({ action: 'prepare-disable', name: target.name });
  assert.equal(plan.notice, 'standard-adoption-reloads-all'); assert.equal(plan.firstAdoption, true);
  assert.doesNotMatch(JSON.stringify(plan), /private-core-config/);
  await manager.execute({ planId: plan.id, requestId: '12345678-1234-1234-1234-123456789012' });
  assert.equal(calls.length, 1); assert.equal(calls[0][0].enabled, false); assert.equal(calls[0][1], 'profile');
});

test('configured standard port uses the exact marketplace profile tree; legacy read-only port remains compatible', async () => {
  const f = await standardFixture(); await f.add('alpha');
  const tree = {}, parent = { tree, ctx: { fiber: {} } };
  const rows = f.compose().map(options => ({ options, id: 'include:' + options.id, parent, fiber: { state: 2, uid: 1, config: { ...options.config, profileBaseUrl: f.baseUrl } } }));
  const adapter = { describe: () => ({ runtime: { instanceId: 'test' } }), publications: { list: () => [] }, protocols: { negotiate: () => ({ compatible: true }) }, snapshot: async () => ({ facets: [] }) };
  const ctx = { loader: { entries: () => rows }, get: () => adapter };
  assert.deepEqual(await standardRuntimePort(ctx).read(), []);
  const port = standardRuntimePort(ctx, { installer: f.installer, profileDir: f.profileDir });
  assert.equal((await port.prepareToggle('alpha', false)).firstAdoption, true);
  rows[1].parent = { tree: {}, ctx: { fiber: {} } };
  await assert.rejects(port.prepareToggle('alpha', false));
});

test('configured port reports ordinary adapter absence without hiding native inventory or adapter-required state', async () => {
  for (const standard of [false, true]) {
    const f = await standardFixture();
    const candidate = standard ? { name: 'alpha', version: '1.0.0', routes: ['dsh-std'], standardManifest: { id: 'test.alpha' } }
      : { name: 'native', version: '1.0.0', routes: ['native'] };
    const ctx = { loader: { entries: () => [] }, get: () => undefined };
    const port = standardRuntimePort(ctx, { installer: f.installer, profileDir: f.profileDir });
    const manager = new ExtensionManager({ environment: { profile: 'web' }, installer: f.installer,
      packages: { read: async () => [candidate] }, native: { read: async () => [{ name: 'native', state: 'active' }] }, standard: port });
    const result = await manager.read();
    assert.equal(result.complete, true);
    assert.equal(result.items[0].state, standard ? 'adapter-required' : 'active');
    await f.installer.configure('extension-standard', [{ id: 'owned', disabled: true }], await f.installer.fingerprint());
    assert.equal((await manager.read()).complete, false, 'lost adapter after adoption remains an inspection failure');
  }
});
