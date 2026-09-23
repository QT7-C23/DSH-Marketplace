import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Community } from '../community/service.mjs';
import { createHandler } from '../community/http.mjs';
import { exportFile } from '../community/contracts.mjs';
import seed from './catalog.json' with { type: 'json' };

test('large catalog lists omit MCP definitions while selected resource reads retain the exact version', async t => {
  const resource = seed.find(row => row.id === 'mcp').entries[0];
  const service = new Community(':memory:', [resource]); t.after(() => service.close());
  const handle = createHandler(service);
  const list = await (await handle(new Request('http://localhost/api/community/read'))).json();
  assert.equal(list.catalog[0].serverDefinition, undefined);
  assert.equal(list.catalog[0].body, '');
  assert.equal(list.catalog[0].hasDetails, true);
  const full = await handle(new Request(`http://localhost/api/community/resource?id=${resource.id}&revision=${resource.revision}`));
  assert.equal(full.status, 200); assert.deepEqual(await full.json(), resource);
  assert.equal((await handle(new Request(`http://localhost/api/community/resource?id=${resource.id}&revision=999999`))).status, 409);
});

test('repository Star requests pass only bounded selected resource IDs to the reader', async t => {
  const service = new Community(':memory:'); t.after(() => service.close());
  let selected;
  const handle = createHandler(service, async ids => { selected = ids; return {}; });
  assert.equal((await handle(new Request('http://localhost/api/community/stars?ids=one,two'))).status, 200);
  assert.deepEqual(selected, ['one', 'two']);
  assert.equal((await handle(new Request('http://localhost/api/community/stars?ids=' + Array.from({ length: 61 }, (_, i) => 'id-' + i).join(',')))).status, 400);
  assert.equal((await handle(new Request('http://localhost/api/community/stars?ids=https://private.example'))).status, 400);
});

test('source download HTTP counts prepared archives once and rejects cross-origin sync', async t => {
  const item = seed.find(row => row.id === 'dsh').entries.find(item => item.bundle);
  const service = new Community(':memory:', [item]); t.after(() => service.close());
  let fail = false;
  const prepared = { filename: `${item.id}.tgz`, mime: 'application/gzip', encoding: 'base64', content: Buffer.from('archive bytes').toString('base64') };
  const sources = { status: () => [{ id: 'dsh' }], sync: async () => [], download: async () => { if (fail) throw Error('network failed'); return prepared; } };
  const handle = createHandler(service, async () => ({}), sources);
  const origin = 'http://localhost';
  const post = (command, route = '/api/community', from = origin) => handle(new Request(origin + route, { method: 'POST', headers: { origin: from, 'content-type': 'application/json', 'x-community-request': '1' }, body: JSON.stringify(command) }));
  assert.equal((await post({ sourceId: 'dsh' }, '/api/community/sources', 'https://evil.example')).status, 403);
  assert.equal((await post({ sourceId: 'unknown' }, '/api/community/sources')).status, 400);
  const command = { action: 'download', format: 'package', id: item.id, baseRevision: item.revision, requestId: randomUUID() };
  assert.deepEqual(exportFile(await (await post(command)).json()), prepared);
  await post(command);
  assert.equal(service.snapshot().stats[item.id].downloads, 1);
  fail = true;
  assert.equal((await post({ ...command, requestId: randomUUID() })).status, 500);
  assert.equal(service.snapshot().stats[item.id].downloads, 1);
  service.replaceCatalog([{ ...item, revision: 2, version: 'newer', body: 'Changed upstream' }]);


  assert.throws(() => exportFile({ ...prepared, filename: '../escape.tgz' }), /格式/);
  assert.throws(() => exportFile({ ...prepared, content: 'not base64' }), /格式/);
});

test('automatic discovery settings are same-origin, typed and never enable another action', async t => {
  const service = new Community(':memory:'); t.after(() => service.close());
  let enabled = true, checked = 0;
  const sources = {
    status: () => [{ id: 'skills', automatic: enabled }],
    setAutomatic: (id, value) => { assert.equal(id, 'skills'); enabled = value; },
    syncDue: async () => { checked++; },
    sync: async () => { throw Error('settings must not silently become a manual sync'); },
  };
  const handle = createHandler(service, async () => ({}), sources);
  const post = (command, origin = 'http://localhost') => handle(new Request('http://localhost/api/community/sources', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-community-request': '1' }, body: JSON.stringify(command) }));
  assert.equal((await post({ sourceId: 'skills', action: 'setAutomatic', enabled: false }, 'https://other.example')).status, 403);
  assert.equal(enabled, true);
  assert.equal((await post({ sourceId: 'skills', action: 'setAutomatic', enabled: 'false' })).status, 400);
  assert.equal((await post({ sourceId: 'skills', action: 'install' })).status, 400);
  assert.equal((await post({ sourceId: 'skills', action: 'setAutomatic', enabled: false })).status, 200);
  assert.equal(enabled, false); assert.equal(checked, 0);
  assert.equal((await post({ sourceId: 'skills', action: 'setAutomatic', enabled: true })).status, 200);
  assert.equal(enabled, true); assert.equal(checked, 1);
});
