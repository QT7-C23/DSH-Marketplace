import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionaries, translate, translateMessage, localeOf } from './index.mjs';

test('three languages have identical nonempty keys and substitution contracts', () => {
  const base = dictionaries['zh-CN'];
  const placeholders = value => [...value.matchAll(/(?<!\{)\{(\w+)\}(?!\})/g)].map(match => match[1]).sort();
  for (const dictionary of Object.values(dictionaries)) {
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(base).sort());
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(typeof value === 'string' && value.trim());
      assert.deepEqual(placeholders(value), placeholders(base[key]), key);
    }
  }
  assert.equal(translate('en-US', 'results', { count: 3 }), '3 resources');
  assert.equal(translate('ja-JP', 'settings'), '設定');
  assert.equal(translateMessage('en-US', '不支持的操作'), 'Unsupported operation.');
  assert.equal(localeOf('toString'), 'zh-CN');
  assert.equal(translate('en-US', 'variablesNote'), 'Use {{variable}} placeholders in prompts.');
});
