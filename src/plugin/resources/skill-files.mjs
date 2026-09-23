import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, opendir, rename, rm, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { sourceResource } from '../../sources/contracts.mjs';
import { validateSkillBundle } from '../../sources/skill-bundles.mjs';
import { readPinnedSkillBytes, verifySkillBytes } from '../../sources/request.mjs';

const receiptPath = '.dsh-market/receipt.json';
const receiptLimit = 512 * 1024;
const reserved = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;
const slug = /^[a-z0-9][a-z0-9-]{0,63}$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const failure = (code, message) => Object.assign(Error(message), { code });
const unsafe = () => failure('SKILL_UNSAFE_PATH', 'Skill 路径不安全：请检查 Windows 文件名、符号链接和安装根目录。');
const conflict = () => failure('SKILL_CONFLICT', '同名 Skill 目录或管理记录已存在；请先备份并人工处理冲突，安装不会覆盖它。');
const identity = stat => ({ dev: String(stat.dev), ino: String(stat.ino) });
const same = (stat, pin) => stat && String(stat.dev) === pin.dev && String(stat.ino) === pin.ino;
const row = (pin, state = 'installed') => ({ id: pin.id, revision: pin.revision, name: pin.name, version: pin.version, state });
const encoded = value => Buffer.from(JSON.stringify(value) + '\n');
const modified = () => failure('SKILL_MODIFIED', 'Skill 文件或收据已改变；不会移动或覆盖，请先人工检查。');
const recovery = () => failure('SKILL_RECOVERY_REQUIRED', 'Skill 操作未能安全完成；旧文件已保留，请检查冲突后显式恢复。');
const invalidState = () => failure('SKILL_STATE_INVALID', 'Skill 管理记录损坏或不可安全读取，请人工检查。');

function validated(value) {
  try {
    const resource = structuredClone(value);
    sourceResource(resource);
    if (resource.type !== 'Skill' || resource.bundle?.kind !== 'github-skill') throw Error();
    return resource;
  } catch { throw failure('SKILL_INVALID', 'Skill 来源或固定版本清单无效，无法安装。'); }
}
function validPin(pin, name) {
  if (!pin || pin.name !== name || !/^source-[a-z0-9-]{1,100}$/.test(pin.id) || !Number.isSafeInteger(pin.revision)
    || pin.revision < 1 || typeof pin.version !== 'string' || pin.version.length > 40
    || !/^[a-f0-9]{64}$/.test(pin.receiptSha256) || !/^[0-9]+$/.test(pin.directory?.dev) || !/^[0-9]+$/.test(pin.directory?.ino)) throw invalidState();
}
function locationPath(roots, location, name) {
  if (location === 'native') return join(roots.skills, name);
  if (typeof location !== 'string' || !(new RegExp(`^(disabled|recovery)/${name}-[a-f0-9-]{36}$`).test(location)
    || /^stage-[a-zA-Z0-9]+$/.test(location))) throw invalidState();
  return join(roots.privateRoot, location);
}
function stateRecord(value, name) {
  validPin(value, name);
  if (value.schema === 1) return { ...value, schema: 2, state: 'installed', location: 'native', history: [] };
  if (value.schema !== 2 || !['installed', 'disabled', 'removed'].includes(value.state) || !Array.isArray(value.history) || value.history.length > 16
    || value.state === 'installed' && value.location !== 'native'
    || value.state === 'disabled' && !value.location?.startsWith('disabled/')
    || value.state === 'removed' && (!value.location?.startsWith('recovery/') || !['installed', 'disabled'].includes(value.restoreState))) throw invalidState();
  for (const pin of value.history) {
    validPin(pin, name);
    if (pin.id !== value.id || !pin.location?.startsWith('recovery/')) throw invalidState();
  }
  return value;
}
const snapshot = (pin, location) => ({ schema: 1, id: pin.id, revision: pin.revision, name: pin.name,
  version: pin.version, directory: pin.directory, receiptSha256: pin.receiptSha256, location });
const pathKeys = paths => paths.map(path => process.platform === 'win32' ? path.toLowerCase() : path).sort();
function directoryKeys(paths) {
  const dirs = [];
  for (const path of paths) {
    const parts = path.split('/');
    while (parts.pop() && parts.length) dirs.push(parts.join('/'));
  }
  return [...new Set(pathKeys(dirs))].sort();
}

