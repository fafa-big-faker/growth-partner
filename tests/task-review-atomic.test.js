const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const migrationPath = path.join(__dirname, '..', 'upgrade_v12.sql');

test('v12 reviews a pending submission and inserts one mail atomically', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'upgrade_v12.sql should exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.review_task_submission/);
  assert.match(sql, /WHERE id = p_submission_id[\s\S]*AND user_role = p_user_role[\s\S]*AND status = 'pending'/);
  assert.match(sql, /RETURNING id INTO v_submission_id/);
  assert.match(sql, /IF v_submission_id IS NULL THEN[\s\S]*already_reviewed/);
  assert.match(sql, /INSERT INTO public\.mails/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.review_task_submission/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('browser review API preserves structured result codes', () => {
  const dbSection = app.match(/async reviewSubmission\([\s\S]*?\/\/ --- 邮件 ---/)?.[0] || '';
  assert.match(dbSection, /async reviewSubmissionOnce\(/);
  assert.match(dbSection, /\.rpc\('review_task_submission'/);
  assert.match(dbSection, /p_user_role: this\.playerRole/);
  assert.match(dbSection, /return data \|\| \{ ok: false, code: 'empty_response' \}/);
});

test('approve and reject controls share one guarded atomic review path', () => {
  const reviewUi = app.match(/\n  async _runSubmissionReview\([\s\S]*?\n  \/\/ --- 提现审批 ---/)?.[0] || '';
  assert.match(reviewUi, /UI\.runLockedAction\(/g);
  assert.match(reviewUi, /DB\.reviewSubmissionOnce\(/g);
  assert.match(reviewUi, /task-review:/);
  assert.match(reviewUi, /already_reviewed/);
  assert.doesNotMatch(reviewUi, /await DB\.reviewSubmission\([\s\S]*await DB\.sendMail/);
});
