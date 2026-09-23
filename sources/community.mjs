import { validateSubmission } from '../catalog/contracts.mjs';
import { readUpstream, verifySkillBytes } from './request.mjs';
import { sourceDiscovery, sourceResource } from './contracts.mjs';
import { removalList, bindRemovals, applyRemovals } from './removals.mjs';
import { PLUGINS } from './definitions.mjs';
import { supportedTransports } from './mcp.mjs';

/** Only a merged, schema-checked repository index is eligible for community discovery. */
export function registryEntries(index) {
  if (index?.schema !== 1 || !Array.isArray(index.entries) || index.entries.length > 10000) throw Error('社区索引格式不完整');
  removalList(index.removals);
  const ids = new Set(), entries = [], excluded = [];
  for (const value of index.entries) {
    validateSubmission(value);
    const id = value.type === 'Prompt' ? `github-${value.id}` : `source-community-${value.id}`;
    if (ids.has(id)) throw Error('社区索引有重复资源编号');
    ids.add(id);
    const item = sourceResource({
      id, type: value.type, title: value.title, summary: value.summary, body: value.body, url: value.url, author: value.author, license: value.license, language: value.language, version: value.version,
      revision: 1, status: 'external', sourceId: 'community', source: 'DSH Marketplace GitHub', owner: `github:${value.author}`, updatedAt: '',
      requirements: typeof value.requirements === 'string' ? value.requirements : '由社区提交并经仓库审核收录。使用前请阅读原作者说明与依赖要求。',
      ...(value.packageRef ? { packageRef: value.packageRef } : {}), ...(value.bundle ? { bundle: value.bundle } : {}),
      ...(value.serverDefinition ? { serverDefinition: value.serverDefinition } : {}), ...(value.parentId ? { parentId: value.parentId } : {}),
      ...(value.command ? { command: value.command } : {}), ...(value.provenance ? { provenance: value.provenance } : {}),
    });
    if (item.type === 'Slash' && (!/^source-[a-z0-9-]{1,100}$/.test(item.parentId) || !/^\/[a-z][a-z0-9-]{0,63}$/.test(item.command))) throw Error('Slash 必须声明所属插件和明确命令名称');
    if (['插件', '主题'].includes(item.type) && (!item.packageRef || item.packageRef.version !== item.version)) throw Error('插件和主题必须提供与展示版本一致的固定 npm 包信息');
    if (item.type === 'Skill' && item.bundle?.kind !== 'github-skill') throw Error('Skill 必须提供固定提交、原始文件和许可清单');
    if (item.type === 'MCP') {
      const server = item.serverDefinition;
      if (!server || !/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(server.name) || server.name.length > 200 || server.version !== item.version || /^(latest|\.|\.\.)$/i.test(server.version)) throw Error('MCP 必须提供完整、版本一致的服务定义');
      supportedTransports(server);
    }
    entries.push(item);
  }
  const parents = new Set([...PLUGINS.map(([name]) => `source-dsh-${name}`), ...entries.filter(item => item.type === '插件').map(item => item.id)]);
  for (const item of entries) if (item.type === 'Slash' && !parents.has(item.parentId)) throw Error('Slash 所属插件必须同时收录，或指向已固定的官方插件');
  const removals = bindRemovals(entries, index.removals);
  const result = applyRemovals({ entries, discovery: { excluded } }, removals);
  return { entries: result.entries, excluded: result.discovery.excluded, removals };
}

export async function readCommunityIndex(read = readUpstream) {
  const base = 'https://api.github.com/repos/QT7-C23/DSH-Marketplace';
  const head = await read(`${base}/commits/main`);
  if (!/^[a-f0-9]{40}$/.test(head?.sha)) throw Error('社区索引提交信息不完整');
  const file = await read(`${base}/contents/catalog/registry.json?ref=${head.sha}`);
  if (file.encoding !== 'base64' || typeof file.content !== 'string' || !Number.isSafeInteger(file.size) || file.size > 2 * 1024 * 1024) throw Error('社区索引文件格式不完整或过大');
  const bytes = verifySkillBytes(file, Buffer.from(file.content, 'base64'));
  const index = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const result = registryEntries(index);
  return sourceDiscovery({ entries: result.entries, removals: result.removals, discovery: { commit: head.sha, scanned: index.entries.length, excluded: result.excluded, complete: true } });
}
