/** Filename language conventions shared by source selection and the reader. */
export const isReadme = name => /^readme(?:[._-][\p{L}_-]+)?\.(md|markdown)$/iu.test(name);
function documentLanguage(name) {
  const tag = name.replace(/^readme|\.(?:md|markdown)$/gi, '').replace(/^[._-]/, '').toLowerCase().replaceAll('_', '-');
  if (/^(zh|cn)(-|$)|中文|简体|繁體/.test(tag)) return 'zh';
  if (/^(ja|jp)(-|$)|日本語/.test(tag)) return 'ja';
  return !tag || /^en(-|$)/.test(tag) ? 'en' : tag;
}
/** @template {{name:string}} T @param {T[]} files @returns {T[]} */
export function preferredDocuments(files, locale) {
  const target = locale.split('-')[0];
  const rank = file => {
    if (!isReadme(file.name)) return 5;
    const lang = documentLanguage(file.name);
    const explicit = /^readme\.(md|markdown)$/i.test(file.name) ? 1 : 0;
    return (lang === target ? 0 : lang === 'en' ? 2 : 6) + explicit;
  };
  return [...files].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
/** Keep the primary Chinese, English and Japanese files within the download cap. */
export function readerDocuments(files) {
  const candidates = files.filter(file => isReadme(file.name));
  const primary = ['zh-CN', 'en-US', 'ja-JP'].map(locale => preferredDocuments(candidates, locale)[0]).filter(Boolean);
  return [...new Set([...primary, ...candidates])].slice(0, 3);
}
/** Omit document metadata from prose rendering; raw view keeps the exact source. */
export const markdownBody = body => body.replace(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n/, (match, header) => /^[\w-]+:(?:[ \t]|$)/m.test(header) ? '' : match);
