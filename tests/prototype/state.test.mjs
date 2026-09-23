import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition, catalog, fillTemplate, isInstalled, parseState } from '../../src/prototype/state.mjs';

const input = { type: 'Prompt', title: '测试周报', summary: '整理工作进展', body: '周期：{{周期}}；记录：{{记录}}；再看：{{周期}}', url: '', version: '1.0.0' };

test('drafts remain private; publication requires usable content', () => {
  let state = transition(initialState(), { type: 'draft', value: input });
  assert.equal(catalog(state).some(item => item.title === input.title), false);
  assert.throws(() => transition(state, { type: 'publish', value: { ...input, body: '' } }), /内容/);
  state = transition(state, { type: 'publish', value: input, id: 'community-1' });
  assert.equal(catalog(state).find(item => item.id === 'community-1').owner, 'reader');
});

test('another demo identity cannot overwrite or withdraw an author publication', () => {
  let state = transition(initialState(), { type: 'publish', value: input, id: 'community-1' });
  state = transition(state, { type: 'actor', value: 'author' });
  assert.throws(() => transition(state, { type: 'publish', id: 'community-1', value: input }), /作者/);
  assert.throws(() => transition(state, { type: 'withdraw', id: 'community-1' }), /作者/);
});

test('author updates do not overwrite saved copies; withdrawn content remains saved', () => {
  let state = transition(initialState(), { type: 'publish', value: input, id: 'community-1' });
  state = transition(state, { type: 'actor', value: 'author' });
  state = transition(state, { type: 'save', id: 'community-1' });
  state = transition(state, { type: 'actor', value: 'reader' });
  state = transition(state, { type: 'publish', id: 'community-1', value: { ...input, body: '新版', version: '1.1.0' } });
  assert.equal(state.saved.author[0].body, input.body);
  state = transition(state, { type: 'withdraw', id: 'community-1' });
  assert.equal(catalog(state).some(item => item.id === 'community-1'), false);
  assert.equal(state.saved.author[0].body, input.body);
});

test('template rendering validates all fields and replaces repeats literally', () => {
  assert.throws(() => fillTemplate(input.body, { 周期: '本周', 记录: '' }), /记录/);
  assert.equal(fillTemplate(input.body, { 周期: '$&', 记录: '<script>x</script>' }), '周期：$&；记录：<script>x</script>；再看：$&');
});

test('using a prompt appends to and preserves the existing task draft', () => {
  let state = transition(initialState(), { type: 'task', value: '我已有的记录' });
  state = transition(state, { type: 'appendTask', value: '新的提示词' });
  assert.equal(state.tasks.reader, '我已有的记录\n\n新的提示词');
});

test('Slash and plugin share one demo installation and restore together', () => {
  let state = transition(initialState(), { type: 'install', id: 'plan-command' });
  assert.equal(isInstalled(state, 'plan-plugin'), true);
  assert.equal(isInstalled(state, 'plan-command'), true);
  assert.equal(Object.keys(state.installs.reader).length, 1);
  state = transition(state, { type: 'uninstall', id: 'plan-plugin' });
  assert.equal(isInstalled(state, 'plan-command'), false);
  state = transition(state, { type: 'restore' });
  assert.equal(isInstalled(state, 'plan-command'), true);
});

test('source errors keep previous successful evidence without claiming fresh sync', () => {
  let state = transition(initialState(), { type: 'sourceSuccess', value: { count: 12, sampleFound: true, checkedAt: '2026-09-13T12:00:00Z' } });
  state = transition(state, { type: 'sourceError', value: '网络不可用' });
  assert.equal(state.source.count, 12);
  assert.equal(state.source.status, 'error');
  assert.equal(state.source.checkedAt, '2026-09-13T12:00:00Z');
});

test('invalid publication URLs and corrupt storage are rejected', () => {
  assert.throws(() => transition(initialState(), { type: 'publish', value: { ...input, type: 'MCP', url: 'javascript:alert(1)' } }), /HTTPS/);
  assert.throws(() => parseState('{"schema":1}'), /存储/);
  assert.throws(() => parseState('not-json'), /存储/);
  assert.deepEqual(parseState(JSON.stringify(initialState())), initialState());
});

test('malformed persisted collections are rejected before rendering and valid snapshots survive', () => {
  for (const mutate of [
    state => { state.installs.reader = null; },
    state => { state.publications = [null]; },
    state => { state.saved.reader = [{ id: 'broken', type: 'Prompt' }]; },
    state => { state.history.reader = [{ label: 'bad', snapshot: null }]; },
    state => { state.feedback = { broken: [null] }; },
  ]) {
    const value = initialState(); mutate(value);
    assert.throws(() => parseState(JSON.stringify(value)), /存储/);
  }
  let state = transition(initialState(), { type: 'publish', value: input, id: 'community-1' });
  state = transition(state, { type: 'save', id: 'community-1' });
  state = transition(state, { type: 'install', id: 'plan-command' });
  state = transition(state, { type: 'feedback', id: 'community-1', value: '补充一个填写示例' });
  assert.deepEqual(parseState(JSON.stringify(state)), state);
});
