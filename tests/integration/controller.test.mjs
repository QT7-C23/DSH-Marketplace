import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket as create, httpPort, savedUpdates } from '../../src/plugin/market/controller.ts';
import { browserLocalPort } from '../../src/plugin/market/local.mjs';
import { githubPrompts } from '../../catalog/resources.mjs';
import { downloadFile } from '../../src/community/download.mjs';
import { SOURCE_DEFINITIONS } from '../../src/sources/definitions.mjs';

const createMarket = (port, local = localPort()) => create({ readStars: async () => ({}), readSources: async () => [], syncSource: async () => [], setSourceAutomatic: async () => [], ...port }, local);
const data = () => ({ schema: 2, catalog: [], stats: {} });
const editor = { type: 'Prompt', title: '私有内容', summary: '尚未发布', body: '仅我可见', version: '1', url: '' };
test('source alias changes offer an explicit reviewed replacement without duplicate favorites or lost ratings', async () => {
  const old = { ...githubPrompts[0], id: 'source-npm-old', revision: 20, version: '1.0.0' };
  const canonical = { ...old, id: 'source-community-current', aliasIds: [old.id], revision: 1, version: '1.1.0' };
  const model = createMarket({ read: async () => ({ ...data(), catalog: [canonical] }) });
  model.saveLocal(old); model.rateLocal(old.id, 4); await model.refresh();
  assert.deepEqual(model.getSnapshot().local.saved, [old]);
  assert.deepEqual(savedUpdates([old], [canonical]), [{ saved: old, latest: canonical }]);
  model.saveLocal(canonical);
  assert.deepEqual(model.getSnapshot().local.saved, [old], 'saving an alias is not automatic version replacement');
  model.saveLocal(canonical, true);
  assert.deepEqual(model.getSnapshot().local.saved, [canonical]);
  assert.equal(model.getSnapshot().local.ratings[canonical.id], 4);
});
test('updating a saved MCP summary preserves full content after later withdrawal and failed hydration', async () => {
  const original = { ...githubPrompts[0], type: 'MCP', id: 'source-mcp-kept', body: 'original', serverDefinition: { name: 'org/server', version: '1.0.0' } };
  const current = { ...original, revision: 2, body: 'new instructions', serverDefinition: { name: 'org/server', version: '2.0.0' } };
  const { serverDefinition, ...summary } = current;
  summary.body = ''; summary.hasDetails = true;
  let live = [summary], failed = false;
  const model = createMarket({ read: async () => ({ ...data(), catalog: live }), readResource: async () => { if (failed) throw Error('offline'); return current; } });
  model.saveLocal(original); await model.refresh();
  failed = true;
  assert.equal(await model.saveLocal(summary, true), false);
  assert.deepEqual(model.getSnapshot().local.saved[0], original);
  failed = false;
  assert.equal(await model.saveLocal(summary, true), true);
  assert.deepEqual(model.getSnapshot().local.saved[0], current);
  live = []; await model.refresh();
  await model.open(model.getSnapshot().local.saved[0]);
  assert.equal(model.getSnapshot().detail.body, 'new instructions');
  assert.deepEqual(JSON.parse((await model.download(current)).content), current.serverDefinition);
});
test('leaving a pending detail restores navigation and discards its late result', async () => {
  let finish;
  const item = { ...githubPrompts[0], hasDetails: true };
  const model = createMarket({ readResource: () => new Promise(resolve => { finish = resolve; }) });
  const pending = model.open(item);
  assert.equal(model.getSnapshot().detailLoading, true);
  model.navigate('saved');
  assert.equal(model.getSnapshot().detailLoading, false);
  finish(item); await pending;
  assert.equal(model.getSnapshot().view, 'saved');
  assert.equal(model.getSnapshot().detail, null);
});
test('changing visible resources during a slow Star request loads the newly visible page afterwards', async () => {
  let finish;
  const seen = [];
  const model = createMarket({ read: async () => data(), readStars: async ids => {
    seen.push(ids);
    if (seen.length === 1) await new Promise(resolve => { finish = resolve; });
    return {};
  } });
  const first = model.refreshStars(['first-page']);
  await model.refreshStars(['second-page']);
  finish(); await first;
  assert.deepEqual(seen, [['first-page'], ['second-page']]);
});
test('language, attribution and personal ratings persist without backend identity writes', async () => {
  const writes = [];
  const local = localPort();
  const model = createMarket({ read: async () => ({ schema: 2, catalog: [], stats: {} }), write: async command => writes.push(command) }, local);
  model.change({ ...editor, author: 'original-author', resourceId: 'my-prompt', license: 'MIT', language: 'ja' });
  model.saveLocalDraft(); model.setLanguage('ja-JP'); model.rateLocal('github-code-reviewer', 4);
  assert.equal(model.auth, undefined);
  const reloaded = createMarket({ read: async () => ({ schema: 2, catalog: [], stats: {} }) }, local);
  assert.equal(reloaded.getSnapshot().local.language, 'ja-JP');
  assert.equal(reloaded.getSnapshot().editor.author, 'original-author');
  assert.equal(reloaded.getSnapshot().local.ratings['github-code-reviewer'], 4);
  assert.equal(model.rateLocal('github-code-reviewer', 9), false);
  assert.equal(model.setLanguage('unsupported'), false);
  model.rateLocal('github-code-reviewer', null);
  assert.equal(model.getSnapshot().local.ratings['github-code-reviewer'], undefined);
  assert.deepEqual(writes, []);
});

