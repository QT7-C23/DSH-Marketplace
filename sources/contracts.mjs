import { publication } from '../community/contracts.mjs';
import { SOURCE_DEFINITIONS } from './definitions.mjs';
import { validateSkillBundle } from './skill-bundles.mjs';
import { removalList } from './removals.mjs';

export const sourceIds = SOURCE_DEFINITIONS.map(item => item.id);
/** @typedef {{commit?:string,revision?:string,scanned:number,excluded:{name:string,reason:string}[],pages?:number,complete?:boolean}} DiscoveryReport */
/** @typedef {{entries:import('../community/contracts.mjs').Resource[],discovery?:DiscoveryReport,removals?:ReturnType<typeof removalList>}} DiscoveryResult */
export function discoveryReport(value) {
  if (!value || !(typeof value.commit === 'string' && /^[a-f0-9]{40}$/.test(value.commit) || typeof value.revision === 'string' && value.revision.length > 0 && value.revision.length <= 200) || !Number.isSafeInteger(value.scanned) || value.scanned < 0 || value.scanned > 100000 || !Array.isArray(value.excluded) || value.excluded.length > value.scanned || !value.excluded.every(row => typeof row.name === 'string' && row.name.length <= 300 && typeof row.reason === 'string' && row.reason.length <= 500) || value.complete !== undefined && value.complete !== true || value.pages !== undefined && (!Number.isSafeInteger(value.pages) || value.pages < 1 || value.pages > 1000)) throw Error('来源发现报告格式异常');
  return /** @type {DiscoveryReport} */ (value);
}
export function sourceDiscovery(value) {
  if (!value || !Array.isArray(value.entries) || new Set(value.entries.map(item => item.id)).size !== value.entries.length) throw Error('来源资源列表格式异常或重复');
  value.entries.forEach(sourceResource);
  if (value.removals !== undefined) removalList(value.removals);
  if (value.discovery) {
    discoveryReport(value.discovery);
    if (value.entries.length + value.discovery.excluded.length !== value.discovery.scanned) throw Error('来源扫描结果数量不一致');
  }
  return /** @type {DiscoveryResult} */ (value);
}
/** @typedef {{kind:'github-skill',repository:string,commit:string,root:string,licensePaths?:string[],files:{path:string,sha:string,size:number,mode:string}[]} | {kind:'npm-package',name:string,version:string,url:string,integrity:string}} Bundle */
/** @typedef {{id:string,name:string,url:string,description:string,state:string,count:number,checkedAt:string,lastSuccess:string,error:string,automaticDiscovery?:boolean,automatic?:boolean,syncing?:boolean,nextCheckAt?:string,discovery?:DiscoveryReport|null}} SourceStatus */
export function sourceResource(value) {
  publication(value);
  const idValid = /^source-[a-z0-9-]{1,100}$/.test(value?.id) || value?.sourceId === 'community' && value.type === 'Prompt' && /^github-[a-z0-9-]{1,80}$/.test(value.id);
  if (!value || !sourceIds.includes(value.sourceId) || value.status !== 'external' || !idValid || !Number.isSafeInteger(value.revision) || value.revision < 1) throw Error('来源资源编号或版本无效');
  for (const key of ['author', 'owner', 'source', 'updatedAt', 'requirements']) if (typeof value[key] !== 'string') throw Error('来源资源信息不完整');
  if (value.packageRef && (!['插件', '主题'].includes(value.type) || !validPackageReference(value.packageRef))) throw Error('发布包身份或固定版本无效');
  if (value.bundle?.kind === 'npm-package') {
    const bundle = value.bundle;
    if (bundle.version !== value.version || value.packageRef && (value.packageRef.name !== bundle.name || value.packageRef.version !== bundle.version)) throw Error('资源展示、安装与下载必须指向同一个固定发布包');
    if (value.type !== '插件' || !/^@deepseek-ai\/dsh-[a-z0-9-]+$/.test(bundle.name) || bundle.version !== '0.1.5-rc.2' || bundle.url !== `https://registry.npmjs.org/${bundle.name}/-/${bundle.name.split('/').at(-1)}-${bundle.version}.tgz` || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(bundle.integrity)) throw Error('DSH 发布包下载信息无效');
  } else if (value.bundle) {
    validateSkillBundle(value);
  }
  return value;
}

export function validPackageReference(value) {
  return Boolean(value && typeof value.name === 'string' && value.name.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value.name) && typeof value.version === 'string' && value.version.length <= 40 && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value.version));
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
