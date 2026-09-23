import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot';
import { ProfileInstaller } from '../../src/plugin/compatibility/installer.mjs';

export async function standardFixture() {
  const root = fileURLToPath(new URL('../../artifacts/discovery/std-tests', import.meta.url));
  await mkdir(root, { recursive: true });
  const home = await mkdtemp(path.join(root, 'home-'));
  const profileDir = path.join(home, 'profiles/web');
  await mkdir(path.join(profileDir, 'node_modules'), { recursive: true });
  const profile = { dependencies: {} };
  const save = () => writeFile(path.join(profileDir, 'package.json'), JSON.stringify(profile));
  await save();
  const patch = path.join(profileDir, 'cordis.patch.yml');
  await writeFile(patch, '# keep user text\n[]\n');
  const installer = new ProfileInstaller({ home, profile: 'web', cli: path.join(home, 'unused.mjs'), folder: path.join(home, 'operations') });
  const baseFile = path.join(home, 'base.yml');
  await writeFile(baseFile, '- insert:\n  - id: core\n    name: "@dsh-std/adapter-dsh"\n    config:\n      profileBaseUrl: !!js ctx.baseUrl\n      runtimeId: retained\n      profile: web\n  - id: community-market\n    name: marketplace-test\n');
  const compose = () => composeEntries([loadOverlayPatches('test', baseFile), loadOverlayPatches('test', patch)]);
  async function add(name, { version = '1.0.0', id = 'test.' + name.replace(/[^a-z0-9-]/g, '-'), code = 'export default { activate() {} };', extra = {}, standard = true } = {}) {
    profile.dependencies[name] = version;
    await save();
    const dir = path.join(profileDir, 'node_modules', name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version, type: 'module', ...extra }));
    if (standard) await writeFile(path.join(dir, 'dsh-plugin.json'), JSON.stringify({ $schema: 'https://dsh-std.dev/schema/dsh-plugin.json', manifestVersion: '0.15', id, name, version,
      facets: { host: { entry: './index.mjs', apiVersion: 'v1alpha1' } }, requires: { contracts: [] }, permissions: [], contributes: {}, subscriptions: [] }));
    await writeFile(path.join(dir, 'index.mjs'), code);
    return dir;
  }
  return { home, profileDir, profile, save, patch, installer, compose, add, baseUrl: pathToFileURL(profileDir + path.sep).href,
    json: async file => JSON.parse(await readFile(file, 'utf8')) };
}
