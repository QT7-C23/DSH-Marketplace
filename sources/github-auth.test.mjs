import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { GitHubCredentials, validateGitHubToken } from './github-credentials.mjs';
import { createGitHubFetch, GitHubConnection } from './github-auth.mjs';
import { createHandler } from '../community/http.mjs';

const token = 'github_pat_' + 'synthetic_test_only_'.repeat(4);
const statelessInstallation = 'ghs_12345_' + ['synthetic-header', 'synthetic_payload'.repeat(32), 'synthetic-signature'].join('.');
test('stateless GitHub installation tokens remain opaque and accept the current longer URL-safe format', () => {
  assert(statelessInstallation.length > 520);
  assert.equal(validateGitHubToken(statelessInstallation), statelessInstallation);
  for (const invalid of [statelessInstallation + '\n', statelessInstallation + ' ', statelessInstallation.replace('.', '/'), 'ghs_' + 'a'.repeat(1021), 'unrecognized_' + statelessInstallation]) {
    assert.throws(() => validateGitHubToken(invalid), /格式/);
  }
});
test('GitHub CLI OAuth access tokens use the same protected read boundary', () => {
  const oauth = 'gho_' + 'synthetic_test_only_'.repeat(3);
  assert.equal(validateGitHubToken(oauth), oauth);
  assert.throws(() => validateGitHubToken(oauth + '\n'), /格式/);
  const installation = 'ghs_' + 'synthetic_test_only_'.repeat(3);
  assert.equal(validateGitHubToken(installation), installation);
});
function memoryStore() {
  let value = null;
  return { read: async () => value, save: async next => { value = next; }, remove: async () => { value = null; } };
}
const quota = () => Response.json({ resources: { core: { limit: 5000, remaining: 4999, reset: 1800000000 } } });

test('authentication is restricted to exact HTTPS GitHub API GETs, without redirects', async () => {
  const store = memoryStore(); await store.save(token);
  const calls = [];
  const request = createGitHubFetch({ store, request: async (url, options) => { calls.push({ url, options }); return quota(); } });
  await request('https://api.github.com/rate_limit', { redirect: 'follow' });
  assert.equal(calls[0].options.headers.get('authorization'), `Bearer ${token}`);
  assert.equal(calls[0].options.redirect, 'error');
  for (const url of ['https://raw.githubusercontent.com/a/b/main/file', 'https://registry.npmjs.org/x', 'https://api.github.com.evil.example/', 'http://api.github.com/', 'https://api.github.com:444/', 'https://user@api.github.com/']) {
    await request(url);
    assert.equal(calls.at(-1).options.headers.get('authorization'), null);
  }
  await request('https://api.github.com/repos/a/b', { method: 'POST' });
  assert.equal(calls.at(-1).options.headers.get('authorization'), null);
});

test('anonymous requests work and authenticated network failures never echo credentials', async () => {
  const store = memoryStore();
  await createGitHubFetch({ store, request: async (_url, options) => { assert.equal(options.headers.get('authorization'), null); return quota(); } })('https://api.github.com/rate_limit');
  await store.save(token);
  await assert.rejects(createGitHubFetch({ store, request: async () => { throw Error(token); } })('https://api.github.com/rate_limit'), error => !error.message.includes(token) && error.cause === undefined);
});

