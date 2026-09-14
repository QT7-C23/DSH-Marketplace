import { publication } from '../community/contracts.mjs';
import { SOURCE_DEFINITIONS } from './definitions.mjs';

export const sourceIds = SOURCE_DEFINITIONS.map(item => item.id);
/** @typedef {{commit:string,scanned:number,excluded:{name:string,reason:string}[]}} DiscoveryReport */
/** @typedef {{entries:import('../community/contracts.mjs').Resource[],discovery?:DiscoveryReport}} DiscoveryResult */
export function discoveryReport(value) {
  if (!value || !/^[a-f0-9]{40}$/.test(value.commit) || !Number.isSafeInteger(value.scanned) || value.scanned < 0 || value.scanned > 100 || !Array.isArray(value.excluded) || value.excluded.length > value.scanned || !value.excluded.every(row => typeof row.name === 'string' && row.name.length <= 100 && typeof row.reason === 'string' && row.reason.length <= 500)) throw Error('来源发现报告格式异常');
  return /** @type {DiscoveryReport} */ (value);
}
export function sourceDiscovery(value) {
  if (!value || !Array.isArray(value.entries) || new Set(value.entries.map(item => item.id)).size !== value.entries.length) throw Error('来源资源列表格式异常或重复');
  value.entries.forEach(sourceResource);
  if (value.discovery) {
    discoveryReport(value.discovery);
    if (value.entries.length + value.discovery.excluded.length !== value.discovery.scanned) throw Error('来源扫描结果数量不一致');
  }
  return /** @type {DiscoveryResult} */ (value);
}
/** @typedef {{kind:'github-skill',repository:string,commit:string,root:string,files:{path:string,sha:string,size:number,mode:string}[]} | {kind:'npm-package',name:string,version:string,url:string,integrity:string}} Bundle */
/** @typedef {{id:string,name:string,url:string,description:string,state:string,count:number,checkedAt:string,lastSuccess:string,error:string,automaticDiscovery?:boolean,automatic?:boolean,syncing?:boolean,nextCheckAt?:string,discovery?:DiscoveryReport|null}} SourceStatus */
export function sourceResource(value) {
  publication(value);
  if (!value || !sourceIds.includes(value.sourceId) || value.status !== 'external' || !/^source-[a-z0-9-]{1,100}$/.test(value.id) || !Number.isSafeInteger(value.revision) || value.revision < 1) throw Error('来源资源编号或版本无效');
  for (const key of ['author', 'owner', 'source', 'updatedAt', 'requirements']) if (typeof value[key] !== 'string') throw Error('来源资源信息不完整');
  if (value.bundle?.kind === 'npm-package') {
    const bundle = value.bundle;
    if (value.type !== '插件' || !/^@deepseek-ai\/dsh-[a-z0-9-]+$/.test(bundle.name) || bundle.version !== '0.1.5-rc.2' || bundle.url !== `https://registry.npmjs.org/${bundle.name}/-/${bundle.name.split('/').at(-1)}-${bundle.version}.tgz` || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(bundle.integrity)) throw Error('DSH 发布包下载信息无效');
  } else if (value.bundle) {
    const bundle = value.bundle;
    if (value.type !== 'Skill' || bundle.kind !== 'github-skill' || bundle.repository !== 'anthropics/skills' || !/^[a-f0-9]{40}$/.test(bundle.commit) || !/^skills\/[a-z0-9-]+$/.test(bundle.root)) throw Error('Skill 下载来源无效');
    if (!Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > 150) throw Error('Skill 文件数量无效');
    const seen = new Set();
    let size = 0;
    for (const file of bundle.files) {
      if (typeof file.path !== 'string' || !file.path.startsWith(bundle.root + '/') || file.path.split('/').some(part => !part || part === '.' || part === '..') || /[\\:\x00-\x1f]/.test(file.path) || !/^[a-f0-9]{40}$/.test(file.sha) || !['100644', '100755'].includes(file.mode) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 1024 * 1024 || seen.has(file.path)) throw Error('Skill 文件路径、类型或校验信息无效');
      seen.add(file.path); size += file.size;
    }
    if (size > 4 * 1024 * 1024 || !seen.has(`${bundle.root}/SKILL.md`) || !seen.has(`${bundle.root}/LICENSE.txt`)) throw Error('Skill 文件不完整或过大');
  }
  return value;
}
export function sourceSnapshot(value) {
  if (!Array.isArray(value) || value.length !== sourceIds.length || new Set(value.map(row => row.id)).size !== value.length) throw Error('来源状态不完整');
  for (const row of value) {
    if (!sourceIds.includes(row.id) || !['bundled', 'fresh', 'stale', 'error'].includes(row.state) || !Number.isSafeInteger(row.count) || row.count < 0 || !['name', 'url', 'description', 'checkedAt', 'lastSuccess', 'error'].every(key => typeof row[key] === 'string')) throw Error('来源状态格式异常');
    for (const key of ['automatic', 'syncing', 'automaticDiscovery']) if (row[key] !== undefined && typeof row[key] !== 'boolean') throw Error('自动发现状态格式异常');
    if (row.nextCheckAt !== undefined && (typeof row.nextCheckAt !== 'string' || (row.nextCheckAt && !Number.isFinite(Date.parse(row.nextCheckAt))))) throw Error('自动检查时间格式异常');
    if (row.discovery) discoveryReport(row.discovery);
  }
  return /** @type {SourceStatus[]} */ (value);
}
