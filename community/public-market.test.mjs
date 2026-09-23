import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Community } from './service.mjs';
import { createHandler } from './http.mjs';
import { githubPrompts } from '../catalog/resources.mjs';
import { registryEntries } from '../sources/community.mjs';
import sourceCatalog from '../sources/catalog.json' with { type: 'json' };

test('visible npm statistics resolve only catalog identities and never return executable definitions', async t => {
  const item = { ...githubPrompts[0], packageRef: { name: '@example/plugin', version: '1.0.0' }, serverDefinition: { secret: 'not-for-metrics' } };
  const service = new Community(':memory:', [item]); t.after(() => service.close());
  assert.deepEqual(service.statisticsResources([item.id, 'unknown']), [{ id: item.id, url: item.url, packageRef: item.packageRef }]);
  const calls = [];
  const handle = createHandler(service, undefined, null, null, null, null, null, null, null, null, async ids => { calls.push(ids); return { marker: 'npm' }; });
  const response = await handle(new Request('http://localhost/api/community/npm-downloads?ids=' + item.id));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { marker: 'npm' });
  assert.deepEqual(calls, [[item.id]]);
  assert.equal((await handle(new Request('http://localhost/api/community/npm-downloads?ids=https://evil.example'))).status, 400);
});

test('community-reviewed MCP entries export the exact server definition through HTTP', async t => {
  const original = sourceCatalog.find(row => row.id === 'mcp').entries[0];
  const [item] = registryEntries({ schema: 1, entries: [{ schema: 1, id: 'reviewed-server', type: 'MCP', title: 'Reviewed server', summary: 'Server description', body: 'Publisher information', author: 'original-author', license: 'MIT', language: 'en', version: original.version, url: original.url, serverDefinition: original.serverDefinition }], removals: [] }).entries;
  const service = new Community(':memory:', [item]); t.after(() => service.close());
  const response = await createHandler(service)(new Request('http://localhost/api/community', { method: 'POST', headers: { origin: 'http://localhost', 'x-community-request': '1', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'download', id: item.id, baseRevision: item.revision, requestId: randomUUID() }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse((await response.json()).content), original.serverDefinition);
});

test('the npm HTTP boundary forwards browser cancellation to the statistics reader', async t => {
  const service = new Community(':memory:', githubPrompts); t.after(() => service.close());
  const abort = new AbortController(); let received;
  const handle = createHandler(service, undefined, null, null, null, null, null, null, null, null, (_ids, signal) => {
    received = signal;
    return new Promise(resolve => signal.addEventListener('abort', () => resolve({}), { once: true }));
  });
  const pending = handle(new Request('http://localhost/api/community/npm-downloads?ids=' + githubPrompts[0].id, { signal: abort.signal }));
  assert.equal(received.aborted, false); abort.abort();
  assert.equal((await pending).status, 200); assert.equal(received.aborted, true);
});

test('public catalog keeps durable download counts without accounts or publication endpoints', async t => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'dsh-public-')), 'market.sqlite');
  const item = githubPrompts[0];
  const service = new Community(file, githubPrompts); t.after(() => service.close());
  assert.equal(service.snapshot().schema, 2);
  assert.equal(service.snapshot().user, undefined);
  const handle = createHandler(service);
  const post = (command, origin = 'http://localhost', extra = {}) => handle(new Request('http://localhost/api/community', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-community-request': '1', ...extra }, body: JSON.stringify(command) }));
  for (const action of ['login', 'register', 'logout', 'publish', 'rate', 'save', 'draft', 'feedback']) assert.equal((await post({ action, username: 'someone', password: 'not-a-secret', requestId: randomUUID() })).status, 400);
  const command = { action: 'download', id: item.id, baseRevision: item.revision, requestId: randomUUID() };
  assert.equal((await post(command, 'https://other.example')).status, 403);
  const response = await post(command); assert.equal(response.status, 200); assert.equal(response.headers.get('set-cookie'), null);
  assert.match((await response.json()).content, new RegExp(item.author));
  await post(command); assert.equal(service.snapshot().stats[item.id].downloads, 1);
  assert.equal((await post({ ...command, baseRevision: 99 })).status, 409);
  const ja = await post({ action: 'register' }, 'http://localhost', { 'x-market-language': 'ja-JP' });
  assert.equal((await ja.json()).error, 'この操作には対応していません。');
  service.close();
  const reopened = new Community(file, githubPrompts); t.after(() => reopened.close());
  reopened.mutate(command); assert.equal(reopened.snapshot().stats[item.id].downloads, 1);
  reopened.replaceCatalog([]); assert.throws(() => reopened.mutate(command), /版本|不可用/);
  const db = new DatabaseSync(file); t.after(() => db.close());
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='users'").get(), undefined);
});

test('opening an older database preserves private tables without exposing them', t => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'dsh-legacy-')), 'market.sqlite');
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE drafts(user_id TEXT,data TEXT); INSERT INTO drafts VALUES('old','private draft'); CREATE TABLE catalog_downloads(resource_id TEXT PRIMARY KEY,total INTEGER NOT NULL);");
  db.prepare('INSERT INTO catalog_downloads VALUES(?,?)').run(githubPrompts[0].id, 7); db.close();
  const service = new Community(file, githubPrompts); t.after(() => service.close());
  assert.equal(service.snapshot().stats[githubPrompts[0].id].downloads, 7);
  assert.doesNotMatch(JSON.stringify(service.snapshot()), /private draft/);
  const reader = new DatabaseSync(file); t.after(() => reader.close());
  assert.equal(reader.prepare('SELECT data FROM drafts').get().data, 'private draft');
});
