import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { SkillResources } from './plugin/resources/skills.mjs';
import { createHandler } from '../community/http.mjs';

const resource = { id: 'source-skill-example', revision: 2, type: 'Skill', bundle: { kind: 'github-skill' } };
const row = { id: resource.id, revision: 2, name: 'example', version: '1', state: 'installed' };
const home = path.resolve('artifacts/skill-boundary-test');
test('Skill actions resolve the reviewed current version and distinguish disk installation from native loading', async () => {
  let installed, definition;
  const files = { read: async () => [row], install: async value => { installed = value; return row; } };
  const skills = new SkillResources({ catalog: () => [resource], files, home, registry: () => ({ get: async () => definition }) });
  await assert.rejects(skills.run({ action: 'install', id: resource.id, revision: 1 }), /版本/);
  assert.equal(installed, undefined);
  assert.equal((await skills.run({ action: 'install', id: resource.id, revision: 2 })).state, 'installed');
  assert.equal(installed, resource);
  definition = { content: 'Original instructions', resourceBase: { kind: 'directory', path: path.join(home, 'skills/example') } };
  assert.equal((await skills.read())[0].state, 'loaded');
  definition.resourceBase.path = path.join(home, 'other/example');
  assert.equal((await skills.read())[0].state, 'shadowed');
  files.read = async () => [{ ...row, state: 'modified' }];
  assert.equal((await skills.read())[0].state, 'modified');
  assert(!JSON.stringify(await skills.read()).includes(home));
});
test('Skill HTTP mutations enforce same-origin JSON and do not trust resource bodies supplied by callers', async () => {
  const calls = [];
  const skills = { read: async () => [row], run: async command => { calls.push(command); return row; } };
  const handle = createHandler({}, undefined, null, null, null, null, null, null, skills);
  const url = 'http://127.0.0.1:4173/api/community/skills';
  const call = headers => handle(new Request(url, { method: 'POST', headers, body: JSON.stringify({ action: 'install', id: resource.id, revision: 2 }) }));
  assert.equal((await call({ 'content-type': 'application/json' })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await call({ 'content-type': 'application/json', origin: 'http://127.0.0.1:4173', 'x-community-request': '1' })).status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(await (await handle(new Request(url + '/read'))).json(), [row]);
});

test('installed Skill management survives catalog withdrawal and rejects caller supplied definitions', async () => {
  const calls = [];
  const files = { read: async () => [row], ...Object.fromEntries(['disable', 'enable', 'remove', 'restore'].map(action => [action, async (...args) => { calls.push([action, ...args]); return row; }])) };
  const skills = new SkillResources({ catalog: () => [], files, home, registry: () => null });
  for (const action of ['disable', 'enable', 'remove', 'restore']) await skills.run({ action, id: row.id, revision: row.revision });
  assert.deepEqual(calls.map(call => call[0]), ['disable', 'enable', 'remove', 'restore']);
  assert.deepEqual(calls[0], ['disable', row.id, row.revision]);
  await assert.rejects(skills.run({ action: 'disable', id: row.id, revision: 2, bundle: {} }), /不支持/);
});

test('Skill updates resolve the current source revision, never the caller body', async () => {
  let received;
  const files = { read: async () => [row], update: async value => { received = value; return row; } };
  const skills = new SkillResources({ catalog: () => [resource], files, home, registry: () => null });
  await assert.rejects(skills.run({ action: 'update', id: row.id, revision: 1 }), /版本/);
  assert.equal(received, undefined);
  await skills.run({ action: 'update', id: row.id, revision: 2 });
  assert.equal(received, resource);
});
