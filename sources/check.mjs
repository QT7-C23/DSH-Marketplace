import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import rows from './catalog.json' with { type: 'json' };
import { sourceResource, sourceIds, sourceDiscovery } from './contracts.mjs';
import { removals } from './removals.mjs';

assert.deepEqual(rows.map(row => row.id).sort(), [...sourceIds].sort());
const seen = new Set();
for (const row of rows) {
  sourceDiscovery(row);
  assert.ok(Number.isFinite(Date.parse(row.checkedAt)));
  for (const item of row.entries) {
    sourceResource(item);
    assert(!removals.some(removed => removed.id === item.id), 'Confirmed removal must not be bundled');
    assert.equal(item.sourceId, row.id);
    assert.ok(!seen.has(item.id), `Duplicate resource: ${item.id}`); seen.add(item.id);
    if (item.bundle?.kind === 'github-skill') {
      const file = item.bundle.files.find(file => file.path === item.bundle.root + '/SKILL.md');
      assert.equal(createHash('sha1').update(`blob ${Buffer.byteLength(item.body)}\0`).update(item.body).digest('hex'), file.sha, 'Skill preview must retain upstream text');
    }
  }
}
for (const item of rows.flatMap(row => row.entries)) if (item.parentId) assert.ok(seen.has(item.parentId), 'Slash parent must be discoverable');
console.log(`Source catalog: ${seen.size} entries, file integrity and parent links validated.`);
