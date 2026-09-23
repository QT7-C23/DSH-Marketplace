import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rename, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { standardFixture } from '../helpers/standard-test-fixture.mjs';
import { inspectStandardProfile, createStandardView, verifyStandardView } from '../../src/plugin/compatibility/standard-view.mjs';

test('one immutable view preserves outside-market packages, includes new installs, and retains disabled names over updates', async () => {
  const f = await standardFixture();
  await f.add('alpha'); await f.add('outside-market'); await f.add('ordinary', { standard: false });
  const first = await createStandardView(f.profileDir, ['alpha']);
  assert.deepEqual((await f.json(path.join(first.directory, 'package.json'))).dependencies, { 'outside-market': '1.0.0' });
  assert.equal(path.dirname(first.directory), path.join(f.profileDir, '.dsh-market/std'));
  assert.match(path.basename(first.directory), /^[a-f0-9-]{36}$/);
  await f.add('alpha', { version: '2.0.0' }); await f.add('new-install');
  const second = await createStandardView(f.profileDir, ['alpha']);
  assert.deepEqual(second.packages.map(row => row.name), ['new-install', 'outside-market']);
  assert.notEqual(first.directory, second.directory);
  assert.deepEqual((await f.json(path.join(first.directory, 'package.json'))).dependencies, { 'outside-market': '1.0.0' });
});

test('profile binding required; ancestor fallback and shadow resolutions are refused while pnpm junctions work', async () => {
  const f = await standardFixture(); const binding = await f.add('alpha');
  const store = path.join(f.home, 'store/alpha'); await mkdir(path.dirname(store), { recursive: true });
  await rename(binding, store); await symlink(store, binding, 'junction');
  const view = await createStandardView(f.profileDir, []);
  assert.equal(view.packages[0].name, 'alpha');
  const shadow = path.join(f.profileDir, '.dsh-market/node_modules/alpha');
  await mkdir(shadow, { recursive: true }); await writeFile(path.join(shadow, 'package.json'), JSON.stringify({ name: 'alpha', version: '9.0.0' }));
  await assert.rejects(verifyStandardView(f.profileDir, view));
  await assert.rejects(createStandardView(f.profileDir, []));
  const g = await standardFixture(); await g.add('ancestor');
  await mkdir(path.join(g.home, 'node_modules'), { recursive: true });
  await rename(path.join(g.profileDir, 'node_modules/ancestor'), path.join(g.home, 'node_modules/ancestor'));
  await assert.rejects(inspectStandardProfile(g.profileDir));
});

test('manifest version, duplicate component IDs, dual native entries, traversal and linked managed paths fail closed', async () => {
  for (const kind of ['version', 'duplicate', 'dual', 'path', 'native-entry', 'link']) {
    const f = await standardFixture(); const dir = await f.add('alpha');
    if (kind === 'version') { const value = await f.json(path.join(dir, 'dsh-plugin.json')); value.version = '2.0.0'; await writeFile(path.join(dir, 'dsh-plugin.json'), JSON.stringify(value)); }
    if (kind === 'duplicate') await f.add('beta', { id: 'test.alpha' });
    if (kind === 'dual') await f.add('alpha', { extra: { dsh: { bundle: { patch: './patch.yml' } } } });
    if (kind === 'path') { f.profile.dependencies['../escape'] = '1.0.0'; await f.save(); }
    if (kind === 'link') { await mkdir(path.join(f.home, 'elsewhere')); await symlink(path.join(f.home, 'elsewhere'), path.join(f.profileDir, '.dsh-market'), 'junction'); }
    await assert.rejects(createStandardView(f.profileDir, [], kind === 'native-entry' ? [{ options: { name: 'alpha/host' } }] : []), kind);
  }
});

test('view generation rejects tampered projection and changed installed manifests before SDK import', async () => {
  const f = await standardFixture(); const dir = await f.add('alpha');
  const view = await createStandardView(f.profileDir, []);
  await writeFile(path.join(view.directory, 'package.json'), JSON.stringify({ dependencies: { intruder: '1.0.0' } }));
  await assert.rejects(verifyStandardView(f.profileDir, view));
  const next = await createStandardView(f.profileDir, []);
  const manifest = await f.json(path.join(dir, 'dsh-plugin.json')); manifest.id = 'changed';
  await writeFile(path.join(dir, 'dsh-plugin.json'), JSON.stringify(manifest));
  await assert.rejects(verifyStandardView(f.profileDir, next));
});

test('empty resolution shadows and redirected profile manifests are refused before adoption', async () => {
  const f = await standardFixture(); await f.add('alpha');
  await mkdir(path.join(f.profileDir, '.dsh-market/std/node_modules'), { recursive: true });
  await assert.rejects(inspectStandardProfile(f.profileDir));
  const g = await standardFixture(); await g.add('alpha');
  const external = path.join(g.home, 'external.json');
  await rename(path.join(g.profileDir, 'package.json'), external);
  await symlink(external, path.join(g.profileDir, 'package.json'), 'file');
  await assert.rejects(inspectStandardProfile(g.profileDir));
});

test('official file installs remain eligible and view versions come from verified installed manifests, never the reference text', async () => {
  const f = await standardFixture(); await f.add('outside');
  f.profile.dependencies.outside = 'file:../existing-package'; await f.save();
  const view = await createStandardView(f.profileDir, []);
  assert.deepEqual(view.manifest.dependencies, { outside: '1.0.0' });
  f.profile.dependencies.outside = '^2.0.0'; await f.save();
  await assert.rejects(createStandardView(f.profileDir, []));
});

test('a redirected node_modules root is not a selected profile installation', async () => {
  const f = await standardFixture(); await f.add('alpha');
  const elsewhere = path.join(f.home, 'other-node-modules');
  await rename(path.join(f.profileDir, 'node_modules'), elsewhere);
  await symlink(elsewhere, path.join(f.profileDir, 'node_modules'), 'junction');
  await assert.rejects(inspectStandardProfile(f.profileDir));
});
