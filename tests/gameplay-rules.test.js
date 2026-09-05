const test = require('node:test');
const assert = require('node:assert/strict');

const { isBonusChop, rollPackItem } = require('../gameplay-rules');

test('bonus chop cadence follows every persisted ten chops', () => {
  assert.equal(isBonusChop(0), false);
  assert.equal(isBonusChop(9), false);
  assert.equal(isBonusChop(10), true);
  assert.equal(isBonusChop(11), false);
  assert.equal(isBonusChop(20), true);
});

test('pack rolls select only members of the configured reward pack', () => {
  const pack = { packId: 1003, qualityId: 3, items: [10202, 10301, 20101] };

  assert.deepEqual(rollPackItem(pack, 0), { itemId: '10202', quality: 3 });
  assert.deepEqual(rollPackItem(pack, 0.5), { itemId: '10301', quality: 3 });
  assert.deepEqual(rollPackItem(pack, 0.999), { itemId: '20101', quality: 3 });
});

test('invalid packs do not produce a reward', () => {
  assert.equal(rollPackItem(null, 0), null);
  assert.equal(rollPackItem({ items: [] }, 0), null);
});
