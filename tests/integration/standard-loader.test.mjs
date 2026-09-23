import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import { DshStandardAdapter, apply as adapterApply } from '@dsh-std/adapter-dsh';
import { standardFixture } from '../helpers/standard-test-fixture.mjs';
import apply, { standardRuntimeState, STANDARD_LOADER_URL, standardLoaderConfig } from '../../src/plugin/compatibility/standard-loader.mjs';
import { standardControl } from '../../src/plugin/compatibility/standard-control.mjs';

test('selective discovery and update-veto behavior are pinned to the reviewed installed public SDK', async () => {
  for (const [name, version] of Object.entries({ '@deepseek-ai/dsh': '0.1.5-rc.2', '@deepseek-ai/cordis': '4.0.2',
    '@deepseek-ai/cordis-plugin-loader': '1.0.3', '@dsh-std/adapter-dsh': '0.1.1-rc.3', '@dsh-std/manifest': '0.1.1-rc.3',
    '@dsh-std/core': '0.1.1-rc.2', '@dsh-std/lifecycle': '0.1.1-rc.3' })) {
    const manifest = JSON.parse(await readFile(new URL('../../node_modules/' + name + '/package.json', import.meta.url), 'utf8'));
    assert.equal(manifest.version, version, name);
  }
});

async function host(f, { batch, cleanupFails = false } = {}) {
  const ctx = new Context(); const loader = new Loader(ctx, { baseUrl: f.baseUrl });
  await loader.await();
  const calls = [], active = new Set(); let count = 0;
  async function core(ctx, config) {
    const runtimeId = 'adapter-' + randomUUID() + '-' + (++count);
    const adapter = { describe: () => ({ runtime: { instanceId: runtimeId } }),
      async mountProfileComponents(view) {
        calls.push(['batch', view]);
        if (batch) return batch(view);
        return DshStandardAdapter.prototype.mountProfileComponents.call(this, view);
      },
      async mount(publication) {
        const id = publication.manifest.metadata.name;
        await publication.activate({}); active.add(id); calls.push(['mount', id]);
        return async () => { active.delete(id); calls.push(['dispose', id]); if (cleanupFails) throw Error('cleanup-' + id); };
      },
      snapshot: async () => ({ facets: [...active].map(component => ({ identity: { component, version: '1.0.0', facet: 'host' }, state: 'active' })) }),
      browserFacets: () => [],
    };
    ctx.provide('dshStd', adapter);
    ctx.effect(() => async () => { calls.push(['core-dispose', runtimeId]); await new Promise(resolve => setTimeout(resolve, 5)); });
    if (config.discover !== false) {
      const disposers = await adapter.mountProfileComponents(f.profileDir);
      ctx.effect(() => async () => { for (const dispose of [...disposers].reverse()) await dispose(); });
    }
  }
  loader.import = async name => name === '@dsh-std/adapter-dsh' ? core : name === STANDARD_LOADER_URL ? apply : () => {};
  const entries = disabled => [{ id: 'core', name: '@dsh-std/adapter-dsh', config: { discover: false } },
    { id: 'market-std-test', name: STANDARD_LOADER_URL, config: standardLoaderConfig(f.profileDir, 'core', disabled) }];
  return { ctx, loader, entries, calls, active, adapter: () => ctx.get('dshStd'), close: () => loader.root.stop() };
}

test('normal injected async apply mounts exactly one complete batch; disabled code is never imported across two cold boots', async () => {
  const f = await standardFixture();
  const sentinel = path.join(f.home, 'must-not-exist');
  await f.add('alpha', { code: `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'imported'); throw Error('disabled imported');` });
  await f.add('outside');
  for (let boot = 0; boot < 2; boot++) {
    if (boot) { await f.add('alpha', { version: '2.0.0', code: 'throw Error("disabled update imported");' }); await f.add('new-install'); }
    const h = await host(f);
    await h.loader.root.update(h.entries(['alpha'])); await h.loader.await();
    const runtime = standardRuntimeState(h.adapter());
    assert.equal(runtime.state, 'active'); assert.equal(h.calls.filter(row => row[0] === 'batch').length, 1);
    assert.deepEqual([...h.active].sort(), boot ? ['test.new-install', 'test.outside'] : ['test.outside']);
    await assert.rejects(readFile(sentinel), { code: 'ENOENT' });
    await h.close(); assert.equal(h.active.size, 0);
  }
});

