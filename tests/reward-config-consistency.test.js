const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const sync = fs.readFileSync(path.join(__dirname, '..', 'sync-config.py'), 'utf8');
const gameConfig = fs.readFileSync(path.join(__dirname, '..', 'game-config.js'), 'utf8');

test('every tenth chop uses reward pack 1001', () => {
  const chopMethod = app.match(/async chop\(\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(chopMethod, /GameplayRules\.isBonusChop\(this\.state\.totalChops\)/);
  assert.match(chopMethod, /this\._rollPackDrop\(1001\)/);
  assert.doesNotMatch(chopMethod, /this\._rollPackDrop\(1003\)/);
});

test('ordinary and direct pack drops propagate configured quantities', () => {
  const ordinaryDrop = app.match(/\n  _rollDrop\(treeConfig\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  const directDrop = app.match(/\n  _rollPackDrop\(packId\)\s*\{[\s\S]*?\n  },/)?.[0] || '';

  assert.match(ordinaryDrop, /GameplayRules\.rollPackItem/);
  assert.match(ordinaryDrop, /quantity:\s*rolled\.quantity/);
  assert.match(directDrop, /quantity:\s*rolled\.quantity/);
});

test('configuration sync reads parallel reward item counts', () => {
  assert.match(sync, /parse_parallel_rewards/);
  assert.match(sync, /header_indexes/);
  assert.match(sync, /pool_id/);
  assert.match(sync, /pack_id/);
  assert.match(sync, /item_ids/);
  assert.match(sync, /item_quantities/);
  assert.match(sync, /"rewards":\s*rewards/);
  assert.match(sync, /"quantities":/);
  assert.match(sync, /"奖励包ID",\s*"A1:E30"/);
});

test('skill and BUFF configuration use stable English headers and grouped lookup', () => {
  assert.match(sync, /skill_headers\s*=\s*header_indexes/);
  assert.match(sync, /\["skill_id",\s*"buff_id"\]/);
  for (const field of [
    'id', 'buff_id', 'buff_quality', 'buff_description', 'params_type_desc',
    'effect_desc', 'value1_range', 'value2_range', 'value3_range', 'weight', 'type',
  ]) {
    assert.match(sync, new RegExp(`"${field}"`));
  }
  assert.match(sync, /"BUFF表",\s*"A1:K100"/);
  assert.match(sync, /GAME_CONFIG\.buffTable\.filter\(b => b\.buffId === skill\.buffId\)/);
  assert.match(gameConfig, /buffTable:\s*\[/);
});

test('realm and tree configuration use stable headers and latest progression values', () => {
  assert.match(sync, /realm_headers\s*=\s*header_indexes/);
  assert.match(sync, /"max_axe_quality"/);
  assert.match(sync, /tree_headers\s*=\s*header_indexes/);
  assert.match(sync, /"tree_appearance"/);

  const sandbox = {};
  vm.runInNewContext(`${gameConfig}\n;globalThis.__config = GAME_CONFIG;`, sandbox);
  const config = sandbox.__config;
  const firstRealmForQuality = quality => config.realmTable.find(row => row.maxAxeQuality >= quality)?.name;
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(firstRealmForQuality),
    ['小卡拉米', '小修士', '小飞升', '小神', '大罗金仙'],
  );
  assert.deepEqual(
    Array.from(config.treeTable, row => row.appearance),
    ['sprout', 'sprout', 'sprout', 'sprout',
      'spirit', 'spirit', 'spirit', 'spirit', 'spirit', 'spirit', 'spirit',
      'divine', 'divine', 'divine', 'divine', 'divine'],
  );
});

test('every configured skill has a complete 1000-weight BUFF group', () => {
  const sandbox = {};
  vm.runInNewContext(`${gameConfig}\n;globalThis.__config = GAME_CONFIG;`, sandbox);
  const config = sandbox.__config;
  for (const skill of config.skillTable) {
    const buffs = config.buffTable.filter(row => row.buffId === skill.buffId);
    assert.equal(buffs.length, 5, `BUFF ${skill.buffId} should have five quality rows`);
    assert.equal(buffs.reduce((sum, row) => sum + row.weight, 0), 1000);
    assert.deepEqual(Array.from(buffs, row => row.buffQuality), [1, 2, 3, 4, 5]);
    for (const row of buffs) {
      assert.ok([1, 2].includes(row.type), `BUFF row ${row.id} has an invalid effect type`);
      assert.ok(row.value1Range, `BUFF row ${row.id} is missing value1_range`);
      assert.ok(row.value2Range, `BUFF row ${row.id} is missing value2_range`);
    }
  }
});

test('shop configuration exposes its player-facing description separately from notes', () => {
  assert.match(sync, /"description":\s*to_str\(row_value\(row, shop_headers, "description"\)\)/);
  assert.match(gameConfig, /shopTable:\s*\[[\s\S]*?"description":/);
  assert.match(gameConfig, /function getShopItems\(\)[\s\S]*?description:\s*s\.description\s*\|\|\s*''/);
});

test('configured cash-out values preserve decimal amounts', () => {
  assert.match(gameConfig, /"interactionParams": "0\.5"/);
  assert.match(app, /entry\.value\s*=\s*parseFloat\(params\[0\]/);
});

test('ten-chop batches persistence before the visual timeline', () => {
  const gameMethod = app.match(/\n  async chopTen\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(gameMethod, /Promise\.all/);
  assert.match(gameMethod, /inventoryGrants/);
  assert.doesNotMatch(gameMethod, /await this\.chop\(\)/);
});
