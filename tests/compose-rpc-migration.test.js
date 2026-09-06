const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '..', 'upgrade_v9.sql');

test('v9 repairs UUID inventory ids and removes the stale compose overload', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'missing upgrade_v9.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /drop function if exists public\.compose_inventory_item\s*\(text,\s*integer,\s*text,\s*integer\)/i);
  assert.match(sql, /drop function if exists public\.compose_inventory_item\s*\(text,\s*text,\s*integer,\s*text,\s*integer\)/i);
  assert.match(sql, /v_source_id\s+inventory\.id%type/i);
  assert.match(sql, /v_target_id\s+inventory\.id%type/i);
  assert.match(sql, /v_inventory_id\s+inventory\.id%type/i);
  assert.doesNotMatch(sql, /v_(?:source|target|inventory)_id\s+bigint/i);
  assert.match(sql, /grant execute on function public\.compose_inventory_item/i);
  assert.match(sql, /notify pgrst,\s*'reload schema'/i);
});
