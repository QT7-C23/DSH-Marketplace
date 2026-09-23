import { parseDocument } from 'yaml';
import { SKILLS, SOURCE_DEFINITIONS } from './definitions.mjs';
import { sourceResource, sourceDiscovery } from './contracts.mjs';
import { readUpstream, readBytes, verifySkillBytes, readPinnedSkillBytes, isTransientReadError } from './request.mjs';
import { validateSkillBundle } from './skill-bundles.mjs';

// These identify reviewed license texts, not a list of resources to discover.
const apacheLicenses = new Set(['4f881c52d1f72f4cfb720e339e2d35c3058d01a9', 'f433b1a53f5b830a205fd2df78e2b34974656c7b']);
// Reviewed at openai/skills commit 49f948faa9258a0c61caceaf225e179651397431; verbatim fixtures: ./licenses/openai-*.txt.
const openAiLicenses = new Map([
  ['7a4a3ea2424c09fbe48d455aed1eaa94d9124835', 'Apache-2.0'],
  ['145d9443e3e7da910ac0b1e7c8afda86cfefde3a', 'Apache-2.0'],
  ['13e25df86ce06eb6488e6a6bc5c5847f5dedc352', 'Apache-2.0'],
  ['cefe596afef12e19a8e5e923f1a04c7da3188760', 'Apache-2.0'],
  ['08717083b66cc66a7d45267fd9a6998e79bddf04', 'MIT'],
  ['94df5bf89dbb6210a707fb4edbf3aade96bc4318', 'MIT'],
]);
const licenseName = /^LICENSE(?:\.(?:txt|md))?$/i;
const oid = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
function metadata(body, name) {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match || match[1].length > 16000) throw Error('缺少有效的 Skill 元数据');
  const document = parseDocument(match[1], { uniqueKeys: true, stringKeys: true, prettyErrors: false });
  if (document.errors.length || document.warnings.length) throw Error('Skill 元数据格式不支持');
  const value = document.toJS({ maxAliasCount: 0 });
  if (value?.name !== name || typeof value.description !== 'string' || !value.description.trim()) throw Error('Skill 名称或用途不完整');
  if (value.metadata?.internal === true) throw Error('来源将此 Skill 标记为内部资源');
  return value;
}

/** Discover every top-level Skill in this supported repository; never execute source text. */
export async function readSkills(read = readUpstream, { download = readBytes } = {}) {
  return scanRepository('anthropics/skills', read, download);
}

/** Scan skills/.curated/<slug>/SKILL.md only; Codex-internal .system is outside this source. */
export async function readOpenAiSkills(read = readUpstream, { download = readBytes } = {}) {
  return scanRepository('openai/skills', read, download);
}

