import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SourceManager } from './manager.mjs';
import seed from './catalog.json' with { type: 'json' };

test('closing built-in discovery cancels upstream requests and does not publish shutdown failures', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-source-cancel-'));
  let signal;
  const manager = new SourceManager(folder, { request: async (_url, options) => {
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  const before = manager.resources();
  const pending = manager.sync('mcp');
  await new Promise(resolve => setImmediate(resolve));
  assert(signal, 'Discovery must use the provided request boundary');
  await manager.close(); await pending;
  assert.equal(signal.aborted, true);
  assert.deepEqual(manager.resources(), before);
  assert.equal(manager.status().find(row => row.id === 'mcp').state, 'bundled');
});

test('source updates deduplicate, persist revisions and retain old entries on failure', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-sources-'));
  const base = seed.find(row => row.id === 'skills').entries;
  let fail = false;
  let rows = structuredClone(base);
  let calls = 0;
  const manager = new SourceManager(folder, { adapters: { skills: async () => { calls++; await Promise.resolve(); if (fail) throw Error('upstream offline'); return { entries: rows }; } } });
  const initial = manager.resources().filter(item => item.sourceId === 'skills');
  await Promise.all([manager.sync('skills'), manager.sync('skills')]);
  assert.equal(calls, 1);
  assert.equal(manager.resources().filter(item => item.sourceId === 'skills').length, base.length);
  assert.equal(manager.resources().find(item => item.id === base[0].id).revision, initial[0].revision);
  rows = rows.map((item,index) => index ? item : { ...item, body: 'Updated upstream body' });
  await manager.sync('skills');
  const updated = manager.resources().find(item => item.id === base[0].id);
  assert.equal(updated.revision, initial[0].revision + 1);
  fail = true;
  await manager.sync('skills');
  assert.equal(manager.status().find(row => row.id === 'skills').state, 'stale');
  assert.match(manager.status().find(row => row.id === 'skills').error, /offline/);
  assert.equal(manager.resources().find(item => item.id === base[0].id).body, updated.body);
  const reopened = new SourceManager(folder);
  assert.equal(reopened.resources().find(item => item.id === base[0].id).revision, updated.revision);
  assert.ok(JSON.parse(await readFile(path.join(folder, 'catalog-cache.json'), 'utf8')).history[base[0].id]);
  fail = false; rows = rows.slice(1); await manager.sync('skills');
  rows = base; await manager.sync('skills');
  assert.ok(manager.resources().find(item => item.id === base[0].id).revision > updated.revision);
  await assert.rejects(manager.sync('arbitrary-url'), /来源/);
});

test('automatic discovery observes its interval, persists pause, backs off failures and retains the catalog', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-auto-sources-'));
  const entries = structuredClone(seed.find(row => row.id === 'skills').entries);
  let now = Date.parse('2030-01-01T00:00:00Z'), calls = 0, fail = false;
  const read = async () => { calls++; if (fail) throw Error('offline'); return { entries, discovery: { commit: 'a'.repeat(40), scanned: entries.length, excluded: [] } }; };
  const manager = new SourceManager(folder, { now: () => now, adapters: { skills: read } });
  await Promise.all([manager.syncDue(), manager.syncDue()]);
  assert.equal(calls, 1);
  assert.equal(manager.status().find(row => row.id === 'skills').automatic, true);
  await manager.syncDue(); assert.equal(calls, 1);
  now += 6 * 60 * 60 * 1000;
  fail = true; await manager.syncDue(); assert.equal(calls, 2);
  assert.equal(manager.resources().filter(item => item.sourceId === 'skills').length, entries.length);
  assert.equal(manager.status().find(row => row.id === 'skills').state, 'stale');
  now += 29 * 60 * 1000; await manager.syncDue(); assert.equal(calls, 2);
  now += 60 * 1000; fail = false; await manager.syncDue(); assert.equal(calls, 3);
  manager.setAutomatic('skills', false);
  const reopened = new SourceManager(folder, { now: () => now + 24 * 60 * 60 * 1000, adapters: { skills: read } });
  await reopened.syncDue(); assert.equal(calls, 3);
  assert.equal(reopened.status().find(row => row.id === 'skills').automatic, false);
  reopened.setAutomatic('skills', true); await reopened.syncDue(); assert.equal(calls, 4);
  assert.throws(() => manager.setAutomatic('dsh', true), /自动发现/);
  assert.throws(() => manager.setAutomatic('skills', 'yes'), /自动发现/);
});

test('a repository-only commit change does not replace a Skill version, while actual file changes do', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-source-content-'));
  let rows = structuredClone(seed.find(row => row.id === 'skills').entries);
  const manager = new SourceManager(folder, { adapters: { skills: async () => ({ entries: rows }) } });
  const original = manager.resources().find(item => item.sourceId === 'skills');
  rows = rows.map(item => ({ ...item, version: 'bbbbbbbbbbbb', url: item.url.replace(item.bundle.commit, 'b'.repeat(40)), bundle: { ...item.bundle, commit: 'b'.repeat(40) } }));
  await manager.sync('skills');
  assert.deepEqual(manager.resources().find(item => item.id === original.id), original);
  rows = rows.map(item => item.id === original.id ? { ...item, body: item.body + '\nChanged instructions' } : item);
  await manager.sync('skills');
  assert.equal(manager.resources().find(item => item.id === original.id).revision, original.revision + 1);
  const reopened = new SourceManager(folder);
  assert.equal(reopened.resources().find(item => item.id === original.id).revision, original.revision + 1);
});

test('confirmed resource removals remain hidden after upstream rediscovery and restart', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-source-removal-'));
  const entries = structuredClone(seed.find(row => row.id === 'skills').entries);
  const removals = [{ id: entries[0].id, reason: 'Author requested removal', issue: 'https://github.com/QT7-C23/DSH-Marketplace/issues/1' }];
  const manager = new SourceManager(folder, { removals, adapters: { skills: async () => ({ entries }) } });
  assert(!manager.resources().some(item => item.id === entries[0].id));
  await manager.sync('skills');
  assert(!manager.resources().some(item => item.id === entries[0].id));
  const reopened = new SourceManager(folder, { removals });
  assert(!reopened.resources().some(item => item.id === entries[0].id));
  await assert.rejects(reopened.download(entries[0].id, entries[0].revision), /不可用/);
});

test('closing the source manager drains active work and prevents future checks', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-source-close-'));
  let resolve;
  const manager = new SourceManager(folder, { adapters: { skills: () => new Promise(done => { resolve = done; }) } });
  const pending = manager.sync('skills');
  let closed = false;
  const closing = manager.close().then(() => { closed = true; });
  await Promise.resolve(); assert.equal(closed, false);
  resolve({ entries: seed.find(row => row.id === 'skills').entries });
  await pending; await closing;
  await assert.rejects(manager.sync('skills'), /关闭/);
});
