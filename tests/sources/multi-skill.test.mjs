import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import * as readers from '../../src/sources/skills.mjs';
import { packageFile } from '../../src/sources/packages.mjs';
import { createAdapters } from '../../src/sources/adapters.mjs';

const commit = 'a'.repeat(40), treeSha = 'b'.repeat(40);
const licenseBytes = name => readFileSync(new URL(`../../licenses/sources/${name}.txt`, import.meta.url));
const openAiLicense = licenseBytes('openai-apache-2.0');
const anthropicLicense = licenseBytes('anthropic-apache-2.0');
const gitHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
function fixture(repository = 'openai/skills', names = ['never-listed-before'], rootLicense) {
  const prefix = repository === 'openai/skills' ? 'skills/.curated' : 'skills';
  const tree = [], bytes = new Map(), calls = [];
  function add(path, content, mode = '100644', type = 'blob') {
    const data = Buffer.from(content);
    const old = tree.findIndex(file => file.path === path);
    if (old >= 0) tree.splice(old, 1);
    bytes.set(path, data);
    const file = { path, sha: gitHash(data), size: data.length, mode, type };
    tree.push(file);
    return file;
  }
  for (const name of names) {
    const root = `${prefix}/${name}`;
    add(`${root}/SKILL.md`, `---\nname: ${name}\ndescription: A newly discovered workflow.\n---\nRead references/guide #?.md and use scripts/check.py only after reviewing its requirements.\n`);
    if (!rootLicense) add(`${root}/LICENSE.txt`, repository === 'openai/skills' ? openAiLicense : anthropicLicense);
    add(`${root}/references/guide #?.md`, 'Original reference 原文\n');
    add(`${root}/scripts/check.py`, 'raise RuntimeError("Never execute during discovery or packaging")\n', '100755');
    add(`${root}/assets/original.bin`, Buffer.from([0, 255, 128, 0, 13, 10]));
  }
  if (rootLicense) add(rootLicense, openAiLicense);
  const read = async url => {
    calls.push(url);
    if (url === `https://api.github.com/repos/${repository}/commits/main`) return { sha: commit, commit: { tree: { sha: treeSha } } };
    if (url === `https://api.github.com/repos/${repository}/git/trees/${treeSha}?recursive=1`) return { sha: treeSha, tree, truncated: false };
    throw Error(`Unexpected metadata URL: ${url}`);
  };
  const download = async url => {
    calls.push(url);
    const base = `https://raw.githubusercontent.com/${repository}/${commit}/`;
    assert(url.startsWith(base), 'Every download must use the selected repository and pinned commit');
    const path = url.slice(base.length).split('/').map(decodeURIComponent).join('/');
    assert(bytes.has(path), `Unexpected file download: ${path}`);
    return bytes.get(path);
  };
  return { repository, prefix, names, tree, bytes, calls, add, read, download };
}
const discover = source => (source.repository === 'openai/skills' ? readers.readOpenAiSkills : readers.readSkills)(source.read, { download: source.download });

