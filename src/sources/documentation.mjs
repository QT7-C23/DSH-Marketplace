import { CommunityError } from '../community/contracts.mjs';
import { repositoryOf } from '../community/metrics.mjs';
import { readUpstream, readBytes, readPinnedSkillBytes as readPinnedDocumentBytes } from './request.mjs';
import { readerDocuments } from './document-language.mjs';

const oid = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const safePath = value => typeof value === 'string' && value.length < 1000 && !/[\\?#\0]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..');

// readerDocuments admits at most three languages. Drain all reads and preserve source order.
async function readDocuments(files, load) {
  const results = await Promise.allSettled(files.map(load));
  return results.map(result => { if (result.status === 'rejected') throw result.reason; return result.value; });
}

/** Load source-owned documents; summaries and missing README files stay distinct. */
export async function readDocumentation(item, { read = readUpstream, download = readBytes } = {}) {
  const result = { schema: 1, state: 'missing', scope: 'resource', versionMatch: true, checkedAt: new Date().toISOString(), files: [] };
  if (item.type === 'Prompt') return { ...result, state: 'available', files: [{ name: 'Prompt', body: item.body, url: item.url, commit: '' }] };
  if (item.bundle?.kind === 'github-skill') {
    const bundle = item.bundle;
    const files = [{ name: 'SKILL.md', body: item.body, url: item.url, commit: bundle.commit }];
    const candidates = bundle.files.filter(file => file.path.startsWith(bundle.root + '/') && !file.path.slice(bundle.root.length + 1).includes('/')).map(file => ({ ...file, name: file.path.slice(bundle.root.length + 1) }));
    files.push(...await readDocuments(readerDocuments(candidates), async file => {
      const body = decode(await readPinnedDocumentBytes(`https://raw.githubusercontent.com/${bundle.repository}/${bundle.commit}/${file.path}`, file, bundle, download));
      return { name: file.path.split('/').at(-1), body, url: `https://github.com/${bundle.repository}/blob/${bundle.commit}/${file.path}`, commit: bundle.commit };
    }));
    return { ...result, state: 'available', files };
  }
  const repository = repositoryOf(item.url);
  if (!repository) return result;
  const parts = new URL(item.url).pathname.split('/').slice(3);
  let commit, directory = '';
  if (parts[0] === 'tree' && oid(parts[1])) { commit = parts[1]; directory = parts.slice(2).join('/'); }
  else {
    if (parts.length && parts[0]) return result;
    const head = await read(`https://api.github.com/repos/${repository}/commits/HEAD`);
    if (!oid(head?.sha)) throw Error('文档提交信息不完整');
    commit = head.sha; result.versionMatch = false; result.scope = 'repository';
    directory = item.serverDefinition?.repository?.subfolder || '';
  }
  if (directory && !safePath(directory)) throw Error('文档路径不受支持');
  if (item.type === 'Slash') result.scope = 'parent';
  let listing;
  try { listing = await read(`https://api.github.com/repos/${repository}/contents/${directory}?ref=${commit}`); }
  catch (error) { if (error.status === 404) return result; throw error; }
  if (!Array.isArray(listing)) throw Error('文档目录响应不完整');
  const candidates = readerDocuments(listing.filter(file => file.type === 'file' && typeof file.name === 'string'));
  result.files = await readDocuments(candidates, async file => {
    const expected = [directory, file.name].filter(Boolean).join('/');
    if (file.path !== expected || !safePath(file.path) || !oid(file.sha) || !Number.isInteger(file.size) || file.size < 1 || file.size > 512000) throw Error('文档文件信息不完整或过大');
    const encoded = file.path.split('/').map(encodeURIComponent).join('/');
    const body = decode(await readPinnedDocumentBytes(`https://raw.githubusercontent.com/${repository}/${commit}/${encoded}`, file, { repository, commit }, download));
    return { name: file.name, body, url: `https://github.com/${repository}/blob/${commit}/${encoded}`, commit };
  });
  return { ...result, state: result.files.length ? 'available' : 'missing' };
}

/** Revision-keyed requests cannot supply their own destination; failures are retryable. */
export class Documentation {
  #catalog; #load; #cache = new Map();
  constructor(catalog, load = readDocumentation) { this.#catalog = catalog; this.#load = load; }
  async read(id, revision) {
    const item = this.#catalog().find(item => item.id === id && item.revision === revision);
    if (!item) throw new CommunityError(409, '该版本不可用，请刷新后重试');
    const key = `${id}:${revision}:${item.url}`;
    const cached = this.#cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.pending;
    if (this.#cache.size >= 100) this.#cache.delete(this.#cache.keys().next().value);
    const pending = this.#load(item).catch(error => { this.#cache.delete(key); throw error; });
    this.#cache.set(key, { pending, expires: Date.now() + 6 * 60 * 60 * 1000 });
    return pending;
  }
}
