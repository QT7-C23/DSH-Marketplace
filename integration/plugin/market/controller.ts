import { snapshot, exportFile, type ExportFile, type Snapshot, type Resource } from '../../../community/contracts.mjs';
import { SEEDS } from '../../../prototype/catalog.mjs';
import { downloadFile } from '../../../community/download.mjs';
import { emptyLocal, draftData, type Draft, type LocalData, type LocalPort } from './local.mjs';
import { githubPrompts } from '../../../catalog/resources.mjs';
import { starSnapshot, type RepositoryStar } from '../../../community/metrics.mjs';
import { sourceSnapshot, type SourceStatus } from '../../../sources/contracts.mjs';
import { languageNames } from '../../../languages/index.mjs';

export type { Draft };
export type View = 'discover' | 'detail' | 'saved' | 'publish' | 'sources' | 'updates' | 'installed';
export type State = { data: Snapshot | null; sources: SourceStatus[]; sourcePending: string; stars: Record<string, RepositoryStar>; starsLoading: boolean; starsError: string; local: LocalData; view: View; detail: Resource | null; detailLoading: boolean; editor: Draft; dirty: boolean; loading: boolean; pending: boolean; error: string; notice: string; query: string; filter: string; category: string; sort: string };
export const blank = (): Draft => ({ type: 'Prompt', title: '', summary: '', version: '1.0.0', body: '', url: '', author: '', resourceId: '', license: '', language: 'zh' });
export const samples: Resource[] = SEEDS.map(item => ({ ...item, revision: 0, status: 'sample', updatedAt: '' }));
export const curated: Resource[] = githubPrompts;
export function sameResource(a: Resource, b: Resource) {
  const ids = new Set([a.id, ...(a.aliasIds || [])]);
  return [b.id, ...(b.aliasIds || [])].some(id => ids.has(id));
}
export function savedUpdates(saved: Resource[], catalog: Resource[]) {
  return saved.flatMap(item => {
    const latest = catalog.find(candidate => sameResource(candidate, item));
    return latest && (latest.id !== item.id || latest.version !== item.version || latest.revision > item.revision) ? [{ saved: item, latest }] : [];
  });
}

export interface CommunityPort {
  readResource?(id: string, revision: number): Promise<Resource>;
  read(): Promise<Snapshot>; readStars(ids?: string[]): Promise<Record<string, RepositoryStar>>; readSources(): Promise<SourceStatus[]>;
  syncSource(id: string): Promise<SourceStatus[]>; setSourceAutomatic(id: string, enabled: boolean): Promise<SourceStatus[]>;
  write(command: object): Promise<unknown>;
}
export function httpPort(language = () => 'zh-CN'): CommunityPort {
  async function call(command?: object, route = command ? '/api/community' : '/api/community/read') {
    const response = await fetch(route, { method: command ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'x-market-language': language(), ...(command ? { 'content-type': 'application/json', 'x-community-request': '1' } : {}) }, ...(command ? { body: JSON.stringify(command) } : {}), signal: AbortSignal.timeout(command ? 60000 : 10000) });
    let value;
    try {
      value = await response.json();
      if (!value || typeof value !== 'object' || (Array.isArray(value) && !['/api/community/sources', '/api/community/sources/read'].includes(route))) throw Error();
    } catch { throw Error('市场响应格式异常，请重试'); }
    if (!response.ok) throw Error(typeof value.error === 'string' ? value.error : '市场服务暂时不可用，请重试');
    return value;
  }
  return {
    readResource: async (id, revision) => {
      const value = await call(undefined, '/api/community/resource?' + new URLSearchParams({ id, revision: String(revision) }));
      const [item] = snapshot({ schema: 2, catalog: [value], stats: {} }).catalog;
      if (item.id !== id || item.revision !== revision) throw Error('该版本不可用，请刷新后重试');
      return item;
    },
    read: async () => snapshot(await call()), readStars: async (ids = []) => starSnapshot(await call(undefined, '/api/community/stars' + (ids.length ? '?ids=' + encodeURIComponent(ids.join(',')) : ''))),
    readSources: async () => sourceSnapshot(await call(undefined, '/api/community/sources/read')),
    syncSource: async sourceId => sourceSnapshot(await call({ sourceId }, '/api/community/sources')),
    setSourceAutomatic: async (sourceId, enabled) => sourceSnapshot(await call({ sourceId, action: 'setAutomatic', enabled }, '/api/community/sources')),
    write: call,
  };
}

