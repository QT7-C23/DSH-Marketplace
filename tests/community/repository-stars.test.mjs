import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryOf, starSnapshot, sortResources } from '../../src/community/metrics.mjs';
import { RepositoryStars } from '../../src/community/repository-stars.mjs';
import { createHandler } from '../../src/community/http.mjs';

test('repository identity and metric contracts never confuse unknown, zero, stars and ratings', () => {
  assert.equal(repositoryOf('https://github.com/f/prompts.chat/blob/main/prompts.csv'), 'f/prompts.chat');
  for (const url of ['https://github.com.evil.test/a/b', 'https://user@github.com/a/b', 'http://github.com/a/b', 'not a URL']) assert.equal(repositoryOf(url), null);
  const value = { 'a/b': { count: 0, checkedAt: '2026-09-13T00:00:00.000Z', state: 'fresh' } };
  assert.deepEqual(starSnapshot(value), value);
  for (const count of [-1, '1', 1.5, null]) assert.throws(() => starSnapshot({ 'a/b': { ...value['a/b'], count } }));
  assert.throws(() => starSnapshot({ 'a/b': { count: null, checkedAt: '', state: 'stale' } }));
  const items = [{ id: 'unknown', url: '', title: 'A', updatedAt: '' }, { id: 'zero', url: 'https://github.com/a/b', title: 'B', updatedAt: '' }, { id: 'popular', url: 'https://github.com/c/d', title: 'C', updatedAt: '' }];
  const stars = { ...value, 'c/d': { ...value['a/b'], count: 42 } };
  assert.deepEqual(sortResources(items, 'stars', {}, stars).map(item => item.id), ['popular', 'zero', 'unknown']);
  assert.deepEqual(sortResources(items, 'saves', { zero: { saves: 0 }, popular: { saves: 5 } }, {}).map(item => item.id), ['popular', 'zero', 'unknown']);
  assert.equal(items[0].id, 'unknown', 'Sorting cannot mutate caller-owned lists');
});

test('GitHub stars use one anonymous request per repository, cache successes and retain dated stale values', async () => {
  let now = 1000000000000;
  let calls = 0;
  let fail = false;
  const stars = new RepositoryStars({ now: () => now, request: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.github.com/repos/a/b');
    assert.equal(options.headers.authorization, undefined);
    if (fail) return new Response('{}', { status: 429, headers: { 'retry-after': '3600' } });
    return Response.json({ stargazers_count: 123, subscribers_count: 99 });
  } });
  const resources = [{ url: 'https://github.com/a/b/tree/main/one' }, { url: 'https://github.com/a/b/tree/main/two' }];
  const [first, second] = await Promise.all([stars.read(resources), stars.read(resources)]);
  assert.equal(calls, 1);
  assert.equal(first['a/b'].count, 123);
  assert.deepEqual(first, second);
  await stars.read(resources);
  assert.equal(calls, 1);
  now += 31 * 60 * 1000;
  fail = true;
  const stale = (await stars.read(resources))['a/b'];
  assert.equal(stale.state, 'stale');
  assert.equal(stale.count, 123);
  assert.equal(stale.checkedAt, first['a/b'].checkedAt);
  now += 10 * 60 * 1000;
  await stars.read(resources);
  assert.equal(calls, 2, 'Respect upstream rate-limit retry delay');
  const unavailable = new RepositoryStars({ request: async () => Response.json({ stargazers_count: '123' }) });
  assert.deepEqual((await unavailable.read(resources))['a/b'], { count: null, checkedAt: '', state: 'unavailable' });
});

test('star read route exposes only public metrics and rejects writes', async () => {
  const expected = { 'a/b': { count: 12, checkedAt: '2026-09-13T00:00:00.000Z', state: 'fresh' } };
  const handle = createHandler({}, async () => expected);
  assert.deepEqual(await (await handle(new Request('http://localhost/api/community/stars'))).json(), expected);
  assert.equal((await handle(new Request('http://localhost/api/community/stars', { method: 'POST' }))).status, 405);
});
