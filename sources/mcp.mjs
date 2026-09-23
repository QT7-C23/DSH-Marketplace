import { createHash } from 'node:crypto';
import { MCP_SERVERS, SOURCE_DEFINITIONS } from './definitions.mjs';
import { sourceResource } from './contracts.mjs';
import { readUpstream } from './request.mjs';

const endpoint = 'https://registry.modelcontextprotocol.io/v0.1/servers';
const official = 'io.modelcontextprotocol.registry/official';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = value => Array.isArray(value) ? value.map(normalize) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;

function validatePage(page) {
  if (!object(page) || !Array.isArray(page.servers) || page.servers.length > 100 || !object(page.metadata) || !Number.isSafeInteger(page.metadata.count) || page.metadata.count !== page.servers.length) throw Error('MCP 目录页面格式异常或数量不一致');
  const cursor = page.metadata.nextCursor;
  if (cursor !== undefined && cursor !== null && typeof cursor !== 'string') throw Error('MCP 目录页面游标格式异常');
  for (const row of page.servers) {
    const server = row?.server;
    const meta = row?._meta?.[official];
    if (!object(row) || !object(server) || !nonempty(server.name) || !nonempty(server.version) || !object(meta) || !nonempty(meta.status) || typeof meta.isLatest !== 'boolean') throw Error('MCP 注册协议格式异常：缺少服务身份、版本或官方状态');
  }
  return cursor || '';
}

function httpAddress(value) {
  if (!nonempty(value) || /[\s\\\x00-\x1f\x7f]/.test(value)) return false;
  const literal = value.replace(/\{[^{}\s]+\}/g, '1');
  if (/[{}]/.test(literal)) return false;
  // A leading variable can supply the entire base URL; configuration resolves it later.
  if (value.startsWith('{')) return /^\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(value);
  if (!/^https?:\/\/[^/?#]/.test(value)) return false;
  try {
    // Check literal structure without reading variable defaults or changing the definition.
    const url = new URL(literal);
    return ['http:', 'https:'].includes(url.protocol);
  } catch { return false; }
}

export function supportedTransports(server) {
  const supported = new Set();
  for (const field of ['packages', 'remotes']) {
    if (server[field] === undefined) continue;
    if (!Array.isArray(server[field])) throw Error(`MCP ${field} 传输定义格式不支持`);
    for (const row of server[field]) {
      const local = field === 'packages';
      const transport = local ? row?.transport : row;
      if (!object(row) || !object(transport) || !nonempty(transport.type)) throw Error(`MCP ${field} 传输定义不完整`);
      if (local && (!nonempty(row.registryType) || !nonempty(row.identifier))) throw Error('MCP 包标识或注册类型不完整');
      if (['streamable-http', 'sse'].includes(transport.type) && !httpAddress(transport.url)) throw Error('MCP HTTP 传输地址缺失或格式不支持');
      if (transport.type === 'streamable-http' || (local && transport.type === 'stdio')) supported.add(transport.type);
    }
  }
  if (!supported.size) throw Error('MCP 没有当前宿主支持的 stdio 或 streamable-http 传输方式');
  return [...supported].sort();
}

function resource(server, meta) {
  if (meta.status !== 'active') throw Error(`MCP 官方状态为 ${meta.status.slice(0, 100)}，仅收录 active 服务`);
  if (!meta.isLatest) throw Error('MCP 注册项不是最新版本');
  if (server.name.length > 200 || !/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(server.name)) throw Error('MCP 名称不符合命名空间格式或超过 200 字符');
  if (['latest', '.', '..'].includes(server.version)) throw Error('MCP 注册项缺少可寻址的固定版本');
  if (!nonempty(server.description)) throw Error('MCP 用途必须是非空文本');
  if (server.title !== undefined && !nonempty(server.title)) throw Error('MCP 名称显示文本格式不支持');
  if (server.repository !== undefined && (!object(server.repository) || !nonempty(server.repository.url))) throw Error('MCP 仓库地址格式不支持');
  const transports = supportedTransports(server);
  const label = MCP_SERVERS.find(([name]) => name === server.name);
  const suffix = server.name.split('/')[1];
  const id = label ? `source-mcp-${suffix}` : `source-mcp-${suffix.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24)}-${hash(server.name)}`;
  const registryUrl = `${endpoint}/${encodeURIComponent(server.name)}/versions/${encodeURIComponent(server.version)}`;
  return sourceResource({
    id, type: 'MCP', title: label?.[1] || server.title || server.name,
    summary: label?.[2] || server.description, version: server.version,
    revision: 1, status: 'external', sourceId: 'mcp',
    source: SOURCE_DEFINITIONS.find(row => row.id === 'mcp').name,
    owner: 'source:mcp', author: server.name.split('/')[0], updatedAt: '',
    url: server.repository?.url || registryUrl, registryUrl,
    body: `${server.description}\n\n${JSON.stringify(server, null, 2)}`,
    serverDefinition: server,
    requirements: `支持 ${transports.join(' / ')}。按服务定义配置运行环境、身份与访问范围；获取定义不会自动连接服务或执行配置。许可尚未核验，请查看发布者说明。`,
  });
}

/** Read the complete public directory. No configuration is executed and no service is contacted. */
export async function readMcpDirectory(read = readUpstream) {
  const entries = [], excluded = [], candidates = new Map(), cursors = new Set();
  let cursor = '', pages = 0;
  do {
    if (pages === 1000) throw Error('MCP 目录超过 1000 页扫描上限，原目录保留');
    const query = new URLSearchParams({ limit: '100', version: 'latest' });
    if (cursor) query.set('cursor', cursor);
    // Read/protocol errors escape the per-record exclusion path to preserve the old snapshot.
    const page = await read(`${endpoint}?${query}`);
    pages++;
    cursor = validatePage(page);
    if (cursor) {
      if (cursors.has(cursor)) throw Error('MCP 目录分页游标重复，扫描未完成');
      cursors.add(cursor);
    }
    for (const row of page.servers) {
      const server = normalize(row.server);
      const { status, isLatest } = row._meta[official];
      const digest = hash(JSON.stringify({ server, status, isLatest }));
      if (candidates.has(server.name)) {
        if (candidates.get(server.name) !== digest) throw Error('MCP 同名服务的定义、版本或官方状态冲突，原目录保留');
        continue;
      }
      candidates.set(server.name, digest);
      try { entries.push(resource(server, { status, isLatest })); }
      catch (error) {
        // Oversize names remain identifiable while respecting the discovery report boundary.
        const name = server.name.length <= 300 ? server.name : `${server.name.slice(0, 280)}…#${hash(server.name).slice(0, 16)}`;
        excluded.push({ name, reason: error.message });
      }
    }
  } while (cursor);
  entries.sort((a, b) => a.id.localeCompare(b.id));
  excluded.sort((a, b) => a.name.localeCompare(b.name));
  // A content fingerprint, not an upstream snapshot token; independent of pagination and timestamps.
  const revision = `sha256:${hash(JSON.stringify([...candidates].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))}`;
  return { entries, discovery: { revision, scanned: candidates.size, excluded, pages, complete: true } };
}
