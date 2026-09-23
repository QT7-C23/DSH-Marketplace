import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, lstat, symlink, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';

const moduleUrl = new URL('../../src/plugin/resources/skill-files.mjs', import.meta.url);
const commit = 'a'.repeat(40);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const license = readFileSync(new URL('../../licenses/sources/openai-apache-2.0.txt', import.meta.url));
const anthropicLicense = readFileSync(new URL('../../licenses/sources/anthropic-apache-2.0.txt', import.meta.url));

function source(repository = 'openai/skills', inherited = false, name = 'native-skill') {
  const root = `${repository === 'openai/skills' ? 'skills/.curated' : 'skills'}/${name}`;
  const contents = new Map(), files = [];
  function add(path, content, mode = '100644') {
    const bytes = Buffer.from(content);
    contents.set(path, bytes);
    files.push({ path, sha: blob(bytes), size: bytes.length, mode });
  }
  const body = `---\nname: ${name}\ndescription: A native filesystem fixture.\n---\nUse references/guide.md.\n`;
  add(`${root}/SKILL.md`, body);
  add(inherited ? 'LICENSE' : `${root}/LICENSE.txt`, repository === 'openai/skills' ? license : anthropicLicense);
  add(`${root}/references/guide.md`, 'Original companion 原文\n');
  add(`${root}/scripts/check.py`, 'raise RuntimeError("must never execute during installation")\n', '100755');
  add(`${root}/data/original.bin`, Buffer.from([0, 255, 128, 1, 13, 10]));
  const sourceId = repository === 'openai/skills' ? 'skills-openai' : 'skills';
  const resource = {
    id: `${sourceId === 'skills' ? 'source-skill-' : 'source-openai-skill-'}${name}`, revision: 3,
    type: 'Skill', sourceId, source: repository, status: 'external', owner: `source:${sourceId}`,
    author: repository.split('/')[0], title: name, summary: 'Native Skill installation fixture.', updatedAt: '',
    version: commit.slice(0, 12), body, url: `https://github.com/${repository}/blob/${commit}/${root}/SKILL.md`,
    requirements: 'Host acceptance is separate.', license: 'Apache-2.0',
    bundle: { kind: 'github-skill', repository, commit, root, files, ...(inherited ? { licensePaths: ['LICENSE'] } : {}) },
  };
  const calls = [];
  const download = async url => {
    calls.push(url);
    const prefix = `https://raw.githubusercontent.com/${repository}/${commit}/`;
    assert(url.startsWith(prefix));
    const path = url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
    assert(contents.has(path), `Unexpected download: ${path}`);
    return contents.get(path);
  };
  return { resource, contents, add, download, calls, name, root };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-skill-files-test-'));
  t.after(async () => {
    const rel = relative(resolve(tmpdir()), resolve(root));
    assert(!isAbsolute(rel) && !rel.startsWith('..') && rel.startsWith('dsh-skill-files-test-'));
    assert(!(await lstat(root)).isSymbolicLink());
    await rm(root, { recursive: true, force: true });
  });
  return { root, home: join(root, 'home'), outside: join(root, 'unrelated') };
}
async function manager(home, download) {
  const { SkillFiles } = await import(moduleUrl);
  return new SkillFiles({ home, download });
}
const metadata = (s, state = 'installed') => ({ id: s.resource.id, revision: s.resource.revision, name: s.name, version: s.resource.version, state });
const absent = path => assert.rejects(lstat(path), { code: 'ENOENT' });

test('an injected URL byte transport receives no manifest arguments', async t => {
  const f = await fixture(t), s = source();
  const files = await manager(f.home, async (...args) => { assert.equal(args.length, 1); return s.download(args[0]); });
  assert.deepEqual(await files.install(s.resource), metadata(s));
});

test('reviewed community Skills retain admission provenance through receipts and lifecycle restart', async t => {
  const f = await fixture(t), s = source('author/resources');
  Object.assign(s.resource, { id: 'source-community-native-skill', sourceId: 'community' });
  const files = await manager(f.home, s.download);
  assert.deepEqual(await files.install(s.resource), metadata(s));
  const reopened = await manager(f.home, s.download);
  assert.deepEqual(await reopened.read(), [metadata(s)]);
  await reopened.disable(s.resource.id, s.resource.revision);
  await reopened.enable(s.resource.id, s.resource.revision);
  const receiptFile = join(f.home, 'skills', s.name, '.dsh-market/receipt.json');
  const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
  assert.equal(receipt.sourceId, 'community');
  receipt.sourceId = 'skills'; await writeFile(receiptFile, JSON.stringify(receipt));
  assert.equal((await (await manager(f.home, s.download)).read())[0].state, 'modified');
});

