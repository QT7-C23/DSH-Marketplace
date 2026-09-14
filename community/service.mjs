import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { CommunityError, exportFile } from './contracts.mjs';
import { downloadFile } from './download.mjs';

/** Public catalog and local download counts. Existing private tables are left untouched. */
export class Community {
  #db;
  #items;
  #closed = false;
  constructor(filename, catalog = []) {
    this.#db = new DatabaseSync(filename, { timeout: 3000 });
    this.#db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS catalog_downloads(resource_id TEXT PRIMARY KEY,total INTEGER NOT NULL CHECK(total >= 0)) STRICT;
      CREATE TABLE IF NOT EXISTS public_download_requests(id TEXT PRIMARY KEY,hash TEXT NOT NULL) STRICT;`);
    this.replaceCatalog(catalog);
  }
  close() { if (!this.#closed) { this.#db.close(); this.#closed = true; } }
  replaceCatalog(items) { this.#items = new Map(items.map(item => [item.id, structuredClone(item)])); }
  /** @returns {import('./contracts.mjs').Snapshot} */
  snapshot() {
    const catalog = structuredClone([...this.#items.values()]);
    const stats = Object.fromEntries(catalog.map(item => [item.id, { downloads: 0 }]));
    for (const row of this.#db.prepare('SELECT resource_id,total FROM catalog_downloads').all()) if (stats[row.resource_id]) stats[row.resource_id].downloads = row.total;
    return { schema: 2, catalog, stats };
  }
  mutate(command, preparedFile) {
    if (command?.action !== 'download') throw new CommunityError(400, '不支持的操作');
    if (!/^[0-9a-f-]{36}$/.test(command.requestId || '')) throw new CommunityError(400, '缺少有效请求编号');
    const hash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.#db.prepare('SELECT hash FROM public_download_requests WHERE id=?').get(command.requestId);
      if (previous && previous.hash !== hash) throw new CommunityError(409, '请求编号已被其他内容使用');
      const item = this.#items.get(command.id);
      if (!item || item.revision !== command.baseRevision) throw new CommunityError(409, '该版本不可用，请刷新后重试');
      const file = exportFile(preparedFile || downloadFile(item));
      if (!previous) {
        this.#db.prepare('INSERT INTO public_download_requests VALUES(?,?)').run(command.requestId, hash);
        this.#db.prepare('INSERT INTO catalog_downloads VALUES(?,1) ON CONFLICT(resource_id) DO UPDATE SET total=total+1').run(item.id);
      }
      this.#db.exec('COMMIT');
      return file;
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
}
