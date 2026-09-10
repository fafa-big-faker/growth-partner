const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function fixture({ role = 'player', environment = 'live', totalChops = 0, count = 10 } = {}) {
  const method = name => {
    const start = app.indexOf(`  ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    const end = app.indexOf('\n  },', start);
    return app.slice(start, end + 4);
  };
  const starts = [], toasts = [];
  const toggle = { checked: true };
  const target = { disabled: false };
  const dashboard = { style: { display: 'flex' } };
  const state = {
    Auth: { session: { role, environment, playerRole: environment === 'test' ? 'player' : 'player_live' } },
    DB: { playerRole: environment === 'test' ? 'player' : 'player_live' },
    Game: { state: { totalChops, choppingCount: count } },
    Router: { currentPlayerTab: 'cultivate' },
    UI: { toast: (...args) => toasts.push(args) },
    OperationGuard: { isBusy: () => false },
    FirstChopGuide: {
      shouldStart: data => data.role === 'player' && data.environment === 'live' && data.totalChops === 0,
      isActive: () => false,
      start: options => { starts.push(options); return true; },
    },
    document: {
      getElementById: id => ({ 'player-dashboard': dashboard, 'chop-btn': target, 'ten-chop-toggle': toggle })[id],
      querySelector: () => null,
    },
  };
  const view = vm.runInNewContext(`({ ${method('startFirstChopGuide')}, ${method('replayFirstChopGuide')} })`, state);
  view._tenChopMode = true;
  let chops = 0;
  view.doChop = async () => { chops++; return true; };
  return { state, view, starts, toasts, toggle, target, dashboard, chops: () => chops };
}

test('only a ready first-time live player enters the automatic guide', () => {
  const first = fixture();
  assert.equal(first.view.startFirstChopGuide(), true);
  assert.equal(first.starts.length, 1);
  for (const options of [{ totalChops: 1 }, { environment: 'test' }, { role: 'admin' }]) {
    const next = fixture(options);
    assert.equal(next.view.startFirstChopGuide(), false);
    assert.equal(next.starts.length, 0);
  }
  first.state.FirstChopGuide.isActive = () => true;
  assert.equal(first.view.startFirstChopGuide(), false);
  assert.equal(first.starts.length, 1);
});

test('test replay reuses one real single chop without resetting progress or granting counts', async () => {
  const f = fixture({ environment: 'test', totalChops: 73, count: 28 });
  assert.equal(f.view.replayFirstChopGuide(), true);
  const before = JSON.stringify(f.state.Game.state);
  assert.equal(await f.starts[0].onChop(), true);
  assert.equal(f.chops(), 1);
  assert.equal(f.view._tenChopMode, false);
  assert.equal(f.toggle.checked, false);
  assert.equal(JSON.stringify(f.state.Game.state), before);
  assert.equal(f.starts[0].getTarget(), f.target);
  assert.equal(fixture().view.replayFirstChopGuide(), false);
  assert.equal(fixture({ role: 'admin', environment: 'test' }).view.replayFirstChopGuide(), false);
});

test('unavailable counts, active operations and existing dialogs never create a forced dead end', () => {
  const empty = fixture({ environment: 'test', count: 0 });
  assert.equal(empty.view.replayFirstChopGuide(), false);
  assert.equal(empty.starts.length, 0);
  assert.ok(empty.toasts.length > 0);
  for (const block of ['busy', 'modal', 'hidden', 'no-state']) {
    const f = fixture();
    if (block === 'busy') f.state.OperationGuard.isBusy = () => true;
    if (block === 'modal') f.state.document.querySelector = () => ({});
    if (block === 'hidden') f.dashboard.style.display = 'none';
    if (block === 'no-state') f.state.Game.state = null;
    assert.equal(f.view.startFirstChopGuide(), false, block);
    assert.equal(f.starts.length, 0);
  }
});

test('guide callbacks cannot operate on another session, data role or route', async () => {
  for (const change of ['session', 'role', 'route', 'logout']) {
    const f = fixture();
    assert.equal(f.view.startFirstChopGuide(), true);
    assert.equal(f.starts[0].isCurrent(), true);
    if (change === 'session') f.state.Auth.session = { ...f.state.Auth.session };
    if (change === 'role') f.state.DB.playerRole = 'other';
    if (change === 'route') f.state.Router.currentPlayerTab = 'tasks';
    if (change === 'logout') f.state.Game.state = null;
    assert.equal(f.starts[0].isCurrent(), false, change);
    assert.equal(await f.starts[0].onChop(), false, change);
    assert.equal(f.chops(), 0);
  }
});

test('a failed real chop remains a failure for the tutorial controller', async () => {
  const f = fixture();
  f.view.doChop = async () => false;
  f.view.startFirstChopGuide();
  assert.equal(await f.starts[0].onChop(), false);
});

test('a moving entrance never starts an invisible input-blocking guide', () => {
  const f = fixture();
  let active = true;
  f.state.SceneTransition = { isActive: () => active };
  assert.equal(f.view.startFirstChopGuide(), false);
  assert.equal(f.starts.length, 0);
  active = false;
  assert.equal(f.view.startFirstChopGuide(), true);
  assert.equal(f.starts.length, 1);
});

test('guide starts after scene mounting and login resources, and is cleared on lifecycle exits', () => {
  const login = app.slice(app.indexOf('  async doLogin()'), app.indexOf('  _setLoading('));
  assert.ok(login.indexOf('this.session = account') > login.indexOf('const actorResult = await preloadAxeAnimation'));
  assert.ok(login.indexOf('this.session = account') < login.indexOf("Router.playerTab('cultivate'"));
  const render = app.slice(app.indexOf('  async renderCultivate()'), app.indexOf('  toggleTenChop('));
  assert.ok(render.indexOf('this.startFirstChopGuide()') > render.indexOf('MobileCultivation.mount'));
  assert.match(render, /Auth\.session\?\.environment === 'test'/);
  assert.match(render, /replayFirstChopGuide\(\)/);
  const logout = app.slice(app.indexOf('  logout()'), app.indexOf('const Router ='));
  assert.match(logout, /this\.session = null/);
  const cancel = app.slice(app.indexOf('  cancelChopPresentation()'), app.indexOf('  _waitForChopFeedback('));
  assert.match(cancel, /FirstChopGuide\.destroy\(\)/);
  assert.ok(html.indexOf('first-chop-guide.js?v=first-chop-guide-20260910') < html.indexOf('<script src="app.js?'));
  assert.match(html, /first-chop-guide\.css\?v=first-chop-guide-20260910/);
});