for (const reverse of [false, true]) test(`distinct files in differently cased directories retain their bytes, reverse=${reverse}`, async t => {
  const f = await fixture(t), s = source();
  s.add(`${s.root}/REFERENCES/other.md`, 'A second original file\n');
  if (reverse) s.resource.bundle.files.reverse();
  const files = await manager(f.home, s.download);
  assert.deepEqual(await files.install(s.resource), metadata(s));
  assert.deepEqual(await files.read(), [metadata(s)]);
  assert.equal(await readFile(join(f.home, 'skills', s.name, 'references/guide.md'), 'utf8'), 'Original companion 原文\n');
  assert.equal(await readFile(join(f.home, 'skills', s.name, 'REFERENCES/other.md'), 'utf8'), 'A second original file\n');
});

for (const [repository, inherited] of [['anthropics/skills', false], ['openai/skills', false], ['openai/skills', true]]) {
  test(`native Skill install preserves original bytes and receipt: ${repository}, inherited=${inherited}`, async t => {
    const f = await fixture(t), s = source(repository, inherited), before = structuredClone(s.resource);
    const files = await manager(f.home, s.download);
    assert.deepEqual(await files.read(), []);
    await absent(f.home);
    assert.deepEqual(await files.install(s.resource), metadata(s));
    const target = join(f.home, 'skills', s.name);
    const receipt = JSON.parse(await readFile(join(target, '.dsh-market', 'receipt.json'), 'utf8'));
    assert.equal(receipt.id, s.resource.id);
    assert.equal(receipt.revision, 3);
    assert.equal(receipt.version, s.resource.version);
    assert.deepEqual(receipt.bundle, s.resource.bundle);
    for (const file of s.resource.bundle.files) {
      const path = file.path.startsWith(s.root + '/') ? file.path.slice(s.root.length + 1) : `.dsh-market/licenses/${file.path}`;
      const actual = await readFile(join(target, path));
      assert.deepEqual(actual, s.contents.get(file.path));
      assert.deepEqual(receipt.files.find(row => row.sourcePath === file.path), { sourcePath: file.path, path, sha: file.sha, size: file.size, mode: file.mode, sha256: digest(actual) });
      if (process.platform !== 'win32') assert.equal((await lstat(join(target, path))).mode & 0o777, file.mode === '100755' ? 0o755 : 0o644);
    }
    if (inherited) await absent(join(f.home, 'skills', 'LICENSE'));
    assert.equal(s.calls.length, s.resource.bundle.files.length);
    assert.deepEqual(await (await manager(f.home, async () => { throw Error('read must not download'); })).read(), [metadata(s)]);
    assert.deepEqual(s.resource, before);
  });
}

test('no Skill becomes visible until every file verifies and the complete directory is committed', async t => {
  const f = await fixture(t), s = source(), reached = Promise.withResolvers(), release = Promise.withResolvers();
  const files = await manager(f.home, async url => {
    if (url.endsWith('/data/original.bin')) { reached.resolve(); await release.promise; }
    return s.download(url);
  });
  const pending = files.install(s.resource);
  try {
    await reached.promise;
    await absent(join(f.home, 'skills', s.name));
    assert.deepEqual(await files.read(), []);
  } finally { release.resolve(); }
  assert.deepEqual(await pending, metadata(s));
});

for (const fault of ['tamper', 'network']) {
  test(`${fault} failure leaves no target and a clean retry succeeds`, async t => {
    const f = await fixture(t), s = source();
    const files = await manager(f.home, async url => {
      if (url.endsWith('/data/original.bin')) {
        if (fault === 'network') throw Error('private-path and secret-token must not escape');
        return Buffer.from('invalid body');
      }
      return s.download(url);
    });
    await assert.rejects(files.install(s.resource), error => error.code === (fault === 'network' ? 'SKILL_DOWNLOAD_FAILED' : 'SKILL_INTEGRITY') && !/private-path|secret-token/.test(error.message));
    await absent(join(f.home, 'skills', s.name));
    assert.deepEqual(await files.read(), []);
    const privateNames = await readdir(join(f.home, 'community', 'skill-files'));
    assert(!privateNames.some(name => name.startsWith('stage-')));
    assert.deepEqual(await (await manager(f.home, s.download)).install(s.resource), metadata(s));
  });
}

test('existing unmanaged folders and installed same-slug resources are never overwritten', async t => {
  const f = await fixture(t), s = source(), target = join(f.home, 'skills', s.name);
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'user.txt'), 'Preserve user content');
  const files = await manager(f.home, s.download);
  await assert.rejects(files.install(s.resource), { code: 'SKILL_CONFLICT' });
  assert.equal(s.calls.length, 0);
  assert.deepEqual(await readdir(target), ['user.txt']);
  assert.equal(await readFile(join(target, 'user.txt'), 'utf8'), 'Preserve user content');
  assert.deepEqual(await files.read(), []);
  const other = source('anthropics/skills', false, 'another-skill');
  await (await manager(f.home, other.download)).install(other.resource);
  const sameSlug = source('openai/skills', false, 'another-skill');
  await assert.rejects((await manager(f.home, sameSlug.download)).install(sameSlug.resource), { code: 'SKILL_CONFLICT' });
  assert.equal(sameSlug.calls.length, 0);
  assert.deepEqual(await files.read(), [metadata(other)]);
});

