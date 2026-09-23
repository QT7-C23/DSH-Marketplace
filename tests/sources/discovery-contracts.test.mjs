import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import seed from '../../catalog/source-seed.json' with { type: 'json' };
import { fingerprint } from '../../src/sources/cache.mjs';
import { sourceDiscovery, sourceResource } from '../../src/sources/contracts.mjs';
import { SourceManager } from '../../src/sources/manager.mjs';

test('paginated discovery reports carry an upstream revision and complete accounting', () => {
  assert.doesNotThrow(() => sourceDiscovery({ entries: [], discovery: { revision: 'registry:2026-09-14', scanned: 1, excluded: [{ name: 'org/server', reason: 'Unsupported transport' }], pages: 2, complete: true } }));
  assert.throws(() => sourceDiscovery({ entries: [], discovery: { revision: 'registry:1', scanned: 1, excluded: [], pages: 1, complete: true } }), /数量/);
  assert.throws(() => sourceDiscovery({ entries: [], discovery: { revision: 'registry:1', scanned: 0, excluded: [], pages: 1, complete: false } }), /报告/);
});

test('community npm references accept pinned releases but reject command fragments and mutable versions', () => {
  const base = { ...seed[0].entries[0], id: 'source-npm-example', sourceId: 'npm', bundle: undefined, packageRef: { name: '@author/dsh-example', version: '1.2.3' } };
  assert.doesNotThrow(() => sourceResource(base));
  for (const packageRef of [{ name: 'pkg;exec', version: '1.0.0' }, { name: 'pkg', version: 'latest' }, { name: '../pkg', version: '1.0.0' }]) assert.throws(() => sourceResource({ ...base, packageRef }), /发布包/);
});

test('old source caches gain new sources without dropping existing versions or pause settings', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-source-migrate-'));
  const rows = structuredClone(seed.filter(row => ['dsh', 'skills', 'mcp'].includes(row.id))).map(row => ({ ...row, lastSuccess: row.checkedAt, state: 'fresh', error: '', automatic: false }));
  const history = Object.fromEntries(rows.flatMap(row => row.entries.map(item => [item.id, { fingerprint: fingerprint(item), revision: item.revision }])));
  await writeFile(path.join(folder, 'catalog-cache.json'), JSON.stringify({ schema: 1, rows, history }));
  const manager = new SourceManager(folder);
  assert(manager.status().some(row => row.id === 'npm'));
  assert(manager.status().some(row => row.id === 'community'));
  assert.equal(manager.status().find(row => row.id === 'skills').automatic, false);
  for (const row of rows) for (const item of row.entries) {
    const restored = manager.resources().find(value => value.id === item.id);
    assert(restored, 'Existing resource identities must survive migration');
    assert.deepEqual(Object.fromEntries(Object.keys(item).map(key => [key, restored[key]])), item);
  }
  await manager.close();
});
