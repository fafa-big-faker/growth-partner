const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'upgrade_v5.sql');

test('v5 migration defines atomic compose and claim reservation', () => {
  assert.equal(fs.existsSync(sqlPath), true);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.match(sql, /create or replace function compose_inventory_item/i);
  assert.match(sql, /quantity >= p_source_quantity/i);
  assert.match(sql, /create or replace function reserve_player_claim/i);
  assert.match(sql, /theme_reward_claims/i);
  assert.match(sql, /grant execute on function compose_inventory_item/i);
});