async function scanRepository(repository, read, download) {
  const openai = repository === 'openai/skills';
  const prefix = openai ? 'skills/.curated' : 'skills';
  const sourceId = openai ? 'skills-openai' : 'skills';
  const head = await read(`https://api.github.com/repos/${repository}/commits/main`);
  if (!oid(head?.sha) || !oid(head.commit?.tree?.sha)) throw Error('Skill 提交信息不完整');
  const tree = await read(`https://api.github.com/repos/${repository}/git/trees/${head.commit.tree.sha}?recursive=1`);
  if (tree?.sha !== head.commit.tree.sha || !Array.isArray(tree.tree) || tree.truncated !== false || tree.tree.some(file => !file || typeof file.path !== 'string')) throw Error('Skill 目录响应不完整');
  if (new Set(tree.tree.map(file => file.path)).size !== tree.tree.length) throw Error('Skill 目录出现重复路径');
  const names = tree.tree.filter(file => file.path.startsWith(prefix + '/') && /^[a-z0-9][a-z0-9-]{0,63}\/SKILL\.md$/.test(file.path.slice(prefix.length + 1))).map(file => file.path.split('/').at(-2)).sort();
  if (names.length > 100) throw Error('Skill 目录超过本次扫描上限，原目录保留');
  const entries = [], excluded = [], blobs = new Map();
  let rawFailure;
  async function transport(url) {
    const raw = new URL(url).hostname === 'raw.githubusercontent.com';
    if (raw && rawFailure) throw rawFailure;
    try { return await download(url); }
    catch (error) {
      if (raw && isTransientReadError(error)) rawFailure = error;
      throw error;
    }
  }
  async function verified(file) {
    if (!blobs.has(file.sha)) {
      const url = `https://raw.githubusercontent.com/${repository}/${head.sha}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
      blobs.set(file.sha, readPinnedSkillBytes(url, file, { repository, commit: head.sha }, transport));
    }
    return verifySkillBytes(file, await blobs.get(file.sha));
  }
  async function inspect(name) {
    const root = `${prefix}/${name}`;
    const children = tree.tree.filter(file => file.path.startsWith(root + '/'));
    const files = children.filter(file => file.type === 'blob').map(({ path, sha, size, mode }) => ({ path, sha, size, mode }));
    // A local license takes precedence. An unsupported local text cannot inherit a root license.
    const localLicenses = children.filter(file => openai ? licenseName.test(file.path.slice(root.length + 1)) : file.path === `${root}/LICENSE.txt`);
    const licenses = openai && !localLicenses.length ? tree.tree.filter(file => licenseName.test(file.path)) : localLicenses;
    for (const { path, sha, size, mode } of licenses) if (!path.startsWith(root + '/')) files.push({ path, sha, size, mode });
    const bundle = { kind: 'github-skill', repository, commit: head.sha, root, files, ...(openai ? { licensePaths: licenses.map(file => file.path) } : {}) };
    const item = { id: `${openai ? 'source-openai-skill-' : 'source-skill-'}${name}`, type: 'Skill', title: name, summary: name, version: head.sha.slice(0, 12), revision: 1, status: 'external', sourceId, source: SOURCE_DEFINITIONS.find(row => row.id === sourceId).name, owner: `source:${sourceId}`, author: repository.split('/')[0], updatedAt: '', url: `https://github.com/${repository}/blob/${head.sha}/${root}/SKILL.md`, body: '', bundle, license: 'Apache-2.0', requirements: openai ? '来自 Codex Skills，可安装原始文件。原文声明的宿主工具、MCP、环境变量与脚本依赖仍需逐项配置，安装文件不代表这些依赖已满足。' : '安装会将原始文件放入 DSH 用户 Skill 目录。附带脚本所需环境与工具依赖需按作者说明配置；请检查宿主是否已加载。' };
    const skip = reason => excluded.push({ name, reason });
    try {
      if (children.some(file => !['blob', 'tree'].includes(file.type))) throw Error('目录含未支持的子模块');
      const directories = tree.tree.filter(file => root === file.path || root.startsWith(file.path + '/') || file.path.startsWith(root + '/') && file.type === 'tree');
      if (directories.some(file => file.type !== 'tree' || file.mode !== '040000' || file.path.split('/').some(part => !part || part === '.' || part === '..') || /[\\:\x00-\x1f\x7f]/.test(file.path))) throw Error('Skill 目录路径或类型无效');
      validateSkillBundle(item);
    } catch (error) { skip(error.message); return; }
    const identifiers = licenses.map(file => openai ? openAiLicenses.get(file.sha) : apacheLicenses.has(file.sha) ? 'Apache-2.0' : undefined);
    if (identifiers.some(id => !id) || new Set(identifiers).size !== 1) { skip('许可尚未核验或不一致，暂不收录或提供下载'); return; }
    item.license = identifiers[0];
    // Shared contract integration errors must surface, never masquerade as upstream exclusions.
    sourceResource(item);
    // Transport or integrity errors abort the whole update, preserving the previous snapshot.
    for (const license of licenses) await verified(license);
    const bodyBytes = await verified(files.find(file => file.path === `${root}/SKILL.md`));
    try {
      item.body = decode(bodyBytes);
      if (item.body.length > 50000) throw Error('Skill 内容超过预览上限');
      const info = metadata(item.body, name);
      // Curated translations improve presentation; absence never prevents discovery.
      const label = openai ? undefined : SKILLS.find(([slug]) => slug === name);
      item.title = label?.[1] || info.name;
      const description = info.description.replace(/\s+/g, ' ').trim();
      item.summary = label?.[2] || (description.length > 300 ? description.slice(0, 297) + '…' : description);
    } catch (error) { skip(error.message); return; }
    // Companions stay pinned to the tree; packageFile verifies their bytes at acquisition.
    entries.push(sourceResource(item));
  }
  let cursor = 0;
  const work = async () => { while (cursor < names.length) await inspect(names[cursor++]); };
  const results = await Promise.allSettled(Array.from({ length: Math.min(4, names.length) }, work));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  entries.sort((a, b) => a.id.localeCompare(b.id));
  excluded.sort((a, b) => a.name.localeCompare(b.name));
  return sourceDiscovery({ entries, discovery: { commit: head.sha, scanned: names.length, excluded } });
}
