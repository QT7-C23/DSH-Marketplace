import { MCP_SERVERS } from './definitions.mjs';

/** The installed cache is complete; the distributable carries a small MCP starter catalog. */
export function releaseSeed(id, result) {
  if (id !== 'mcp' || result.entries.length <= 100) return result;
  const known = new Set(MCP_SERVERS.map(([name]) => name));
  const preferred = result.entries.filter(item => known.has(item.serverDefinition?.name));
  const remaining = result.entries.filter(item => !known.has(item.serverDefinition?.name));
  // A partial release seed must never carry a complete-scan report.
  const { discovery, ...rest } = result;
  return { ...rest, entries: [...preferred, ...remaining].slice(0, 100) };
}
