const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createOperationGuard } = require('../operation-guard.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const adminStart = app.indexOf('const AdminView = {');
const adminEnd = app.indexOf('\n// 初始化（登录时调用', adminStart);
assert.ok(adminStart >= 0 && adminEnd > adminStart);
const guardStart = app.indexOf('  async runLockedAction(');
const guardEnd = app.indexOf('\n  modal(', guardStart);
assert.ok(guardStart >= 0 && guardEnd > guardStart);

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function element(value = '') {
  return {
    value, style: {}, disabled: false, readOnly: false, isConnected: true,
    innerHTML: '创建', textContent: '创建', attributes: {}, listeners: {},
    rewardRows: [],
    querySelectorAll() { return this.rewardRows; },
    setAttribute(name, content) { this.attributes[name] = content; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
  };
}

function themeTask(overrides = {}) {
  return {
    id: 'theme-task', taskType: 'theme', status: 'published',
    themeName: '开学季', themeStart: '2026-09-01', themeEnd: '2026-09-30',
    ...overrides,
  };
}

function harness(tasks = [], overrides = {}) {
  const state = { today: '2026-09-10', reads: 0, writes: [], toasts: [], modals: [], refreshes: 0 };
  const UI = {
    toast(message, type) { state.toasts.push({ message, type }); },
    modal(content, options) {
      const elements = new Map();
      for (const match of (content + options.footer).matchAll(/id="([^"]+)"/g)) {
        elements.set(match[1], element());
      }
      const defaults = { 'new-task-type': 'weekly', 'new-task-diff': 'C', 'new-task-chopping': '3', 'new-task-status': 'draft' };
      for (const [id, value] of Object.entries(defaults)) elements.get(id).value = value;
      const classes = new Set();
      const overlay = {
        isConnected: true, content, options, elements,
        classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
        querySelectorAll() { return [...elements.values()]; },
        querySelector(selector) { return elements.get(selector.slice(1)) || null; },
      };
      state.modals.push(overlay);
      return overlay;
    },
    closeModal(overlay) {
      overlay.isConnected = false;
      for (const field of overlay.elements.values()) field.isConnected = false;
    },
  };
  const context = vm.createContext({
    UI,
    DB: {
      async getAllTasks() { state.reads += 1; return overrides.getAllTasks ? overrides.getAllTasks() : tasks; },
      async createTask(payload) {
        state.writes.push(payload);
        return overrides.createTask ? overrides.createTask(payload) : { id: 'new-task' };
      },
    },
    ITEMS: { '40001': { id: '40001', name: '锻造石', type: 4 }, '20001': { id: '20001', name: '铜珠', type: 2 } },
    OperationGuard: createOperationGuard(),
    localDateStr: () => state.today,
    escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    document: {
      getElementById() { throw new Error('Task form fields must be read from their own overlay'); },
      querySelector() { return state.modals.at(-1) || null; },
    },
    console: { error() {} },
  });
  vm.runInContext(`UI.runLockedAction = ({${app.slice(guardStart, guardEnd)}}).runLockedAction;\n${app.slice(adminStart, adminEnd)}\nglobalThis.AdminView = AdminView;`, context);
  const admin = context.AdminView;
  admin._adminTasks = tasks;
  admin.renderTaskManage = async () => { state.refreshes += 1; };
  return {
    admin, state,
    field: (overlay, id) => overlay.querySelector(`#${id}`),
    async open() { return admin.showCreateTask(element()); },
    submit: overlay => overlay.querySelector('#create-task-ok').listeners.click(),
    rewards(overlay, entries) {
      overlay.querySelector('#new-task-items').rewardRows = entries.map(([itemId, quantity]) => ({
        querySelector(selector) { return element(selector === '.admin-reward-item' ? itemId : String(quantity)); },
      }));
    },
  };
}

function asPlain(value) { return JSON.parse(JSON.stringify(value)); }

test('ongoing published themes use inclusive local dates and are grouped without personal completion state', () => {
  const h = harness();
  const result = h.admin._getOngoingTaskThemes([
    themeTask({ id: 'done', submissionStatus: 'claimed' }),
    themeTask({ id: 'duplicate', themeEnd: '2026-10-01' }),
    themeTask({ themeName: '今天开始', themeStart: '2026-09-10' }),
    themeTask({ themeName: '今天结束', themeEnd: '2026-09-10' }),
    themeTask({ themeName: '过期', themeEnd: '2026-09-09' }),
    themeTask({ themeName: '将来', themeStart: '2026-09-11' }),
    themeTask({ themeName: '草稿', status: 'draft' }),
    themeTask({ themeName: '普通任务', taskType: 'weekly' }),
    themeTask({ themeName: null }),
    themeTask({ themeName: '缺日期', themeEnd: null }),
    themeTask({ themeName: '__proto__' }),
  ]);
  assert.equal(result.length, 4);
  assert.equal(result[0].name, '今天开始');
  const existing = result.find(item => item.name === '开学季');
  assert.deepEqual([existing.name, existing.start, existing.end], ['开学季', '2026-09-01', '2026-10-01']);
  assert.ok(result.some(item => item.name === '今天结束'));
  assert.ok(result.some(item => item.name === '__proto__'));
});

test('same-name past and future periods do not turn the gap between them into an ongoing theme', () => {
  const h = harness();
  const result = h.admin._getOngoingTaskThemes([
    themeTask({ themeStart: '2026-09-01', themeEnd: '2026-09-03' }),
    themeTask({ themeStart: '2026-09-20', themeEnd: '2026-09-30' }),
    themeTask({ status: 'draft', themeStart: '2026-08-01', themeEnd: '2026-12-31' }),
  ]);
  assert.equal(result.length, 0);
});

test('an actually active row enables its theme and inherits the player group dates without draft extensions', () => {
  const h = harness();
  const result = h.admin._getOngoingTaskThemes([
    themeTask({ themeStart: '2026-09-01', themeEnd: '2026-09-03' }),
    themeTask({ themeStart: '2026-09-10', themeEnd: '2026-09-11' }),
    themeTask({ themeStart: '2026-09-20', themeEnd: '2026-09-30' }),
    themeTask({ status: 'draft', themeStart: '2026-08-01', themeEnd: '2026-12-31' }),
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual([result[0].name, result[0].start, result[0].end], ['开学季', '2026-09-01', '2026-09-30']);
});

test('opening refreshes themes once, locks repeated clicks and reuses the open form', async () => {
  const loading = deferred();
  const h = harness([], { getAllTasks: () => loading.promise });
  const control = element();
  const first = h.admin.showCreateTask(control);
  assert.equal(control.disabled, true);
  assert.equal(await h.admin.showCreateTask(control), false);
  assert.equal(h.state.reads, 1);
  loading.resolve([themeTask()]);
  const overlay = await first;
  assert.equal(control.disabled, false);
  assert.equal(h.state.modals.length, 1);
  assert.equal(await h.admin.showCreateTask(control), overlay);
  assert.equal(h.state.reads, 1);
  assert.match(overlay.content, /开学季.*进行中/);
});

test('a delayed form does not appear after navigation removes the opening button', async () => {
  const loading = deferred();
  const h = harness([], { getAllTasks: () => loading.promise });
  const control = element();
  const opening = h.admin.showCreateTask(control);
  control.isConnected = false;
  loading.resolve([themeTask()]);
  assert.equal(await opening, false);
  assert.equal(h.state.modals.length, 0);
});

test('a thrown theme read unlocks the opening control and permits retry', async () => {
  let fail = true;
  const h = harness([], { getAllTasks: async () => {
    if (fail) throw new Error('mock read failure');
    return [themeTask()];
  } });
  const control = element();
  assert.equal(await h.admin.showCreateTask(control), false);
  assert.equal(control.disabled, false);
  assert.equal(h.state.modals.length, 0);
  fail = false;
  assert.ok(await h.admin.showCreateTask(control));
  assert.equal(h.state.reads, 2);
  assert.equal(h.state.modals.length, 1);
});

test('theme choices escape stored names and wire the AdminView handlers', async () => {
  const h = harness([themeTask({ themeName: '<img src=x onerror="bad()"> & 秋' })]);
  const overlay = await h.open();
  assert.match(overlay.content, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt; &amp; 秋/);
  assert.doesNotMatch(overlay.content, /<img src=x/);
  assert.match(overlay.content, /AdminView\._onCreateTaskTypeChange/);
  assert.match(overlay.content, /AdminView\._onCreateTaskThemeChange/);
  assert.doesNotMatch(overlay.content, /PlayerView\._onCreateTaskTypeChange/);
  assert.equal(h.field(overlay, 'new-task-theme-source').value, '');
  assert.equal(h.field(overlay, 'new-task-theme-box').style.display, 'none');
  h.field(overlay, 'new-task-type').value = 'theme';
  h.admin._onCreateTaskTypeChange(overlay);
  assert.equal(h.field(overlay, 'new-task-theme-box').style.display, '');
  assert.equal(h.field(overlay, 'theme-required-hint').style.display, 'inline');
});

test('selecting an ongoing theme inherits dates and switching back restores the new-theme draft', async () => {
  const h = harness([themeTask(), themeTask({ themeName: '迎新', themeStart: '2026-09-10', themeEnd: '2026-09-20' })]);
  const overlay = await h.open();
  const ids = ['new-task-theme', 'new-task-theme-start', 'new-task-theme-end'];
  const draft = ['中秋', '2026-09-25', '2026-09-28'];
  ids.forEach((id, index) => { h.field(overlay, id).value = draft[index]; });
  h.field(overlay, 'new-task-theme-source').value = '0';
  h.admin._onCreateTaskThemeChange(overlay);
  assert.deepEqual(ids.map(id => h.field(overlay, id).value), ['迎新', '2026-09-10', '2026-09-20']);
  assert.ok(ids.every(id => h.field(overlay, id).readOnly));
  h.field(overlay, 'new-task-theme-source').value = '1';
  h.admin._onCreateTaskThemeChange(overlay);
  assert.deepEqual(ids.map(id => h.field(overlay, id).value), ['开学季', '2026-09-01', '2026-09-30']);
  h.field(overlay, 'new-task-theme-source').value = '';
  h.admin._onCreateTaskThemeChange(overlay);
  assert.deepEqual(ids.map(id => h.field(overlay, id).value), draft);
  assert.ok(ids.every(id => !h.field(overlay, id).readOnly));
});

test('appending saves the original theme identity and rewards exactly once after database success', async () => {
  const saving = deferred();
  const h = harness([themeTask()], { createTask: () => saving.promise });
  const overlay = await h.open();
  const values = {
    'new-task-type': 'theme', 'new-task-title': ' 一起吃饭 ', 'new-task-desc': ' 约室友共进午餐 ',
    'new-task-diff': 'B', 'new-task-chopping': '5',
    'new-task-status': 'published', 'new-task-theme-source': '0',
    'new-task-theme': '不应覆盖已有主题', 'new-task-theme-start': '2000-01-01', 'new-task-theme-end': '2099-12-31',
  };
  for (const [id, value] of Object.entries(values)) h.field(overlay, id).value = value;
  h.rewards(overlay, [['40001', 1], ['20001', 1], ['40001', 1]]);
  const first = h.submit(overlay);
  assert.equal(h.field(overlay, 'create-task-ok').disabled, true);
  assert.equal((await h.submit(overlay)).started, false);
  assert.equal(h.state.writes.length, 1);
  assert.equal(h.state.toasts.length, 0);
  assert.equal(overlay.isConnected, true);
  assert.deepEqual(asPlain(h.state.writes[0]), {
    taskType: 'theme', title: '一起吃饭', description: '约室友共进午餐', difficulty: 'B',
    rewardChopping: 5, rewardItems: [{ item_id: '40001', quantity: 2 }, { item_id: '20001', quantity: 1 }],
    status: 'published', themeName: '开学季', themeStart: '2026-09-01', themeEnd: '2026-09-30', sortOrder: 1,
  });
  saving.resolve({ id: 'created' });
  assert.equal((await first).value, true);
  assert.equal(overlay.isConnected, false);
  assert.equal(h.state.refreshes, 1);
  assert.equal(h.state.toasts.filter(toast => toast.type === 'success').length, 1);
  await h.submit(overlay);
  assert.equal(h.state.writes.length, 1);
});

test('draft publication and new theme creation retain the entered values', async () => {
  const h = harness();
  const overlay = await h.open();
  assert.match(overlay.content, /暂无可复用主题/);
  for (const [id, value] of Object.entries({
    'new-task-type': 'theme', 'new-task-title': '赏月', 'new-task-theme': ' 中秋 ',
    'new-task-theme-start': '2026-09-25', 'new-task-theme-end': '2026-09-28',
  })) h.field(overlay, id).value = value;
  await h.submit(overlay);
  assert.equal(h.state.writes[0].status, 'draft');
  assert.equal(h.state.writes[0].themeName, '中秋');
  assert.equal(h.state.writes[0].themeStart, '2026-09-25');
  assert.equal(h.state.writes[0].themeEnd, '2026-09-28');
});

for (const taskType of ['weekly', 'daily']) {
  test(`${taskType} creation clears theme metadata even when a theme was selected`, async () => {
    const h = harness([themeTask()]);
    const overlay = await h.open();
    h.field(overlay, 'new-task-theme-source').value = '0';
    h.admin._onCreateTaskThemeChange(overlay);
    h.field(overlay, 'new-task-type').value = taskType;
    h.field(overlay, 'new-task-title').value = '普通任务';
    await h.submit(overlay);
    assert.equal(h.state.writes[0].taskType, taskType);
    assert.equal(h.state.writes[0].themeName, null);
    assert.equal(h.state.writes[0].themeStart, null);
    assert.equal(h.state.writes[0].themeEnd, null);
  });
}

for (const mode of ['null', 'throw']) {
  test(`${mode} database failure keeps form content and allows a safe retry`, async () => {
    let fail = true;
    const h = harness([], { createTask: async () => {
      if (!fail) return { id: 'created' };
      if (mode === 'throw') throw new Error('mock failure');
      return null;
    } });
    const overlay = await h.open();
    h.field(overlay, 'new-task-title').value = '保留我的任务';
    h.rewards(overlay, [['40001', 2], ['20001', 3]]);
    assert.equal((await h.submit(overlay)).value, false);
    assert.equal(overlay.isConnected, true);
    assert.equal(h.field(overlay, 'create-task-ok').disabled, false);
    assert.equal(h.field(overlay, 'new-task-title').value, '保留我的任务');
    assert.deepEqual(asPlain(h.admin._readRewardItems(h.field(overlay, 'new-task-items')).items), [
      { item_id: '40001', quantity: 2 }, { item_id: '20001', quantity: 3 },
    ]);
    assert.equal(h.state.refreshes, 0);
    assert.equal(h.state.toasts.some(toast => toast.type === 'success'), false);
    fail = false;
    assert.equal((await h.submit(overlay)).value, true);
    assert.equal(h.state.writes.length, 2);
  });
}

test('required title, theme and date order validation runs before saving', async () => {
  const cases = [
    [{}, '请填写任务名称'],
    [{ 'new-task-title': '任务' }, '请填写主题名称'],
    [{ 'new-task-title': '任务', 'new-task-theme': '主题' }, '请设置主题活动的起止日期'],
    [{ 'new-task-title': '任务', 'new-task-theme': '主题', 'new-task-theme-start': '2026-09-30', 'new-task-theme-end': '2026-09-01' }, '结束日期不能早于开始日期'],
  ];
  for (const [values, message] of cases) {
    const h = harness();
    const overlay = await h.open();
    h.field(overlay, 'new-task-type').value = 'theme';
    for (const [id, value] of Object.entries(values)) h.field(overlay, id).value = value;
    await h.submit(overlay);
    assert.equal(h.state.writes.length, 0);
    assert.equal(h.state.toasts.at(-1).message, message);
    assert.equal(overlay.isConnected, true);
    assert.equal(h.field(overlay, 'create-task-ok').disabled, false);
  }
});

test('a selected theme that expires while the form is open cannot receive a task', async () => {
  const h = harness([themeTask({ themeEnd: '2026-09-10' })]);
  const overlay = await h.open();
  h.field(overlay, 'new-task-type').value = 'theme';
  h.field(overlay, 'new-task-title').value = '活动任务';
  h.field(overlay, 'new-task-theme-source').value = '0';
  h.state.today = '2026-09-11';
  assert.equal((await h.submit(overlay)).value, false);
  assert.equal(h.state.writes.length, 0);
  assert.match(h.state.toasts.at(-1).message, /已不在活动期内/);
  assert.equal(overlay.isConnected, true);
});

test('an open form cannot append during a gap between same-name theme periods', async () => {
  const h = harness([
    themeTask({ themeEnd: '2026-09-10' }),
    themeTask({ themeStart: '2026-09-20', themeEnd: '2026-09-30' }),
  ]);
  const overlay = await h.open();
  h.field(overlay, 'new-task-type').value = 'theme';
  h.field(overlay, 'new-task-title').value = '活动任务';
  h.field(overlay, 'new-task-theme-source').value = '0';
  h.state.today = '2026-09-11';
  assert.equal((await h.submit(overlay)).value, false);
  assert.equal(h.state.writes.length, 0);
  assert.match(h.state.toasts.at(-1).message, /已不在活动期内/);
});

test('invalid selected rewards and chopping quantities stop publication before any database write', async () => {
  const cases = [
    { rewards: [['', 1]], message: /选择道具/ },
    { rewards: [['unknown', 1]], message: /选择道具/ },
    { rewards: [['40001', 0]], message: /正整数/ },
    { rewards: [['40001', -1]], message: /正整数/ },
    { rewards: [['40001', '1.5']], message: /正整数/ },
    { rewards: [['40001', '']], message: /正整数/ },
    { rewards: [['40001', Number.MAX_SAFE_INTEGER], ['40001', 1]], message: /总数过大/ },
    { chopping: '-1', message: /非负整数/ },
    { chopping: '2.5', message: /非负整数/ },
  ];
  for (const scenario of cases) {
    const h = harness(), overlay = await h.open();
    h.field(overlay, 'new-task-title').value = '任务';
    if (scenario.rewards) h.rewards(overlay, scenario.rewards);
    if (scenario.chopping) h.field(overlay, 'new-task-chopping').value = scenario.chopping;
    assert.equal((await h.submit(overlay)).value, false);
    assert.equal(h.state.writes.length, 0);
    assert.match(h.state.toasts.at(-1).message, scenario.message);
    assert.equal(overlay.isConnected, true);
    assert.equal(h.field(overlay, 'create-task-ok').disabled, false);
  }
});

test('an empty optional reward list creates a task with only its separate chopping reward', async () => {
  const h = harness(), overlay = await h.open();
  h.field(overlay, 'new-task-title').value = '只有砍树次数';
  await h.submit(overlay);
  assert.deepEqual(asPlain(h.state.writes[0].rewardItems), []);
  assert.equal(h.state.writes[0].rewardChopping, 3);
  assert.doesNotMatch(overlay.content, /道具ID|40001:2/);
});
