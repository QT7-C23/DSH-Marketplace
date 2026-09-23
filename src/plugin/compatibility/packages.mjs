import { CommunityError } from '../../community/contracts.mjs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import semver from 'semver';
import { parseManifest } from '@dsh-std/manifest';
import { readUpstream, readBytes } from '../../sources/request.mjs';

export const packageName = name => typeof name === 'string' && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name) && name.length <= 214;
const inside = value => typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.startsWith('/') && !value.split('/').includes('..') && !value.includes(':');

/** Inspect inert manifests only. No entrypoint or install script runs during a preview. */
export function inspectPackage(manifest, standard) {
  if (!manifest || !packageName(manifest.name) || !semver.valid(manifest.version)) throw new CommunityError(400, '发布包身份不完整');
  const routes = [];
  if (manifest.dsh?.bundle !== undefined) {
    if (!inside(manifest.dsh.bundle.patch)) throw new CommunityError(400, '插件组合配置必须位于发布包内');
    routes.push('native');
  }
  let standardManifest = null;
  if (standard !== undefined) {
    try { standardManifest = parseManifest(JSON.stringify(standard)); }
    catch { throw new CommunityError(400, '标准组件声明无效'); }
    if (standardManifest.version !== manifest.version) throw new CommunityError(400, '标准组件与发布包版本不一致');
    if (!inside(standardManifest.facets.host.entry)) throw new CommunityError(400, '标准组件入口必须位于发布包内');
    routes.push('dsh-std');
  }
  return { name: manifest.name, version: manifest.version, packageManifest: manifest, standardManifest, routes };
}

/** Read the two root manifests from a bounded npm tarball; extraction belongs to the official installer. */
function manifests(bytes) {
  const tar = gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 });
  const found = new Map();
  const files = new Set();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(value => value === 0)) break;
    const octal = (start, length) => header.subarray(start, start + length).toString('ascii').replace(/\0.*$/, '').trim();
    const sizeText = octal(124, 12), sumText = octal(148, 8);
    if (!/^[0-7]+$/.test(sizeText) || !/^[0-7]+$/.test(sumText)) throw new CommunityError(400, '发布包目录格式无效');
    const size = parseInt(sizeText, 8);
    const checksum = [...header].reduce((total, value, index) => total + (index >= 148 && index < 156 ? 32 : value), 0);
    if (checksum !== parseInt(sumText, 8) || offset + 512 + size > tar.length) throw new CommunityError(400, '发布包目录校验失败');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const name = (prefix ? prefix + '/' : '') + header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    if ([0, 48].includes(header[156])) files.add(name);
    if (['package/package.json', 'package/dsh-plugin.json'].includes(name)) {
      if (![0, 48].includes(header[156]) || size > 256000 || found.has(name)) throw new CommunityError(400, '发布包声明重复或格式无效');
      found.set(name, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(tar.subarray(offset + 512, offset + 512 + size))));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!found.has('package/package.json')) throw new CommunityError(400, '发布包缺少 package.json');
  const candidate = inspectPackage(found.get('package/package.json'), found.get('package/dsh-plugin.json'));
  for (const entry of [candidate.packageManifest.dsh?.bundle?.patch, candidate.standardManifest?.facets.host.entry].filter(Boolean)) {
    if (!files.has('package/' + entry.replace(/^\.\//, ''))) throw new CommunityError(400, '发布包缺少声明的入口文件');
  }
  return candidate;
}

export async function preparePackage(spec, { read = readUpstream, download = readBytes } = {}) {
  const split = typeof spec === 'string' ? spec.lastIndexOf('@') : -1;
  const name = typeof spec === 'string' ? spec.slice(0, split) : '', version = typeof spec === 'string' ? spec.slice(split + 1) : '';
  if (split <= 0 || !packageName(name) || semver.valid(version) !== version) throw new CommunityError(400, '请填写固定 npm 包版本，例如 package-name@1.0.0');
  const metadata = await read(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
  if (metadata.name !== name || metadata.version !== version) throw new CommunityError(400, '发布包元数据与请求不一致');
  const target = new URL(metadata.dist?.tarball);
  const leaf = name.split('/').at(-1);
  if (target.origin !== 'https://registry.npmjs.org' || target.username || target.password || target.search || target.hash || decodeURIComponent(target.pathname) !== `/${name}/-/${leaf}-${version}.tgz`) throw new CommunityError(400, '发布包必须来自 npm 官方固定版本地址');
  const integrity = metadata.dist?.integrity;
  const bytes = await download(target.href);
  if (integrity !== 'sha512-' + createHash('sha512').update(bytes).digest('base64')) throw new CommunityError(400, '发布包完整性校验失败');
  const candidate = manifests(bytes);
  if (candidate.name !== name || candidate.version !== version) throw new CommunityError(400, '发布包内容与元数据不一致');
  if (!candidate.routes.length) throw new CommunityError(400, '此包未声明受支持的 DSH bundle 或标准组件入口');
  return { ...candidate, integrity, tarball: target.href };
}
