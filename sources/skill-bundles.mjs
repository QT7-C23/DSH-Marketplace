const roots = {
  'anthropics/skills': /^skills\/[a-z0-9-]+$/,
  'openai/skills': /^skills\/\.curated\/[a-z0-9][a-z0-9-]{0,63}$/,
};
const licenseName = /^LICENSE(?:\.(?:txt|md))?$/i;

/** Preserve original names while placing each Skill directory at the ZIP root. */
export function skillArchivePath(bundle, path) {
  return path.startsWith(bundle.root + '/') ? `${bundle.root.split('/').at(-1)}/${path.slice(bundle.root.length + 1)}` : path;
}

/** Validate a full Resource's Skill manifest without fetching, extracting, or executing it. */
export function validateSkillBundle(value) {
  const bundle = value?.bundle;
  const reviewed = value?.sourceId === 'community' && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(bundle?.repository || '')
    && !['.', '..'].includes(bundle.repository.split('/')[1]);
  const root = typeof bundle?.root === 'string' && bundle.root.length <= 300 && /^(?:[a-zA-Z0-9_.-]+\/){0,7}[a-z0-9][a-z0-9-]{0,63}$/.test(bundle.root) && !bundle.root.split('/').some(part => part === '.' || part === '..');
  if (value?.type !== 'Skill' || bundle?.kind !== 'github-skill' || !(reviewed || Object.hasOwn(roots, bundle.repository) && roots[bundle.repository].test(bundle.root)) || typeof bundle.commit !== 'string' || !/^[a-f0-9]{40}$/.test(bundle.commit) || !root) throw Error('Skill 下载来源无效');
  if (!Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > 150) throw Error('Skill 文件数量无效');
  const licensePaths = bundle.licensePaths === undefined ? [`${bundle.root}/LICENSE.txt`] : bundle.licensePaths;
  if (!Array.isArray(licensePaths) || !licensePaths.length || new Set(licensePaths).size !== licensePaths.length || licensePaths.some(path => typeof path !== 'string' || !licenseName.test(path.startsWith(bundle.root + '/') ? path.slice(bundle.root.length + 1) : path))) throw Error('Skill 许可路径无效');
  const seen = new Set();
  let size = 0;
  for (const file of bundle.files) {
    if (!file || typeof file.path !== 'string' || !(file.path.startsWith(bundle.root + '/') || licensePaths.includes(file.path)) || file.path.split('/').some(part => !part || part === '.' || part === '..') || /[\\:\x00-\x1f\x7f]/.test(file.path) || typeof file.sha !== 'string' || !/^[a-f0-9]{40}$/.test(file.sha) || !['100644', '100755'].includes(file.mode) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 1024 * 1024 || seen.has(file.path)) throw Error('Skill 文件路径、类型或校验信息无效');
    seen.add(file.path); size += file.size;
  }
  if (size > 4 * 1024 * 1024 || !seen.has(`${bundle.root}/SKILL.md`) || !licensePaths.every(path => seen.has(path))) throw Error('Skill 文件不完整或过大');
  for (const path of seen) {
    const parts = path.split('/');
    while (parts.pop() && parts.length) if (seen.has(parts.join('/'))) throw Error('Skill 文件路径与目录冲突');
  }
  // Mapping can introduce conflicts absent from repository paths. Include generated provenance.
  const archiveFiles = new Set(['source.json']);
  for (const file of bundle.files) {
    const path = skillArchivePath(bundle, file.path).toLowerCase();
    if (archiveFiles.has(path)) throw Error('Skill ZIP 路径冲突：Windows 不区分大小写的重复文件名');
    archiveFiles.add(path);
  }
  for (const path of archiveFiles) {
    const parts = path.split('/');
    while (parts.pop() && parts.length) if (archiveFiles.has(parts.join('/'))) throw Error('Skill ZIP 路径冲突：Windows 不区分大小写的文件与目录重名');
  }
  return value;
}
