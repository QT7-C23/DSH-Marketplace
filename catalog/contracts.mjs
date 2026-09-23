import { publication } from '../src/community/contracts.mjs';

export const LICENSES = ['CC0-1.0', 'MIT', 'CC-BY-4.0', 'Apache-2.0'];
/** Validate files submitted through GitHub before they enter the shipped catalog. */
export function validatePrompt(value) {
  if (!value || value.schema !== 1 || value.type !== 'Prompt') throw Error('投稿文件需要 schema 1 和 Prompt 类型');
  publication(value);
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id) || value.id.length > 80) throw Error('资源编号需为小写字母、数字和短横线');
  if (typeof value.author !== 'string' || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value.author)) throw Error('请填写原作者的 GitHub 用户名');
  if (!LICENSES.includes(value.license)) throw Error('请选择作品许可');
  if (!['zh', 'en', 'ja', 'other'].includes(value.language)) throw Error('请选择原文语言');
  if (value.provenance) {
    const source = value.provenance;
    if (!/^[\w.-]+\/[\w.-]+$/.test(source.repository || '') || !/^[a-f0-9]{40}$/.test(source.commit || '') || !/^[a-f0-9]{64}$/.test(source.sha256 || '')) throw Error('第三方来源需要固定提交和正文校验值');
    if (typeof source.path !== 'string' || !source.path || source.path.includes('..') || typeof source.entry !== 'string' || !source.entry) throw Error('第三方来源需要明确文件和条目');
    if (value.url !== `https://github.com/${source.repository}/blob/${source.commit}/${source.path}` || typeof source.licenseUrl !== 'string' || !source.licenseUrl.startsWith(`https://github.com/${source.repository}/blob/${source.commit}/`)) throw Error('来源和许可地址需对应固定版本');
  }
  return value;
}

export function submissionFile(value, metadata) {
  const entry = validateSubmission({ schema: 1, ...publication(value), id: metadata.id, author: metadata.author, license: metadata.license, language: metadata.language || 'zh' });
  return { filename: `${entry.id}.json`, mime: 'application/json;charset=utf-8', content: JSON.stringify(entry, null, 2) + '\n' };
}

/** Resource proposals are data for maintainer review, never direct publication. */
export function validateSubmission(value) {
  publication(value);
  validatePrompt({ ...value, type: 'Prompt', body: value.body || value.summary });
  return value;
}

export function submissionUrl({ repository, branch }) {
  if (repository === null && branch === null) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || typeof branch !== 'string' || !branch || /[\s?#]/.test(branch)) throw Error('投稿仓库配置无效');
  return `https://github.com/${repository}/upload/${encodeURIComponent(branch)}/catalog/prompts`;
}
