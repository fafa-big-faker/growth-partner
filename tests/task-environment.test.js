const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sql = fs.existsSync(path.join(root, 'supabase-migration-v14.sql'))
  ? fs.readFileSync(path.join(root, 'supabase-migration-v14.sql'), 'utf8') : '';
const dbTasks = app.match(/\/\/ --- 任务 ---([\s\S]*?)async getSubmissions/)?.[1] || '';

test('v14 gives tasks an exact player audience and indexes normal reads', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS audience_role TEXT/);
  assert.match(sql, /CHECK \(audience_role IN \('player', 'player_live'\)\)/);
  assert.match(sql, /ALTER COLUMN audience_role SET NOT NULL/);
  assert.match(sql, /xiu_tasks_audience_status_sort_idx[\s\S]*audience_role, status, sort_order/);
});

test('current shared tasks become live and are cloned once for test without touching submissions', () => {
  assert.match(sql, /SET audience_role = 'player_live'/);
  assert.match(sql, /'legacy-live:' \|\| id::TEXT/);
  assert.match(sql, /SELECT[\s\S]*'player',[\s\S]*'legacy-test:' \|\| source\.id::TEXT/);
  assert.match(sql, /ON CONFLICT \(environment_seed_key\) WHERE environment_seed_key IS NOT NULL DO NOTHING/);
  assert.doesNotMatch(sql, /(?:UPDATE|DELETE|INSERT INTO)\s+(?:public\.)?task_submissions/i);
});

test('all task reads and mutations carry the selected player environment', () => {
  for (const method of ['getTasks', 'getAllTasks', 'updateTaskStatus', 'updateDraftTask', 'deleteTask']) {
    const body = dbTasks.match(new RegExp(`async ${method}\\([^]*?\\n  },`))?.[0] || '';
    assert.match(body, /\.eq\('audience_role', this\.playerRole\)/, method);
  }
  const create = dbTasks.match(/async createTask\([^]*?\n  },/)?.[0] || '';
  assert.match(create, /audience_role: this\.playerRole/);
  assert.doesNotMatch(create, /fall through to fallback|fallback error/);
});

test('status and deletion report success only for one row in the active environment', () => {
  for (const method of ['updateTaskStatus', 'deleteTask']) {
    const body = dbTasks.match(new RegExp(`async ${method}\\([^]*?\\n  },`))?.[0] || '';
    assert.match(body, /\.select\('id'\)/);
    assert.match(body, /data\?\.length === 1/);
  }
});