test('Windows reserved, trailing, wildcard and reserved receipt paths reject before filesystem writes', async t => {
  for (const path of ['CON', 'aux.txt', 'COM1.py', 'LPT².log', 'guide.', 'guide ', 'bad?.md', 'bad*.txt', '.DSH-MARKET/receipt.json']) {
    const f = await fixture(t), s = source();
    s.add(`${s.root}/${path}`, 'Invalid Windows or manager-reserved path');
    await assert.rejects((await manager(f.home, s.download)).install(s.resource), { code: 'SKILL_UNSAFE_PATH' });
    assert.equal(s.calls.length, 0);
    await absent(f.home);
  }
});

test('invalid Resource, source paths, case conflicts and symbolic-link modes reject before writes', async t => {
  for (const edit of [
    s => { s.resource.revision = 0; },
    s => { s.resource.bundle.repository = 'untrusted/skills'; },
    s => { s.add(`${s.root}/../escape`, 'unsafe'); },
    s => { s.add(`${s.root}/DATA/ORIGINAL.BIN`, 'case conflict'); },
    s => { s.resource.bundle.files[0].mode = '120000'; },
  ]) {
    const f = await fixture(t), s = source(); edit(s);
    await assert.rejects((await manager(f.home, s.download)).install(s.resource), { code: 'SKILL_INVALID' });
    assert.equal(s.calls.length, 0);
    await absent(f.home);
  }
});

for (const component of ['home', 'skills', 'community']) {
  test(`symlink/junction ${component} root is refused without touching its target`, async t => {
    const f = await fixture(t), s = source();
    await mkdir(f.outside);
    await writeFile(join(f.outside, 'sentinel'), 'Unrelated');
    if (component !== 'home') await mkdir(f.home);
    await symlink(f.outside, component === 'home' ? f.home : join(f.home, component), process.platform === 'win32' ? 'junction' : 'dir');
    const files = await manager(f.home, s.download);
    await assert.rejects(files.install(s.resource), { code: 'SKILL_UNSAFE_PATH' });
    await assert.rejects(files.read(), { code: 'SKILL_UNSAFE_PATH' });
    assert.deepEqual(await readdir(f.outside), ['sentinel']);
    assert.equal(s.calls.length, 0);
  });
}

