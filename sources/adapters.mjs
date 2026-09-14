import { PLUGINS, MCP_SERVERS, SOURCE_DEFINITIONS } from './definitions.mjs';
import { sourceResource } from './contracts.mjs';
import { readUpstream } from './request.mjs';
import { readSkills } from './skills.mjs';
export { readSkills } from './skills.mjs';

const resource = (sourceId, value) => sourceResource({ revision: 1, status: 'external', sourceId, source: SOURCE_DEFINITIONS.find(row => row.id === sourceId).name, updatedAt: '', owner: `source:${sourceId}`, ...value });
export async function readDsh(read = readUpstream) {
  const items = [];
  for (const [suffix, title, summary, command] of PLUGINS) {
    const name = `@deepseek-ai/dsh-${suffix}`;
    const data = await read(`https://registry.npmjs.org/${encodeURIComponent(name)}/0.1.5-rc.2`);
    if (data.name !== name || data.version !== '0.1.5-rc.2' || !data.repository?.directory || !data.dist?.tarball || !data.dist?.integrity) throw Error('DSH 发布包或版本不匹配');
    const id = `source-dsh-${suffix}`;
    const url = `https://github.com/deepseek-ai/deepseek-harness/tree/c291e7961a515f6d7af9304e7fd1d257929aef26/${data.repository.directory}`;
    const packageInfo = { name, version: data.version, license: data.license, peerDependencies: data.peerDependencies || {} };
    items.push(resource('dsh', { id, type: '插件', title, summary, author: 'deepseek-ai', version: data.version, url, body: `${summary}\n\n${data.description || ''}\n\n${JSON.stringify(packageInfo, null, 2)}`, license: data.license || '见发布包', requirements: '对应 DSH 0.1.5-rc.2；下载发布包后仍需配置依赖与宿主插件。此页面未执行安装。', bundle: { kind: 'npm-package', name, version: data.version, url: data.dist.tarball, integrity: data.dist.integrity } }));
    if (command) items.push(resource('dsh', { id: `source-slash-${command.slice(1)}`, type: 'Slash', title: command, summary, author: 'deepseek-ai', version: data.version, url, parentId: id, body: `${command} 由 ${name} 提供。\n\n${command === '/plan' ? '进入规划：/plan\n退出规划：/plan off。规划指导不等于工具权限限制。' : command === '/compact' ? '不带参数执行 /compact 可请求压缩历史。压缩会改变会话历史，是否调用模型由压缩后端决定。' : '使用 /goal 查看目标状态。创建、编辑、暂停和恢复操作由宿主目标系统处理。'}\n\n当前入口用于发现与查看所属插件，尚未从市场执行命令。`, requirements: `依赖 ${name} 和交互式命令入口；与所属插件共用安装。` }));
  }
  return items;
}
export async function readMcp(read = readUpstream) {
  const items = [];
  for (const [name, title, summary] of MCP_SERVERS) {
    const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(name)}/versions/latest`;
    const data = await read(url);
    const server = data.server;
    const meta = data._meta?.['io.modelcontextprotocol.registry/official'];
    if (server?.name !== name || meta?.status !== 'active' || meta?.isLatest !== true || typeof server.version !== 'string' || !server.repository?.url) throw Error('MCP 注册信息或发布者不匹配');
    const transports = [...(server.packages || []).map(row => row.transport?.type), ...(server.remotes || []).map(row => row.type)].filter(Boolean);
    if (!transports.some(type => ['stdio', 'streamable-http'].includes(type))) throw Error('MCP 注册项没有当前宿主支持的传输方式');
    items.push(resource('mcp', { id: `source-mcp-${name.split('/').at(-1)}`, type: 'MCP', title, summary, version: server.version, author: name.split('/')[0], url: server.repository.url, body: `${server.description}\n\n${JSON.stringify(server, null, 2)}`, serverDefinition: server, registryUrl: url.replace(/latest$/, encodeURIComponent(server.version)), requirements: `提供 ${[...new Set(transports)].join(' / ')}。按服务定义配置运行环境、身份与访问范围；获取定义不会自动连接服务。` }));
  }
  return items;
}
export const adapters = { dsh: async () => ({ entries: await readDsh() }), skills: readSkills, mcp: async () => ({ entries: await readMcp() }) };
