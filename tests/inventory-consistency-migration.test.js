const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '..', 'supabase-migration-v13.sql');

test('v13 merges duplicate inventory rows before enforcing uniqueness', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'missing supabase-migration-v13.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /begin\s*;/i);
  assert.match(sql, /sum\s*\(\s*quantity\s*\)/i);
  assert.match(sql, /array_agg\s*\(\s*id\s+order\s+by/i);
  assert.match(sql, /delete\s+from\s+public\.inventory/i);
  assert.match(sql, /create\s+unique\s+index\s+if\s+not\s+exists\s+inventory_user_item_unique_idx/i);
  assert.match(sql, /on\s+public\.inventory\s*\(\s*user_role\s*,\s*item_id\s*\)/i);
  assert.match(sql, /commit\s*;/i);
});

test('v13 provides atomic add and remove inventory RPCs', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const add = sql.match(/create\s+or\s+replace\s+function\s+public\.add_inventory_item[\s\S]*?\$\$\s*;/i)?.[0] || '';
  const remove = sql.match(/create\s+or\s+replace\s+function\s+public\.remove_inventory_item[\s\S]*?\$\$\s*;/i)?.[0] || '';

  assert.match(add, /p_quantity\s+integer/i);
  assert.match(add, /p_quantity\s*<=\s*0/i);
  assert.match(add, /insert\s+into\s+public\.inventory/i);
  assert.match(add, /on\s+conflict\s*\(\s*user_role\s*,\s*item_id\s*\)/i);
  assert.match(add, /quantity\s*=\s*inventory\.quantity\s*\+/i);
  assert.match(add, /returning\s+quantity/i);

  assert.match(remove, /p_quantity\s*<=\s*0/i);
  assert.match(remove, /for\s+update/i);
  assert.match(remove, /quantity\s*>=\s*p_quantity/i);
  assert.match(remove, /insufficient_materials/i);
  assert.match(remove, /returning\s+quantity/i);
});

test('v13 compose, sign-in and forge use the unique inventory contract', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /drop\s+function\s+if\s+exists\s+public\.daily_check_in\s*\(\s*jsonb\s*\)/i);
  for (const functionName of ['compose_inventory_item', 'daily_check_in', 'forge_weapon_instance']) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}`, 'i'));
  }
  assert.doesNotMatch(sql, /from\s+public\.inventory[\s\S]{0,180}order\s+by\s+id[\s\S]{0,80}limit\s+1/i);
  assert.match(sql, /notify\s+pgrst\s*,\s*'reload schema'/i);
});