test('Windows credentials survive restart encrypted; corrupt storage fails closed', { skip: process.platform !== 'win32' }, async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-github-'));
  const file = path.join(folder, 'github.dpapi');
  try {
    const store = new GitHubCredentials(file);
    assert.equal(await store.read(), null);
    await store.save(token);
    assert(!(await readFile(file, 'utf8')).includes(token));
    assert.equal(await new GitHubCredentials(file).read(), token);
    await assert.rejects(store.save(token + '\n'), /令牌/);
    assert.equal(await store.read(), token);
    await store.save(statelessInstallation);
    assert(!(await readFile(file, 'utf8')).includes(statelessInstallation));
    assert.equal(await new GitHubCredentials(file).read(), statelessInstallation);
    await writeFile(file, '{"schema":1,"protection":"windows-dpapi","value":"broken"}');
    await assert.rejects(new GitHubCredentials(file).read(), error => !error.message.includes('broken'));
    await store.remove(); assert.equal(await store.read(), null);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('Windows credential protection tolerates a cold helper startup and remains encrypted', { skip: process.platform !== 'win32' }, async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-github-cold-'));
  const file = path.join(folder, 'github.dpapi');
  const helper = path.join(folder, 'delayed-secret.ps1');
  const original = childProcess.execFile;
  const script = await readFile(new URL('../scripts/github-secret.ps1', import.meta.url), 'utf8');
  await writeFile(helper, script.replace("$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop'\nStart-Sleep -Milliseconds 10500"));
  const intercepted = t.mock.method(childProcess, 'execFile', (executable, args, options, callback) => original(executable, args.map(value => value.endsWith('github-secret.ps1') ? helper : value), options, callback));
  syncBuiltinESMExports();
  try {
    await new GitHubCredentials(file).save(token);
    assert(!(await readFile(file, 'utf8')).includes(token));
    intercepted.mock.restore(); syncBuiltinESMExports();
    assert.equal(await new GitHubCredentials(file).read(), token);
  } finally {
    intercepted.mock.restore(); syncBuiltinESMExports();
    await rm(folder, { recursive: true, force: true });
  }
});

test('Windows credential helpers retry one killed process, preserve saved data and do not retry corruption', { skip: process.platform !== 'win32' }, async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-github-retry-'));
  const file = path.join(folder, 'github.dpapi');
  const original = childProcess.execFile;
  let failures = 1, calls = 0;
  const diagnostics = [];
  t.mock.method(console, 'warn', (...values) => diagnostics.push(values));
  const intercepted = t.mock.method(childProcess, 'execFile', (executable, args, options, callback) => {
    calls++;
    return original(executable, args, { ...options, timeout: failures-- > 0 ? 1 : options.timeout }, callback);
  });
  syncBuiltinESMExports();
  try {
    await new GitHubCredentials(file).save(token);
    assert.equal(calls, 2, 'A killed protection process gets one fresh attempt');
    const encrypted = await readFile(file, 'utf8');
    assert(!encrypted.includes(token));
    calls = 0; failures = 1;
    assert.equal(await new GitHubCredentials(file).read(), token);
    assert.equal(calls, 2, 'A killed decryption process also gets one fresh attempt');
    calls = 0; failures = Infinity;
    await assert.rejects(new GitHubCredentials(file).save(token + 'x'), error => error.status === 503 && !error.message.includes(token));
    assert.equal(calls, 2, 'Persistent failure stays bounded');
    assert.equal(await readFile(file, 'utf8'), encrypted, 'A failed replacement preserves the original ciphertext');
    calls = 0; failures = 0;
    await writeFile(file, '{"schema":1,"protection":"windows-dpapi","value":"broken"}');
    await assert.rejects(new GitHubCredentials(file).read(), error => error.status === 503 && !error.message.includes('broken'));
    assert.equal(calls, 1, 'Corrupt input is not a transient process failure');
    assert(diagnostics.length > 0);
    assert(!JSON.stringify(diagnostics).includes(token));
    assert(!JSON.stringify(diagnostics).includes('broken'));
    for (const [message, data] of diagnostics) {
      assert.equal(message, 'GitHub credential helper failed:');
      assert.deepEqual(Object.keys(JSON.parse(data)).sort(), ['exit', 'mode', 'stage', 'timeout']);
    }
  } finally {
    intercepted.mock.restore(); syncBuiltinESMExports();
    await rm(folder, { recursive: true, force: true });
  }
});

