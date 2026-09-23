import { createHash } from 'node:crypto';
import { sourceIds, sourceResource, discoveryReport } from './contracts.mjs';
import { removalList } from './removals.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const legacyFingerprint = item => hash({ ...item, revision: 0, updatedAt: '' });
export function fingerprint(item) {
  const value = { ...item, revision: 0, updatedAt: '' };
  if (item.bundle?.kind === 'github-skill') {
    value.version = '';
    value.url = item.url.replace(item.bundle.commit, '{commit}');
    value.bundle = { ...item.bundle, commit: '' };
  }
  return hash(value);
}

/** Validate old snapshots before upgrading their fingerprint representation in memory. */
export function restoreCache(cached) {
  if (cached.schema !== 1 || !Array.isArray(cached.rows) || !cached.history || new Set(cached.rows.map(row => row.id)).size !== cached.rows.length || !['dsh', 'skills', 'mcp'].every(id => cached.rows.some(row => row.id === id))) throw Error('目录缓存格式异常');
  cached.removals = removalList(cached.removals ?? []);
  for (const row of cached.rows) {
    if (!sourceIds.includes(row.id) || !Array.isArray(row.entries)) throw Error('目录缓存来源异常');
    if (row.automatic !== undefined && typeof row.automatic !== 'boolean') throw Error('目录自动检查设置异常');
    if (row.nextAutomaticAt !== undefined && !Number.isFinite(Date.parse(row.nextAutomaticAt))) throw Error('目录检查时间异常');
    if (row.discovery) discoveryReport(row.discovery);
    for (const item of row.entries) {
      sourceResource(item);
      const previous = cached.history[item.id];
      if (item.sourceId !== row.id || !previous || ![fingerprint(item), legacyFingerprint(item)].includes(previous.fingerprint) || previous.revision !== item.revision) throw Error('目录缓存版本异常');
      previous.fingerprint = fingerprint(item);
    }
  }
  return cached;
}
