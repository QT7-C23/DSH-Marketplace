import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readCommunityIndex, registryEntries } from './community.mjs';

const prompt = { schema: 1, id: 'new-prompt', type: 'Prompt', title: 'A useful prompt', summary: 'Community-authored instructions', body: 'Review the changes and explain concrete problems.', url: 'https://github.com/author/prompts', version: '1.0.0', author: 'author', license: 'MIT', language: 'en' };
const index = { schema: 1, entries: [prompt], removals: [] };
const blob = value => { const bytes = Buffer.from(JSON.stringify(value)); return { encoding: 'base64', content: bytes.toString('base64'), size: bytes.length, sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }; };
test('reviewed GitHub index discovers new submissions at a verified commit and preserves Prompt identities', async () => {
  const calls = [];
  const result = await readCommunityIndex(async url => { calls.push(url); return url.endsWith('/commits/main') ? { sha: 'a'.repeat(40) } : blob(index); });
  assert.equal(result.entries[0].id, 'github-new-prompt');
  assert.equal(result.entries[0].body, prompt.body);
  assert.equal(result.entries[0].sourceId, 'community');
  assert.equal(result.discovery.commit, 'a'.repeat(40));
  assert(calls[1].endsWith('?ref=' + 'a'.repeat(40)));
});
test('reviewed index enforces unique identities, licenses, integrity and removals', async () => {
  assert.throws(() => registryEntries({ ...index, entries: [prompt, prompt] }), /重复/);
  assert.throws(() => registryEntries({ ...index, entries: [{ ...prompt, license: '' }] }), /许可/);
  assert.throws(() => registryEntries({ ...index, entries: [{ ...prompt, type: 'Slash', parentId: 'missing', command: '/new' }] }), /父|所属/);
  const removal = { id: 'github-new-prompt', reason: 'Author requested withdrawal', issue: 'https://github.com/QT7-C23/DSH-Marketplace/issues/1' };
  const result = registryEntries({ ...index, removals: [removal] });
  assert.equal(result.entries.length, 0);
  assert.equal(result.excluded.length, 1);
  const wrong = blob(index); wrong.content = Buffer.from('changed').toString('base64');
  await assert.rejects(readCommunityIndex(async url => url.endsWith('/commits/main') ? { sha: 'a'.repeat(40) } : wrong), /校验/);
});
