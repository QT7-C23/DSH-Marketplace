import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePrompt, submissionFile, submissionUrl } from '../../catalog/contracts.mjs';

const draft = { type: 'Prompt', title: '测试模板', summary: '整理输入', body: '请整理 {{材料}}', version: '1.0.0', url: '' };
test('all six submission types retain authorship, license and source without a market account', () => {
  for (const type of ['插件', 'Skill', 'MCP', 'Slash', 'Prompt', '主题']) {
    const entry = JSON.parse(submissionFile({ ...draft, type, url: 'https://github.com/author/resource' }, { id: 'new-resource', author: 'author', license: 'Apache-2.0', language: 'ja' }).content);
    assert.equal(entry.type, type); assert.equal(entry.author, 'author'); assert.equal(entry.language, 'ja');
    assert.equal(entry.url, 'https://github.com/author/resource'); assert.equal(entry.owner, undefined);
  }
});

test('theme proposals preserve usage requirements without becoming executable Prompt catalog entries', () => {
  const theme = { ...draft, type: '主题', body: 'Theme plugin; DSH 0.1.5-rc.2 Web; appearance untested; disable to restore.', url: 'https://github.com/author/theme' };
  const metadata = { id: 'sample-theme', author: 'author', license: 'MIT' };
  const entry = JSON.parse(submissionFile(theme, metadata).content);
  assert.equal(entry.type, '主题'); assert.equal(entry.body, theme.body); assert.equal(entry.url, theme.url);
  assert.throws(() => submissionFile({ ...theme, url: '' }, metadata), /来源地址/);
  assert.throws(() => submissionFile({ ...theme, url: 'javascript:alert(1)' }, metadata), /HTTPS/);
  assert.throws(() => validatePrompt(entry), /Prompt/);
});
test('GitHub submissions preserve text and attribution without requiring a market account', () => {
  const file = submissionFile(draft, { id: 'my-prompt', author: 'author-name', license: 'CC0-1.0' });
  const entry = validatePrompt(JSON.parse(file.content));
  assert.equal(file.filename, 'my-prompt.json');
  assert.equal(entry.body, draft.body);
  assert.equal(entry.author, 'author-name');
  assert.throws(() => submissionFile(draft, { id: '../escape', author: 'user', license: 'CC0-1.0' }), /编号/);
  assert.throws(() => submissionFile(draft, { id: 123, author: 'user', license: 'CC0-1.0' }), /编号/);
  assert.throws(() => submissionFile(draft, { id: 'okay', author: 123, license: 'CC0-1.0' }), /作者/);
  assert.throws(() => submissionFile(draft, { id: 'okay', author: '', license: 'CC0-1.0' }), /作者/);
  assert.throws(() => submissionFile(draft, { id: 'okay', author: 'user', license: '' }), /许可/);
  assert.throws(() => submissionFile({ ...draft, url: 'javascript:alert(1)' }, { id: 'okay', author: 'user', license: 'CC0-1.0' }), /HTTPS/);
});
test('GitHub destination is explicit and never silently uses another market repository', () => {
  assert.equal(submissionUrl({ repository: null, branch: null }), null);
  assert.equal(submissionUrl({ repository: 'owner/repo', branch: 'main' }), 'https://github.com/owner/repo/upload/main/catalog/prompts');
  assert.throws(() => submissionUrl({ repository: 'https://evil.example/repo', branch: 'main' }), /仓库/);
});
test('curated entries retain the reviewed upstream author and exact original text', async () => {
  const entry = JSON.parse(await readFile(new URL('../../catalog/prompts/code-reviewer.json', import.meta.url), 'utf8'));
  assert.equal(validatePrompt(entry).author, 'rajudandigam');
  assert.equal(entry.provenance.commit, 'eaab6b14a085f3b9e4461be90367fcd9a16d3204');
  assert.match(entry.body, /^I want you to act as a Code reviewer/);
  assert.throws(() => validatePrompt({ ...entry, provenance: { ...entry.provenance, path: '../private' } }), /文件/);
});
