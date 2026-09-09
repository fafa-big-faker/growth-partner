const test = require('node:test');
const assert = require('node:assert/strict');
const { createOperationGuard } = require('../operation-guard');

test('a second call with the same key is skipped while the first is pending', async () => {
  const guard = createOperationGuard();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const first = guard.run('compose:10001', async () => pending);
  const second = await guard.run('compose:10001', async () => 'duplicate');

  assert.deepEqual(second, { started: false, value: false });
  release('done');
  assert.deepEqual(await first, { started: true, value: 'done' });
});

test('different operation keys can run independently', async () => {
  const guard = createOperationGuard();
  const results = await Promise.all([
    guard.run('mail:1', async () => 1),
    guard.run('mail:2', async () => 2),
  ]);

  assert.deepEqual(results.map(result => result.value), [1, 2]);
});

test('a failed task releases its key', async () => {
  const guard = createOperationGuard();

  await assert.rejects(() => guard.run('shop:1', async () => {
    throw new Error('offline');
  }));

  assert.equal(guard.isActive('shop:1'), false);
  assert.equal(guard.isBusy(), false);
  assert.deepEqual(
    await guard.run('shop:1', async () => true),
    { started: true, value: true },
  );
});

test('isBusy reports every active key until the final operation completes', async () => {
  const guard = createOperationGuard();
  const releases = [];
  assert.equal(guard.isBusy(), false);
  const first = guard.run('mail:fixture', () => new Promise(resolve => releases.push(resolve)));
  const second = guard.run('compose:fixture', () => new Promise(resolve => releases.push(resolve)));
  assert.equal(guard.isBusy(), true);
  releases[0](true);
  await first;
  assert.equal(guard.isBusy(), true);
  releases[1](true);
  await second;
  assert.equal(guard.isBusy(), false);
});
