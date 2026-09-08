const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'ink-pages.css'), 'utf8');

function method(signature) {
  const start = app.indexOf(`  ${signature}`);
  assert.notEqual(start, -1);
  const end = app.indexOf('\n  },', start);
  return app.slice(start, end + 5);
}

function viewFor(signature, context = {}) {
  return vm.runInNewContext(`({${method(signature)}})`, context);
}

test('inactive theme is a short text row and active themes are unframed groups', () => {
  const view = viewFor('_themeSectionHtml()');
  view._getActiveTheme = () => null;
  const html = view._themeSectionHtml();
  assert.match(html, /theme-idle/);
  assert.match(html, /待开启/);
  assert.doesNotMatch(html, /<img|theme-card|theme-soon|尽情期待/);
  assert.match(method('_themeSectionHtml()'), /theme-section-active/);
  assert.doesNotMatch(method('_renderTaskList()'), /linear-gradient|#7b1fa2|#9c27b0/);
});

test('task shell preserves filter and native page position across cached refresh', async () => {
  const page = { scrollTop: 318 };
  const main = {
    scrollTop: 48,
    querySelector: () => true,
    set innerHTML(value) { this.html = value; this.scrollTop = 0; page.scrollTop = 0; },
  };
  const view = viewFor('async renderTasks(version', {
    document: { getElementById: () => main, scrollingElement: page },
    Router: { _playerRenderVersion: 1, isCurrentPlayerRender: () => true },
    renderFeatureIcon: () => '<img>',
  });
  view.currentTaskFilter = 'weekly';
  view._taskCache = { peek: () => ({ dailyTasks: [] }) };
  view._applyTaskData = () => {};
  view._renderTaskList = () => {};
  view._loadTaskData = async () => ({});
  await view.renderTasks();
  assert.equal(view.currentTaskFilter, 'weekly');
  assert.match(main.html, /filter-chip active[^>]*data-filter="weekly" aria-pressed="true"/);
  assert.equal(main.scrollTop, 48);
  assert.equal(page.scrollTop, 318);
});

test('task reward refresh restores both possible native scroll hosts without reordering', () => {
  const main = { scrollTop: 80 };
  const page = { scrollTop: 240 };
  const list = { set innerHTML(value) { this.html = value; main.scrollTop = 0; page.scrollTop = 0; } };
  const theme = { innerHTML: '' };
  const view = viewFor('_renderTaskList()', {
    document: { scrollingElement: page, getElementById: id => ({ 'task-list': list, 'theme-section': theme, 'player-main': main }[id]) },
    renderFeatureIcon: () => '',
  });
  Object.assign(view, {
    currentTaskFilter: 'weekly', _submissions: [],
    _weeklyTasks: [{ id: 'b' }, { id: 'a' }],
    _themeSectionHtml: () => '', _renderTaskCard: task => task.id,
  });
  view._renderTaskList();
  assert.ok(list.html.endsWith('ba'));
  assert.equal(main.scrollTop, 80);
  assert.equal(page.scrollTop, 240);
});

test('task and self-submitted rows retain reward content and claim callbacks', () => {
  const context = {
    UI: { difficultyTag: () => '', taskTypeTag: () => '', statusTag: () => '' },
    escapeHtml: value => String(value).replaceAll('<', '&lt;'),
    renderTaskRewardChips: () => '<span>石头 ×2</span>',
  };
  const fixed = viewFor('_renderTaskCard(task', context);
  const self = viewFor('_renderSelfSubCard(sub', context);
  const fixedHtml = fixed._renderTaskCard({ id: 'task-1', title: '拜访', description: '<测试>' }, 'approved', 'weekly');
  const selfHtml = self._renderSelfSubCard({ id: 'self-1', status: 'approved', selfTitle: '问候' });
  for (const html of [fixedHtml, selfHtml]) {
    assert.match(html, /task-note-footer/);
    assert.match(html, /石头 ×2/);
  }
  assert.match(fixedHtml, /claimTaskReward\('task-1',this\)/);
  assert.match(selfHtml, /claimSubmissionReward\('self-1',this\)/);
  assert.match(fixedHtml, /&lt;测试>/);
  assert.match(method('async _claimStoredSubmissionReward'), /UI\.runLockedAction/);
  assert.match(method('buyShopItem(shopId'), /UI\.runLockedAction/);
  assert.match(method('doWithdraw(button)'), /UI\.runLockedAction/);
});

test('reward shell separates RMB account and coins with only one lazy records entry', () => {
  const render = method('async renderReward(version');
  assert.match(render, /aria-label="人民币账户"/);
  assert.match(render, /shop-coin-balance/);
  assert.equal((render.match(/showWithdrawRecords\(\)/g) || []).length, 1);
  assert.doesNotMatch(render, /id="withdraw-list"|await this\._loadWithdrawals/);
  assert.match(method('_renderShop()'), /escapeHtml\(item\.description/);
  assert.match(method('_renderShop()'), /PlayerView\.buyShopItem\(\$\{item\.shopId\},this\)/);
});

test('withdrawal records paint immediately, suppress repeats and ignore a closed modal', async () => {
  let resolve;
  let opens = 0;
  let paints = 0;
  let skeletons = 0;
  const deferred = new Promise(done => { resolve = done; });
  const container = {};
  const overlay = { isConnected: true, querySelector: () => container };
  const view = viewFor('async showWithdrawRecords()', {
    UI: { modal: () => { opens += 1; return overlay; }, toast: () => {} },
  });
  view._withdrawalCache = { peek: () => null };
  view._loadWithdrawals = () => deferred;
  view._renderWithdrawList = () => { paints += 1; };
  view._renderWithdrawSkeleton = () => { skeletons += 1; };
  const first = view.showWithdrawRecords();
  const second = view.showWithdrawRecords();
  assert.equal(opens, 1);
  assert.equal(skeletons, 1);
  overlay.isConnected = false;
  resolve([]);
  await Promise.all([first, second]);
  assert.equal(paints, 0);
});

test('mobile goods keep full descriptions and controls use existing art', () => {
  assert.match(css, /\.shop-description\s*\{[^}]*display: block[^}]*overflow: visible[^}]*-webkit-line-clamp: unset/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.shop-action\s*\{ grid-column: 2; grid-row: 2;/);
  assert.match(css, /assets\/runtime\/v3\/ui\/button-primary\.webp/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /linear-gradient|backdrop-filter/);
});
