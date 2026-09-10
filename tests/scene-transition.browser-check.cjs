/* Real localhost DOM and Web Animations; in-memory accounts only. No screenshots. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://scene-transition.local';
const VIEWPORTS = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };

async function fixture(browser, viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], forbidden = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => {
    window.transitionFixture = { database: [], verifies: 0, toasts: [], recordings: {}, animations: [],
      logoInitializations: [], logoAnimations: [], release: null };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      if (this.id === 'login-brand-image' && options?.duration === 1500) {
        transitionFixture.logoAnimations.push({ animation, time: performance.now() });
      }
      if (window.SceneTransition?.isActive() && this.matches(
        '#login-boot, .login-boot-content, .login-access, #login-screen, .bottom-nav > *, .mobile-inventory-columns > *')) transitionFixture.animations.push({
        target: this.id || this.className, keyframes, options, animation,
      });
      return animation;
    };
    window.recordTransition = name => {
      const samples = transitionFixture.recordings[name] = [];
      transitionFixture.recording = name;
      const nodeState = selector => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const style = getComputedStyle(node), box = node.getBoundingClientRect();
        return { display: style.display, opacity: Number(style.opacity), hidden: node.hidden, inert: node.inert,
          position: style.position, transform: style.transform, x: box.x, y: box.y, width: box.width, height: box.height };
      };
      const sample = () => {
        samples.push({ time: performance.now(), active: window.SceneTransition?.isActive() || false,
          phase: window.LoginBoot?.getState().phase, percent: document.getElementById('login-boot-percent')?.textContent,
          overlay: nodeState('#login-boot'), content: nodeState('.login-boot-content'),
          login: nodeState('#login-screen'), shell: nodeState('.login-shell'), game: nodeState('#player-dashboard'),
          guide: window.FirstChopGuide?.isActive() || false,
          overflow: document.documentElement.scrollWidth > innerWidth });
        if (transitionFixture.recording === name) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    };
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) {
      forbidden.push(`${request.method()} ${url.origin}`); return route.abort();
    }
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('supabase-js')) {
      return route.fulfill({ contentType: MIME['.js'], body: `globalThis.supabase={createClient(){
        const fail=name=>{transitionFixture.database.push(name);throw Error('Database access forbidden in transition fixture');};
        return {from:name=>fail('from:'+name),rpc:name=>fail('rpc:'+name)};}};` });
    }
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: MIME['.css'], body: '' });
    if (url.origin !== ORIGIN) { forbidden.push(`${request.method()} ${url.origin}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(ROOT + path.sep)) return route.abort();
    try {
      let body = await fs.readFile(file);
      if (path.basename(file) === 'resource-pack.js') {
        // Disk-cache integrity has its own full browser suite. Here only that
        // boundary is local; real image decoding and all transition code run.
        body = Buffer.from(`globalThis.ResourcePack={isReady:()=>true,prepare:async(manifest,onProgress)=>{
          for(const asset of manifest.assets)onProgress({url:asset.url,ok:true,persistent:true,percent:100});
          return {ready:true,persistent:true,failed:[],cancelled:[]};}};`);
      } else if (path.basename(file) === 'app.js') {
        const source = body.toString('utf8');
        assert.match(source, /\nAuth\.init\(\);/, 'fixture must intercept the one production startup call');
        body = Buffer.from(source.replace(/\nAuth\.init\(\);/, '\nwindow.initializeTransitionFixture = () => Auth.init();'));
      }
      await route.fulfill({ body, contentType: MIME[path.extname(file)] || 'application/octet-stream' });
    } catch (error) {
      if (error.code !== 'ENOENT') errors.push(error.message);
      await route.fulfill({ status: 404, body: '' });
    }
  });
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof initializeTransitionFixture === 'function'
    && LoginBoot.getState().phase === 'runtime', null, { timeout: 20000 });
  await page.evaluate(() => {
    AudioManager.playEffect = async () => false;
    AudioManager.playBgm = async () => false;
    AudioManager.pauseBgm = () => {};
    UI._updateMailBadge = () => {};
    UI._updateAchBadge = () => {};
    UI.toast = message => transitionFixture.toasts.push(message);
    const initializeArt = LoginArt.init;
    LoginArt.init = settings => {
      transitionFixture.logoInitializations.push({ time: performance.now(), phase: LoginBoot.getState().phase,
        revealDelayMs: settings?.revealDelayMs, criticalReady: settings?.prepared?.criticalReady });
      return initializeArt(settings);
    };
    AccountSession.verify = () => {
      transitionFixture.verifies++;
      return new Promise(resolve => { transitionFixture.release = resolve; });
    };
    Game.init = async () => {
      const axe = Object.values(ITEMS).find(item => item.type === 5 && item.quality === 1);
      const weapon = { id: 'transition-fixture-axe', itemId: String(axe.id), skillRolls: [] };
      Game.state = { level: 1, realmLevel: 1, treeRealm: TREE_REALMS[0].level,
        treeLevel: TREE_REALMS[0].treeLevel, axeId: String(axe.id), axeInstanceId: weapon.id,
        coin: 1234, choppingCount: 50, exp: 0, totalChops: 0 };
      Game.inventory = []; Game.weapons = [weapon]; Game.equippedWeapon = weapon;
    };
    recordTransition('boot');
    initializeTransitionFixture();
    Auth._credentials.saveVerified = async () => false;
  });
  return { context, page, errors, forbidden };
}

async function endRecording(page, name) {
  return page.evaluate(name => {
    transitionFixture.recording = null;
    return transitionFixture.recordings[name];
  }, name);
}

async function bootCheck(page, reduced = false) {
  await page.waitForFunction(() => LoginBoot.getState().phase === 'ready' && !SceneTransition.isActive(), null, { timeout: 20000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const samples = await endRecording(page, 'boot');
  const active = samples.filter(sample => sample.active);
  assert.ok(active.length >= 2, 'boot reveal uses a real asynchronous animation');
  assert.ok(active.every(sample => sample.percent === '100%'), '100% is visible during the final reveal');
  assert.ok(active.every(sample => sample.shell.inert), 'login remains inert throughout boot reveal');
  assert.ok(active.every(sample => !sample.overlay.hidden), 'outgoing background stays mounted during reveal');
  if (!reduced) {
    assert.ok(active.some(sample => sample.overlay.opacity > .05 && sample.overlay.opacity < .95), 'background genuinely crossfades');
    assert.ok(active.some(sample => sample.content.opacity < .05 && sample.overlay.opacity > .05), 'copy disappears before the outgoing background');
  }
  const ready = await page.evaluate(() => {
    document.getElementById('login-password').focus();
    return { inert: document.querySelector('.login-shell').inert, hidden: document.getElementById('login-boot').hidden,
      focused: document.activeElement.id === 'login-password', overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.deepEqual(ready, { inert: false, hidden: true, focused: true, overflow: false });
  const logo = await page.evaluate(() => ({
    initializations: transitionFixture.logoInitializations,
    entrances: transitionFixture.logoAnimations.map(record => ({ time: record.time,
      currentTime: record.animation.currentTime, state: record.animation.playState })),
    visibility: getComputedStyle(document.getElementById('login-brand-image')).visibility,
  }));
  assert.equal(logo.initializations.length, 1, 'Auth ready continuation does not initialize LoginArt a second time');
  assert.equal(logo.initializations[0].phase, 'revealing', 'real LoginArt begins during the real LoginBoot transition');
  assert.equal(logo.initializations[0].criticalReady, true);
  assert.equal(logo.initializations[0].revealDelayMs, 360, 'real Logo reveal uses the middle of the scene blend');
  assert.equal(logo.visibility, 'visible', 'finishing the scene transition never hides the Logo again');
  if (!reduced) {
    assert.equal(logo.entrances.length, 1, 'real Logo entrance starts once');
    assert.equal(logo.entrances[0].state, 'running', 'the original Logo entrance continues beyond the 720ms scene transition');
    assert.ok(logo.entrances[0].currentTime > 100, 'Logo motion has advanced rather than restarting at readiness');
    assert.ok(logo.entrances[0].time - logo.initializations[0].time >= 300,
      'Logo does not reveal immediately on initial page setup');
  }
  return { samples: active.length, duration: Math.round(active.at(-1).time - active[0].time), inputReady: true,
    logoInitializedOnce: true, logoEntranceRetained: true };
}

async function beginLogin(page, name) {
  await page.locator('#login-password').fill('local-fixture-password');
  const before = await page.evaluate(() => transitionFixture.verifies);
  await page.evaluate(name => {
    transitionFixture.release = null;
    recordTransition(name);
    void Auth.doLogin(); void Auth.doLogin();
  }, name);
  await page.waitForFunction(count => transitionFixture.verifies === count + 1 && !!transitionFixture.release, before);
  assert.equal(await page.evaluate(() => transitionFixture.verifies), before + 1, 'repeated submit verifies once');
}

async function resolveAccount(page) {
  await page.evaluate(() => transitionFixture.release({ role: 'player', environment: 'live', playerRole: 'player_live' }));
}

async function errorCheck(page) {
  await beginLogin(page, 'invalid');
  await page.evaluate(() => transitionFixture.release(null));
  await page.waitForFunction(() => !Auth._loggingIn);
  const samples = await endRecording(page, 'invalid');
  assert.ok(samples.every(sample => !sample.active), 'invalid credentials never begin game transition');
  const state = await page.evaluate(() => ({ active: SceneTransition.isActive(),
    loginVisible: getComputedStyle(document.getElementById('login-screen')).display !== 'none',
    disabled: document.getElementById('login-submit').disabled,
    readOnly: document.getElementById('login-password').readOnly, toasts: transitionFixture.toasts }));
  assert.deepEqual(state, { active: false, loginVisible: true, disabled: false, readOnly: false, toasts: ['道号密码错误'] });
  return { invalidAccountRetained: true, retryEnabled: true, repeatedSubmitBlocked: true };
}

async function gameCheck(page) {
  await beginLogin(page, 'game');
  await resolveAccount(page);
  await page.waitForFunction(() => !Auth._loggingIn && Auth.session?.role === 'player', null, { timeout: 20000 });
  await page.waitForFunction(() => FirstChopGuide.isActive(), null, { timeout: 5000 });
  const samples = await endRecording(page, 'game');
  const active = samples.filter(sample => sample.active && sample.game.display !== 'none');
  assert.ok(active.length >= 2, 'game reveal uses real asynchronous animation');
  assert.ok(active.every(sample => sample.login.display !== 'none'), 'old and new scenes coexist while blending');
  assert.ok(active.every(sample => sample.login.inert && sample.game.inert), 'both scenes block input during animation');
  assert.ok(active.every(sample => !sample.guide), 'first-chop guide never covers the transition');
  assert.ok(active.every(sample => !sample.overflow), 'transition never widens the document');
  assert.ok(active.every(sample => sample.game.transform === 'none'), 'dashboard never becomes a transformed fixed-navigation ancestor');
  const gameBox = active[0].game;
  assert.ok(active.every(sample => Math.abs(sample.game.width - gameBox.width) < 1
    && Math.abs(sample.game.height - gameBox.height) < 1 && Math.abs(sample.game.x - gameBox.x) < 1
    && Math.abs(sample.game.y - gameBox.y) < 1), 'scene layout stays stable throughout the blend');
  const final = await page.evaluate(() => ({
    active: SceneTransition.isActive(), loginDisplay: getComputedStyle(document.getElementById('login-screen')).display,
    gameInert: document.getElementById('player-dashboard').inert, guide: FirstChopGuide.isActive(),
    database: transitionFixture.database, totalChops: Game.state.totalChops,
    position: document.getElementById('login-screen').style.position,
  }));
  assert.deepEqual(final, { active: false, loginDisplay: 'none', gameInert: false,
    guide: true, database: [], totalChops: 0, position: '' });
  return { samples: active.length, guideAfterTransition: true, blockedDuringTransition: true, noPlayerDataMutation: true };
}

async function cleanupCheck(page, mode) {
  await page.evaluate(() => Auth.logout());
  await beginLogin(page, mode);
  await resolveAccount(page);
  await page.waitForFunction(() => SceneTransition.isActive()
    && getComputedStyle(document.getElementById('player-dashboard')).display !== 'none');
  await page.evaluate(mode => {
    if (mode === 'logout') Auth.logout();
    else {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  }, mode);
  await page.waitForFunction(() => !SceneTransition.isActive() && !Auth._loggingIn);
  await endRecording(page, mode);
  const state = await page.evaluate(() => ({
    loginInert: document.getElementById('login-screen').inert,
    gameInert: document.getElementById('player-dashboard').inert,
    position: document.getElementById('login-screen').style.position,
    activeAnimations: transitionFixture.animations.filter(record => record.animation.playState === 'running')
      .map(record => ({ target: record.target, options: record.options })),
    loginDisplay: getComputedStyle(document.getElementById('login-screen')).display,
    gameDisplay: getComputedStyle(document.getElementById('player-dashboard')).display,
    account: Auth.session?.role || null,
    residualClasses: document.querySelectorAll('.scene-transition-outgoing, .scene-transition-locked').length,
  }));
  assert.equal(state.loginInert, false, `${mode}: login inert is restored`);
  assert.equal(state.gameInert, false, `${mode}: game inert is restored`);
  assert.equal(state.position, '', `${mode}: fixed scene positioning is cleared`);
  assert.equal(state.residualClasses, 0, `${mode}: transition positioning and lock classes are cleared`);
  assert.deepEqual(state.activeAnimations, [], `${mode}: no transition animation remains`);
  if (mode === 'logout') {
    assert.equal(state.loginDisplay, 'flex'); assert.equal(state.gameDisplay, 'none'); assert.equal(state.account, null);
  }
  await page.evaluate(() => {
    delete document.hidden; delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  return state;
}

async function reducedCheck(browser) {
  const run = await fixture(browser, { width: 390, height: 844 }, 'reduce');
  try {
    const boot = await bootCheck(run.page, true);
    const game = await gameCheck(run.page);
    const moving = await run.page.evaluate(() => transitionFixture.animations.flatMap(record =>
      (Array.isArray(record.keyframes) ? record.keyframes : [record.keyframes])
        .filter(frame => frame.transform && frame.transform !== 'none')
        .map(frame => ({ target: record.target, transform: frame.transform }))));
    assert.deepEqual(moving, [], 'reduced-motion transitions contain no translation or zoom');
    assert.deepEqual(run.errors, []); assert.deepEqual(run.forbidden, []);
    return { boot, game, movementDisabled: true };
  } finally { await run.context.close(); }
}

async function cancelledBootCheck(browser) {
  const run = await fixture(browser, { width: 390, height: 844 });
  try {
    await run.page.waitForFunction(() => LoginBoot.getState().phase === 'revealing' && SceneTransition.isActive());
    const ready = await run.page.evaluate(async () => {
      SceneTransition.cancel();
      const prepared = await LoginBoot.whenReady();
      return { ready: prepared.criticalReady, cancelled: !!prepared.cancelled,
        phase: LoginBoot.getState().phase, shellInert: document.querySelector('.login-shell').inert,
        screenInert: document.getElementById('login-screen').inert,
        overlayHidden: document.getElementById('login-boot').hidden };
    });
    assert.deepEqual(ready, { ready: true, cancelled: false, phase: 'ready',
      shellInert: false, screenInert: false, overlayHidden: true },
    'cancelling only the visual reveal does not permanently cancel already-prepared login resources');
    await endRecording(run.page, 'boot');
    const game = await gameCheck(run.page);
    assert.equal(await run.page.evaluate(() => transitionFixture.logoInitializations.length), 1);
    assert.deepEqual(run.errors, []); assert.deepEqual(run.forbidden, []);
    return { ready, successfulLoginAfterCancellation: game.guideAfterTransition };
  } finally { await run.context.close(); }
}

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      const run = await fixture(browser, viewport);
      try {
        const boot = await bootCheck(run.page);
        const invalid = await errorCheck(run.page);
        const game = await gameCheck(run.page);
        const lifecycle = viewport.width === 390 ? {
          logout: await cleanupCheck(run.page, 'logout'), background: await cleanupCheck(run.page, 'background'),
        } : null;
        assert.deepEqual(run.errors, [], 'no browser runtime errors');
        assert.deepEqual(run.forbidden, [], 'no external or mutating request was attempted');
        results.push({ viewport, boot, invalid, game, lifecycle });
      } finally { await run.context.close(); }
    }
    const reduced = await reducedCheck(browser);
    const cancelledBoot = await cancelledBootCheck(browser);
    console.log(JSON.stringify({ ok: true, screenshots: 0, externalRequests: 0, databaseRequests: 0,
      results, reduced, cancelledBoot }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
