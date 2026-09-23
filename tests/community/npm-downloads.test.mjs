import test from 'node:test';
import assert from 'node:assert/strict';
import { NpmDownloads } from '../../src/community/npm-downloads.mjs';
import { npmPackageOf, npmSnapshot } from '../../src/community/npm-metrics.mjs';

const resource = name => ({ packageRef: { name, version: '1.0.0' } });
const point = (name, count = 0) => ({ package: name, downloads: count, start: '2026-08-14', end: '2026-09-12' });
test('npm counts use exact scoped package identity and preserve real zero with dates', async () => {
  const calls = [];
  const reader = new NpmDownloads({ request: async url => { calls.push(url); return Response.json(point('@example/plugin')); } });
  const result = await reader.read([resource('@example/plugin'), resource('@example/plugin'), { url: 'https://github.com/unrelated/repo' }]);
  assert.deepEqual(calls, ['https://api.npmjs.org/downloads/point/last-month/%40example%2Fplugin']);
  assert.equal(result['@example/plugin'].count, 0); assert.equal(result['@example/plugin'].start, '2026-08-14');
  assert.equal(result['@example/plugin'].state, 'fresh');
  assert.deepEqual(npmSnapshot(result), result);
  assert.equal(npmPackageOf({ url: 'https://npmjs.com/package/guess' }), null);
  assert.equal(npmPackageOf(resource('https://evil.example/a')), null);
});
test('failed npm refresh preserves dated stale values; unavailable is never a zero', async () => {
  let time = 0, fails = false;
  const reader = new NpmDownloads({ now: () => time, request: async () => fails ? new Response('', { status: 429 }) : Response.json(point('example', 12)) });
  await reader.read([resource('example')]); time += 25 * 3600000; fails = true;
  const stale = (await reader.read([resource('example')])).example;
  assert.equal(stale.state, 'stale'); assert.equal(stale.count, 12); assert.equal(stale.end, '2026-09-12');
  const missing = (await reader.read([resource('other')])).other;
  assert.equal(missing.state, 'unavailable'); assert.equal(missing.count, null);
});
test('invalid upstream identity, count and date ranges are refused', async () => {
  for (const patch of [{ package: 'wrong' }, { downloads: -1 }, { downloads: 1.2 }, { start: 'bad' }, { end: '2026-08-13' }, { start: '2026-02-30' }]) {
    const reader = new NpmDownloads({ request: async () => Response.json({ ...point('example'), ...patch }) });
    assert.equal((await reader.read([resource('example')])).example.state, 'unavailable');
  }
});
test('concurrent visible-page queries deduplicate packages and bound upstream concurrency', async () => {
  let active = 0, maximum = 0, requests = 0;
  const reader = new NpmDownloads({ request: async url => {
    requests++; active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return Response.json(point(decodeURIComponent(url.split('/').at(-1)), 4));
  } });
  const resources = Array.from({ length: 12 }, (_, i) => resource('package-' + i));
  await Promise.all([reader.read(resources), reader.read(resources)]);
  assert.equal(requests, 12); assert(maximum <= 4);
});

test('abandoned pages cancel queued and active requests without delaying the current page', async () => {
  const started = [], completed = [];
  const reader = new NpmDownloads({ request: (url, { signal }) => {
    const name = decodeURIComponent(url.split('/').at(-1)); started.push(name);
    if (name === 'current') return Promise.resolve(Response.json(point(name, 3)));
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { completed.push(name); reject(signal.reason); }, { once: true });
      if (signal.aborted) reject(signal.reason);
    });
  } });
  const abort = new AbortController();
  const calls = Array.from({ length: 96 }, (_, i) => reader.read([resource('old-' + i)], abort.signal));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(started.length, 4);
  abort.abort();
  const current = await reader.read([resource('current')]); await Promise.all(calls);
  assert.deepEqual(started, ['old-0', 'old-1', 'old-2', 'old-3', 'current']);
  assert.equal(completed.length, 4); assert.equal(current.current.count, 3);
});

test('one caller cancelling does not cancel a shared count needed by another caller', async () => {
  let resolve, signal, calls = 0;
  const reader = new NpmDownloads({ request: (_url, options) => { calls++; signal = options.signal; return new Promise(done => { resolve = done; }); } });
  const abort = new AbortController();
  const first = reader.read([resource('shared')], abort.signal), second = reader.read([resource('shared')]);
  abort.abort(); assert.equal(signal.aborted, false);
  resolve(Response.json(point('shared', 9)));
  assert.equal((await first).shared.count, null); assert.equal((await second).shared.count, 9); assert.equal(calls, 1);
});

test('pending work is bounded across HTTP requests and close drains it', async () => {
  let started = 0;
  const reader = new NpmDownloads({ request: (_url, { signal }) => { started++; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); } });
  const pending = Array.from({ length: 128 }, (_, i) => reader.read([resource('bounded-' + i)]));
  assert.equal((await reader.read([resource('overflow')])).overflow.state, 'unavailable');
  await reader.close(); await Promise.all(pending);
  assert.equal(started, 4); assert.equal((await reader.read([resource('closed')])).closed.count, null);
});
