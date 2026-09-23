import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts/dsh-integration');
await mkdir(artifacts, { recursive: true });
process.env.DSH_TEST_LAB = await mkdtemp(path.join(artifacts, 'verify-'));
const { lab, launch } = await import('./host.mjs');
const { setPlugin } = await import('./set-plugin.mjs');

async function completed(child) {
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Experiment process exited with ${signal || code}`);
}
console.log('Preparing a fresh DSH profile with no model credentials; the configured local GitHub read token is optional.');
await completed(await launch(['web', '--dump-config'], { stdio: 'ignore', timeout: 60000 }));
await setPlugin(false, { translationFixture: true, resourceFixture: true });
await writeFile(path.join(lab, 'workspace/report.md'), '# Integration fixture\nA harmless reference document.\n');
await mkdir(path.join(lab, 'workspace-second'));
const host = await launch(['web', '--port', '0', '--no-open'], { quiet: true });
const stopped = once(host, 'exit');
const stop = () => host.kill();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  let ready = false;
  for (let attempt = 0; attempt < 240; attempt++) {
    if (host.exitCode !== null) throw new Error('DSH exited before becoming ready');
    const url = await readFile(path.join(lab, 'url.txt'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
    if (url) {
      try {
        const response = await fetch(url.trim(), { redirect: 'manual', signal: AbortSignal.timeout(1000) });
        ready = response.ok || ([302, 303].includes(response.status) && response.headers.get('location') === '/');
      } catch { /* Server is still starting. */ }
      if (ready) break;
    }
    await delay(250);
  }
  if (!ready) throw new Error('DSH did not become ready within the startup deadline');
  console.log('Running browser experiments against the actual DSH host.');
  const filter = process.argv[2] ? ['--test-name-pattern', process.argv[2]] : [];
  await completed(spawn(process.execPath, ['--test', '--test-reporter=tap', ...filter, 'integration/browser.test.mjs'], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true, timeout: 600000 }));
  console.log(`Host verification passed. Isolated evidence: ${path.relative(root, lab)}`);
} finally {
  if (host.exitCode === null) stop();
  await stopped;
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