test('existing destination junction and Windows case-alias folders are preserved', async t => {
  const f = await fixture(t), s = source();
  await mkdir(join(f.home, 'skills'), { recursive: true });
  await mkdir(f.outside);
  await writeFile(join(f.outside, 'sentinel'), 'Unrelated');
  await symlink(f.outside, join(f.home, 'skills', s.name), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects((await manager(f.home, s.download)).install(s.resource), { code: 'SKILL_CONFLICT' });
  assert.deepEqual(await readdir(f.outside), ['sentinel']);
  const other = source('openai/skills', false, 'case-alias');
  await mkdir(join(f.home, 'skills', 'CASE-ALIAS'));
  await assert.rejects((await manager(f.home, other.download)).install(other.resource), { code: 'SKILL_CONFLICT' });
  assert.equal(s.calls.length + other.calls.length, 0);
});

test('concurrent manager instances cannot install the same slug while its lock is held', async t => {
  const f = await fixture(t), s = source(), reached = Promise.withResolvers(), release = Promise.withResolvers();
  const first = await manager(f.home, async url => { reached.resolve(); await release.promise; return s.download(url); });
  const pending = first.install(s.resource);
  try {
    await reached.promise;
    const rival = source('anthropics/skills');
    await assert.rejects((await manager(f.home, rival.download)).install(rival.resource), { code: 'SKILL_BUSY' });
    assert.equal(rival.calls.length, 0);
    await absent(join(f.home, 'skills', s.name));
  } finally { release.resolve(); }
  await pending;
  assert.deepEqual(await first.read(), [metadata(s)]);
});

test('a destination created during download wins without any of its content being changed', async t => {
  const f = await fixture(t), s = source(), target = join(f.home, 'skills', s.name);
  const files = await manager(f.home, async url => {
    if (url.endsWith('/data/original.bin')) {
      await mkdir(target);
      await writeFile(join(target, 'winner'), 'External winner');
    }
    return s.download(url);
  });
  await assert.rejects(files.install(s.resource), { code: 'SKILL_CONFLICT' });
  assert.deepEqual(await readdir(target), ['winner']);
  assert.equal(await readFile(join(target, 'winner'), 'utf8'), 'External winner');
  assert.deepEqual(await files.read(), []);
});

test('staged bytes are checked again before rename, not just when downloaded', async t => {
  const f = await fixture(t), s = source();
  const files = await manager(f.home, async url => {
    if (url.endsWith('/data/original.bin')) {
      const privateRoot = join(f.home, 'community', 'skill-files');
      const stage = (await readdir(privateRoot)).find(name => name.startsWith('stage-'));
      await writeFile(join(privateRoot, stage, 'SKILL.md'), 'Staged content changed');
    }
    return s.download(url);
  });
  await assert.rejects(files.install(s.resource), { code: 'SKILL_INTEGRITY' });
  await absent(join(f.home, 'skills', s.name));
  assert.deepEqual(await files.read(), []);
  const privateRoot = join(f.home, 'community/skill-files');
  const stages = (await readdir(privateRoot)).filter(name => name.startsWith('stage-'));
  assert.equal(stages.length, 1, 'modified private staging must be retained');
  assert.equal(await readFile(join(privateRoot, stages[0], 'SKILL.md'), 'utf8'), 'Staged content changed');
  await assert.rejects(files.install(s.resource), { code: 'SKILL_BUSY' });
});

test('read reports changed bytes, missing/extra files, edited receipts and unsafe companions as modified', async t => {
  const f = await fixture(t), s = source(), files = await manager(f.home, s.download);
  await files.install(s.resource);
  const target = join(f.home, 'skills', s.name), binary = join(target, 'data', 'original.bin');
  const original = await readFile(binary);
  await writeFile(binary, Buffer.alloc(original.length));
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
  await writeFile(binary, original);
  assert.deepEqual(await files.read(), [metadata(s)]);
  await rm(binary);
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
  await writeFile(binary, original);
  await writeFile(join(target, 'added.txt'), 'Unreviewed companion');
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
  await rm(join(target, 'added.txt'));
  const receiptPath = join(target, '.dsh-market', 'receipt.json'), receipt = await readFile(receiptPath);
  await writeFile(receiptPath, '{"id":"do-not-trust-this-edited-id"}');
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
  await writeFile(receiptPath, Buffer.alloc(600 * 1024));
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
  await writeFile(receiptPath, receipt);
  await rm(join(target, 'references'), { recursive: true });
  await mkdir(f.outside);
  await writeFile(join(f.outside, 'guide.md'), 'Outside content');
  await symlink(f.outside, join(target, 'references'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
  assert.equal(await readFile(join(f.outside, 'guide.md'), 'utf8'), 'Outside content');
});

test('read ignores unmanaged receipts and returns only bounded public metadata', async t => {
  const f = await fixture(t), s = source(), files = await manager(f.home, s.download);
  await files.install(s.resource);
  const unmanaged = join(f.home, 'skills', 'unmanaged', '.dsh-market');
  await mkdir(unmanaged, { recursive: true });
  await writeFile(join(unmanaged, 'receipt.json'), JSON.stringify({ id: 'source-skill-unmanaged', privatePath: f.home, secret: 'unmanaged-secret' }));
  const rows = await files.read();
  assert.deepEqual(rows, [metadata(s)]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['id', 'revision', 'name', 'version', 'state'].sort());
  assert(!JSON.stringify(rows).includes(f.home));
  assert(!JSON.stringify(rows).includes('unmanaged-secret'));
});

test('an interrupted private record with no installed target is not exposed as an installed Skill', async t => {
  const f = await fixture(t), s = source();
  const records = join(f.home, 'community', 'skill-files', 'records');
  await mkdir(records, { recursive: true });
  await writeFile(join(records, `${s.name}.json`), '{"schema":1,"incomplete');
  assert.deepEqual(await (await manager(f.home, s.download)).read(), []);
  assert.equal(s.calls.length, 0);
  await absent(join(f.home, 'skills', s.name));
});

test('a root replaced by a junction during download cannot redirect staging or installation writes', async t => {
  const f = await fixture(t), s = source();
  await mkdir(f.outside);
  await writeFile(join(f.outside, 'sentinel'), 'Keep unrelated content');
  let replaced = false;
  const files = await manager(f.home, async url => {
    if (!replaced) {
      replaced = true;
      await rename(join(f.home, 'skills'), join(f.home, 'original-skills'));
      await symlink(f.outside, join(f.home, 'skills'), process.platform === 'win32' ? 'junction' : 'dir');
    }
    return s.download(url);
  });
  await assert.rejects(files.install(s.resource), { code: 'SKILL_UNSAFE_PATH' });
  assert.deepEqual(await readdir(f.outside), ['sentinel']);
  assert.equal(await readFile(join(f.outside, 'sentinel'), 'utf8'), 'Keep unrelated content');
  assert.deepEqual(await readdir(join(f.home, 'original-skills')), []);
});

test('process lock survives interruption without publishing a partial Skill', { timeout: 15000 }, async t => {
  const f = await fixture(t), s = source();
  await manager(f.home, s.download); // Resolve the implementation before creating the worker process.
  const inputPath = join(f.root, 'input.json');
  await writeFile(inputPath, JSON.stringify({ home: f.home, resource: s.resource }));
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import {readFile} from 'node:fs/promises';
    const {SkillFiles} = await import(process.env.DSH_SKILL_TEST_MODULE);
    const input = JSON.parse(await readFile(process.env.DSH_SKILL_TEST_INPUT, 'utf8'));
    await new SkillFiles({home: input.home, download: async () => {
      console.log('LOCKED');
      process.stdin.resume();
      await new Promise(resolve => process.stdin.once('data', resolve));
      throw Error('test interruption');
    }}).install(input.resource);
  `], { windowsHide: true, env: { ...process.env, DSH_SKILL_TEST_MODULE: moduleUrl.href, DSH_SKILL_TEST_INPUT: inputPath }, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'exit');
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await closed; });
  await new Promise((resolveReady, rejectReady) => {
    child.stdout.on('data', bytes => { if (bytes.toString().includes('LOCKED')) resolveReady(); });
    child.once('error', rejectReady);
    child.once('exit', () => rejectReady(Error('Worker exited before acquiring its lock')));
  });
  await assert.rejects((await manager(f.home, s.download)).install(s.resource), { code: 'SKILL_BUSY' });
  assert.equal(s.calls.length, 0);
  child.kill();
  await closed;
  await absent(join(f.home, 'skills', s.name));
  assert.deepEqual(await (await manager(f.home, s.download)).read(), []);
  await assert.rejects((await manager(f.home, s.download)).install(s.resource), { code: 'SKILL_BUSY' });
});

function nextSource(previous) {
  const s = source(previous.resource.bundle.repository, !!previous.resource.bundle.licensePaths, previous.name);
  const nextCommit = 'b'.repeat(40);
  s.resource.revision = previous.resource.revision + 1;
  s.resource.version = nextCommit.slice(0, 12);
  s.resource.bundle.commit = nextCommit;
  s.resource.url = s.resource.url.replace(commit, nextCommit);
  const path = `${s.root}/data/original.bin`, bytes = Buffer.from([2, 0, 254, 128, 10]);
  s.contents.set(path, bytes);
  Object.assign(s.resource.bundle.files.find(file => file.path === path), { sha: blob(bytes), size: bytes.length });
  s.download = async (...args) => {
    assert.equal(args.length, 1);
    const prefix = `https://raw.githubusercontent.com/${s.resource.bundle.repository}/${nextCommit}/`;
    assert(args[0].startsWith(prefix));
    s.calls.push(args[0]);
    return s.contents.get(args[0].slice(prefix.length).split('/').map(decodeURIComponent).join('/'));
  };
  return s;
}
async function faultRename(t, intercept) {
  const original = fs.rename;
  fs.rename = (from, to) => intercept(from, to, original);
  syncBuiltinESMExports();
  t.after(() => { fs.rename = original; syncBuiltinESMExports(); });
  return () => { fs.rename = original; syncBuiltinESMExports(); };
}

test('lifecycle disable survives manager restart and enable restores the original complete directory', async t => {
  const f = await fixture(t), s = source('openai/skills', true), files = await manager(f.home, s.download);
  await files.install(s.resource);
  const target = join(f.home, 'skills', s.name), original = await lstat(target);
  assert.deepEqual(await files.disable(s.resource.id, 3), metadata(s, 'disabled'));
  await absent(target);
  const fresh = await manager(f.home, () => { throw Error('lifecycle must not download'); });
  assert.deepEqual(await fresh.read(), [metadata(s, 'disabled')]);
  assert.deepEqual(await fresh.enable(s.resource.id, 3), metadata(s));
  assert.equal((await lstat(target)).ino, original.ino);
  assert.deepEqual(await readFile(join(target, 'data/original.bin')), s.contents.get(`${s.root}/data/original.bin`));
  assert.deepEqual(await readFile(join(target, '.dsh-market/licenses/LICENSE')), license);
});

test('lifecycle enable refuses an unmanaged same-name collision and never overwrites it', async t => {
  const f = await fixture(t), s = source(), files = await manager(f.home, s.download);
  await files.install(s.resource); await files.disable(s.resource.id, 3);
  const target = join(f.home, 'skills', s.name.toUpperCase());
  await mkdir(target); await writeFile(join(target, 'unmanaged'), 'Keep me');
  await assert.rejects(files.enable(s.resource.id, 3), { code: 'SKILL_CONFLICT' });
  assert.equal(await readFile(join(target, 'unmanaged'), 'utf8'), 'Keep me');
  assert.deepEqual(await files.read(), [metadata(s, 'disabled')]);
});

test('lifecycle identity, revision and modified files are checked before any mutation or download', async t => {
  const f = await fixture(t), s = source(), files = await manager(f.home, s.download), next = nextSource(s);
  await files.install(s.resource);
  await assert.rejects(files.disable('source-skill-unmanaged', 3), { code: 'SKILL_NOT_OWNED' });
  await assert.rejects(files.disable(s.resource.id, 2), { code: 'SKILL_REVISION' });
  const path = join(f.home, 'skills', s.name, 'data/original.bin'); await writeFile(path, 'External edit');
  for (const action of ['disable', 'enable', 'remove']) await assert.rejects(files[action](s.resource.id, 3), { code: 'SKILL_MODIFIED' });
  await assert.rejects((await manager(f.home, next.download)).update(next.resource), { code: 'SKILL_MODIFIED' });
  assert.equal(next.calls.length, 0);
  assert.equal(await readFile(path, 'utf8'), 'External edit');
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
});

test('lifecycle remove retains verified bytes and explicit restore recovers the removed version', async t => {
  const f = await fixture(t), s = source(), files = await manager(f.home, s.download);
  await files.install(s.resource);
  assert.deepEqual(await files.remove(s.resource.id, 3), metadata(s, 'removed'));
  await absent(join(f.home, 'skills', s.name));
  const fresh = await manager(f.home);
  assert.deepEqual(await fresh.read(), [metadata(s, 'removed')]);
  assert.deepEqual(await fresh.restore(s.resource.id), metadata(s));
  assert.deepEqual(await readFile(join(f.home, 'skills', s.name, 'data/original.bin')), s.contents.get(`${s.root}/data/original.bin`));
});

test('lifecycle update stages all bytes before replacing and restore recovers the exact previous version', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s), original = await manager(f.home, s.download);
  await original.install(s.resource);
  const target = join(f.home, 'skills', s.name), binary = join(target, 'data/original.bin');
  const reached = Promise.withResolvers(), release = Promise.withResolvers();
  const files = await manager(f.home, async url => {
    if (url.endsWith('/data/original.bin')) { reached.resolve(); await release.promise; }
    return next.download(url);
  });
  const pending = files.update(next.resource);
  try {
    await reached.promise;
    assert.deepEqual(await readFile(binary), s.contents.get(`${s.root}/data/original.bin`));
    assert.deepEqual(await original.read(), [metadata(s)]);
    await assert.rejects(original.disable(s.resource.id, 3), { code: 'SKILL_BUSY' });
  } finally { release.resolve(); }
  assert.deepEqual(await pending, metadata(next));
  assert.deepEqual(await (await manager(f.home)).read(), [metadata(next)]);
  assert.deepEqual(await readFile(binary), next.contents.get(`${s.root}/data/original.bin`));
  assert.deepEqual(await files.restore(s.resource.id), metadata(s));
  assert.deepEqual(await readFile(binary), s.contents.get(`${s.root}/data/original.bin`));
  // Restore retains the replaced newer version as the next recoverable predecessor.
  assert.deepEqual(await files.restore(s.resource.id), metadata(next));
});

for (const fault of ['network', 'tamper']) test(`lifecycle failed ${fault} update preserves the old working version`, async t => {
  const f = await fixture(t), s = source(), next = nextSource(s), files = await manager(f.home, s.download);
  await files.install(s.resource);
  const updater = await manager(f.home, async url => {
    if (url.endsWith('/data/original.bin')) {
      if (fault === 'network') throw Error('private token');
      return Buffer.from('Bad bytes');
    }
    return next.download(url);
  });
  await assert.rejects(updater.update(next.resource), { code: fault === 'network' ? 'SKILL_DOWNLOAD_FAILED' : 'SKILL_INTEGRITY' });
  assert.deepEqual(await files.read(), [metadata(s)]);
  assert.deepEqual(await readFile(join(f.home, 'skills', s.name, 'data/original.bin')), s.contents.get(`${s.root}/data/original.bin`));
  assert.deepEqual(await (await manager(f.home, next.download)).update(next.resource), metadata(next));
});

test('lifecycle a failed second update rename restores the verified original without claiming the update', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s);
  await (await manager(f.home, s.download)).install(s.resource);
  const target = join(f.home, 'skills', s.name);
  await faultRename(t, async (from, to, original) => {
    if (to === target && /stage-[^/\\]+$/.test(from)) throw Object.assign(Error('commit failure'), { code: 'EIO' });
    return original(from, to);
  });
  await assert.rejects((await manager(f.home, next.download)).update(next.resource), { code: 'SKILL_IO' });
  assert.deepEqual(await (await manager(f.home)).read(), [metadata(s)]);
  assert.deepEqual(await readFile(join(target, 'data/original.bin')), s.contents.get(`${s.root}/data/original.bin`));
});

