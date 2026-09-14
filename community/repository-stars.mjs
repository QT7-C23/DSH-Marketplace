import { repositoryOf } from './metrics.mjs';
import { githubFetch } from '../sources/github-auth.mjs';

/** Public repository counts use the backend's domain-restricted GitHub connection. */
export class RepositoryStars {
  #request;
  #now;
  #cache = new Map();
  #pending = new Map();
  constructor({ request = githubFetch, now = Date.now } = {}) { this.#request = request; this.#now = now; }
  async invalidate() { await Promise.allSettled([...this.#pending.values()]); this.#cache.clear(); }
  async read(resources) {
    const repos = [...new Set(resources.map(item => repositoryOf(item.url)).filter(Boolean))];
    return Object.fromEntries(await Promise.all(repos.map(async repo => [repo, await this.#get(repo)])));
  }
  async #get(repo) {
    const old = this.#cache.get(repo);
    if (old && this.#now() < old.next) return old.value;
    if (this.#pending.has(repo)) return this.#pending.get(repo);
    const pending = this.#fetch(repo, old);
    this.#pending.set(repo, pending);
    try { return await pending; } finally { this.#pending.delete(repo); }
  }
  async #fetch(repo, old) {
    let next = this.#now() + 5 * 60 * 1000;
    let value;
    try {
      const response = await this.#request(`https://api.github.com/repos/${repo}`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'DSH-Extension-Market', 'x-github-api-version': '2022-11-28' }, signal: AbortSignal.timeout(6000), redirect: 'error' });
      if (!response.ok) {
        const retry = response.headers.get('retry-after');
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        if (retry) next = Math.max(next, /^\d+$/.test(retry) ? this.#now() + Number(retry) * 1000 : Date.parse(retry) || 0);
        if ([403, 429].includes(response.status) && Number.isFinite(reset)) next = Math.max(next, reset);
        throw Error('GitHub unavailable');
      }
      const data = await response.json();
      if (!Number.isSafeInteger(data?.stargazers_count) || data.stargazers_count < 0) throw Error('Invalid GitHub count');
      value = { count: data.stargazers_count, checkedAt: new Date(this.#now()).toISOString(), state: 'fresh' };
      next = this.#now() + 30 * 60 * 1000;
    } catch {
      value = old?.value.count != null ? { ...old.value, state: 'stale' } : { count: null, checkedAt: '', state: 'unavailable' };
    }
    this.#cache.set(repo, { value, next });
    return value;
  }
}