test('real public entry.update invokes the veto hook without next; active config/batch stay at their cold-boot snapshot', async () => {
  const f = await standardFixture(); await f.add('alpha'); await f.add('outside');
  const h = await host(f); await h.loader.root.update(h.entries([])); await h.loader.await();
  const entry = h.loader.resolve('market-std-test'), fiber = entry.fiber;
  const before = standardRuntimeState(h.adapter());
  await entry.update({ config: standardLoaderConfig(f.profileDir, 'core', ['alpha']) });
  assert.equal(entry.fiber, fiber); assert.equal(fiber.state, 2);
  assert.deepEqual(fiber.config.disabledPackages, []);
  assert.deepEqual(entry.options.config.disabledPackages, ['alpha']);
  assert.deepEqual(standardRuntimeState(h.adapter()), before);
  assert.equal(h.calls.filter(row => row[0] === 'batch').length, 1);
  await h.close();
});

test('first adoption parallel siblings await old-core cleanup and new active adapter before one owned mount', async () => {
  const f = await standardFixture(); await f.add('alpha'); await f.add('outside');
  const h = await host(f);
  await h.loader.root.update([{ id: 'core', name: '@dsh-std/adapter-dsh', config: { discover: true } }]); await h.loader.await();
  const old = h.adapter().describe().runtime.instanceId;
  await h.loader.root.update(h.entries(['alpha'])); await h.loader.await();
  assert.notEqual(h.adapter().describe().runtime.instanceId, old);
  assert.deepEqual([...h.active], ['test.outside']);
  const events = h.calls.map(row => row[0]);
  assert.equal(events.filter(value => value === 'batch').length, 2);
  assert.ok(events.indexOf('core-dispose') < events.lastIndexOf('batch'));
  await h.close();
});

test('owned cleanup drains all disposers in reverse order and retains failure evidence', async () => {
  const f = await standardFixture(); const order = [];
  const h = await host(f, { batch: async () => [1, 2, 3].map(id => async () => { order.push(id); throw Error('failure-' + id); }) });
  await h.loader.root.update(h.entries([])); await h.loader.await(); const adapter = h.adapter();
  await h.close();
  assert.deepEqual(order, [3, 2, 1]);
  assert.equal(standardRuntimeState(adapter).state, 'recovery-required');
  assert.equal(standardRuntimeState(adapter).cleanupErrors, 3);
});

test('failed batch never becomes active and a changed trusted profile cannot be hot-reconfigured', async () => {
  const f = await standardFixture();
  const h = await host(f, { batch: async () => { throw Error('activation failed'); } });
  await assert.rejects(h.loader.root.update(h.entries([])), /activation failed/);
  assert.notEqual(standardRuntimeState(h.adapter())?.state, 'active');
  await h.close();
  const g = await host(f); await g.loader.root.update(g.entries([])); await g.loader.await();
  await assert.rejects(g.loader.resolve('market-std-test').update({ config: standardLoaderConfig(path.dirname(f.profileDir), 'core', []) }));
  await g.close();
});

test('installed public adapter composes, activates and unpublishes real facets through the managed batch', async () => {
  const f = await standardFixture(); await f.add('alpha'); await f.add('outside');
  const ctx = new Context();
  ctx.provide('agents', { get: () => undefined });
  ctx.provide('llm', { listProviders: () => [] });
  ctx.provide('sessionController', {});
  const loader = new Loader(ctx, { baseUrl: f.baseUrl });
  await loader.await();
  loader.import = async name => name === '@dsh-std/adapter-dsh' ? adapterApply : apply;
  await loader.root.update([{ id: 'core', name: '@dsh-std/adapter-dsh', config: { discover: false, profileBaseUrl: { __jsExpr: 'ctx.baseUrl' } } },
    { id: 'managed', name: STANDARD_LOADER_URL, config: standardLoaderConfig(f.profileDir, 'core', ['alpha']) }]);
  await loader.await();
  const adapter = ctx.get('dshStd');
  assert.deepEqual((await adapter.snapshot()).facets.map(row => row.identity.component), ['test.outside']);
  assert.ok(adapter.publications.list().some(row => row.identity.component === 'test.outside'));
  assert.equal(standardRuntimeState(adapter).state, 'active');
  await loader.resolve('managed').update({ disabled: true });
  assert.deepEqual((await adapter.snapshot()).facets, []);
  assert.ok(!adapter.publications.list().some(row => row.identity.component === 'test.outside'));
  await loader.root.stop();
});

