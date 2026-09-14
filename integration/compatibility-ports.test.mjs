import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { profilePackages, nativeRuntimePort, standardRuntimePort } from './plugin/compatibility/ports.mjs';

test('profile inventory resolves only direct local manifests and never executes entry code', async () => {
  const root = path.resolve('artifacts/r35-build/ports'); await mkdir(root, { recursive: true });
  const home = await mkdtemp(path.join(root, 'home-'));
  const folder = path.join(home, 'profiles/web');
  await mkdir(path.join(folder, 'node_modules/native-fixture'), { recursive: true });
  await writeFile(path.join(folder, 'package.json'), JSON.stringify({ dependencies: { 'native-fixture': '1.0.0' } }));
  const manifest = { name: 'native-fixture', version: '1.0.0', dsh: { bundle: { patch: './cordis.patch.yml' } }, main: 'index.mjs' };
  await writeFile(path.join(folder, 'node_modules/native-fixture/package.json'), JSON.stringify(manifest));
  await writeFile(path.join(folder, 'node_modules/native-fixture/index.mjs'), 'throw Error("must not execute");\n');
  const rows = await profilePackages(home, 'web').read();
  assert.equal(rows.length, 1); assert.equal(rows[0].name, 'native-fixture'); assert.deepEqual(rows[0].routes, ['native']);
  await writeFile(path.join(folder, 'package.json'), JSON.stringify({ dependencies: { '@dsh-std/core': '0.1.1-rc.2' } }));
  await assert.rejects(profilePackages(home, 'web').read(), /ENOENT/, 'Do not resolve through ancestor integration/node_modules');
});

test('runtime ports project separate public lifecycles without exposing configuration or private adapter state', async () => {
  const ctx = { loader: { entries: () => [
    { options: { name: 'native-test', config: { secret: true } }, fiber: { state: 2 } },
    { options: { name: 'disabled-test' }, disabled: true, fiber: { state: 2 } },
    { options: { name: 'C:/private/plugin.mjs' }, fiber: { state: 2 } },
  ] }, get: () => ({ snapshot: async () => ({ facets: [{ identity: { component: 'market.standard', version: '1.0.0', facet: 'host' }, state: 'degraded', message: 'private config' }] }) }) };
  assert.deepEqual(await nativeRuntimePort(ctx).read(), [{ name: 'native-test', entries: 1, state: 'active' }, { name: 'disabled-test', entries: 1, state: 'disabled' }]);
  const standard = await standardRuntimePort(ctx).read();
  assert.deepEqual(standard, [{ id: 'market.standard', version: '1.0.0', facets: [{ name: 'host', state: 'degraded' }] }]);
  assert.doesNotMatch(JSON.stringify(standard), /private|config/);
  ctx.get = () => undefined;
  assert.deepEqual(await standardRuntimePort(ctx).read(), []);
});

test('management imports keep UI, package inspection, state projection and process execution separate', async () => {
  const read = file => readFile(path.resolve('integration/plugin', file), 'utf8');
  const ui = await read('market/extensions.tsx');
  assert.doesNotMatch(ui, /node:|compatibility\/|ctx\.|dshStd\.|spawn\(/);
  const manager = await read('compatibility/manager.mjs');
  assert.doesNotMatch(manager, /node:(?:fs|child_process)|ctx\.|\.loader\.|\.publications\.|shared_data/);
  assert.doesNotMatch(await read('compatibility/packages.mjs'), /import\(.*entry|child_process/);
  assert.doesNotMatch(await read('compatibility/ports.mjs'), /\.manifests|\.pending|\.selfCtx|child_process/);
});
