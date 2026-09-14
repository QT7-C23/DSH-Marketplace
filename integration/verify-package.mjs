import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '../node_modules/playwright/index.mjs';
import { buildPackage } from './package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts/dsh-integration');
await mkdir(artifacts, { recursive: true });
process.env.DSH_TEST_LAB = await mkdtemp(path.join(artifacts, 'package-'));
const { launch, lab } = await import('./host.mjs');
const evidence = [];
async function completed(child) { const [code, signal] = await once(child, 'exit'); assert.equal(code, 0, `Official CLI failed: ${signal || code}`); }
const artifact = await buildPackage();
console.log('Installing the standalone marketplace archive with the official CLI.');
await completed(await launch(['web', '--dump-config'], { stdio: 'ignore', timeout: 60000, isolatedCredentials: true }));
const profile = path.join(lab, 'home/profiles/web');
const originalPatch = await readFile(path.join(profile, 'cordis.patch.yml'), 'utf8');
await completed(await launch(['plugin', '--profile', 'web', 'add', artifact.archive, '--ignore-scripts', '--registry=https://registry.npmjs.org'], { quiet: true, timeout: 120000, isolatedCredentials: true }));
assert.equal(await readFile(path.join(profile, 'cordis.patch.yml'), 'utf8'), originalPatch, 'No manual source mount or overlay');
const installedPath = await realpath(path.join(profile, 'node_modules/dsh-market-integration'));
assert(installedPath.startsWith(profile + path.sep));
const manifest = JSON.parse(await readFile(path.join(installedPath, 'package.json'), 'utf8'));
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
const profileManifest = JSON.parse(await readFile(path.join(profile, 'package.json'), 'utf8'));
assert(profileManifest.dependencies['dsh-market-integration']);
evidence.push({ phase: 'official-install', name: manifest.name, version: manifest.version, bytes: artifact.bytes, sha256: artifact.sha256, sourceMount: false });

async function withHost(check) {
  await writeFile(path.join(lab, 'url.txt'), '');
  const host = await launch(['web', '--port', '0', '--no-open'], { quiet: true, isolatedCredentials: true });
  const stopped = once(host, 'exit');
  let browser;
  try {
    let url;
    for (let attempt = 0; attempt < 240; attempt++) {
      assert.equal(host.exitCode, null, 'Packaged host exited');
      url = (await readFile(path.join(lab, 'url.txt'), 'utf8')).trim();
      if (url) { try { const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1000) }); if ([200, 302, 303].includes(response.status)) break; } catch {} }
      await delay(250);
    }
    assert(url, 'Packaged host did not become ready');
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const name of ['继续', '稍后配置']) await page.addLocatorHandler(page.getByRole('button', { name, exact: true }), button => button.click());
    await page.goto(url);
    await page.getByRole('button', { name: '新建会话', exact: true }).first().waitFor();
    await check(page);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); if (host.exitCode === null) host.kill(); await stopped; }
}

await withHost(async page => {
  const origin = new URL(page.url()).origin;
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('heading', { name: '发现资源', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '扩展市场', exact: true }).count(), 1);
  const response = await page.request.get(origin + '/api/community/read');
  assert.equal(response.status(), 200);
  const snapshot = await response.json();
  assert.equal(snapshot.catalog.length, 30);
  const resource = snapshot.catalog.find(item => item.type === 'Prompt');
  const download = await page.request.post(origin + '/api/community', { headers: { origin, 'x-community-request': '1' }, data: { action: 'download', id: resource.id, baseRevision: resource.revision, requestId: crypto.randomUUID() } });
  assert.equal(download.status(), 200, await download.text());
  const inventory = await (await page.request.get(origin + '/api/community/extensions/read')).json();
  assert.equal(inventory.hostVersion, '0.1.5-rc.2');
  const self = inventory.items.find(item => item.name === 'dsh-market-integration');
  assert.equal(self?.state, 'active'); assert.equal(self.removable, false);
  await page.locator('.market-nav button').nth(2).click();
  await page.getByRole('heading', { name: 'GitHub 连接', exact: true }).waitFor();
  for (const [locale, title] of [['en-US', 'GitHub connection'], ['ja-JP', 'GitHub 接続'], ['zh-CN', 'GitHub 连接']]) {
    await page.locator('.community-market select').first().selectOption(locale);
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
  }
  await page.screenshot({ path: path.join(lab, 'installed-settings.png'), fullPage: true });
  const github = await (await page.request.get(origin + '/api/community/github/read')).json();
  assert.equal(github.configured, false);
  evidence.push({ phase: 'host-and-ui', catalog: snapshot.catalog.length, self, hostVersion: inventory.hostVersion, languages: 3, promptExport: true, credentialConfigured: false });
});

const database = await readFile(path.join(lab, 'home/community/community.sqlite'));
await writeFile(path.join(lab, 'home/community/retained-data.txt'), 'Keep user data after uninstall.\n');
console.log('Removing the package through the official CLI and checking restart and retained data.');
await completed(await launch(['plugin', '--profile', 'web', 'remove', 'dsh-market-integration'], { quiet: true, timeout: 120000, isolatedCredentials: true }));
assert.equal(JSON.parse(await readFile(path.join(profile, 'package.json'), 'utf8')).dependencies?.['dsh-market-integration'], undefined);
assert.equal(await readFile(path.join(profile, 'cordis.patch.yml'), 'utf8'), originalPatch);
assert.deepEqual(await readFile(path.join(lab, 'home/community/community.sqlite')), database);
await withHost(async page => {
  assert.equal(await page.getByRole('button', { name: '扩展市场', exact: true }).count(), 0);
  const response = await page.request.get(new URL('/api/community/read', page.url()).href);
  assert.notEqual(response.status(), 200);
});
assert.equal(await readFile(path.join(lab, 'home/community/retained-data.txt'), 'utf8'), 'Keep user data after uninstall.\n');
evidence.push({ phase: 'official-remove-and-restart', entryRemoved: true, dataPreserved: true });
await writeFile(path.join(lab, 'package-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`Standalone package verification passed: ${path.relative(root, lab)}`);
