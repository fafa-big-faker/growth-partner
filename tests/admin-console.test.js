const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createOperationGuard } = require('../operation-guard');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const adminSource = app.slice(app.indexOf('const AdminView = {'), app.indexOf('\n// 初始化（登录时调用'));
const routerSource = app.slice(app.indexOf('const Router = {'), app.indexOf('\n/* ================================================================\n   UI 工具'));
const guardStart = app.indexOf('  async runLockedAction(');
const guardSource = app.slice(guardStart, app.indexOf('\n  modal(', guardStart));
const plain = value => JSON.parse(JSON.stringify(value));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function element() {
  return {
    innerHTML: '', textContent: '', value: '', hidden: false, isConnected: true,
    style: {}, dataset: {}, attributes: {}, listeners: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
  };
}

function playerState(overrides = {}) {
  return {
    level: 11, exp: 4, choppingCount: 0, treeLevel: 1, treeRealm: 1, realmLevel: 1,
    axeId: '51002', axeInstanceId: 'w-equipped', balance: 25, totalWithdrawn: 0,
    coin: 170, signInMonth: '2026-09', signInDays: 10, shopPurchases: {},
    totalChops: 160, totalCoinEarned: 546, achievementClaims: ['1', '2'],
    themeRewardClaims: ['开学季'], ...overrides,
  };
}

