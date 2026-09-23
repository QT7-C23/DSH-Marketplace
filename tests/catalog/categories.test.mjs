import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryOf, CATEGORIES } from '../../catalog/categories.mjs';
import sources from '../../catalog/source-seed.json' with { type: 'json' };
import { githubPrompts } from '../../catalog/resources.mjs';
test('all catalog entries have one usable category; unknown discoveries remain discoverable', () => {
  for (const item of [...sources.flatMap(row => row.entries), ...githubPrompts]) assert(CATEGORIES.includes(categoryOf(item)));
  assert.equal(categoryOf({ id: 'source-skill-theme-factory', type: 'Skill' }), 'design');
  assert.equal(categoryOf({ id: 'new-skill', type: 'Skill', body: 'pretend this is a plugin' }), 'general');
  assert.equal(categoryOf({ id: 'github-code-reviewer', type: 'Prompt' }), 'coding');
  assert.equal(categoryOf({ id: 'new-theme', type: '主题' }), 'design');
});
