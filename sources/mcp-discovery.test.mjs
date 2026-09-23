import test from 'node:test';
import assert from 'node:assert/strict';
import { readMcpDirectory } from './mcp.mjs';
import { MCP_SERVERS } from './definitions.mjs';
import { sourceResource, sourceDiscovery } from './contracts.mjs';

const endpoint = 'https://registry.modelcontextprotocol.io/v0.1/servers';
const official = 'io.modelcontextprotocol.registry/official';
function server(name = 'io.github.new-publisher/search', fields = {}, meta = {}) {
  return {
    server: { name, version: '1.0.0', description: 'Search original documents.', remotes: [{ type: 'streamable-http', url: 'https://service.example/mcp' }], ...fields },
    _meta: { [official]: { status: 'active', isLatest: true, ...meta } },
  };
}
const page = (servers, nextCursor) => ({ servers, metadata: { count: servers.length, ...(nextCursor === undefined ? {} : { nextCursor }) } });
function reader(pages) {
  const calls = [];
  return { calls, read: async url => {
    calls.push(url);
    const next = pages[calls.length - 1];
    assert.notEqual(next, undefined, 'Discovery requested an unexpected page or a service endpoint');
    if (next instanceof Error) throw next;
    return structuredClone(next);
  } };
}
function balanced(result, scanned, pages) {
  assert.equal(result.discovery.scanned, scanned);
  assert.equal(result.entries.length + result.discovery.excluded.length, scanned);
  assert.equal(result.discovery.pages, pages);
  assert.equal(result.discovery.complete, true);
  assert.match(result.discovery.revision, /^sha256:[a-f0-9]{64}$/);
  for (const item of result.entries) assert.equal(sourceResource(item), item);
  assert.equal(sourceDiscovery(result), result);
}

test('MCP pagination discovers new publishers and preserves known translations and legacy IDs', async () => {
  const [name, title, summary] = MCP_SERVERS[0];
  const cursor = `${name}:1.0.0+build &?=#/汉字`;
  const newRow = server(undefined, { title: 'New publisher search', repository: { url: 'https://github.com/new-publisher/search', source: 'github' } });
  const input = reader([page([server(name)], cursor), page([newRow], null)]);
  const result = await readMcpDirectory(input.read);
  balanced(result, 2, 2);
  const known = result.entries.find(item => item.serverDefinition.name === name);
  assert.equal(known.id, `source-mcp-${name.split('/').at(-1)}`);
  assert.equal(known.title, title);
  assert.equal(known.summary, summary);
  const discovered = result.entries.find(item => item.serverDefinition.name === newRow.server.name);
  assert.equal(discovered.title, 'New publisher search');
  assert.equal(discovered.summary, newRow.server.description);
  assert.equal(discovered.url, newRow.server.repository.url);
  assert.equal(discovered.author, 'io.github.new-publisher');
  assert.equal(discovered.sourceId, 'mcp');
  assert.deepEqual(input.calls, [`${endpoint}?limit=100&version=latest`, `${endpoint}?${new URLSearchParams({ limit: '100', version: 'latest', cursor })}`]);
});

test('repository-free definitions use a version-pinned URL and retain configuration strictly as data', async () => {
  const row = server('com.example/package', {
    version: '2.0.0+build/one',
    remotes: [],
    packages: [{ registryType: 'npm', identifier: '@example/package', version: '2.0.0', transport: { type: 'stdio' }, runtimeHint: 'npx', packageArguments: [{ type: 'positional', value: '$(do-not-execute)' }], environmentVariables: [{ name: 'TOKEN', isSecret: true }] }],
    _meta: { 'com.example/extension': { instructions: 'Never run this configuration during discovery.' } },
  });
  const before = structuredClone(row);
  const result = await readMcpDirectory(async url => {
    assert.equal(url, `${endpoint}?limit=100&version=latest`);
    return page([row]);
  });
  balanced(result, 1, 1);
  const item = result.entries[0];
  assert.equal(item.title, row.server.name);
  assert.equal(item.registryUrl, `${endpoint}/${encodeURIComponent(row.server.name)}/versions/${encodeURIComponent(row.server.version)}`);
  assert.equal(item.url, item.registryUrl);
  assert.deepEqual(item.serverDefinition, row.server);
  assert.deepEqual(JSON.parse(item.body.slice(item.body.indexOf('\n\n') + 2)), row.server);
  assert.deepEqual(row, before);
  assert.equal(item.license, undefined, 'Discovery must not invent or verify a license');
  assert.match(item.requirements, /stdio/);
  assert.match(item.requirements, /配置.*身份/);
});