function harness(overrides = {}) {
  const state = {
    toasts: [], statusWrites: [], reads: [], loadOrder: [],
    playerState: overrides.playerState === undefined ? playerState() : overrides.playerState,
    inventory: overrides.inventory || [],
    weapons: overrides.weapons || [],
    mails: overrides.mails || [],
    submissions: overrides.submissions || [],
    withdrawals: overrides.withdrawals || [],
  };
  const nodes = {
    'admin-main': element(),
    'admin-dashboard': element(),
    'admin-task-list': element(),
    'admin-review-badge': element(),
  };

  function track(name, value, delay) {
    state.reads.push(name);
    state.loadOrder.push(name);
    return delay === undefined ? value : new Promise(resolve => setTimeout(() => resolve(value), delay));
  }

  const context = vm.createContext({
    ITEMS: {
      '51002': { id: '51002', name: '光头强淘汰斧', type: 5, desc: '砍树用', skillIds: [] },
      '40001': { id: '40001', name: '开工石', type: 4 },
    },
    QUALITY: { 1: { name: '凡品', color: '#9e9e9e' } },
    REALMS: [{ level: 1, name: '小修士', maxAxeQuality: 2 }],
    TREE_LEVELS: { 1: { name: '灵木' } },
    TREE_REALMS: [{ level: 1, name: '一阶' }],
    getExpForLevel: () => 100,
    renderWeaponSkills: overrides.renderWeaponSkills || (() => '砍树返还 1 次'),
    OperationGuard: createOperationGuard(),
    escapeHtml,
    localDateStr: () => '2026-09-20',
    renderFeatureIcon: () => '', renderItemIcon: (id) => `<img data-item="${id}">`,
    renderEmptyState: (icon, text) => `<div class="empty-state">${text}</div>`,
    renderTaskRewardChips: () => '',
    GameDateTime: { formatShanghaiDate: value => String(value || '').slice(0, 10) },
    console: { error() {}, warn() {} },
    Auth: { session: overrides.session === undefined ? { id: 'admin', environment: 'live' } : overrides.session },
    Router: { currentAdminTab: overrides.tab || 'player-view' },
    document: {
      getElementById: id => nodes[id] || null,
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    DB: {
      playerRole: overrides.playerRole || 'player_live',
      async getPlayerState() { return track('state', state.playerState, overrides.delays?.state); },
      async getInventory() { return track('inventory', state.inventory, overrides.delays?.inventory); },
      async getWeaponInstances() { return track('weapons', state.weapons, overrides.delays?.weapons); },
      async getMails() { return track('mails', state.mails, overrides.delays?.mails); },
      async getSubmissions() { return track('submissions', state.submissions, overrides.delays?.submissions); },
      async getWithdrawals() { return track('withdrawals', state.withdrawals, overrides.delays?.withdrawals); },
      async getAllTasks() { return track('tasks', [], overrides.delays?.tasks); },
      async updateTaskStatus(id, status) { state.statusWrites.push({ id, status }); return true; },
      async logTaskAction() { return true; },
    },
    UI: {
      toast(message, type) { state.toasts.push({ message, type }); },
      modal() { return element(); },
      closeModal() {},
      confirm(message, onConfirm) { return onConfirm(); },
      statusTag: status => `<span class="tag">${status}</span>`,
      taskTypeTag: () => '', difficultyTag: () => '',
    },
  });
  vm.runInContext(`UI.runLockedAction=({${guardSource}}).runLockedAction;\n${adminSource}\nglobalThis.AdminView=AdminView;`, context);
  return { admin: context.AdminView, context, state, nodes };
}

test('查看玩家 shows the data the writer actually needs: coin, realm, totals and sign-ins', async () => {
  const h = harness({
    inventory: [{ itemId: '40001', quantity: 27 }, { itemId: '99999', quantity: 2 }],
    weapons: [
      { id: 'w-equipped', itemId: '51002', skillRolls: [] },
      { id: 'w-spare-1', itemId: '51002', skillRolls: [] },
      { id: 'w-spare-2', itemId: '51001', skillRolls: [] },
    ],
    mails: [{ id: 'm1', isRead: false, isClaimed: false, items: [{ item_id: '40001', quantity: 1 }] }],
    submissions: [{ id: 's1', status: 'claimed' }, { id: 's2', status: 'pending' }],
    withdrawals: [{ id: 'w1', status: 'pending' }],
  });
  await h.admin.renderPlayerView();
  const page = h.nodes['admin-main'].innerHTML;

  // 之前完全没展示的数据
  assert.match(page, /游戏币/);
  assert.match(page, />170</);
  assert.match(page, /小修士/);
  assert.match(page, /160/, '累计砍树');
  assert.match(page, /546/, '累计获得游戏币');
  assert.match(page, /本月累签/);
  assert.match(page, /1 封未读\/未领/);
  assert.match(page, /1 笔待处理/);
  assert.match(page, /待审核<\/td><td>1 条/);

  // 备用仙斧数量按“扣除已装备那一把”计算，且不再假设装备一定在列表第一位
  assert.match(page, /还有 2 把备用仙斧/);

  // 背包不再只显示 20 个后静默截断；道具表里没有的 ID 会明确标出来
  assert.match(page, /开工石/);
  assert.match(page, /admin-inventory-unknown/);
  assert.match(page, /99999/);
  assert.doesNotMatch(page, /slice\(0, 20\)/);
});

test('spare axe count does not under-report when nothing is equipped yet', async () => {
  const h = harness({
    playerState: playerState({ axeInstanceId: null, axeId: '51002' }),
    weapons: [{ id: 'w-1', itemId: '51002', skillRolls: [] }],
  });
  await h.admin.renderPlayerView();
  assert.match(h.nodes['admin-main'].innerHTML, /还有 1 把备用仙斧/);
});

test('查看玩家 survives a missing axe definition and shows a refresh control', async () => {
  const h = harness({ playerState: playerState({ axeId: 'no-such-axe', axeInstanceId: null }) });
  await h.admin.renderPlayerView();
  const page = h.nodes['admin-main'].innerHTML;
  assert.match(page, /refreshPlayerView/);
  assert.doesNotMatch(page, /undefined<|>undefined/);
});

test('viewing a player costs one parallel round trip, not four sequential ones', async () => {
  const h = harness({
    delays: { state: 40, inventory: 40, weapons: 40, mails: 40, submissions: 40, withdrawals: 40 },
    inventory: [], weapons: [], mails: [], submissions: [], withdrawals: [],
  });
  const started = Date.now();
  await h.admin.renderPlayerView();
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 150, `expected parallel reads (~40ms), took ${elapsed}ms`);
  assert.deepEqual([...h.state.loadOrder].sort(),
    ['inventory', 'mails', 'state', 'submissions', 'weapons', 'withdrawals']);
});

test('a slow admin page never overwrites the tab the user already switched to', async () => {
  const h = harness({ tab: 'player-view' });
  const slow = h.admin.renderPlayerView({ navVersion: 1 });
  // 用户在读取期间切到了 GM
  h.context.Router.currentAdminTab = 'gm';
  h.context.Router._adminNavVersion = 2;
  await slow;
  assert.equal(h.nodes['admin-main'].innerHTML, '', 'stale render must not paint');
});

test('renderReview also refuses to paint after the admin leaves the tab', async () => {
  const h = harness({ tab: 'review', submissions: [], inventory: [], weapons: [], mails: [] });
  const pending = h.admin.renderReview({ navVersion: 1 });
  h.context.Router.currentAdminTab = 'task-manage';
  h.context.Router._adminNavVersion = 2;
  await pending;
  assert.equal(h.nodes['admin-main'].innerHTML, '');
});

