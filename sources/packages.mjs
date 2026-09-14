import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import { sourceResource } from './contracts.mjs';
import { verifySkillBytes, readBytes } from './request.mjs';

/** Prepare an archive as bytes. Nothing is extracted, installed or executed. */
export async function packageFile(resource, { download = readBytes } = {}) {
  sourceResource(resource);
  const bundle = resource.bundle;
  if (!bundle) throw Error('这份资源没有可下载的发布包');
  if (bundle.kind === 'npm-package') {
    const bytes = await download(bundle.url);
    if ('sha512-' + createHash('sha512').update(bytes).digest('base64') !== bundle.integrity) throw Error('发布包完整性校验失败');
    return { filename: `${resource.id}.tgz`, mime: 'application/gzip', encoding: 'base64', content: bytes.toString('base64') };
  }
  const files = Object.create(null);
  for (let offset = 0; offset < bundle.files.length; offset += 4) {
    const batch = bundle.files.slice(offset, offset + 4);
    // Drain each bounded batch even on failure; preserve manifest order in the archive.
    const results = await Promise.allSettled(batch.map(async file => {
      const url = `https://raw.githubusercontent.com/${bundle.repository}/${bundle.commit}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
      return verifySkillBytes(file, await download(url));
    }));
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') throw result.reason;
      const file = batch[index];
      files[file.path.slice('skills/'.length)] = [result.value, { mtime: new Date('2000-01-01T00:00:00Z'), os: 3, attrs: (file.mode === '100755' ? 0o100755 : 0o100644) << 16 }];
    }
  }
  files['SOURCE.json'] = [Buffer.from(JSON.stringify({ repository: bundle.repository, commit: bundle.commit, root: bundle.root, files: bundle.files }, null, 2) + '\n'), { mtime: new Date('2000-01-01T00:00:00Z') }];
  const bytes = zipSync(files, { level: 6 });
  return { filename: `${resource.id}.zip`, mime: 'application/zip', encoding: 'base64', content: Buffer.from(bytes).toString('base64') };
}
