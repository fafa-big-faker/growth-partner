const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const authSource = appSource.slice(appSource.indexOf('const Auth = {'), appSource.indexOf('const Router = {'));
const loadedAssets = total => ({ total, loaded: total, completed: total, failed: [], cancelled: [] });

function setup(verify = async () => ({ playerRole: 'fixture-player' })) {
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { value: 'fixture-password', style: {}, attrs: {}, hidden: false,
        setAttribute(name, value) { this.attrs[name] = value; },
        classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
        querySelector: () => getElement('busy-copy'),
      });
    }
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
    PlayerView: { clearDataCaches() {}, cancelChopPresentation() {} },
    AudioManager: { playBgm() {}, pauseBgm() {}, async preload() {} },
    CultivatorAnimator: { stop() {} },
    LoginArt: {
      setLoading: (...args) => artCalls.push(['loading', ...args]),
      setVisible: (...args) => artCalls.push(['visible', ...args]),
    },
    LoginBoot: { async whenReady() { return { criticalReady: true }; } },
    Game: { state: null, inventory: [], async init() { this.state = { axeId: 'fixture-axe' }; } },
    getInitialGameImageAssets: () => [],
    getCurrentSceneImageAssets: () => ['current-scene.webp'],
    AssetPreloader: { async preload(urls) { return loadedAssets(urls.length); } },
    async preloadAxeAnimation() { return loadedAssets(10); },
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
  assert.equal(state.auth._loggingIn, true);
  assert.equal(state.getElement('login-submit').disabled, true);
  assert.equal(attempts, 0, 'art readiness precedes verification while the lock is already held');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 1);
  assert.equal(state.auth.currentRole, 'player');
  assert.equal(state.getElement('login-form-panel').hidden, false);
  assert.equal(state.getElement('login-loading').hidden, true);
  assert.equal(state.getElement('login-submit').attrs['aria-label'], '正在核验道号');
  assert.equal(state.getElement('login-submit').classList.contains('is-busy'), true);
  assert.equal(state.getElement('busy-copy').textContent, '正在入境');
  assert.equal(state.getElement('login-password').readOnly, true);
  assert.deepEqual(state.artCalls, []);
  finish({ playerRole: 'fixture-player' });
  await Promise.all([first, second]);
  assert.equal(state.saved.length, 1);
});

test('Auth reuses prepared artwork and only decodes the current scene and actor without another loading panel', async () => {
  const state = setup();
  let publicLoads = 0;
  state.scope.AssetPreloader.preload = async () => { publicLoads++; return loadedAssets(5); };
  state.scope.preloadAxeAnimation = async (_, progress) => { progress({ percent: 60 }); return loadedAssets(10); };
  await state.auth.doLogin();
  assert.deepEqual(state.artCalls, [['visible', false]]);
  assert.equal(publicLoads, 1);
  assert.equal(state.getElement('login-loading').hidden, true);
  assert.equal(state.getElement('login-loading-bar').style.width, undefined);
});

test('completed image loading waits honestly for player data without timer progress', async () => {
  const state = setup();
  let finishInit;
  state.scope.Game.init = () => new Promise(resolve => {
    finishInit = () => { state.scope.Game.state = { axeId: 'fixture-axe' }; resolve(); };
  });
  state.scope.AssetPreloader.preload = async (_, progress) => { progress({ percent: 100 }); return loadedAssets(5); };
  const login = state.auth.doLogin();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.getElement('login-submit').attrs['aria-label'], '正在读取修行记录');
  assert.equal(state.getElement('login-form-panel').hidden, false);
  assert.equal(state.routed.length, 0);
  assert.equal(state.getElement('login-submit').disabled, true);
  assert.deepEqual(state.artCalls, []);
  finishInit();
  await login;
  assert.equal(state.routed.length, 1);
});

test('login does not redownload the audio prepared at entry', async () => {
  const state = setup();
  let finishInit;
  let finishAudio;
  state.scope.Game.init = () => new Promise(resolve => {
    finishInit = () => { state.scope.Game.state = { axeId: 'fixture-axe' }; resolve(); };
  });
  state.scope.AudioManager.preload = () => new Promise(resolve => { finishAudio = resolve; });
  state.scope.AssetPreloader.preload = async (_, progress) => { progress({ percent: 100 }); return loadedAssets(5); };
  const login = state.auth.doLogin();
  await new Promise(resolve => setImmediate(resolve));
  finishInit();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(state.artCalls.at(-1), ['visible', false]);
  assert.equal(state.routed.length, 1);
  assert.equal(state.auth._loggingIn, false);
  assert.equal(finishAudio, undefined);
  await login;
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
    assert.deepEqual(state.artCalls.at(-1), ['visible', true]);
    assert.equal(state.getElement('login-submit').classList.contains('is-busy'), false);
    assert.equal(state.getElement('login-password').readOnly, false);
  }
});

