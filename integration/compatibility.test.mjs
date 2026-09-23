import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { preparePackage, inspectPackage } from './plugin/compatibility/packages.mjs';
import { assessCompatibility } from './plugin/compatibility/assessment.mjs';
import { createDshProtocolCatalog, createDshManifestCatalog } from '@dsh-std/adapter-dsh';

export const standard = () => ({ $schema: 'https://example.org/dsh-plugin.schema.json', manifestVersion: '0.15', id: 'market.clock', name: 'Clock', version: '1.0.0', facets: { host: { entry: './index.mjs', apiVersion: 'v1alpha1' } }, requires: { contracts: [] }, permissions: [], contributes: { commands: [] }, subscriptions: [] });
const native = () => ({ name: 'market-clock', version: '1.0.0', license: 'MIT', engines: { dsh: '>=0.1.5-rc.2 <0.1.6' }, dsh: { bundle: { patch: './cordis.patch.yml' } } });
test('observed theme failures are pinned to the tested package and host versions', () => {
  const machine = inspectPackage({ ...native(), name: 'dsh-theme-machine', version: '0.1.3' });
  assert.deepEqual(assessCompatibility(machine, { hostVersion: '0.1.5-rc.2' }), { route: 'native', state: 'incompatible', issues: ['theme-startup'] });
  machine.version = '0.1.4';
  assert.equal(assessCompatibility(machine, { hostVersion: '0.1.5-rc.2' }).state, 'declared');
  const opera = inspectPackage({ ...native(), name: 'dsh-skin-galactic-opera', version: '0.2.1' });
  assert(assessCompatibility(opera, { hostVersion: '0.1.5-rc.2' }).issues.includes('theme-contrast'));
  const bloom = inspectPackage({ ...native(), name: '@kubor/dsh-bloom-theme', version: '0.12.0' });
  assert(assessCompatibility(bloom, { hostVersion: '0.1.5-rc.2' }).issues.includes('theme-interaction'));
});
function archive(files) {
  const blocks = [];
  for (const [name, text] of Object.entries(files)) {
    const content = Buffer.from(text); const header = Buffer.alloc(512);
    header.write('package/' + name); header.write(content.length.toString(8).padStart(11, '0'), 124); header.fill(32, 148, 156); header[156] = 48;
    header.write([...header].reduce((a, b) => a + b, 0).toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, content, Buffer.alloc((512 - content.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

test('release preparation pins identity and integrity without importing package code', async () => {
  const bytes = archive({ 'package.json': JSON.stringify(native()), 'index.mjs': 'throw Error("must never execute")', 'cordis.patch.yml': '[]' });
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  const meta = { ...native(), dist: { tarball: 'https://registry.npmjs.org/market-clock/-/market-clock-1.0.0.tgz', integrity } };
  const calls = [];
  const result = await preparePackage('market-clock@1.0.0', { read: async url => { calls.push(url); return meta; }, download: async url => { calls.push(url); return bytes; } });
  assert.equal(result.name, 'market-clock'); assert.equal(result.integrity, integrity); assert.deepEqual(result.routes, ['native']);
  assert.equal(calls.length, 2); assert.match(calls[0], /registry.npmjs.org/);
  await assert.rejects(preparePackage('market-clock@1.0.0', { read: async () => meta, download: async () => Buffer.from('tampered') }), /完整性/);
  await assert.rejects(preparePackage('market-clock@latest'), /固定/);
  await assert.rejects(preparePackage('market-clock@1.0.0 & whoami'), /固定/);
  await assert.rejects(preparePackage('market-clock@1.0.0', { read: async () => ({ ...meta, name: 'other-package' }) }), /不一致/);
});

test('archive preview rejects missing declared entries and unsafe standard paths', async () => {
  const bytes = archive({ 'package.json': JSON.stringify(native()) });
  const meta = { ...native(), dist: { tarball: 'https://registry.npmjs.org/market-clock/-/market-clock-1.0.0.tgz', integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') } };
  await assert.rejects(preparePackage('market-clock@1.0.0', { read: async () => meta, download: async () => bytes }), /入口/);
  const manifest = standard(); manifest.facets.host.entry = '../outside.mjs';
  assert.throws(() => inspectPackage({ name: 'market-clock', version: '1.0.0' }, manifest), /入口|标准/);
  await assert.rejects(preparePackage({ malicious: true }), /固定/);
});

test('dual declarations require a route and malformed standards never silently fall back to native', () => {
  const dual = inspectPackage(native(), standard());
  assert.deepEqual(dual.routes, ['native', 'dsh-std']);
  assert.throws(() => inspectPackage(native(), { ...standard(), manifestVersion: '999' }), /标准/);
  assert.throws(() => inspectPackage({ ...native(), dsh: { bundle: { patch: '../outside.yml' } } }), /配置/);
  assert.deepEqual(inspectPackage({ name: 'plain-library', version: '1.0.0' }).routes, []);
  assert.equal(assessCompatibility(dual, { hostVersion: '0.1.5-rc.2' }).state, 'route-required');
  assert.equal(assessCompatibility(dual, { hostVersion: '0.1.5-rc.2' }, 'native').state, 'incompatible');
  assert.equal(assessCompatibility(dual, { hostVersion: '0.1.5-rc.2' }, 'dsh-std').state, 'incompatible');
});

test('native host constraints distinguish a declared match, a mismatch, and missing evidence', () => {
  const candidate = inspectPackage(native());
  assert.equal(assessCompatibility(candidate, { hostVersion: '0.1.5-rc.2' }, 'native').state, 'declared');
  assert.equal(assessCompatibility(candidate, { hostVersion: '0.1.4' }, 'native').state, 'incompatible');
  delete candidate.packageManifest.engines;
  assert.equal(assessCompatibility(candidate, { hostVersion: '0.1.5-rc.2' }, 'native').state, 'unverified');
  candidate.packageManifest.peerDependencies = { '@deepseek-ai/dsh-commands': '>=0.1.5-rc.2 <0.1.6' };
  assert.equal(assessCompatibility(candidate, { hostVersion: '0.1.5-rc.2', packageVersion: () => '0.1.4' }, 'native').state, 'incompatible');
  assert.equal(assessCompatibility(candidate, { hostVersion: '0.1.5-rc.2', packageVersion: () => '0.1.5-rc.2' }, 'native').state, 'declared');
});

test('standard preflight runs actual protocol negotiation and cannot infer support from catalog existence', () => {
  const manifest = standard();
  manifest.requires.contracts = [{ apiVersion: 'commands.dsh/v1alpha1', kind: 'CommandRuntime' }];
  const candidate = inspectPackage({ name: 'market-clock', version: '1.0.0' }, manifest);
  const environment = { hostVersion: '0.1.5-rc.2' };
  assert.equal(assessCompatibility(candidate, environment, 'dsh-std').state, 'adapter-required');
  const adapter = { protocols: createDshProtocolCatalog(), manifestDefinitions: createDshManifestCatalog(), describe: () => ({ runtime: { declaration: { participant: { id: 'host' }, supports: [] } } }) };
  const missing = assessCompatibility(candidate, environment, 'dsh-std', adapter);
  assert.equal(missing.state, 'incompatible'); assert.ok(missing.issues.length);
  adapter.describe = () => ({ runtime: { declaration: { participant: { id: 'host' }, supports: [{ apiVersion: 'commands.dsh/v1alpha1', kind: 'CommandRuntime' }] } } });
  assert.equal(assessCompatibility(candidate, environment, 'dsh-std', adapter).state, 'negotiated');
  manifest.facets.host.apiVersion = 'v999';
  assert.equal(assessCompatibility(inspectPackage(candidate.packageManifest, manifest), environment, 'dsh-std', adapter).state, 'incompatible');
});
