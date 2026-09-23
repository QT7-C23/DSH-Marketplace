import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseSeed } from '../../src/sources/release-seed.mjs';

test('release size is bounded without misreporting a starter catalog as a complete scan', () => {
  const entries = Array.from({ length: 500 }, (_, i) => ({ id: String(i), serverDefinition: { name: 'org/' + i } }));
  entries.push({ id: 'known', serverDefinition: { name: 'com.microsoft/microsoft-learn-mcp' } });
  const result = { entries, discovery: { scanned: 501, excluded: [], complete: true } };
  const seed = releaseSeed('mcp', result);
  assert.equal(seed.entries.length, 100);
  assert(seed.entries.some(item => item.id === 'known'));
  assert.equal(seed.discovery, undefined);
  assert.equal(result.entries.length, 501);
  assert.equal(result.discovery.complete, true);
  assert.equal(releaseSeed('npm', result), result);
});
