import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../community/http.mjs';

test('extension management stays behind the same-origin JSON boundary and never leaks internal failures', async () => {
  const calls = [];
  const extensions = { read: async () => ({ schema: 1, items: [] }), prepare: async command => { calls.push(command); return { id: 'preview' }; }, execute: async () => { throw Error('private profile path'); } };
  const handle = createHandler(null, undefined, null, null, null, null, extensions);
  const url = 'http://127.0.0.1:8888/api/community/extensions';
  const request = (origin, command, headers = {}) => new Request(url, { method: 'POST', headers: { origin, 'x-community-request': '1', 'content-type': 'application/json', ...headers }, body: JSON.stringify(command) });
  assert.deepEqual(await (await handle(new Request(url))).json(), { schema: 1, items: [] });
  assert.equal((await handle(request('https://outside.test', { action: 'prepare-install' }))).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await handle(request('http://127.0.0.1:8888', { action: 'prepare-install' }, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await handle(request('http://127.0.0.1:8888', { action: 'prepare-install', spec: 'test@1.0.0' }))).status, 200);
  assert.equal(calls.length, 1);
  const failure = await handle(request('http://127.0.0.1:8888', { action: 'execute' }));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /private|path/);
});
