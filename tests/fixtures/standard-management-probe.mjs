// Isolated acceptance fixture: consumes only public adapter commands and snapshots.
export const name = 'market-standard-management-probe';
export const inject = ['connection', 'dshStd'];
export function apply(ctx) {
  const commands = new Map();
  ctx.effect(() => ctx.dshStd.registerCommandSurfaceProvider({
    participantId: 'market-standard-test-surface', placement: { apiVersion: 'commands.dsh/v1alpha1', kind: 'TestSurface' },
    register(resource, execute) { commands.set(resource.metadata.name, execute); return () => commands.delete(resource.metadata.name); },
  }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/market-test/standard-state', methods: ['GET'], requestBody: 'buffered', fetch: async () => {
    const replies = {};
    for (const [name, execute] of commands) replies[name] = await execute({ rawInput: 'verified', commandId: crypto.randomUUID(), signal: new AbortController().signal });
    return Response.json({ runtimeId: ctx.dshStd.describe().runtime.instanceId, snapshot: await ctx.dshStd.snapshot(), browser: ctx.dshStd.browserFacets(), replies });
  } }));
}
