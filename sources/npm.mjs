import { createHash } from 'node:crypto';
import { readUpstream } from './request.mjs';
import { sourceDiscovery, sourceResource, validPackageReference } from './contracts.mjs';

const queries = ['keywords:dsh-plugin', 'keywords:dsh-theme', 'keywords:dsh-std'];
const digest = value => createHash('sha256').update(value).digest('hex');
function repository(value, fallback) {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value.replace(/^git\+/, '').replace(/\.git(?:#.*)?$/, ''));
    if (url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && /^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)) return url.origin + url.pathname.replace(/\/$/, '');
  } catch { /* Metadata may omit a browseable repository. */ }
  return fallback;
}

/** npm search is author-declared discovery; package manifests are checked before installation. */
export async function readNpmDirectory(read = readUpstream, { pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const candidates = new Map();
  let pages = 0;
  for (const query of queries) {
    let from = 0, total;
    const seen = new Set();
    do {
      if (pages) await pause(1200);
      const url = new URL('https://registry.npmjs.org/-/v1/search');
      url.search = new URLSearchParams({ text: query, size: '250', from: String(from) }).toString();
      const page = await read(url.href); pages++;
      if (!Array.isArray(page?.objects) || !Number.isSafeInteger(page.total) || page.total < 0 || page.total > 50000 || page.objects.length > 250) throw Error('npm 分页响应不完整或超过扫描范围');
      if (total !== undefined && total !== page.total) throw Error('npm 搜索目录在扫描期间发生变化，请重新检查');
      total = page.total;
      if (from + page.objects.length > total || !page.objects.length && from < total) throw Error('npm 分页响应不完整');
      for (const row of page.objects) {
        const value = row?.package;
        if (!value || typeof value.name !== 'string' || value.name.length > 214) throw Error('npm 搜索条目缺少有效身份');
        if (seen.has(value.name)) throw Error('npm 分页出现重复条目，目录可能正在变化');
        seen.add(value.name);
        const previous = candidates.get(value.name);
        if (previous && previous.version !== value.version) throw Error('npm 发布版本在扫描期间发生变化，请重新检查');
        candidates.set(value.name, value);
      }
      from += page.objects.length;
      if (pages >= 1000 && from < total) throw Error('npm 分页超过扫描上限，原目录保留');
    } while (from < total);
  }
  const entries = [], excluded = [];
  for (const value of candidates.values()) {
    try {
      const packageRef = { name: value.name, version: value.version };
      if (!validPackageReference(packageRef)) throw Error('发布包名称或固定版本不符合要求');
      if (!Array.isArray(value.keywords) || !value.keywords.some(word => ['dsh-plugin', 'dsh-theme', 'dsh-std'].includes(word))) throw Error('没有明确的 DSH 资源标记');
      if (typeof value.license !== 'string' || !value.license.trim() || value.license.length > 200 || /UNLICENSED/i.test(value.license)) throw Error('来源未声明可核验的许可');
      const description = typeof value.description === 'string' ? value.description.trim() : '';
      if (!description) throw Error('缺少资源用途介绍');
      const npmUrl = `https://www.npmjs.com/package/${value.name}`;
      entries.push(sourceResource({
        id: `source-npm-${digest(value.name).slice(0, 24)}`, sourceId: 'npm', source: 'npm DSH 社区扩展', status: 'external', owner: 'source:npm', revision: 1, updatedAt: '',
        type: value.keywords.includes('dsh-theme') ? '主题' : '插件', title: value.name.slice(0, 80), summary: description.slice(0, 300), version: value.version,
        author: value.publisher?.username || value.maintainers?.[0]?.username || value.name.split('/')[0], url: repository(value.links?.repository, npmUrl),
        body: description.slice(0, 49000) + '\n\n' + npmUrl, license: value.license, packageRef,
        requirements: '由作者标注为 DSH 扩展；尚未核验运行兼容性。安装前会读取固定版本的真实发布包清单，并检查宿主、依赖与资源类型。',
      }));
    } catch (error) { excluded.push({ name: value.name, reason: error.message }); }
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  excluded.sort((a, b) => a.name.localeCompare(b.name));
  return sourceDiscovery({ entries, discovery: { revision: 'npm:' + digest(JSON.stringify([...candidates].sort())), scanned: candidates.size, excluded, pages, complete: true } });
}
