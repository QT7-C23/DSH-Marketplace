/** Shared resource contract used by the server and typed client. */
/** @typedef {{type:string,title:string,summary:string,version:string,body:string,url:string}} Publication */
/** @typedef {Publication & {id:string,owner:string,author:string,revision:number,status:string,source:string,updatedAt:string,license?:string,language?:string,sourceId?:string,requirements?:string,parentId?:string,registryUrl?:string,serverDefinition?:object,bundle?:import('../sources/contracts.mjs').Bundle}} Resource */
/** @typedef {{downloads:number,saves?:number,ratingCount?:number,ratingAverage?:number|null}} Stats */
/** @typedef {{filename:string,mime:string,content:string,encoding?:'base64'}} ExportFile */
/** @typedef {{schema:2,catalog:Resource[],stats:Record<string,Stats>}} Snapshot */
export const RESOURCE_TYPES = ['插件', 'Skill', 'MCP', 'Slash', 'Prompt', '主题'];
export class CommunityError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function text(value, label, limit, optional = false) {
  if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())) throw new CommunityError(400, `${label}不能为空或超过 ${limit} 字符`);
  return value;
}
/** @returns {Publication} */
export function publication(value, draft = false) {
  if (!value || !RESOURCE_TYPES.includes(value.type)) throw new CommunityError(400, '请选择资源类型');
  const result = { type: value.type, title: text(value.title, '名称', 80, draft), summary: text(value.summary, '用途', 300, draft), version: text(value.version, '版本', 40, draft), body: text(value.body, '内容', 50000, draft || value.type !== 'Prompt'), url: text(value.url, '来源地址', 2000, draft || value.type === 'Prompt') };
  if ((!draft && result.type !== 'Prompt') || result.url) {
    try { const url = new URL(result.url); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); }
    catch { throw new CommunityError(400, '请填写不含账户信息的 HTTPS 发布地址'); }
  }
  return result;
}
/** Validate responses at the browser boundary.
 * @param {unknown} value
 * @returns {Snapshot}
 */
export function snapshot(value) {
  const data = /** @type {Snapshot} */ (value);
  if (!data || data.schema !== 2 || !Array.isArray(data.catalog) || !data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats)) throw new Error('市场响应格式异常，请重试');
  for (const resource of data.catalog) {
    publication(resource);
    if (!['id', 'owner', 'author', 'status', 'source', 'updatedAt'].every(key => typeof resource[key] === 'string') || !Number.isSafeInteger(resource.revision)) throw new Error('资源信息不完整，请重试');
  }
  for (const value of Object.values(data.stats)) {
    if (!value || !Number.isSafeInteger(value.downloads) || value.downloads < 0) throw new Error('市场响应格式异常，请重试');
  }
  return data;
}

/** @param {unknown} value @returns {ExportFile} */
export function exportFile(value) {
  const file = /** @type {ExportFile} */ (value);
  if (file?.encoding === 'base64') {
    if (typeof file.filename !== 'string' || !(file.mime === 'application/zip' ? /^[a-z0-9-]+\.zip$/ : file.mime === 'application/gzip' ? /^[a-z0-9-]+\.tgz$/ : /$a/).test(file.filename) || typeof file.content !== 'string' || file.content.length > 8 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content) || !file.content) throw new Error('发布包下载格式异常');
    return file;
  }
  if (!file || typeof file.filename !== 'string' || !/^[a-z0-9-]+\.(md|json)$/.test(file.filename) || !['text/markdown;charset=utf-8', 'application/json;charset=utf-8'].includes(file.mime) || typeof file.content !== 'string') throw new Error('下载内容格式异常，请重试');
  return file;
}
