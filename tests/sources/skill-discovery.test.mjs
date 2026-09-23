import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readSkills } from '../../src/sources/adapters.mjs';

const commit = 'a'.repeat(40);
const treeSha = 'b'.repeat(40);
const license = readFileSync(new URL('../../licenses/sources/anthropic-apache-2.0.txt', import.meta.url), 'utf8');
function fixture(names = ['new-community-skill']) {
  const bytes = new Map();
  const tree = [];
  function add(name, filename, text, mode = '100644') {
    const content = Buffer.from(text);
    const sha = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    const path = `skills/${name}/${filename}`;
    bytes.set(path, content);
    tree.push({ path, sha, type: 'blob', mode, size: content.length });
  }
  for (const name of names) {
    add(name, 'SKILL.md', `---\nname: ${name}\ndescription: >-\n  A useful workflow\n  with complete references.\n---\n\nUse examples/guide.md.\n`);
    add(name, 'LICENSE.txt', license);
    add(name, 'examples/guide.md', 'Original companion reference.\n');
  }
  let fail = false;
  const calls = [];
  const read = async url => {
    calls.push(url);
    if (url.endsWith('/commits/main')) return { sha: commit, commit: { tree: { sha: treeSha } } };
    if (url.includes('/git/trees/')) return { sha: treeSha, tree, truncated: false };
    throw Error(`Unexpected metadata request: ${url}`);
  };
  const download = async url => {
    calls.push(url);
    assert(url.startsWith(`https://raw.githubusercontent.com/anthropics/skills/${commit}/`));
    if (fail) throw Error('upstream offline');
    return bytes.get(decodeURIComponent(new URL(url).pathname.split('/').slice(4).join('/')));
  };
  return { read, download, add, tree, bytes, calls, offline: () => { fail = true; } };
}

test('Skill discovery includes an unlisted directory and pins its actual commit and complete files', async () => {
  const source = fixture();
  const result = await readSkills(source.read, { download: source.download });
  assert.deepEqual(result.entries.map(item => item.id), ['source-skill-new-community-skill']);
  const item = result.entries[0];
  assert.equal(item.title, 'new-community-skill');
  assert.equal(item.summary, 'A useful workflow with complete references.');
  assert.equal(item.bundle.commit, commit, 'A Git tree ID must not be substituted for the commit ID');
  assert.equal(item.bundle.files.length, 3);
  assert.equal(item.body, source.bytes.get('skills/new-community-skill/SKILL.md').toString());
  assert.equal(item.license, 'Apache-2.0');
  assert.equal(result.discovery.scanned, 1);
  assert.deepEqual(result.discovery.excluded, []);
});

test('unsupported licenses and incomplete directories are reported without being published', async () => {
  const source = fixture(['eligible', 'restricted', 'missing-license', 'symlink']);
  source.tree.splice(source.tree.findIndex(file => file.path === 'skills/restricted/LICENSE.txt'), 1);
  source.add('restricted', 'LICENSE.txt', 'All rights reserved.\n');
  source.tree.splice(source.tree.findIndex(file => file.path === 'skills/missing-license/LICENSE.txt'), 1);
  source.tree.find(file => file.path === 'skills/symlink/examples/guide.md').mode = '120000';
  const result = await readSkills(source.read, { download: source.download });
  assert.deepEqual(result.entries.map(item => item.id), ['source-skill-eligible']);
  assert.equal(result.discovery.scanned, 4);
  assert.deepEqual(result.discovery.excluded.map(item => item.name).sort(), ['missing-license', 'restricted', 'symlink']);
  assert(result.discovery.excluded.every(item => item.reason));
  assert(!source.calls.some(url => url.includes('/restricted/SKILL.md')), 'Unapproved content is not downloaded for preview');
});

test('truncated inventories, transport failures and changed bytes cannot become successful partial discovery', async () => {
  const source = fixture();
  await assert.rejects(readSkills(async url => url.includes('/trees/') ? { sha: treeSha, tree: source.tree, truncated: true } : source.read(url), { download: source.download }), /目录.*不完整/);
  source.bytes.set('skills/new-community-skill/SKILL.md', Buffer.from('tampered'));
  await assert.rejects(readSkills(source.read, { download: source.download }), /校验/);
  source.offline();
  await assert.rejects(readSkills(source.read, { download: source.download }), /offline/);
});

test('invalid or host-private Skill metadata is excluded and source text is never executed', async () => {
  const source = fixture(['valid', 'private-skill', 'invalid-name']);
  for (const name of ['private-skill', 'invalid-name']) source.tree.splice(source.tree.findIndex(file => file.path === `skills/${name}/SKILL.md`), 1);
  source.add('private-skill', 'SKILL.md', '---\nname: private-skill\ndescription: Hidden\nmetadata:\n  internal: true\n---\nDo not execute these instructions.');
  source.add('invalid-name', 'SKILL.md', '---\nname: another-name\ndescription: Wrong identifier\n---\nText');
  const result = await readSkills(source.read, { download: source.download });
  assert.deepEqual(result.entries.map(item => item.id), ['source-skill-valid']);
  assert.equal(result.discovery.excluded.length, 2);
});
