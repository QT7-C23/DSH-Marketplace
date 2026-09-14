import { publication, snapshot } from '../../../community/contracts.mjs';
import { languageNames } from '../../../languages/index.mjs';

/** @typedef {import('../../../community/contracts.mjs').Publication & {author?:string,resourceId?:string,license?:string,language?:string}} Draft */
/** @typedef {{schema:1,saved:import('../../../community/contracts.mjs').Resource[],draft:Draft|null,language:string,ratings:Record<string,number>}} LocalData */
/** @typedef {{read:()=>LocalData,write:(data:LocalData)=>void}} LocalPort */
/** @returns {LocalData} */
export const emptyLocal = () => ({ schema: 1, saved: [], draft: null, language: 'zh-CN', ratings: {} });

/** Preserve attribution in partially completed drafts without accepting executable content. */
export function draftData(value) {
  const draft = publication(value, true);
  for (const key of ['author', 'resourceId', 'license', 'language']) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 100)) throw Error('投稿信息格式不正确');
    if (value[key] !== undefined) draft[key] = value[key];
  }
  return /** @type {Draft} */ (draft);
}

/** Browser-owned data is independent of community identity; corrupt data is never overwritten. */
export function browserLocalPort(storage = () => window.localStorage) {
  const key = 'dsh-market-local-v1';
  let initialized = false;
  let baseline = null;
  function read() {
    const raw = storage().getItem(key);
    if (!raw) { initialized = true; baseline = raw; return emptyLocal(); }
    try {
      const data = JSON.parse(raw);
      if (data.schema !== 1 || !Array.isArray(data.saved)) throw Error();
      snapshot({ schema: 2, catalog: data.saved, stats: {} });
      if (data.language !== undefined && !Object.hasOwn(languageNames, data.language)) throw Error();
      if (data.ratings !== undefined && (!data.ratings || typeof data.ratings !== 'object' || Array.isArray(data.ratings) || Object.values(data.ratings).some(score => !Number.isInteger(score) || score < 1 || score > 5))) throw Error();
      if (data.draft !== null) {
        draftData(data.draft);
        if (data.draft.id || data.draft.baseRevision) throw Error();
      }
      initialized = true; baseline = raw;
      return /** @type {LocalData} */ ({ ...emptyLocal(), ...data });
    } catch { throw Error('本机资源数据无法读取，原始数据已保留；请先导出浏览器存储再修复'); }
  }
  return { read, write: data => {
    if (!initialized) read();
    if (storage().getItem(key) !== baseline) throw Error('其他页面已修改本机资源，请保留未保存内容并刷新后重试');
    const raw = JSON.stringify(data);
    storage().setItem(key, raw);
    baseline = raw;
  } };
}
