const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  TEN_CHOP_UNLOCK_REALM,
  canUseTenChop,
  canUpgradeTreeRealm,
  isBonusChop,
  rollPackItem,
} = require('../gameplay-rules');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('bonus chop cadence follows every persisted ten chops', () => {
  assert.equal(isBonusChop(0), false);
  assert.equal(isBonusChop(9), false);
  assert.equal(isBonusChop(10), true);
  assert.equal(isBonusChop(11), false);
  assert.equal(isBonusChop(20), true);
});

test('ten chop unlocks from middle kalami realm', () => {
  assert.equal(TEN_CHOP_UNLOCK_REALM, 2);
  assert.equal(canUseTenChop(1), false);
  assert.equal(canUseTenChop(2), true);
  assert.equal(canUseTenChop(5), true);
});

test('tree upgrade hint requires a next realm and every configured material', () => {
  const nextRealm = {
    reqItems: [
      { itemId: 40001, count: 2 },
      { itemId: '30001', count: 3 },
    ],
  };
  assert.equal(canUpgradeTreeRealm(null, []), false);
  assert.equal(canUpgradeTreeRealm({ reqItems: [] }, []), false);
  assert.equal(canUpgradeTreeRealm(nextRealm, [
    { itemId: '40001', quantity: 2 },
    { itemId: '30001', quantity: 2 },
  ]), false);
  assert.equal(canUpgradeTreeRealm(nextRealm, [
    { itemId: '40001', quantity: 2 },
    { itemId: 30001, quantity: 3 },
  ]), true);
});

test('all ten chop entry points enforce the realm requirement before work starts', () => {
  const gameMethod = app.match(/\n  async chopTen\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  const toggleMethod = app.match(/\n  toggleTenChop\(checked\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  const playerMethod = app.match(/\n  async doChopTen\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';

  assert.match(gameMethod, /if \(!GameplayRules\.canUseTenChop\(this\.state\.realmLevel\)\)/);
  assert.ok(gameMethod.indexOf('canUseTenChop') < gameMethod.indexOf('choppingCount < 10'));
  assert.match(toggleMethod, /if \(checked && !GameplayRules\.canUseTenChop\(Game\.state\.realmLevel\)\)/);
  assert.match(toggleMethod, /突破至中卡拉米后解锁/);
  assert.match(toggleMethod, /cb\.checked = false/);
  assert.match(playerMethod, /if \(!GameplayRules\.canUseTenChop\(Game\.state\.realmLevel\)\)/);
  assert.ok(playerMethod.indexOf('canUseTenChop') < playerMethod.indexOf("getElementById('chop-btn')"));
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
