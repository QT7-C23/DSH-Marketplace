import test from 'node:test';
import assert from 'node:assert/strict';
import { readNpmDirectory } from './npm.mjs';

const row = (name, keywords = ['dsh-plugin']) => ({ package: { name, version: '1.2.3', description: 'Published extension', keywords, license: 'MIT', publisher: { username: 'author' }, links: { repository: 'git+https://github.com/author/' + name + '.git' } } });
test('npm pagination discovers new packages and deduplicates overlapping keyword searches', async () => {
  const calls = [];
  const result = await readNpmDirectory(async address => {
    const url = new URL(address); calls.push(url);
    const query = url.searchParams.get('text');
    if (query === 'keywords:dsh-plugin') return url.searchParams.get('from') === '0' ? { objects: [row('dsh-new')], total: 2 } : { objects: [row('dsh-later')], total: 2 };
    if (query === 'keywords:dsh-theme') return { objects: [row('dsh-new'), row('dsh-colors', ['dsh-theme'])], total: 2 };
    return { objects: [], total: 0 };
  });
  assert.equal(result.entries.length, 3);
  assert.equal(result.discovery.scanned, 3);
  assert.equal(result.entries.find(item => item.packageRef.name === 'dsh-colors').type, '主题');
  assert.equal(result.entries.find(item => item.packageRef.name === 'dsh-later').packageRef.version, '1.2.3');
  assert.equal(calls.length, 4);
  assert(result.entries.every(item => !item.bundle && /核验/.test(item.requirements)));
});

test('npm malformed pages, changing totals and conflicting package versions never replace a full snapshot', async () => {
  await assert.rejects(readNpmDirectory(async () => ({ objects: [], total: 2 })), /完整|分页/);
  let calls = 0;
  await assert.rejects(readNpmDirectory(async () => ++calls === 1 ? { objects: [row('dsh-first')], total: 2 } : { objects: [row('dsh-second')], total: 3 }), /变化/);
  await assert.rejects(readNpmDirectory(async address => ({ objects: [{ ...row('dsh-first'), package: { ...row('dsh-first').package, version: address.includes('dsh-plugin') ? '1.2.3' : '1.2.4' } }], total: 1 })), /变化|冲突/);
});

test('npm excludes unrelated, malformed and unlicensed packages with attributable reasons', async () => {
  const bad = row('bad;command'), unrelated = row('ordinary', ['other']), unlicensed = row('dsh-no-license'); delete unlicensed.package.license;
  const result = await readNpmDirectory(async address => ({ objects: address.includes('dsh-plugin') ? [bad, unrelated, unlicensed, row('@author/dsh-valid')] : [], total: address.includes('dsh-plugin') ? 4 : 0 }));
  assert.equal(result.entries.length, 1);
  assert.equal(result.discovery.excluded.length, 3);
  assert.equal(result.discovery.scanned, 4);
  assert(result.entries[0].url.startsWith('https:'));
});
