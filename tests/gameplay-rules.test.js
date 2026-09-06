const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { isBonusChop, rollPackItem } = require('../gameplay-rules');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('bonus chop cadence follows every persisted ten chops', () => {
  assert.equal(isBonusChop(0), false);
  assert.equal(isBonusChop(9), false);
  assert.equal(isBonusChop(10), true);
  assert.equal(isBonusChop(11), false);
  assert.equal(isBonusChop(20), true);
});

test('pack rolls select the configured item and its matching quantity', () => {
  const pack = {
    packId: 1003,
    qualityId: 3,
    rewards: [
      { itemId: '10202', quantity: 1 },
      { itemId: '10301', quantity: 4 },
      { itemId: '20101', quantity: 2 },
    ],
  };

  assert.deepEqual(rollPackItem(pack, 0), { itemId: '10202', quantity: 1, quality: 3 });
  assert.deepEqual(rollPackItem(pack, 0.5), { itemId: '10301', quantity: 4, quality: 3 });
  assert.deepEqual(rollPackItem(pack, 0.999), { itemId: '20101', quantity: 2, quality: 3 });
});

test('legacy item lists remain valid and default invalid quantities to one', () => {
  const pack = {
    packId: 1001,
    qualityId: 1,
    items: [10001, 10101, 0],
    quantities: [3, 0, 'bad'],
  };

  assert.deepEqual(rollPackItem(pack, 0), { itemId: '10001', quantity: 3, quality: 1 });
  assert.deepEqual(rollPackItem(pack, 0.5), { itemId: '10101', quantity: 1, quality: 1 });
  assert.deepEqual(rollPackItem(pack, 0.999), { itemId: '0', quantity: 1, quality: 1 });
});

test('invalid packs do not produce a reward', () => {
  assert.equal(rollPackItem(null, 0), null);
  assert.equal(rollPackItem({ items: [] }, 0), null);
  assert.equal(rollPackItem({ rewards: [] }, 0), null);
});

test('chopping evaluates frozen rolls from the equipped weapon instance', () => {
  const multiplier = app.match(/_applyAxeBuffs\(dropItem\)[\s\S]*?\n  },/)?.[0] || '';
  const refund = app.match(/\n  _checkRefundBuff\(\) \{[\s\S]*?\n  },/)?.[0] || '';

  assert.match(multiplier, /this\.equippedWeapon\?\.skillRolls/);
  assert.match(multiplier, /WeaponAffixes\.applyRewardMultipliers/);
  assert.match(refund, /this\.equippedWeapon\?\.skillRolls/);
  assert.match(refund, /WeaponAffixes\.rollRefund/);
  assert.doesNotMatch(`${multiplier}${refund}`, /buffParams|getSkillById|rollRange/);
});
