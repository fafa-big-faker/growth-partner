const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const WeaponAffixes = require('../weapon-affixes');

const labels = ['B', 'A', 'S', 'SS', 'SSS'];
const description = '每次砍树时若抽到{vlaue1}的奖励，有{value2}的概率使其掉落量×{value3}倍';
const roll = (buffQuality, extra = {}) => ({ buffQuality, description, ...extra });
const rated = (...skillRolls) => WeaponAffixes.getWeaponRating({ skillRolls });

test('each stored skill quality maps to its exact rating', () => {
  for (let quality = 1; quality <= 5; quality++) {
    assert.deepEqual(rated(roll(quality)), { quality, label: labels[quality - 1] });
  }
});

test('highest valid skill quality wins independently of skill order or count', () => {
  const first = roll(2, { skillId: 1005, buffId: 5 });
  const second = roll(4, { skillId: 2005, buffId: 10 });
  assert.deepEqual(rated(first, second), { quality: 4, label: 'SS' });
  assert.deepEqual(rated(second, first), { quality: 4, label: 'SS' });
  assert.deepEqual(rated(first, roll(1), second, roll(3), roll(5)), { quality: 5, label: 'SSS' });
});

test('same item with distinct weapon UUIDs retains independent ratings', () => {
  const first = { id: 'weapon-a', itemId: '55001', quality: 5, skillRolls: [roll(1)] };
  const second = { id: 'weapon-b', itemId: '55001', quality: 5, skillRolls: [roll(5)] };
  assert.deepEqual(WeaponAffixes.getWeaponRating(first), { quality: 1, label: 'B' });
  assert.deepEqual(WeaponAffixes.getWeaponRating(second), { quality: 5, label: 'SSS' });
});

test('rating never uses item rarity, buff group, row ID or targeted reward rarity', () => {
  assert.deepEqual(WeaponAffixes.getWeaponRating({ quality: 5, itemId: '55001',
    skillRolls: [roll(2, { buffId: 10, buffRowId: 50, values: { value1: 5 } })],
  }), { quality: 2, label: 'A' });
  assert.deepEqual(WeaponAffixes.getWeaponRating({ quality: 5, skillIds: [1005, 2005] }), { quality: 1, label: 'B' });
});

test('absent or invalid roll collections default to B', () => {
  for (const weapon of [null, undefined, false, 0, '', {}, { skillRolls: null },
    { skillRolls: {} }, { skillRolls: 'not-an-array' }, { skillRolls: [] }]) {
    assert.deepEqual(WeaponAffixes.getWeaponRating(weapon), { quality: 1, label: 'B' });
  }
});

test('malformed entries and qualities cannot elevate a weapon rating', () => {
  const malformed = [null, undefined, false, true, 5, '5', [], {},
    ...[null, undefined, false, true, 0, -1, 6, 1.5, NaN, Infinity, -Infinity, '', ' ', 'bad', [], {}, Symbol('5'), 5n]
      .map(value => roll(value))];
  assert.deepEqual(rated(...malformed), { quality: 1, label: 'B' });
  assert.deepEqual(rated(...malformed, roll(3)), { quality: 3, label: 'S' });
});

test('empty skill copy is ignored even if its stored rarity is high', () => {
  for (const text of [undefined, null, '', ' \n\t ', 5, {}, []]) {
    assert.deepEqual(rated(roll(5, { description: text }), roll(2)), { quality: 2, label: 'A' });
  }
});

test('saved template and legacy completed text remain valid without current config fields', () => {
  for (const text of [description,
    '每次砍树时有{value1}的概率返还{value2}的砍树次数',
    '每次砍树时有15%的概率返还5次砍树次数',
    '  每次砍树返还次数  ']) {
    assert.deepEqual(rated({ buffQuality: 4, description: text }), { quality: 4, label: 'SS' });
  }
  assert.deepEqual(rated({ buffQuality: '5', description }), { quality: 5, label: 'SSS' });
});

test('actual rollSkills output is directly compatible without rendering or modifying it', () => {
  const skillRolls = WeaponAffixes.rollSkills([1005, 2005], () => 0, {
    skills: [
      { skillId: 1005, buffId: 5, buffs: [{ id: 22, buffQuality: 2, weight: 1,
        description, value1Range: '5', value2Range: '10,15', value3Range: '2' }] },
      { skillId: 2005, buffId: 10, buffs: [{ id: 49, buffQuality: 4, weight: 1,
        description: '每次砍树时有{value1}的概率返还{value2}的砍树次数', value1Range: '10,15', value2Range: '3' }] },
    ],
  });
  const snapshot = JSON.stringify(skillRolls);
  assert.deepEqual(WeaponAffixes.getWeaponRating({ skillRolls }), { quality: 4, label: 'SS' });
  assert.equal(JSON.stringify(skillRolls), snapshot);
});

test('rating is pure, does not need configuration, and preserves the browser export', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'weapon-affixes.js'), 'utf8');
  const scope = { Math: Object.assign(Object.create(Math), { random() { throw new Error('rating must not roll'); } }) };
  Object.defineProperty(scope, 'GAME_CONFIG', { get() { throw new Error('rating must not read live configuration'); } });
  scope.getSkillById = () => { throw new Error('rating must not resolve current skill config'); };
  vm.runInNewContext(source, scope);
  assert.equal(typeof scope.WeaponAffixes.getWeaponRating, 'function');
  const weapon = Object.freeze({ skillRolls: Object.freeze([Object.freeze(roll(3))]) });
  const first = scope.WeaponAffixes.getWeaponRating(weapon);
  const second = scope.WeaponAffixes.getWeaponRating(weapon);
  assert.equal(first.quality, 3);
  assert.equal(first.label, 'S');
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.notEqual(first, second);
});
