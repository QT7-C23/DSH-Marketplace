import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts/dsh-integration');
await mkdir(artifacts, { recursive: true });
process.env.DSH_TEST_LAB = await mkdtemp(path.join(artifacts, 'resources-'));
const { lab, launch } = await import('./host.mjs');
const { setPlugin } = await import('./set-plugin.mjs');
const setup = await launch(['web', '--dump-config'], { stdio: 'ignore', timeout: 60000 });
assert.equal((await once(setup, 'exit'))[0], 0);
await setPlugin(false, { resourceFixture: true });
const evidence = [];
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


let identity, skillIdentity, skillContent;
async function usedSkill(call) {
  const probe = await call('/api/market-test/skill');
  assert.equal(probe.loaded, true, JSON.stringify(probe));
  assert.equal(probe.result.isError, false, JSON.stringify(probe));
  assert(probe.result.content.some(block => block.type === 'text' && block.text.includes(probe.content)));
  if (skillContent) assert.equal(probe.content, skillContent);
  return probe.content;
}
async function absentSkill(call) {
  const probe = await call('/api/market-test/skill');
  assert.equal(probe.loaded, false, JSON.stringify(probe));
  assert.equal(probe.result.isError, true, JSON.stringify(probe));
}
async function registered(call) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await call('/api/community/mcp/read');
    assert(Array.isArray(rows), JSON.stringify(rows));
    if (rows[0]?.state === 'registered') return rows[0];
    assert(!rows.some(row => ['failed', 'missing', 'modified'].includes(row.state)), JSON.stringify(rows));
    await delay(250);
  }
  assert.fail('MCP tools were not registered within the connection deadline');
}
await withHost(async call => {
  const catalog = (await call('/api/community/read')).catalog;
  const resource = catalog.find(row => row.id === 'source-mcp-microsoft-learn-mcp');
  const skill = catalog.find(row => row.type === 'Skill' && row.title === 'brand-guidelines');
  assert(skill, 'The real Anthropic Skill must be discoverable');
  skillIdentity = { id: skill.id, revision: skill.revision };
  const installedSkill = await call('/api/community/skills', { action: 'install', ...skillIdentity });
  assert(['installed', 'loaded'].includes(installedSkill.state), JSON.stringify(installedSkill));
  skillContent = await usedSkill(call);
  assert((await readFile(path.join(lab, 'home/skills/brand-guidelines/SKILL.md'), 'utf8')).includes(skillContent));
  identity = { id: resource.id, revision: resource.revision };
  const plan = await call('/api/community/mcp', { action: 'prepare', ...identity });
  assert(plan.choices.some(choice => choice.supported));
  const result = await call('/api/community/mcp', { action: 'connect', ...identity, choice: 'remote:0', values: {} });
  assert(['registered', 'connecting', 'configured'].includes(result.state), JSON.stringify(result));
  await registered(call);
  evidence.push({ phase: 'registered', result });
});
await withHost(async call => {
  await usedSkill(call);
  assert.equal((await call('/api/community/skills', { action: 'disable', ...skillIdentity })).state, 'disabled');
  await registered(call);
  const rows = await call('/api/community/mcp/read');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'registered', JSON.stringify(rows));
  const result = await call('/api/market-test/mcp');
  assert.equal(result.isError, false, JSON.stringify(result));
  assert.match(JSON.stringify(result.content), /learn\.microsoft\.com/);
  evidence.push({ phase: 'restart-and-call', tools: rows[0].tools });
  const disabled = await call('/api/community/mcp', { action: 'disable', ...identity });
  assert.equal(disabled.state, 'disabled', JSON.stringify(disabled));
});
await withHost(async call => {
  assert.equal((await call('/api/community/skills/read'))[0].state, 'disabled');
  await absentSkill(call);
  assert.equal((await call('/api/community/skills', { action: 'enable', ...skillIdentity })).state, 'loaded');
  const rows = await call('/api/community/mcp/read');
  assert.equal(rows[0].state, 'disabled');
  assert.deepEqual(rows[0].tools, []);
  const enabled = await call('/api/community/mcp', { action: 'enable', ...identity });
  assert(['registered', 'connecting', 'configured'].includes(enabled.state), JSON.stringify(enabled));
  await registered(call);
  const removed = await call('/api/community/mcp', { action: 'remove', ...identity });
  assert.equal(removed.state, 'removed', JSON.stringify(removed));
  evidence.push({ phase: 'restart-disabled-enable-remove', removed });
});
await withHost(async call => {
  await usedSkill(call);
  assert.equal((await call('/api/community/skills', { action: 'remove', ...skillIdentity })).state, 'removed');
  assert.deepEqual(await call('/api/community/mcp/read'), []);
  assert((await call('/api/community/read')).catalog.length > 100);
  evidence.push({ phase: 'restart-removed-market-preserved' });
});
await withHost(async call => {
  assert.equal((await call('/api/community/skills/read'))[0].state, 'removed');
  await absentSkill(call);
  assert(['installed', 'loaded'].includes((await call('/api/community/skills', { action: 'restore', ...skillIdentity })).state));
  evidence.push({ phase: 'skill-removed-after-restart-then-restored' });
});
await withHost(async call => {
  await usedSkill(call);
  evidence.push({ phase: 'skill-restored-original-content-used' });
});
await writeFile(path.join(lab, 'resource-lifecycle.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log('Resource restart verification passed: ' + path.relative(root, lab));
