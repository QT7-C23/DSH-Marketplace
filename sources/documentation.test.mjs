import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readDocumentation, Documentation } from './documentation.mjs';
import seed from './catalog.json' with { type: 'json' };
import { githubPrompts } from '../catalog/resources.mjs';

test('Skill and Prompt documents retain original text without replacing it with generated summaries', async () => {
  const skill = seed.find(row => row.id === 'skills').entries.find(item => item.id === 'source-skill-internal-comms');
  const fail = async () => { throw Error('unexpected network call'); };
  const result = await readDocumentation(skill, { read: fail });
  assert.equal(result.files[0].body, skill.body); assert.equal(result.files[0].name, 'SKILL.md');
  assert.equal(result.files[0].commit, skill.bundle.commit);
  assert.equal((await readDocumentation(githubPrompts[0], { read: fail })).files[0].body, githubPrompts[0].body);
});

test('plugin documentation uses its own pinned directory and verifies README bytes', async () => {
  const item = seed.find(row => row.id === 'dsh').entries[0];
  const pathname = new URL(item.url).pathname.split('/').slice(5).join('/') + '/README.md';
  const body = Buffer.from('# Original README\n\n[Guide](./guide.md)\n');
  const sha = createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
  const options = { read: async url => { assert.match(url, /\/contents\/packages\/.+\?ref=[a-f0-9]{40}$/); return [{ name: 'README.md', path: pathname, sha, size: body.length, type: 'file' }]; }, download: async url => { assert.match(url, /raw.githubusercontent.com\/deepseek-ai\/deepseek-harness\/[a-f0-9]{40}\//); return body; } };
  const result = await readDocumentation(item, options);
  assert.equal(result.files[0].body, body.toString()); assert.equal(result.versionMatch, true);
  assert.match(result.files[0].url, /\/blob\/[a-f0-9]{40}\/packages\//);
  await assert.rejects(readDocumentation(item, { ...options, download: async () => Buffer.from('tampered') }), /校验/);
  assert.equal((await readDocumentation(item, { read: async () => [] })).state, 'missing');
});

test('repository READMEs disclose unpinned versions and failures can retry without becoming missing', async () => {
  let calls = 0;
  const item = { ...githubPrompts[0], type: 'MCP', id: 'source-mcp-test', url: 'https://github.com/example/server' };
  const doc = await readDocumentation(item, { read: async url => { calls++; return url.endsWith('/commits/HEAD') ? { sha: 'b'.repeat(40) } : []; } });
  assert.equal(doc.versionMatch, false); assert.equal(doc.scope, 'repository'); assert.equal(calls, 2);
  let fail = true, requests = 0;
  const manager = new Documentation(() => [item], async () => { requests++; if (fail) throw Error('offline'); return doc; });
  await assert.rejects(manager.read(item.id, 1), /offline/); fail = false;
  await Promise.all([manager.read(item.id, 1), manager.read(item.id, 1)]);
  assert.equal(requests, 2);
  await assert.rejects(manager.read('https://private.example', 1), /不可用/);
});

test('the document download limit cannot discard Chinese README behind other languages', async () => {
  const item = seed.find(row => row.id === 'dsh').entries[0];
  const directory = new URL(item.url).pathname.split('/').slice(5).join('/');
  const bytes = Buffer.from('# Author document');
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const names = ['README.de.md', 'README.fr.md', 'README.ja.md', 'README.md', 'README.zh.md'];
  const result = await readDocumentation(item, { read: async () => names.map(name => ({ name, path: directory + '/' + name, sha, size: bytes.length, type: 'file' })), download: async () => bytes });
  assert.deepEqual(result.files.map(file => file.name).sort(), ['README.ja.md', 'README.md', 'README.zh.md']);
});

test('localized README reads overlap, preserve order, and drain failures before returning', async () => {
  const item = seed.find(row => row.id === 'dsh').entries[0];
  const directory = new URL(item.url).pathname.split('/').slice(5).join('/');
  const bytes = Buffer.from('# Original');
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const listing = ['README.md', 'README.zh.md', 'README.ja.md'].map(name => ({ name, path: directory + '/' + name, type: 'file', sha, size: bytes.length }));
  const calls = []; const completions = [];
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const operation = readDocumentation(item, { read: async () => listing, download: async url => { calls.push(url); await barrier; completions.push(url); return bytes; } });
  try { await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.length, 3, 'One slow language must not block starting the other document reads'); }
  finally { release(); await operation; }
  assert.equal(completions.length, 3);
  assert.deepEqual((await operation).files.map(file => file.name), ['README.zh.md', 'README.md', 'README.ja.md']);
  let slowFinished = false;
  await assert.rejects(readDocumentation(item, { read: async () => listing, download: async url => {
    if (url.endsWith('/README.md')) throw Error('upstream failed');
    await new Promise(resolve => setImmediate(resolve)); slowFinished = true; return bytes;
  } }), /upstream failed/);
  assert.equal(slowFinished, true, 'Parallel reads must settle before the failed operation returns');
});
