import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { discover } from './discovery.mjs';

const root = fileURLToPath(new URL('../prototype/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
export function createServer({ discovery = discover } = {}) {
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('Cache-Control', 'no-store');
    const reply = (status, body, type = 'application/json; charset=utf-8') => { response.writeHead(status, { 'Content-Type': type }); response.end(body); };
    if (!['GET', 'HEAD'].includes(request.method)) return reply(405, JSON.stringify({ error: '原型服务器不接受发布或安装请求' }));
    let url;
    try { url = new URL(request.url, 'http://127.0.0.1'); } catch { return reply(400, '{}'); }
    if (url.pathname === '/api/discovery') {
      try { return reply(200, JSON.stringify(await discovery())); }
      catch (error) { return reply(502, JSON.stringify({ error: error.message || '来源连接失败' })); }
    }
    let filename;
    try { filename = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); } catch { return reply(400, '{}'); }
    const resolved = path.resolve(root, '.' + filename);
    if (!resolved.startsWith(root) || filename.includes('\\') || !mime[path.extname(resolved)]) return reply(404, '{}');
    try { const data = await readFile(resolved); return reply(200, request.method === 'HEAD' ? '' : data, mime[path.extname(resolved)]); }
    catch { return reply(404, JSON.stringify({ error: '页面不存在' })); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.listen(Number(process.env.DSH_PORT || 4173), '127.0.0.1', () => console.log(`DSH 原型：http://127.0.0.1:${server.address().port}`));
}
