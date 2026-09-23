import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtensionManager } from '../../src/plugin/compatibility/manager.mjs';
import { inspectPackage } from '../../src/plugin/compatibility/packages.mjs';

const candidate = () => ({ ...inspectPackage({ name: 'example-native', version: '1.0.0', engines: { dsh: '0.1.5-rc.2' }, dsh: { bundle: { patch: './cordis.patch.yml' } } }), integrity: 'sha512-proof', tarball: 'https://registry.npmjs.org/example-native/-/example-native-1.0.0.tgz' });
function fixture() {
  let fingerprint = 'original', installs = 0;
  const options = { environment: { profile: 'web', hostVersion: '0.1.5-rc.2' }, prepare: async () => candidate(), packages: { read: async () => [] }, native: { read: async () => [] }, standard: { adapter: () => undefined, read: async () => [] }, installer: { fingerprint: async () => fingerprint, install: async () => { installs++; return { status: 'restart-required', operationId: 'operation', action: 'install', name: 'example-native', version: '1.0.0', backupCreated: true }; }, remove: async () => { throw Error('not called'); } } };
  return { options, changed: () => { fingerprint = 'external-change'; }, installs: () => installs };
}

test('one reviewed install plan executes once across double clicks and lost-response retries', async () => {
  const f = fixture(); const manager = new ExtensionManager(f.options);
  const plan = await manager.prepare({ action: 'prepare-install', spec: 'example-native@1.0.0' });
  assert.equal(plan.compatibility.state, 'declared'); assert.equal(f.installs(), 0);
  assert.doesNotMatch(JSON.stringify(plan), /packageManifest|fingerprint|secret/);
  const command = { action: 'execute', planId: plan.id, requestId: '12345678-1234-1234-1234-123456789012' };
  const [a, b] = await Promise.all([manager.execute(command), manager.execute(command)]);
  assert.deepEqual(a, b); assert.equal(a.status, 'restart-required'); assert.equal(f.installs(), 1);
  assert.deepEqual(await manager.execute(command), a); assert.equal(f.installs(), 1);
  await assert.rejects(manager.execute({ ...command, planId: 'another-plan' }), /重复/);
});

test('manager passes only the four reviewed artifact fields to the official installer', async () => {
  const f = fixture();
  f.options.installer.install = async value => {
    assert.deepEqual(Object.keys(value).sort(), ['integrity', 'name', 'tarball', 'version']);
    assert.equal(value.version, '1.0.0');
    return { status: 'restart-required' };
  };
  const manager = new ExtensionManager(f.options);
  const plan = await manager.prepare({ action: 'prepare-install', spec: 'example-native@1.0.0' });
  await manager.execute({ planId: plan.id, requestId: '12345678-1234-1234-1234-123456789012' });
});

test('a changed environment or incompatible host cannot execute a reviewed plan', async () => {
  const f = fixture(); const manager = new ExtensionManager(f.options);
  const plan = await manager.prepare({ action: 'prepare-install', spec: 'example-native@1.0.0' });
  f.changed();
  await assert.rejects(manager.execute({ action: 'execute', planId: plan.id, requestId: '22345678-1234-1234-1234-123456789012' }), /环境已变化/);
  assert.equal(f.installs(), 0);
  f.options.environment.hostVersion = '0.1.4';
  const blocked = await manager.prepare({ action: 'prepare-install', spec: 'example-native@1.0.0' });
  assert.equal(blocked.allowed, false);
  await assert.rejects(manager.execute({ action: 'execute', planId: blocked.id, requestId: '32345678-1234-1234-1234-123456789012' }), /不满足/);
});

test('installed packages use distinct native and standard inventories with version-aware states', async () => {
  const f = fixture();
  const std = { ...candidate(), name: 'standard-package', routes: ['dsh-std'], standardManifest: { id: 'example.standard' } };
  f.options.packages.read = async () => [candidate(), std];
  f.options.native.read = async () => [{ name: 'example-native', state: 'active', entries: 1, secret: '/private/config' }];
  f.options.standard.adapter = () => ({});
  f.options.standard.read = async () => [{ id: 'example.standard', version: '0.9.0', facets: [{ name: 'host', state: 'active' }] }];
  const result = await new ExtensionManager(f.options).read();
  assert.equal(result.items.find(row => row.name === 'example-native').state, 'active');
  assert.equal(result.items.find(row => row.name === 'standard-package').state, 'restart-required');
  assert.doesNotMatch(JSON.stringify(result), /private|secret|packageManifest/);
  f.options.standard.read = async () => { throw Error('private cause'); };
  const partial = await new ExtensionManager(f.options).read();
  assert.equal(partial.complete, false);
  assert.equal(partial.items.find(row => row.name === 'standard-package').state, 'unknown');
  assert.equal(partial.items.find(row => row.name === 'example-native').state, 'active');
});

test('removal protects the shared adapter and direct reverse dependencies', async () => {
  const f = fixture();
  f.options.packages.read = async () => [candidate(), { ...candidate(), name: 'consumer', packageManifest: { dependencies: { 'example-native': '1.0.0' } } }];
  const manager = new ExtensionManager(f.options);
  await assert.rejects(manager.prepare({ action: 'prepare-remove', name: '@dsh-std/adapter-dsh' }), /共享/);
  await assert.rejects(manager.prepare({ action: 'prepare-remove', name: 'example-native' }), /依赖/);
  await assert.rejects(manager.prepare({ action: 'prepare-remove', name: 'not-installed' }), /安装/);
});

test('native enable/disable plans preserve preview boundaries and dependency protection', async () => {
  const f = fixture(); f.options.packages.read = async () => [candidate()];
  const calls = [];
  f.options.native.prepareToggle = async (name, enabled) => ({ name, enabled, private: 'not-public' });
  f.options.native.toggle = async (plan, fingerprint) => { calls.push({ plan, fingerprint }); return { status: 'restart-required', action: plan.enabled ? 'enable' : 'disable', name: plan.name }; };
  const manager = new ExtensionManager(f.options);
  const plan = await manager.prepare({ action: 'prepare-disable', name: 'example-native' });
  assert.equal(plan.action, 'disable'); assert.equal(calls.length, 0);
  assert.doesNotMatch(JSON.stringify(plan), /not-public/);
  await manager.execute({ planId: plan.id, requestId: '42345678-1234-1234-1234-123456789012' });
  assert.deepEqual(calls[0], { plan: { name: 'example-native', enabled: false, private: 'not-public' }, fingerprint: 'original' });
  f.options.packages.read = async () => [candidate(), { ...candidate(), name: 'consumer', packageManifest: { dependencies: { 'example-native': '1.0.0' } } }];
  await assert.rejects(manager.prepare({ action: 'prepare-disable', name: 'example-native' }), /依赖/);
});
