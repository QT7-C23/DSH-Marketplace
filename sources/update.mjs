import { writeFile } from 'node:fs/promises';
import { adapters } from './adapters.mjs';
import { sourceDiscovery } from './contracts.mjs';
import { applyRemovals } from './removals.mjs';
import { releaseSeed } from './release-seed.mjs';

// Explicit maintainer refresh. Runtime source updates use their own durable cache.
const rows = await Promise.all(Object.entries(adapters).map(async ([id, read]) => {
  const full = applyRemovals(sourceDiscovery(await read()));
  const result = releaseSeed(id, full);
  const checkedAt = new Date().toISOString();
  return { id, checkedAt, ...result, entries: result.entries.map(item => ({ ...item, updatedAt: checkedAt })) };
}));
await writeFile(new URL('./catalog.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n');
for (const row of rows) console.log(`${row.id}: ${row.entries.length} verified source entries`);
