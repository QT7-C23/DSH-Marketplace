import test from 'node:test';
import assert from 'node:assert/strict';
import { documentResult, documentLink, translationModels, translationResult } from './plugin/market/documentation.mjs';
import { preferredDocuments, markdownBody } from '../sources/document-language.mjs';

test('README selection prefers the interface language, then English, while retaining original bytes', () => {
  const files = ['README.de.md', 'SKILL.md', 'README.md', 'README.ja.md', 'README.zh-CN.md', 'README.en.md'].map(name => ({ name }));
  assert.equal(preferredDocuments(files, 'zh-CN')[0].name, 'README.zh-CN.md');
  assert.equal(preferredDocuments(files, 'ja-JP')[0].name, 'README.ja.md');
  assert.equal(preferredDocuments(files, 'en-US')[0].name, 'README.en.md');
  assert.equal(preferredDocuments(files.filter(file => !file.name.includes('zh')), 'zh-CN')[0].name, 'README.en.md');
  for (const name of ['README_CN.md', 'README.zh_CN.md', 'README.中文.md', 'README.zh-Hant.md']) assert.equal(preferredDocuments([{ name: 'README.md' }, { name }], 'zh-CN')[0].name, name);
  const raw = '---\ndescription: author metadata\n---\n# 正文\n\n---\nKeep this rule.';
  assert.equal(markdownBody(raw), '# 正文\n\n---\nKeep this rule.');
  assert.equal(markdownBody('---\nUnclosed metadata'), '---\nUnclosed metadata');
  assert.equal(markdownBody('---\n# Introduction\n---\nBody'), '---\n# Introduction\n---\nBody', 'ordinary Markdown rules are not metadata');
  assert.equal(files[0].name, 'README.de.md', 'selection does not mutate source order');
});

test('translation responses cannot cross document or model boundaries or invent token usage', () => {
  const request = { id: 'one', revision: 1, file: 'README.md', target: 'zh-CN', provider: 'test', model: 'chosen' };
  const result = { schema: 1, ...request, body: '中文', usage: null };
  assert.equal(translationResult(result, request).usage, null);
  for (const patch of [{ id: 'other' }, { revision: 2 }, { file: 'SKILL.md' }, { model: 'other' }, { target: 'ja-JP' }, { usage: { inputTokens: -1, outputTokens: 0 } }]) assert.throws(() => translationResult({ ...result, ...patch }, request), /响应/);
  assert.throws(() => translationModels({ providers: [{ id: 'test', name: 'test', models: null }], defaultSelection: null }), /响应/);
});

test('the browser accepts valid absolute source documents and resolves relative links safely', () => {
  const url = 'https://github.com/author/repo/blob/' + 'a'.repeat(40) + '/docs/README.md';
  const result = { schema: 1, state: 'available', scope: 'resource', versionMatch: true, checkedAt: '', files: [{ name: 'README.md', body: '# Read me', url, commit: 'a'.repeat(40) }] };
  assert.equal(documentResult(result), result);
  assert.equal(documentLink('./guide.md', url), url.replace('README.md', 'guide.md'));
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/private', 'https://name:secret@example.com']) assert.equal(documentLink(value, url), '');
  assert.throws(() => documentResult({ ...result, files: [{ ...result.files[0], url: 'javascript:alert(1)' }] }), /文档/);
});
