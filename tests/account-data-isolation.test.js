const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '..', 'upgrade_v8.sql'), 'utf8');

test('all player-owned browser operations use the selected data role', () => {
  assert.match(app, /playerRole:\s*'player'/);
  assert.match(app, /setPlayerRole\(account\.playerRole\)/);
  assert.doesNotMatch(app, /\.eq\('user_role',\s*'player'\)/);
  assert.doesNotMatch(app, /user_role:\s*'player'/);
  assert.match(app, /p_user_role:\s*this\.playerRole/g);
});

test('v8 creates live state and role-aware atomic functions', () => {
  assert.match(sql, /'player_live'/);
  assert.match(sql, /compose_inventory_item\([\s\S]*?p_user_role TEXT/);
  assert.match(sql, /reserve_player_claim\([\s\S]*?p_user_role TEXT/);
  assert.match(sql, /daily_check_in\(p_user_role TEXT, p_rewards JSONB\)/);
  assert.match(sql, /p_user_role NOT IN \('player', 'player_live'\)/);
});