test('full namespaces and case survive suffix collisions and IDs stay stable across versions and page order', async () => {
  const names = ['com.alpha/search', 'com.beta/search', 'com.alpha/Search', 'com.unrelated/context7', ...MCP_SERVERS.map(([name]) => name)];
  const first = await readMcpDirectory(reader([page(names.map(name => server(name)))]).read);
  const second = await readMcpDirectory(reader([page(names.toReversed().map(name => server(name, { version: '2.0.0' })))]).read);
  assert.equal(new Set(first.entries.map(item => item.id)).size, names.length);
  for (const item of first.entries) {
    assert.match(item.id, /^source-[a-z0-9-]{1,100}$/);
    assert.equal(second.entries.find(other => other.serverDefinition.name === item.serverDefinition.name).id, item.id);
  }
  for (const [name] of MCP_SERVERS) assert.equal(first.entries.find(item => item.serverDefinition.name === name).id, `source-mcp-${name.split('/').at(-1)}`);
});

test('identical definitions deduplicate across pages regardless of object key order or registry timestamps', async () => {
  const row = server();
  const reordered = { server: Object.fromEntries(Object.entries(row.server).reverse()), _meta: { [official]: { isLatest: true, status: 'active', updatedAt: '2030-01-01T00:00:00Z' } } };
  const result = await readMcpDirectory(reader([page([row], 'next'), page([reordered])]).read);
  balanced(result, 1, 2);
  const single = await readMcpDirectory(reader([page([row])]).read);
  assert.equal(result.discovery.revision, single.discovery.revision);
  const changed = await readMcpDirectory(reader([page([server(undefined, { description: 'Changed upstream definition.' })])]).read);
  assert.notEqual(changed.discovery.revision, single.discovery.revision);
});

test('conflicting definitions, versions or eligibility for the same name abort the whole scan', async () => {
  for (const conflict of [server(undefined, { description: 'Different bytes.' }), server(undefined, { version: '2.0.0' }), server(undefined, {}, { status: 'deprecated' }), server(undefined, {}, { isLatest: false })]) {
    await assert.rejects(readMcpDirectory(reader([page([server()], 'next'), page([conflict])]).read), /冲突/);
  }
});

test('mutable aliases and URL dot segments cannot be published as pinned registry versions', async () => {
  const rows = ['latest', '.', '..'].map((version, index) => server(`com.example/unpinned-${index}`, { version }));
  const result = await readMcpDirectory(reader([page(rows)]).read);
  balanced(result, rows.length, 1);
  assert.deepEqual(result.entries, []);
  assert(result.discovery.excluded.every(item => /固定版本/.test(item.reason)));
});

test('obsolete and unsupported records have specific reasons and duplicate exclusions count once', async () => {
  const rows = [
    server('com.example/active'),
    server('com.example/deprecated', {}, { status: 'deprecated' }),
    server('com.example/deleted', {}, { status: 'deleted' }),
    server('com.example/old', {}, { isLatest: false }),
    server('com.example/sse', { remotes: [{ type: 'sse', url: 'https://service.example/sse' }] }),
    server('com.example/empty', { remotes: [] }),
    server('com.example/remote-stdio', { remotes: [{ type: 'stdio' }] }),
  ];
  const result = await readMcpDirectory(reader([page([...rows, rows[4]])]).read);
  balanced(result, rows.length, 1);
  assert.deepEqual(result.entries.map(item => item.serverDefinition.name), ['com.example/active']);
  const reasons = new Map(result.discovery.excluded.map(item => [item.name, item.reason]));
  assert.match(reasons.get('com.example/deprecated'), /deprecated/);
  assert.match(reasons.get('com.example/deleted'), /deleted/);
  assert.match(reasons.get('com.example/old'), /最新/);
  for (const name of ['sse', 'empty', 'remote-stdio']) assert.match(reasons.get(`com.example/${name}`), /传输/);
});

