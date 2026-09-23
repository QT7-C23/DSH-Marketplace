import { createHash } from 'node:crypto';
import { CommunityError } from '../community/contracts.mjs';
import { githubCredentials, validateGitHubToken } from './github-credentials.mjs';

/** Credentials belong only to read requests on GitHub's exact API origin. */
export function createGitHubFetch({ store = githubCredentials, request = fetch } = {}) {
  return async (url, options = {}) => {
    const target = new URL(url);
    const headers = new Headers(options.headers);
    headers.delete('authorization');
    const eligible = target.origin === 'https://api.github.com' && !target.username && !target.password && (options.method || 'GET').toUpperCase() === 'GET';
    const token = eligible ? await store.read() : null;
    if (token) headers.set('authorization', `Bearer ${token}`);
    try { return await request(url, { ...options, headers, redirect: 'error' }); }
    catch (error) {
      if (!token) throw error;
      // Never propagate an upstream exception that may include request headers.
      const safe = new Error('GitHub 连接失败，请稍后重试');
      if (error.name === 'TimeoutError' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') safe.name = 'TimeoutError';
      throw safe;
    }
  };
}
export const githubFetch = createGitHubFetch();
const fingerprint = token => token ? createHash('sha256').update(token).digest('hex') : '';

/** Settings expose connection state and quota, never the saved credential. */
export class GitHubConnection {
  #store;
  #request;
  #onChange;
  #checked;
  #busy = false;
  constructor({ store = githubCredentials, request = fetch, onChange = () => {} } = {}) { this.#store = store; this.#request = request; this.#onChange = onChange; }
  async read() {
    try {
      const token = await this.#store.read();
      if (this.#checked?.fingerprint === fingerprint(token)) return this.#checked.status;
      return { configured: Boolean(token), state: token ? 'unchecked' : 'anonymous' };
    } catch { return { configured: true, state: 'unreadable' }; }
  }
  async #check(token) {
    let response;
    try {
      response = await createGitHubFetch({ store: { read: async () => token }, request: this.#request })('https://api.github.com/rate_limit', {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'DSH-Extension-Market', 'x-github-api-version': '2022-11-28' }, signal: AbortSignal.timeout(12000),
      });
    } catch { throw new CommunityError(502, 'GitHub 连接失败，请稍后重试'); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new CommunityError(response.status === 401 ? 401 : 502, response.status === 401 ? 'GitHub 令牌无效或已过期' : 'GitHub 暂时拒绝请求，请稍后验证');
    }
    try {
      const reader = response.body.getReader(); let text = ''; let size = 0;
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 65536) { await reader.cancel(); throw Error(); } text += new TextDecoder().decode(chunk.value); } }
      finally { reader.releaseLock(); }
      const { limit, remaining, reset } = JSON.parse(text).resources.core;
      if (![limit, remaining, reset].every(value => Number.isSafeInteger(value) && value >= 0) || remaining > limit || reset > 8640000000000) throw Error();
      return { configured: Boolean(token), state: remaining === 0 ? 'limited' : token ? 'connected' : 'anonymous', limit, remaining, resetAt: new Date(reset * 1000).toISOString(), checkedAt: new Date().toISOString() };
    } catch { throw new CommunityError(502, 'GitHub 连接失败，请稍后重试'); }
  }
  async run(command) {
    if (!['save', 'check', 'remove'].includes(command.action)) throw new CommunityError(400, '不支持的 GitHub 连接操作');
    if (this.#busy) throw new CommunityError(409, 'GitHub 连接操作正在进行');
    this.#busy = true;
    try {
      if (command.action === 'remove') { await this.#store.remove(); this.#checked = null; await this.#onChange(); return this.read(); }
      const token = command.action === 'save' ? validateGitHubToken(command.token) : await this.#store.read();
      let status;
      try { status = await this.#check(token); }
      catch (error) {
        if (command.action === 'check') this.#checked = { fingerprint: fingerprint(token), status: { configured: Boolean(token), state: error.status === 401 ? 'invalid' : 'unavailable' } };
        throw error;
      }
      if (command.action === 'save') { await this.#store.save(token); await this.#onChange(); }
      this.#checked = { fingerprint: fingerprint(token), status };
      return status;
    } finally { this.#busy = false; }
  }
}