test('a late preload update cannot hide the restored form after login initialization fails', async () => {
  const state = setup();
  let progress;
  state.scope.preloadAxeAnimation = (_, callback) => { progress = callback; return Promise.reject(new Error('fixture failure')); };
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

test('failed actor decoding retries the missing URLs once and never opens a partial game', async () => {
  for (const recover of [false, true]) {
    const state = setup();
    const calls = [];
    state.scope.preloadAxeAnimation = async () => ({ total: 2, loaded: 1, completed: 2, failed: ['missing.webp'], cancelled: [] });
    state.scope.AssetPreloader.preload = async urls => {
      if (urls[0] === 'current-scene.webp') return loadedAssets(1);
      calls.push([...urls]);
      return recover ? loadedAssets(1)
        : { total: 2, loaded: 1, completed: 2, failed: ['missing.webp'], cancelled: [] };
    };
    await state.auth.doLogin();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], ['missing.webp']);
    assert.equal(state.routed.length, recover ? 1 : 0);
    assert.equal(state.saved.length, recover ? 1 : 0);
    assert.equal(state.auth._loggingIn, false);
  }
});

test('pending login readiness holds verification and release uses the locked original role', async () => {
  const state = setup();
  let ready;
  let verifies = 0;
  state.scope.LoginBoot.whenReady = () => new Promise(resolve => { ready = resolve; });
  state.scope.AccountSession.verify = async () => { verifies++; return { playerRole: 'fixture-player' }; };
  const login = state.auth.doLogin();
  state.auth.selectRole('admin');
  assert.equal(verifies, 0);
  assert.equal(state.auth.currentRole, 'player');
  assert.equal(state.getElement('login-submit').disabled, true);
  ready({ criticalReady: true });
  await login;
  assert.equal(verifies, 1);
  assert.deepEqual(state.saved[0], ['player', 'fixture-password']);
});

test('login lock and guide handoff wait for the game entrance to fully finish', async () => {
  const state = setup();
  let finish;
  let guideStarts = 0;
  state.scope.PlayerView.startFirstChopGuide = () => { guideStarts++; };
  state.scope.SceneTransition = {
    async enterGame({ prepare }) {
      await prepare();
      return new Promise(resolve => { finish = resolve; });
    },
    cancel() {},
  };
  const login = state.auth.doLogin();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.routed.length, 1);
  assert.equal(state.auth._loggingIn, true);
  assert.equal(state.saved.length, 0);
  assert.equal(guideStarts, 0);
  assert.deepEqual(state.artCalls, [], 'login ink remains alive until its screen has faded out');
  await state.auth.doLogin();
  assert.equal(state.routed.length, 1);
  finish({ cancelled: false });
  await login;
  assert.equal(state.auth._loggingIn, false);
  assert.equal(guideStarts, 1);
  assert.equal(state.saved.length, 1);
  assert.deepEqual(state.artCalls.at(-1), ['visible', false]);
});

test('asynchronous route rejection restores the form and cancels the entrance', async () => {
  const state = setup();
  let cancelled = 0;
  state.scope.Router.playerTab = async () => { throw new Error('render failed'); };
  state.scope.SceneTransition = {
    async enterGame({ prepare }) { await prepare(); return { cancelled: false }; },
    cancel() { cancelled++; },
  };
  await state.auth.doLogin();
  assert.equal(cancelled, 1);
  assert.equal(state.saved.length, 0);
  assert.equal(state.getElement('login-screen').style.display, 'flex');
  assert.equal(state.getElement('player-dashboard').style.display, 'none');
  assert.equal(state.getElement('login-password').readOnly, false);
  assert.equal(state.auth._loggingIn, false);
});

test('logout during entrance invalidates late completion without saving or opening a guide', async () => {
  const state = setup();
  let finish;
  let guideStarts = 0;
  state.scope.PlayerView.startFirstChopGuide = () => { guideStarts++; };
  state.scope.SceneTransition = {
    async enterGame({ prepare }) { await prepare(); return new Promise(resolve => { finish = resolve; }); },
    cancel() {},
  };
  const login = state.auth.doLogin();
  await new Promise(resolve => setImmediate(resolve));
  state.auth.logout();
  finish({ cancelled: false });
  await login;
  assert.equal(state.saved.length, 0);
  assert.equal(guideStarts, 0);
  assert.equal(state.auth.session, null);
  assert.equal(state.getElement('player-dashboard').style.display, 'none');
  assert.equal(state.getElement('login-screen').style.display, 'flex');
  assert.deepEqual(state.artCalls.at(-1), ['visible', true]);
});

test('logout while awaiting verification cannot later reopen a session', async () => {
  let finish;
  const state = setup(() => new Promise(resolve => { finish = resolve; }));
  const login = state.auth.doLogin();
  await new Promise(resolve => setImmediate(resolve));
  state.auth.logout();
  finish({ playerRole: 'fixture-player' });
  await login;
  assert.equal(state.auth.session, null);
  assert.equal(state.routed.length, 0);
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
