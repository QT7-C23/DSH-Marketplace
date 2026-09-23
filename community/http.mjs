import { CommunityError } from './contracts.mjs';
import { localeOf, translateMessage } from '../languages/index.mjs';
import { operationStatus } from './operation-status.mjs';

const path = '/api/community';
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new CommunityError(400, '缺少请求内容');
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > 110000) { await reader.cancel(); throw new CommunityError(413, '内容过大，请缩短后重试'); }
      chunks.push(chunk.value);
    }
    try {
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
      return value;
    } catch { throw new CommunityError(400, '请求内容格式不正确'); }
  } finally { reader.releaseLock(); }
}

/** Fetch adapter shared by DSH's authenticated route and request-boundary tests. */
export function createHandler(service, readStars = async () => ({}), sources = null, documentation = null, translation = null, availability = null, extensions = null, github = null, skills = null, mcp = null, readNpm = async () => ({}), operations = null) {
  return async request => {
    try {
      const url = new URL(request.url);
      if (url.pathname === `${path}/operations` && operations) return request.method === 'GET' ? json(operationStatus(await operations.recovery())) : json({ error: '请求方法不支持' }, 405, { allow: 'GET' });
      if (url.pathname === `${path}/withdrawals` && sources) return request.method === 'GET' ? json(sources.withdrawals()) : json({ error: '请求方法不支持' }, 405, { allow: 'GET' });
      if (url.pathname === `${path}/resource`) return request.method === 'GET' ? json(service.resource(url.searchParams.get('id'), Number(url.searchParams.get('revision')))) : json({ error: '请求方法不支持' }, 405, { allow: 'GET' });
      const githubRoute = github && [`${path}/github`, `${path}/github/read`].includes(url.pathname);
      if (githubRoute && request.method === 'GET') return json(await github.read());
      const extensionRoute = extensions && [`${path}/extensions`, `${path}/extensions/read`].includes(url.pathname);
      if (extensionRoute && request.method === 'GET') return json(await extensions.read());
      const skillRoute = skills && [`${path}/skills`, `${path}/skills/read`].includes(url.pathname);
      if (skillRoute && request.method === 'GET') return json(await skills.read());
      const mcpRoute = mcp && [`${path}/mcp`, `${path}/mcp/read`].includes(url.pathname);
      if (mcpRoute && request.method === 'GET') return json(await mcp.read());
      if (url.pathname === `${path}/availability` && availability) return request.method === 'GET' ? json(await availability.read()) : json({ error: '请求方法不支持' }, 405, { allow: 'GET' });
      if (url.pathname === `${path}/translation/models` && translation) return request.method === 'GET' ? json(await translation.models()) : json({ error: '请求方法不支持' }, 405, { allow: 'GET' });
      const translationRoute = translation && url.pathname === `${path}/translation`;
      if (url.pathname === `${path}/documentation` && documentation) return request.method === 'GET' ? json(await documentation.read(url.searchParams.get('id'), Number(url.searchParams.get('revision')))) : json({ error: '请求方法不支持' }, 405, { allow: 'GET' });
      if ([`${path}/stars`, `${path}/npm-downloads`].includes(url.pathname)) {
        if (request.method !== 'GET') return json({ error: '请求方法不支持' }, 405, { allow: 'GET' });
        const ids = url.searchParams.get('ids')?.split(',') || [];
        if (ids.length > 60 || ids.some(id => !/^[a-z0-9-]{1,110}$/.test(id))) throw new CommunityError(400, '统计查询只能包含当前页面的资源编号');
        return json(await (url.pathname.endsWith('/stars') ? readStars : readNpm)([...new Set(ids)], request.signal));
      }
      const sourceRoute = sources && [`${path}/sources`, `${path}/sources/read`].includes(url.pathname);
      if (translationRoute && request.method !== 'POST') return json({ error: '请求方法不支持' }, 405, { allow: 'POST' });
      if (!sourceRoute && !translationRoute && !extensionRoute && !githubRoute && !skillRoute && !mcpRoute && ![path, `${path}/read`].includes(url.pathname)) return json({ error: '接口不存在' }, 404);
      if (request.method === 'GET') return json(sourceRoute ? sources.status() : service.snapshot({ summaries: true }));
      if (request.method !== 'POST') return json({ error: '请求方法不支持' }, 405, { allow: 'GET, POST' });
      if (request.headers.get('origin') !== url.origin || request.headers.get('x-community-request') !== '1') throw new CommunityError(403, '请从当前社区页面提交操作');
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new CommunityError(415, '请求必须使用 JSON 格式');
      const command = await body(request);
      if (githubRoute) return json(await github.run(command));
      if (skillRoute) return json(await skills.run(command));
      if (mcpRoute) {
        try { return json(await (command.action === 'prepare' ? mcp.prepare(command) : mcp.run(command))); }
        catch (error) {
          if (typeof error.code === 'string' && error.code.startsWith('MCP_')) return json({ error: translateMessage(localeOf(request.headers.get('x-market-language')), error.message), code: error.code }, 409);
          throw error;
        }
      }
      if (extensionRoute) return json(await (command.action === 'execute' ? extensions.execute(command) : extensions.prepare(command)));
      if (translationRoute) return json(await translation.run(command, request.signal));
      if (sourceRoute) {
        if (typeof command.sourceId !== 'string' || !sources.status().some(row => row.id === command.sourceId)) throw new CommunityError(400, '不支持的来源');
        if (command.action === 'setAutomatic') {
          if (typeof command.enabled !== 'boolean') throw new CommunityError(400, '自动更新设置必须为布尔值');
          sources.setAutomatic(command.sourceId, command.enabled);
          if (command.enabled) void sources.syncDue();
          return json(sources.status());
        }
        if (command.action !== undefined && command.action !== 'sync') throw new CommunityError(400, '不支持的来源操作');
        void sources.sync(command.sourceId).catch(() => {});
        return json(sources.status(), 202);
      }
      let preparedFile;
      if (command.format !== undefined) {
        if (command.action !== 'download' || command.format !== 'package' || !sources) throw new CommunityError(400, '不支持的下载格式');
        preparedFile = await sources.download(command.id, command.baseRevision);
      }
      return json(service.mutate(command, preparedFile));
    } catch (error) {
      return json({ error: translateMessage(localeOf(request.headers.get('x-market-language')), error instanceof CommunityError ? error.message : '市场服务暂时不可用，请重试') }, error instanceof CommunityError ? error.status : 500);
    }
  };
}
