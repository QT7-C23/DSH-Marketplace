// Isolated acceptance only: exercises the real registry pipeline with fixed read-only calls.
export const name = 'market-resource-probe';
export const inject = ['connection', 'agents', 'agentPresets', 'skills', 'tools'];
export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/market-test/skill', methods: ['GET'], requestBody: 'buffered', fetch: async () => {
    let handle;
    try {
      handle = await ctx.agents.create({ sessionId: crypto.randomUUID(), meta: { cwd: process.cwd() }, setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx); } });
      const agent = handle.agent;
      const skills = ctx.agentPresets.serviceFor(agent, 'skills') || ctx.skills;
      const tools = ctx.agentPresets.serviceFor(agent, 'tools') || ctx.tools;
      const skill = await skills.get('brand-guidelines', { scope: agent, cwd: process.cwd() });
      const result = await tools.execute({ callId: crypto.randomUUID(), agent, name: 'skill', arguments: { name: 'brand-guidelines' }, signal: AbortSignal.timeout(10000) });
      return Response.json({ loaded: Boolean(skill), content: skill?.content, result });
    } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
    finally { await handle?.dispose(); }
  } }));
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/market-test/mcp', methods: ['GET'], requestBody: 'buffered', fetch: async () => {
    let handle;
    try {
      handle = await ctx.agents.create({ sessionId: crypto.randomUUID(), meta: { cwd: process.cwd() }, setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx); } });
      const agent = handle.agent;
      const tools = ctx.agentPresets.serviceFor(agent, 'tools') || ctx.tools;
      const search = tools.schemas(agent).find(tool => tool.name.startsWith('mcp__dsh_') && tool.name.endsWith('microsoft_docs_search'));
      if (!search) return Response.json({ error: 'Microsoft Learn tool is not available in the session' }, { status: 503 });
      const result = await tools.execute({ callId: crypto.randomUUID(), agent, name: search.name, arguments: { query: 'What is Azure Blob Storage?' }, signal: AbortSignal.timeout(30000) });
      return Response.json(result);
    } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
    finally { await handle?.dispose(); }
  } }));
}
