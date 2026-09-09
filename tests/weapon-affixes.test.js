const test = require('node:test');
const assert = require('node:assert/strict');

const WeaponAffixes = require('../weapon-affixes');

function buffRow(id, buffId, buffQuality, weight, ranges = {}) {
  return {
    id,
    buffId,
    buffQuality,
    weight,
    description: buffId <= 5
      ? '每次砍树时若抽到{vlaue1}的奖励，有{value2}的概率使其掉落量×{value3}倍'
      : '每次砍树时有{value1}的概率返还{value2}的砍树次数',
    value1Range: ranges.value1 || (buffId <= 5 ? String(buffId) : '1,5'),
    value2Range: ranges.value2 || (buffId <= 5 ? '1,5' : '1,1'),
    value3Range: ranges.value3 || (buffId <= 5 ? '2,2' : ''),
  };
}

const weightedBuffs = [
  buffRow(1, 1, 1, 800),
  buffRow(2, 1, 2, 100),
  buffRow(3, 1, 3, 50),
  buffRow(4, 1, 4, 30),
  buffRow(5, 1, 5, 20),
];

test('weighted BUFF selection observes all five exact boundaries', () => {
  assert.equal(WeaponAffixes.pickWeightedBuff(weightedBuffs, () => 0).id, 1);
  assert.equal(WeaponAffixes.pickWeightedBuff(weightedBuffs, () => 0.799999).id, 1);
  assert.equal(WeaponAffixes.pickWeightedBuff(weightedBuffs, () => 0.8).id, 2);
  assert.equal(WeaponAffixes.pickWeightedBuff(weightedBuffs, () => 0.9).id, 3);
  assert.equal(WeaponAffixes.pickWeightedBuff(weightedBuffs, () => 0.95).id, 4);
  assert.equal(WeaponAffixes.pickWeightedBuff(weightedBuffs, () => 0.98).id, 5);
});

test('range rolling keeps fixed and integer values exact and probability values to two decimals', () => {
  assert.equal(WeaponAffixes.rollRange('2,2', () => 0.99, { integer: true }), 2);
  assert.equal(WeaponAffixes.rollRange('2,4', () => 0, { integer: true }), 2);
  assert.equal(WeaponAffixes.rollRange('2,4', () => 0.999, { integer: true }), 4);
  assert.equal(WeaponAffixes.rollRange('1,5', () => 0.12345, { decimals: 2 }), 1.49);
});

test('two skills roll independently and freeze selected values', () => {
  const config = {
    skills: [
      { skillId: 1001, buffId: 1, buffs: weightedBuffs },
      { skillId: 2001, buffId: 6, buffs: [buffRow(26, 6, 1, 1)] },
    ],
  };
  const rolls = [0.8, 0.25, 0, 0.75];
  let index = 0;
  const result = WeaponAffixes.rollSkills([1001, 2001], () => rolls[index++], config);

  assert.equal(result.length, 2);
  assert.equal(result[0].buffRowId, 2);
  assert.deepEqual(result[0].values, { value1: 1, value2: 2, value3: 2 });
  assert.equal(result[1].buffRowId, 26);
  assert.deepEqual(result[1].values, { value1: 4, value2: 1 });
});

test('reward multiplier colors target quality independently from BUFF quality', () => {
  const html = WeaponAffixes.formatSkill({
    buffId: 1,
    buffQuality: 5,
    description: weightedBuffs[0].description,
    values: { value1: 1, value2: 3.15, value3: 2 },
  }, [{ id: 1, name: '凡品' }]);

  assert.match(html, /^每次砍树时若抽到/);
  assert.match(html, /buff-value buff-quality-1[^>]*>凡品</);
  assert.match(html, /buff-value buff-quality-5[^>]*>3\.15%<\/span>/);
  assert.match(html, /buff-value buff-quality-5[^>]*>2<\/span>倍$/);
});

test('refund skill keeps all dynamic values colored by BUFF quality', () => {
  const html = WeaponAffixes.formatSkill({
    buffId: 6,
    buffQuality: 4,
    description: '每次砍树时有{value1}的概率返还{value2}次砍树次数',
    values: { value1: 8.5, value2: 2 },
  });

  assert.equal((html.match(/buff-quality-4/g) || []).length, 2);
});

test('frozen multiplier and refund rolls evaluate without generating new values', () => {
  const multiplier = {
    buffId: 1,
    effectType: 'reward_multiplier',
    values: { value1: 1, value2: 25, value3: 3 },
  };
  const refund = {
    buffId: 6,
    effectType: 'chop_refund',
    values: { value1: 50, value2: 2 },
  };

  assert.deepEqual(
    WeaponAffixes.applyRewardMultipliers({ itemId: '10001', quality: 1, quantity: 2 }, [multiplier], () => 0.2),
    { itemId: '10001', quality: 1, quantity: 6, baseQuantity: 2,
      buffTriggers: [{ beforeQuantity: 2, afterQuantity: 6, multiplier: 3, skillId: null, buffId: 1, buffRowId: null, buffQuality: null }] },
  );
  assert.equal(WeaponAffixes.rollRefund([refund], () => 0.49), 2);
  assert.equal(WeaponAffixes.rollRefund([refund], () => 0.5), 0);
});

test('multiplier metadata preserves ordered true quantities, skill sources and original RNG consumption', () => {
  const rolls = [
    { skillId: 11, buffId: 1, buffRowId: 3, buffQuality: 3, effectType: 'reward_multiplier', values: { value1: 1, value2: 80, value3: 3 } },
    { skillId: 12, buffId: 2, effectType: 'reward_multiplier', values: { value1: 2, value2: 100, value3: 9 } },
    { skillId: 13, buffId: 6, effectType: 'chop_refund', values: { value1: 100, value2: 1 } },
    { skillId: 14, buffId: 1, buffRowId: 4, buffQuality: 4, effectType: 'reward_multiplier', values: { value1: 1, value2: 80, value3: 2 } },
    { skillId: 15, buffId: 1, effectType: 'reward_multiplier', values: { value1: 1, value2: 10, value3: 7 } },
  ];
  const drop = { itemId: '10001', quality: 1, quantity: 2 };
  const original = structuredClone({ rolls, drop });
  let calls = 0;
  const result = WeaponAffixes.applyRewardMultipliers(drop, rolls, () => { calls++; return 0.5; });
  assert.equal(calls, 3, 'only matching multiplier effects consume their existing one random draw');
  assert.equal(result.quantity, 12);
  assert.equal(result.baseQuantity, 2);
  assert.deepEqual(result.buffTriggers, [
    { beforeQuantity: 2, afterQuantity: 6, multiplier: 3, skillId: 11, buffId: 1, buffRowId: 3, buffQuality: 3 },
    { beforeQuantity: 6, afterQuantity: 12, multiplier: 2, skillId: 14, buffId: 1, buffRowId: 4, buffQuality: 4 },
  ]);
  assert.deepEqual({ rolls, drop }, original, 'recording feedback never modifies the reward input or frozen skills');
});

test('nontriggering multiplier metadata does not fabricate a bonus or consume additional randomness', () => {
  let calls = 0;
  const result = WeaponAffixes.applyRewardMultipliers({ quality: 2, quantity: 4 }, [
    { effectType: 'reward_multiplier', values: { value1: 1, value2: 100, value3: 3 } },
  ], () => { calls++; return 0; });
  assert.deepEqual(result, { quality: 2, quantity: 4, baseQuantity: 4, buffTriggers: [] });
  assert.equal(calls, 0);
  assert.equal(WeaponAffixes.applyRewardMultipliers(null, [], () => { throw Error('unexpected'); }), null);
});
