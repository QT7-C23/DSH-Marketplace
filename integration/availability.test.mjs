import test from 'node:test';
import assert from 'node:assert/strict';
import { PluginAvailability } from './plugin/availability.mjs';
import { availabilitySnapshot } from './plugin/market/availability.mjs';
import { createHandler } from '../community/http.mjs';

const plugin = { id: 'plugin', revision: 1, type: '插件', bundle: { kind: 'npm-package', name: '@deepseek-ai/dsh-plan-mode' } };
const slash = { id: 'slash', revision: 2, type: 'Slash', parentId: 'plugin' };
const catalog = () => [plugin, slash, { id: 'prompt', type: 'Prompt' }];
const row = (enabled, fiberState) => ({ entryId: 'plan', moduleName: plugin.bundle.name, enabled, fiberState });

test('plugin availability reports each real scope and never treats configured presets as running', async () => {
  const reader = new PluginAvailability(catalog, { read: async () => ({ host: [row(false, 2)], presets: [
    { id: 'default', isDefault: true, rows: [row(true)] },
    { id: 'working', name: 'Working', rows: [row(true, 2)] },
    { id: 'conditional', rows: [row('conditional')] },
    { id: 'failed', rows: [row(true, 3)] },
    { id: 'transitions', rows: [row(true, 0), row(true, 1), row(true, 4), row(true, 5)] },
  ] }) });
  const snapshot = availabilitySnapshot(await reader.read());
  assert.deepEqual(snapshot.resources.plugin.locations.map(value => value.state), ['disabled', 'configured', 'active', 'conditional', 'failed', 'pending', 'loading', 'configured', 'unloading']);
  assert.equal(snapshot.resources.plugin.locations[1].isDefault, true);
  assert.equal(snapshot.resources.slash.moduleName, plugin.bundle.name);
  assert.equal(snapshot.resources.slash.revision, 2);
  assert.equal(snapshot.resources.prompt, undefined);
  assert.equal(snapshot.resources.plugin.detected, true);
});

test('unknown inventory cannot produce a false not-installed verdict and exposes no paths or config', async () => {
  const reader = new PluginAvailability(catalog, { read: async () => ({ host: [], presets: [{ id: 'broken', broken: 'C:/private/path secret', rows: [] }] }) });
  const snapshot = await reader.read();
  assert.equal(snapshot.complete, false);
  assert.equal(snapshot.resources.plugin.detected, false);
  assert.doesNotMatch(JSON.stringify(snapshot), /private|secret|broken/);
  const failure = new PluginAvailability(catalog, { read: async () => { throw Error('secret'); } });
  await assert.rejects(failure.read(), { status: 503, message: '暂时无法读取宿主插件状态' });
});

test('availability response contract refuses forged active states and mismatched shapes', () => {
  assert.throws(() => availabilitySnapshot({ schema: 1, resources: {}, complete: 'true' }));
  assert.throws(() => availabilitySnapshot({ schema: 1, complete: true, resources: { plugin: { revision: 1, detected: true, moduleName: 'x', locations: [{ scope: 'host', state: 'installed' }] } } }));
  assert.throws(() => availabilitySnapshot({ schema: 1, complete: true, resources: { plugin: { revision: 1, detected: true, moduleName: 'x', locations: [] } } }));
});

test('host availability is read only behind the existing HTTP boundary', async () => {
  let calls = 0;
  const handle = createHandler({}, undefined, null, null, null, { read: async () => { calls++; return { schema: 1, complete: true, resources: {} }; } });
  const url = 'http://localhost/api/community/availability';
  assert.equal((await handle(new Request(url))).status, 200);
  assert.equal((await handle(new Request(url, { method: 'POST' }))).status, 405);
  assert.equal(calls, 1);
});