function segment(name) {
  if (!name || name.length > 255 || name === '.' || name === '..' || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name) || /[. ]$/.test(name) || reserved.test(name)) throw unsafe();
}
function plan(bundle) {
  const name = bundle.root.split('/').at(-1);
  if (!slug.test(name)) throw unsafe();
  segment(name);
  const paths = new Set([receiptPath]), dirs = new Set(['.dsh-market']);
  const files = bundle.files.map(file => {
    if (file.path.length > 512) throw unsafe();
    file.path.split('/').forEach(segment);
    const internal = file.path.startsWith(bundle.root + '/');
    const path = internal ? file.path.slice(bundle.root.length + 1) : `.dsh-market/licenses/${file.path}`;
    if (internal && path.split('/')[0].toLowerCase() === '.dsh-market') throw unsafe();
    const key = path.toLowerCase();
    if (paths.has(key)) throw unsafe();
    paths.add(key);
    const parts = key.split('/');
    while (parts.pop() && parts.length) dirs.add(parts.join('/'));
    return { ...file, sourcePath: file.path, path };
  });
  if ([...dirs].some(path => paths.has(path)) || dirs.size + paths.size > 2048) throw unsafe();
  return { name, files };
}
async function present(path) {
  try { return await lstat(path, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
// Check every ancestor; recursive mkdir alone would follow a junction in a parent.
async function directory(path, create = false) {
  const chain = [];
  for (let part = resolve(path); ; part = dirname(part)) {
    chain.push(part);
    if (dirname(part) === part) break;
  }
  let stat;
  for (const part of chain.reverse()) {
    stat = await present(part);
    if (!stat) {
      if (!create) return null;
      try { await mkdir(part, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      stat = await present(part);
    }
    if (!stat?.isDirectory() || stat.isSymbolicLink()) throw unsafe();
  }
  return stat;
}
async function names(path, limit = 1000) {
  const result = [];
  for await (const entry of await opendir(path)) {
    if (result.length >= limit) throw failure('SKILL_LIMIT', 'Skill 管理目录超过本次读取上限，请人工检查。');
    result.push(entry.name);
  }
  return result;
}
async function bytesAt(path, limit) {
  if (!await directory(dirname(path))) throw unsafe();
  const stat = await present(path);
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n || stat.size > BigInt(limit)) throw unsafe();
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const current = await file.stat({ bigint: true });
    if (!same(current, identity(stat)) || current.size !== stat.size || current.nlink !== 1n) throw unsafe();
    const buffer = Buffer.alloc(Number(stat.size) + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await file.read(buffer, used, buffer.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used !== Number(stat.size)) throw unsafe();
    return buffer.subarray(0, used);
  } finally { await file.close(); }
}
async function durable(path, bytes, mode = 0o600) {
  await directory(dirname(path), true);
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), mode);
  try {
    await file.writeFile(bytes);
    await file.chmod(mode);
    await file.sync();
    return identity(await file.stat({ bigint: true }));
  } finally { await file.close(); }
}
async function inventory(root, withDirectories = false) {
  const queue = [''], files = [];
  let count = 0;
  for (let index = 0; index < queue.length; index++) {
    const base = queue[index];
    for (const name of await names(join(root, base), 2048)) {
      if (++count > 2048) throw unsafe();
      segment(name);
      const path = base ? `${base}/${name}` : name, stat = await present(join(root, path));
      if (!stat || stat.isSymbolicLink()) throw unsafe();
      if (stat.isDirectory()) queue.push(path);
      else if (stat.isFile() && stat.nlink === 1n) files.push(path);
      else throw unsafe();
    }
  }
  return withDirectories ? { files: files.sort(), directories: queue.slice(1) } : files.sort();
}
async function complete(target, pin) {
  try {
    if (!same(await directory(target), pin.directory)) return false;
    const bytes = await bytesAt(join(target, receiptPath), receiptLimit);
    if (sha256(bytes) !== pin.receiptSha256) return false;
    const receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (receipt.schema !== 1 || ['id', 'revision', 'name', 'version'].some(key => receipt[key] !== pin[key])) return false;
    if (receipt.sourceId !== undefined && !['skills', 'skills-openai', 'community'].includes(receipt.sourceId)) return false;
    validateSkillBundle({ type: 'Skill', sourceId: receipt.sourceId, bundle: receipt.bundle });
    const planned = plan(receipt.bundle);
    if (planned.name !== pin.name || receipt.files?.length !== planned.files.length) return false;
    const expected = [receiptPath, ...planned.files.map(file => file.path)], actualTree = await inventory(target, true);
    if (JSON.stringify(pathKeys(actualTree.files)) !== JSON.stringify(pathKeys(expected))
      || JSON.stringify(pathKeys(actualTree.directories)) !== JSON.stringify(directoryKeys(expected))) return false;
    for (const [index, file] of planned.files.entries()) {
      const stored = receipt.files[index];
      if (['path', 'sourcePath', 'sha', 'size', 'mode'].some(key => file[key] !== stored[key]) || !/^[a-f0-9]{64}$/.test(stored.sha256)) return false;
      const actual = await bytesAt(join(target, file.path), 1024 * 1024);
      verifySkillBytes(file, actual);
      if (sha256(actual) !== stored.sha256) return false;
      if (process.platform !== 'win32' && ((await present(join(target, file.path))).mode & 0o7777n) !== (file.mode === '100755' ? 0o755n : 0o644n)) return false;
    }
    return true;
  } catch { return false; }
}
async function boundary(action) {
  try { return await action(); }
  catch (error) {
    if (error.code?.startsWith('SKILL_')) throw error;
    throw failure('SKILL_IO', 'Skill 文件操作失败；请检查安装目录权限和可用空间后重试。');
  }
}

/** Filesystem installation only. Native provider/session loading is a separate host concern. */
export class SkillFiles {
  #home;
  #download;
  constructor({ home, download } = {}) {
    if (typeof home !== 'string' || !isAbsolute(home) || home.includes('\0') || (download !== undefined && typeof download !== 'function')) throw unsafe();
    this.#home = resolve(home);
    this.#home.slice(parse(this.#home).root.length).split(sep).filter(Boolean).forEach(segment);
    this.#download = download;
  }
  #paths() {
    const home = this.#home, skills = join(home, 'skills'), community = join(home, 'community');
    const privateRoot = join(community, 'skill-files');
    return { home, skills, community, privateRoot, records: join(privateRoot, 'records'), locks: join(privateRoot, 'locks'),
      disabled: join(privateRoot, 'disabled'), recovery: join(privateRoot, 'recovery'), transactions: join(privateRoot, 'transactions') };
  }
  async #roots(create = false) {
    const paths = this.#paths(), pins = [];
    // Inspect all existing roots before creating anything, including a possibly linked community root.
    for (const path of Object.values(paths)) await directory(path);
    for (const path of Object.values(paths)) {
      const stat = await directory(path, create);
      if (stat) pins.push({ path, ...identity(stat) });
    }
    return { ...paths, pins };
  }
  async #unchanged(pins) {
    for (const pin of pins) if (!same(await directory(pin.path), pin)) throw unsafe();
  }
  async #absent(skills, name) {
    if (await directory(skills) && (await names(skills)).some(entry => entry.toLowerCase() === name.toLowerCase())) throw conflict();
  }
  async #stage(resource, planned, roots, operation) {
    const stage = operation.stage = await mkdtemp(join(roots.privateRoot, 'stage-'));
    const stagePin = operation.stagePin = identity(await directory(stage));
    const files = [];
    operation.written = [];
    for (const file of planned.files) {
      const url = `https://raw.githubusercontent.com/${resource.bundle.repository}/${resource.bundle.commit}/${file.sourcePath.split('/').map(encodeURIComponent).join('/')}`;
      let bytes;
      try { bytes = this.#download ? await this.#download(url) : await readPinnedSkillBytes(url, file, resource.bundle); }
      catch (error) {
        if (error.code === 'SKILL_INTEGRITY') throw failure('SKILL_INTEGRITY', 'Skill 文件校验失败；尚未安装，请重新检查来源。');
        throw failure('SKILL_DOWNLOAD_FAILED', 'Skill 文件下载失败；尚未安装，请重试。');
      }
      try { bytes = Buffer.from(verifySkillBytes(file, bytes)); }
      catch { throw failure('SKILL_INTEGRITY', 'Skill 文件校验失败；尚未安装，请重新检查来源。'); }
      await this.#unchanged(roots.pins);
      if (!same(await directory(stage), stagePin)) throw unsafe();
      await durable(join(stage, file.path), bytes, file.mode === '100755' ? 0o755 : 0o644);
      operation.written.push({ path: file.path, hash: sha256(bytes), mode: file.mode === '100755' ? 0o755n : 0o644n });
      files.push({ sourcePath: file.sourcePath, path: file.path, sha: file.sha, size: file.size, mode: file.mode, sha256: sha256(bytes) });
    }
    const summary = { id: resource.id, revision: resource.revision, name: planned.name, version: resource.version };
    const receipt = encoded({ schema: 1, ...summary, sourceId: resource.sourceId, bundle: resource.bundle, files });
    if (receipt.length > receiptLimit) throw failure('SKILL_LIMIT', 'Skill 安装收据超过大小上限。');
    await durable(join(stage, receiptPath), receipt);
    operation.written.push({ path: receiptPath, hash: sha256(receipt), mode: 0o600n });
    const pin = { schema: 1, ...summary, directory: stagePin, receiptSha256: sha256(receipt) };
    if (!await complete(stage, pin)) throw failure('SKILL_INTEGRITY', 'Skill 暂存文件已改变；尚未安装，请重试。');
    return pin;
  }
  async install(value) {
    return boundary(async () => {
      const resource = validated(value);
      const planned = plan(resource.bundle), { name } = planned;
      const preflight = await this.#roots();
      await this.#absent(preflight.skills, name);
      const roots = await this.#roots(true), target = join(roots.skills, name);
      const lockPath = join(roots.locks, `${name}.lock`), recordPath = join(roots.records, `${name}.json`);
      const operation = {};
      let lock, lockPin, stage, recordPin, committed = false;
      try {
        try { lock = await open(lockPath, 'wx', 0o600); }
        catch (error) {
          if (error.code === 'EEXIST') throw failure('SKILL_BUSY', '同名 Skill 正在安装或上次安装中断；请确认进程状态并检查安装锁后重试。');
          throw error;
        }
        lockPin = identity(await lock.stat({ bigint: true }));
        await lock.writeFile(JSON.stringify({ operation: randomUUID(), pid: process.pid }) + '\n');
        await lock.sync();
        await this.#unchanged(roots.pins);
        await this.#absent(roots.skills, name);
        if (await present(recordPath)) throw conflict();
        let pin;
        try { pin = await this.#stage(resource, planned, roots, operation); }
        finally { ({ stage } = operation); }
        await this.#unchanged(roots.pins);
        await this.#absent(roots.skills, name);
        // Persist the ownership anchor before the only operation that makes a Skill visible.
        recordPin = await durable(recordPath, Buffer.from(JSON.stringify(pin) + '\n'));
        await this.#unchanged(roots.pins);
        await this.#absent(roots.skills, name);
        try { await rename(stage, target); }
        catch (error) {
          if (await present(target) || ['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw conflict();
          throw error;
        }
        committed = true;
        stage = undefined;
        return row(pin);
      } finally {
        if (lock) {
          let clean = true;
          try {
            await this.#unchanged(roots.pins);
            if (!committed && recordPin) {
              if (!same(await present(recordPath), recordPin)) throw unsafe();
              await unlink(recordPath);
            }
            if (stage) await this.#cleanStage(roots, operation);
          } catch { clean = false; } // Uncertain cleanup retains the lock for manual recovery.
          await lock.close();
          if (clean) {
            try {
              await this.#unchanged(roots.pins);
              if (same(await present(lockPath), lockPin)) await unlink(lockPath);
            } catch { /* Never follow changed roots or remove somebody else's lock. */ }
          }
        }
      }
    });
  }
  async #records(roots) {
    if (!await directory(roots.records)) return [];
    const result = [];
    for (const filename of (await names(roots.records)).sort()) {
      const name = filename.slice(0, -5);
      if (!filename.endsWith('.json') || !slug.test(name)) throw invalidState();
      // Keep legacy interrupted installs invisible, while retained lifecycle copies remain readable.
      let retained = false;
      for (const folder of [roots.disabled, roots.recovery]) if (await directory(folder)
        && (await names(folder)).some(entry => entry.startsWith(name + '-'))) retained = true;
      const nativePresent = await present(join(roots.skills, name)), pending = await present(join(roots.transactions, filename));
      let bytes;
      try {
        bytes = await bytesAt(join(roots.records, filename), 65536);
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (value.schema === 1 && !nativePresent && !pending) continue;
        const pin = stateRecord(value, name);
        for (const item of [pin, ...pin.history]) locationPath(roots, item.location, name);
        result.push({ value, pin, hash: sha256(bytes) });
      } catch {
        if (!nativePresent && !retained && !pending && bytes?.toString('utf8').startsWith('{"schema":1,')) continue;
        throw invalidState();
      }
    }
    return result;
  }
  async #find(roots, id) {
    if (typeof id !== 'string' || !/^source-[a-z0-9-]{1,100}$/.test(id)) throw failure('SKILL_INVALID', 'Skill 编号无效。');
    const matches = (await this.#records(roots)).filter(item => item.pin.id === id);
    if (!matches.length) throw failure('SKILL_NOT_OWNED', '没有此 Skill 的可信安装记录；不会修改未管理的文件。');
    if (matches.length !== 1) throw invalidState();
    return matches[0];
  }
  async #writeState(roots, path, value, expected = null) {
    const bytes = encoded(value);
    if (bytes.length > 65536) throw failure('SKILL_LIMIT', 'Skill 恢复记录超过大小上限。');
    const check = async () => {
      await this.#unchanged(roots.pins);
      const current = await present(path);
      if (expected === null ? current : !current || sha256(await bytesAt(path, 65536)) !== expected) throw invalidState();
    };
    await check();
    const temp = join(roots.privateRoot, `state-${randomUUID()}.tmp`), tempPin = await durable(temp, bytes);
    try { await check(); await rename(temp, path); }
    finally {
      await this.#unchanged(roots.pins);
      if (same(await present(temp), tempPin) && sha256(await bytesAt(temp, 65536)) === sha256(bytes)) await unlink(temp);
    }
    return sha256(bytes);
  }
  async #journal(roots, pin) {
    const path = join(roots.transactions, `${pin.name}.json`);
    if (!await present(path)) return null;
    try {
      const bytes = await bytesAt(path, 65536), value = JSON.parse(bytes.toString('utf8'));
      const before = stateRecord(value.before, pin.name), after = stateRecord(value.after, pin.name);
      if (value.schema !== 1 || before.id !== pin.id || after.id !== pin.id || !/^[a-f0-9]{64}$/.test(value.baseHash)
        || !Array.isArray(value.moves) || !value.moves.length || value.moves.length > 2) throw invalidState();
      for (const move of value.moves) {
        validPin(move.pin, pin.name);
        if (move.pin.id !== pin.id || move.from === move.to) throw invalidState();
        locationPath(roots, move.from, pin.name); locationPath(roots, move.to, pin.name);
      }
      for (const state of [before, after]) for (const item of [state, ...state.history]) locationPath(roots, item.location, pin.name);
      return { value, hash: sha256(bytes), path };
    } catch { throw invalidState(); }
  }
  async #clearJournal(roots, journal) {
    await this.#unchanged(roots.pins);
    if (sha256(await bytesAt(journal.path, 65536)) !== journal.hash) throw invalidState();
    await unlink(journal.path);
  }
  async #move(roots, from, to, pin) {
    await this.#unchanged(roots.pins);
    const source = locationPath(roots, from, pin.name), target = locationPath(roots, to, pin.name);
    if (!await complete(source, pin)) throw modified();
    await this.#absent(dirname(target), target.split(sep).at(-1));
    await rename(source, target);
    if (!await complete(target, pin)) throw modified();
  }
  async #rollback(roots, journal) {
    const { before, after, moves, baseHash } = journal.value;
    await this.#unchanged(roots.pins);
    const recordPath = join(roots.records, `${before.name}.json`);
    const recordHash = sha256(await bytesAt(recordPath, 65536));
    if (![baseHash, sha256(encoded(after))].includes(recordHash)) throw invalidState();
    // Check every occupied transaction path before moving anything; external edits win.
    for (const location of new Set(moves.flatMap(move => [move.from, move.to]))) {
      const path = locationPath(roots, location, before.name);
      if (!await present(path)) continue;
      let verified = false;
      for (const move of moves) if (await complete(path, move.pin)) verified = true;
      if (!verified) throw modified();
    }
    for (const move of [...moves].reverse()) {
      if (await complete(locationPath(roots, move.from, before.name), move.pin)) continue;
      await this.#move(roots, move.to, move.from, move.pin);
    }
    const original = stateRecord(before, before.name);
    if (!await complete(locationPath(roots, original.location, before.name), original)) throw modified();
    await this.#writeState(roots, recordPath, before, recordHash);
    await this.#clearJournal(roots, journal);
    return row(original, original.state);
  }
  async #commit(roots, record, next, moves) {
    const path = join(roots.transactions, `${record.pin.name}.json`);
    const value = { schema: 1, before: record.value, baseHash: record.hash, after: next, moves };
    const journal = { path, value, hash: await this.#writeState(roots, path, value) };
    try {
      for (const move of moves) await this.#move(roots, move.from, move.to, move.pin);
      for (const move of moves) if (!await complete(locationPath(roots, move.to, next.name), move.pin)) throw modified();
      await this.#writeState(roots, join(roots.records, `${next.name}.json`), next, record.hash);
      await this.#clearJournal(roots, journal);
      return row(next, next.state);
    } catch (error) {
      try { await this.#rollback(roots, journal); } catch { throw recovery(); }
      throw error;
    }
  }
  async #cleanStage(roots, operation) {
    if (!operation.stage || !await present(operation.stage)) return;
    await this.#unchanged(roots.pins);
    const rel = relative(roots.privateRoot, operation.stage);
    if (!/^stage-[a-zA-Z0-9]+$/.test(rel) || !same(await directory(operation.stage), operation.stagePin)) throw unsafe();
    const tree = await inventory(operation.stage, true), expected = operation.written.map(file => file.path);
    if (JSON.stringify(pathKeys(tree.files)) !== JSON.stringify(pathKeys(expected))
      || JSON.stringify(pathKeys(tree.directories)) !== JSON.stringify(directoryKeys(expected))) throw modified();
    for (const file of operation.written) {
      const path = join(operation.stage, file.path);
      if (sha256(await bytesAt(path, receiptLimit * 2)) !== file.hash
        || process.platform !== 'win32' && ((await present(path)).mode & 0o7777n) !== file.mode) throw modified();
    }
    await rm(operation.stage, { recursive: true });
  }
  async #lifecycle(id, revision, action) {
    return boundary(async () => {
      const initial = await this.#find(await this.#roots(), id), roots = await this.#roots(true);
      const lockPath = join(roots.locks, `${initial.pin.name}.lock`);
      let lock;
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch (error) { if (error.code === 'EEXIST') throw failure('SKILL_BUSY', 'Skill 正在操作或上次操作中断；请检查进程和锁后重试。'); throw error; }
      const lockPin = identity(await lock.stat({ bigint: true }));
      try {
        await lock.writeFile(encoded({ operation: randomUUID(), pid: process.pid })); await lock.sync();
        await this.#unchanged(roots.pins);
        const record = await this.#find(roots, id);
        if (record.pin.name !== initial.pin.name) throw invalidState();
        if (revision !== undefined && (!Number.isSafeInteger(revision) || revision !== record.pin.revision)) throw failure('SKILL_REVISION', 'Skill 安装版本已改变，请刷新后重试。');
        return await action(roots, record, await this.#journal(roots, record.pin));
      } finally {
        await lock.close();
        try { await this.#unchanged(roots.pins); if (same(await present(lockPath), lockPin)) await unlink(lockPath); }
        catch { /* Changed roots retain the lock; a killed process never reaches this cleanup. */ }
      }
    });
  }
  async #verified(roots, pin, journal) {
    if (journal) throw recovery();
    if (!await complete(locationPath(roots, pin.location, pin.name), pin)) throw modified();
  }
  async #toggle(id, revision, state) {
    if (revision === undefined) throw failure('SKILL_REVISION', '必须指定 Skill 安装版本。');
    return this.#lifecycle(id, revision, async (roots, record, journal) => {
      const pin = record.pin;
      await this.#verified(roots, pin, journal);
      if (pin.state === state) return row(pin, state);
      if (pin.state === 'removed') throw failure('SKILL_STATE', 'Skill 已移除；请使用显式恢复。');
      const location = state === 'installed' ? 'native' : `${state === 'removed' ? 'recovery' : 'disabled'}/${pin.name}-${randomUUID()}`;
      const next = { ...pin, state, location, ...(state === 'removed' ? { restoreState: pin.state } : {}) };
      // Check conflicts before writing any transaction metadata.
      const target = locationPath(roots, location, pin.name);
      await this.#absent(dirname(target), target.split(sep).at(-1));
      return this.#commit(roots, record, next, [{ from: pin.location, to: location, pin: snapshot(pin, pin.location) }]);
    });
  }
  disable(id, revision) { return this.#toggle(id, revision, 'disabled'); }
  enable(id, revision) { return this.#toggle(id, revision, 'installed'); }
  remove(id, revision) { return this.#toggle(id, revision, 'removed'); }
  async update(value) {
    const resource = validated(value), planned = plan(resource.bundle);
    return this.#lifecycle(resource.id, undefined, async (roots, record, journal) => {
      const pin = record.pin;
      await this.#verified(roots, pin, journal);
      if (pin.state === 'removed') throw failure('SKILL_STATE', '移除的 Skill 必须先恢复才能更新。');
      if (planned.name !== pin.name || resource.revision <= pin.revision) throw failure('SKILL_REVISION', 'Skill 更新必须保持同一目录并使用更新的版本。');
      if (pin.history.length >= 16) throw failure('SKILL_LIMIT', 'Skill 保留版本已达上限，请人工检查恢复记录。');
      const receipt = JSON.parse((await bytesAt(join(locationPath(roots, pin.location, pin.name), receiptPath), receiptLimit)).toString('utf8'));
      if (receipt.bundle.repository !== resource.bundle.repository || receipt.bundle.root !== resource.bundle.root) throw failure('SKILL_INVALID', 'Skill 更新不能改变来源仓库或原目录。');
      const operation = {};
      try {
        const staged = await this.#stage(resource, planned, roots, operation);
        await this.#verified(roots, pin, null);
        const retained = `recovery/${pin.name}-${randomUUID()}`;
        const next = { ...staged, schema: 2, state: pin.state, location: pin.location, history: [...pin.history, snapshot(pin, retained)] };
        return await this.#commit(roots, record, next, [
          { from: pin.location, to: retained, pin: snapshot(pin, pin.location) },
          { from: relative(roots.privateRoot, operation.stage), to: pin.location, pin: staged },
        ]);
      } finally {
        if (!await present(join(roots.transactions, `${pin.name}.json`))) {
          try { await this.#cleanStage(roots, operation); } catch { /* Retain changed private staging; never delete external modifications. */ }
        }
      }
    });
  }
  async restore(id) {
    return this.#lifecycle(id, undefined, async (roots, record, journal) => {
      if (journal) return this.#rollback(roots, journal);
      const pin = record.pin;
      await this.#verified(roots, pin, null);
      if (pin.state === 'removed') {
        const state = pin.restoreState, location = state === 'installed' ? 'native' : `disabled/${pin.name}-${randomUUID()}`;
        const next = { ...pin, state, location }; delete next.restoreState;
        const target = locationPath(roots, location, pin.name);
        await this.#absent(dirname(target), target.split(sep).at(-1));
        return this.#commit(roots, record, next, [{ from: pin.location, to: location, pin: snapshot(pin, pin.location) }]);
      }
      const previous = pin.history.at(-1);
      if (!previous) throw failure('SKILL_NO_RECOVERY', '没有可恢复的旧版本。');
      if (!await complete(locationPath(roots, previous.location, pin.name), previous)) throw modified();
      const retained = `recovery/${pin.name}-${randomUUID()}`;
      const next = { ...previous, schema: 2, state: pin.state, location: pin.location, history: [...pin.history.slice(0, -1), snapshot(pin, retained)] };
      return this.#commit(roots, record, next, [
        { from: pin.location, to: retained, pin: snapshot(pin, pin.location) },
        { from: previous.location, to: pin.location, pin: previous },
      ]);
    });
  }
  async read() {
    return boundary(async () => {
      const roots = await this.#roots(), result = [];
      for (const { pin } of await this.#records(roots)) {
        const journal = await this.#journal(roots, pin);
        const state = journal ? 'recovery-required' : await complete(locationPath(roots, pin.location, pin.name), pin) ? pin.state : 'modified';
        result.push(row(pin, state));
      }
      await this.#unchanged(roots.pins);
      return result;
    });
  }
}
