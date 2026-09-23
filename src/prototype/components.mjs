import { isInstalled } from './state.mjs';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
export function icon(name, cls = '') {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    box: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7 5.8l9 5"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
    link: '<path d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 10a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1"/>',
    slash: '<path d="m15 3-6 18M5 12h1m12 0h1"/>',
    text: '<path d="M5 4h14M12 4v16M8 20h8M5 4v3m14-3v3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    book: '<path d="M4 4h6l2 2 2-2h6v16h-6l-2 1-2-1H4V4Zm8 2v15"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    star: '<path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1 3-6Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chat: '<path d="M4 4h16v12H9l-5 4V4Z"/>',
    refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
    leaf: '<path d="M5 19C0 8 9 2 21 3c1 12-6 19-16 16Zm0 0L16 8"/>',
    external: '<path d="M14 3h7v7m0-7L11 13M10 5H3v16h16v-7"/>'
  };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
}
export const typeClass = type => ({ 插件: 'plugin', Skill: 'skill', MCP: 'mcp', Slash: 'slash', Prompt: 'prompt', 主题: 'theme' })[type] || 'prompt';
export const badge = (label, cls = '') => `<span class="badge ${cls}">${esc(label)}</span>`;
export const button = (label, attrs = '', variant = 'secondary') => `<button class="button ${variant}" ${attrs}>${label}</button>`;
export function card(item, state) {
  return `<a class="resource-card" href="#/resource/${encodeURIComponent(item.id)}${item.savedCopy?'?copy=1':''}"><div class="card-head"><span class="resource-icon ${typeClass(item.type)}">${icon(item.icon)}</span>${badge(item.type)}</div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><div class="card-foot"><span>${esc(item.author)}</span>${isInstalled(state,item.id) ? badge('已添加 · 演示','success') : icon('arrow')}</div></a>`;
}
export const empty = (title, text, action = '') => `<div class="empty">${icon('book')}<h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`;
export function field(label, id, value = '', { multiline = false, required = false, placeholder = '', extra = '' } = {}) {
  const attributes = `id="${esc(id)}" name="${esc(id)}" ${required ? 'required' : ''} placeholder="${esc(placeholder)}" ${extra}`;
  return `<label class="field" for="${esc(id)}"><span>${esc(label)}${required ? '<span class="required"> *</span>' : ''}</span>${multiline ? `<textarea ${attributes}>${esc(value)}</textarea>` : `<input ${attributes} value="${esc(value)}">`}</label>`;
}
export function safeLink(url, label = '查看来源') {
  try { if (new URL(url).protocol !== 'https:') return ''; } catch { return ''; }
  return `<a class="text-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon('external')}</a>`;
}