test('discovery uses pinned API blobs when raw delivery is unreachable and stops retrying that host within one scan', async () => {
  const source = fixture('anthropics/skills', ['alpha', 'beta', 'gamma', 'delta', 'epsilon']);
  let rawCalls = 0;
  const apiCalls = [];
  source.download = async url => {
    if (url.startsWith('https://raw.githubusercontent.com/')) {
      rawCalls++;
      throw Object.assign(Error('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
    }
    const prefix = 'https://api.github.com/repos/anthropics/skills/git/blobs/';
    assert(url.startsWith(prefix)); apiCalls.push(url);
    const file = source.tree.find(row => row.sha === url.slice(prefix.length));
    assert(file, 'Only tree-pinned blobs may be read');
    return Buffer.from(JSON.stringify({ encoding: 'base64', content: source.bytes.get(file.path).toString('base64') }));
  };
  const result = await discover(source);
  assert.equal(result.entries.length, 5);
  assert(rawCalls > 0 && rawCalls <= 4, 'Unreachable raw host is attempted only by the initial concurrent work');
  assert.equal(apiCalls.length, 6, 'One shared license and five original instructions');
  for (const item of result.entries) assert.equal(item.body, source.bytes.get(item.bundle.root + '/SKILL.md').toString());
});
function resource(source) {
  const name = source.names[0], root = `${source.prefix}/${name}`;
  const sourceId = source.repository === 'openai/skills' ? 'skills-openai' : 'skills';
  return {
    id: sourceId === 'skills' ? `source-skill-${name}` : `source-openai-skill-${name}`, sourceId,
    type: 'Skill', title: name, summary: 'Original workflow.', version: commit.slice(0, 12),
    revision: 1, status: 'external', source: source.repository, owner: `source:${sourceId}`,
    author: source.repository.split('/')[0], updatedAt: '', body: source.bytes.get(`${root}/SKILL.md`).toString(),
    url: `https://github.com/${source.repository}/blob/${commit}/${root}/SKILL.md`,
    license: 'Apache-2.0', requirements: 'Requires a configured Skill provider and dependency review.',
    bundle: { kind: 'github-skill', repository: source.repository, commit, root, files: source.tree.map(({ path, sha, size, mode }) => ({ path, sha, size, mode })) },
  };
}

test('unseen OpenAI directories are discovered alongside Anthropic with distinct stable IDs', async () => {
  const anthropic = fixture('anthropics/skills', ['shared-slug']);
  const openai = fixture('openai/skills', ['shared-slug', 'never-listed-before']);
  openai.add('skills/.system/host-private/SKILL.md', 'Host-internal instructions');
  openai.add('skills/.experimental/experimental/SKILL.md', 'Not a curated resource');
  openai.add('skills/.curated/container/nested/SKILL.md', 'Not an immediate Skill directory');
  const first = await discover(anthropic), second = await discover(openai);
  assert.deepEqual(first.entries.map(item => item.id), ['source-skill-shared-slug']);
  assert.deepEqual(second.entries.map(item => item.id), ['source-openai-skill-never-listed-before', 'source-openai-skill-shared-slug']);
  assert.equal(new Set([...first.entries, ...second.entries].map(item => item.id)).size, 3);
  assert.equal(second.discovery.scanned, 2);
  assert.deepEqual(second.discovery.excluded, []);
  for (const item of second.entries) {
    assert.equal(item.sourceId, 'skills-openai');
    assert.equal(item.bundle.commit, commit);
    assert.equal(item.body, openai.bytes.get(`${item.bundle.root}/SKILL.md`).toString());
    assert.equal(item.bundle.files.length, 5);
    assert.match(item.requirements, /Codex/);
    assert.match(item.requirements, /依赖.*逐项配置.*不代表.*已满足/);
  }
  assert(!openai.calls.some(url => /\/\.system\/|\/\.experimental\/|\/nested\//.test(url)));
  assert.deepEqual(openai.calls.slice(0, 2), [
    'https://api.github.com/repos/openai/skills/commits/main',
    `https://api.github.com/repos/openai/skills/git/trees/${treeSha}?recursive=1`,
  ]);
  const next = await discover(openai);
  assert.deepEqual(next.entries.map(item => item.id), second.entries.map(item => item.id));
});

test('every reviewed OpenAI Apache and MIT text is recognized from original bytes', async () => {
  const variants = [
    ['apache-2.0', '13e25df86ce06eb6488e6a6bc5c5847f5dedc352', 'Apache-2.0'],
    ['apache-2.0-standard', '7a4a3ea2424c09fbe48d455aed1eaa94d9124835', 'Apache-2.0'],
    ['apache-2.0-chatgpt', '145d9443e3e7da910ac0b1e7c8afda86cfefde3a', 'Apache-2.0'],
    ['apache-2.0-playwright', 'cefe596afef12e19a8e5e923f1a04c7da3188760', 'Apache-2.0'],
    ['mit-notion', '08717083b66cc66a7d45267fd9a6998e79bddf04', 'MIT'],
    ['mit-vercel', '94df5bf89dbb6210a707fb4edbf3aade96bc4318', 'MIT'],
  ];
  for (const [suffix, hash, spdx] of variants) {
    const source = fixture(), bytes = licenseBytes(`openai-${suffix}`);
    assert.equal(gitHash(bytes), hash, 'The attributed license fixture must stay byte-identical to upstream');
    source.add(`${source.prefix}/${source.names[0]}/LICENSE.txt`, bytes);
    const result = await discover(source);
    assert.equal(result.entries.length, 1, suffix);
    assert.equal(result.entries[0].license, spdx);
  }
});

test('OpenAI IDs cannot collide with a legacy Anthropic slug prefixed with openai-', async () => {
  const anthropic = await discover(fixture('anthropics/skills', ['shared-slug', 'openai-shared-slug']));
  const openai = await discover(fixture('openai/skills', ['shared-slug', 'openai-shared-slug']));
  assert.equal(new Set([...anthropic.entries, ...openai.entries].map(item => item.id)).size, 4);
});

function zipModes(bytes) {
  const modes = new Map();
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  let offset = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const length = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 46, offset + 46 + length).toString();
    modes.set(name, bytes.readUInt32LE(offset + 38) >>> 16);
    offset += 46 + length + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  return modes;
}

test('nested Skill ZIP preserves original license names, binary companions, provenance, and executable modes', async () => {
  for (const licensePath of ['LICENSE', 'LICENSE.md', 'skills/.curated/never-listed-before/LICENSE.TXT']) {
    const source = fixture('openai/skills', ['never-listed-before'], licensePath);
    source.add('README.md', 'Unrelated repository content must never enter the bundle');
    const result = await discover(source);
    const item = result.entries[0];
    assert(item, JSON.stringify(result.discovery));
    assert.deepEqual(item.bundle.licensePaths, [licensePath]);
    assert.equal(item.bundle.files.length, 5);
    const archive = await packageFile(item, { download: source.download });
    assert.equal(archive.mime, 'application/zip');
    const bytes = Buffer.from(archive.content, 'base64'), files = unzipSync(bytes), modes = zipModes(bytes);
    for (const original of item.bundle.files) {
      const name = original.path.startsWith(item.bundle.root + '/') ? `never-listed-before/${original.path.slice(item.bundle.root.length + 1)}` : original.path;
      assert.deepEqual(Buffer.from(files[name]), source.bytes.get(original.path), name);
      assert.equal(modes.get(name), original.mode === '100755' ? 0o100755 : 0o100644);
    }
    assert.equal(Object.keys(files).length, item.bundle.files.length + 1);
    const manifest = JSON.parse(Buffer.from(files['SOURCE.json']).toString());
    assert.deepEqual(manifest, { repository: source.repository, commit, root: item.bundle.root, files: item.bundle.files, licensePaths: [licensePath] });
    await assert.rejects(packageFile(item, { download: async () => Buffer.from('tampered') }), /校验/);
  }
});

for (const licensePath of ['license', 'LICENSE']) {
  test(`F1: slug license inheriting ${licensePath} is excluded and acquisition rejects before downloads`, async () => {
    const source = fixture('openai/skills', ['license'], licensePath);
    const item = resource(source);
    item.bundle.licensePaths = [licensePath];
    const original = structuredClone(item);
    await assert.rejects(packageFile(item, { download: source.download }), /Skill ZIP.*冲突/);
    assert.equal(source.calls.length, 0, 'Reject the full archive plan before fetching any body');
    assert.deepEqual(item, original, 'Do not rename, remove or rewrite the inherited license');
    const result = await createAdapters({ read: source.read, download: source.download })['skills-openai']();
    assert.deepEqual(result.entries, []);
    assert.equal(result.discovery.scanned, 1);
    assert.equal(result.discovery.excluded.length, 1);
    assert.equal(result.discovery.excluded[0].name, 'license');
    assert.match(result.discovery.excluded[0].reason, /Skill ZIP.*冲突/);
    assert.equal(source.calls.length, 2, 'Unsafe archive paths are excluded after commit/tree reads only');
  });
}

for (const conflict of ['duplicate', 'file-directory']) {
  test(`F1: Windows case-insensitive ZIP ${conflict} conflicts reject in either manifest order`, async () => {
    for (const repository of ['anthropics/skills', 'openai/skills']) {
      for (const reverse of [false, true]) {
        const source = fixture(repository), root = `${source.prefix}/${source.names[0]}`;
        const path = conflict === 'duplicate' ? `${root}/ASSETS/ORIGINAL.BIN` : `${root}/SCRIPTS`;
        source.add(path, 'A different regular file with a colliding Windows name');
        if (reverse) source.tree.reverse();
        const item = resource(source), original = structuredClone(item);
        await assert.rejects(packageFile(item, { download: source.download }), /Skill ZIP.*冲突/);
        assert.equal(source.calls.length, 0);
        assert.deepEqual(item, original);
        const result = await discover(source);
        assert.deepEqual(result.entries, []);
        assert.equal(result.discovery.excluded.length, 1);
        assert.match(result.discovery.excluded[0].reason, /Skill ZIP.*冲突/);
        assert.equal(source.calls.length, 2);
      }
    }
  });
}

test('F1: nonconflicting license slugs and case-varied directories retain original ZIP names and bytes', async () => {
  for (const licensePath of [undefined, 'LICENSE.md']) {
    const source = fixture('openai/skills', ['license'], licensePath);
    source.add(`${source.prefix}/license/ASSETS/extra.bin`, Buffer.from([1, 2, 3]));
    const result = await discover(source), item = result.entries[0];
    assert.equal(result.entries.length, 1);
    assert.deepEqual(result.discovery.excluded, []);
    const before = structuredClone(item);
    const archive = await packageFile(item, { download: source.download });
    const files = unzipSync(Buffer.from(archive.content, 'base64'));
    assert.deepEqual(Object.keys(files), [...item.bundle.files.map(file => file.path.startsWith(item.bundle.root + '/') ? `license/${file.path.slice(item.bundle.root.length + 1)}` : file.path), 'SOURCE.json']);
    assert.deepEqual(Buffer.from(files[licensePath || 'license/LICENSE.txt']), openAiLicense);
    assert.deepEqual(Buffer.from(files['license/ASSETS/extra.bin']), Buffer.from([1, 2, 3]));
    assert.deepEqual(Buffer.from(files['license/assets/original.bin']), source.bytes.get(`${item.bundle.root}/assets/original.bin`));
    assert.deepEqual(item, before);
  }
});

test('metadata, symlinks, submodules, traversal, missing and unreviewed licenses are explicit exclusions', async () => {
  const names = ['eligible', 'internal', 'invalid-name', 'invalid-yaml', 'invalid-utf8', 'symlink', 'submodule', 'traversal', 'missing-license', 'unreviewed'];
  const source = fixture('openai/skills', names);
  const path = (name, file) => `${source.prefix}/${name}/${file}`;
  source.add(path('internal', 'SKILL.md'), '---\nname: internal\ndescription: Internal\nmetadata:\n  internal: true\n---\nHidden');
  source.add(path('invalid-name', 'SKILL.md'), '---\nname: different\ndescription: Bad name\n---\nText');
  source.add(path('invalid-yaml', 'SKILL.md'), '---\nname: invalid-yaml\nname: duplicate\ndescription: Duplicate YAML key\n---\nText');
  source.add(path('invalid-utf8', 'SKILL.md'), Buffer.from([255, 254]));
  source.tree.find(file => file.path === path('symlink', 'scripts/check.py')).mode = '120000';
  source.add(path('submodule', 'nested'), 'submodule', '160000', 'commit');
  source.add(path('traversal', '../outside.txt'), 'escape');
  source.tree.splice(source.tree.findIndex(file => file.path === path('missing-license', 'LICENSE.txt')), 1);
  source.add(path('unreviewed', 'LICENSE.txt'), 'Apache License 2.0\nAdditional proprietary restrictions.\n');
  const result = await discover(source);
  assert.deepEqual(result.entries.map(item => item.id), ['source-openai-skill-eligible']);
  assert.equal(result.discovery.scanned, names.length);
  assert.deepEqual(result.discovery.excluded.map(row => row.name), names.filter(name => name !== 'eligible').sort());
  assert(result.discovery.excluded.every(row => row.reason.length > 0));
  assert(!source.calls.some(url => /\/(?:symlink|submodule|traversal|missing-license|unreviewed)\/SKILL.md$/.test(url)));
});

test('a root license never overrides an unsupported or ambiguous local license', async () => {
  const source = fixture();
  source.add('LICENSE', openAiLicense);
  source.add(`${source.prefix}/${source.names[0]}/LICENSE.txt`, 'All rights reserved');
  assert.equal((await discover(source)).entries.length, 0);
  source.add(`${source.prefix}/${source.names[0]}/LICENSE.txt`, openAiLicense);
  source.add(`${source.prefix}/${source.names[0]}/LICENSE.md`, licenseBytes('openai-mit-vercel'));
  assert.equal((await discover(source)).entries.length, 0);
});

test('truncated, duplicate and mismatched inventories or failed metadata reads reject the update', async () => {
  for (const repository of ['anthropics/skills', 'openai/skills']) {
    const source = fixture(repository), reader = repository === 'openai/skills' ? readers.readOpenAiSkills : readers.readSkills;
    for (const response of [
      { sha: treeSha, tree: source.tree, truncated: true },
      { sha: commit, tree: source.tree, truncated: false },
      { sha: treeSha, tree: [...source.tree, source.tree[0]], truncated: false },
      { sha: treeSha, tree: [null], truncated: false },
    ]) await assert.rejects(reader(async url => url.includes('/git/trees/') ? response : source.read(url), { download: source.download }));
    await assert.rejects(reader(async () => { throw Error('metadata offline'); }, { download: source.download }), /offline/);
    await assert.rejects(reader(async () => ({ sha: 'main', commit: { tree: { sha: treeSha } } }), { download: source.download }), /提交/);
  }
});

test('tampered license or Skill body bytes and failed preview downloads reject the entire update', async () => {
  for (const repository of ['anthropics/skills', 'openai/skills']) {
    for (const filename of ['LICENSE.txt', 'SKILL.md']) {
      const source = fixture(repository, ['eligible', 'broken']), target = `${source.prefix}/broken/${filename}`;
      source.bytes.set(target, Buffer.from('tampered'));
      // Keep identical license hashes from being served by the healthy resource's cache entry.
      if (filename === 'LICENSE.txt') source.bytes.set(`${source.prefix}/eligible/${filename}`, Buffer.from('tampered'));
      await assert.rejects(discover(source), /校验/);
    }
    const source = fixture(repository), download = source.download;
    source.download = async url => { if (url.endsWith('/SKILL.md')) throw Error('preview offline'); return download(url); };
    await assert.rejects(discover(source), /offline/);
  }
});

test('discovery pins companions lazily and acquisition rejects tampered or unavailable companion bytes', async () => {
  for (const repository of ['anthropics/skills', 'openai/skills']) {
    const source = fixture(repository), target = `${source.prefix}/${source.names[0]}/assets/original.bin`;
    source.bytes.set(target, Buffer.from('tampered companion'));
    const result = await discover(source), item = result.entries[0];
    assert.equal(result.entries.length, 1);
    assert.deepEqual(result.discovery.excluded, []);
    assert.equal(source.calls.length, 4, 'Only commit, tree, license and SKILL.md are read during discovery');
    assert(!source.calls.some(url => /\/(assets|references|scripts)\//.test(url)));
    const {path, sha, size, mode} = source.tree.find(file => file.path === target);
    assert.deepEqual(item.bundle.files.find(file => file.path === target), {path, sha, size, mode});
    await assert.rejects(packageFile(item, {download: source.download}), /校验/);
    await assert.rejects(packageFile(item, {download: async url => {
      if (url.endsWith('/assets/original.bin')) throw Error('companion offline');
      return source.download(url);
    }}), /offline/);
  }
});

test('Skill bundle validation preserves legacy bundles and accepts only scoped explicit licenses', async () => {
  const { validateSkillBundle } = await import('../../src/sources/skill-bundles.mjs');
  const legacy = resource(fixture('anthropics/skills'));
  assert.equal(validateSkillBundle(legacy), legacy);
  const rootLicense = resource(fixture('openai/skills', ['never-listed-before'], 'LICENSE.md'));
  rootLicense.bundle.licensePaths = ['LICENSE.md'];
  assert.equal(validateSkillBundle(rootLicense), rootLicense);
  const nested = resource(fixture());
  nested.bundle.licensePaths = [`${nested.bundle.root}/LICENSE.txt`];
  assert.equal(validateSkillBundle(nested), nested);
  for (const modify of [
    item => { item.type = '插件'; },
    item => { item.bundle.repository = 'untrusted/skills'; },
    item => { item.bundle.root = 'skills/.system/never-listed-before'; },
    item => { item.bundle.root = 'skills/.experimental/never-listed-before'; },
    item => { item.bundle.commit = 'main'; },
    item => { item.bundle.licensePaths = []; },
    item => { item.bundle.licensePaths = null; },
    item => { item.bundle.licensePaths.push(item.bundle.licensePaths[0]); },
    item => { item.bundle.licensePaths = [`${item.bundle.root}/scripts/check.py`]; },
    item => { item.bundle.licensePaths = ['README.md']; item.bundle.files.at(-1).path = 'README.md'; },
    item => { item.bundle.licensePaths = ['skills/.curated/sibling/LICENSE.txt']; item.bundle.files.at(-1).path = item.bundle.licensePaths[0]; },
    item => { item.bundle.licensePaths = ['LICENSE.md']; },
    item => { item.bundle.files[0].path = `${item.bundle.root}/../outside`; },
    item => { item.bundle.files[0].path = `${item.bundle.root}/a\\b`; },
    item => { item.bundle.files[0].mode = '120000'; },
    item => { item.bundle.files[0].sha = 'bad'; },
    item => { item.bundle.files.push(item.bundle.files[0]); },
    item => { item.bundle.files.push({ ...item.bundle.files[0], path: `${item.bundle.root}/scripts` }); },
    item => { item.bundle.files = item.bundle.files.filter(file => !file.path.endsWith('/SKILL.md')); },
    item => { item.bundle.files[0].size = 1024 * 1024 + 1; },
    item => { item.bundle.files[0].size = -1; },
    item => { item.bundle.files[0].size = 1.5; },
    item => { item.bundle.files.forEach(file => { file.size = 1024 * 1024; }); },
    item => { item.bundle.files = Array.from({ length: 151 }, (_, i) => ({ ...item.bundle.files[0], path: `${item.bundle.root}/file-${i}` })); },
  ]) {
    const item = structuredClone(nested); modify(item);
    assert.throws(() => validateSkillBundle(item), /Skill/);
  }
});

test('bundle limits include repository licenses and reject unsafe entries before downloads', async () => {
  const { validateSkillBundle } = await import('../../src/sources/skill-bundles.mjs');
  const item = resource(fixture('openai/skills', ['never-listed-before'], 'LICENSE'));
  item.bundle.licensePaths = ['LICENSE'];
  item.bundle.files.forEach((file, i) => { file.size = i < 4 ? 1024 * 1024 : 0; });
  assert.equal(validateSkillBundle(item), item, 'Exactly 4 MiB including the root license is valid');
  item.bundle.files.at(-1).size = 1;
  assert.throws(() => validateSkillBundle(item), /过大/);
  const source = fixture();
  source.tree[0].size = 1024 * 1024 + 1;
  const result = await discover(source);
  assert.equal(result.entries.length, 0);
  assert.equal(result.discovery.excluded.length, 1);
  assert.equal(source.calls.length, 2, 'Unsafe bundles never reach the download boundary');
});

test('unsafe directory nodes, the 150-file limit, and the scan cap are enforced', async () => {
  for (const [path, mode, type] of [
    ['skills/.curated/never-listed-before', '120000', 'blob'],
    ['skills/.curated', '160000', 'commit'],
    ['skills/.curated/never-listed-before/references', '120000', 'tree'],
    ['skills/.curated/never-listed-before/../elsewhere', '040000', 'tree'],
  ]) {
    const source = fixture();
    source.add(path, '', mode, type);
    const result = await discover(source);
    assert.equal(result.entries.length, 0, path);
    assert.equal(result.discovery.excluded.length, 1);
    assert.equal(source.calls.length, 2);
  }
  const source = fixture();
  for (let i = 0; i < 145; i++) source.add(`${source.prefix}/${source.names[0]}/extra-${i}`, `Companion ${i}`);
  assert.equal((await discover(source)).entries[0].bundle.files.length, 150);
  source.add(`${source.prefix}/${source.names[0]}/too-many`, 'Over the limit');
  assert.equal((await discover(source)).entries.length, 0);
  await assert.rejects(discover(fixture('openai/skills', Array.from({ length: 101 }, (_, i) => `skill-${i}`))), /扫描上限/);
});
