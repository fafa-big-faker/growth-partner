const test = require('node:test');
const assert = require('node:assert/strict');
const Affixes = require('../weapon-affixes');

test('explicit BUFF type takes priority over text and legacy effect labels', () => {
  assert.equal(Affixes.getBuffType({ type: 1, description: '返还', effectType: 'chop_refund' }), 1);
  assert.equal(Affixes.getBuffType({ type: '2', description: '掉落量翻倍', effectType: 'reward_multiplier' }), 2);
  assert.equal(Affixes.getBuffType({ effectType: 'reward_multiplier' }), 1);
  assert.equal(Affixes.getBuffType({ effectType: 'chop_refund' }), 2);
  assert.equal(Affixes.getBuffType({ description: '每次砍树返还次数' }), 2);
  assert.equal(Affixes.getBuffType({ type: 7, effectType: 'chop_refund' }), null);
});

test('new weapon rolls freeze numeric type and sample values using the configured type', () => {
  const config = { skills: [{ skillId: 1, buffId: 9, buffs: [{
    id: 4, type: 2, weight: 100, buffQuality: 3, description: '灵气归流 {value1} {value2}',
    value1Range: '30,30', value2Range: '2,2', value3Range: '',
  }] }] };
  let calls = 0;
  const [skill] = Affixes.rollSkills([1], () => { calls++; return 0; }, config);
  assert.equal(skill.type, 2);
  assert.equal(skill.effectType, 'chop_refund');
  assert.equal(skill.values.value1, 30);
  assert.equal(skill.values.value2, 2);
  assert.equal(calls, 1);
});

test('type routing separates refunds from multipliers without modifying frozen instances', () => {
  const rolls = [
    { type: 1, description: '', values: { value1: 1, value2: 100, value3: 3 } },
    { type: 2, description: '', values: { value1: 100, value2: 2 } },
  ];
  const before = JSON.stringify(rolls);
  let calls = 0;
  const random = () => { calls++; return 0; };
  const result = Affixes.applyRewardMultipliers({ itemId: '10001', quality: 1, quantity: 2 }, rolls, random);
  assert.equal(result.quantity, 6);
  assert.equal(result.buffTriggers.length, 1);
  assert.equal(result.buffTriggers[0].type, 1);
  assert.equal(Affixes.rollRefund(rolls, random), 2);
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(rolls), before);
});

test('old stored instances retain results and RNG consumption with no database migration', () => {
  const old = [{ effectType: 'reward_multiplier', values: { value1: 1, value2: 100, value3: 2 } },
    { effectType: 'chop_refund', values: { value1: 100, value2: 1 } }];
  const modern = old.map((roll, index) => ({ ...roll, type: index + 1 }));
  const drop = { itemId: '10001', quantity: 3, quality: 1 };
  assert.deepEqual(Affixes.applyRewardMultipliers(drop, old, () => 0), Affixes.applyRewardMultipliers(drop, modern, () => 0));
  assert.equal(Affixes.rollRefund(old, () => 0), Affixes.rollRefund(modern, () => 0));
});