function localPort() {
  let value = { schema: 1, saved: [], draft: null };
  return { read: () => structuredClone(value), write: next => { value = structuredClone(next); } };
}

test('guest favorites and drafts persist locally through reload without identity writes', async () => {
  const local = localPort();
  const writes = [];
  let next = data(null);
  const port = { read: async () => next, write: async command => { writes.push(command); next = data('b'); } };
  const item = { ...editor, id: 'public-resource', owner: 'a', author: 'a', revision: 1, status: 'published', source: '社区', updatedAt: '' };
  const model = createMarket(port, local);
  await model.refresh();
  assert.equal(model.saveLocal(item), true);
  model.change(editor);
  assert.equal(model.saveLocalDraft(), true);
  assert.deepEqual(writes, []);
  const reloaded = createMarket(port, local);
  reloaded.edit();
  assert.equal(reloaded.getSnapshot().editor.body, editor.body);
  await reloaded.refresh();
  assert.equal(reloaded.getSnapshot().view, 'publish');
  assert.equal(reloaded.getSnapshot().editor.body, editor.body);
  assert.equal(reloaded.getSnapshot().local.saved[0].revision, 1);
  assert.deepEqual(writes, []);
  const newer = { ...item, revision: 2, version: '2', body: 'new' };
  reloaded.saveLocal(newer);
  assert.equal(reloaded.getSnapshot().local.saved[0].body, editor.body, 'Saving twice never silently updates');
  reloaded.saveLocal(newer, true);
  assert.equal(reloaded.getSnapshot().local.saved[0].body, 'new');
  reloaded.removeLocal(item.id);
  assert.equal(local.read().saved.length, 0);
});

test('failed local storage leaves drafts dirty and favorites unchanged', () => {
  const model = createMarket({ read: async () => data(null), write: async () => ({}) }, { read: () => ({ schema: 1, saved: [], draft: null }), write: () => { throw Error('Storage full'); } });
  model.change(editor);
  assert.equal(model.saveLocalDraft(), false);
  assert.equal(model.getSnapshot().dirty, true);
  assert.match(model.getSnapshot().error, /Storage full/);
  assert.equal(model.getSnapshot().local.draft, null);
});

test('browser local storage rejects corrupt data without overwriting it', () => {
  let raw = '{broken';
  const port = browserLocalPort(() => ({ getItem: () => raw, setItem: (_, value) => { raw = value; } }));
  assert.throws(() => port.read(), /原始数据已保留/);
  assert.throws(() => port.write({ schema: 1, saved: [], draft: null }), /原始数据已保留/);
  assert.equal(raw, '{broken');
  raw = null;
  port.write({ schema: 1, saved: [], draft: editor });
  assert.equal(port.read().draft.body, editor.body);
});

test('another tab cannot silently overwrite newly saved local data', () => {
  let raw = null;
  const storage = () => ({ getItem: () => raw, setItem: (_, value) => { raw = value; } });
  const first = browserLocalPort(storage);
  const second = browserLocalPort(storage);
  first.read(); second.read();
  first.write({ schema: 1, saved: [], draft: editor });
  assert.throws(() => second.write({ schema: 1, saved: [], draft: null }), /其他页面/);
  assert.equal(first.read().draft.body, editor.body);
});

test('a withdrawn local copy can be exported without a community write or counter', async () => {
  const writes = [];
  const model = createMarket({ read: async () => data(null), write: async value => { writes.push(value); } });
  const item = { ...editor, id: 'saved-resource', owner: 'a', author: 'a', revision: 1, status: 'published', source: '社区', updatedAt: '' };
  model.saveLocal(item);
  await model.refresh();
  assert.match((await model.download(item)).content, /仅我可见/);
  assert.deepEqual(writes, []);
});

test('unsaved edits survive leaving and reopening the sharing view', async () => {
  const model = createMarket({ read: async () => ({ ...data(), draft: { ...editor, title: '服务器旧草稿' } }), write: async () => ({}) });
  await model.refresh();
  model.change({ ...editor, title: '刚刚输入的内容' });
  model.navigate('sources');
  model.edit();
  assert.equal(model.getSnapshot().editor.title, '刚刚输入的内容');
  assert.equal(model.getSnapshot().dirty, true);
});

