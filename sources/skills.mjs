import { parseDocument } from 'yaml';
import { SKILLS, SOURCE_DEFINITIONS } from './definitions.mjs';
import { sourceResource, sourceDiscovery } from './contracts.mjs';
import { readUpstream, readBytes, verifySkillBytes } from './request.mjs';

// These identify reviewed license texts, not a list of resources to discover.
const apacheLicenses = new Set(['4f881c52d1f72f4cfb720e339e2d35c3058d01a9', 'f433b1a53f5b830a205fd2df78e2b34974656c7b']);
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
  const head = await read('https://api.github.com/repos/anthropics/skills/commits/main');
  if (!oid(head?.sha) || !oid(head.commit?.tree?.sha)) throw Error('Skill 提交信息不完整');
  const tree = await read(`https://api.github.com/repos/anthropics/skills/git/trees/${head.commit.tree.sha}?recursive=1`);
  if (tree?.sha !== head.commit.tree.sha || !Array.isArray(tree.tree) || tree.truncated !== false || tree.tree.some(file => typeof file.path !== 'string')) throw Error('Skill 目录响应不完整');
  if (new Set(tree.tree.map(file => file.path)).size !== tree.tree.length) throw Error('Skill 目录出现重复路径');
  const names = tree.tree.filter(file => /^skills\/[a-z0-9][a-z0-9-]{0,63}\/SKILL\.md$/.test(file.path)).map(file => file.path.split('/')[1]).sort();
  if (names.length > 100) throw Error('Skill 目录超过本次扫描上限，原目录保留');
  const entries = [], excluded = [], blobs = new Map();
  async function verified(file) {
    if (!blobs.has(file.sha)) {
      const url = `https://raw.githubusercontent.com/anthropics/skills/${head.sha}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
      blobs.set(file.sha, download(url));
    }
    return verifySkillBytes(file, await blobs.get(file.sha));
  }
  async function inspect(name) {
    const root = `skills/${name}`;
    const children = tree.tree.filter(file => file.path.startsWith(root + '/'));
    const files = children.filter(file => file.type === 'blob').map(({ path, sha, size, mode }) => ({ path, sha, size, mode }));
    const bundle = { kind: 'github-skill', repository: 'anthropics/skills', commit: head.sha, root, files };
    const item = { id: `source-skill-${name}`, type: 'Skill', title: name, summary: name, version: head.sha.slice(0, 12), revision: 1, status: 'external', sourceId: 'skills', source: SOURCE_DEFINITIONS.find(row => row.id === 'skills').name, owner: 'source:skills', author: 'anthropics', updatedAt: '', url: `https://github.com/anthropics/skills/blob/${head.sha}/${root}/SKILL.md`, body: '', bundle, license: 'Apache-2.0', requirements: '下载完整目录后，还需配置 DSH Skill 提供者与脚本依赖；当前未自动安装或加载。' };
    const skip = reason => excluded.push({ name, reason });
    try {
      if (children.some(file => !['blob', 'tree'].includes(file.type))) throw Error('目录含未支持的子模块');
      sourceResource(item);
    } catch (error) { skip(error.message); return; }
    const license = files.find(file => file.path === `${root}/LICENSE.txt`);
    if (!apacheLicenses.has(license.sha)) { skip('许可尚未核验，暂不收录或提供下载'); return; }
    // Transport or integrity errors abort the whole update, preserving the previous snapshot.
    await verified(license);
    const bodyBytes = await verified(files.find(file => file.path === `${root}/SKILL.md`));
    try {
      item.body = decode(bodyBytes);
      const info = metadata(item.body, name);
      // Curated translations improve presentation; absence never prevents discovery.
      const label = SKILLS.find(([slug]) => slug === name);
      item.title = label?.[1] || info.name;
      const description = info.description.replace(/\s+/g, ' ').trim();
      item.summary = label?.[2] || (description.length > 300 ? description.slice(0, 297) + '…' : description);
      entries.push(sourceResource(item));
    } catch (error) { skip(error.message); }
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
