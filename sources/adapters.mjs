import { PLUGINS, SOURCE_DEFINITIONS } from './definitions.mjs';
import { sourceResource } from './contracts.mjs';
import { readUpstream, readBytes } from './request.mjs';
import { readSkills, readOpenAiSkills } from './skills.mjs';
import { readMcpDirectory } from './mcp.mjs';
import { readNpmDirectory } from './npm.mjs';
import { readCommunityIndex } from './community.mjs';
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
    items.push(resource('dsh', { id, type: '插件', title, summary, author: 'deepseek-ai', version: data.version, url, body: `${summary}\n\n${data.description || ''}\n\n${JSON.stringify(packageInfo, null, 2)}`, license: data.license || '见发布包', requirements: '对应 DSH 0.1.5-rc.2；先检查宿主是否已有该模块。通过安装预览核验固定版本与依赖后，再确认安装。', bundle: { kind: 'npm-package', name, version: data.version, url: data.dist.tarball, integrity: data.dist.integrity } }));
    if (command) items.push(resource('dsh', { id: `source-slash-${command.slice(1)}`, type: 'Slash', title: command, summary, author: 'deepseek-ai', version: data.version, url, parentId: id, command, body: `${command} 由 ${name} 提供。\n\n${command === '/plan' ? '进入规划：/plan\n退出规划：/plan off。规划指导不等于工具权限限制。' : command === '/compact' ? '不带参数执行 /compact 可请求压缩历史。压缩会改变会话历史，是否调用模型由压缩后端决定。' : '使用 /goal 查看目标状态。创建、编辑、暂停和恢复操作由宿主目标系统处理。'}\n\n可从市场确认参数后在当前会话执行；具体行为以所属插件和当前会话状态为准。`, requirements: `依赖 ${name} 和交互式命令入口；与所属插件共用安装。` }));
  }
  return items;
}
export async function readMcp(read = readUpstream) { return (await readMcpDirectory(read)).entries; }
export function createAdapters({ read = readUpstream, download = readBytes } = {}) {
  return { dsh: async () => ({ entries: await readDsh(read) }), skills: () => readSkills(read, { download }), mcp: () => readMcpDirectory(read), npm: () => readNpmDirectory(read), 'skills-openai': () => readOpenAiSkills(read, { download }), community: () => readCommunityIndex(read) };
}
export const adapters = createAdapters();
