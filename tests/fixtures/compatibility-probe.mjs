// Test-only consumer of the adapter's public command-surface interface.
// This is never mounted by normal host startup or distributed as a resource.
export const name = 'market-compatibility-probe';
export const inject = ['connection', 'dshStd'];
export function apply(ctx) {
  const commands = new Map();
  ctx.effect(() => ctx.dshStd.registerCommandSurfaceProvider({
    participantId: 'market-test-surface', placement: { apiVersion: 'commands.dsh/v1alpha1', kind: 'TestSurface' },
    register(resource, execute) { commands.set(resource.metadata.name, execute); return () => commands.delete(resource.metadata.name); },
  }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/market-test/standard', methods: ['GET'], requestBody: 'buffered', fetch: async () => {
    const execute = commands.get('hello');
    if (!execute) return Response.json({ error: 'command not published' }, { status: 503 });
    return Response.json(await execute({ rawInput: 'verified', commandId: crypto.randomUUID(), signal: new AbortController().signal }));
  } }));
}
