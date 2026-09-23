import { CommunityError } from '../../community/contracts.mjs';

/** @typedef {{read: () => Promise<{host: Array<object>, presets: Array<object>}>}} PluginInventoryPort */
const phases = ['pending', 'loading', 'active', 'failed', 'configured', 'unloading'];
const stateOf = row => row.enabled === false ? 'disabled' : row.enabled === 'conditional' ? 'conditional' : phases[row.fiberState] || 'configured';

/** Project only catalog matches; configuration, paths and expressions never cross HTTP. */
export class PluginAvailability {
  /** @param {() => Array<object>} catalog @param {PluginInventoryPort} port */
  constructor(catalog, port) { this.catalog = catalog; this.port = port; }
  async read() {
    let inventory;
    try { inventory = await this.port.read(); }
    catch { throw new CommunityError(503, '暂时无法读取宿主插件状态'); }
    const catalog = this.catalog();
    const rows = [
      ...inventory.host.map(row => ({ row, scope: 'host', name: '', isDefault: false })),
      ...inventory.presets.flatMap(preset => preset.rows.map(row => ({ row, scope: 'preset', name: preset.name || preset.id, isDefault: preset.isDefault === true }))),
    ];
    const resources = Object.fromEntries(catalog.flatMap(resource => {
      const parent = resource.type === 'Slash' ? catalog.find(item => item.id === resource.parentId) : resource;
      if (!parent || !['插件', '主题'].includes(parent.type)) return [];
      const moduleName = parent.packageRef?.name || (parent.bundle?.kind === 'npm-package' ? parent.bundle.name : null);
      if (!moduleName) return [];
      const locations = rows.filter(({ row }) => row.moduleName === moduleName).map(({ row, scope, name, isDefault }) => ({ scope, name, isDefault, state: stateOf(row) }));
      return [[resource.id, { revision: resource.revision, moduleName, detected: locations.length > 0, locations }]];
    }));
    return { schema: 1, complete: !inventory.presets.some(preset => preset.broken), resources };
  }
}

/** Only documented Loader and AgentPresets reads belong at this host boundary. */
export function hostInventoryPort(ctx) {
  return { read: async () => {
    const host = [...ctx.loader.entries()].filter(entry => !entry.options.group).map(entry => ({ moduleName: entry.options.name, enabled: !entry.disabled, fiberState: entry.fiber?.state }));
    const presets = await ctx.get('agentPresets')?.compositionInventory() || [];
    return { host, presets };
  } };
}
