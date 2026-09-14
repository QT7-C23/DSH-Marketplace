import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildClient } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const invoke = promisify(execFile);
const publicFiles = ['LICENSE', 'DISCLAIMER.md', 'THIRD_PARTY_NOTICES.md', 'scripts/github-secret.ps1', 'sources/licenses/anthropic-apache-2.0.txt', 'catalog/LICENSE-CC0.txt', 'docs/images/marketplace.png'];

async function bundledLicenses(inputs, stage) {
  const packages = new Map();
  for (const input of inputs) {
    if (!input.replaceAll('\\', '/').includes('node_modules/')) continue;
    let folder = path.dirname(path.resolve(root, input));
    while (folder !== path.dirname(folder)) {
      try {
        const manifest = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
        if (manifest.name && manifest.version) { packages.set(folder, manifest); break; }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      folder = path.dirname(folder);
    }
  }
  const records = [];
  for (const [folder, manifest] of packages) {
    const names = (await readdir(folder, { withFileTypes: true })).filter(entry => entry.isFile() && /^(?:licen[sc]e|notice|copying)(?:[.-]|$)/i.test(entry.name)).map(entry => entry.name);
    assert(names.length, `Missing bundled license: ${manifest.name}@${manifest.version}`);
    const directory = `licenses/bundled/${manifest.name.replaceAll('/', '__')}@${manifest.version}`;
    await mkdir(path.join(stage, directory), { recursive: true });
    for (const name of names) await copyFile(path.join(folder, name), path.join(stage, directory, name));
    records.push({ name: manifest.name, version: manifest.version, license: manifest.license || 'See included files', files: names.map(name => `${directory}/${name}`) });
  }
  return records.sort((a, b) => a.name.localeCompare(b.name));
}

/** Copy only runtime imports and explicit public assets into a fresh staging directory. */
export async function buildPackage() {
  const destination = path.join(root, 'artifacts/releases');
  await mkdir(destination, { recursive: true });
  const stage = await mkdtemp(path.join(destination, 'build-'));
  const graph = await build({ entryPoints: [path.join(root, 'integration/plugin/index.mjs')], absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false, metafile: true, logLevel: 'silent' });
  const client = await buildClient();
  const files = new Set([...Object.keys(graph.metafile.inputs), ...publicFiles]);
  for (const name of await readdir(path.join(root, 'licenses'))) files.add(`licenses/${name}`);
  for (const name of await readdir(path.join(root, 'catalog/prompts'))) if (name.endsWith('.json')) files.add(`catalog/prompts/${name}`);
  for (const relative of files) {
    const file = path.resolve(root, relative);
    const inside = path.relative(root, file);
    assert(!inside.startsWith('..') && !path.isAbsolute(inside) && !/(?:^|[\\/])(?:artifacts|node_modules|fixtures|tests)(?:[\\/])|\.test\./.test(inside), 'Unexpected package input: ' + relative);
    await mkdir(path.dirname(path.join(stage, relative)), { recursive: true });
    await copyFile(file, path.join(stage, relative));
  }
  await writeFile(path.join(stage, 'integration/plugin/client.js'), client.code);
  await mkdir(path.join(stage, 'licenses/build-inputs'), { recursive: true });
  await copyFile(path.join(root, 'package-lock.json'), path.join(stage, 'licenses/build-inputs/root-package-lock.json'));
  await copyFile(path.join(root, 'integration/package-lock.json'), path.join(stage, 'licenses/build-inputs/integration-package-lock.json'));
  const notice = (await readFile(path.join(stage, 'THIRD_PARTY_NOTICES.md'), 'utf8')).replace('(package-lock.json)', '(licenses/build-inputs/root-package-lock.json)').replace('(integration/package-lock.json)', '(licenses/build-inputs/integration-package-lock.json)');
  await writeFile(path.join(stage, 'THIRD_PARTY_NOTICES.md'), notice);
  for (const name of ['README.md', 'README.zh-CN.md', 'README.ja-JP.md']) await copyFile(path.join(root, 'integration/release', name), path.join(stage, name));
  const plugin = JSON.parse(await readFile(path.join(root, 'integration/plugin/package.json'), 'utf8'));
  const manifest = {
    ...plugin, description: 'Community resource marketplace for DeepSeek Harness',
    repository: { type: 'git', url: 'https://github.com/QT7-C23/DSH-Marketplace.git' },
    engines: { node: '>=24', dsh: '0.1.5-rc.2' },
    exports: { '.': './integration/plugin/index.mjs', './client': './integration/plugin/client.js', './package.json': './package.json' },
    dsh: { ...plugin.dsh, bundle: { patch: './cordis.patch.yml' } },
    peerDependencies: { '@deepseek-ai/dsh-llm': '0.1.5-rc.2' },
    dependencies: { '@dsh-std/core': '0.1.1-rc.2', '@dsh-std/manifest': '0.1.1-rc.3', fflate: '0.8.3', semver: '7.7.2', yaml: '2.9.1' },
  };
  for (const dependency of Object.values(graph.metafile.outputs).flatMap(output => output.imports)) {
    if (!dependency.external || dependency.path.startsWith('node:')) continue;
    const name = dependency.path.split('/').slice(0, dependency.path.startsWith('@') ? 2 : 1).join('/');
    assert(Object.hasOwn(manifest.dependencies, name) || Object.hasOwn(manifest.peerDependencies, name), 'Undeclared runtime dependency: ' + name);
  }
  assert(!files.has('integration/plugin/package.json'), 'A package must not contain a second frontend identity');
  await writeFile(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(stage, 'cordis.patch.yml'), '- insert:\n    - id: community-market\n      name: dsh-market-integration\n      config:\n        profile: web\n');
  await writeFile(path.join(stage, 'BUNDLED_DEPENDENCIES.json'), JSON.stringify(await bundledLicenses(client.inputs, stage), null, 2) + '\n');
  const npm = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const { stdout } = await invoke(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', destination], { cwd: stage, windowsHide: true, timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
  const [packed] = JSON.parse(stdout);
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.filename, `${manifest.name}-${manifest.version}.tgz`);
  const archive = path.join(destination, packed.filename);
  const bytes = await readFile(archive);
  const result = { archive, filename: packed.filename, name: manifest.name, version: manifest.version, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), files: packed.files.map(file => file.path) };
  await writeFile(path.join(destination, 'package-result.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildPackage();
  console.log(`Built ${path.relative(root, result.archive)} (${result.bytes} bytes). SHA-256: ${result.sha256}`);
}
