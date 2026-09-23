import test from 'node:test';
import assert from 'node:assert/strict';
import { executeResourceCommand } from './plugin/resource-command.mjs';

const resource = { type: 'Slash', command: '/plan', parentId: 'source-dsh-plan-mode' };
test('resource commands use the selected host command without changing composer contents', async () => {
  const calls = [];
  const port = { current: () => 'session-a', list: async () => [{ name: 'plan' }], execute: async (...args) => { calls.push(args); return { kind: 'success', text: 'Plan mode on.' }; } };
  assert.equal(await executeResourceCommand(resource, '', port), 'Plan mode on.');
  assert.deepEqual(calls, [['session-a', '/plan']]);
  assert.equal(await executeResourceCommand(resource, 'off', port), 'Plan mode on.');
  assert.deepEqual(calls[1], ['session-a', '/plan off']);
});
test('unavailable or changed sessions and absent commands cannot dispatch', async () => {
  let current = 'session-a', dispatched = 0;
  const port = { current: () => current, list: async () => { current = 'session-b'; return [{ name: 'plan' }]; }, execute: async () => { dispatched++; } };
  await assert.rejects(executeResourceCommand(resource, '', port), /会话已变化/);
  port.list = async () => [];
  await assert.rejects(executeResourceCommand(resource, '', port), /未提供/);
  current = null;
  await assert.rejects(executeResourceCommand(resource, '', port), /选择会话/);
  assert.equal(dispatched, 0);
});
test('only an explicit Slash and user argument reach the host, and handler errors remain failures', async () => {
  const port = { current: () => 'session-a', list: async () => [{ name: 'plan' }], execute: async () => ({ kind: 'error', text: 'Command rejected' }) };
  await assert.rejects(executeResourceCommand({ ...resource, command: '/plan\n/other' }, '', port), /命令/);
  await assert.rejects(executeResourceCommand({ ...resource, type: 'Prompt' }, '', port), /命令/);
  await assert.rejects(executeResourceCommand(resource, '', port), /Command rejected/);
});