test('supported package HTTP and mixed transport definitions remain complete without contacting them', async () => {
  const rows = [server('com.example/mixed', { remotes: [{ type: 'sse', url: 'https://service.example/sse' }, { type: 'streamable-http', url: 'https://{tenant}.example/mcp', variables: { tenant: { isRequired: true } } }] }), server('com.example/local-http', { remotes: [], packages: [{ registryType: 'npm', identifier: 'local-http', transport: { type: 'streamable-http', url: 'http://localhost:3000/mcp' } }] })];
  const input = reader([page(rows)]);
  const result = await readMcpDirectory(input.read);
  balanced(result, 2, 1);
  for (const row of rows) assert.deepEqual(result.entries.find(item => item.serverDefinition.name === row.server.name).serverDefinition, row.server);
  assert.equal(input.calls.length, 1);
});

test('MCP-01 remote leading-variable HTTP templates remain unresolved with or without defaults', async () => {
  const rows = [
    server('com.example/template-default', { remotes: [{ type: 'streamable-http', url: '{baseUrl}/mcp', variables: { baseUrl: { default: 'https://service.example', isRequired: true } } }] }),
    server('com.example/template-required', { remotes: [{ type: 'streamable-http', url: '{baseUrl}/mcp/{tenant}', variables: { baseUrl: { isRequired: true }, tenant: { isRequired: true } } }] }),
    server('com.example/template-endpoint', { remotes: [{ type: 'streamable-http', url: '{_endpoint2}', variables: { _endpoint2: { isRequired: true } } }] }),
  ];
  const before = structuredClone(rows);
  const calls = [];
  const result = await readMcpDirectory(async url => { calls.push(url); return page(rows); });
  balanced(result, rows.length, 1);
  assert.equal(result.entries.length, rows.length);
  assert.deepEqual(result.discovery.excluded, []);
  for (const row of rows) {
    const item = result.entries.find(item => item.serverDefinition.name === row.server.name);
    assert.deepEqual(item.serverDefinition, row.server);
    assert.deepEqual(JSON.parse(item.body.slice(item.body.indexOf('\n\n') + 2)), row.server);
  }
  assert.deepEqual(rows, before);
  assert.deepEqual(calls, [`${endpoint}?limit=100&version=latest`]);
});

test('MCP-01 package HTTP templates retain environment and argument references as configuration', async () => {
  const packages = [
    { registryType: 'npm', identifier: 'example', transport: { type: 'streamable-http', url: '{BASE_URL}/mcp' }, environmentVariables: [{ name: 'BASE_URL', default: 'http://localhost:3000' }] },
    { registryType: 'npm', identifier: 'example', transport: { type: 'streamable-http', url: '{baseUrl}/mcp' }, runtimeArguments: [{ type: 'positional', valueHint: 'baseUrl', isRequired: true }] },
    { registryType: 'npm', identifier: 'example', transport: { type: 'streamable-http', url: '{base_url}/mcp' }, packageArguments: [{ type: 'named', name: 'base_url', isRequired: true }] },
  ];
  const rows = packages.map((value, index) => server(`com.example/template-package-${index}`, { remotes: [], packages: [value] }));
  const input = reader([page(rows)]);
  const result = await readMcpDirectory(input.read);
  balanced(result, rows.length, 1);
  assert.equal(result.entries.length, rows.length);
  assert.deepEqual(result.discovery.excluded, []);
  for (const row of rows) assert.deepEqual(result.entries.find(item => item.serverDefinition.name === row.server.name).serverDefinition, row.server);
  assert.deepEqual(input.calls, [`${endpoint}?limit=100&version=latest`]);
});

test('MCP-01 stdio remains discoverable alongside an unresolved SSE base-URL template', async () => {
  const row = server('com.example/stdio-sse-template', {
    packages: [{ registryType: 'npm', identifier: 'example', transport: { type: 'stdio' } }],
    remotes: [{ type: 'sse', url: '{baseUrl}/sse', variables: { baseUrl: { default: 'https://service.example' } } }],
  });
  const input = reader([page([row])]);
  const result = await readMcpDirectory(input.read);
  balanced(result, 1, 1);
  assert.equal(result.entries.length, 1);
  assert.deepEqual(result.discovery.excluded, []);
  assert.deepEqual(result.entries[0].serverDefinition, row.server);
  assert.match(result.entries[0].requirements, /stdio/);
  assert.deepEqual(input.calls, [`${endpoint}?limit=100&version=latest`]);
});

