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
