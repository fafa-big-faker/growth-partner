const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const v6Path = path.join(__dirname, '..', 'upgrade_v6.sql');
const v7Path = path.join(__dirname, '..', 'upgrade_v7.sql');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const sync = fs.readFileSync(path.join(__dirname, '..', 'sync-config.py'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('v6 migration stores one dated sign-in per player and day', () => {
  assert.equal(fs.existsSync(v6Path), true);
  const sql = fs.readFileSync(v6Path, 'utf8');

  assert.match(sql, /create table if not exists daily_checkins/i);
  assert.match(sql, /unique\s*\(user_role,\s*checkin_date\)/i);
  assert.match(sql, /Asia\/Shanghai/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /on conflict\s*\(user_role,\s*checkin_date\)\s*do nothing/i);
  assert.match(sql, /create or replace function daily_check_in\(\)/i);
  assert.match(sql, /alter table daily_checkins enable row level security/i);
  assert.match(sql, /revoke all on table daily_checkins from anon, authenticated/i);
});

test('v7 migration grants configured rewards in the same transaction as sign-in', () => {
  assert.equal(fs.existsSync(v7Path), true);
  const sql = fs.readFileSync(v7Path, 'utf8');

  assert.match(sql, /daily_check_in\(p_rewards JSONB/i);
  assert.match(sql, /jsonb_array_elements\(p_rewards\)/i);
  assert.match(sql, /v_item_id\s*=\s*'1'/i);
  assert.match(sql, /update inventory[\s\S]*?where id\s*=\s*\([\s\S]*?order by id[\s\S]*?limit 1/i);
  assert.match(sql, /insert into inventory/i);
  assert.doesNotMatch(sql, /on conflict\s*\(user_role,\s*item_id\)/i);
  assert.match(sql, /on conflict\s*\(user_role,\s*checkin_date\)\s*do nothing/i);
  assert.match(sql, /if v_inserted_id is null then/i);
});

test('client delegates configured sign-in rewards to the database RPC', () => {
  assert.match(app, /async dailyCheckIn\(rewards\)[\s\S]*?p_rewards:\s*rewards/);

  const gameMethod = app.match(/\/\/ 每日签到[\s\S]*?async dailyCheckIn\(\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(gameMethod, /getDailySignInRewards\(\)/);
  assert.match(gameMethod, /DB\.dailyCheckIn\(rewards\)/);
  assert.match(gameMethod, /result\.days/);
  assert.doesNotMatch(gameMethod, /signInDays\s*=\s*\(this\.state\.signInDays/);
  assert.doesNotMatch(gameMethod, /获得 1 次砍树机会/);
});

test('configuration sync reads the daily sign-in worksheet', () => {
  assert.match(sync, /"每日签到奖励",\s*"A1:B10"/);
  assert.match(sync, /daily_headers\s*=\s*header_indexes/);
  assert.match(sync, /"item_ids"/);
  assert.match(sync, /"item_quantities"/);
  assert.match(sync, /daily_signin_rewards/);
  assert.match(sync, /dailySignInRewards:/);
  assert.match(sync, /function getDailySignInRewards\(\)/);
});

test('daily task card renders configured rewards instead of the legacy chopping reward', () => {
  const render = app.match(/\n  _renderTaskCard\(task, status, type\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(render, /type === 'daily'[\s\S]*?getDailySignInRewards\(\)/);
  assert.match(render, /dailyReward/);
  assert.match(render, /rewardChopping:\s*0/);
  assert.match(render, /rewardItems:\s*dailyRewards\.map/);
  assert.match(render, /renderTaskRewardChips\(rewardSource/);
});

test('cumulative sign-in milestones use one icon with separate amount and claim state', () => {
  const render = app.match(/\n  _signInTimelineHtml\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(render, /node-amount/);
  assert.match(render, /node-claim-mark/);
  assert.doesNotMatch(render, /node-reward/);
  assert.match(styles, /\.node-amount/);
  assert.match(styles, /\.node-claim-mark/);
});
