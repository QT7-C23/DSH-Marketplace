import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'fflate';
import { execFileSync } from 'node:child_process';
import { buildPackage } from '../../scripts/host/package.mjs';
import { credentialFile } from '../../src/sources/github-credentials.mjs';
import { hostRuntime } from '../../src/plugin/host-runtime.mjs';

test('package is a closed installable bundle with runtime dependencies and actual bundled licenses', async () => {
  const result = await buildPackage();
  const tar = Buffer.from(gunzipSync(await readFile(result.archive)));
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/, '');
    const size = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
    const prefix = tar.subarray(offset + 345, offset + 500).toString().replace(/\0.*$/, '');
    if (name) files.set((prefix ? prefix + '/' : '') + name, tar.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  const manifest = JSON.parse(files.get('package/package.json'));
  assert.equal(manifest.name, 'dsh-market-integration');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.exports['./standard-loader'], './src/plugin/compatibility/standard-loader.mjs');
  assert.match(files.get('package/cordis.patch.yml').toString(), /standardLoader: package/);
  assert(files.has('package/src/plugin/compatibility/standard-loader.mjs'));
  assert.equal(manifest.engines.dsh, '0.1.5-rc.2');
  assert.equal(manifest.dependencies['@dsh-std/manifest'], '0.1.1-rc.3');
  assert.equal(manifest.peerDependencies['@deepseek-ai/dsh-llm'], '0.1.5-rc.2');
  assert(!manifest.dependencies['@dsh-std/adapter-dsh'], 'The marketplace must not activate the optional standard adapter by installing itself');
  for (const name of ['LICENSE', 'DISCLAIMER.md', 'README.md', 'README.zh-CN.md', 'README.ja-JP.md', 'scripts/github-secret.ps1', 'catalog/source-seed.json', 'catalog/index.json', 'src/plugin/client.js', 'BUNDLED_DEPENDENCIES.json', 'assets/marketplace.png', 'integration/maintenance.mjs']) assert(files.has('package/' + name), name);
  for (const name of files.keys()) assert(!/(?:^|\/)(?:artifacts|node_modules|tests|fixtures|docs)\/|\.test\.|\.dpapi$|\.sqlite$|client\.tsx$/.test(name), name);
  for (const [name, bytes] of files) {
    if (name.endsWith('.md')) {
      for (const [, target] of bytes.toString().matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        if (/^(?:[a-z]+:|\/|#)/i.test(target)) continue;
        assert(files.has(path.posix.normalize(path.posix.join(path.posix.dirname(name), target.split('#')[0]))), `${name} -> ${target}`);
      }
    }
    if (!/\.(?:mjs|js|json)$/.test(name)) continue;
    const text = bytes.toString();
    assert(!text.includes(fileURLToPath(new URL('../../', import.meta.url))), 'No absolute checkout path in ' + name);
    if (!name.endsWith('.mjs')) continue;
    for (const [, relative] of text.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) assert(files.has(path.posix.normalize(path.posix.join(path.posix.dirname(name), relative))), `${name} -> ${relative}`);
  }
  const licenses = JSON.parse(files.get('package/BUNDLED_DEPENDENCIES.json'));
  assert(licenses.some(row => row.name === 'react-markdown'));
  assert(licenses.some(row => row.name === 'remark-gfm'));
  for (const row of licenses) { assert(row.files.length > 0, row.name); for (const name of row.files) assert(files.has('package/' + name), name); }
  await access(result.archive);
});

test('installed credentials live in DSH data, never the package or process working directory', () => {
  const home = path.resolve('artifacts/installable-package/example-home');
  assert.equal(credentialFile({ DSH_HOME: home }), path.join(home, 'community/private/github-token.dpapi'));
  assert.equal(credentialFile({ DSH_HOME: home, DSH_MARKET_GITHUB_TOKEN_FILE: path.join(home, 'custom.dpapi') }), path.join(home, 'custom.dpapi'));
  assert.equal(credentialFile({ DSH_HOME: 'relative-home' }), path.resolve('relative-home/community/private/github-token.dpapi'));
  assert.equal(credentialFile({}), path.join(homedir(), '.dsh/community/private/github-token.dpapi'));
  assert.throws(() => credentialFile({ DSH_MARKET_GITHUB_TOKEN_FILE: 'relative' }), /absolute/);
});

test('host metadata is resolved from the running official CLI, not a plugin dependency copy', () => {
  const entry = fileURLToPath(new URL('../../node_modules/@deepseek-ai/dsh/lib/bin.js', import.meta.url));
  const runtime = hostRuntime(entry);
  assert.equal(runtime.version, '0.1.5-rc.2');
  assert.equal(runtime.cli, entry);
  assert.equal(runtime.packageVersion('@deepseek-ai/dsh'), runtime.version);
  assert.equal(runtime.packageVersion('not-a-host-package'), null);
  assert.throws(() => hostRuntime(fileURLToPath(import.meta.url)), /official DSH CLI/);
});

test('frontend build inputs remain inside the repository when invoked from outside it', () => {
  const script = `import { buildClient } from ${JSON.stringify(new URL('../../scripts/host/build.mjs', import.meta.url).href)}; console.log(JSON.stringify((await buildClient()).inputs));`;
  const output = execFileSync(process.execPath, ['--input-type=module'], { input: script, cwd: tmpdir(), encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert(JSON.parse(output).every(input => !path.isAbsolute(input) && !input.startsWith('..')), 'The build must use the repository as its input root');
});
