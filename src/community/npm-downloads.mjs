import { npmPackageOf, npmSnapshot } from './npm-metrics.mjs';
const unavailable = old => old?.value.count != null ? { ...old.value, state: 'stale' } : { count: null, start: '', end: '', checkedAt: '', state: 'unavailable' };

/** Public package-wide download counts; no GitHub credentials or model calls. */
export class NpmDownloads {
  #request; #now; #cache = new Map(); #pending = new Map(); #running = new Set(); #waiting = []; #closed = false;
  constructor({ request = fetch, now = Date.now } = {}) { this.#request = request; this.#now = now; }
  async read(resources, signal) {
    const names = [...new Set(resources.map(npmPackageOf).filter(Boolean))];
    if (names.length > 60) throw Error('npm statistics are limited to the visible page');
    return Object.fromEntries(await Promise.all(names.map(async name => [name, await this.#get(name, signal)])));
  }
  async close() {
    this.#closed = true;
    const jobs = [...new Set([...this.#pending.values(), ...this.#running])];
    for (const job of jobs) this.#cancel(job);
    await Promise.all(jobs.map(job => job.promise));
  }
  #get(name, signal) {
    const old = this.#cache.get(name);
    if (signal?.aborted || this.#closed) return unavailable(old);
    if (old && this.#now() < old.next) return old.value;
    let job = this.#pending.get(name);
    if (!job) {
      if (this.#pending.size >= 128) return unavailable(old);
      job = { name, old, controller: new AbortController(), users: new Set(), done: false };
      job.promise = new Promise(resolve => { job.resolve = resolve; });
      this.#pending.set(name, job); this.#waiting.push(job);
    }
    if (job.users.size >= 256) return unavailable(old);
    const consumer = {};
    job.users.add(consumer);
    const result = new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true; signal?.removeEventListener('abort', aborted); job.users.delete(consumer);
        if (!job.users.size && !job.done) this.#cancel(job);
        resolve(value);
      };
      const aborted = () => finish(unavailable(old));
      signal?.addEventListener('abort', aborted, { once: true });
      job.promise.then(finish);
    });
    this.#pump();
    return result;
  }
  #cancel(job) {
    job.controller.abort();
    if (this.#pending.get(job.name) === job) this.#pending.delete(job.name);
    if (!this.#running.has(job)) {
      this.#waiting = this.#waiting.filter(value => value !== job);
      this.#settle(job, unavailable(job.old));
    }
  }
  #settle(job, value) {
    job.done = true;
    if (this.#pending.get(job.name) === job) this.#pending.delete(job.name);
    this.#running.delete(job); job.resolve(value); this.#pump();
  }
  #pump() {
    while (!this.#closed && this.#running.size < 4 && this.#waiting.length) {
      const job = this.#waiting.shift(); this.#running.add(job);
      this.#fetch(job.name, job.old, job.controller.signal).then(value => this.#settle(job, value));
    }
  }
  async #fetch(name, old, signal) {
    let value, next = this.#now() + 5 * 60000;
    try {
      const response = await this.#request(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]), redirect: 'error', headers: { accept: 'application/json' } });
      if (!response.ok) {
        const retry = Number(response.headers.get('retry-after'));
        if (Number.isFinite(retry) && retry > 0) next = Math.max(next, this.#now() + Math.min(retry, 86400) * 1000);
        throw Error('npm unavailable');
      }
      const reader = response.body.getReader(), chunks = []; let size = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.length;
          if (size > 4096) { await reader.cancel(); throw Error('npm response too large'); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      if (data.package !== name) throw Error('npm package mismatch');
      value = { count: data.downloads, start: data.start, end: data.end, checkedAt: new Date(this.#now()).toISOString(), state: 'fresh' };
      npmSnapshot({ [name]: value });
      next = this.#now() + 24 * 3600000;
    } catch {
      value = unavailable(old);
    }
    if (signal.aborted) return unavailable(old);
    this.#cache.delete(name);
    this.#cache.set(name, { value, next });
    if (this.#cache.size > 2048) this.#cache.delete(this.#cache.keys().next().value);
    return value;
  }
}