test('MCP-01 retains named package arguments and remote keys inside HTTP templates', async () => {
  const rows = [
    server('com.example/template-named-port', { remotes: [], packages: [{ registryType: 'npm', identifier: 'example', transport: { type: 'streamable-http', url: 'http://localhost:{--port}/mcp' }, packageArguments: [{ type: 'named', name: '--port', default: '3000' }] }] }),
    server('com.example/template-remote-key', { remotes: [{ type: 'streamable-http', url: 'https://{baseUrl}/mcp/{server-name}', variables: { baseUrl: { isRequired: true }, 'server-name': { isRequired: true } } }] }),
    server('com.example/template-leading-key', { remotes: [{ type: 'streamable-http', url: '{baseUrl}/mcp/{server-name}', variables: { baseUrl: { isRequired: true }, 'server-name': { isRequired: true } } }] }),
  ];
  const input = reader([page(rows)]);
  const result = await readMcpDirectory(input.read);
  balanced(result, rows.length, 1);
  assert.equal(result.entries.length, rows.length);
  assert.deepEqual(result.discovery.excluded, []);
  for (const row of rows) assert.deepEqual(result.entries.find(item => item.serverDefinition.name === row.server.name).serverDefinition, row.server);
  assert.deepEqual(input.calls, [`${endpoint}?limit=100&version=latest`]);
});

test('MCP-01 malformed templates remain excluded with specific transport reasons', async () => {
  const urls = ['{}/mcp', '{{baseUrl}}/mcp', '{9baseUrl}/mcp', '{base-url}/mcp', '{baseUrl/mcp', '{baseUrl}}/mcp', '{baseUrl}/mcp/{tenant', '{baseUrl}/m cp', '{baseUrl}/mcp\n', '{baseUrl}/mcp\\bad', 'https://service.example/mcp/{}', 'https://service.example/mcp/{bad variable}', 'https://service.example/mcp/{tenant'];
  const rows = urls.map((url, index) => server(`com.example/bad-template-${index}`, { remotes: [{ type: 'streamable-http', url }] }));
  const input = reader([page(rows)]);
  const result = await readMcpDirectory(input.read);
  balanced(result, rows.length, 1);
  assert.equal(result.entries.length, 0);
  assert(result.discovery.excluded.every(item => /HTTP 传输地址/.test(item.reason)));
  assert.deepEqual(input.calls, [`${endpoint}?limit=100&version=latest`]);
});

test('MCP-01 template support cannot turn malformed literal addresses into valid HTTP endpoints', async () => {
  const urls = ['not-a-url', '/mcp', '//service.example/mcp', 'ftp://service.example/mcp', 'javascript:alert(1)', 'https://', 'https:///mcp', 'https:service.example/mcp', 'https://?query', 'https://service.example:bad/mcp', 'https://service.example/m cp', 'https://service.example/mcp\n', 'https://service.example\\mcp', 'https://[invalid]/mcp'];
  const rows = urls.map((url, index) => server(`com.example/bad-literal-${index}`, { remotes: [{ type: 'streamable-http', url }] }));
  const input = reader([page(rows)]);
  const result = await readMcpDirectory(input.read);
  balanced(result, rows.length, 1);
  assert.equal(result.entries.length, 0);
  assert(result.discovery.excluded.every(item => /HTTP 传输地址/.test(item.reason)));
  assert.deepEqual(input.calls, [`${endpoint}?limit=100&version=latest`]);
});

