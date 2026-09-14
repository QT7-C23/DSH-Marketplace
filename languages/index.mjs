import zh from './zh-CN.json' with { type: 'json' };
import en from './en-US.json' with { type: 'json' };
import ja from './ja-JP.json' with { type: 'json' };

export const dictionaries = { 'zh-CN': zh, 'en-US': en, 'ja-JP': ja };
export const languageNames = { 'zh-CN': '简体中文', 'en-US': 'English', 'ja-JP': '日本語' };
export const localeOf = value => Object.hasOwn(dictionaries, value) ? value : 'zh-CN';
/** Shared by the API and client. Resource content is never passed through here. */
export function translate(locale, key, values = {}) {
  const template = dictionaries[localeOf(locale)][key];
  if (typeof template !== 'string') throw Error(`Missing language key: ${key}`);
  return template.replace(/(?<!\{)\{(\w+)\}(?!\})/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
export function translateMessage(locale, message) {
  const field = message.match(/^(.+)不能为空或超过 (\d+) 字符$/);
  if (field) {
    const keys = { 名称: 'name', 用途: 'summary', 版本: 'version', 内容: 'content', 来源地址: 'url' };
    return translate(locale, 'errField', { field: keys[field[1]] ? translate(locale, keys[field[1]]) : field[1], limit: field[2] });
  }
  const status = message.match(/^来源返回 (\d+)，请稍后重试$/);
  if (status) return translate(locale, 'errUpstream', { status: status[1] });
  const key = Object.keys(zh).find(key => zh[key] === message);
  return key ? translate(locale, key) : message;
}
