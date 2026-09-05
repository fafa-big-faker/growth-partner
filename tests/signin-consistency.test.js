const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'upgrade_v6.sql');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('v6 migration stores one dated sign-in per player and day', () => {
  assert.equal(fs.existsSync(sqlPath), true);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.match(sql, /create table if not exists daily_checkins/i);
  assert.match(sql, /unique\s*\(user_role,\s*checkin_date\)/i);
  assert.match(sql, /Asia\/Shanghai/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /on conflict\s*\(user_role,\s*checkin_date\)\s*do nothing/i);
  assert.match(sql, /create or replace function daily_check_in\(\)/i);
  assert.match(sql, /alter table daily_checkins enable row level security/i);
  assert.match(sql, /revoke all on table daily_checkins from anon, authenticated/i);
});

test('client delegates sign-in arithmetic to the database RPC', () => {
  assert.match(app, /async dailyCheckIn\(\)\s*\{[\s\S]*?dbClient\.rpc\('daily_check_in'\)/);

  const gameMethod = app.match(/\/\/ 每日签到[\s\S]*?async dailyCheckIn\(\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(gameMethod, /DB\.dailyCheckIn\(\)/);
  assert.match(gameMethod, /result\.days/);
  assert.doesNotMatch(gameMethod, /signInDays\s*=\s*\(this\.state\.signInDays/);
});
