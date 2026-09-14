import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ProfileInstaller } from './plugin/compatibility/installer.mjs';

const candidate = (name = '@install-test/native', version = '1.2.3') => ({
  name, version,
  tarball: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`,
  integrity: `sha512-${Buffer.alloc(64, 7).toString('base64')}`,
});
const files = ['package.json', 'pnpm-lock.yaml', 'cordis.patch.yml'];
const fixtureRoot = resolve('artifacts/r35-build/installer-tests');

async function fixture(t, run) {
  await mkdir(fixtureRoot, { recursive: true });
  const root = await mkdtemp(join(fixtureRoot, 'profile-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'home');
  const profile = 'install-test';
  const dir = join(home, 'profiles', profile);
  const folder = join(root, 'journal');
  const cli = join(root, 'cli', 'lib', 'bin.js');
  await mkdir(dir, { recursive: true });
  await mkdir(join(root, 'cli', 'lib'), { recursive: true });
  await writeFile(cli, 'process.exit(1);\n');
  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-install-test', private: true, dependencies: {},
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
  }));
  await writeFile(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  await writeFile(join(dir, 'cordis.patch.yml'), '# user configuration\n[]\n');
  const options = { home, profile, cli, folder, ...(run ? { run } : {}) };
  return { root, dir, options, installer: new ProfileInstaller(options) };
}

async function materialize(dir, item = candidate()) {
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  manifest.dependencies[item.name] = item.version;
  manifest.dsh.profile.bundles.push(item.name);
  await writeFile(join(dir, 'package.json'), JSON.stringify(manifest));
  await writeFile(join(dir, 'pnpm-lock.yaml'), `lockfileVersion: 9\n# ${item.name}@${item.version}\n`);
  const location = join(dir, 'node_modules', item.name);
  await mkdir(location, { recursive: true });
  await writeFile(join(location, 'package.json'), JSON.stringify({ name: item.name, version: item.version }));
}

async function journal(f, result) {
  const text = await readFile(join(f.options.folder, result.operationId, 'journal.jsonl'), 'utf8');
  return text.trim().split('\n').map(line => JSON.parse(line));
}

function sanitized(result, status, action = 'install') {
  assert.equal(result.status, status);
  assert.equal(result.action, action);
  assert.match(result.operationId, /^[a-f0-9-]{36}$/);
  assert.equal(typeof result.backupCreated, 'boolean');
  assert.equal(typeof result.name, 'string');
  assert.deepEqual(Object.keys(result).sort(), [
    'status', 'operationId', 'action', 'name', 'backupCreated',
    ...(result.version === undefined ? [] : ['version']),
  ].sort());
  assert.doesNotMatch(JSON.stringify(result), /secret|private-path|stdout|stderr|stack|home|journal|Error/);
}

test('fingerprint covers exact bytes and missing state for all three profile files', async t => {
  const f = await fixture(t);
  const original = await f.installer.fingerprint();
  assert.match(original, /^[a-f0-9]{64}$/);
  assert.equal(await new ProfileInstaller(f.options).fingerprint(), original);
  for (const file of files) {
    const before = await readFile(join(f.dir, file));
    await writeFile(join(f.dir, file), Buffer.concat([before, Buffer.from('\n')]));
    assert.notEqual(await f.installer.fingerprint(), original, file);
    await writeFile(join(f.dir, file), before);
    assert.equal(await f.installer.fingerprint(), original);
  }
  await rm(join(f.dir, 'pnpm-lock.yaml'));
  const missing = await f.installer.fingerprint();
  await writeFile(join(f.dir, 'pnpm-lock.yaml'), '');
  assert.notEqual(await f.installer.fingerprint(), missing);
});

test('install backs up bytes and journals before running exact official arguments', async t => {
  let f;
  let ran = false;
  f = await fixture(t, async args => {
    ran = true;
    assert.deepEqual(args, ['plugin', '--profile', 'install-test', 'add', '@install-test/native@1.2.3',
      '--ignore-scripts', '--save-exact', '--registry=https://registry.npmjs.org']);
    const [operationId] = await readdir(f.options.folder);
    const backup = JSON.parse(await readFile(join(f.options.folder, operationId, 'backup.json'), 'utf8'));
    assert.deepEqual(backup.files.map(file => file.name), files);
    for (const file of files) {
      assert.deepEqual(await readFile(join(f.options.folder, operationId, 'backup', file)), await readFile(join(f.dir, file)));
    }
    const events = await journal(f, { operationId });
    assert.equal(events.at(-1).phase, 'running');
    await materialize(f.dir);
    return { code: 0 };
  });
  const before = await f.installer.fingerprint();
  const result = await f.installer.install(candidate(), before);
  assert.equal(ran, true);
  sanitized(result, 'restart-required');
  assert.equal(result.backupCreated, true);
  assert.equal(result.name, candidate().name);
  assert.equal(result.version, '1.2.3');
  assert.notEqual(await f.installer.fingerprint(), before);
  assert.equal((await journal(f, result)).at(-1).phase, 'restart-required');
});

test('stale previews and malformed fingerprints cannot execute or overwrite external state', async t => {
  const f = await fixture(t, async () => assert.fail('must not execute'));
  const before = await f.installer.fingerprint();
  const external = '# edited outside installer\n[]\n';
  await writeFile(join(f.dir, 'cordis.patch.yml'), external);
  for (const fingerprint of [before, undefined, '', 'private-path-secret']) {
    const result = await f.installer.install(candidate(), fingerprint);
    sanitized(result, 'failed');
    assert.equal(result.backupCreated, false);
  }
  assert.equal(await readFile(join(f.dir, 'cordis.patch.yml'), 'utf8'), external);
});

test('invalid candidate shape, shell tokens, semver, tarball and integrity never reach run', async t => {
  const f = await fixture(t, async () => assert.fail('invalid input reached runner'));
  const fingerprint = await f.installer.fingerprint();
  const bad = [null, [], {}, { ...candidate(), extra: true }, { ...candidate(), integrity: undefined }];
  for (const name of ['../secret', '--help', 'a&whoami', 'a%PATH%', 'a!x!', 'a|x', 'a;echo', 'a x', 'A', '@x/../y', '@x/a/b', 'a\\b', '.npmrc', 'node_modules', 'con', 'a.', 'a\nsecret']) {
    bad.push({ ...candidate(), name });
  }
  for (const version of ['latest', '*', '^1.2.3', '~1.2.3', '1.2', 'v1.2.3', '01.2.3', '1.2.3-01', '1.2.3 && echo secret', '1.2.3\n']) {
    bad.push({ ...candidate(), version });
  }
  for (const tarball of ['http://registry.npmjs.org/a.tgz', 'https://registry.npmjs.org.evil.test/a.tgz',
    'https://registry.npmjs.org:443/@install-test/native/-/native-1.2.3.tgz',
    'https://user@registry.npmjs.org/@install-test/native/-/native-1.2.3.tgz',
    `${candidate().tarball}?x=y`, `${candidate().tarball}#x`, candidate().tarball.replace('1.2.3', '1.2.4'),
    'https://registry.npmjs.org/@install-test/native/-/../native-1.2.3.tgz', 'file:///secret']) {
    bad.push({ ...candidate(), tarball });
  }
  for (const integrity of ['sha256-secret', 'sha512-YQ==', `${candidate().integrity} sha512-YQ==`,
    candidate().integrity.replace(/=$/, 'A'), `${candidate().integrity}\n`]) bad.push({ ...candidate(), integrity });
  let accessed = false;
  bad.push(Object.defineProperty({ ...candidate() }, 'name', { get() { accessed = true; return 'secret'; } }));
  for (const input of bad) {
    const result = await f.installer.install(input, fingerprint);
    sanitized(result, 'failed');
    assert.equal(result.backupCreated, false);
  }
  assert.equal(accessed, false);
  assert.equal(await f.installer.fingerprint(), fingerprint);
});

test('exact prerelease and build versions are supported and caller mutation cannot alter the command', async t => {
  let f;
  const input = candidate('install-test', '2.0.0-rc.1+build.7');
  const original = { ...input };
  f = await fixture(t, async args => {
    assert.equal(args[4], 'install-test@2.0.0-rc.1+build.7');
    await materialize(f.dir, original);
    return { code: 0 };
  });
  const promise = f.installer.install(input, await f.installer.fingerprint());
  input.name = 'secret & whoami';
  input.version = 'latest';
  sanitized(await promise, 'restart-required');
});

test('exclusive lock spans instances with different journal folders and rejects concurrent operations', async t => {
  let enter;
  let release;
  const entered = new Promise(resolve => { enter = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, async () => {
    enter();
    await barrier;
    await materialize(f.dir);
    return { code: 0 };
  });
  const fp = await f.installer.fingerprint();
  const first = f.installer.install(candidate(), fp);
  await entered;
  try {
    const other = new ProfileInstaller({ ...f.options, folder: join(f.root, 'other-journal'), run: async () => assert.fail('concurrent write') });
    sanitized(await other.install(candidate(), fp), 'recovery-required');
  } finally {
    release();
  }
  sanitized(await first, 'restart-required');
  const other = new ProfileInstaller({ ...f.options, run: async () => assert.fail('stale write') });
  sanitized(await other.install(candidate(), fp), 'failed');
});

test('nonzero, throwing and malformed runners keep recovery evidence and preserve external edits', async t => {
  for (const behavior of ['nonzero', 'throw', 'malformed']) {
    let f;
    f = await fixture(t, async () => {
      await writeFile(join(f.dir, 'cordis.patch.yml'), '# external change, preserve me\n[]\n');
      await mkdir(join(f.dir, 'data'), { recursive: true });
      await writeFile(join(f.dir, 'data', 'plugin.db'), 'user data');
      if (behavior === 'throw') throw Error('private-path-secret stdout');
      return behavior === 'nonzero' ? { code: 7, stdout: 'private-path-secret' } : { code: '0' };
    });
    const result = await f.installer.install(candidate(), await f.installer.fingerprint());
    sanitized(result, 'recovery-required');
    assert.equal(result.backupCreated, true);
    assert.equal(await readFile(join(f.dir, 'cordis.patch.yml'), 'utf8'), '# external change, preserve me\n[]\n');
    assert.equal(await readFile(join(f.dir, 'data', 'plugin.db'), 'utf8'), 'user data');
    assert.equal((await journal(f, result)).at(-1).phase, 'recovery-required');
    const other = new ProfileInstaller({ ...f.options, run: async () => assert.fail('unresolved recovery must block') });
    sanitized(await other.install(candidate(), await other.fingerprint()), 'recovery-required');
    assert.equal(await readFile(join(f.options.folder, result.operationId, 'backup', 'cordis.patch.yml'), 'utf8'), '# user configuration\n[]\n');
  }
});

test('zero exit cannot claim installed without exact manifest and resolved package version', async t => {
  for (const mismatch of ['no-write', 'range', 'wrong-version', 'wrong-name', 'missing-package', 'ancestor-only']) {
    let f;
    f = await fixture(t, async () => {
      if (mismatch === 'no-write') return { code: 0 };
      await materialize(f.dir);
      if (mismatch === 'range') {
        const manifest = JSON.parse(await readFile(join(f.dir, 'package.json'), 'utf8'));
        manifest.dependencies[candidate().name] = '^1.2.3';
        await writeFile(join(f.dir, 'package.json'), JSON.stringify(manifest));
      } else if (mismatch === 'wrong-version' || mismatch === 'wrong-name') {
        await writeFile(join(f.dir, 'node_modules', candidate().name, 'package.json'), JSON.stringify({
          name: mismatch === 'wrong-name' ? 'another-package' : candidate().name, version: '0.0.0',
        }));
      } else if (mismatch === 'missing-package' || mismatch === 'ancestor-only') {
        await rm(join(f.dir, 'node_modules'), { recursive: true, force: true });
        if (mismatch === 'ancestor-only') {
          const dir = join(f.options.home, 'profiles', 'node_modules', candidate().name);
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, 'package.json'), JSON.stringify(candidate()));
        }
      }
      return { code: 0 };
    });
    sanitized(await f.installer.install(candidate(), await f.installer.fingerprint()), 'recovery-required');
  }
});

