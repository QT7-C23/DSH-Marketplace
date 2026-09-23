/** @typedef {{scope: 'host'|'preset', name: string, isDefault: boolean, state: string}} PluginLocation */
/** @typedef {{revision: number, moduleName: string, detected: boolean, locations: PluginLocation[]}} PluginPresence */
/** @typedef {{schema: 1, complete: boolean, resources: Record<string, PluginPresence>}} AvailabilitySnapshot */
const states = ['pending', 'loading', 'active', 'failed', 'configured', 'disabled', 'conditional', 'unloading'];
/** @returns {AvailabilitySnapshot} */
export function availabilitySnapshot(value) {
  const object = item => item && typeof item === 'object' && !Array.isArray(item);
  const fail = () => { throw Error('暂时无法读取宿主插件状态'); };
  if (!object(value) || value.schema !== 1 || typeof value.complete !== 'boolean' || !object(value.resources)) fail();
  for (const row of Object.values(value.resources)) {
    if (!object(row) || !Number.isSafeInteger(row.revision) || row.revision < 0 || typeof row.moduleName !== 'string' || !row.moduleName || typeof row.detected !== 'boolean' || !Array.isArray(row.locations) || row.detected !== (row.locations.length > 0)) fail();
    for (const location of row.locations) {
      if (!object(location) || !['host', 'preset'].includes(location.scope) || typeof location.name !== 'string' || typeof location.isDefault !== 'boolean' || !states.includes(location.state)) fail();
    }
  }
  return value;
}
