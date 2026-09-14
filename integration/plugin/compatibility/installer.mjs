import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

const profileFiles = ['package.json', 'pnpm-lock.yaml', 'cordis.patch.yml'];
const maxFileBytes = 16 * 1024 * 1024;
const maxLogBytes = 64 * 1024;
const deadlineMs = 120000;
const lockName = '.dsh-market-installer.lock';
const registry = 'https://registry.npmjs.org';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const own = (value, key) => Object.hasOwn(value, key);
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function packageName(value) {
  return typeof value === 'string' && value.length <= 214
    && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)
    && value.split('/').every(part => !part.endsWith('.') && !reserved.test(part.replace(/^@/, '')))
    && !['node_modules', 'favicon.ico'].includes(value.split('/').at(-1));
}

function exactVersion(value) {
  if (typeof value !== 'string' || value.length > 256) return false;
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
  return Boolean(match && match[0] === value
    && match.slice(1, 4).every(part => Number.isSafeInteger(Number(part)))
    && (!match[4] || match[4].split('.').every(part => !/^[0-9]+$/.test(part) || /^(0|[1-9][0-9]*)$/.test(part))));
}

function prepareCandidate(value) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 4 || !['name', 'version', 'tarball', 'integrity'].every(key => keys.includes(key))) return null;
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!own(descriptor, 'value') || typeof descriptor.value !== 'string') return null;
    result[key] = descriptor.value;
  }
  if (!packageName(result.name) || !exactVersion(result.version)) return null;
  const leaf = result.name.split('/').at(-1);
  if (result.tarball !== `${registry}/${result.name}/-/${leaf}-${result.version}.tgz`) return null;
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(result.integrity)) return null;
  const digest = result.integrity.slice(7);
  if (Buffer.from(digest, 'base64').toString('base64') !== digest) return null;
  return Object.freeze(result);
}

async function directory(path, create = false) {
  let stat;
  try { stat = await lstat(path); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!create) return;
    await mkdir(path, { recursive: true, mode: 0o700 });
    stat = await lstat(path);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Unsafe directory');
}

// Refuse links and oversized files at the writable profile boundary. A bounded
// buffer also prevents a concurrently growing file from exhausting memory.
async function bytesAt(path) {
  let stat;
  try { stat = await lstat(path); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > maxFileBytes) throw Error('Unsafe file');
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const current = await handle.stat();
    if (current.ino !== stat.ino || current.dev !== stat.dev || current.size !== stat.size) throw Error('File changed');
    const buffer = Buffer.alloc(stat.size + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used !== stat.size) throw Error('File changed');
    return buffer.subarray(0, used);
  } finally {
    await handle.close();
  }
}

async function durable(path, content, flag = 'wx') {
  const file = await open(path, flag, 0o600);
  try {
    await file.writeFile(content);
    await file.sync();
  } finally {
    await file.close();
  }
}

function fingerprintOf(snapshot) {
  return sha256(JSON.stringify(snapshot.map(({ name, bytes }) => ({
    name, present: bytes !== null, size: bytes?.length ?? 0, sha256: bytes === null ? null : sha256(bytes),
  }))));
}

function manifestFrom(snapshot) {
  const bytes = snapshot.find(file => file.name === 'package.json').bytes;
  if (bytes === null) return null;
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw Error('Invalid manifest');
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (manifest[key] !== undefined && (!manifest[key] || typeof manifest[key] !== 'object' || Array.isArray(manifest[key]))) throw Error('Invalid dependencies');
  }
  return manifest;
}

// No resolution fallback to the host/ancestor node_modules, and no package code
// is imported. pnpm symlinks are resolved only after a profile-local binding.
async function installedManifest(dir, name) {
  let path;
  try { path = await realpath(join(dir, 'node_modules', name, 'package.json')); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  // pnpm may hard-link package manifests from its content-addressed store.
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxFileBytes) throw Error('Invalid installed package');
    const buffer = Buffer.alloc(stat.size + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used !== stat.size) throw Error('Installed package changed');
    const manifest = JSON.parse(buffer.subarray(0, used).toString('utf8'));
    if (manifest?.name !== name || !exactVersion(manifest.version)) throw Error('Invalid installed package');
    return manifest;
  } finally {
    await handle.close();
  }
}

function runnerEnvironment(home) {
  const allowed = new Set(['path', 'pathext', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'tmpdir',
    'userprofile', 'home', 'appdata', 'localappdata', 'programfiles', 'programfiles(x86)', 'programdata',
    'http_proxy', 'https_proxy', 'no_proxy', 'lang', 'lc_all']);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase())));
  return { ...env, DSH_HOME: home, npm_config_ignore_scripts: 'true', npm_config_registry: registry, NO_COLOR: '1', CI: 'true' };
}

