import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTokens } from './tokens.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
process.env.DSH_MARKET_GITHUB_TOKEN_FILE ||= path.join(root, 'artifacts/private/github-token.dpapi');
async function filesIn(folder) {
  const results = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (['node_modules', 'artifacts', '.git'].includes(entry.name)) continue;
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) results.push(...await filesIn(filename));
    else results.push(filename);
  }
  return results;
}
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const contents = new Map();
for (const filename of await filesIn(root)) {
  if (!/\.(mjs|ts|tsx|css|html|json|md)$/.test(filename)) continue;
  const text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(filename));
  const relative = path.relative(root, filename);
  assert(!/[\t ]+\r?$/m.test(text), `${relative}: trailing whitespace`);
  assert(text.endsWith('\n'), `${relative}: missing final newline`);
  contents.set(relative.split(path.sep).join('/'), text);
  if (filename.endsWith('.mjs')) run(['--check', filename]);
  if (filename.endsWith('.json')) JSON.parse(text);
  if (filename.endsWith('.md')) {
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1].replace(/^<|>$/g, '');
      if (/^(?:[a-z]+:|\/|#)/i.test(target)) continue;
      await access(path.resolve(path.dirname(filename), decodeURIComponent(target.split('#')[0])));
    }
  }
}
assert.equal(contents.get('prototype/tokens.css'), await generateTokens(), 'Run npm run tokens after editing tokens.json');
const styles = contents.get('prototype/styles.css');
assert(!/var\(--p-/.test(styles), 'Components must use semantic tokens, not primitive colors');
assert(!/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(styles), 'Put literal colors in tokens.json');
const edges = {
  'prototype/catalog.mjs': [], 'prototype/state.mjs': ['catalog'],
  'prototype/components.mjs': ['state'], 'prototype/views.mjs': ['catalog', 'state', 'components'],
  'prototype/app.mjs': ['catalog', 'state', 'components', 'views'],
};
for (const [file, allowed] of Object.entries(edges)) {
  for (const match of contents.get(file).matchAll(/\bfrom\s+['"]\.\/([^'"]+)\.mjs['"]/g)) assert(allowed.includes(match[1]), `${file}: unexpected dependency ${match[1]}`);
}
assert(!/\b(?:document|window|localStorage|fetch)\b/.test(contents.get('prototype/state.mjs')), 'State transitions must stay independent of browser and network effects');
const tokens = JSON.parse(contents.get('prototype/tokens.json'));
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
const pairs = [
  ['text', 'surface', 4.5], ['text', 'bg', 4.5], ['muted', 'surface', 4.5], ['muted', 'raised', 4.5],
  ['action-text', 'action', 4.5], ['feature-text', 'feature', 4.5], ['feature-muted', 'feature', 4.5],
  ['danger', 'danger-bg', 4.5], ['green-text', 'green-bg', 4.5], ['blue-text', 'blue-bg', 4.5], ['purple-text', 'purple-bg', 4.5],
  ['field-border', 'surface', 3], ['focus', 'surface', 3],
];
for (const [theme, values] of Object.entries(tokens.themes)) {
  for (const [foreground, background, minimum] of pairs) {
    const [a, b] = [foreground, background].map(key => luminance(tokens.primitive[values[key].slice(1)]));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert(ratio >= minimum, `${theme} ${foreground}/${background}: ${ratio.toFixed(2)} < ${minimum}`);
  }
}
console.log('Static checks passed: UTF-8, whitespace, syntax, local document links, token generation, module boundaries, and 26 contrast pairs.');
const marketStyles = contents.get('integration/plugin/market/market.css');
assert(!/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(marketStyles), 'Host components must consume shared color tokens');
assert(!/prototype\/(?:styles|tokens)/.test(contents.get('integration/plugin/market/components.tsx')), 'Host market must not import the independent prototype theme');
assert(!/\b(?:window|document|localStorage)\b/.test(contents.get('integration/plugin/market/controller.ts')), 'Market state depends on a storage port, not browser internals');
run(['catalog/build.mjs', '--check']);
run(['sources/check.mjs']);
run(['--test', 'tests/state.test.mjs', 'tests/server.test.mjs', 'tests/browser.test.mjs', 'integration/append.test.mjs', 'community/public-market.test.mjs', 'languages/languages.test.mjs', 'catalog/categories.test.mjs', 'sources/documentation.test.mjs', 'sources/scheduler.test.mjs', 'sources/skill-discovery.test.mjs', 'community/repository-stars.test.mjs', 'integration/controller.test.mjs', 'catalog/catalog.test.mjs', 'sources/sources.test.mjs', 'sources/manager.test.mjs', 'sources/packages.test.mjs', 'sources/http.test.mjs']);
const hostLock = JSON.parse(contents.get('integration/package-lock.json'));
run(['--test', 'sources/github-auth.test.mjs']);
run(['--test', 'integration/documentation.test.mjs', 'integration/translation.test.mjs', 'integration/availability.test.mjs']);
run(['--test', 'integration/compatibility.test.mjs', 'integration/compatibility-ports.test.mjs', 'integration/extension-manager.test.mjs', 'integration/installer.test.mjs', 'integration/extensions-http.test.mjs', 'integration/extension-client.test.mjs']);
for (const [name, dependency] of Object.entries(hostLock.packages)) {
  if (/(?:^|\/)node_modules\/@deepseek-ai\/dsh(?:-[^/]+)?$/.test(name)) assert.equal(dependency.version, '0.1.5-rc.2', `${name}: unexpected DSH version`);
}
try { await access(path.join(root, 'integration/node_modules/typescript/bin/tsc')); }
catch { throw new Error('Install host experiment dependencies first: npm ci --prefix integration --ignore-scripts'); }
run(['integration/node_modules/typescript/bin/tsc', '-p', 'integration/tsconfig.json']);
run(['integration/build.mjs']);
run(['--test', 'integration/package.test.mjs']);
run(['integration/verify-package.mjs']);
run(['integration/verify-compatibility.mjs']);
run(['integration/verify.mjs']);
console.log('Verification passed: prototype, adapter, type checks, and real DSH browser experiments. Evidence is in artifacts/.');
