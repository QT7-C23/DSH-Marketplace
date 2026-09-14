import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lab } from './host.mjs';
export async function setPlugin(disabled = false, { translationFixture = false, compatibilityFixture = false } = {}) {
  const filename = path.join(lab, 'home/profiles/web/cordis.patch.yml');
  const previous = await readFile(filename, 'utf8');
  if (previous.replace(/^#.*$/gm, '').trim() !== '[]' && !previous.startsWith('# DSH market experiment')) throw Error('The lab patch has unrelated content; refusing to overwrite it.');
  const plugin = fileURLToPath(new URL('./plugin/index.mjs', import.meta.url)).replaceAll('\\', '/');
  const fixture = fileURLToPath(new URL('./fixtures/translation-model.mjs', import.meta.url)).replaceAll('\\', '/');
  const compatibility = fileURLToPath(new URL('./fixtures/compatibility-probe.mjs', import.meta.url)).replaceAll('\\', '/');
  await writeFile(filename, `# DSH market experiment\n- id: directory-picker\n  disabled: true\n- insert:\n    - id: experiment-directory-backend\n      name: '@deepseek-ai/dsh-host-directory-picker-browse'\n      config:\n        maxEntries: 1000\n    - id: experiment-directory-browser\n      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'\n    - id: community-market\n      name: '${plugin}'\n      disabled: ${disabled}\n      config:\n        profile: web\n${compatibilityFixture ? `    - id: compatibility-test-probe\n      name: '${compatibility}'\n` : ''}${translationFixture ? `    - id: translation-test-provider\n      name: '${fixture}'\n` : ''}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await setPlugin(process.argv[2] === 'off');
  console.log(`Lab plugin ${process.argv[2] === 'off' ? 'disabled' : 'enabled'}.`);
}
