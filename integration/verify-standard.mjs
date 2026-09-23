import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '../node_modules/playwright/index.mjs';
import { buildPackage } from './package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts/dsh-integration');
await mkdir(artifacts, { recursive: true });
process.env.DSH_TEST_LAB = await mkdtemp(path.join(artifacts, 'standard-'));
const { launch, lab } = await import('./host.mjs');
const evidence = [];
const save = () => writeFile(path.join(lab, 'standard-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
async function completed(child) { const [code, signal] = await once(child, 'exit'); assert.equal(code, 0, `Official CLI failed: ${signal || code}`); }
async function add(spec) {
  await completed(await launch(['plugin', '--profile', 'web', 'add', spec, '--ignore-scripts', '--registry=https://registry.npmjs.org'], { quiet: true, timeout: 120000 }));
}
async function fixture(key, version = '1.0.0') {
  const name = 'dsh-market-test-' + key;
  const directory = path.join(lab, 'fixtures', key + '-' + version);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name, version, type: 'module', license: 'MIT', private: true }));
  await writeFile(path.join(directory, 'dsh-plugin.json'), JSON.stringify({
    $schema: 'https://dsh-std.dev/schema/dsh-plugin.json', manifestVersion: '0.15', id: 'market.' + key, name, version,
    facets: { host: { entry: './index.mjs', apiVersion: 'v1alpha1' } },
    // These producers publish commands; they do not consume the CommandRuntime client.
    requires: { contracts: [] }, permissions: [],
    contributes: { commands: [{ id: 'market.' + key, title: key }], 'x-browser': [{
      apiVersion: 'browser.ui.dsh/v1alpha1', kind: 'LocalModule', id: 'market.' + key + '.browser', name: key + '-browser',
      spec: { module: './browser.js', requirements: [{ apiVersion: 'ui.dsh/v1alpha1', kind: 'ContributionHost',
        spec: { surfaces: [{ apiVersion: 'browser.ui.dsh/v1alpha1', kind: 'SettingsSection', mode: 'local-module' }] } }] },
    }] }, subscriptions: [],
  }));
  await writeFile(path.join(directory, 'index.mjs'), `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(path.join(lab, key + '-imports.txt'))}, ${JSON.stringify(version + '\n')});
export default { activate(context) {
  context.extensions.publish({ apiVersion: 'commands.dsh/v1alpha1', kind: 'Command' }, ${JSON.stringify(key)}, {
    execute: ({ rawInput }) => ({ kind: 'success', text: ${JSON.stringify(key + '@' + version + ':')} + rawInput.trim() }),
  });
} };\n`);
  await writeFile(path.join(directory, 'browser.js'), `window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}, factory: () => ({ default: {
  activate(context) {
    const ui = context.protocols.client({ apiVersion: 'ui.dsh/v1alpha1', kind: 'ContributionHost' });
    const lease = ui.register({ descriptor: { id: ${JSON.stringify('market.' + key + '.settings')},
      surface: { apiVersion: 'browser.ui.dsh/v1alpha1', kind: 'SettingsSection' },
      content: { label: ${JSON.stringify('Fixture ' + key)}, order: 700 } },
      localModule: { component: () => ${JSON.stringify(key + ' settings ' + version)} } });
    context.scope.add(() => lease.dispose());
    document.documentElement.dataset[${JSON.stringify('std' + key)}] = ${JSON.stringify(version)};
    context.scope.add(() => { delete document.documentElement.dataset[${JSON.stringify('std' + key)}]; });
  }
} }) });\n`);
  await add('file:' + directory.replaceAll('\\', '/'));
}