test('lifecycle uncertain rollback preserves an external winner and recovery state for explicit restore', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s);
  await (await manager(f.home, s.download)).install(s.resource);
  const target = join(f.home, 'skills', s.name);
  const reset = await faultRename(t, async (from, to, original) => {
    if (to === target && /stage-[^/\\]+$/.test(from)) {
      await mkdir(target); await writeFile(join(target, 'winner'), 'Unmanaged winner');
      throw Object.assign(Error('racing destination'), { code: 'EEXIST' });
    }
    return original(from, to);
  });
  const files = await manager(f.home, next.download);
  await assert.rejects(files.update(next.resource), { code: 'SKILL_RECOVERY_REQUIRED' });
  reset();
  assert.deepEqual(await (await manager(f.home)).read(), [metadata(s, 'recovery-required')]);
  await assert.rejects(files.restore(s.resource.id));
  assert.equal(await readFile(join(target, 'winner'), 'utf8'), 'Unmanaged winner');
  await rm(target, { recursive: true }); // The test owner explicitly clears its simulated conflict.
  assert.deepEqual(await files.restore(s.resource.id), metadata(s));
  assert.deepEqual(await readFile(join(target, 'data/original.bin')), s.contents.get(`${s.root}/data/original.bin`));
});

test('lifecycle restore refuses modified current bytes and preserves its retained predecessor', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s);
  await (await manager(f.home, s.download)).install(s.resource);
  const files = await manager(f.home, next.download); await files.update(next.resource);
  const binary = join(f.home, 'skills', s.name, 'data/original.bin'); await writeFile(binary, 'User changes');
  await assert.rejects(files.restore(s.resource.id), { code: 'SKILL_MODIFIED' });
  assert.equal(await readFile(binary, 'utf8'), 'User changes');
  await writeFile(binary, next.contents.get(`${s.root}/data/original.bin`));
  assert.deepEqual(await files.restore(s.resource.id), metadata(s));
});

