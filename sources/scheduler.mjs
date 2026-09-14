/** The host owns this timer; disabling the plugin drains in-flight discovery. */
export function scheduleSourceChecks(manager, timers = globalThis) {
  let stopped = false;
  const check = () => { if (!stopped) void manager.syncDue(); };
  check();
  const timer = timers.setInterval(check, 60000);
  timer.unref?.();
  return async () => { stopped = true; timers.clearInterval(timer); await manager.close(); };
}