test('remove invokes official CLI, validates direct removal and preserves plugin data and shared adapter', async t => {
  let f;
  f = await fixture(t, async args => {
    assert.deepEqual(args, ['plugin', '--profile', 'install-test', 'remove', candidate().name,
      '--ignore-scripts', '--registry=https://registry.npmjs.org']);
    const manifest = JSON.parse(await readFile(join(f.dir, 'package.json'), 'utf8'));
    delete manifest.dependencies[candidate().name];
    manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter(name => name !== candidate().name);
    await writeFile(join(f.dir, 'package.json'), JSON.stringify(manifest));
    await rm(join(f.dir, 'node_modules', candidate().name), { recursive: true });
    return { code: 0 };
  });
  await materialize(f.dir, candidate('@dsh-std/adapter-dsh', '0.1.1-rc.3'));
  await materialize(f.dir);
  await mkdir(join(f.options.home, 'data'), { recursive: true });
  await writeFile(join(f.options.home, 'data', 'plugin.db'), 'do not delete');
  const result = await f.installer.remove(candidate().name, await f.installer.fingerprint());
  sanitized(result, 'restart-required', 'remove');
  assert.equal(result.version, '1.2.3');
  const manifest = JSON.parse(await readFile(join(f.dir, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies[candidate().name], undefined);
  assert.equal(manifest.dependencies['@dsh-std/adapter-dsh'], '0.1.1-rc.3');
  assert.equal(await readFile(join(f.options.home, 'data', 'plugin.db'), 'utf8'), 'do not delete');
});

test('remove refuses shared adapter, non-direct packages, invalid names and false success', async t => {
  const f = await fixture(t, async () => assert.fail('removal is forbidden'));
  await materialize(f.dir, candidate('@dsh-std/adapter-dsh', '0.1.1-rc.3'));
  const fp = await f.installer.fingerprint();
  for (const name of ['@dsh-std/adapter-dsh', '@deepseek-ai/dsh-base', 'not-installed', '../secret']) {
    sanitized(await f.installer.remove(name, fp), 'failed', 'remove');
  }
  await materialize(f.dir);
  const liar = new ProfileInstaller({ ...f.options, run: async () => ({ code: 0 }) });
  sanitized(await liar.remove(candidate().name, await liar.fingerprint()), 'recovery-required', 'remove');
});

test('new profiles record missing backups and are initialized only by the CLI', async t => {
  let f;
  f = await fixture(t, async () => {
    assert.equal((await readdir(f.dir)).includes('package.json'), false);
    await writeFile(join(f.dir, 'package.json'), JSON.stringify({ dependencies: {}, dsh: { profile: { bundles: [] } } }));
    await writeFile(join(f.dir, 'cordis.patch.yml'), '[]\n');
    await materialize(f.dir);
    return { code: 0 };
  });
  for (const name of files) await rm(join(f.dir, name));
  const result = await f.installer.install(candidate(), await f.installer.fingerprint());
  sanitized(result, 'restart-required');
  const backup = JSON.parse(await readFile(join(f.options.folder, result.operationId, 'backup.json'), 'utf8'));
  assert.equal(backup.files.every(file => file.present === false), true);
});

test('constructor and fingerprint sanitize boundary errors and reject unsafe profile paths', async t => {
  const f = await fixture(t);
  for (const profile of ['../secret', 'web & echo secret', 'web\n', 'node_modules', 'desktop', 'CON', '.hidden', 'a/b', 'a\\b']) {
    assert.throws(() => new ProfileInstaller({ ...f.options, profile }), error => !/secret|Error:.*[A-Z]:/.test(error.message));
  }
  for (const field of ['home', 'cli', 'folder']) {
    assert.throws(() => new ProfileInstaller({ ...f.options, [field]: 'relative-private-path-secret' }), { message: 'Invalid installer configuration' });
  }
  await rm(join(f.dir, 'cordis.patch.yml'));
  await mkdir(join(f.dir, 'cordis.patch.yml'));
  await assert.rejects(f.installer.fingerprint(), { message: 'Unable to fingerprint profile' });
  sanitized(await f.installer.install(candidate(), 'a'.repeat(64)), 'failed');
});

test('profile junctions cannot redirect a write outside the selected profile', async t => {
  const f = await fixture(t, async () => assert.fail('redirected profile'));
  const outside = join(f.root, 'outside');
  await mkdir(outside);
  await rm(f.dir, { recursive: true });
  await symlink(outside, f.dir, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.installer.fingerprint(), { message: 'Unable to fingerprint profile' });
  sanitized(await f.installer.install(candidate(), 'a'.repeat(64)), 'failed');
  assert.deepEqual(await readdir(outside), []);
});

test('default runner uses actual argv and trusted DSH_HOME, caps private output and never leaks it', async t => {
  const f = await fixture(t);
  await writeFile(f.options.cli, `
    import fs from 'node:fs';
    import path from 'node:path';
    const args = process.argv.slice(2);
    fs.writeFileSync(path.join(process.env.DSH_HOME, 'observed.json'), JSON.stringify({ args, cwd: process.cwd(), home: process.env.DSH_HOME }));
    process.stdout.write('private-path-secret'.repeat(50000));
    process.stderr.write('stderr secret');
    process.exitCode = 9;
  `);
  const result = await f.installer.install(candidate(), await f.installer.fingerprint());
  sanitized(result, 'recovery-required');
  const observed = JSON.parse(await readFile(join(f.options.home, 'observed.json'), 'utf8'));
  assert.equal(observed.home, f.options.home);
  assert.equal(observed.cwd, f.options.home);
  assert.deepEqual(observed.args, ['plugin', '--profile', 'install-test', 'add', '@install-test/native@1.2.3',
    '--ignore-scripts', '--save-exact', '--registry=https://registry.npmjs.org']);
  const log = await readFile(join(f.options.folder, result.operationId, 'cli.log'));
  assert.ok(log.length > 0 && log.length <= 65536);
});

test('another Node process cannot bypass the exclusive profile lock', async t => {
  let entered;
  let release;
  const entry = new Promise(resolve => { entered = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, async () => { entered(); await barrier; await materialize(f.dir); return { code: 0 }; });
  const fingerprint = await f.installer.fingerprint();
  const pending = f.installer.install(candidate(), fingerprint);
  await entry;
  try {
    const source = `import { ProfileInstaller } from ${JSON.stringify(new URL('./plugin/compatibility/installer.mjs', import.meta.url).href)};
      const installer = new ProfileInstaller({ ...${JSON.stringify({ ...f.options, folder: join(f.root, 'process-journal') })}, run: async () => { throw Error('must not run'); } });
      console.log(JSON.stringify(await installer.install(${JSON.stringify(candidate())}, ${JSON.stringify(fingerprint)})));`;
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', source], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve(JSON.parse(output)) : reject(Error('child failed')));
    });
    sanitized(result, 'recovery-required');
  } finally {
    release();
  }
  sanitized(await pending, 'restart-required');
});
