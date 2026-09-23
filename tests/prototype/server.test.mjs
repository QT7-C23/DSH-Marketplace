import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../src/server/server.mjs';
import { discover, UPSTREAM } from '../../src/server/discovery.mjs';

test('source adapter reports directory evidence and rejects malformed/error responses', async () => {
  let received;
  const result = await discover(async url => { received = url; return { ok: true, json: async () => [{ type: 'dir', name: 'internal-comms' }, { type: 'file', name: 'README.md' }] }; });
  assert.equal(received, UPSTREAM);
  assert.equal(result.count, 1);
  assert.equal(result.sampleFound, true);
  await assert.rejects(discover(async () => ({ ok: true, json: async () => ({ message: 'error' }) })), /格式/);
  await assert.rejects(discover(async () => ({ ok: false, status: 403 })), /403/);
});

test('local server does not expose repository files, write endpoints, or arbitrary upstream URLs', async t => {
  const server = createServer({ discovery: async () => { throw Error('限流'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/api/publish`, { method: 'POST' })).status, 405);
  const failed = await fetch(`${base}/api/discovery?url=http://example.com`);
  assert.equal(failed.status, 502);
  assert.equal((await failed.json()).error, '限流');
});
