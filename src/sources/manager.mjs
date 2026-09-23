import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import seed from '../../catalog/source-seed.json' with { type: 'json' };
import { createAdapters } from './adapters.mjs';
import { SOURCE_DEFINITIONS } from './definitions.mjs';
import { sourceDiscovery, sourceSnapshot, sourceIds } from './contracts.mjs';
import { fingerprint, restoreCache } from './cache.mjs';
import { removals as defaultRemovals, removalList, applyRemovals, bindRemovals } from './removals.mjs';
import { packageFile } from './packages.mjs';
import { CommunityError } from '../community/contracts.mjs';
import { mergeSourceResources } from './merge.mjs';
import { readUpstream, readBytes } from './request.mjs';
import { githubFetch } from './github-auth.mjs';

const interval = 6 * 60 * 60 * 1000;
const retryInterval = 30 * 60 * 1000;
/** Durable per-source snapshots; network failure never removes the previous catalog. */
export class SourceManager {
  #file;
  #data;
  #read;
  #pending = new Map();
  #change;
  #packages = new Map();
  #now;
  #removals;
  #closed = false;
  #failures = new Map();
  #abort = new AbortController();
  constructor(folder, { adapters: read, request = githubFetch, onChange = () => {}, now = Date.now, removals = defaultRemovals } = {}) {
    mkdirSync(folder, { recursive: true });
    this.#file = path.join(folder, 'catalog-cache.json');
    const requestWithSignal = (url, options) => request(url, { ...options, signal: AbortSignal.any([options.signal, this.#abort.signal]) });
    this.#read = read || createAdapters({ read: url => readUpstream(url, requestWithSignal), download: url => readBytes(url, requestWithSignal) });
    this.#change = onChange; this.#now = now; this.#removals = removalList(removals);
    const rows = SOURCE_DEFINITIONS.map(definition => {
      const row = seed.find(item => item.id === definition.id) || { id: definition.id, entries: [], checkedAt: '' };
      return { ...structuredClone(row), lastSuccess: row.checkedAt, state: 'bundled', error: '' };
    });
    this.#data = { schema: 1, rows, removals: [], history: Object.fromEntries(rows.flatMap(row => row.entries.map(item => [item.id, { fingerprint: fingerprint(item), revision: item.revision }]))) };
    try {
      this.#data = restoreCache(JSON.parse(readFileSync(this.#file, 'utf8')));
      for (const row of rows) if (!this.#data.rows.some(value => value.id === row.id)) {
        this.#data.rows.push(row);
        for (const item of row.entries) this.#data.history[item.id] = { fingerprint: fingerprint(item), revision: item.revision };
      }
      sourceSnapshot(this.status());
    } catch (error) { if (error.code !== 'ENOENT') throw Error('本机目录缓存无法读取，原文件已保留，请检查来源缓存后重试', { cause: error }); }
  }
  #policy(data = this.#data) {
    const rules = [...new Map([...data.removals, ...this.#removals].map(row => [row.id, row])).values()];
    return bindRemovals(data.rows.flatMap(row => row.entries), rules, data.removals);
  }
  withdrawals() { return structuredClone(this.#policy()); }
  resources() {
    const entries = mergeSourceResources(this.#data.rows.flatMap(row => row.entries));
    return structuredClone(applyRemovals({ entries }, this.#policy()).entries);
  }
  async download(id, revision) {
    const item = this.resources().find(item => item.id === id && item.revision === revision);
    if (!item?.bundle) throw new CommunityError(409, '该版本发布包不可用，请刷新后查看当前版本');
    const key = `${id}:${revision}`;
    if (!this.#packages.has(key)) this.#packages.set(key, packageFile(item).catch(error => { this.#packages.delete(key); throw new CommunityError(502, `资源包获取失败：${error.message}`); }));
    return this.#packages.get(key);
  }
  status() {
    const rules = this.#policy(), context = this.#data.rows.flatMap(row => row.entries);
    return SOURCE_DEFINITIONS.map(definition => {
      const row = applyRemovals(this.#data.rows.find(row => row.id === definition.id), rules, context);
      const failure = this.#failures.get(row.id);
      const automatic = Boolean(definition.automaticDiscovery && (row.automatic ?? true));
      const next = failure?.next || row.nextAutomaticAt || (row.discovery ? new Date(Date.parse(row.checkedAt) + (row.error ? retryInterval : interval)).toISOString() : new Date(0).toISOString());
      return { ...definition, state: failure ? (row.entries.length ? 'stale' : 'error') : row.state, count: row.entries.length, checkedAt: row.checkedAt, lastSuccess: row.lastSuccess, error: failure?.error || row.error, automatic, syncing: this.#pending.has(row.id), nextCheckAt: automatic ? next : '', discovery: row.discovery || null };
    });
  }
  setAutomatic(id, enabled) {
    if (this.#closed) throw Error('来源管理器已关闭');
    if (typeof enabled !== 'boolean' || !SOURCE_DEFINITIONS.some(row => row.id === id && row.automaticDiscovery)) throw new CommunityError(400, '该来源不支持此自动发现设置');
    const next = structuredClone(this.#data);
    const row = next.rows.find(row => row.id === id);
    if (row.automatic === enabled) return this.status();
    row.automatic = enabled;
    if (enabled) row.nextAutomaticAt = new Date(this.#now()).toISOString();
    this.#persist(next);
    return this.status();
  }
  async syncDue() {
    if (this.#closed) return;
    const due = this.status().filter(row => row.automatic && !row.syncing && Date.parse(row.nextCheckAt) <= this.#now());
    await Promise.allSettled(due.map(row => this.sync(row.id)));
  }
  async close() {
    this.#closed = true;
    this.#abort.abort();
    await Promise.allSettled([...this.#pending.values()]);
  }
  async sync(id) {
    if (this.#closed) throw Error('来源管理器已关闭');
    if (!sourceIds.includes(id)) throw Error('不支持的来源');
    if (this.#pending.has(id)) return this.#pending.get(id);
    const pending = this.#sync(id).catch(error => {
      this.#failures.set(id, { error: '来源更新未完成，请重试', next: new Date(this.#now() + retryInterval).toISOString() });
      throw error;
    }).finally(() => this.#pending.delete(id)).then(() => this.status());
    this.#pending.set(id, pending);
    return pending;
  }
  async #sync(id) {
    let result, error = '';
    try {
      result = sourceDiscovery(await this.#read[id]());
      if (result.removals !== undefined && id !== 'community') throw Error('只有已审核的社区索引可以更新移除规则');
      for (const item of result.entries) if (item.sourceId !== id) throw Error('来源返回了其他目录的资源');
    } catch (reason) { error = reason instanceof Error ? reason.message : '来源读取失败'; }
    if (this.#closed) return this.status();
    const next = structuredClone(this.#data);
    const row = next.rows.find(row => row.id === id);
    row.checkedAt = new Date(this.#now()).toISOString();
    row.nextAutomaticAt = new Date(this.#now() + (error ? retryInterval : interval)).toISOString();
    if (error) { row.error = error; row.state = row.entries.length ? 'stale' : 'error'; }
    else {
      if (id === 'community' && result.removals !== undefined) next.removals = bindRemovals([...next.rows.flatMap(value => value.entries), ...result.entries], result.removals, next.removals);
      const priorEntries = new Map(row.entries.map(item => [item.id, item]));
      row.entries = result.entries.map(item => {
        const hash = fingerprint(item);
        const previous = next.history[item.id];
        const old = priorEntries.get(item.id);
        const revision = previous ? previous.revision + (previous.fingerprint !== hash || !old ? 1 : 0) : 1;
        next.history[item.id] = { revision, fingerprint: hash };
        return old && revision === old.revision ? old : { ...item, revision, updatedAt: row.checkedAt };
      });
      row.discovery = result.discovery || null;
      row.lastSuccess = row.checkedAt; row.error = ''; row.state = 'fresh';
    }
    this.#persist(next);
    this.#failures.delete(id);
    if (!error) this.#packages.clear();
    this.#change(this.resources());
    return this.status();
  }
  #persist(next) {
    next.removals = this.#policy(next);
    const temporary = this.#file + '.tmp';
    writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n');
    renameSync(temporary, this.#file);
    this.#data = next;
  }
}