test('first adoption cannot certify old cleanup or accept another toggle before a cold process boundary', async () => {
  const f = await standardFixture();
  const leaseKey = 'standard-test-' + randomUUID();
  globalThis[leaseKey] = new Set();
  const dir = await f.add('alpha', { code: `export default { activate() { globalThis[${JSON.stringify(leaseKey)}].add('alpha'); }, deactivate() { throw Error('old cleanup failed'); } };` });
  await f.add('outside');
  const manifest = await f.json(path.join(dir, 'dsh-plugin.json'));
  manifest.requires.contracts = [{ apiVersion: 'review.optional/v1', kind: 'Missing', optional: true, fallback: 'use local behavior' }];
  await writeFile(path.join(dir, 'dsh-plugin.json'), JSON.stringify(manifest));
  const ctx = new Context();
  ctx.provide('agents', { get: () => undefined }); ctx.provide('llm', { listProviders: () => [] }); ctx.provide('sessionController', {});
  const loader = new Loader(ctx, { baseUrl: f.baseUrl }); await loader.await();
  loader.import = async name => name === '@dsh-std/adapter-dsh' ? adapterApply : name === STANDARD_LOADER_URL ? apply : () => {};
  const makeControl = () => standardControl({ profileDir: f.profileDir, inventory: () => loader.entries(), profileTree: () => loader,
    installer: f.installer, adapter: () => ctx.get('dshStd') });
  try {
    await loader.root.update(f.compose()); await loader.await();
    const control = makeControl();
    assert.equal((await control.prepareToggle('alpha', true)).enabled, true, 'valid optional fallback follows SDK projection');
    const disable = await control.prepareToggle('alpha', false);
    await control.toggle(disable, disable.fingerprint);
    await loader.root.update(f.compose()); await loader.await();
    assert.equal(globalThis[leaseKey].size, 1, 'old disposer actually failed to release its application lease');
    const replacement = makeControl();
    const state = await replacement.management();
    const alpha = state.packages.find(row => row.name === 'alpha');
    assert.equal(state.state, 'restart-required');
    assert.equal(alpha.actual, 'unknown'); assert.equal(alpha.restartRequired, true); assert.equal(alpha.toggleable, false);
    await assert.rejects(replacement.prepareToggle('alpha', true));
  } finally { await loader.root.stop(); delete globalThis[leaseKey]; }
});

test('an existing managed profile keeps active facets unchanged during live desired-policy updates', async () => {
  const f = await standardFixture(); await f.add('alpha'); await f.add('outside');
  const core = f.compose()[0];
  await f.installer.configure('extension-standard', [
    { id: core.id, name: core.name, config: { ...core.config, discover: false } },
    { insert: [{ id: 'market-std-' + randomUUID(), name: STANDARD_LOADER_URL,
      config: standardLoaderConfig(f.profileDir, core.id, ['alpha']) }] },
  ], await f.installer.fingerprint());
  async function start() {
    const ctx = new Context();
    ctx.provide('agents', { get: () => undefined }); ctx.provide('llm', { listProviders: () => [] }); ctx.provide('sessionController', {});
    const loader = new Loader(ctx, { baseUrl: f.baseUrl }); await loader.await();
    loader.import = async name => name === '@dsh-std/adapter-dsh' ? adapterApply : name === STANDARD_LOADER_URL ? apply : () => {};
    await loader.root.update(f.compose()); await loader.await();
    const control = standardControl({ profileDir: f.profileDir, inventory: () => loader.entries(), profileTree: () => loader,
      installer: f.installer, adapter: () => ctx.get('dshStd') });
    return { loader, control, adapter: () => ctx.get('dshStd') };
  }
  const first = await start();
  assert.deepEqual((await first.adapter().snapshot()).facets.map(row => row.identity.component), ['test.outside']);
  assert.equal(first.loader.resolve('core').fiber.config.profileBaseUrl, f.baseUrl);
  assert.deepEqual(first.loader.resolve('core').options.config.profileBaseUrl, { __jsExpr: 'ctx.baseUrl' });
  const enable = await first.control.prepareToggle('alpha', true);
  const before = standardRuntimeState(first.adapter());
  await first.control.toggle(enable, enable.fingerprint);
  await first.loader.root.update(f.compose()); await first.loader.await();
  assert.deepEqual(standardRuntimeState(first.adapter()), before);
  const status = (await first.control.management()).packages.find(row => row.name === 'alpha');
  assert.equal(status.desired, 'enabled'); assert.equal(status.actual, 'disabled');
  await first.loader.root.stop();
  const second = await start();
  assert.deepEqual((await second.adapter().snapshot()).facets.map(row => row.identity.component), ['test.alpha', 'test.outside']);
  await second.loader.root.stop();
});
