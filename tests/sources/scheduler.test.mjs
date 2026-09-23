import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSourceChecks } from '../../src/sources/scheduler.mjs';

test('host source scheduling starts immediately, ticks, and stops before disposal', async () => {
  let checks = 0, closed = false, tick, cancelled;
  const manager = { syncDue: async () => { checks++; }, close: async () => { closed = true; } };
  const stop = scheduleSourceChecks(manager, {
    setInterval: (callback, ms) => { tick = callback; assert.equal(ms, 60000); return 7; },
    clearInterval: timer => { cancelled = timer; },
  });
  assert.equal(checks, 1);
  tick(); assert.equal(checks, 2);
  await stop();
  assert.equal(cancelled, 7); assert.equal(closed, true);
  tick(); assert.equal(checks, 2);
});
