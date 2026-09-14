import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ExtensionManager } from './plugin/compatibility/manager.mjs';
import { ProfileInstaller } from './plugin/compatibility/installer.mjs';
import { profilePackages } from './plugin/compatibility/ports.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts/dsh-integration');
await mkdir(artifacts, { recursive: true });
process.env.DSH_TEST_LAB = await mkdtemp(path.join(artifacts, 'compatibility-'));
const { lab, launch, cli } = await import('./host.mjs');
const { setPlugin } = await import('./set-plugin.mjs');
const home = path.join(lab, 'home');
const evidence = [];
async function completed(child) {
  const [code, signal] = await once(child, 'exit');
  assert.equal(code, 0, `Official CLI failed: ${signal || code}`);
}
await completed(await launch(['web', '--dump-config'], { stdio: 'ignore', timeout: 60000 }));
const installer = new ProfileInstaller({ home, profile: 'web', cli, folder: path.join(home, 'community/operations') });
const packages = profilePackages(home, 'web');
const manager = new ExtensionManager({ environment: { profile: 'web', hostVersion: '0.1.5-rc.2' }, packages, native: { read: async () => [] }, standard: { read: async () => [], adapter: () => undefined }, installer });
console.log('Installing the pinned public adapter through the marketplace installer and official DSH CLI.');
const plan = await manager.prepare({ action: 'prepare-install', spec: '@dsh-std/adapter-dsh@0.1.1-rc.3' });
assert.equal(plan.allowed, true);
const installed = await manager.execute({ planId: plan.id, requestId: crypto.randomUUID() });
evidence.push({ phase: 'adapter-install', result: installed });
await writeFile(path.join(lab, 'compatibility.json'), JSON.stringify(evidence, null, 2) + '\n');
assert.equal(installed.status, 'restart-required', `Inspect private operation ${installed.operationId}`);
for (const fixture of ['native-extension', 'standard-extension']) {
  // Local fixtures exercise actual loading, not marketplace registry admission.
  const directory = path.join(root, 'integration/fixtures', fixture).replaceAll('\\', '/');
  await completed(await launch(['plugin', '--profile', 'web', 'add', `file:${directory}`, '--ignore-scripts', '--registry=https://registry.npmjs.org'], { quiet: true, stdio: 'ignore', timeout: 120000 }));
}
await setPlugin(false, { compatibilityFixture: true });

async function withHost(run) {
  await writeFile(path.join(lab, 'url.txt'), '');
  const host = await launch(['web', '--port', '0', '--no-open'], { quiet: true });
  const stopped = once(host, 'exit');
  try {
    let origin, cookie;
    for (let attempt = 0; attempt < 240; attempt++) {
      assert.equal(host.exitCode, null, 'Host exited during startup');
      const url = (await readFile(path.join(lab, 'url.txt'), 'utf8')).trim();
      if (url) {
        try {
          const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1000) });
          if (response.status === 302 || response.status === 303) {
            cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
            origin = new URL(url).origin; break;
          }
        } catch { /* Wait only for this owned process to become ready. */ }
      }
      await delay(250);
    }
    assert.ok(origin && cookie, 'Authenticated test host did not become ready');
    const call = async (route, command) => {
      if (route === '/api/community/extensions' && !command) route += '/read';
      const response = await fetch(origin + route, { method: command ? 'POST' : 'GET', headers: { cookie, origin, 'x-community-request': '1', 'content-type': 'application/json' }, ...(command ? { body: JSON.stringify(command) } : {}), signal: AbortSignal.timeout(150000) });
      if (!response.ok) return { status: response.status, body: await response.text() };
      return response.json();
    };
    await run(call);
  } finally { if (host.exitCode === null) host.kill(); await stopped; }
}

console.log('Testing native and standard entry activation and real command execution in one DSH host.');
await withHost(async call => {
  const inventory = await call('/api/community/extensions');
  assert.equal(inventory.adapter, 'available', JSON.stringify(inventory));
  assert.equal(inventory.items.find(row => row.name === 'dsh-market-test-native')?.state, 'active');
  assert.equal(inventory.items.find(row => row.name === 'dsh-market-test-standard')?.state, 'active');
  assert.deepEqual(await call('/api/market-test/native'), { answer: 42, route: 'native' });
  const standard = await call('/api/market-test/standard');
  assert.deepEqual(standard, { kind: 'success', text: 'Standard command: verified' });
  evidence.push({ phase: 'coexist-and-execute', inventory, standard });
  const remove = await call('/api/community/extensions', { action: 'prepare-remove', name: 'dsh-market-test-native' });
  assert.equal(remove.allowed, true);
  const result = await call('/api/community/extensions', { action: 'execute', planId: remove.id, requestId: crypto.randomUUID() });
  assert.equal(result.status, 'restart-required', JSON.stringify(result));
  assert.equal((await call('/api/community/extensions')).items.find(row => row.name === 'dsh-market-test-native')?.state, 'restart-required');
  evidence.push({ phase: 'native-remove', result });
});
await withHost(async call => {
  const inventory = await call('/api/community/extensions');
  assert.equal(inventory.items.some(row => row.name === 'dsh-market-test-native'), false);
  assert.equal(inventory.items.find(row => row.name === 'dsh-market-test-standard')?.state, 'active');
  assert.equal(inventory.adapter, 'available');
  assert.deepEqual(await call('/api/market-test/standard'), { kind: 'success', text: 'Standard command: verified' });
  evidence.push({ phase: 'restart-preserves-standard', inventory });
});
await writeFile(path.join(lab, 'compatibility.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`Compatibility host verification passed: ${path.relative(root, lab)}`);
