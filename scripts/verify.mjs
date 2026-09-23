import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTokens } from './tokens.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
process.env.DSH_MARKET_GITHUB_TOKEN_FILE ||= path.join(root, 'artifacts/private/github-token.dpapi');
function repositoryFiles() {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw Error('Verification requires the repository checkout and Git');
  return [...new Set(result.stdout.split('\0').filter(Boolean))].map(file => path.join(root, file));
}
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const contents = new Map();
for (const filename of repositoryFiles()) {
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
assert.equal(contents.get('src/prototype/tokens.css'), await generateTokens(), 'Run npm run tokens after editing tokens.json');
const styles = contents.get('src/prototype/styles.css');
assert(!/var\(--p-/.test(styles), 'Components must use semantic tokens, not primitive colors');
assert(!/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(styles), 'Put literal colors in tokens.json');
const edges = {
  'src/prototype/catalog.mjs': [], 'src/prototype/state.mjs': ['catalog'],
  'src/prototype/components.mjs': ['state'], 'src/prototype/views.mjs': ['catalog', 'state', 'components'],
  'src/prototype/app.mjs': ['catalog', 'state', 'components', 'views'],
};
for (const [file, allowed] of Object.entries(edges)) {
  for (const match of contents.get(file).matchAll(/\bfrom\s+['"]\.\/([^'"]+)\.mjs['"]/g)) assert(allowed.includes(match[1]), `${file}: unexpected dependency ${match[1]}`);
}
assert(!/\b(?:document|window|localStorage|fetch)\b/.test(contents.get('src/prototype/state.mjs')), 'State transitions must stay independent of browser and network effects');
const tokens = JSON.parse(contents.get('src/prototype/tokens.json'));
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
const marketStyles = contents.get('src/plugin/market/market.css');
assert(!/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(marketStyles), 'Host components must consume shared color tokens');
assert(!/prototype\/(?:styles|tokens)/.test(contents.get('src/plugin/market/components.tsx')), 'Host market must not import the independent prototype theme');
assert(!/\b(?:window|document|localStorage)\b/.test(contents.get('src/plugin/market/controller.ts')), 'Market state depends on a storage port, not browser internals');
run(['--test', 'tests/repository.test.mjs']);
run(['catalog/build.mjs', '--check']);
run(['--test', 'tests/catalog/reviewed.test.mjs', 'tests/sources/global-removals.test.mjs']);
run(['src/sources/check.mjs']);
run(['--test', 'tests/sources/discovery-contracts.test.mjs', 'tests/sources/npm-discovery.test.mjs', 'tests/sources/community-discovery.test.mjs', 'tests/sources/mcp-discovery.test.mjs', 'tests/sources/multi-skill.test.mjs', 'tests/sources/merge.test.mjs', 'tests/sources/release-seed.test.mjs']);
run(['--test', 'tests/prototype/state.test.mjs', 'tests/prototype/server.test.mjs', 'tests/prototype/browser.test.mjs', 'tests/integration/append.test.mjs', 'tests/community/public-market.test.mjs', 'tests/languages/languages.test.mjs', 'tests/catalog/categories.test.mjs', 'tests/sources/documentation.test.mjs', 'tests/sources/scheduler.test.mjs', 'tests/sources/skill-discovery.test.mjs', 'tests/community/repository-stars.test.mjs', 'tests/integration/controller.test.mjs', 'tests/catalog/catalog.test.mjs', 'tests/sources/sources.test.mjs', 'tests/sources/manager.test.mjs', 'tests/sources/packages.test.mjs', 'tests/sources/http.test.mjs']);
const hostLock = JSON.parse(contents.get('package-lock.json'));
run(['--test', 'tests/sources/github-auth.test.mjs']);
run(['--test', 'tests/community/npm-downloads.test.mjs']);
run(['--test', 'tests/integration/documentation.test.mjs', 'tests/integration/translation.test.mjs', 'tests/integration/availability.test.mjs']);
run(['--test', 'tests/integration/resource-command.test.mjs', 'tests/integration/skill-files.test.mjs', 'tests/integration/skill-resources.test.mjs', 'tests/sources/skill-transport.test.mjs']);
run(['--test', 'tests/integration/mcp-config.test.mjs', 'tests/integration/mcp-manager.test.mjs', 'tests/integration/mcp-profile.test.mjs']);
run(['--test', 'tests/integration/compatibility.test.mjs', 'tests/integration/compatibility-ports.test.mjs', 'tests/integration/native-control.test.mjs', 'tests/integration/extension-manager.test.mjs', 'tests/integration/installer.test.mjs', 'tests/integration/extensions-http.test.mjs', 'tests/integration/extension-client.test.mjs']);
run(['--test', 'tests/integration/standard-view.test.mjs', 'tests/integration/standard-loader.test.mjs', 'tests/integration/standard-control.test.mjs', 'tests/integration/standard-manager.test.mjs']);
run(['--test', 'tests/integration/standard-release.test.mjs']);
for (const [name, dependency] of Object.entries(hostLock.packages)) {
  if (/(?:^|\/)node_modules\/@deepseek-ai\/dsh(?:-[^/]+)?$/.test(name)) assert.equal(dependency.version, '0.1.5-rc.2', `${name}: unexpected DSH version`);
}
try { await access(path.join(root, 'node_modules/typescript/bin/tsc')); }
catch { throw new Error('Install host experiment dependencies first: npm ci --ignore-scripts'); }
run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
run(['scripts/host/build.mjs']);
run(['--test', 'tests/integration/package.test.mjs']);
run(['scripts/host/verify-package.mjs']);
run(['scripts/host/verify-compatibility.mjs']);
run(['scripts/host/verify-standard.mjs']);
run(['scripts/host/verify-resources.mjs']);
run(['scripts/host/verify.mjs']);
console.log('Verification passed: prototype, adapter, type checks, and real DSH browser experiments. Evidence is in artifacts/.');
