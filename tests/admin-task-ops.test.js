const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createOperationGuard } = require('../operation-guard');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const adminSource = app.slice(app.indexOf('const AdminView = {'), app.indexOf('\n// 初始化（登录时调用'));
const guardStart = app.indexOf('  async runLockedAction(');
const guardSource = app.slice(guardStart, app.indexOf('\n  modal(', guardStart));
const taskDbSource = app.slice(app.indexOf('  async deleteTask('), app.indexOf('\n  // --- 任务提交 ---'));
const plain = value => JSON.parse(JSON.stringify(value));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function element() {
  return {
    innerHTML: '', textContent: '', value: '', hidden: false, style: {}, dataset: {},
    isConnected: true, disabled: false, readOnly: false, listeners: {}, rows: [],
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    querySelectorAll() { return this.rows; },
    querySelector() { return null; },
    setAttribute() {}, removeAttribute() {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
  };
}

function harness(overrides = {}) {
  const state = {
    toasts: [], modals: [], refreshes: [], statusWrites: [],
    archives: [], restores: [], purges: [], logs: [],
  };
  const nodes = {
    'admin-main': element(),
    'admin-dashboard': element(),
    'admin-task-list': element(),
    'admin-batch-bar': element(),
    'admin-review-badge': element(),
    'review-list': element(),
    'admin-task-search': element(),
  };
  const context = vm.createContext({
    ITEMS: {},
    OperationGuard: createOperationGuard(),
    escapeHtml,
    localDateStr: () => '2026-09-20',
    renderFeatureIcon: () => '',
    renderItemIcon: () => '',
    renderEmptyState: (icon, text) => (text ? `<div class="empty-state">${text}</div>` : ''),
    renderTaskRewardChips: () => '<div class="task-reward-list">奖励</div>',
    GameDateTime: { formatShanghaiDate: value => String(value || '').slice(0, 10) },
    console: { error() {}, warn() {} },
    Auth: { session: { id: 'admin-session' } },
    Router: { currentAdminTab: 'task-manage' },
    document: {
      getElementById: id => nodes[id] || null,
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    DB: {
      async getAllTasks() { return overrides.tasks ? overrides.tasks() : []; },
      async getSubmissions() { return overrides.submissions ? overrides.submissions() : []; },
      async updateTaskStatus(id, status) { state.statusWrites.push({ id, status }); return true; },
      async updateDraftTask() { return { ok: true }; },
      async createTask(payload) { state.creates = state.creates || []; state.creates.push(payload); return { id: 'created' }; },
      async archiveTask(id) { state.archives.push(id); return overrides.archiveFails !== true; },
      async restoreTask(id) { state.restores.push(id); return true; },
      async deleteTask(id) { state.purges.push(id); return true; },
      async logTaskAction(entry) { state.logs.push(entry); return true; },
    },
    UI: {
      toast(message, type) { state.toasts.push({ message, type }); },
      modal(content, options) { const overlay = element(); overlay.content = content; overlay.options = options; state.modals.push(overlay); return overlay; },
      closeModal(overlay) { overlay.isConnected = false; },
      confirm(message, onConfirm) { state.confirms = state.confirms || []; state.confirms.push(message); return onConfirm(); },
      statusTag(status) { return `<span class="tag">${status}</span>`; },
      taskTypeTag: () => '', difficultyTag: () => '',
    },
  });
  vm.runInContext(`UI.runLockedAction=({${guardSource}}).runLockedAction;\n${adminSource}\nglobalThis.AdminView=AdminView;`, context);
  const admin = context.AdminView;
  admin.renderTaskManage = async settings => { state.refreshes.push(settings); };
  return { admin, state, nodes, context };
}

test('lifecycle ranks archive over approval over theme expiry over draft and published', () => {
  const h = harness();
  const today = '2026-09-20';
  const approved = { status: 'claimed' };
  assert.equal(h.admin._taskLifecycle({ status: 'archived' }, approved, today).label, '已删除');
  assert.equal(
    h.admin._taskLifecycle({ status: 'published', taskType: 'theme', themeEnd: '2026-01-31' }, approved, today).label,
    '已通过',
  );
  assert.equal(
    h.admin._taskLifecycle({ status: 'published', taskType: 'theme', themeEnd: '2026-01-31' }, null, today).label,
    '活动已结束',
  );
  assert.equal(h.admin._taskLifecycle({ status: 'draft', taskType: 'weekly' }, null, today).label, '发布池');
  assert.equal(h.admin._taskLifecycle({ status: 'published', taskType: 'weekly' }, null, today).label, '已发布');
  assert.equal(
    h.admin._taskLifecycle({ status: 'published', taskType: 'theme', themeStart: '2026-09-25', themeEnd: '2026-10-31' }, null, today).label,
    '已发布',
  );
});

test('theme run state reports ongoing, upcoming and ended activity windows', () => {
  const h = harness();
  const theme = (start, end) => ({ taskType: 'theme', themeStart: start, themeEnd: end });
  assert.match(h.admin._themeRunState(theme('2026-09-01', '2026-09-30'), '2026-09-20').label, /进行中 · 剩 11 天/);
  assert.equal(h.admin._themeRunState(theme('2026-09-19', '2026-09-20'), '2026-09-20').label, '活动今日结束');
  assert.equal(h.admin._themeRunState(theme('2026-09-25', '2026-09-30'), '2026-09-20').label, '活动未开始');
  assert.equal(h.admin._themeRunState(theme('2026-08-01', '2026-08-31'), '2026-09-20').label, '活动已结束');
  assert.equal(h.admin._themeRunState({ taskType: 'weekly' }, '2026-09-20'), null);
});

test('new tasks take the highest sort order plus one so deletions cannot collide', async () => {
  const h = harness();
  h.admin._adminTasks = [{ sortOrder: 2 }, { sortOrder: 7 }, {}];
  assert.equal(h.admin._nextTaskSortOrder(), 8);
  h.admin._adminTasks = [];
  assert.equal(h.admin._nextTaskSortOrder(), 1);
});

test('approved and expired tasks drop pull-back actions while drafts and live tasks keep theirs', () => {
  const h = harness();
  h.admin._adminTasks = [
    { id: 'approved', status: 'published', taskType: 'weekly', title: '<b>已通过</b>', description: '', rewardItems: [] },
    { id: 'expired', status: 'published', taskType: 'theme', themeName: '旧活动', themeStart: '2026-01-01', themeEnd: '2026-01-31', title: '过期活动任务', description: '', rewardItems: [] },
    { id: 'draft', status: 'draft', taskType: 'weekly', title: '草稿任务', description: '', rewardItems: [] },
    { id: 'live', status: 'published', taskType: 'weekly', title: '进行中任务', description: '', rewardItems: [] },
    { id: 'gone', status: 'archived', taskType: 'weekly', title: '已删除任务', description: '', rewardItems: [] },
  ];
  h.admin._adminSubmissions = [{ taskId: 'approved', status: 'approved' }];

  h.admin._adminTaskFilter = 'all';
  h.admin._renderAdminTaskList();
  const live = h.nodes['admin-task-list'].innerHTML;
  assert.match(live, /tag-lifecycle-approved/);
  assert.match(live, /tag-lifecycle-ended/);
  assert.match(live, /&lt;b&gt;已通过&lt;\/b&gt;/);
  assert.doesNotMatch(live, /<b>已通过<\/b>/);
  // 已完成/已结束的任务只展示状态，不再提供撤回或删除
  for (const action of ['unpublishTask', 'archiveTask', 'unpublishAndEdit']) {
    assert.doesNotMatch(live, new RegExp(`${action}\\('approved'`), action);
    assert.doesNotMatch(live, new RegExp(`${action}\\('expired'`), action);
  }
  // 归档任务不出现在「全部」里，需要在「已删除」里恢复
  assert.doesNotMatch(live, /restoreTask\('gone'/);

  h.admin._adminTaskFilter = 'draft';
  h.admin._renderAdminTaskList();
  assert.match(h.nodes['admin-task-list'].innerHTML, /showEditTask\('draft',this\)/);

  h.admin._adminTaskFilter = 'published';
  h.admin._renderAdminTaskList();
  const published = h.nodes['admin-task-list'].innerHTML;
  assert.match(published, /unpublishAndEdit\('live',this\)/);
  assert.match(published, /unpublishTask\('live',this\)/);

  h.admin._adminTaskFilter = 'archived';
  h.admin._renderAdminTaskList();
  const archived = h.nodes['admin-task-list'].innerHTML;
  assert.match(archived, /restoreTask\('gone',this\)/);
  assert.match(archived, /purgeTask\('gone',this\)/);
});

test('admin search narrows the list by title, description and theme', () => {
  const h = harness();
  h.admin._adminTasks = [
    { id: 'a', status: 'published', taskType: 'weekly', title: '给哥哥打电话', description: '', rewardItems: [] },
    { id: 'b', status: 'published', taskType: 'theme', themeName: '开学季', title: '聚餐', description: '和舍友', rewardItems: [] },
  ];
  h.admin._adminTaskFilter = 'all';
  h.admin.searchAdminTasks('舍友');
  assert.match(h.nodes['admin-task-list'].innerHTML, /聚餐/);
  assert.doesNotMatch(h.nodes['admin-task-list'].innerHTML, /给哥哥打电话/);
  h.admin.searchAdminTasks('开学季');
  assert.match(h.nodes['admin-task-list'].innerHTML, /聚餐/);
  h.admin.searchAdminTasks('不存在的关键词');
  assert.match(h.nodes['admin-task-list'].innerHTML, /没有匹配/);
});

test('archiving asks first, keeps the row recoverable and logs the operation', async () => {
  const h = harness();
  h.admin._adminTasks = [{ id: 'task-1', status: 'published', taskType: 'weekly', title: '打电话', rewardItems: [] }];
  await h.admin.archiveTask('task-1', null);
  assert.equal(h.state.confirms.length, 1);
  assert.match(h.state.confirms[0], /可以在「已删除」里恢复/);
  assert.deepEqual(h.state.archives, ['task-1']);
  assert.equal(h.state.logs[0].action, 'archive');
  assert.equal(h.state.logs[0].taskTitle, '打电话');
  assert.equal(h.state.toasts.at(-1).type, 'success');
});

test('batch actions only run for the selected tasks and report failures', async () => {
  const h = harness();
  h.admin._adminTasks = [
    { id: 'a', status: 'draft', taskType: 'weekly', title: 'A', rewardItems: [] },
    { id: 'b', status: 'draft', taskType: 'weekly', title: 'B', rewardItems: [] },
  ];
  h.admin._adminTaskFilter = 'draft';
  h.admin._adminBatchMode = true;
  h.admin._adminSelected = new Set(['a', 'b']);
  await h.admin.batchSetStatus('published');
  assert.deepEqual(plain(h.state.statusWrites), [{ id: 'a', status: 'published' }, { id: 'b', status: 'published' }]);
  assert.equal(h.admin._adminSelected.size, 0);

  h.admin._adminSelected = new Set();
  assert.equal(await h.admin.batchSetStatus('published'), false);
  assert.match(h.state.toasts.at(-1).message, /请先勾选任务/);
});

test('review list escapes player text and shows waiting time and rewards', () => {
  const h = harness();
  h.admin._submissions = [{
    id: 'sub-1', taskId: 't1', taskType: 'weekly', taskTitle: '打电话', isSelfTask: false,
    description: '<img src=x onerror="bad()">', status: 'pending',
    submittedAt: new Date().toISOString(), reviewNote: '', rewardChopping: 5, rewardItems: [],
  }];
  h.admin._adminTasksForReview = [{ id: 't1', description: '<任务要求>', difficulty: 'A', rewardChopping: 5, rewardItems: [] }];
  h.admin._reviewFilter = 'pending';
  h.admin._renderReviewList();
  const list = h.nodes['review-list'].innerHTML;
  assert.doesNotMatch(list, /<img src=x/);
  assert.match(list, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/);
  assert.match(list, /&lt;任务要求&gt;/);
  assert.match(list, /已等待 0 分钟/);
  assert.match(list, /admin-review-reward/);
});

test('claimed submissions stay visible and the nav badge tracks pending work', () => {
  const h = harness();
  const submissions = [
    { id: 's1', status: 'pending', taskId: 't1', description: '', submittedAt: new Date().toISOString(), rewardItems: [] },
    { id: 's2', status: 'claimed', taskId: 't2', description: '', submittedAt: new Date().toISOString(), reviewNote: '', rewardItems: [] },
  ];
  h.admin._submissions = submissions;
  h.admin._adminTasksForReview = [];
  h.admin._reviewFilter = 'claimed';
  h.admin._renderReviewList();
  const list = h.nodes['review-list'].innerHTML;
  assert.match(list, /statusTag|claimed/);
  // 「已领取」不再和「已通过」混在一起，而是独立筛选，且单条记录仍然渲染
  assert.equal(list.split('<div class="task-card">').length - 1, 1);
  assert.match(app, /claimed: \['已领取', 'tag-status-claimed'\]/);
  assert.match(app, /filterReview\('claimed'\)/);

  h.admin.applyReviewBadge(submissions);
  assert.equal(h.nodes['admin-review-badge'].textContent, '1');
  assert.equal(h.nodes['admin-review-badge'].style.display, 'inline-flex');
  h.admin.applyReviewBadge([]);
  assert.equal(h.nodes['admin-review-badge'].style.display, 'none');
});

test('database helpers archive before deleting and tolerate a missing log table', async () => {
  const calls = [];
  const makeQuery = result => {
    const query = {
      update(payload) { calls.push(['update', payload]); return this; },
      delete() { calls.push(['delete']); return this; },
      insert(payload) { calls.push(['insert', payload]); return this; },
      select(...args) { calls.push(['select', ...args]); return this; },
      eq(...args) { calls.push(['eq', ...args]); return this; },
      order(...args) { calls.push(['order', ...args]); return this; },
      limit(...args) { calls.push(['limit', ...args]); return this; },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
    return query;
  };

  let result = { data: [{ id: 'task-1' }], error: null };
  const context = vm.createContext({
    dbClient: { from(table) { calls.push(['from', table]); return makeQuery(result); } },
    console: { error() {} },
  });
  vm.runInContext(`globalThis.DB = {${taskDbSource}}`, context);
  context.DB.playerRole = 'player_live';

  assert.equal(await context.DB.archiveTask('task-1'), true);
  assert.deepEqual(plain(calls.filter(call => call[0] === 'update')), [['update', { status: 'archived' }]]);
  assert.deepEqual(plain(calls.find(call => call[0] === 'from')), ['from', 'xiu_tasks']);

  calls.length = 0;
  assert.equal(await context.DB.deleteTask('task-1'), true);
  assert.deepEqual(plain(calls.filter(call => call[0] === 'eq')), [
    ['eq', 'id', 'task-1'], ['eq', 'audience_role', 'player_live'], ['eq', 'status', 'archived'],
  ]);

  calls.length = 0;
  result = { data: null, error: { message: 'relation "public.task_admin_logs" does not exist' } };
  assert.equal(await context.DB.logTaskAction({ action: 'create', taskTitle: 'x' }), false);
  assert.equal(context.DB._taskLogsAvailable, false);
  const logs = await context.DB.getTaskLogs(5);
  assert.deepEqual(plain(logs), { available: false, logs: [] });
  assert.equal(calls.filter(call => call[0] === 'from' && call[1] === 'task_admin_logs').length, 2);
});

test('migration v15 creates the audit log, allows archived status and is wired into the UI', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase-migration-v15.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.task_admin_logs/);
  assert.match(sql, /DISABLE ROW LEVEL SECURITY/);
  assert.match(sql, /CHECK \(status IN \('draft', 'published', 'archived'\)\)/);
  assert.match(app, /DB\.getTaskLogs/);
  assert.match(app, /_taskLifecycle/);
  assert.match(html, /id="admin-review-badge"/);
  assert.match(app, /id="admin-task-search"/);
});
