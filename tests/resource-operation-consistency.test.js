const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'upgrade_v5.sql');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('v5 migration defines atomic compose and claim reservation', () => {
  assert.equal(fs.existsSync(sqlPath), true);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.match(sql, /create or replace function compose_inventory_item/i);
  assert.match(sql, /quantity >= p_source_quantity/i);
  assert.match(sql, /create or replace function reserve_player_claim/i);
  assert.match(sql, /theme_reward_claims/i);
  assert.match(sql, /grant execute on function compose_inventory_item/i);
});

test('compose uses one guarded RPC and updates inventory locally', () => {
  assert.match(app, /dbClient\.rpc\('compose_inventory_item'/);
  assert.match(app, /PlayerView\._doCompose\('\$\{itemId\}',q,this\)/);

  const body = app.match(/async composeMulti\([\s\S]*?\n  },/)?.[0] || '';
  assert.match(body, /DB\.composeInventoryItem/);
  assert.match(body, /_setInventoryQuantity/);
  assert.doesNotMatch(body, /DB\.removeItem/);
  assert.doesNotMatch(body, /DB\.addItem/);
  assert.doesNotMatch(body, /this\.refresh\(/);
});
