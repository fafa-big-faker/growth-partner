const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const authSource = appSource.slice(appSource.indexOf('const Auth = {'), appSource.indexOf('const Router = {'));

function setup(verify = async () => ({ playerRole: 'fixture-player' })) {
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, { value: 'fixture-password', style: {}, hidden: false });
    return elements.get(id);
  };
  const saved = [];
  const toast = [];
  const routed = [];
  const artCalls = [];
  const scope = {
    document: { getElementById: getElement, querySelectorAll: () => [] },
    AccountSession: { verify },
    UI: { toast: (...args) => toast.push(args), updateHeader() {} },
    DB: { setPlayerRole() {} },
    PlayerView: { clearDataCaches() {} },
    AudioManager: { playBgm() {}, pauseBgm() {}, async preload() {} },
    CultivatorAnimator: { stop() {} },
    LoginArt: {
      setLoading: (...args) => artCalls.push(['loading', ...args]),
      setVisible: (...args) => artCalls.push(['visible', ...args]),
    },
    Game: { state: null, inventory: [], async init() { this.state = { axeId: 'fixture-axe' }; } },
    getInitialGameImageAssets: () => [],
    AssetPreloader: { async preload() {} },
    async preloadAxeAnimation() {},
    Router: { playerTab: (...args) => routed.push(args), adminTab: (...args) => routed.push(args) },
    console: { error() {} },
  };
  vm.runInNewContext(`${authSource}\nglobalThis.auth = Auth;`, scope);
  const auth = scope.auth;
  auth._credentials = {
    clear() {},
    readPassword: () => 'fixture-password',
    saveVerified: (...args) => saved.push(args),
  };
  return { auth, saved, toast, routed, artCalls, scope, getElement };
}

test('successful login saves the verified role only after initialization', async () => {
  const state = setup();
  await state.auth.doLogin();
  assert.deepEqual(state.saved, [['player', 'fixture-password']]);
  assert.equal(state.routed.length, 1);
  assert.equal(state.auth._loggingIn, false);
});

test('failed verification never saves or opens the game and releases the lock', async () => {
  const state = setup(async () => null);
  await state.auth.doLogin();
  assert.equal(state.saved.length, 0);
  assert.equal(state.routed.length, 0);
  assert.equal(state.toast.length, 1);
  assert.equal(state.auth._loggingIn, false);
  assert.equal(state.getElement('login-submit').disabled, false);
  assert.equal(state.getElement('login-form-panel').hidden, false);
  assert.equal(state.getElement('login-loading').hidden, true);
});

test('verification errors and initialization errors recover without saving credentials', async () => {
  for (const phase of ['verify', 'init']) {
    const state = setup(phase === 'verify' ? async () => { throw new Error('fixture failure'); } : undefined);
    if (phase === 'init') state.scope.Game.init = async () => { throw new Error('fixture failure'); };
    await state.auth.doLogin();
    assert.equal(state.saved.length, 0);
    assert.equal(state.auth._loggingIn, false);
    assert.equal(state.getElement('login-form-panel').hidden, false);
  }
});

test('verification is locked before its first await and role cannot change mid-login', async () => {
  let finish;
  let attempts = 0;
  const state = setup(() => { attempts++; return new Promise(resolve => { finish = resolve; }); });
  const first = state.auth.doLogin();
  const second = state.auth.doLogin();
  state.auth.selectRole('admin');
  assert.equal(attempts, 1);
  assert.equal(state.auth.currentRole, 'player');
  assert.equal(state.getElement('login-form-panel').hidden, true);
  assert.equal(state.getElement('login-loading').hidden, false);
  assert.equal(state.getElement('login-loading-status').textContent, '正在核验道号');
  assert.deepEqual(state.artCalls, [['loading', true, 0]]);
  finish({ playerRole: 'fixture-player' });
  await Promise.all([first, second]);
  assert.equal(state.saved.length, 1);
});

test('Auth forwards actual combined asset progress to LoginArt without writing a competing bar width', async () => {
  const state = setup();
  state.scope.AssetPreloader.preload = async (_, progress) => progress({ percent: 40 });
  state.scope.preloadAxeAnimation = async (_, progress) => progress({ percent: 60 });
  await state.auth.doLogin();
  assert.deepEqual(state.artCalls, [
    ['loading', true, 0], ['loading', true, 0], ['loading', true, 34],
    ['loading', true, 85], ['loading', true, 94], ['visible', false],
  ]);
  assert.equal(state.getElement('login-loading-bar').style.width, undefined);
});

