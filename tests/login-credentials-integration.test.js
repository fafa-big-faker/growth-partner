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
  const scope = {
    document: { getElementById: getElement, querySelectorAll: () => [] },
    AccountSession: { verify },
    UI: { toast: (...args) => toast.push(args), updateHeader() {} },
    DB: { setPlayerRole() {} },
    PlayerView: { clearDataCaches() {} },
    AudioManager: { playBgm() {}, pauseBgm() {}, async preload() {} },
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
    readPassword: () => 'fixture-password',
    saveVerified: (...args) => saved.push(args),
  };
  return { auth, saved, toast, routed, scope, getElement };
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
  finish({ playerRole: 'fixture-player' });
  await Promise.all([first, second]);
  assert.equal(state.saved.length, 1);
});

test('markup supports native managers and never submits a password to static hosting', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<form[^>]+id="login-form-panel"[^>]+onsubmit="event.preventDefault\(\)"/);
  assert.match(html, /name="username"[^>]+autocomplete="username"/);
  assert.match(html, /name="password"[^>]+autocomplete="current-password"/);
  assert.match(html, /<button type="submit"[^>]+id="login-submit"/);
  const source = fs.readFileSync(path.join(__dirname, '..', 'login-credentials.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|console\./);
});