test('lifecycle disabled updates and removed-disabled restore stay outside the native root', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s);
  const files = await manager(f.home, s.download); await files.install(s.resource); await files.disable(s.resource.id, 3);
  const updater = await manager(f.home, next.download);
  assert.deepEqual(await updater.update(next.resource), metadata(next, 'disabled'));
  assert.deepEqual(await updater.remove(s.resource.id, 4), metadata(next, 'removed'));
  assert.deepEqual(await updater.restore(s.resource.id), metadata(next, 'disabled'));
  await absent(join(f.home, 'skills', s.name));
  assert.deepEqual(await updater.enable(s.resource.id, 4), metadata(next));
});

test('lifecycle unrecorded empty directories and missing disabled copies are modifications', async t => {
  const f = await fixture(t), s = source(), files = await manager(f.home, s.download);
  await files.install(s.resource);
  const extra = join(f.home, 'skills', s.name, 'unmanaged-empty'); await mkdir(extra);
  await assert.rejects(files.disable(s.resource.id, 3), { code: 'SKILL_MODIFIED' });
  assert.equal((await lstat(extra)).isDirectory(), true);
  await rm(extra, { recursive: true });
  await files.disable(s.resource.id, 3);
  const privateRoot = join(f.home, 'community/skill-files');
  const record = JSON.parse(await readFile(join(privateRoot, 'records', s.name + '.json'), 'utf8'));
  await rename(join(privateRoot, record.location), join(f.root, 'externally-moved-disabled'));
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
  await assert.rejects(files.enable(s.resource.id, 3), { code: 'SKILL_MODIFIED' });
});