/**
 * Official CLI installation port. home/cli/folder are trusted server settings;
 * folder must be private, ignored artifact storage, never a public static root.
 * run receives ONLY ['plugin', '--profile', profile, ...pnpmArgs] and resolves
 * { code: number }; the default runner prepends cli to process.execPath argv.
 * The parent verifies candidate metadata AND tarball bytes before this call.
 * This name@version API cannot bind those bytes to pnpm's subsequent fetch.
 *
 * A profile-local exclusive file lock covers all instances/processes using this
 * port. It cannot lock out editors or a separately invoked official CLI. We
 * refingerprint after backup, immediately before dispatch, and never restore
 * profile files automatically. Any possibly executed failure leaves the lock
 * and journal for operator recovery, including process crashes and timeouts.
 * Killing the CLI does not guarantee its Windows pnpm descendants have exited;
 * recovery must confirm quiescence and external edits before any repair.
 * Backups cover the three profile files, not node_modules, workspace settings,
 * the pnpm store, or plugin data. Copying them back is NOT a proven rollback.
 */
export class ProfileInstaller {
  #home;
  #profile;
  #cli;
  #folder;
  #run;

  constructor({ home, profile, cli, folder, run } = {}) {
    const absolute = value => typeof value === 'string' && isAbsolute(value) && !value.includes('\0');
    if (![home, cli, folder].every(absolute)
      || typeof profile !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(profile)
      || reserved.test(profile) || ['node_modules', 'desktop'].includes(profile.toLowerCase())
      || (run !== undefined && typeof run !== 'function')) throw Error('Invalid installer configuration');
    this.#home = resolve(home);
    this.#profile = profile;
    this.#cli = resolve(cli);
    this.#folder = resolve(folder);
    this.#run = run;
  }