const artifact = await buildPackage();
console.log('Standard lifecycle: installing packaged market, public adapter and two isolated fixtures.');
await completed(await launch(['web', '--dump-config'], { stdio: 'ignore', timeout: 60000 }));
await add(artifact.archive); await add('@dsh-std/adapter-dsh@0.1.1-rc.3');
await fixture('alpha'); await fixture('beta');
const patch = path.join(lab, 'home/profiles/web/cordis.patch.yml');
assert.equal((await readFile(patch, 'utf8')).replace(/^#.*$/gm, '').trim(), '[]');
const probe = fileURLToPath(new URL('./fixtures/standard-management-probe.mjs', import.meta.url)).replaceAll('\\', '/');
await writeFile(patch, `# Owned standard acceptance fixture\n- insert:\n    - id: standard-test-probe\n      name: '${probe}'\n`);

async function withHost(phase, check) {
  await writeFile(path.join(lab, 'url.txt'), '');
  const host = await launch(['web', '--port', '0', '--no-open'], { quiet: true });
  const stopped = once(host, 'exit');
  let browser;
  try {
    let url;
    for (let attempt = 0; attempt < 240; attempt++) {
      assert.equal(host.exitCode, null, 'Standard host exited');
      url = (await readFile(path.join(lab, 'url.txt'), 'utf8')).trim();
      if (url) { try { const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1000) }); if ([200, 302, 303].includes(response.status)) break; } catch {} }
      await delay(250);
    }
    assert(url, 'Standard host did not become ready');
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const name of ['继续', '稍后配置']) await page.addLocatorHandler(page.getByRole('button', { name, exact: true }), button => button.click());
    await page.goto(url);
    await page.getByRole('button', { name: '新建会话', exact: true }).first().waitFor();
    const origin = new URL(url).origin;
    const call = async (route, data) => {
      const response = data ? await page.request.post(origin + route, { headers: { origin, 'x-community-request': '1' }, data }) : await page.request.get(origin + route);
      assert.equal(response.status(), 200, await response.text()); return response.json();
    };
    await check({ page, call });
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(lab, phase + '.png'), fullPage: true });
    evidence.push({ phase, browserErrors: errors }); await save();
  } finally { await browser?.close(); if (host.exitCode === null) host.kill(); await stopped; }
}
const inventory = call => call('/api/community/extensions/read');
const state = call => call('/api/market-test/standard-state');
const item = (value, key) => value.items.find(row => row.name === 'dsh-market-test-' + key);
async function toggle(call, key, enabled, firstAdoption = false) {
  const plan = await call('/api/community/extensions', { action: enabled ? 'prepare-enable' : 'prepare-disable', name: 'dsh-market-test-' + key });
  assert.equal(plan.allowed, true); assert.equal(plan.firstAdoption, firstAdoption);
  const result = await call('/api/community/extensions', { action: 'execute', planId: plan.id, requestId: crypto.randomUUID() });
  assert.equal(result.status, 'restart-required'); return result;
}
async function browserFacets(page, enabled, disabled = []) {
  for (const key of enabled) await page.locator(`html[data-std${key}]`).waitFor({ state: 'attached' });
  for (const key of disabled) assert.equal(await page.locator(`html[data-std${key}]`).count(), 0);
  // The fixture uses the public ContributionHost SettingsSection surface, then marks successful registration.
  for (const key of enabled) assert.equal(await page.locator('html').getAttribute('data-std' + key), '1.0.0');
}

