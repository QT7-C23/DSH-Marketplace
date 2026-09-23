import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { standardFixture } from '../helpers/standard-test-fixture.mjs';
import { standardControl } from '../../src/plugin/compatibility/standard-control.mjs';
import { STANDARD_LOADER_URL, STANDARD_PATCH_KEY, standardLoaderConfig } from '../../src/plugin/compatibility/standard-loader.mjs';

async function setup() {
  const f = await standardFixture(); await f.add('alpha'); await f.add('outside');
  const tree = {}, parent = { tree, ctx: { fiber: {} } };
  let rows = [], runtime;
  const adapter = { describe: () => ({ runtime: { instanceId: 'runtime-1' } }), publications: { list: () => [] }, protocols: { negotiate: () => ({ compatible: true, issues: [] }) },
    snapshot: async () => ({ facets: (runtime?.packages.map(row => row.id) || ['test.alpha', 'test.outside']).map(component => ({ identity: { component, version: '1.0.0', facet: 'host' }, state: 'active' })) }) };
  const refresh = () => { rows = f.compose().map(options => ({ options, id: 'profile:' + options.id, parent, disabled: false,
    fiber: { state: 2, uid: 123, config: options.name === '@dsh-std/adapter-dsh' ? { ...structuredClone(options.config), profileBaseUrl: f.baseUrl } : structuredClone(options.config) } })); };
  refresh();
  const control = standardControl({ profileDir: f.profileDir, inventory: () => rows, profileTree: () => tree, installer: f.installer,
    adapter: () => adapter, runtime: () => runtime, loaderName: STANDARD_LOADER_URL });
  return { ...f, tree, control, adapter, refresh, rows: () => rows, runtime: value => { runtime = value; } };
}

async function priorBootPolicy(f) {
  const core = f.rows()[0].options;
  await f.installer.configure(STANDARD_PATCH_KEY, [
    { id: core.id, name: core.name, config: { ...core.config, discover: false } },
    { insert: [{ id: 'market-std-' + randomUUID(), name: STANDARD_LOADER_URL,
      config: standardLoaderConfig(f.profileDir, core.id, ['alpha']) }] },
  ], await f.installer.fingerprint());
  f.refresh();
}