test('the admin router paints a skeleton before awaiting the database', async () => {
  const h = harness();
  const router = vm.runInNewContext(`${routerSource}\nglobalThis.Router = Router;`, {
    AdminView: h.admin,
    AudioManager: { playEffect: async () => true },
    document: {
      getElementById: id => h.nodes[id] || null,
      querySelectorAll: () => [],
    },
  });
  const pending = router.adminTab('player-view');
  // 同步阶段就应该已经画出骨架，而不是等数据库
  assert.match(h.nodes['admin-main'].innerHTML, /admin-skeleton/);
  assert.equal(h.nodes['admin-main'].attributes['aria-busy'], 'true');
  await pending;
  assert.match(h.nodes['admin-main'].innerHTML, /修行进度/);
  assert.equal(h.nodes['admin-main'].attributes['aria-busy'], undefined);
  assert.equal(router.currentAdminTab, 'player-view');

  // AdminView 通过它所在作用域里的 Router 判定过期；把真实实现接回去再验证
  h.context.Router.currentAdminTab = router.currentAdminTab;
  h.context.Router._adminNavVersion = router._adminNavVersion;
  h.context.Router.isCurrentAdminRender = (tab, version) => router.isCurrentAdminRender(tab, version);
  assert.equal(h.admin._isCurrentAdminTab('player-view', router._adminNavVersion), true);
  assert.equal(h.admin._isCurrentAdminTab('player-view', router._adminNavVersion - 1), false);
  assert.equal(h.admin._isCurrentAdminTab('gm', router._adminNavVersion), false);
});

test('斧技文案只放行品质配色标签，其余内容一律转义', () => {
  const h = harness();
  const raw = '每次砍树时若抽到<span class="buff-value buff-quality-1">凡品</span>'
    + '的奖励，有<span class="buff-value buff-quality-5">22.44%</span>的概率使其掉落量×'
    + '<span class="buff-value buff-quality-5">3</span>倍';
  const html = h.admin._skillTextHtml(raw);
  assert.match(html, /<span class="buff-value buff-quality-1">凡品<\/span>/);
  assert.match(html, /<span class="buff-value buff-quality-5">22\.44%<\/span>/);
  assert.doesNotMatch(html, /&lt;span/);

  // 其它标签和危险属性必须被转义，不能被当成 HTML 执行
  const attack = '<img src=x onerror="bad()"><span class="buff-value" onclick="bad()">x</span>';
  const safe = h.admin._skillTextHtml(attack);
  // 危险的标签 / 属性只允许以转义后的纯文本出现，不能留下可执行标记
  assert.doesNotMatch(safe, /<img/);
  assert.doesNotMatch(safe, /<span[^>]*(onclick|onerror)/i);
  assert.doesNotMatch(safe, /class="buff-value"[^>]*onclick/);
  assert.match(safe, /&lt;img/);
  assert.match(safe, /onerror=&quot;bad\(\)&quot;/);
  // 没有配对放行的 <span> 时，不留下多余的闭合标签
  assert.equal(safe.match(/<\/span>/g), null);
});

test('axe skill text is rendered as coloured text, not as visible markup', async () => {
  const h = harness({
    weapons: [{ id: 'w-equipped', itemId: '51002', skillRolls: [] }],
    renderWeaponSkills: () => '有<span class="buff-value buff-quality-3">珍品</span>的概率翻倍',
  });
  await h.admin.renderPlayerView();
  const page = h.nodes['admin-main'].innerHTML;
  // 之前这里会显示成 &lt;span class=&quot;buff-value...&gt; 一串乱码
  assert.doesNotMatch(page, /&lt;span class=&quot;buff-value/);
  assert.match(page, /<span class="buff-value buff-quality-3">珍品<\/span>/);
});

test('仙树等级名和灵阶名相同时不重复显示', () => {
  const h = harness();
  assert.equal(h.admin._treeProgressText({ name: '仙树·灵阶15' }, { name: '仙树·灵阶15' }, { treeLevel: 15 }),
    'Lv.15 · 仙树·灵阶15');
  assert.equal(h.admin._treeProgressText({ name: '灵木' }, { name: '一阶' }, { treeLevel: 3 }),
    'Lv.3 · 灵木 · 一阶');
  assert.equal(h.admin._treeProgressText(null, null, {}), 'Lv.0');
});

test('admin tab headers and the loading skeleton are styled and accessible', () => {
  assert.match(css, /\.admin-skeleton-card/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,200}admin-skeleton/);
  assert.match(css, /\.stats-row-4/);
  assert.match(css, /\.admin-inventory-grid/);
  assert.match(css, /\.admin-env-live/);
  // 骨架屏用的 class 必须真的存在于样式表，否则会出现空白页
  for (const cls of ['admin-skeleton', 'admin-skeleton-card', 'admin-player-bar', 'admin-exp-track']) {
    assert.ok(css.includes(`.${cls}`), `missing style for .${cls}`);
  }
  assert.match(app, /paintAdminLoading/);
  assert.match(app, /_adminPageHeader/);
});
