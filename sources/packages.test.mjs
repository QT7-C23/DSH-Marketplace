import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { packageFile } from './packages.mjs';
import seed from './catalog.json' with { type: 'json' };
import { downloadFile } from '../community/download.mjs';
import { setImmediate as nextTurn } from 'node:timers/promises';

function skillFixture() {
  const item = structuredClone(seed.find(row => row.id === 'skills').entries.find(item => item.id === 'source-skill-internal-comms'));
  const contents = new Map();
  item.bundle.files = ['SKILL.md', 'LICENSE.txt', ...Array.from({ length: 7 }, (_, i) => `examples/guide ${i} #?.md`)].map((name, i) => {
    const path = `${item.bundle.root}/${name}`;
    const bytes = Buffer.from(name + '\n原文');
    contents.set(path, bytes);
    return { path, sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), size: bytes.length, mode: i === 8 ? '100755' : '100644' };
  });
  const bytesFor = url => contents.get(decodeURIComponent(new URL(url).pathname).split('/').slice(4).join('/'));
  return { item, contents, bytesFor };
}

test('Skill files download in bounded parallel batches and completion order cannot change the ZIP', async () => {
  const { item, contents, bytesFor } = skillFixture();
  const pending = [];
  let releaseAll = false;
  const archive = packageFile(item, { download: url => {
    assert(url.startsWith(`https://raw.githubusercontent.com/anthropics/skills/${item.bundle.commit}/`));
    if (releaseAll) return Promise.resolve(bytesFor(url));
    return new Promise(resolve => pending.push(() => resolve(bytesFor(url))));
  } });
  try {
    for (let offset = 0; offset < item.bundle.files.length; offset += 4) {
      await nextTurn();
      assert.equal(pending.length, Math.min(offset + 4, item.bundle.files.length), 'Slow files must overlap, with at most four requests active');
      for (const release of pending.slice(offset).reverse()) release();
    }
    const file = await archive;
    const serial = await packageFile(item, { download: async url => bytesFor(url) });
    assert.equal(file.content, serial.content, 'ZIP bytes must not depend on response order');
    const files = unzipSync(Buffer.from(file.content, 'base64'));
    for (const [name, bytes] of contents) assert.deepEqual(Buffer.from(files[name.slice('skills/'.length)]), bytes);
    assert.deepEqual(JSON.parse(Buffer.from(files['SOURCE.json']).toString()).files, item.bundle.files);
  } finally {
    releaseAll = true;
    pending.forEach(release => release());
    await archive;
  }
});

test('a corrupt parallel Skill batch cannot return a partial archive or request queued files', async () => {
  const { item, bytesFor } = skillFixture();
  const requested = [];
  await assert.rejects(packageFile(item, { download: async url => {
    requested.push(url);
    await nextTurn();
    return requested.indexOf(url) === 1 ? Buffer.from('corrupt bytes') : bytesFor(url);
  } }), /校验/);
  const settled = requested.length;
  await nextTurn();
  assert.equal(requested.length, settled, 'No work may outlive the failed package request');
  assert(requested.length <= 4, 'The next batch must not start after integrity failure');
});

test('Skill ZIP preserves all pinned files and refuses changed contents', async () => {
  const item = structuredClone(seed.find(row => row.id === 'skills').entries.find(item => item.id === 'source-skill-internal-comms'));
  const blobs = new Map();
  item.bundle.files = ['SKILL.md', 'LICENSE.txt', 'examples/guide.md'].map(path => {
    const content = Buffer.from(path + '\n原文');
    const sha = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    blobs.set(sha, content);
    return { path: `${item.bundle.root}/${path}`, sha, size: content.length, mode: '100644' };
  });
  const requests = [];
  const download = async url => {
    requests.push(url);
    const entry = item.bundle.files.find(file => url.endsWith('/' + file.path));
    return blobs.get(entry.sha);
  };
  const file = await packageFile(item, { download });
  assert.equal(file.mime, 'application/zip');
  const files = unzipSync(Buffer.from(file.content, 'base64'));
  assert.equal(Buffer.from(files['internal-comms/examples/guide.md']).toString(), 'examples/guide.md\n原文');
  assert.ok(files['internal-comms/LICENSE.txt']);
  assert.match(Buffer.from(files['SOURCE.json']).toString(), new RegExp(item.bundle.commit));
  assert.equal(requests.length, item.bundle.files.length);
  for (const url of requests) assert.ok(url.startsWith(`https://raw.githubusercontent.com/anthropics/skills/${item.bundle.commit}/skills/`));
  await assert.rejects(packageFile(item, { download: async () => Buffer.from('changed') }), /校验/);
});
test('plugin archives must match npm integrity and MCP exports preserve the published server schema', async () => {
  const item = structuredClone(seed.find(row => row.id === 'dsh').entries.find(item => item.bundle));
  const bytes = Buffer.from('package fixture');
  item.bundle.integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  const file = await packageFile(item, { download: async () => bytes });
  assert.equal(file.mime, 'application/gzip');
  assert.deepEqual(Buffer.from(file.content, 'base64'), bytes);
  await assert.rejects(packageFile(item, { download: async () => Buffer.from('changed') }), /校验/);
  const mcp = seed.find(row => row.id === 'mcp').entries[0];
  assert.deepEqual(JSON.parse(downloadFile(mcp).content), mcp.serverDefinition);
});