test('first adoption uses one shared patch, preserves raw __jsExpr and every core field through real public composition', async () => {
  const f = await setup();
  const original = await readFile(f.patch, 'utf8');
  const plan = await f.control.prepareToggle('alpha', false);
  assert.equal(plan.firstAdoption, true); assert.equal(plan.version, '1.0.0');
  assert.equal(await readFile(f.patch, 'utf8'), original, 'preview is read-only');
  const result = await f.control.toggle(plan, plan.fingerprint);
  assert.equal(result.status, 'restart-required'); assert.equal(result.firstAdoption, true);
  assert.equal(result.notice, 'standard-adoption-reloads-all');
  const composed = f.compose(), core = composed.find(row => row.id === 'core');
  assert.deepEqual(core.config, { profileBaseUrl: { __jsExpr: 'ctx.baseUrl' }, runtimeId: 'retained', profile: 'web', discover: false });
  const loader = composed.find(row => row.name === STANDARD_LOADER_URL);
  assert.deepEqual(loader.config.disabledPackages, ['alpha']);
  assert.equal(loader.config.profileDir, f.profileDir);
  assert.equal(composed.length, 3);
  assert.match(await readFile(f.patch, 'utf8'), /# keep user text/);
  assert.deepEqual(await readFile(path.join(f.home, 'operations', result.operationId, 'backup/cordis.patch.yml'), 'utf8'), original);
});

test('subsequent plans require stable active ownership and retain disabled identities; desired state survives a new control', async () => {
  const f = await setup(); await priorBootPolicy(f);
  await assert.rejects(f.control.prepareToggle('alpha', true));
  const loader = f.rows().find(row => row.options.name === STANDARD_LOADER_URL);
  f.runtime({ state: 'active', profileDir: f.profileDir, entryId: loader.id, coreId: 'core', runtimeId: 'runtime-1', generation: 'boot-1', disabledPackages: ['alpha'], packages: [{ name: 'outside', version: '1.0.0', id: 'test.outside' }] });
  const enabled = await f.control.prepareToggle('alpha', true);
  const result = await f.control.toggle(enabled, enabled.fingerprint);
  assert.equal(result.status, 'restart-required'); assert.equal(result.firstAdoption, false);
  const state = await f.control.management();
  assert.equal(state.packages.find(row => row.name === 'alpha').desired, 'enabled');
  assert.equal(state.packages.find(row => row.name === 'alpha').actual, 'disabled');
  assert.equal(state.packages.find(row => row.name === 'alpha').restartRequired, true);
  const durable = await f.installer.configuration(STANDARD_PATCH_KEY);
  assert.deepEqual(durable.records[1].insert[0].config.disabledPackages, []);
});

test('target version, profile fingerprint, active generation and loader identity are stale-checked before mutation', async () => {
  for (const kind of ['version', 'profile', 'core', 'disabled-core']) {
    const f = await setup(); const plan = await f.control.prepareToggle('alpha', false);
    if (kind === 'version') await f.add('alpha', { version: '2.0.0' });
    if (kind === 'profile') await writeFile(f.patch, '# changed\n[]\n');
    if (kind === 'core') f.rows()[0].options.config.runtimeId = 'changed';
    if (kind === 'disabled-core') f.rows()[0].disabled = true;
    await assert.rejects(f.control.toggle(plan, plan.fingerprint), kind);
  }
});

test('ambiguous cores, nested/foreign loaders, dual native entries and foreign managed blocks are refused', async () => {
  for (const kind of ['duplicate', 'nested', 'foreign-loader', 'dual', 'foreign-block', 'unmanaged-discover-false']) {
    const f = await setup();
    if (kind === 'duplicate') f.rows().push({ ...f.rows()[0], id: 'other' });
    if (kind === 'nested') f.rows()[0].parent = { tree: {}, ctx: { fiber: {} } };
    if (kind === 'foreign-loader') f.rows().push({ options: { id: 'foreign', name: '@dsh-std/adapter-dsh/profile-loader' } });
    if (kind === 'dual') f.rows().push({ options: { id: 'foreign', name: 'alpha/host' } });
    if (kind === 'foreign-block') await f.installer.configure(STANDARD_PATCH_KEY, [{ id: 'foreign', disabled: true }], await f.installer.fingerprint());
    if (kind === 'unmanaged-discover-false') f.rows()[0].options.config.discover = false;
    await assert.rejects(f.control.prepareToggle('alpha', false), kind);
  }
});

test('disable checks installed reverse dependencies and negotiates remaining public declarations without target publications', async () => {
  const f = await setup();
  await f.add('consumer', { standard: false, extra: { optionalDependencies: { alpha: '*' } } });
  await assert.rejects(f.control.prepareToggle('alpha', false), /依赖/);
  delete f.profile.dependencies.consumer; await f.save();
  f.adapter.publications.list = () => [
    { identity: { component: 'test.alpha' }, declaration: { participant: { id: 'provider' }, supports: [] } },
    { identity: { component: 'test.outside' }, declaration: { participant: { id: 'consumer' }, requires: [] } },
  ];
  f.adapter.protocols.negotiate = declarations => { assert.deepEqual(declarations.map(row => row.participant.id), ['consumer']); return { compatible: false, issues: [] }; };
  await assert.rejects(f.control.prepareToggle('alpha', false), /契约/);
});

test('foreign live policy cannot pass as owned and active generation changes invalidate a reviewed plan', async () => {
  const f = await setup(); await priorBootPolicy(f);
  const loader = f.rows().find(row => row.options.name === STANDARD_LOADER_URL);
  const active = { state: 'active', profileDir: f.profileDir, entryId: loader.id, coreId: 'core', runtimeId: 'runtime-1', generation: 'boot-1', disabledPackages: ['alpha'], packages: [{ name: 'outside', version: '1.0.0', id: 'test.outside' }] };
  f.runtime(active);
  const plan = await f.control.prepareToggle('alpha', true);
  f.runtime({ ...active, generation: 'boot-2' });
  await assert.rejects(f.control.toggle(plan, plan.fingerprint));
  loader.options.config.disabledPackages = ['outside'];
  await assert.rejects(f.control.prepareToggle('alpha', true));
});

test('runtime projection reports missing/degraded facets honestly and enable negotiates target required contracts', async () => {
  const f = await setup(); await priorBootPolicy(f);
  const loader = f.rows().find(row => row.options.name === STANDARD_LOADER_URL);
  f.runtime({ state: 'active', profileDir: f.profileDir, entryId: loader.id, coreId: 'core', runtimeId: 'runtime-1', generation: 'boot-1', disabledPackages: ['alpha'], packages: [{ name: 'outside', version: '1.0.0', id: 'test.outside' }] });
  f.adapter.snapshot = async () => ({ facets: [] });
  assert.equal((await f.control.management()).packages.find(row => row.name === 'outside').actual, 'unknown');
  const dir = path.join(f.profileDir, 'node_modules/alpha');
  const manifest = await f.json(path.join(dir, 'dsh-plugin.json'));
  manifest.requires.contracts = [{ apiVersion: 'commands.dsh/v1alpha1', kind: 'CommandRuntime' }];
  await writeFile(path.join(dir, 'dsh-plugin.json'), JSON.stringify(manifest));
  f.adapter.protocols.negotiate = declarations => {
    assert.deepEqual(declarations.at(-1).requires, manifest.requires.contracts);
    return { compatible: false };
  };
  await assert.rejects(f.control.prepareToggle('alpha', true), /契约/);
});

test('adoption refuses stale or unknown live components whose old handles cannot be attributed to the selected installed set', async () => {
  const f = await setup();
  f.adapter.snapshot = async () => ({ facets: [{ identity: { component: 'test.unknown', version: '0.9.0', facet: 'host' } }] });
  await assert.rejects(f.control.prepareToggle('alpha', false));
});

test('a core scanning another profile is not silently repurposed even when its package identities match', async () => {
  const f = await setup(); const other = await standardFixture();
  f.rows()[0].fiber.config.profileBaseUrl = other.baseUrl;
  await assert.rejects(f.control.prepareToggle('alpha', false));
});
