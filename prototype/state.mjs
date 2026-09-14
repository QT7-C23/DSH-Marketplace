import { SEEDS, TYPES, ACTORS } from './catalog.mjs';

export function initialState() {
  return { schema: 1, actor: 'reader', publications: [], drafts: { reader: null, author: null }, saved: { reader: [], author: [] }, tasks: { reader: '', author: '' }, installs: { reader: {}, author: {} }, history: { reader: [], author: [] }, feedback: {}, theme: 'light', source: { status: 'idle', count: null, checkedAt: null, error: null } };
}
export const catalog = state => [...SEEDS, ...state.publications.filter(item => item.status === 'published')];
export const resource = (state, id) => catalog(state).find(item => item.id === id) || state.saved[state.actor].find(item => item.id === id);
export const fields = body => [...new Set([...body.matchAll(/\{\{([^{}]+)\}\}/g)].map(match => match[1]))];
export function fillTemplate(body, values) {
  for (const field of fields(body)) if (!String(values[field] ?? '').trim()) throw new Error(`请填写「${field}」`);
  return body.replace(/\{\{([^{}]+)\}\}/g, (_, field) => String(values[field]));
}
export function isInstalled(state, id) {
  const item = resource(state, id);
  return Boolean(item && state.installs[state.actor][item.parent || item.id]);
}
function validatePublication(value) {
  if (!TYPES.includes(value.type)) throw new Error('请选择资源类型');
  if (!value.title?.trim() || !value.summary?.trim()) throw new Error('请填写资源名称和用途');
  if (!value.version?.trim()) throw new Error('请填写版本');
  if (value.title.length > 80 || value.summary.length > 300 || (value.body || '').length > 50000) throw new Error('内容超过原型支持的长度');
  if (value.type === 'Prompt' && !value.body?.trim()) throw new Error('请填写提示词内容');
  if (value.type !== 'Prompt' || value.url) {
    try { const url = new URL(value.url); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); }
    catch { throw new Error('请填写不含账户信息的 HTTPS 发布地址'); }
  }
}
export function transition(current, action) {
  const state = structuredClone(current);
  const actor = state.actor;
  const item = action.id && resource(state, action.id);
  const owned = () => {
    const existing = state.publications.find(entry => entry.id === action.id);
    if (!existing || existing.owner !== actor) throw new Error('只有原作者可以维护这份资源');
    return existing;
  };
  switch (action.type) {
    case 'actor': if (!ACTORS[action.value]) throw new Error('未知体验身份'); state.actor = action.value; break;
    case 'theme': state.theme = action.value === 'dark' ? 'dark' : 'light'; break;
    case 'draft': state.drafts[actor] = action.value; break;
    case 'publish': {
      validatePublication(action.value);
      const existing = state.publications.find(entry => entry.id === action.id);
      if (existing) {
        owned();
        if (existing.type !== action.value.type) throw new Error('更新时不能改变资源类型');
        if (existing.version === action.value.version) throw new Error('请为更新填写不同的版本号');
      }
      if (SEEDS.some(entry => entry.id === action.id)) throw new Error('不能修改来源样本');
      const clean = Object.fromEntries(['type', 'title', 'summary', 'body', 'url', 'version'].map(key => [key, String(action.value[key] || '').trim()]));
      const entry = { ...clean, id: action.id || crypto.randomUUID(), owner: actor, author: ACTORS[actor], source: '本机演示社区', tag: '社区分享', icon: ({ Prompt: 'text', Skill: 'spark', MCP: 'link', Slash: 'slash', 插件: 'box' })[clean.type], status: 'published', requirements: '本机投稿示例；实际 DSH 适配尚未验证。', versions: [...(existing?.versions || []), { version: clean.version, body: clean.body, summary: clean.summary }] };
      if (existing) state.publications[state.publications.indexOf(existing)] = entry;
      else state.publications.push(entry);
      state.drafts[actor] = null;
      break;
    }
    case 'withdraw': owned().status = 'withdrawn'; break;
    case 'save': if (!item) throw new Error('资源已不可用'); if (!state.saved[actor].some(entry => entry.id === action.id)) state.saved[actor].push(structuredClone(item)); break;
    case 'removeSaved': state.saved[actor] = state.saved[actor].filter(entry => entry.id !== action.id); break;
    case 'updateSaved': {
      const latest = catalog(state).find(entry => entry.id === action.id);
      if (!latest) throw new Error('当前没有可获取的新版本');
      const index = state.saved[actor].findIndex(entry => entry.id === action.id);
      if (index < 0) throw new Error('尚未保存资源');
      state.saved[actor][index] = structuredClone(latest); break;
    }
    case 'task': state.tasks[actor] = String(action.value); break;
    case 'appendTask': state.tasks[actor] = [state.tasks[actor], String(action.value)].filter(Boolean).join('\n\n'); break;
    case 'install': case 'uninstall': {
      if (!item || item.type === 'Prompt') throw new Error('此资源不使用安装操作');
      state.history[actor].push({ label: `${action.type === 'install' ? '添加' : '移除'} ${item.title}`, snapshot: structuredClone(state.installs[actor]) });
      const key = item.parent || item.id;
      if (action.type === 'install') state.installs[actor][key] = { status: 'demo', config: action.config || '' };
      else delete state.installs[actor][key];
      break;
    }
    case 'restore': {
      const last = state.history[actor].pop(); if (!last) throw new Error('没有可恢复的操作');
      state.installs[actor] = last.snapshot; break;
    }
    case 'feedback': {
      if (!item || !String(action.value || '').trim()) throw new Error('请填写具体反馈');
      (state.feedback[action.id] ||= []).push({ actor, text: String(action.value).slice(0,2000) }); break;
    }
    case 'sourceSuccess': state.source = { ...action.value, status: 'success', error: null }; break;
    case 'sourceError': state.source.status = 'error'; state.source.error = String(action.value); break;
    default: throw new Error('不支持的操作');
  }
  return state;
}
export function parseState(raw) {
  try {
    const value = JSON.parse(raw);
    const record = item => item !== null && typeof item === 'object' && !Array.isArray(item);
    const strings = (item, keys) => record(item) && keys.every(key => typeof item[key] === 'string');
    const entry = item => strings(item, ['id', 'title', 'summary', 'body', 'url', 'version', 'author', 'owner', 'source', 'requirements', 'icon']) && TYPES.includes(item.type)
      && (item.versions === undefined || (Array.isArray(item.versions) && item.versions.every(version => strings(version, ['version', 'body', 'summary']))));
    const installs = items => record(items) && Object.values(items).every(item => strings(item, ['status', 'config']) && item.status === 'demo');
    if (!record(value) || value.schema !== 1 || !Object.hasOwn(ACTORS, value.actor) || !['light', 'dark'].includes(value.theme)) throw Error();
    if (!Array.isArray(value.publications) || !value.publications.every(item => entry(item) && Object.hasOwn(ACTORS, item.owner) && ['published', 'withdrawn'].includes(item.status))) throw Error();
    if (!record(value.source) || !['idle', 'success', 'error'].includes(value.source.status) || !record(value.feedback)) throw Error();
    if (!Object.values(value.feedback).every(items => Array.isArray(items) && items.every(item => strings(item, ['actor', 'text']) && Object.hasOwn(ACTORS, item.actor)))) throw Error();
    for (const actor of Object.keys(ACTORS)) {
      if (!Array.isArray(value.saved?.[actor]) || !value.saved[actor].every(entry) || typeof value.tasks?.[actor] !== 'string' || !installs(value.installs?.[actor])) throw Error();
      if (!Array.isArray(value.history?.[actor]) || !value.history[actor].every(item => strings(item, ['label']) && installs(item.snapshot))) throw Error();
      const draft = value.drafts?.[actor];
      if (draft !== null && (!strings(draft, ['type', 'title', 'summary', 'body', 'url', 'version']) || !TYPES.includes(draft.type))) throw Error();
    }
    return value;
  } catch { throw new Error('本机存储无法读取，原始记录已保留。请导出备份后再处理。'); }
}
