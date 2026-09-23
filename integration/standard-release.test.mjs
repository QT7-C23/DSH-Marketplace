import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { standardFixture } from './standard-test-fixture.mjs';
import { standardLoaderConfig, STANDARD_LOADER_EXPORT } from './plugin/compatibility/standard-loader.mjs';
import { prepareUninstall } from './maintenance.mjs';

async function setup() {
  const f = await standardFixture();
  const core = f.compose()[0];
  await f.installer.configure('extension-standard', [
    { id: core.id, name: core.name, config: { ...core.config, discover: false } },
    { insert: [{ id: 'market-std-' + randomUUID(), name: STANDARD_LOADER_EXPORT,
      config: standardLoaderConfig(f.profileDir, core.id, ['alpha']) }] },
  ], await f.installer.fingerprint());
  return f;
}

test('uninstall preparation previews, requires explicit disabled-component consent and preserves unrelated profile text', async () => {
  const f = await setup(); const before = await readFile(f.patch, 'utf8');
  const args = { home: f.home, profile: 'web' };
  const preview = await prepareUninstall(args);
  assert.equal(preview.status, 'preview'); assert.deepEqual(preview.disabledPackages, ['alpha']);
  assert.equal(await readFile(f.patch, 'utf8'), before);
  await assert.rejects(prepareUninstall({ ...args, confirm: preview.fingerprint }), /enable-disabled/);
  const result = await prepareUninstall({ ...args, confirm: preview.fingerprint, enableDisabled: true });
  assert.equal(result.status, 'restart-required');
  assert.deepEqual(f.compose()[0].config, { profileBaseUrl: { __jsExpr: 'ctx.baseUrl' }, runtimeId: 'retained', profile: 'web' });
  assert.equal(f.compose().some(row => row.name === STANDARD_LOADER_EXPORT), false);
  assert.match(await readFile(f.patch, 'utf8'), /# keep user text/);
  assert.equal((await prepareUninstall(args)).status, 'not-managed');
  assert.equal(await readFile(path.join(f.home, 'community/operations', result.operationId, 'backup/cordis.patch.yml'), 'utf8'), before);
});

test('uninstall preparation rejects stale previews and foreign or corrupt ownership without changing files', async () => {
  for (const change of ['stale', 'owner', 'profile']) {
    const f = await setup(); const args = { home: f.home, profile: 'web' };
    const preview = await prepareUninstall(args);
    let bytes = await readFile(f.patch, 'utf8');
    if (change === 'stale') bytes += '# another editor\n';
    if (change === 'owner') bytes = bytes.replace('"owner":"dsh-market"', '"owner":"someone-else"');
    if (change === 'profile') bytes = bytes.replace('"coreId":"core"', '"coreId":"other"');
    await writeFile(f.patch, bytes);
    await assert.rejects(prepareUninstall({ ...args, confirm: preview.fingerprint, enableDisabled: true }));
    assert.equal(await readFile(f.patch, 'utf8'), bytes);
  }
});
