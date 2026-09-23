import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import semver from 'semver';
import { inspectPackage, packageName } from './packages.mjs';

const fail = () => Error('标准组件的环境路径、安装绑定或声明已变化');
const hash = value => createHash('sha256').update(value).digest('hex');
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const safeName = name => packageName(name) && name.split('/').every(part => !part.endsWith('.')
  && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part.replace(/^@/, '')))
  && !['node_modules', 'favicon.ico'].includes(name.split('/').at(-1));

export function disabledPolicy(value) {
  if (!Array.isArray(value) || value.length > 2048 || value.some(name => !safeName(name)) || new Set(value).size !== value.length) throw fail();
  return Object.freeze([...value].sort());
}

async function directory(folder, create = false) {
  if (create) { try { await mkdir(folder, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
  const stat = await lstat(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail();
}

async function absent(file) {
  try { await lstat(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw fail();
}

async function inspectManagedPaths(profileDir) {
  for (const suffix of ['.dsh-market', '.dsh-market/std']) {
    const folder = path.join(profileDir, suffix);
    try { await directory(folder); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    await absent(path.join(folder, 'node_modules'));
  }
}

/** Writable profile/view paths cannot redirect into another profile or arbitrary storage. */
export async function trustedStandardProfile(profileDir) {
  if (typeof profileDir !== 'string' || !path.isAbsolute(profileDir) || path.resolve(profileDir) !== profileDir || profileDir.includes('\0')) throw fail();
  let folder = path.parse(profileDir).root;
  for (const part of path.relative(folder, profileDir).split(path.sep).filter(Boolean)) {
    folder = path.join(folder, part); await directory(folder);
  }
  return profileDir;
}

async function jsonFile(file) {
  const resolved = await realpath(file);
  const handle = await open(resolved, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024) throw fail();
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== stat.size) throw fail();
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
    if (!record(value)) throw fail();
    return { value, digest: hash(bytes.subarray(0, length)) };
  } finally { await handle.close(); }
}

/** Inert inspection only; the SDK remains the sole importer and lifecycle owner. */
export async function inspectStandardProfile(profileDir, entries = []) {
  await trustedStandardProfile(profileDir);
  const stat = await lstat(path.join(profileDir, 'package.json'));
  if (stat.isSymbolicLink() || stat.nlink !== 1) throw fail();
  await inspectManagedPaths(profileDir);
  const profile = await jsonFile(path.join(profileDir, 'package.json'));
  if (profile.value.dependencies !== undefined && !record(profile.value.dependencies)) throw fail();
  const names = Object.keys(profile.value.dependencies || {}).sort();
  if (names.length > 2048 || names.some(name => !safeName(name))) throw fail();
  if (names.length) await directory(path.join(profileDir, 'node_modules'));
  const installed = [], components = new Set();
  for (const name of names) {
    if (name.startsWith('@')) await directory(path.join(profileDir, 'node_modules', name.split('/')[0]));
    const binding = path.join(profileDir, 'node_modules', ...name.split('/'));
    const target = await realpath(binding); // A selected profile binding is mandatory, including for pnpm links.
    const manifest = await jsonFile(path.join(binding, 'package.json'));
    const reference = profile.value.dependencies[name];
    if (manifest.value.name !== name || !semver.valid(manifest.value.version)
      || typeof reference !== 'string' || !reference.trim() || reference.length > 4096
      || semver.validRange(reference) && !semver.satisfies(manifest.value.version, reference, { includePrerelease: true })) throw fail();
    // file:/git/tag references are inert provenance. The selected binding supplies the exact installed version.
    let standard;
    try { standard = await jsonFile(path.join(binding, 'dsh-plugin.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const candidate = inspectPackage(manifest.value, standard?.value);
    if (standard) {
      if (candidate.routes.length !== 1 || candidate.standardManifest.facets.host.apiVersion !== 'v1alpha1'
        || components.has(candidate.standardManifest.id)
        || entries.some(entry => entry.options.name === name || entry.options.name?.startsWith(name + '/'))) throw fail();
      components.add(candidate.standardManifest.id);
      for (const facet of Object.values(candidate.standardManifest.facets)) {
        if (!facet?.entry) continue;
        const entry = await realpath(path.resolve(binding, facet.entry));
        const relative = path.relative(target, entry);
        if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw fail();
        if (!(await lstat(entry)).isFile()) throw fail();
      }
    }
    installed.push({ ...candidate, binding, target, manifestHash: manifest.digest, standardHash: standard?.digest ?? null });
  }
  return { fingerprint: hash(JSON.stringify([profile.digest, installed])), installed };
}

async function managedRoot(profileDir, create) {
  await trustedStandardProfile(profileDir);
  const market = path.join(profileDir, '.dsh-market'), root = path.join(market, 'std');
  await directory(market, create); await directory(root, create);
  return root;
}

async function verifyBindings(profileDir, directory, packages) {
  await absent(path.join(directory, 'node_modules'));
  const require = createRequire(path.join(directory, 'package.json'));
  for (const row of packages) {
    // This matches the pinned upstream FIRST package.json candidate, not Node's exports resolver.
    const first = (require.resolve.paths(row.name) || []).map(base => path.join(base, row.name))
      .find(candidate => existsSync(path.join(candidate, 'package.json')));
    const binding = path.join(profileDir, 'node_modules', ...row.name.split('/'));
    if (first !== binding || await realpath(binding) !== row.target) throw fail();
  }
}

export async function createStandardView(profileDir, disabledPackages, entries = []) {
  const disabled = disabledPolicy(disabledPackages);
  const snapshot = await inspectStandardProfile(profileDir, entries);
  const packages = snapshot.installed.filter(row => row.standardManifest && !disabled.includes(row.name));
  const directory = path.join(await managedRoot(profileDir, true), randomUUID());
  await mkdir(directory, { mode: 0o700 });
  const manifest = { private: true, dependencies: Object.fromEntries(packages.map(row => [row.name, row.version])) };
  const file = await open(path.join(directory, 'package.json'), 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(manifest) + '\n'); await file.sync(); } finally { await file.close(); }
  const view = { directory, profileFingerprint: snapshot.fingerprint, disabledPackages: disabled, packages, manifest };
  await verifyStandardView(profileDir, view, entries);
  return Object.freeze(view);
}

export async function verifyStandardView(profileDir, view, entries = []) {
  const root = await managedRoot(profileDir, false);
  if (path.dirname(view.directory) !== root || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(path.basename(view.directory))) throw fail();
  await directory(view.directory);
  const file = path.join(view.directory, 'package.json'), stat = await lstat(file);
  if (stat.isSymbolicLink() || stat.nlink !== 1) throw fail();
  const actual = await jsonFile(file);
  if (JSON.stringify(actual.value) !== JSON.stringify(view.manifest)) throw fail();
  const snapshot = await inspectStandardProfile(profileDir, entries);
  if (snapshot.fingerprint !== view.profileFingerprint) throw fail();
  await verifyBindings(profileDir, view.directory, view.packages);
}
