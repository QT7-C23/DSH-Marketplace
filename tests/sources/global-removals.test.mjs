import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SourceManager } from '../../src/sources/manager.mjs';
import { removalList, applyRemovals } from '../../src/sources/removals.mjs';
import { registryEntries } from '../../src/sources/community.mjs';
import seed from '../../catalog/source-seed.json' with { type: 'json' };

const issue = 'https://github.com/QT7-C23/DSH-Marketplace/issues/1';
const rule = id => ({ id, reason: 'Author requested withdrawal', issue });
const sample = seed.find(row => row.id === 'dsh').entries.find(item => item.type === '插件');
const packageName = sample.bundle.name;
const proposal = { schema: 1, id: 'reviewed-plugin', type: '插件', title: sample.title, summary: sample.summary, body: '', version: sample.version, url: sample.url, author: 'author', license: 'MIT', language: 'en', packageRef: { name: packageName, version: sample.version } };

test('a reviewed withdrawal hides all package aliases through rediscovery, restart and failed policy refresh', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-global-removal-'));
  let fail = false;
  const reviewed = registryEntries({ schema: 1, entries: [proposal], removals: [rule('source-community-reviewed-plugin')] });
  const npm = { ...sample, id: 'source-npm-alias', sourceId: 'npm', bundle: undefined, packageRef: proposal.packageRef };
  const adapters = { community: async () => { if (fail) throw Error('offline'); return { entries: reviewed.entries, removals: reviewed.removals }; }, npm: async () => ({ entries: [npm] }) };
  const manager = new SourceManager(folder, { adapters });
  assert(manager.resources().some(item => item.id === sample.id));
  await manager.sync('community');
  assert(!manager.resources().some(item => item.id === sample.id), 'Native winner must be withdrawn too');
  await manager.sync('npm');
  assert(!manager.resources().some(item => item.id === npm.id || item.id === sample.id));
  await assert.rejects(manager.download(sample.id, sample.revision), /不可用/);
  const reopened = new SourceManager(folder, { adapters });
  fail = true; await reopened.sync('community');
  assert.equal(reopened.status().find(row => row.id === 'community').state, 'error');
  assert(!reopened.resources().some(item => item.id === sample.id || item.aliasIds?.includes(npm.id)));
  assert(!reopened.resources().some(item => item.type === 'Slash' && item.parentId === sample.id));
});

test('legacy id withdrawal learns a stable identity and persists it when the original directory entry disappears', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-legacy-removal-'));
  let entries = [sample];
  const manager = new SourceManager(folder, { adapters: { community: async () => ({ entries: [], removals: [rule(sample.id)] }), dsh: async () => ({ entries }), npm: async () => ({ entries: [{ ...sample, id: 'source-npm-replacement', sourceId: 'npm' }] }) } });
  await manager.sync('community'); entries = []; await manager.sync('dsh'); await manager.sync('npm');
  assert(!new SourceManager(folder).resources().some(item => item.id === 'source-npm-replacement'));
});

test('a Skill withdrawal is scoped to its directory; malformed policies fail without widening scope', () => {
  const skills = seed.find(row => row.id === 'skills').entries;
  const record = { ...rule(skills[0].id), identities: [`skill:${skills[0].bundle.repository}/${skills[0].bundle.root}`] };
  const result = applyRemovals({ entries: skills }, [record]);
  assert.equal(result.entries.length, skills.length - 1);
  assert(result.entries.some(item => item.id === skills[1].id));
  for (const identities of [['package:*'], ['skill:anthropics/skills'], ['https://evil.test'], ['package:valid', 'package:valid']]) assert.throws(() => removalList([{ ...record, identities }]), /移除/);
  assert.throws(() => removalList([record, record]), /移除/);
});

test('only reviewed community discovery may supply global withdrawal policy', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-policy-owner-'));
  const manager = new SourceManager(folder, { adapters: { npm: async () => ({ entries: [], removals: [rule(sample.id)] }) } });
  await manager.sync('npm');
  assert.equal(manager.status().find(row => row.id === 'npm').state, 'stale');
  assert(manager.resources().some(item => item.id === sample.id));
});

test('withdrawing a native Slash by legacy ID also withdraws its reviewed alias but preserves its plugin', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-command-removal-'));
  const command = seed.find(row => row.id === 'dsh').entries.find(row => row.type === 'Slash');
  const alias = { ...command, id: 'source-community-command-alias', command: command.title, sourceId: 'community' };
  const manager = new SourceManager(folder, { adapters: { community: async () => ({ entries: [alias], removals: [rule(command.id)] }) } });
  await manager.sync('community');
  assert(!manager.resources().some(row => row.id === command.id || row.id === alias.id));
  assert(manager.resources().some(row => row.id === command.parentId));
});

test('Skill repository casing is canonical across either withdrawal direction and restored explicit policy', async () => {
  const skills = seed.find(row => row.id === 'skills').entries;
  const original = skills[0];
  const alias = { ...original, id: 'source-community-case-alias', sourceId: 'community', bundle: { ...original.bundle, repository: 'Anthropics/Skills' } };
  for (const withdrawn of [original.id, alias.id]) {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-case-removal-'));
    const manager = new SourceManager(folder, { adapters: { community: async () => ({ entries: [alias], removals: [{ ...rule(withdrawn), identities: [`skill:ANTHROPICS/SKILLS/${original.bundle.root}`] }] }) } });
    await manager.sync('community');
    for (const reader of [manager, new SourceManager(folder)]) {
      assert(!reader.resources().some(row => row.id === original.id || row.id === alias.id));
      assert(reader.resources().some(row => row.id === skills[1].id));
    }
  }
});
