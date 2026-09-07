const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'player-data-cache.js');

test('cache returns fresh data and reloads after ttl or invalidation', async () => {
  const { createResourceCache } = require(modulePath);
  let now = 100;
  let loads = 0;
  const cache = createResourceCache({ ttlMs: 1000, now: () => now });

  assert.deepEqual(await cache.get(async () => [`load-${++loads}`]), ['load-1']);
  assert.deepEqual(cache.peek(), ['load-1']);
  assert.equal(cache.isFresh(), true);
  assert.deepEqual(await cache.get(async () => [`load-${++loads}`]), ['load-1']);
  assert.equal(loads, 1);

  now = 1200;
  assert.deepEqual(await cache.get(async () => [`load-${++loads}`]), ['load-2']);
  cache.invalidate();
  assert.equal(cache.isFresh(), false);
  assert.deepEqual(await cache.get(async () => [`load-${++loads}`]), ['load-3']);
});

test('cache coalesces concurrent refreshes including forced refreshes', async () => {
  const { createResourceCache } = require(modulePath);
  const cache = createResourceCache({ ttlMs: 1000 });
  let resolveLoad;
  let loads = 0;
  const loader = () => {
    loads += 1;
    return new Promise(resolve => { resolveLoad = resolve; });
  };

  const first = cache.get(loader, { force: true });
  const second = cache.get(loader, { force: true });
  assert.equal(first, second);
  assert.equal(loads, 0, 'loader starts in the next microtask');
  await Promise.resolve();
  assert.equal(loads, 1);
  resolveLoad(['shared']);
  assert.deepEqual(await first, ['shared']);
});

test('update replaces cached data and rejected loads preserve the last value', async () => {
  const { createResourceCache } = require(modulePath);
  const cache = createResourceCache({ ttlMs: 1000 });
  cache.set([{ id: 1 }]);
  cache.update(rows => [...rows, { id: 2 }]);
  assert.deepEqual(cache.peek(), [{ id: 1 }, { id: 2 }]);

  cache.invalidate();
  await assert.rejects(cache.get(async () => { throw new Error('offline'); }));
  assert.deepEqual(cache.peek(), [{ id: 1 }, { id: 2 }]);
  cache.clear();
  assert.equal(cache.peek(), null);
});
