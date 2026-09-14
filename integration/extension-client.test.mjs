import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInventory, parsePlan, ExtensionClient } from './plugin/market/extensions.mjs';

const plan = { id: '12345678-1234-1234-1234-123456789012', action: 'install', name: 'test', version: '1.0.0', profile: 'web', hostVersion: '0.1.5-rc.2', routes: ['native'], compatibility: { route: 'native', state: 'unverified', issues: [] }, allowed: true, license: 'MIT', source: 'https://registry.npmjs.org/test/-/test-1.0.0.tgz', permissions: [], restartRequired: true };
test('client validates management responses before enabling destructive controls', () => {
  assert.throws(() => parseInventory({ items: [] }), /无效/);
  assert.throws(() => parseInventory({ schema: 1, profile: 'web', hostVersion: '1.0.0', adapter: 'available', complete: true, items: [{ name: 'test', version: '1', route: 'native', state: 'made-up', removable: true, installed: true }] }), /无效/);
  assert.deepEqual(parsePlan(plan), plan);
  assert.throws(() => parsePlan({ ...plan, allowed: 'true' }), /无效/);
  assert.throws(() => parsePlan({ ...plan, source: 'javascript:alert(1)' }), /无效/);
  assert.throws(() => parsePlan({ ...plan, compatibility: { route: 'native', state: 'incompatible', issues: [] } }), /无效/);
});

test('lost-response retry and concurrent clicks reuse one operation identity', async () => {
  const calls = [];
  const result = { status: 'restart-required', operationId: plan.id, action: 'install', name: 'test', version: '1.0.0', backupCreated: true };
  const client = new ExtensionClient(async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    assert.equal(options.headers['x-community-request'], '1');
    if (calls.length === 1) throw Error('network response lost');
    return Response.json(result);
  });
  await assert.rejects(client.execute(plan, 'zh-CN'), /lost/);
  const [a, b] = await Promise.all([client.execute(plan, 'zh-CN'), client.execute(plan, 'zh-CN')]);
  assert.deepEqual(a, result); assert.deepEqual(b, result); assert.equal(calls.length, 2);
  assert.equal(calls[0].requestId, calls[1].requestId);
  assert.deepEqual(await client.execute(plan, 'zh-CN'), result); assert.equal(calls.length, 2);
});