/** Local preferences and saved versions are independent from catalog updates. */
export function createMarket(port: CommunityPort, localPort: LocalPort) {
  let state: State = { data: null, sources: [], sourcePending: '', stars: {}, starsLoading: false, starsError: '', local: emptyLocal(), view: 'discover', detail: null, detailLoading: false, editor: blank(), dirty: false, loading: false, pending: false, error: '', notice: '', query: '', filter: '全部', category: 'all', sort: 'recent' };
  let localError = '';
  try { state.local = { ...emptyLocal(), ...localPort.read() }; state.editor = state.local.draft || blank(); }
  catch (error) { localError = message(error); state.error = localError; }
  const listeners = new Set<() => void>();
  const selections = new Map<string, Resource>();
  let retry: { key: string; requestId: string } | null = null;
  let disposed = false, readingSources = false, readGeneration = 0, sourceGeneration = 0;
  let nextStarIds: string[] | null = null;
  let detailGeneration = 0;
  const emit = () => { if (!disposed) for (const listener of listeners) listener(); };
  const patch = (value: Partial<State>) => { if (!disposed) { state = { ...state, ...value }; emit(); } };
  async function readSources() {
    if (readingSources || disposed || state.sourcePending) return;
    readingSources = true;
    const generation = sourceGeneration;
    try {
      const sources = await port.readSources();
      if (disposed || generation !== sourceGeneration) return;
      const changed = sources.some(row => state.sources.some(old => old.id === row.id && old.lastSuccess !== row.lastSuccess));
      patch({ sources });
      if (changed) await refresh();
    } catch (error) { if (generation === sourceGeneration) patch({ error: message(error) }); }
    finally { readingSources = false; }
  }
  async function changeSource(id: string, enabled?: boolean) {
    if (state.sourcePending || disposed) return;
    sourceGeneration++;
    patch({ sourcePending: id, error: '', notice: '' });
    try {
      const sources = enabled === undefined ? await port.syncSource(id) : await port.setSourceAutomatic(id, enabled);
      if (disposed) return;
      sourceGeneration++;
      patch({ sources, notice: enabled === undefined ? sources.find(row => row.id === id)?.syncing ? '来源检查已开始，可继续浏览' : sources.find(row => row.id === id)?.state === 'fresh' ? '来源已更新，收藏版本保持原样' : '更新未完成，保留上次目录' : enabled ? '已恢复自动检查' : '已暂停后续自动检查；当前检查会完成' });
      await refresh();
    } catch (error) { patch({ error: message(error) }); }
    finally { patch({ sourcePending: '' }); }
  }
  async function refreshStars(ids = (state.data?.catalog || curated).slice(0, 48).map(item => item.id)) {
    if (disposed) return;
    if (state.starsLoading) { nextStarIds = ids; return; }
    patch({ starsLoading: true, starsError: '' });
    try { const stars = await port.readStars(ids.slice(0, 60)); patch({ stars: { ...state.stars, ...stars } }); }
    catch (error) { patch({ starsError: message(error), stars: Object.fromEntries(Object.entries(state.stars).map(([repo, value]) => [repo, value.count === null ? value : { ...value, state: 'stale' as const }])) }); }
    finally {
      patch({ starsLoading: false });
      if (nextStarIds) { const next = nextStarIds; nextStarIds = null; await refreshStars(next); }
    }
  }
  function localWrite(value: LocalData, notice: string) {
    try { if (localError) throw Error(localError); localPort.write(value); patch({ local: value, notice, error: '' }); return true; }
    catch (error) { patch({ error: message(error) }); return false; }
  }
  async function completeResource(resource: Resource) {
    if (!port.readResource) throw Error('市场服务暂时不可用，请重试');
    const full = await port.readResource(resource.id, resource.revision);
    if (full.id !== resource.id || full.revision !== resource.revision || full.type !== resource.type || full.hasDetails || full.type === 'MCP' && !full.serverDefinition) throw Error('资源详情不完整，原收藏保持不变');
    return full;
  }
  function saveComplete(resource: Resource, update: boolean) {
    const existing = state.local.saved.find(item => sameResource(item, resource));
    const saved = existing ? update ? state.local.saved.flatMap(item => item === existing ? [structuredClone(resource)] : sameResource(item, resource) ? [] : [item]) : state.local.saved : [structuredClone(resource), ...state.local.saved];
    const ratings = { ...state.local.ratings };
    if (update && existing && ratings[resource.id] === undefined && ratings[existing.id] !== undefined) ratings[resource.id] = ratings[existing.id];
    return localWrite({ ...state.local, saved, ratings }, update ? '已更新本机版本' : '已收藏到本机');
  }
  async function refresh() {
    const generation = ++readGeneration;
    patch({ loading: true, error: localError });
    try { const data = await port.read(); if (generation === readGeneration) patch({ data }); }
    catch (error) { if (generation === readGeneration) patch({ error: message(error) }); }
    finally { if (generation === readGeneration) patch({ loading: false }); }
  }
  async function write(command: object, notice: string, receive?: (value: unknown) => void) {
    if (state.pending || disposed) return false;
    const key = JSON.stringify(command);
    retry = retry?.key === key ? retry : { key, requestId: crypto.randomUUID() };
    patch({ pending: true, error: '', notice: '' });
    try {
      const value = await port.write({ ...command, requestId: retry.requestId });
      if (disposed) return false;
      receive?.(value); retry = null; patch({ notice }); await refresh(); return true;
    } catch (error) { patch({ error: message(error) }); return false; }
    finally { patch({ pending: false }); }
  }
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state, refresh, refreshStars, readSources, syncSource: (id: string) => changeSource(id),
    setSourceAutomatic: (id: string, enabled: boolean) => changeSource(id, enabled), write,
    setLanguage: (language: string) => Object.hasOwn(languageNames, language) ? localWrite({ ...state.local, language }, '') : false,
    rateLocal: (id: string, score: number | null) => {
      if (!id || (score !== null && (!Number.isInteger(score) || score < 1 || score > 5))) return false;
      const ratings = { ...state.local.ratings };
      if (score === null) delete ratings[id]; else ratings[id] = score;
      return localWrite({ ...state.local, ratings }, score === null ? '评分已清除' : '评分已保存到本机');
    },
    saveLocal: (resource: Resource, update = false) => {
      if (!resource.hasDetails) return saveComplete(resource, update);
      const previous = state.local.saved.find(item => sameResource(item, resource));
      return (async () => {
        try {
          const full = await completeResource(resource);
          if (disposed) return false;
          if (state.local.saved.find(item => sameResource(item, resource)) !== previous) throw Error('本机收藏已变化，请重新选择更新');
          return saveComplete(full, update);
        } catch (error) { patch({ error: message(error) }); return false; }
      })();
    },
    removeLocal: (id: string) => localWrite({ ...state.local, saved: state.local.saved.filter(item => item.id !== id) }, '已移除本机副本'),
    saveLocalDraft: () => {
      try { if (!localWrite({ ...state.local, draft: draftData(state.editor) }, '草稿已保存到本机')) return false; patch({ dirty: false }); return true; }
      catch (error) { patch({ error: message(error) }); return false; }
    },
    download: async (resource: Resource, descriptionOnly = false): Promise<ExportFile | null> => {
      const local = state.local.saved.find(item => item.id === resource.id && item.revision === resource.revision);
      if (resource.status === 'sample' || (local && !state.data?.catalog.some(item => item.id === resource.id && item.revision === resource.revision))) {
        patch({ notice: '已导出本机资料' }); return exportFile(downloadFile(local || resource));
      }
      let file: ExportFile | null = null;
      await write({ action: 'download', id: resource.id, baseRevision: resource.revision, ...(resource.bundle && !descriptionOnly ? { format: 'package' } : {}) }, '文件已准备好', value => { file = exportFile(value); });
      return file;
    },
    navigate: (view: View) => { detailGeneration++; patch({ view, detail: null, detailLoading: false, notice: '', error: '' }); },
    open: async (detail: Resource) => {
      const generation = ++detailGeneration;
      if (!detail.hasDetails) { patch({ detail, view: 'detail', detailLoading: false, notice: '', error: '' }); return; }
      patch({ detail, view: 'detail', detailLoading: true, notice: '', error: '' });
      try {
        const full = await completeResource(detail);
        if (generation === detailGeneration) patch({ detail: full });
      } catch (error) { if (generation === detailGeneration) patch({ error: message(error) }); }
      finally { if (generation === detailGeneration) patch({ detailLoading: false }); }
    },
    edit: () => patch({ view: 'publish', error: '', notice: '' }),
    localDraft: () => patch({ view: 'publish', error: '', notice: '' }),
    change: (editor: Draft) => patch({ editor, dirty: true, notice: '' }),
    search: (query: string) => patch({ query }), filter: (filter: string) => patch({ filter }),
    category: (category: string) => patch({ category }), sort: (sort: string) => patch({ sort }),
    error: (error: unknown) => patch({ error: message(error) }),
    selected: (sessionId: string) => selections.get(sessionId),
    select: (sessionId: string, resource: Resource) => { selections.set(sessionId, { ...resource }); emit(); },
    dispose: () => { disposed = true; listeners.clear(); selections.clear(); },
  };
}
export type MarketController = ReturnType<typeof createMarket>;
export const message = (error: unknown) => error instanceof TypeError && /fetch/i.test(error.message) ? '连接中断，请重试；已填写内容保留' : error instanceof Error && error.name === 'TimeoutError' ? '响应超时，请重试；已填写内容保留' : error instanceof Error ? error.message : '市场服务暂时不可用，请重试';
