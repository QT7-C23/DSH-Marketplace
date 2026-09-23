import policy from './removals.json' with { type: 'json' };
import { resourceIdentity } from './merge.mjs';

const resourceId = /^(?:source|github)-[a-z0-9-]{1,100}$/;
const packageName = '(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*';
const packageKey = new RegExp(`^package:${packageName}$`);
const slashKey = new RegExp(`^slash:(?:package:${packageName}|resource:(?:source|github)-[a-z0-9-]{1,100}):/[a-z][a-z0-9-]{0,63}$`);
function validIdentity(key) {
  return typeof key === 'string' && key.length <= 600 && (
    packageKey.test(key) || slashKey.test(key)
    || /^mcp:[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(key)
    || /^skill:[\w.-]+\/[\w.-]+\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_-]+$/.test(key) && !key.split('/').some(part => part === '.' || part === '..')
    || key.startsWith('resource:') && resourceId.test(key.slice(9)));
}
export function removalList(entries) {
  if (!Array.isArray(entries) || entries.length > 10000 || new Set(entries.map(row => row?.id)).size !== entries.length || !entries.every(row => row && resourceId.test(row.id) && typeof row.reason === 'string' && row.reason.trim() && row.reason.length <= 300 && /^https:\/\/github\.com\/QT7-C23\/DSH-Marketplace\/issues\/\d+$/.test(row.issue)
    && (row.identities === undefined || Array.isArray(row.identities) && row.identities.length > 0 && row.identities.length <= 8 && new Set(row.identities).size === row.identities.length && row.identities.every(validIdentity)))) throw Error('资源移除记录格式无效');
  return entries.map(row => ({ ...row, ...(row.identities ? { identities: [...new Set(row.identities.map(key => key.replace(/^skill:([^/]+)\/([^/]+)\//, (_, owner, repo) => `skill:${owner.toLowerCase()}/${repo.toLowerCase()}/`)))] } : {}) }));
}
if (policy.schema !== 1) throw Error('资源移除记录版本无效');
export const removals = removalList(policy.entries);
const indexOf = entries => new Map(entries.flatMap(item => [item.id, ...(item.aliasIds || [])].map(id => [id, item])));
function identity(item, index) {
  const command = item.command || item.title;
  if (item.type === 'Slash' && item.parentId && /^\/[a-z][a-z0-9-]{0,63}$/.test(command)) {
    const parent = index.get(item.parentId);
    const parentKey = parent ? resourceIdentity(parent) : `resource:${item.parentId}`;
    return `slash:${parentKey}:${command}`;
  }
  return resourceIdentity(item);
}

/** Resolve legacy IDs while the source entry still exists; retain the binding across refreshes. */
export function bindRemovals(entries, records, previous = []) {
  const index = indexOf(entries), old = new Map(previous.map(row => [row.id, row]));
  return removalList(records.map(row => {
    const item = index.get(row.id);
    const identities = [...new Set([...(row.identities || []), ...(old.get(row.id)?.identities || []), ...(item ? [identity(item, index)] : [])])];
    return { ...row, ...(identities.length ? { identities } : {}) };
  }));
}

/** Apply after alias merging as well as to source reports; withdrawn parents hide their commands. */
export function applyRemovals(result, records = removals, context = result.entries) {
  const index = indexOf(context), blockedIds = new Map(records.map(row => [row.id, row]));
  const blockedKeys = new Map(records.flatMap(row => (row.identities || []).map(key => [key, row])));
  const reason = item => blockedKeys.get(identity(item, index)) || [item.id, ...(item.aliasIds || [])].map(id => blockedIds.get(id)).find(Boolean);
  const removed = [], entries = [];
  for (const item of result.entries) {
    const parent = item.type === 'Slash' && index.get(item.parentId);
    const rule = reason(item) || (parent && reason(parent));
    if (rule) removed.push({ name: item.id, reason: `已确认移除：${rule.reason}` }); else entries.push(item);
  }
  return { ...result, entries, ...(result.discovery ? { discovery: { ...result.discovery, excluded: [...result.discovery.excluded, ...removed] } } : {}) };
}
