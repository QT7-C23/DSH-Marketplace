import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
const tracked = new Set(files);

test('public repository keeps implementation, tests and tooling in their declared locations', () => {
  const allowed = new Set(['.github', 'src', 'catalog', 'tests', 'scripts', 'assets', 'licenses']);
  for (const file of files) {
    if (file.includes('/')) assert(allowed.has(file.split('/')[0]), 'Unexpected public directory: ' + file);
    if (file.endsWith('.test.mjs')) assert(file.startsWith('tests/'), 'Tests belong in tests/: ' + file);
    if (file.includes('/fixtures/')) assert(file.startsWith('tests/fixtures/'), 'Fixtures belong in tests/fixtures/: ' + file);
  }
  for (const file of ['README.md', 'README.zh-CN.md', 'README.ja-JP.md', 'LICENSE', 'package.json', 'package-lock.json']) assert(tracked.has(file), 'Missing public entry: ' + file);
});

test('public Markdown links resolve to tracked public files rather than ignored local notes', async () => {
  for (const file of files.filter(file => file.endsWith('.md'))) {
    const body = await readFile(file, 'utf8');
    for (const [, href] of body.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(href.split('#')[0])));
      assert(tracked.has(target) || files.some(file => file.startsWith(target.replace(/\/$/, '') + '/')), `${file} links to non-public ${target}`);
    }
  }
});
