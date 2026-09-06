const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '..', 'upgrade_v10.sql');

test('v10 creates independent weapon instances and an equipped instance reference', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'missing upgrade_v10.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /create table if not exists public\.weapon_instances/i);
  assert.match(sql, /skill_rolls\s+jsonb/i);
  assert.match(sql, /add column if not exists axe_instance_id uuid/i);
  assert.match(sql, /generate_series\s*\(1,\s*i\.quantity\)/i);
  assert.match(sql, /delete from public\.inventory[\s\S]*item_id\s*=\s*any/i);
});

test('forge RPC locks resources, consumes material, and inserts one instance atomically', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const rpc = sql.match(/create or replace function public\.forge_weapon_instance[\s\S]*?\$\$;/i)?.[0] || '';

  assert.match(rpc, /from public\.player_state[\s\S]*for update/i);
  assert.match(rpc, /from public\.inventory[\s\S]*for update/i);
  assert.match(rpc, /quantity\s*=\s*quantity\s*-\s*p_cost_quantity/i);
  assert.match(rpc, /insert into public\.weapon_instances/i);
  assert.match(rpc, /returning \* into v_instance/i);
});

test('equip and sell RPCs enforce instance ownership', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const equip = sql.match(/create or replace function public\.equip_weapon_instance[\s\S]*?\$\$;/i)?.[0] || '';
  const sell = sql.match(/create or replace function public\.sell_weapon_instance[\s\S]*?\$\$;/i)?.[0] || '';

  assert.match(equip, /id\s*=\s*p_instance_id\s+and\s+user_role\s*=\s*p_user_role/i);
  assert.match(equip, /axe_instance_id\s*=\s*p_instance_id/i);
  assert.match(sell, /id\s*=\s*p_instance_id\s+and\s+user_role\s*=\s*p_user_role/i);
  assert.match(sell, /equipped_weapon/i);
  assert.match(sell, /coin\s*=\s*coalesce\(coin,\s*0\)\s*\+\s*p_price/i);
  assert.match(sell, /delete from public\.weapon_instances/i);
});

test('migration and RPC declarations are repeatable and exposed to the API', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /on conflict do nothing/i);
  assert.match(sql, /create or replace function public\.initialize_weapon_affixes/i);
  assert.match(sql, /create or replace function public\.initialize_weapon_affixes_batch/i);
  assert.match(sql, /grant execute on function public\.forge_weapon_instance/i);
  assert.match(sql, /grant execute on function public\.equip_weapon_instance/i);
  assert.match(sql, /grant execute on function public\.sell_weapon_instance/i);
  assert.match(sql, /notify pgrst,\s*'reload schema'/i);
});
