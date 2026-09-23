import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readPinnedSkillBytes } from '../../src/sources/request.mjs';
const bytes = Buffer.from('Original binary\0\xff');
const file = { size: bytes.length, sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') };
const bundle = { repository: 'anthropics/skills' };
const url = 'https://raw.githubusercontent.com/anthropics/skills/' + 'a'.repeat(40) + '/skills/example/SKILL.md';
const transient = () => Object.assign(Error('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
test('an unreachable raw endpoint can retrieve the exact pinned Git blob through the official API', async () => {
  const calls = [];
  const read = async target => { calls.push(target); if (target === url) throw transient(); return Buffer.from(JSON.stringify({ encoding: 'base64', content: bytes.toString('base64') })); };
  assert.deepEqual(await readPinnedSkillBytes(url, file, bundle, read), bytes);
  assert.deepEqual(calls, [url, `https://api.github.com/repos/anthropics/skills/git/blobs/${file.sha}`]);
});
test('alternate delivery still verifies the original hash and never bypasses an HTTP rejection', async () => {
  await assert.rejects(readPinnedSkillBytes(url, file, bundle, async target => { if (target === url) throw transient(); return Buffer.from(JSON.stringify({ encoding: 'base64', content: 'd3Jvbmc=' })); }), { code: 'SKILL_INTEGRITY' });
  let count = 0;
  await assert.rejects(readPinnedSkillBytes(url, file, bundle, async () => { count++; throw Object.assign(Error('HTTP 403'), { status: 403 }); }), /403/);
  assert.equal(count, 1);
});
