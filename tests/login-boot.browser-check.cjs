/* Local login preparation and input checks; no screenshots or account requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const root = path.resolve(__dirname, '..');
  const errors = [];
  const external = [];
  let failedAsset = '';
  let hold = null;
  let release;
  let realIndex = false;
  let sdkHold;
  let releaseSdk;
  const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/login-art.css"><link rel="stylesheet" href="/login-boot.css">
    <style>body{margin:0}#login-screen{position:relative;display:flex;justify-content:center;box-sizing:border-box}.login-card{margin:0;padding:0}.login-input-wrap input{box-sizing:border-box;width:100%}</style>
    </head><body><div id="login-screen" class="login-boot-pending">
    <canvas id="login-ink-canvas"></canvas><main class="login-shell">
    <h1 class="login-brand"><img id="login-brand-image" src="/assets/runtime/v3/ui/logo.webp" width="949" height="512" alt="Xianlai"><span id="login-brand-fallback" hidden>Xianlai</span></h1>
    <div class="login-access"><form id="login-form-panel" class="login-card"><div class="login-input-wrap"><input id="login-password" type="password" autocomplete="current-password"></div>
    <button id="login-submit" type="submit" class="login-submit"><span id="login-button-ink"></span>
    <img id="login-submit-brush" class="login-submit-brush" src="/assets/runtime/v6/ui/login-brush.webp?v=xianlai-v6-20260908" alt="">
    <img id="login-submit-lettering" class="login-submit-lettering" src="/assets/runtime/v6/ui/login-lettering.webp?v=xianlai-v6-20260908" alt="">
    <span class="login-submit-fallback">Enter</span></button></form></div></main></div>
    <script src="/asset-preloader.js"></script><script src="/login-boot.js"></script><script src="/login-art.js"></script>
    <script>window.submits=0;document.getElementById('login-form-panel').addEventListener('submit',e=>{e.preventDefault();submits++});window.ready=LoginBoot.start().then(prepared=>{LoginArt.init({prepared});window.prepared=prepared;});</script></body></html>`;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (realIndex && url.origin === 'https://cdn.jsdelivr.net' && url.pathname.includes('supabase')) {
      await sdkHold;
      return route.fulfill({ body: '/* Local delayed SDK fixture; no remote SDK or accounts. */', contentType: 'application/javascript' });
    }
    if (url.origin !== 'http://login-boot.local') {
      if (!realIndex) external.push(url.origin);
      return route.abort();
    }
    if (url.pathname === '/') return route.fulfill({ body: realIndex ? await fs.readFile(path.join(root, 'index.html')) : fixture, contentType: 'text/html' });
    if (hold && /login\.webp|logo\.webp|login-brush|login-lettering/.test(url.pathname)) await hold;
    if (failedAsset && url.pathname.endsWith(failedAsset)) return route.fulfill({ status: 404, body: '' });
    const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, ''));
    if (!file.startsWith(root + path.sep)) return route.abort();
    try {
      return route.fulfill({ body: await fs.readFile(file), contentType:
        { '.webp': 'image/webp', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  try {
    hold = new Promise(resolve => { release = resolve; });
    await page.goto('http://login-boot.local', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => LoginBoot.getState().phase === 'loading');
    const loading = await page.evaluate(() => {
      const ring = document.querySelector('.login-boot-ring');
      return { width: ring.offsetWidth, height: ring.offsetHeight, inert: document.querySelector('.login-shell').inert,
        opacity: getComputedStyle(document.querySelector('.login-shell')).opacity,
        background: getComputedStyle(document.getElementById('login-screen')).backgroundImage };
    });
    assert.deepEqual([loading.width, loading.height, loading.inert, loading.opacity], [48, 48, true, '0']);
    assert.match(loading.background, /login-preview\.webp/);
    hold = null;
    release();
    await page.waitForFunction(() => LoginBoot.getState().phase === 'ready' && !!window.prepared);
    const completed = await page.evaluate(async () => {
      const images = ['login-brand-image', 'login-submit-brush', 'login-submit-lettering'].map(id => document.getElementById(id));
      await Promise.all(images.map(image => image.decode()));
      return { images: images.every(image => image.complete && image.naturalWidth > 0),
        inert: document.querySelector('.login-shell').inert,
        ringHidden: document.getElementById('login-boot').hidden,
        sameReady: LoginBoot.start() === LoginBoot.whenReady(), count: Object.keys(prepared.images).length,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(completed, { images: true, inert: false, ringHidden: true, sameReady: true, count: 10, overflow: false });
    await page.locator('#login-submit').dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 });
    assert.equal(await page.locator('#login-submit').evaluate(button => button.classList.contains('login-submit-touch-glow')), true);
    await page.locator('#login-form-panel').evaluate(form => form.requestSubmit());
    assert.equal(await page.evaluate(() => submits), 1);
    await page.waitForFunction(() => !document.getElementById('login-submit').classList.contains('login-submit-touch-glow'));

    failedAsset = 'login-brush.webp';
    await page.goto('http://login-boot.local', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => LoginBoot.getState().phase === 'error');
    assert.equal(await page.locator('#login-boot-retry').isVisible(), true);
    assert.equal(await page.locator('#login-boot-simple').isVisible(), false);
    assert.equal(await page.locator('.login-shell').evaluate(shell => shell.inert), true);
    failedAsset = '';
    await page.locator('#login-boot-retry').click();
    await page.waitForFunction(() => LoginBoot.getState().phase === 'ready');

    failedAsset = 'ink-03.webp';
    await page.goto('http://login-boot.local', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => LoginBoot.getState().phase === 'error');
    await page.locator('#login-boot-simple').click();
    await page.waitForFunction(() => LoginBoot.getState().phase === 'ready' && prepared?.simplified);

    failedAsset = '';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://login-boot.local', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => LoginBoot.getState().phase === 'ready');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    realIndex = true;
    sdkHold = new Promise(resolve => { releaseSdk = resolve; });
    await page.goto('http://login-boot.local', { waitUntil: 'commit' });
    await page.waitForFunction(() => typeof LoginBoot !== 'undefined' && LoginBoot.getState().phase === 'runtime');
    const delayedSdk = await page.evaluate(() => {
      const shell = document.querySelector('.login-shell');
      document.getElementById('login-password').focus();
      return { phase: LoginBoot.getState().phase, criticalReady: LoginBoot.getState().criticalReady,
        runtimeReady: LoginBoot.getState().runtimeReady, authUnavailable: typeof Auth === 'undefined',
        inert: shell.inert, focusedInput: document.activeElement.id === 'login-password',
        opacity: getComputedStyle(shell).opacity, loadingVisible: !document.getElementById('login-boot').hidden };
    });
    assert.deepEqual(delayedSdk, { phase: 'runtime', criticalReady: true, runtimeReady: false,
      authUnavailable: true, inert: true, focusedInput: false, opacity: '0', loadingVisible: true });
    releaseSdk();
    await page.waitForFunction(() => LoginBoot.getState().phase === 'ready' && typeof Auth !== 'undefined');
    await page.evaluate(() => {
      window.runtimeVerifyCalls = 0;
      AccountSession.verify = async () => { runtimeVerifyCalls++; return null; };
      AudioManager.playEffect = async () => {};
    });
    await page.locator('#login-password').fill('local-runtime-fixture');
    await page.locator('#login-submit').click();
    await page.waitForFunction(() => runtimeVerifyCalls === 1 && !Auth._loggingIn);
    assert.equal(await page.locator('.login-shell').evaluate(shell => shell.inert), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(JSON.stringify({ ok: true, loading, completed, criticalRetry: true, simplified: true, touchSubmit: true,
      delayedSdk, viewports: ['390x844', '1440x900'], screenshots: 0, externalRequests: 0 }, null, 2));
  } finally {
    release?.();
    releaseSdk?.();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