test('save validates first; public status excludes token; rejected replacement preserves credential', async () => {
  const store = memoryStore(); let fail = false; let changed = 0;
  const connection = new GitHubConnection({ store, onChange: () => { changed++; }, request: async (_url, options) => {
    assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${token}`);
    return fail ? new Response(token, { status: 401 }) : quota();
  } });
  assert.equal((await connection.read()).state, 'anonymous');
  const result = await connection.run({ action: 'save', token });
  assert.equal(result.state, 'connected'); assert.equal(result.remaining, 4999);
  assert(!JSON.stringify(result).includes(token)); assert.equal(changed, 1);
  fail = true;
  await assert.rejects(connection.run({ action: 'save', token }), /GitHub/);
  assert.equal(await store.read(), token); assert.equal(changed, 1);
  await assert.rejects(connection.run({ action: 'check' }), /GitHub/);
  assert.equal((await connection.read()).state, 'invalid');
  assert.equal((await connection.run({ action: 'remove' })).state, 'anonymous');
  assert.equal(await store.read(), null);
});

test('rate-limited credentials report quota, and malformed quota cannot validate a token', async () => {
  const store = memoryStore();
  const connection = new GitHubConnection({ store, request: async () => Response.json({ resources: { core: { limit: 5000, remaining: 0, reset: 1800000000 } } }) });
  assert.equal((await connection.run({ action: 'save', token })).state, 'limited');
  const bad = new GitHubConnection({ store, request: async () => Response.json({ token }) });
  await assert.rejects(bad.run({ action: 'check' }), error => !error.message.includes(token));
});

test('settings reject cross-origin and unsupported commands and never expose secrets through GET', async () => {
  const store = memoryStore(); const connection = new GitHubConnection({ store, request: async () => quota() });
  const handle = createHandler({}, undefined, null, null, null, null, null, connection);
  const post = (command, origin = 'http://localhost') => handle(new Request('http://localhost/api/community/github', { method: 'POST', headers: { origin, 'x-community-request': '1', 'content-type': 'application/json' }, body: JSON.stringify(command) }));
  assert.equal((await post({ action: 'save', token }, 'https://evil.example')).status, 403);
  assert.equal(await store.read(), null);
  assert.equal((await post({ action: 'save', token })).status, 200);
  const read = await handle(new Request('http://localhost/api/community/github/read'));
  assert.equal(read.status, 200); assert(!(await read.text()).includes(token));
  assert.equal((await post({ action: 'export' })).status, 400);
  assert.equal((await post({ action: 'save', token: { value: token } })).status, 400);
});

test('real source and Star defaults share encrypted credentials without authenticating other sources', { skip: process.platform !== 'win32' }, async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-github-wiring-'));
  const file = path.join(folder, 'github.dpapi');
  try {
    await new GitHubCredentials(file).save(token);
    const script = `
      const calls = [];
      globalThis.fetch = async (url, options) => {
        calls.push({ origin: new URL(url).origin, authenticated: new Headers(options.headers).has('authorization') });
        return Response.json({ stargazers_count: 42 });
      };
      const { readUpstream, readBytes } = await import(${JSON.stringify(new URL('./request.mjs', import.meta.url).href)});
      const { RepositoryStars } = await import(${JSON.stringify(new URL('../community/repository-stars.mjs', import.meta.url).href)});
      await readUpstream('https://api.github.com/repos/a/b');
      const counts = await new RepositoryStars().read([{ url: 'https://github.com/a/b' }]);
      if (counts['a/b'].count !== 42) throw Error('Star request failed');
      await readBytes('https://raw.githubusercontent.com/a/b/main/README.md');
      await readUpstream('https://registry.npmjs.org/example');
      console.log(JSON.stringify(calls));
    `;
    const output = execFileSync(process.execPath, ['--input-type=module'], { input: script, env: { ...process.env, DSH_MARKET_GITHUB_TOKEN_FILE: file }, encoding: 'utf8', windowsHide: true, timeout: 15000 });
    assert.deepEqual(JSON.parse(output), [
      { origin: 'https://api.github.com', authenticated: true }, { origin: 'https://api.github.com', authenticated: true },
      { origin: 'https://raw.githubusercontent.com', authenticated: false }, { origin: 'https://registry.npmjs.org', authenticated: false },
    ]);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('concurrent settings mutations are rejected while validation is in progress', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const store = memoryStore();
  const connection = new GitHubConnection({ store, request: async () => { await pending; return quota(); } });
  const save = connection.run({ action: 'save', token });
  await assert.rejects(connection.run({ action: 'remove' }), error => error.status === 409);
  assert.equal(await store.read(), null);
  release(); await save;
  assert.equal(await store.read(), token);
});