test('lifecycle update rejects source or slug changes before download and never follows disabled symlinks', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s), files = await manager(f.home, s.download);
  await files.install(s.resource);
  const different = nextSource(source('anthropics/skills'));
  different.resource.id = s.resource.id;
  await assert.rejects((await manager(f.home, different.download)).update(different.resource), { code: 'SKILL_INVALID' });
  assert.equal(different.calls.length, 0);
  next.resource.revision = 3;
  await assert.rejects((await manager(f.home, next.download)).update(next.resource), { code: 'SKILL_REVISION' });
  const renamed = nextSource(source('openai/skills', false, 'different-slug')); renamed.resource.id = s.resource.id;
  await assert.rejects((await manager(f.home, renamed.download)).update(renamed.resource), { code: 'SKILL_REVISION' });
  assert.equal(next.calls.length + renamed.calls.length, 0);
  await files.disable(s.resource.id, 3);
  const privateRoot = join(f.home, 'community/skill-files');
  const record = JSON.parse(await readFile(join(privateRoot, 'records', s.name + '.json'), 'utf8'));
  await rename(join(privateRoot, record.location), join(f.root, 'retained-original'));
  await mkdir(f.outside); await writeFile(join(f.outside, 'sentinel'), 'Unrelated');
  await symlink(f.outside, join(privateRoot, record.location), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(files.enable(s.resource.id, 3), { code: 'SKILL_MODIFIED' });
  assert.equal(await readFile(join(f.outside, 'sentinel'), 'utf8'), 'Unrelated');
});

