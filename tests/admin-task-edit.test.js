const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createOperationGuard } = require('../operation-guard');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const adminSource = app.slice(app.indexOf('const AdminView = {'), app.indexOf('\n// 初始化（登录时调用'));
const guardStart = app.indexOf('  async runLockedAction(');
const guardSource = app.slice(guardStart, app.indexOf('\n  modal(', guardStart));
const taskDbSource = app.slice(app.indexOf('  async getAllTasks('), app.indexOf('\n  // --- 任务提交 ---'));
const plain = value => JSON.parse(JSON.stringify(value));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function element(value = '') {
  return { value, style: {}, disabled: false, readOnly: false, isConnected: true, innerHTML: '', listeners: {}, rows: [],
    classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
    querySelectorAll() { return this.rows; }, addEventListener(type, callback) { this.listeners[type] = callback; } };
}
function draft(overrides = {}) {
  return { id: 'original-id', status: 'draft', taskType: 'theme', title: '原任务', description: '原描述', difficulty: 'A',
    rewardChopping: 0, rewardItems: [{ item_id: 'old_stone', quantity: 2 }], themeName: '未来活动',
    themeStart: '2026-10-01', themeEnd: '2026-10-07', sortOrder: 17, themeExtraReward: [{ item_id: '40001', quantity: 3 }], ...overrides };
}
function harness(tasks = [draft()], options = {}) {
  const state = { reads: [], writes: [], creates: [], toasts: [], modals: [], refreshes: [], statusWrites: [], rendered: '' };
  const main = element(), dashboard = element(), list = element();
  const stone = { id: '40001', name: '开工石', type: 4 };
  const context = vm.createContext({
    ITEMS: { '40001': stone, old_stone: stone }, OperationGuard: createOperationGuard(),
    escapeHtml, localDateStr: () => '2026-09-10', renderFeatureIcon: () => '', renderItemIcon: () => '', renderEmptyState: () => '',
    console: { error() {} }, Auth: { session: { id: 'admin-session' } }, Router: { currentAdminTab: 'task-manage' },
    DB: {
      async getAllTasks(...args) { state.reads.push(args); return options.read ? options.read() : tasks; },
      async updateDraftTask(id, payload) { state.writes.push({ id, payload }); return options.save ? options.save() : { ok: true }; },
      async createTask(payload) { state.creates.push(payload); return { id: 'created' }; },
      async updateTaskStatus(id, status) { state.statusWrites.push({ id, status }); return options.publish ? options.publish() : true; },
    },
    document: { getElementById: id => ({ 'admin-main': main, 'admin-dashboard': dashboard, 'admin-task-list': list })[id], querySelectorAll: () => [] },
    UI: { toast(message, type) { state.toasts.push({ message, type }); }, difficultyTag: () => '', taskTypeTag: () => '',
      modal(content, settings) {
        const fields = new Map([...(`${content}${settings.footer}`).matchAll(/id="([^"]+)"/g)].map(match => [match[1], element()]));
        for (const [id, value] of Object.entries({ 'new-task-type': 'weekly', 'new-task-diff': 'C', 'new-task-chopping': '3', 'new-task-status': 'draft' })) fields.get(id).value = value;
        const classes = new Set();
        const overlay = { isConnected: true, content, settings, fields,
          classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
          querySelectorAll: () => [...fields.values()], querySelector: selector => fields.get(selector.slice(1)) };
        state.modals.push(overlay); return overlay;
      }, closeModal(overlay) { overlay.isConnected = false; },
    },
  });
  vm.runInContext(`UI.runLockedAction=({${guardSource}}).runLockedAction;\n${adminSource}\nglobalThis.AdminView=AdminView;`, context);
  const admin = context.AdminView;
  const originalRender = admin.renderTaskManage.bind(admin);
  admin.renderTaskManage = async settings => { state.refreshes.push(settings); };
  admin._adminTasks = tasks;
  admin._adminTaskFilter = 'draft';
  admin._addRewardRow = (editor, reward) => {
    const select = element(reward.item_id), quantity = element(String(reward.quantity));
    editor.rows.push({ querySelector: selector => selector === '.admin-reward-item' ? select : quantity });
  };
  return { admin, state, context, main, dashboard, list, originalRender,
    field: (overlay, id) => overlay.fields.get(id),
    open: (id = 'original-id', control = element()) => admin.showEditTask(id, control),
    submit: overlay => overlay.fields.get('create-task-ok').listeners.click(),
  };
}

test('edit reloads the latest draft and prefills identity-independent fields and canonical reward selections', async () => {
  const h = harness([draft({ title: '<新标题> & "引号"' })]);
  h.admin._adminTasks = [draft({ title: '旧缓存标题' })];
  const overlay = await h.open();
  assert.deepEqual(plain(h.state.reads[0]), [null, { strict: true }]);
  assert.equal(overlay.settings.title, '编辑待发布任务');
  assert.equal(h.field(overlay, 'new-task-title').value, '<新标题> & "引号"');
  assert.equal(h.field(overlay, 'new-task-desc').value, '原描述');
  assert.equal(h.field(overlay, 'new-task-type').value, 'theme');
  assert.equal(h.field(overlay, 'new-task-diff').value, 'A');
  assert.equal(h.field(overlay, 'new-task-chopping').value, '0');
  assert.equal(h.field(overlay, 'new-task-theme').value, '未来活动');
  assert.equal(h.field(overlay, 'new-task-theme-start').value, '2026-10-01');
  assert.equal(h.field(overlay, 'new-task-theme-end').value, '2026-10-07');
  assert.deepEqual(plain(h.admin._readRewardItems(h.field(overlay, 'new-task-items')).items), [{ item_id: '40001', quantity: 2 }]);
  assert.match(overlay.content, /id="new-task-status" disabled/);
  assert.doesNotMatch(overlay.content, /value="published"/);
});

test('saving keeps the draft UUID, forces draft state and preserves the current filter without creating a new row', async () => {
  const h = harness(), overlay = await h.open();
  h.field(overlay, 'new-task-title').value = ' 修改后的任务 ';
  h.field(overlay, 'new-task-status').value = 'published';
  assert.equal((await h.submit(overlay)).value, true);
  assert.equal(h.state.writes.length, 1);
  const { id, payload } = h.state.writes[0];
  assert.equal(id, 'original-id');
  assert.equal(payload.title, '修改后的任务');
  assert.equal(payload.status, 'draft');
  assert.equal(payload.themeName, '未来活动');
  assert.equal(payload.themeStart, '2026-10-01');
  assert.equal('sortOrder' in payload, false);
  assert.equal(h.state.creates.length, 0);
  assert.equal(overlay.isConnected, false);
  assert.deepEqual(plain(h.state.refreshes), [{ preserveFilter: true }]);
  assert.match(h.state.toasts.at(-1).message, /仍在发布池/);
});

test('repeat open/save and publication clicks cannot overlap a pending edit', async () => {
  const reading = deferred(), saving = deferred();
  const h = harness([], { read: () => reading.promise, save: () => saving.promise });
  const control = element(), opening = h.open('original-id', control);
  assert.equal(await h.open('original-id', control), false);
  assert.equal(control.disabled, true);
  reading.resolve([draft()]);
  const overlay = await opening;
  assert.equal(await h.open(), overlay);
  const first = h.submit(overlay);
  assert.equal((await h.submit(overlay)).started, false);
  assert.equal((await h.admin.publishTask('original-id', element())).started, false);
  assert.equal(h.state.writes.length, 1);
  assert.equal(h.state.statusWrites.length, 0);
  saving.resolve({ ok: true });
  await first;
  await h.submit(overlay);
  assert.equal(h.state.writes.length, 1);
});

test('pending saves lock editable fields and closing controls, then restore their previous disabled states', async () => {
  const pending = deferred();
  const h = harness(undefined, { save: () => pending.promise });
  const overlay = await h.open();
  const title = h.field(overlay, 'new-task-title');
  const status = h.field(overlay, 'new-task-status');
  status.disabled = true;
  const save = h.submit(overlay);
  assert.equal(title.disabled, true);
  assert.equal(overlay.classList.contains('modal-locked'), true);
  assert.ok([...overlay.fields.values()].every(field => field.disabled));
  pending.resolve({ ok: false, code: 'save_failed' });
  await save;
  assert.equal(title.disabled, false);
  assert.equal(status.disabled, true);
  assert.equal(h.field(overlay, 'create-task-ok').disabled, false);
  assert.equal(overlay.classList.contains('modal-locked'), false);
});

for (const code of ['save_failed', 'state_changed', 'throw']) {
  test(`${code} keeps all edit input and allows retry after a safe failure`, async () => {
    let fail = true;
    const h = harness(undefined, { save() {
      if (!fail) return { ok: true };
      if (code === 'throw') throw new Error('offline');
      return { ok: false, code };
    } });
    const overlay = await h.open();
    h.field(overlay, 'new-task-title').value = '不能丢的修改';
    assert.equal((await h.submit(overlay)).value, false);
    assert.equal(overlay.isConnected, true);
    assert.equal(h.field(overlay, 'new-task-title').value, '不能丢的修改');
    assert.equal(h.field(overlay, 'create-task-ok').disabled, false);
    assert.equal(h.state.refreshes.length, 0);
    if (code === 'state_changed') assert.match(h.state.toasts.at(-1).message, /状态已变化/);
    fail = false;
    assert.equal((await h.submit(overlay)).value, true);
  });
}

test('published, removed, failed reads and delayed disconnected opens never show an editable stale task', async () => {
  for (const tasks of [[draft({ status: 'published' })], []]) {
    const h = harness(tasks);
    assert.equal(await h.open(), false);
    assert.equal(h.state.modals.length, 0);
    assert.match(h.state.toasts.at(-1).message, /状态已变化/);
  }
  const h = harness(undefined, { read() { throw new Error('network failure'); } });
  assert.equal(await h.open(), false);
  assert.equal(h.state.modals.length, 0);
  const pending = deferred(), late = harness(undefined, { read: () => pending.promise }), control = element();
  const opening = late.open('original-id', control);
  control.isConnected = false;
  pending.resolve([draft()]);
  assert.equal(await opening, false);
  assert.equal(late.state.modals.length, 0);
  const loggingOut = deferred(), session = harness(undefined, { read: () => loggingOut.promise });
  const sessionOpening = session.open();
  session.context.Auth.session = null;
  loggingOut.resolve([draft()]);
  assert.equal(await sessionOpening, false);
  assert.equal(session.state.modals.length, 0);
});

test('a theme draft can become a normal task and optional rewards can all be removed', async () => {
  const h = harness(), overlay = await h.open();
  h.field(overlay, 'new-task-type').value = 'daily';
  h.field(overlay, 'new-task-items').rows = [];
  await h.submit(overlay);
  assert.equal(h.state.writes[0].payload.taskType, 'daily');
  assert.equal(h.state.writes[0].payload.themeName, null);
  assert.equal(h.state.writes[0].payload.themeStart, null);
  assert.equal(h.state.writes[0].payload.themeEnd, null);
  assert.deepEqual(plain(h.state.writes[0].payload.rewardItems), []);
});

test('task management only offers edit for drafts and escapes edited task text', () => {
  const h = harness([draft({ title: '<changed>', description: '<script>bad()</script>', themeName: '<theme>' }), draft({ id: 'published-id', status: 'published' })]);
  h.admin._adminTaskFilter = 'all';
  h.admin._renderAdminTaskList();
  assert.match(h.list.innerHTML, /showEditTask\('original-id',this\)/);
  assert.doesNotMatch(h.list.innerHTML, /showEditTask\('published-id'/);
  assert.match(h.list.innerHTML, /&lt;changed&gt;/);
  assert.doesNotMatch(h.list.innerHTML, /<changed>|<script>|<theme>/);
});

test('list refresh preserves filters and ignores stale generations, sessions, hidden pages or navigation', async () => {
  const requests = [];
  const h = harness(undefined, { read() { const next = deferred(); requests.push(next); return next.promise; } });
  const first = h.originalRender({ preserveFilter: true });
  const second = h.originalRender({ preserveFilter: true });
  requests[1].resolve([draft({ title: 'newest' })]); await second;
  requests[0].resolve([draft({ title: 'stale' })]); await first;
  assert.equal(h.admin._adminTasks[0].title, 'newest');
  assert.equal(h.admin._adminTaskFilter, 'draft');
  for (const invalidate of [
    () => { h.context.Auth.session = { id: 'other' }; },
    () => { h.context.Router.currentAdminTab = 'review'; },
    () => { h.dashboard.style.display = 'none'; },
  ]) {
    h.context.Router.currentAdminTab = 'task-manage'; h.dashboard.style.display = '';
    const rendering = h.originalRender({ preserveFilter: true });
    invalidate(); requests.at(-1).resolve([draft({ title: 'should-not-render' })]); await rendering;
    assert.equal(h.admin._adminTasks[0].title, 'newest');
  }
});

test('database edit performs one conditional update and never changes identity, ordering, status or extra rewards', async () => {
  for (const result of [{ data: [{ id: 'original-id' }], error: null }, { data: [], error: null }, { data: null, error: { message: 'offline' } }]) {
    const calls = [];
    const query = { update(payload) { calls.push(['update', payload]); return this; },
      eq(...args) { calls.push(['eq', ...args]); return this; },
      select(...args) { calls.push(['select', ...args]); return Promise.resolve(result); } };
    const context = vm.createContext({ dbClient: { from(table) { calls.push(['from', table]); return query; } }, console: { error() {} } });
    vm.runInContext(`globalThis.DB = {${taskDbSource}}`, context);
    context.DB.playerRole = 'player';
    const outcome = await context.DB.updateDraftTask('original-id', draft({ status: 'published', id: 'new-id', sortOrder: 99 }));
    assert.deepEqual(calls.filter(call => call[0] === 'eq'), [
      ['eq', 'id', 'original-id'], ['eq', 'audience_role', 'player'], ['eq', 'status', 'draft'],
    ]);
    assert.deepEqual(calls.at(-1), ['select', 'id']);
    const written = calls.find(call => call[0] === 'update')[1];
    for (const field of ['id', 'sort_order', 'status', 'theme_extra_reward']) assert.equal(field in written, false);
    assert.equal(written.theme_name, '未来活动');
    assert.equal(calls.filter(call => call[0] === 'update').length, 1);
    assert.equal(outcome.ok, !result.error && result.data.length === 1);
    if (!outcome.ok) assert.equal(outcome.code, result.error ? 'save_failed' : 'state_changed');
  }
});

test('strict edit reads fail explicitly while existing list callers retain their empty-list fallback', async () => {
  const error = { message: 'offline' };
  const query = { select() { return this; }, eq() { return this; }, order() { return Promise.resolve({ data: null, error }); } };
  const context = vm.createContext({ dbClient: { from: () => query }, console: { error() {} } });
  vm.runInContext(`globalThis.DB = {${taskDbSource}}`, context);
  context.DB.playerRole = 'player';
  assert.deepEqual(plain(await context.DB.getAllTasks()), []);
  await assert.rejects(context.DB.getAllTasks(null, { strict: true }), failure => failure === error);
});
