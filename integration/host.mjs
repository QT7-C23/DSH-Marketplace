import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const experiments = fileURLToPath(new URL('../artifacts/dsh-integration/', import.meta.url));
export const lab = path.resolve(process.env.DSH_TEST_LAB || path.join(experiments, 'runtime'));
const relative = path.relative(experiments, lab);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Lab data must stay inside artifacts/dsh-integration/.');
export const cli = fileURLToPath(new URL('./node_modules/@deepseek-ai/dsh/lib/bin.js', import.meta.url));
/** Launch with isolated model settings; only the explicit GitHub ciphertext path is forwarded. */
export async function launch(args, options = {}) {
  const workspace = path.join(lab, 'workspace');
  await mkdir(workspace, { recursive: true });
  const keep = new Set(['path', 'pathext', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'userprofile', 'appdata', 'localappdata', 'programfiles', 'programfiles(x86)', 'programdata']);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => keep.has(key.toLowerCase())));
  env.DSH_HOME = path.join(lab, 'home');
  env.DSH_TELEMETRY_DISABLED = '1';
  env.DSH_MARKET_GITHUB_TOKEN_FILE = options.isolatedCredentials ? path.join(lab, 'home/community/private/github-token.dpapi') : path.resolve(process.env.DSH_MARKET_GITHUB_TOKEN_FILE || fileURLToPath(new URL('../artifacts/private/github-token.dpapi', import.meta.url)));
  const stdio = options.stdio || (args.some(arg => arg.startsWith('--dump')) ? 'inherit' : ['ignore', 'pipe', 'pipe']);
  const child = spawn(process.execPath, [cli, ...args], { cwd: workspace, env, windowsHide: true, stdio, timeout: options.timeout });
  child.stdout?.on('data', data => {
    const text = data.toString();
    const url = text.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/);
    if (url) void writeFile(path.join(lab, 'url.txt'), url[0] + '\n');
    if (!options.quiet) process.stdout.write(text.replace(/token=[A-Za-z0-9_-]+/g, 'token=[local]'));
  });
  child.stderr?.on('data', data => process.stderr.write(data));
  return child;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const child = await launch(process.argv.slice(2));
  child.on('exit', code => { process.exitCode = code || 0; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}
