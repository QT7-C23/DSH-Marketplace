const precedence = ['dsh', 'community', 'skills', 'skills-openai', 'mcp', 'npm'];
export function resourceIdentity(item) {
  const name = item.packageRef?.name || (item.bundle?.kind === 'npm-package' && item.bundle.name);
  if (name && ['插件', '主题'].includes(item.type)) return `package:${name}`;
  if (item.type === 'MCP' && item.serverDefinition?.name) return `mcp:${item.serverDefinition.name}`;
  if (item.bundle?.kind === 'github-skill') return `skill:${item.bundle.repository.toLowerCase()}/${item.bundle.root}`;
  if (item.type === 'Slash' && item.parentId && /^\/[a-z][a-z0-9-]*$/.test(item.command || item.title)) return `slash:${item.parentId}:${item.command || item.title}`;
  return `resource:${item.id}`;
}

/** Keep native identities and reviewed pins; aliases preserve references to other directories. */
export function mergeSourceResources(items) {
  const resources = mergeGroups(items.filter(item => item.type !== 'Slash'));
  const canonical = new Map(resources.flatMap(item => [item.id, ...(item.aliasIds || [])].map(id => [id, item.id])));
  const commands = items.filter(item => item.type === 'Slash').map(item => ({ ...item, parentId: canonical.get(item.parentId) || item.parentId }));
  return [...resources, ...mergeGroups(commands)];
}

function mergeGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const key = resourceIdentity(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()].map(rows => {
    const sorted = [...rows].sort((a, b) => {
      const rank = value => { const index = precedence.indexOf(value.sourceId); return index < 0 ? precedence.length : index; };
      return rank(a) - rank(b) || a.id.localeCompare(b.id);
    });
    const winner = sorted[0];
    const aliases = [...new Set(rows.flatMap(row => [row.id, ...(row.aliasIds || [])]))].filter(id => id !== winner.id).sort();
    return { ...winner, ...(aliases.length ? { aliasIds: aliases } : {}) };
  });
}