test('lifecycle anchor commit failure restores the old directory and metadata', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s);
  await (await manager(f.home, s.download)).install(s.resource);
  const recordPath = join(f.home, 'community/skill-files/records', s.name + '.json');
  const oldRecord = await readFile(recordPath);
  let failed = false;
  await faultRename(t, async (from, to, original) => {
    if (to === recordPath && !failed) { failed = true; throw Object.assign(Error('anchor commit failed'), { code: 'EIO' }); }
    return original(from, to);
  });
  await assert.rejects((await manager(f.home, next.download)).update(next.resource), { code: 'SKILL_IO' });
  assert.equal(failed, true);
  assert.deepEqual(await readFile(recordPath), oldRecord);
  assert.deepEqual(await (await manager(f.home)).read(), [metadata(s)]);
  assert.deepEqual(await readFile(join(f.home, 'skills', s.name, 'data/original.bin')), s.contents.get(`${s.root}/data/original.bin`));
});

test('lifecycle an external edit during staging is preserved and never moved into recovery', async t => {
  const f = await fixture(t), s = source(), next = nextSource(s);
  await (await manager(f.home, s.download)).install(s.resource);
  const binary = join(f.home, 'skills', s.name, 'data/original.bin');
  const files = await manager(f.home, async url => {
    if (url.endsWith('/data/original.bin')) await writeFile(binary, 'User edited while updating');
    return next.download(url);
  });
  await assert.rejects(files.update(next.resource), { code: 'SKILL_MODIFIED' });
  assert.equal(await readFile(binary, 'utf8'), 'User edited while updating');
  assert.deepEqual(await readdir(join(f.home, 'community/skill-files/recovery')), []);
  assert.deepEqual(await files.read(), [metadata(s, 'modified')]);
});

test('lifecycle a process interrupted between update renames retains verified recovery and a blocking lock', { timeout: 15000 }, async t => {
  const f = await fixture(t), s = source(), next = nextSource(s);
  await (await manager(f.home, s.download)).install(s.resource);
  const inputPath = join(f.root, 'update-input.json'), target = join(f.home, 'skills', s.name);
  await writeFile(inputPath, JSON.stringify({ home: f.home, target, resource: next.resource,
    contents: Object.fromEntries([...next.contents].map(([path, bytes]) => [path, bytes.toString('base64')])) }));
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs/promises';
    import {syncBuiltinESMExports} from 'node:module';
    const input = JSON.parse(await fs.readFile(process.env.DSH_SKILL_TEST_INPUT, 'utf8'));
    const rename = fs.rename;
    fs.rename = async (from, to) => {
      await rename(from, to);
      if (from === input.target) {
        console.log('MOVED'); process.stdin.resume();
        await new Promise(resolve => process.stdin.once('data', resolve));
      }
    };
    syncBuiltinESMExports();
    const {SkillFiles} = await import(process.env.DSH_SKILL_TEST_MODULE);
    await new SkillFiles({home: input.home, download: async url => {
      const path = new URL(url).pathname.split('/').slice(4).map(decodeURIComponent).join('/');
      return Buffer.from(input.contents[path], 'base64');
    }}).update(input.resource);
  `], { windowsHide: true, env: { ...process.env, DSH_SKILL_TEST_MODULE: moduleUrl.href, DSH_SKILL_TEST_INPUT: inputPath }, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = once(child, 'exit');
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await closed; });
  await new Promise((ready, reject) => {
    child.stdout.on('data', bytes => { if (bytes.toString().includes('MOVED')) ready(); });
    child.once('error', reject); child.once('exit', () => reject(Error('Update process exited before moving old version')));
  });
  const files = await manager(f.home);
  await absent(target);
  assert.deepEqual(await files.read(), [metadata(s, 'recovery-required')]);
  await assert.rejects(files.restore(s.resource.id), { code: 'SKILL_BUSY' });
  child.kill(); await closed;
  await assert.rejects(files.restore(s.resource.id), { code: 'SKILL_BUSY' });
  // Only the test owner clears the known-dead process's lock, after waiting for its exit.
  await rm(join(f.home, 'community/skill-files/locks', s.name + '.lock'));
  assert.deepEqual(await files.restore(s.resource.id), metadata(s));
  assert.deepEqual(await readFile(join(target, 'data/original.bin')), s.contents.get(`${s.root}/data/original.bin`));
});
