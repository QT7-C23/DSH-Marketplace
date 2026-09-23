import test from 'node:test';
import assert from 'node:assert/strict';
import { registryEntries } from '../sources/community.mjs';
import { SourceManager } from '../sources/manager.mjs';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Community } from '../community/service.mjs';
import { createHandler } from '../community/http.mjs';
import { mcpChoices } from '../integration/plugin/resources/mcp-config.mjs';
import seed from '../sources/catalog.json' with { type: 'json' };

const base = { schema: 1, id: 'example', title: 'Reviewed resource', summary: 'Reviewed community contribution', body: 'Use the original instructions.', url: 'https://github.com/author/resources', version: '1.0.0', author: 'author', license: 'MIT', language: 'en' };
const original = seed.find(row => row.id === 'skills').entries[0];
const bundle = { ...original.bundle, repository: 'author/resources' };
const mcp = { name: 'io.github.author/docs', version: '1.0.0', remotes: [{ type: 'streamable-http', url: 'https://docs.example.org/mcp' }] };
const proposals = [
  { ...base, id: 'plugin', type: '插件', packageRef: { name: 'dsh-reviewed-plugin', version: '1.0.0' } },
  { ...base, id: 'theme', type: '主题', packageRef: { name: 'dsh-reviewed-theme', version: '1.0.0' } },
  { ...base, id: 'skill', type: 'Skill', bundle },
  { ...base, id: 'mcp', type: 'MCP', serverDefinition: mcp },
  { ...base, id: 'slash', type: 'Slash', parentId: 'source-community-plugin', command: '/review' },
  { ...base, id: 'prompt', type: 'Prompt' },
];

test('all six reviewed types retain usable bindings through discovery and the real HTTP resource boundary', async () => {
  const result = registryEntries({ schema: 1, entries: proposals, removals: [] });
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dsh-review-six-'));
  const manager = new SourceManager(path.join(folder, 'sources'), { adapters: { community: async () => ({ entries: result.entries, removals: result.removals }) } });
  await manager.sync('community');
  const service = new Community(path.join(folder, 'community.sqlite'), manager.resources());
  try {
    const http = createHandler(service);
    for (const resource of result.entries) {
      const current = manager.resources().find(row => row.id === resource.id);
      const response = await http(new Request(`http://localhost/api/community/resource?id=${current.id}&revision=${current.revision}`));
      assert.equal(response.status, 200);
      const fetched = await response.json();
      for (const key of ['type', 'body', 'packageRef', 'bundle', 'serverDefinition', 'parentId', 'command']) assert.deepEqual(fetched[key], current[key]);
    }
    const choices = mcpChoices(result.entries.find(row => row.type === 'MCP'));
    assert.equal(choices.choices[0].transport, 'streamable-http');
    assert.equal(choices.choices[0].supported, true);
  } finally { service.close(); }
});

test('unreviewed or mismatched execution metadata and nonexistent Slash parents cannot enter the published index', () => {
  const invalid = [
    { ...proposals[0], packageRef: undefined }, { ...proposals[1], packageRef: undefined },
    { ...proposals[0], packageRef: { name: 'dsh-reviewed-plugin', version: 'latest' } },
    { ...proposals[0], bundle: seed.find(row => row.id === 'dsh').entries.find(row => row.bundle?.kind === 'npm-package').bundle },
    { ...proposals[1], packageRef: { name: 'dsh-reviewed-theme', version: '2.0.0' } },
    { ...proposals[2], bundle: undefined }, { ...proposals[2], bundle: { ...bundle, root: '../escape' } },
    { ...proposals[3], serverDefinition: { ...mcp, version: '2.0.0' } },
    { ...proposals[3], serverDefinition: { ...mcp, remotes: [] } },
    { ...proposals[4], parentId: 'source-community-missing' },
    { ...proposals[4], parentId: 'source-community-mcp' },
  ];
  for (const value of invalid) assert.throws(() => registryEntries({ schema: 1, entries: proposals.map(row => row.id === value.id ? value : row), removals: [] }), value.id);
});