  async #snapshot(create = false) {
    await directory(this.#home, create);
    await directory(join(this.#home, 'profiles'), create);
    const dir = join(this.#home, 'profiles', this.#profile);
    await directory(dir, create);
    const snapshot = [];
    for (const name of profileFiles) snapshot.push({ name, bytes: await bytesAt(join(dir, name)) });
    return snapshot;
  }

  async fingerprint() {
    try { return fingerprintOf(await this.#snapshot()); } catch {
      throw Error('Unable to fingerprint profile');
    }
  }

  async install(candidate, expectedFingerprint) {
    let prepared;
    try { prepared = prepareCandidate(candidate); } catch { prepared = null; }
    return this.#operate('install', prepared, expectedFingerprint);
  }

  async remove(name, expectedFingerprint) {
    const prepared = packageName(name) && name !== '@dsh-std/adapter-dsh' ? { name } : null;
    return this.#operate('remove', prepared, expectedFingerprint);
  }

  async #execute(args, folder) {
    if (this.#run) {
      let timer;
      try {
        return await Promise.race([
          this.#run(args),
          new Promise(resolve => { timer = setTimeout(() => resolve({ code: -1 }), deadlineMs); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    const chunks = [];
    let length = 0;
    const capture = chunk => {
      const keep = chunk.subarray(0, maxLogBytes - length);
      if (keep.length) { chunks.push(Buffer.from(keep)); length += keep.length; }
    };
    const code = await new Promise(resolve => {
      let child;
      let timer;
      let settled = false;
      const finish = code => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child?.stdout?.destroy();
        child?.stderr?.destroy();
        resolve(code);
      };
      try {
        child = spawn(process.execPath, [this.#cli, ...args], {
          cwd: this.#home, env: runnerEnvironment(this.#home), shell: false,
          windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout.on('data', capture);
        child.stderr.on('data', capture);
        child.once('error', () => finish(-1));
        child.once('close', code => finish(Number.isInteger(code) ? code : -1));
        timer = setTimeout(() => {
          child.kill('SIGKILL');
          finish(-1);
        }, deadlineMs);
      } catch { finish(-1); }
    });
    await durable(join(folder, 'cli.log'), Buffer.concat(chunks, length));
    return { code };
  }

  async #operate(action, prepared, expectedFingerprint) {
    const result = {
      status: 'failed', operationId: randomUUID(), action, name: prepared?.name ?? '',
      ...(prepared?.version ? { version: prepared.version } : {}), backupCreated: false,
    };
    if (!prepared || typeof expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) return result;
    const dir = join(this.#home, 'profiles', this.#profile);
    const operationFolder = join(this.#folder, result.operationId);
    const lockPath = join(dir, lockName);
    let lock;
    let invoked = false;
    let journalReady = false;
    const record = async (phase, detail = {}) => {
      await durable(join(operationFolder, 'journal.jsonl'), JSON.stringify({
        schema: 1, operationId: result.operationId, action, name: result.name,
        ...(result.version ? { version: result.version } : {}), phase, at: new Date().toISOString(), ...detail,
      }) + '\n', 'a');
    };
    try {
      await directory(this.#folder, true);
      await mkdir(operationFolder, { mode: 0o700 });
      journalReady = true;
      await record('requested', { expectedFingerprint, ...(action === 'install' ? { candidate: prepared } : {}) });
      await this.#snapshot(true);
      try { lock = await open(lockPath, 'wx', 0o600); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        result.status = 'recovery-required';
        await record(result.status, { reason: 'profile-locked' });
        return result;
      }
      await lock.writeFile(JSON.stringify({ operationId: result.operationId, folder: operationFolder }));
      await lock.sync();
      const before = await this.#snapshot();
      if (fingerprintOf(before) !== expectedFingerprint) {
        await record('failed', { reason: 'stale-fingerprint' });
        return result;
      }
      const manifest = manifestFrom(before);
      if (action === 'remove') {
        if (!manifest || !own(manifest.dependencies ?? {}, prepared.name)) {
          await record('failed', { reason: 'not-direct-dependency' });
          return result;
        }
        const installed = await installedManifest(dir, prepared.name);
        if (installed) result.version = installed.version;
      }
      await mkdir(join(operationFolder, 'backup'), { mode: 0o700 });
      const backup = [];
      for (const { name, bytes } of before) {
        if (bytes !== null) await durable(join(operationFolder, 'backup', name), bytes);
        backup.push({ name, present: bytes !== null, size: bytes?.length ?? 0, sha256: bytes === null ? null : sha256(bytes) });
      }
      await durable(join(operationFolder, 'backup.json'), JSON.stringify({ schema: 1, fingerprint: expectedFingerprint, files: backup }));
      result.backupCreated = true;
      await record('backed-up');
      const args = ['plugin', '--profile', this.#profile, action === 'install' ? 'add' : 'remove',
        action === 'install' ? `${prepared.name}@${prepared.version}` : prepared.name,
        '--ignore-scripts', ...(action === 'install' ? ['--save-exact'] : []), `--registry=${registry}`];
      await record('running');
      // This is the final awaited profile read before handing control to CLI.
      if (fingerprintOf(await this.#snapshot()) !== expectedFingerprint) {
        await record('failed', { reason: 'external-change-before-dispatch' });
        return result;
      }
      invoked = true;
      const execution = await this.#execute(Object.freeze(args), operationFolder);
      const after = await this.#snapshot();
      const afterFingerprint = fingerprintOf(after);
      if (!execution || !Number.isInteger(execution.code) || execution.code !== 0) {
        result.status = 'recovery-required';
        await record(result.status, { reason: 'cli-failed-or-interrupted', afterFingerprint });
        return result;
      }
      const afterManifest = manifestFrom(after);
      const installed = await installedManifest(dir, prepared.name);
      const bundles = afterManifest?.dsh?.profile?.bundles ?? [];
      const verified = action === 'install'
        ? own(afterManifest?.dependencies ?? {}, prepared.name)
          && afterManifest.dependencies[prepared.name] === prepared.version
          && installed?.version === prepared.version
          && (!installed.dsh?.bundle?.patch || (Array.isArray(bundles) && bundles.includes(prepared.name)))
        : afterManifest !== null
          && ['dependencies', 'devDependencies', 'optionalDependencies'].every(key => !own(afterManifest[key] ?? {}, prepared.name))
          && Array.isArray(bundles) && !bundles.includes(prepared.name);
      result.status = verified ? 'restart-required' : 'recovery-required';
      // A removed direct dependency may remain transitively installed. Record
      // that version privately; do not delete shared packages or plugin data.
      await record(result.status, { reason: verified ? 'profile-verified' : 'postcondition-failed',
        afterFingerprint, installedVersion: installed?.version ?? null });
      return result;
    } catch {
      result.status = invoked ? 'recovery-required' : 'failed';
      if (journalReady) {
        try { await record(result.status, { reason: invoked ? 'execution-or-verification-failed' : 'precondition-failed' }); } catch { /* Keep the lock if any execution was possible. */ }
      }
      return result;
    } finally {
      if (lock) {
        try {
          await lock.close();
          if (result.status !== 'recovery-required') {
            const bytes = await bytesAt(lockPath);
            if (bytes && JSON.parse(bytes.toString('utf8')).operationId === result.operationId) await unlink(lockPath);
          }
        } catch {
          // A retained/changed lock blocks future writes; never steal it.
          result.status = 'recovery-required';
        }
      }
    }
  }
}
