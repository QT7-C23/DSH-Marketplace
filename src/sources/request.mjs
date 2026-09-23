import { createHash } from 'node:crypto';
import { githubFetch } from './github-auth.mjs';

export function isTransientReadError(error) {
  return error.name === 'TimeoutError' || ['UND_ERR_CONNECT_TIMEOUT', 'ECONNRESET', 'UND_ERR_SOCKET', 'EAI_AGAIN', 'ETIMEDOUT'].includes(error.cause?.code);
}

/** Fixed upstream domains; a source manifest never supplies an arbitrary fetch address. */
export async function readBytes(url, request = githubFetch) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password || target.port || !['api.github.com', 'raw.githubusercontent.com', 'registry.npmjs.org', 'registry.modelcontextprotocol.io'].includes(target.hostname)) throw Error('不支持的来源地址');
  try { return await requestBytes(url, request); }
  catch (error) {
    if (!isTransientReadError(error)) throw error;
    // One fresh attempt after a transient public GET failure; HTTP, cancellation and integrity failures are not retried.
    return requestBytes(url, request);
  }
}

async function requestBytes(url, request) {
  const response = await request(url, { headers: { accept: 'application/json', 'user-agent': 'DSH-Extension-Market' }, redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Object.assign(Error(`来源返回 ${response.status}，请稍后重试`), { status: response.status });
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 4 * 1024 * 1024) { await reader.cancel(); throw Error('来源响应过大'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function readUpstream(url, request = githubFetch) { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBytes(url, request))); }
/** Raw delivery and the Git blob API address the same immutable bytes, never a moving branch. */
export async function readPinnedSkillBytes(url, file, bundle, read = readBytes) {
  let bytes;
  try { bytes = await read(url); }
  catch (error) {
    if (!isTransientReadError(error)) throw error;
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read(`https://api.github.com/repos/${bundle.repository}/git/blobs/${file.sha}`)));
    if (data.encoding !== 'base64' || typeof data.content !== 'string') throw Error('Skill 文件编码不支持');
    bytes = Buffer.from(data.content, 'base64');
  }
  try { return verifySkillBytes(file, bytes); }
  catch { throw Object.assign(Error('Skill 文件校验失败'), { code: 'SKILL_INTEGRITY' }); }
}
export async function readSkillBlob(file, read = readUpstream) {
  const data = await read(`https://api.github.com/repos/anthropics/skills/git/blobs/${file.sha}`);
  if (data.encoding !== 'base64' || typeof data.content !== 'string') throw Error('Skill 文件编码不支持');
  const bytes = Buffer.from(data.content, 'base64');
  return verifySkillBytes(file, bytes);
}
export function verifySkillBytes(file, bytes) {
  const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (bytes.length !== file.size || hash !== file.sha) throw Error('Skill 文件校验失败');
  return bytes;
}
