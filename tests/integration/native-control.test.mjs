import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeControl } from '../../src/plugin/compatibility/native-control.mjs';

function fixture() {
  const tree = {}, parent = { tree, ctx: { fiber: {} } };
  const rows = [{ id: 'include:example', parent, options: { id: 'example', name: 'example-plugin', config: { token: 'private' } }, disabled: false }];
  let records = [], writes = 0;
  const installer = { configuration: async () => ({ records, fingerprint: 'profile' }), configure: async (key, next, fingerprint) => {
    assert.equal(fingerprint, 'profile'); assert.match(key, /^extension-[a-f0-9]{32}$/); records = next; writes++;
    return { status: 'restart-required', operationId: 'operation', action: 'configure', name: key, backupCreated: true };
  } };
  return { rows, tree, control: nativeControl({ inventory: () => rows, installer, profileTree: () => tree }), records: () => records, writes: () => writes };
}

test('native controls pin all exact entries and persist guarded profile intent without runtime-only writes', async () => {
  const f = fixture();
  const plan = await f.control.prepareToggle('example-plugin', false);
  assert.equal(f.writes(), 0);
  const result = await f.control.toggle(plan, 'profile');
  assert.equal(result.action, 'disable'); assert.equal(result.name, 'example-plugin');
  assert.deepEqual(f.records(), [{ id: 'example', name: 'example-plugin', disabled: true }]);
  assert.equal(f.rows[0].disabled, false, 'runtime convergence requires the host watcher/restart');
  assert.doesNotMatch(JSON.stringify(result), /private|config/);
});

test('nested include entries and disabled ancestors cannot evade full profile coverage', async () => {
  for (const onlyNested of [false, true]) {
    const f = fixture();
    const nested = { ...f.rows[0], id: 'include:child:nested', parent: { tree: {}, ctx: { fiber: {} } }, options: { id: 'nested', name: 'example-plugin' } };
    if (onlyNested) f.rows.length = 0;
    f.rows.push(nested);
    await assert.rejects(f.control.prepareToggle('example-plugin', false));
    assert.equal(f.writes(), 0);
  }
  const f = fixture(); f.rows[0].options.disabled = true; f.rows[0].disabled = true;
  const ancestor = { options: { disabled: false }, parent: { ctx: { fiber: {} } } };
  f.rows[0].parent.ctx.fiber.entry = ancestor;
  const plan = await f.control.prepareToggle('example-plugin', true);
  ancestor.options.disabled = true;
  await assert.rejects(f.control.prepareToggle('example-plugin', true));
  await assert.rejects(f.control.toggle(plan, 'profile'));
  assert.equal(f.writes(), 0);
});

test('native controls refuse missing, ambiguous, group, inherited, and changed identities', async () => {
  for (const mutate of [rows => { rows.length = 0; }, rows => rows.push({ ...rows[0], id: 'other:example' }),
    rows => { rows[0].options.group = true; }, rows => { rows[0].disabled = true; },
    rows => rows.push({ id: 'include:other', options: { id: 'other', name: 'example-plugin/client' }, disabled: false })]) {
    const f = fixture(); mutate(f.rows);
    await assert.rejects(f.control.prepareToggle('example-plugin', true));
    assert.equal(f.writes(), 0);
  }
  const f = fixture(); const plan = await f.control.prepareToggle('example-plugin', false);
  f.rows[0].options.config.token = 'externally-changed';
  await assert.rejects(f.control.toggle(plan, 'profile'));
  assert.equal(f.writes(), 0);
});

test('foreign modifications inside the owned disable block are never overwritten', async () => {
  const f = fixture(); const plan = await f.control.prepareToggle('example-plugin', false);
  await f.control.toggle(plan, 'profile');
  f.records()[0].config = { foreign: true };
  await assert.rejects(f.control.prepareToggle('example-plugin', true));
  assert.equal(f.writes(), 1);
});
