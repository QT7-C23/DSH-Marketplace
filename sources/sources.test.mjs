import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readSkills, readDsh, readMcp } from './adapters.mjs';
import { sourceResource } from './contracts.mjs';
import { readUpstream, readSkillBlob, readBytes } from './request.mjs';
import { PLUGINS, MCP_SERVERS } from './definitions.mjs';

const blob = text => ({ sha: createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0${text}`).digest('hex'), size: Buffer.byteLength(text), encoding: 'base64', content: Buffer.from(text).toString('base64') });
test('Skill blob reads reject mismatched bytes', async () => {
  await assert.rejects(readSkillBlob({ sha: 'a'.repeat(40), size: 3 }, async () => blob('changed')), /校验/);
});
test('DSH package discovery pins host version and keeps Slash linked to one package', async () => {
  const items = await readDsh(async url => {
    const name = decodeURIComponent(url.split('/').at(-2));
    return { name, version: '0.1.5-rc.2', description: 'Published package', license: 'MIT', repository: { directory: 'packages/example' }, dist: { tarball: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-0.1.5-rc.2.tgz`, integrity: 'sha512-' + Buffer.alloc(64).toString('base64') }, peerDependencies: { '@deepseek-ai/dsh-commands': '^0.1.5-rc.2' } };
  });
  assert.equal(items.filter(item => item.type === '插件').length, PLUGINS.length);
  for (const slash of items.filter(item => item.type === 'Slash')) assert.ok(items.some(item => item.id === slash.parentId && item.type === '插件'));
  await assert.rejects(readDsh(async () => ({ name: 'wrong', version: '999' })), /包|版本/);
});
test('MCP discovery preserves executable definitions as data through directory pagination', async () => {
  const items = await readMcp(async () => ({ servers: MCP_SERVERS.map(([name]) => ({ server: { name, version: '1.0.0', description: 'Original description', repository: { url: 'https://github.com/owner/repo' }, remotes: [{ type: 'streamable-http', url: 'https://mcp.example/mcp', headers: [{ name: 'Authorization', isSecret: true }] }] }, _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active', isLatest: true } } })), metadata: { count: MCP_SERVERS.length } }));
  assert.equal(items.length, MCP_SERVERS.length);
  assert.equal(items[0].serverDefinition.remotes[0].headers[0].isSecret, true);
  assert.match(items[0].requirements, /配置|身份/);
  await assert.rejects(readMcp(async () => ({ server: { name: 'unrelated' } })), /目录|注册/);
});
test('upstream reads reject redirects, errors and arbitrary destinations without credentials', async () => {
  let called = false;
  await assert.rejects(readUpstream('https://private.example/x', async () => { called = true; }), /来源地址/);
  assert.equal(called, false);
  await assert.rejects(readUpstream('https://api.github.com/repos/a/b', async (_, options) => { assert.equal(options.redirect, 'error'); assert.equal(options.headers.authorization, undefined); return new Response('', { status: 429 }); }), /429/);
});

test('a reset public connection retries once without accepting partial data or ignoring shutdown', async () => {
  let calls = 0;
  const bytes = await readBytes('https://raw.githubusercontent.com/openai/skills/main/README.md', async () => {
    calls++;
    if (calls === 1) throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    return new Response('original complete content');
  });
  assert.equal(calls, 2); assert.equal(bytes.toString(), 'original complete content');
  calls = 0;
  await assert.rejects(readBytes('https://api.github.com/repos/openai/skills', async () => { calls++; throw new DOMException('stopped', 'AbortError'); }), /stopped/);
  assert.equal(calls, 1);
});

test('a timed out public read retries once with a fresh deadline and no credentials', async () => {
  const url = 'https://raw.githubusercontent.com/anthropics/skills/' + 'a'.repeat(40) + '/skills/example/SKILL.md';
  for (const failure of [new DOMException('timed out', 'TimeoutError'), new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })]) {
    const signals = [];
    const bytes = await readBytes(url, async (address, options) => {
      assert.equal(address, url);
      assert.equal(options.redirect, 'error');
      assert.deepEqual(options.headers, { accept: 'application/json', 'user-agent': 'DSH-Extension-Market' });
      signals.push(options.signal);
      if (signals.length === 1) throw failure;
      return new Response('complete bytes');
    });
    assert.equal(bytes.toString(), 'complete bytes');
    assert.equal(signals.length, 2);
    assert.notEqual(signals[0], signals[1]);
  }
});

test('a body timeout discards the incomplete attempt and repeated timeouts remain failures', async () => {
  const timeout = new DOMException('timed out', 'TimeoutError');
  let attempts = 0;
  const bytes = await readBytes('https://api.github.com/public', async () => {
    if (++attempts > 1) return new Response('complete');
    let reads = 0;
    return new Response(new ReadableStream({ pull(controller) {
      if (reads++ === 0) controller.enqueue(Buffer.from('partial'));
      else controller.error(timeout);
    } }));
  });
  assert.equal(bytes.toString(), 'complete');
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(readBytes('https://api.github.com/public', async () => { attempts++; throw timeout; }), error => error === timeout);
  assert.equal(attempts, 2, 'An unavailable upstream must not trigger an unbounded retry loop');
});

test('public read retries cannot bypass destination, HTTP status, redirect or size boundaries', async () => {
  for (const url of ['http://api.github.com/x', 'https://user:secret@api.github.com/x', 'https://api.github.com:444/x', 'https://raw.githubusercontent.com.evil.example/x', 'https://127.0.0.1/x']) {
    await assert.rejects(readBytes(url, async () => assert.fail('Invalid destinations must never be requested')), /来源地址/);
  }
  for (const status of [302, 401, 403, 404, 429, 503]) {
    let attempts = 0;
    await assert.rejects(readBytes('https://api.github.com/public', async () => { attempts++; return new Response('', { status }); }), error => error.status === status);
    assert.equal(attempts, 1);
  }
  let attempts = 0, cancelled = false;
  await assert.rejects(readBytes('https://api.github.com/public', async () => {
    attempts++;
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(Buffer.alloc(4 * 1024 * 1024 + 1)); },
      cancel() { cancelled = true; },
    }));
  }), /响应过大/);
  assert.equal(attempts, 1); assert.equal(cancelled, true);
  const redirect = new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  attempts = 0;
  await assert.rejects(readBytes('https://api.github.com/public', async () => { attempts++; throw redirect; }), error => error === redirect);
  assert.equal(attempts, 1);
});
