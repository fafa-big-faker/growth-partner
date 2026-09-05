const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  assert.match(sync, /"rewards":\s*rewards/);
  assert.match(sync, /"quantities":/);
  assert.match(sync, /"奖励包ID",\s*"A1:E30"/);
});

test('configured cash-out values preserve decimal amounts', () => {
  assert.match(gameConfig, /"interactionParams": "0\.5"/);
  assert.match(app, /entry\.value\s*=\s*parseFloat\(params\[0\]/);
});