test('ambiguous writes reuse the request id; edits use a new id', async () => {
  const commands = [];
  const model = createMarket({ read: async () => data(), write: async command => { commands.push(command); if (commands.length === 1) throw new TypeError('Failed to fetch'); return {}; } });
  assert.equal(await model.write({ action: 'publish', value: editor }, '已发布'), false);
  assert.equal(await model.write({ action: 'publish', value: editor }, '已发布'), true);
  assert.equal(commands[0].requestId, commands[1].requestId);
  await model.write({ action: 'publish', value: { ...editor, title: '新内容' } }, '已发布');
  assert.notEqual(commands[2].requestId, commands[0].requestId);
});

test('empty host errors and malformed JSON become actionable community errors', async t => {
  const responses = [new Response('', { status: 503 }), new Response('{broken', { status: 200, headers: { 'content-type': 'application/json' } })];
  t.mock.method(globalThis, 'fetch', async () => responses.shift());
  const port = httpPort();
  await assert.rejects(port.read(), /市场响应格式异常.*重试/);
  await assert.rejects(port.read(), /市场响应格式异常.*重试/);
});

test('source HTTP responses reach the controller and reject incomplete source lists', async t => {
  const rows = SOURCE_DEFINITIONS.map(value => ({ ...value, state: 'bundled', count: 5, checkedAt: '', lastSuccess: '', error: '' }));
  const calls = [];
  let response = rows;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json(response);
  });
  const port = httpPort();
  const model = createMarket(port);
  await model.readSources();
  assert.deepEqual(model.getSnapshot().sources, rows);
  assert.equal(calls[0].url, '/api/community/sources/read');
  response = rows.map(row => ({ ...row, state: 'fresh' }));
  assert.deepEqual(await port.syncSource('dsh'), response);
  assert.equal(calls[1].url, '/api/community/sources');
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { sourceId: 'dsh' });
  response = rows.slice(1);
  await assert.rejects(port.readSources(), /来源状态不完整/);
  response = [];
  await assert.rejects(port.read(), /市场响应格式异常/);
});

test('curated downloads use server counters with retry identity while saved old versions stay local', async () => {
  const item = githubPrompts[0];
  const writes = [];
  const model = createMarket({ read: async () => ({ ...data(null), catalog: githubPrompts }), write: async command => { writes.push(command); if (writes.length === 1) throw Error('Lost response'); return downloadFile(item); } });
  await model.refresh();
  assert.equal(await model.download(item), null);
  assert.match((await model.download(item)).content, new RegExp(item.author));
  assert.equal(writes.length, 2);
  assert.equal(writes[0].action, 'download');
  assert.equal(writes[0].requestId, writes[1].requestId);
  model.saveLocal({ ...item, revision: 0, body: 'Saved old body' });
  assert.match((await model.download({ ...item, revision: 0 })).content, /Saved old body/);
  assert.equal(writes.length, 2);
});

test('slow and failed Star reads never block resources or discard the previous dated count', async () => {
  let resolve;
  const model = createMarket({ read: async () => data(null), write: async () => ({}), readStars: () => new Promise(done => { resolve = done; }) });
  const pending = model.refreshStars();
  await model.refresh();
  assert.equal(model.getSnapshot().data.schema, 2);
  assert.equal(model.getSnapshot().starsLoading, true);
  resolve({ 'f/prompts.chat': { count: 12, checkedAt: '2026-09-13T00:00:00.000Z', state: 'fresh' } });
  await pending;
  assert.equal(model.getSnapshot().stars['f/prompts.chat'].count, 12);
  let fail = false;
  const stale = createMarket({ read: async () => data(null), write: async () => ({}), readStars: async () => { if (fail) throw Error('offline'); return { 'f/prompts.chat': { count: 12, checkedAt: '2026-09-13T00:00:00.000Z', state: 'fresh' } }; } });
  await stale.refreshStars(); fail = true; await stale.refreshStars();
  assert.equal(stale.getSnapshot().starsLoading, false);
  assert.match(stale.getSnapshot().starsError, /offline/);
  assert.equal(stale.getSnapshot().stars['f/prompts.chat'].count, 12);
  assert.equal(stale.getSnapshot().stars['f/prompts.chat'].state, 'stale');
});

test('background source updates refresh discoverable resources without replacing an edited draft', async () => {
  let current = '2030-01-01T00:00:00Z', reads = 0;
  const rows = () => SOURCE_DEFINITIONS.map(row => ({ ...row, count: 1, state: 'fresh', checkedAt: current, lastSuccess: current, error: '', automatic: row.id === 'skills' }));
  const model = createMarket({ read: async () => { reads++; return data(null); }, readSources: async () => rows(), setSourceAutomatic: async (id, enabled) => rows().map(row => row.id === id ? { ...row, automatic: enabled } : row) });
  await model.refresh(); await model.readSources();
  model.change(editor);
  current = '2030-01-02T00:00:00Z';
  await model.readSources();
  assert.equal(reads, 2);
  assert.equal(model.getSnapshot().editor.body, editor.body);
  assert.equal(model.getSnapshot().dirty, true);
  await model.setSourceAutomatic('skills', false);
  assert.equal(model.getSnapshot().sources.find(row => row.id === 'skills').automatic, false);
});
