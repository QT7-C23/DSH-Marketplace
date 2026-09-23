/** @typedef {{count:number|null,start:string,end:string,checkedAt:string,state:'fresh'|'stale'|'unavailable'}} NpmCount */
const packageName = value => typeof value === 'string' && value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function npmPackageOf(resource) {
  const name = resource.packageRef?.name || (resource.bundle?.kind === 'npm-package' ? resource.bundle.name : null);
  return packageName(name) ? name : null;
}
/** @returns {Record<string,NpmCount>} */
export function npmSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid npm statistics');
  for (const [name, row] of Object.entries(value)) {
    if (!packageName(name) || !row || !['fresh', 'stale', 'unavailable'].includes(row.state)) throw Error('Invalid npm statistics');
    if (row.state === 'unavailable' ? row.count !== null || row.start !== '' || row.end !== '' || row.checkedAt !== ''
      : !Number.isSafeInteger(row.count) || row.count < 0 || !date(row.start) || !date(row.end) || row.start > row.end
        || Date.parse(row.end) - Date.parse(row.start) > 32 * 86400000 || !Number.isFinite(Date.parse(row.checkedAt))) throw Error('Invalid npm statistics');
  }
  return value;
}
