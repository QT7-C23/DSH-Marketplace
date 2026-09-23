/** @typedef {{count:number|null,checkedAt:string,state:'fresh'|'stale'|'unavailable'}} RepositoryStar */
/** @param {string} address @returns {string|null} */
export function repositoryOf(address) {
  try {
    const url = new URL(address);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port) return null;
    const [owner, repo] = url.pathname.slice(1).split('/');
    if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(owner) || !/^[a-z\d_.-]{1,100}$/i.test(repo) || /^\.{1,2}$/.test(repo)) return null;
    return `${owner}/${repo.replace(/\.git$/, '')}`.toLowerCase();
  } catch { return null; }
}
/** @param {unknown} value @returns {Record<string,RepositoryStar>} */
export function starSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Star 数据格式异常');
  for (const [repo, item] of Object.entries(value)) {
    if (repositoryOf(`https://github.com/${repo}`) !== repo || !item || !['fresh', 'stale', 'unavailable'].includes(item.state)) throw Error('Star 来源或状态异常');
    if (item.state === 'unavailable' ? item.count !== null || item.checkedAt !== '' : !Number.isSafeInteger(item.count) || item.count < 0 || typeof item.checkedAt !== 'string' || !Number.isFinite(Date.parse(item.checkedAt))) throw Error('Star 数值或时间异常');
  }
  return /** @type {Record<string,RepositoryStar>} */ (value);
}
/** @param {import('./contracts.mjs').Resource[]} items
 * @param {string} sort
 * @param {Record<string,import('./contracts.mjs').Stats>} stats
 * @param {Record<string,RepositoryStar>} stars
 */
export function sortResources(items, sort, stats, stars) {
  const value = item => sort === 'stars' ? stars[repositoryOf(item.url)]?.count ?? -1 : sort === 'saves' ? stats[item.id]?.saves ?? -1 : sort === 'rating' ? stats[item.id]?.ratingAverage ?? -1 : stats[item.id]?.downloads ?? -1;
  return [...items].sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title, 'zh-CN') : sort === 'recent' ? b.updatedAt.localeCompare(a.updatedAt) : value(b) - value(a));
}
