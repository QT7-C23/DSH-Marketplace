import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSourceResources } from './merge.mjs';
test('commands resolve a deduplicated parent before their own identity is merged', () => {
  const native = { id: 'source-dsh-test', sourceId: 'dsh', type: '插件', packageRef: { name: 'test', version: '1.0.0' } };
  const mirror = { ...native, id: 'source-community-test', sourceId: 'community' };
  const command = { id: 'source-community-command', sourceId: 'community', type: 'Slash', title: '/demo', command: '/demo', parentId: mirror.id };
  const original = { ...command, id: 'source-native-command', sourceId: 'dsh', parentId: native.id };
  const merged = mergeSourceResources([native, mirror, command, original]);
  assert.equal(merged.length, 2);
  const slash = merged.find(item => item.type === 'Slash');
  assert.equal(slash.parentId, native.id);
  assert(slash.aliasIds.includes(command.id));
  assert(merged.some(item => item.id === slash.parentId));
});

test('cross-source duplicates prefer reviewed records without merging distinct Skills, commands or prompts', () => {
  const npm = { id: 'source-npm-one', sourceId: 'npm', type: '插件', packageRef: { name: 'dsh-example', version: '2.0.0' } };
  const community = { ...npm, id: 'source-community-one', sourceId: 'community', packageRef: { name: 'dsh-example', version: '1.9.0' } };
  const skill = { id: 'source-skill-one', sourceId: 'skills', type: 'Skill', bundle: { kind: 'github-skill', repository: 'anthropics/skills', root: 'skills/example' } };
  const anotherSkill = { ...skill, id: 'source-skill-two', sourceId: 'skills-openai', bundle: { ...skill.bundle, repository: 'openai/skills' } };
  const prompt = { id: 'github-one', sourceId: 'community', type: 'Prompt', url: 'https://github.com/author/prompts' };
  const result = mergeSourceResources([npm, skill, community, anotherSkill, prompt, { ...prompt, id: 'github-two' }]);
  assert.equal(result.length, 5);
  const winner = result.find(item => item.packageRef);
  assert.equal(winner.id, community.id);
  assert.deepEqual(winner.aliasIds, [npm.id]);
  assert.equal(npm.aliasIds, undefined, 'Caller-owned metadata must not be mutated');
  assert.deepEqual(mergeSourceResources([community, npm])[0], mergeSourceResources([npm, community])[0]);
});
