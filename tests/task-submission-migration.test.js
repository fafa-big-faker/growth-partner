const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '..', 'upgrade_v11.sql'), 'utf8');

test('v11 adds and backfills the task submission account role', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS user_role TEXT/);
  assert.match(sql, /SET user_role = 'player'/);
  assert.match(sql, /ALTER COLUMN user_role SET NOT NULL/);
  assert.match(sql, /CHECK \(user_role IN \('player', 'player_live'\)\)/);
  assert.match(sql, /task_submissions_user_submitted_idx/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('task submission reads and writes use the selected account role', () => {
  const taskSection = app.match(/\/\/ --- 任务提交 ---[\s\S]*?\/\/ --- 邮件 ---/)?.[0] || '';
  assert.match(taskSection, /\.eq\('user_role', this\.playerRole\)/);
  assert.match(taskSection, /user_role: this\.playerRole/);
});

test('both task submission forms show a database failure message', () => {
  const normalSubmit = app.match(/\n  submitTask\(taskId\)[\s\S]*?\n  showSelfSubmit\(\)/)?.[0] || '';
  const selfSubmit = app.match(/\n  showSelfSubmit\(\)[\s\S]*?\n  async claimTaskReward/)?.[0] || '';
  assert.match(normalSubmit, /任务提交失败，请稍后重试/);
  assert.match(selfSubmit, /任务提交失败，请稍后重试/);
});
