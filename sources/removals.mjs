import policy from './removals.json' with { type: 'json' };

export function removalList(entries) {
  if (!Array.isArray(entries) || new Set(entries.map(row => row.id)).size !== entries.length || !entries.every(row => /^source-[a-z0-9-]{1,100}$/.test(row.id) && typeof row.reason === 'string' && row.reason.trim() && row.reason.length <= 300 && /^https:\/\/github\.com\/QT7-C23\/DSH-Marketplace\/issues\/\d+$/.test(row.issue))) throw Error('资源移除记录格式无效');
  return entries;
}
if (policy.schema !== 1) throw Error('资源移除记录版本无效');
export const removals = removalList(policy.entries);
export function applyRemovals(result, records = removals) {
  const blocked = new Map(records.map(row => [row.id, row]));
  const removed = result.entries.filter(item => blocked.has(item.id));
  return { ...result, entries: result.entries.filter(item => !blocked.has(item.id)), ...(result.discovery ? { discovery: { ...result.discovery, excluded: [...result.discovery.excluded, ...removed.map(item => ({ name: item.bundle?.root.split('/').at(-1) || item.id, reason: `已确认移除：${blocked.get(item.id).reason}` }))] } } : {}) };
}