test('completed image loading waits honestly for player data without timer progress', async () => {
  const state = setup();
  let finishInit;
  state.scope.Game.init = () => new Promise(resolve => {
    finishInit = () => { state.scope.Game.state = { axeId: 'fixture-axe' }; resolve(); };
  });
  state.scope.AssetPreloader.preload = async (_, progress) => progress({ percent: 100 });
  const login = state.auth.doLogin();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.getElement('login-loading-status').textContent, '正在读取修行记录');
  assert.equal(state.getElement('login-form-panel').hidden, true);
  assert.equal(state.routed.length, 0);
  assert.deepEqual(state.artCalls.at(-1), ['loading', true, 85]);
  finishInit();
  await login;
  assert.equal(state.routed.length, 1);
});

test('completed player data updates the waiting status while optional audio settles', async () => {
  const state = setup();
  let finishInit;
  let finishAudio;
  state.scope.Game.init = () => new Promise(resolve => {
    finishInit = () => { state.scope.Game.state = { axeId: 'fixture-axe' }; resolve(); };
  });
  state.scope.AudioManager.preload = () => new Promise(resolve => { finishAudio = resolve; });
  state.scope.AssetPreloader.preload = async (_, progress) => progress({ percent: 100 });
  const login = state.auth.doLogin();
  await new Promise(resolve => setImmediate(resolve));
  finishInit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.getElement('login-loading-status').textContent, '正在准备入境');
  assert.deepEqual(state.artCalls.at(-1), ['loading', true, 85]);
  assert.equal(state.routed.length, 0);
  finishAudio();
  await login;
  assert.equal(state.routed.length, 1);
});

test('both role dashboards stop login effects on entry and restore them on logout', async () => {
  for (const role of ['player', 'admin']) {
    const state = setup();
    state.auth.currentRole = role;
    await state.auth.doLogin();
    assert.equal(state.getElement('login-screen').style.display, 'none');
    assert.deepEqual(state.artCalls.at(-1), ['visible', false]);
    state.auth.logout();
    assert.equal(state.getElement('login-screen').style.display, 'flex');
    assert.equal(state.getElement('login-form-panel').hidden, false);
    assert.deepEqual(state.artCalls.slice(-2), [['visible', true], ['loading', false, 0]]);
  }
});

test('a late preload update cannot hide the restored form after login initialization fails', async () => {
  const state = setup();
  let progress;
  state.scope.AssetPreloader.preload = (_, callback) => { progress = callback; return Promise.resolve(); };
  state.scope.Game.init = async () => { throw new Error('fixture failure'); };
  await state.auth.doLogin();
  assert.equal(state.getElement('login-form-panel').hidden, false);
  const before = state.artCalls.length;
  progress({ percent: 80 });
  assert.equal(state.getElement('login-form-panel').hidden, false);
  assert.equal(state.artCalls.length, before);
});

test('a routing failure after animation hiding restores login visibility and effects', async () => {
  const state = setup();
  state.scope.Router.playerTab = () => { throw new Error('fixture routing failure'); };
  await state.auth.doLogin();
  assert.equal(state.getElement('login-screen').style.display, 'flex');
  assert.equal(state.getElement('player-dashboard').style.display, 'none');
  assert.equal(state.getElement('admin-dashboard').style.display, 'none');
  assert.equal(state.getElement('login-form-panel').hidden, false);
  assert.ok(state.artCalls.some(call => call[0] === 'visible' && call[1] === true));
  assert.equal(state.saved.length, 0);
});

test('markup supports native managers and never submits a password to static hosting', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<form[^>]+id="login-form-panel"[^>]+onsubmit="event.preventDefault\(\)"/);
  assert.match(html, /name="username"[^>]+autocomplete="username"/);
  assert.match(html, /name="password"[^>]+autocomplete="current-password"/);
  assert.match(html, /<button type="submit"[^>]+id="login-submit"/);
  assert.match(html, /id="login-loading-status"/);
  const source = fs.readFileSync(path.join(__dirname, '..', 'login-credentials.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|console\./);
});