test('publication limits exclude oversized records instead of truncating definitions or failing valid siblings', async () => {
  const rows = [
    server('com.example/valid', { title: 't'.repeat(80), description: 's'.repeat(300), version: 'v'.repeat(40) }),
    server('com.example/title', { title: 't'.repeat(81) }),
    server('com.example/summary', { description: 's'.repeat(301) }),
    server('com.example/version', { version: 'v'.repeat(41) }),
    server('com.example/body', { _meta: { 'com.example/extra': 'b'.repeat(50001) } }),
    server(`com.example/${'n'.repeat(301)}`),
  ];
  const result = await readMcpDirectory(reader([page(rows)]).read);
  balanced(result, 6, 1);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].body.includes('s'.repeat(300)), true);
  const reasons = new Map(result.discovery.excluded.map(item => [item.name, item.reason]));
  assert.match(reasons.get('com.example/title'), /80/);
  assert.match(reasons.get('com.example/summary'), /300/);
  assert.match(reasons.get('com.example/version'), /40/);
  assert.match(reasons.get('com.example/body'), /50000/);
  assert(result.discovery.excluded.every(item => item.name.length <= 300 && item.reason.length <= 500));
});

test('unsupported record fields are excluded without concealing invalid definitions behind translations', async () => {
  const rows = [
    server('com.example/no-description', { description: '' }),
    server('com.example/bad-title', { title: 12 }),
    server('com.example/bad-packages', { packages: {} }),
    server('com.example/bad-remotes', { remotes: [null] }),
    server('com.example/missing-transport', { remotes: [], packages: [{ registryType: 'npm', identifier: 'example' }] }),
    server('com.example/no-url', { remotes: [{ type: 'streamable-http' }] }),
    server('com.example/bad-repository', { repository: { url: 'http://github.com/example/server' } }),
    server(MCP_SERVERS[0][0], { description: 42 }),
  ];
  const result = await readMcpDirectory(reader([page(rows)]).read);
  balanced(result, rows.length, 1);
  assert.deepEqual(result.entries, []);
  assert(result.discovery.excluded.every(item => item.reason.trim().length > 0));
});

test('repeated cursors and cycles fail before another request can repeat a page', async () => {
  for (const pages of [[page([server()], 'same'), page([server()], 'same')], [page([server()], 'a'), page([server()], 'b'), page([server()], 'a')]]) {
    const input = reader(pages);
    await assert.rejects(readMcpDirectory(input.read), /游标.*重复|重复.*游标/);
    assert.equal(input.calls.length, pages.length);
  }
});

test('mid-scan network and JSON protocol failures reject rather than returning a partial catalog', async () => {
  for (const error of [new Error('upstream offline'), new SyntaxError('invalid JSON'), Object.assign(new Error('HTTP 503'), { status: 503 })]) {
    const input = reader([page([server()], 'next'), error]);
    await assert.rejects(readMcpDirectory(input.read), failure => failure === error);
    assert.equal(input.calls.length, 2);
  }
});

test('malformed pages and missing protocol identity fail even after a valid page', async () => {
  const malformed = [null, [], {}, { servers: [] }, { servers: {}, metadata: { count: 0 } }, { servers: [], metadata: [] }, { servers: [], metadata: { count: '0' } }, { servers: [], metadata: { count: 1 } }, { servers: [], metadata: { count: 0, nextCursor: 12 } }, page([null]), page([{}]), page([{ server: {} }]), page([server(undefined, { name: null })]), page([server(undefined, { version: null })]), page([{ ...server(), _meta: {} }]), page([server(undefined, {}, { isLatest: 'true' })]), page([server(undefined, {}, { status: null })]), page(Array.from({ length: 101 }, () => server()))];
  for (const invalid of malformed) await assert.rejects(readMcpDirectory(reader([page([server()], 'next'), invalid]).read), /页面|注册.*格式|协议/);
});

test('empty terminal pages complete successfully with omitted, null or empty cursors', async () => {
  for (const cursor of [undefined, null, '']) {
    const result = await readMcpDirectory(reader([page([], cursor)]).read);
    balanced(result, 0, 1);
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.discovery.excluded, []);
  }
});

test('the 1000-page bound fails explicitly if another page remains and accepts an exhausted boundary', async () => {
  let calls = 0;
  await assert.rejects(readMcpDirectory(async () => page([server()], `cursor-${++calls}`)), /1000.*上限|上限.*1000/);
  assert.equal(calls, 1000);
  calls = 0;
  const result = await readMcpDirectory(async () => page([server()], ++calls === 1000 ? undefined : `cursor-${calls}`));
  balanced(result, 1, 1000);
});
