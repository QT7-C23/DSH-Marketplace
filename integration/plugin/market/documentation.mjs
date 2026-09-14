/** Resolve Markdown links without enabling script/data/file schemes or host navigation. */
export function documentLink(value, source) {
  try {
    const url = new URL(value, source || undefined);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
/** @typedef {{name:string,body:string,url:string,commit:string}} DocumentFile */
/** @typedef {{schema:1,state:'available'|'missing',scope:'resource'|'parent'|'repository',versionMatch:boolean,checkedAt:string,files:DocumentFile[]}} DocumentResult */
/** @returns {DocumentResult} */
export function documentResult(value) {
  if (value?.schema !== 1 || !['available', 'missing'].includes(value.state) || !['resource', 'parent', 'repository'].includes(value.scope) || typeof value.versionMatch !== 'boolean' || typeof value.checkedAt !== 'string' || !Array.isArray(value.files) || value.files.length > 4 || (value.state === 'available') !== Boolean(value.files.length)) throw Error('文档目录响应不完整');
  for (const file of value.files) if (!file || typeof file.name !== 'string' || file.name.length > 100 || typeof file.body !== 'string' || file.body.length > 512000 || typeof file.url !== 'string' || (file.url && !documentLink(file.url, '')) || typeof file.commit !== 'string' || (file.commit && !/^[a-f0-9]{40}$/.test(file.commit))) throw Error('文档文件信息不完整或过大');
  return value;
}

/** @typedef {{providers:{id:string,name:string,models:{id:string,name:string}[],unavailable:boolean}[],defaultSelection:{provider:string,model:string}|null}} TranslationModels */
/** @returns {TranslationModels} */
export function translationModels(value) {
  if (!value || !Array.isArray(value.providers) || value.providers.some(provider => typeof provider.id !== 'string' || typeof provider.name !== 'string' || typeof provider.unavailable !== 'boolean' || !Array.isArray(provider.models) || provider.models.some(model => typeof model.id !== 'string' || typeof model.name !== 'string')) || (value.defaultSelection !== null && (typeof value.defaultSelection?.provider !== 'string' || typeof value.defaultSelection?.model !== 'string'))) throw Error('市场响应格式异常，请重试');
  return value;
}
/** @typedef {{schema:1,id:string,revision:number,file:string,target:string,provider:string,model:string,body:string,usage:{inputTokens:number,outputTokens:number,totalTokens?:number}|null}} TranslationResult */
/** @returns {TranslationResult} */
export function translationResult(value, request) {
  const count = number => Number.isSafeInteger(number) && number >= 0;
  if (value?.schema !== 1 || ['id', 'revision', 'file', 'target', 'provider', 'model'].some(key => value[key] !== request[key]) || typeof value.body !== 'string' || !value.body.trim() || value.body.length > 256000 || (value.usage !== null && (!count(value.usage?.inputTokens) || !count(value.usage?.outputTokens) || (value.usage?.totalTokens !== undefined && !count(value.usage.totalTokens))))) throw Error('市场响应格式异常，请重试');
  return value;
}
