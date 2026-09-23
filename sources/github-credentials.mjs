import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { CommunityError } from '../community/contracts.mjs';

export function validateGitHubToken(token) {
  // Installation tokens also use the longer ghs_APPID_JWT format; their contents stay opaque.
  if (typeof token !== 'string' || !/^(?:(?:github_pat_|ghp_|gho_)[A-Za-z0-9_]{30,245}|ghs_[A-Za-z0-9_.-]{30,1020})$/.test(token)) throw new CommunityError(400, 'GitHub 令牌格式不正确');
  return token;
}
function crypt(mode, input) {
  if (process.platform !== 'win32') throw new CommunityError(503, '当前仅支持 Windows 账户加密保存 GitHub 令牌');
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const script = fileURLToPath(new URL('../scripts/github-secret.ps1', import.meta.url));
  return new Promise((resolve, reject) => {
    const child = execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, mode], { windowsHide: true, timeout: 30000, maxBuffer: 65536, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(new CommunityError(503, '无法读取或保存 GitHub 令牌，请重新配置'));
      else resolve(stdout);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

/** The file contains DPAPI ciphertext. Only this backend port returns plaintext. */
export class GitHubCredentials {
  #file;
  #cached;
  constructor(file) { this.#file = path.resolve(file); }
  async #exists() {
    try {
      const info = await lstat(this.#file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw Error();
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw new CommunityError(503, '无法读取或保存 GitHub 令牌，请重新配置');
    }
  }
  async read() {
    if (!await this.#exists()) { this.#cached = null; return null; }
    try {
      const text = await readFile(this.#file, 'utf8');
      if (this.#cached?.text === text) return await this.#cached.pending;
      const data = JSON.parse(text);
      if (data.schema !== 1 || data.protection !== 'windows-dpapi' || typeof data.value !== 'string') throw Error();
      const pending = crypt('unprotect', data.value).then(validateGitHubToken);
      this.#cached = { text, pending };
      return await pending;
    } catch { this.#cached = null; throw new CommunityError(503, '无法读取或保存 GitHub 令牌，请重新配置'); }
  }
  async save(token) {
    validateGitHubToken(token);
    await this.#exists();
    const value = await crypt('protect', token);
    const text = JSON.stringify({ schema: 1, protection: 'windows-dpapi', value }) + '\n';
    const temporary = this.#file + '.' + randomUUID() + '.tmp';
    try {
      await mkdir(path.dirname(this.#file), { recursive: true });
      await writeFile(temporary, text, { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.#file);
      this.#cached = { text, pending: Promise.resolve(token) };
    } catch { throw new CommunityError(503, '无法读取或保存 GitHub 令牌，请重新配置'); }
    finally { await rm(temporary, { force: true }); }
  }
  async remove() { if (await this.#exists()) await rm(this.#file); this.#cached = null; }
}

export function credentialFile(env = process.env) {
  const configured = env.DSH_MARKET_GITHUB_TOKEN_FILE;
  if (configured) { if (!path.isAbsolute(configured)) throw Error('GitHub credential path must be absolute'); return configured; }
  const configuredHome = env.DSH_HOME?.trim() ? env.DSH_HOME : path.join(homedir(), '.dsh');
  const dataHome = configuredHome === '~' ? homedir() : /^~[\\/]/.test(configuredHome) ? path.join(homedir(), configuredHome.slice(2)) : configuredHome;
  return path.join(path.resolve(dataHome), 'community/private/github-token.dpapi');
}
export const githubCredentials = new GitHubCredentials(credentialFile());