await withHost('01-first-adoption', async ({ page, call }) => {
  const before = await state(call);
  assert.deepEqual(before.replies.alpha, { kind: 'success', text: 'alpha@1.0.0:verified' });
  assert.deepEqual(before.replies.beta, { kind: 'success', text: 'beta@1.0.0:verified' });
  await browserFacets(page, ['alpha', 'beta']);
  await page.getByRole('button', { name: '扩展市场', exact: true }).click();
  await page.getByRole('heading', { name: '发现资源', exact: true }).waitFor();
  await page.getByRole('button', { name: '我的资源', exact: true }).click();
  await page.getByRole('button', { name: '已安装扩展', exact: true }).click();
  const row = page.locator('.extension-row').filter({ has: page.getByRole('heading', { name: 'dsh-market-test-alpha', exact: true }) });
  await row.getByRole('button', { name: '停用入口', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.extension-note').waitFor();
  assert.match(await dialog.locator('.extension-note').innerText(), /首次|接管/);
  await dialog.getByRole('button', { name: '停用入口', exact: true }).click();
  await dialog.getByRole('status').waitFor();
  // Adoption may replace the adapter live, but cannot attest old cleanup in this process.
  for (let attempt = 0; attempt < 80; attempt++) {
    const current = await inventory(call);
    if (current.complete && item(current, 'alpha')?.actual === 'unknown') {
      assert.equal(item(current, 'alpha').toggleable, false); evidence.push({ phase: 'adoption-unresolved', inventory: current }); break;
    }
    assert(attempt < 79, 'Adoption never exposed unresolved ownership'); await delay(100);
  }
});
const alphaImports = await readFile(path.join(lab, 'alpha-imports.txt'), 'utf8');

await withHost('02-disabled-cold-boot', async ({ page, call }) => {
  const current = await inventory(call); assert.equal(current.complete, true);
  assert.equal(item(current, 'alpha').state, 'disabled'); assert.equal(item(current, 'alpha').actual, 'disabled');
  const before = await state(call);
  assert.equal(before.replies.alpha, undefined); assert.equal(before.replies.beta.text, 'beta@1.0.0:verified');
  await browserFacets(page, ['beta'], ['alpha']);
  assert.equal(await readFile(path.join(lab, 'alpha-imports.txt'), 'utf8'), alphaImports, 'Disabled host code was never imported');
  await toggle(call, 'alpha', true);
  const after = await state(call);
  assert.equal(after.runtimeId, before.runtimeId); assert.deepEqual(after.browser, before.browser); assert.deepEqual(after.replies, before.replies);
  assert.equal(item(await inventory(call), 'alpha').actual, 'disabled');
});
await withHost('03-enabled-cold-boot', async ({ page, call }) => {
  const current = await inventory(call); assert.equal(item(current, 'alpha').actual, 'enabled');
  assert.equal((await state(call)).replies.alpha.text, 'alpha@1.0.0:verified');
  await browserFacets(page, ['alpha', 'beta']);
  await toggle(call, 'alpha', false);
  assert.equal((await state(call)).replies.alpha.text, 'alpha@1.0.0:verified');
});
const importsBeforeUpdate = await readFile(path.join(lab, 'alpha-imports.txt'), 'utf8');
await fixture('alpha', '2.0.0'); await fixture('outside');
await withHost('04-disabled-update-and-outside-install', async ({ page, call }) => {
  const current = await inventory(call);
  assert.equal(item(current, 'alpha').version, '2.0.0'); assert.equal(item(current, 'alpha').actual, 'disabled');
  const active = await state(call);
  assert.equal(active.replies.alpha, undefined); assert.equal(active.replies.beta.text, 'beta@1.0.0:verified');
  assert.equal(active.replies.outside.text, 'outside@1.0.0:verified');
  await browserFacets(page, ['beta', 'outside'], ['alpha']);
  assert.equal(await readFile(path.join(lab, 'alpha-imports.txt'), 'utf8'), importsBeforeUpdate, 'Updating a disabled package must not import its new code');
  evidence.push({ phase: 'disabled-version-preserved', inventory: current, commands: active.replies });
});
const home = path.join(lab, 'home');
const maintenance = path.join(home, 'profiles/web/node_modules/dsh-market-integration/integration/maintenance.mjs');
const maintenanceArgs = [maintenance, 'prepare-uninstall', '--home', home, '--profile', 'web'];
const preview = JSON.parse(execFileSync(process.execPath, maintenanceArgs, { encoding: 'utf8', windowsHide: true }));
assert.deepEqual(preview.disabledPackages, ['dsh-market-test-alpha']);
const release = JSON.parse(execFileSync(process.execPath, [...maintenanceArgs, '--confirm', preview.fingerprint, '--enable-disabled'], { encoding: 'utf8', windowsHide: true }));
assert.equal(release.status, 'restart-required');
await completed(await launch(['plugin', '--profile', 'web', 'remove', 'dsh-market-integration'], { quiet: true, timeout: 120000 }));
await withHost('05-prepared-marketplace-uninstall', async ({ page, call }) => {
  const active = await state(call);
  assert.equal(active.replies.alpha.text, 'alpha@2.0.0:verified');
  assert.equal(active.replies.beta.text, 'beta@1.0.0:verified');
  assert.equal(active.replies.outside.text, 'outside@1.0.0:verified');
  await page.locator('html[data-stdalpha="2.0.0"]').waitFor({ state: 'attached' });
  assert.equal(await page.getByRole('button', { name: '扩展市场', exact: true }).count(), 0);
  assert.doesNotMatch(await readFile(patch, 'utf8'), /dsh-market:extension-standard|dsh-market-integration\/standard-loader/);
});
console.log(`Packaged standard lifecycle verification passed: ${path.relative(root, lab)}`);
