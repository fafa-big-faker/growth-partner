/* Real localhost service worker/cache and DOM geometry checks. No screenshots or real accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const VIEWPORTS = [
  { width: 320, height: 568 }, { width: 390, height: 844 },
  { width: 390, height: 1200 }, { width: 844, height: 390 },
  { width: 1440, height: 900 },
];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function localServer() {
  const requests = [], overrides = new Map();
  const fixture = { sdkGate: null, externalStubs: false };
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const key = url.pathname + url.search;
      requests.push({ method: request.method, key });
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405); response.end(); return;
      }
      if (url.pathname === '/_entry-cache-fixture.html') {
        response.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
        response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local cache fixture</title><script src="/resource-pack.js"></script>');
        return;
      }
      if (url.pathname === '/_entry-fonts.css') {
        response.writeHead(200, { 'content-type': MIME['.css'], 'cache-control': 'no-store' }); response.end(); return;
      }
      if (url.pathname === '/_entry-supabase-fixture.js') {
        await fixture.sdkGate?.promise;
        response.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' });
        response.end('globalThis.supabase={createClient(){return {from(name){entryDatabaseAttempts.push("from:"+name);throw new Error("Real database calls are forbidden in the local fixture");},rpc(name){entryDatabaseAttempts.push("rpc:"+name);throw new Error("Real database calls are forbidden in the local fixture");}};}};');
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(ROOT, relative);
      if (!file.startsWith(ROOT + path.sep)) { response.writeHead(403); response.end(); return; }
      const custom = overrides.get(key);
      let body = custom?.body || await fs.readFile(file);
      if (relative === 'index.html' && fixture.externalStubs) {
        // Playwright route() globally disables HTTP caching and changes image
        // request.cache to reload. Replace only external fixture URLs at the
        // local server so the real worker sees ordinary browser requests.
        body = Buffer.from(body.toString('utf8')
          .replaceAll('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', '/_entry-supabase-fixture.js')
          .replace(/https:\/\/fonts\.googleapis\.com[^"']*/g, '/_entry-fonts.css'));
      }
      response.writeHead(custom?.status || 200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream',
        'content-length': body.length, 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404); response.end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`, requests, overrides, fixture,
    count(key) { return requests.filter(request => request.key === key).length; },
    mediaSince(index) { return requests.slice(index).filter(request => /^\/assets\/runtime\//.test(request.key)); },
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}

function descriptor(url, bytes, kind) {
  return { url, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), kind, density: 'all' };
}

async function cacheChecks(browser, server) {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const imageUrl = '/assets/runtime/v3/ui/logo.webp?entry-cache-fixture=1';
  const audioUrl = '/assets/runtime/audio/ui-tap.wav?entry-cache-fixture=1';
  const imageBytes = await fs.readFile(path.join(ROOT, 'assets/runtime/v3/ui/logo.webp'));
  const audioBytes = await fs.readFile(path.join(ROOT, 'assets/runtime/audio/ui-tap.wav'));
  const manifest = { version: 'local-cache-v1', assets: [
    descriptor(imageUrl, imageBytes, 'image'), descriptor(audioUrl, audioBytes, 'audio'),
  ] };
  const prepare = fixtureManifest => page.evaluate(async fixtureManifest => {
    window.cacheProgress = [];
    const result = await ResourcePack.prepare(fixtureManifest, value => cacheProgress.push(value));
    return { result, controller: navigator.serviceWorker.controller?.scriptURL,
      progress: cacheProgress.map(value => ({ percent: value.percent, ready: value.ready })) };
  }, fixtureManifest);
  try {
    await page.goto(`${server.origin}/_entry-cache-fixture.html`);
    const cold = await prepare(manifest);
    assert.equal(cold.result.ready, true);
    assert.equal(cold.result.persistent, true, 'a real worker controls the first prepared page');
    assert.match(cold.controller, /\/resource-worker\.js\?/);
    assert.equal(cold.result.loadedBytes, imageBytes.length + audioBytes.length);
    assert.equal(server.count(imageUrl), 1);
    assert.equal(server.count(audioUrl), 1);
    assert.ok(cold.progress.filter(value => !value.ready).every(value => value.percent < 100), 'unverified resources never report 100%');
    assert.deepEqual(cold.progress.at(-1), { percent: 100, ready: true });

    const consumption = await page.evaluate(async urls => {
      const image = new Image(); image.src = urls.image; await image.decode();
      const audio = await fetch(urls.audio);
      return { imageDecoded: image.naturalWidth > 0, audioBytes: (await audio.arrayBuffer()).byteLength,
        audioType: audio.headers.get('content-type'), audioHash: audio.headers.get('x-xianlai-sha256') };
    }, { image: imageUrl, audio: audioUrl });
    assert.equal(consumption.imageDecoded, true);
    assert.equal(consumption.audioBytes, audioBytes.length);
    assert.equal(consumption.audioType, 'audio/wav');
    assert.equal(consumption.audioHash, manifest.assets[1].sha256);
    assert.equal(server.count(imageUrl), 1, 'image decoding reuses the real CacheStorage entry');
    assert.equal(server.count(audioUrl), 1, 'ordinary audio reads reuse the real CacheStorage entry');

    await page.reload();
    const warm = await prepare(manifest);
    assert.equal(warm.result.ready, true);
    assert.equal(warm.result.persistent, true);
    assert.equal(server.count(imageUrl), 1, 'same-context reload downloads no warm image');
    assert.equal(server.count(audioUrl), 1, 'same-context reload downloads no warm audio');
    const ranges = await page.evaluate(async ({ url, total }) => {
      const results = [];
      for (const range of ['bytes=2-17', 'bytes=-7', `bytes=${total}-`]) {
        const response = await fetch(url, { headers: { Range: range } });
        results.push({ range, status: response.status, contentRange: response.headers.get('content-range'),
          length: response.headers.get('content-length'), accepts: response.headers.get('accept-ranges'),
          bytes: [...new Uint8Array(await response.arrayBuffer())] });
      }
      return results;
    }, { url: audioUrl, total: audioBytes.length });
    assert.deepEqual(ranges[0], { range: 'bytes=2-17', status: 206, contentRange: `bytes 2-17/${audioBytes.length}`,
      length: '16', accepts: 'bytes', bytes: [...audioBytes.subarray(2, 18)] });
    assert.deepEqual(ranges[1], { range: 'bytes=-7', status: 206,
      contentRange: `bytes ${audioBytes.length - 7}-${audioBytes.length - 1}/${audioBytes.length}`,
      length: '7', accepts: 'bytes', bytes: [...audioBytes.subarray(-7)] });
    assert.equal(ranges[2].status, 416);
    assert.equal(ranges[2].contentRange, `bytes */${audioBytes.length}`);
    assert.equal(ranges[2].bytes.length, 0);
    assert.equal(server.count(audioUrl), 1, 'worker serves valid and invalid ranges without network traffic');

    const replacement = await fs.readFile(path.join(ROOT, 'assets/runtime/ink-controls/exp-fill.webp'));
    server.overrides.set(imageUrl, { body: replacement });
    const updatedManifest = { version: 'local-cache-v2', assets: [descriptor(imageUrl, replacement, 'image'), manifest.assets[1]] };
    assert.equal((await prepare(updatedManifest)).result.ready, true);
    assert.equal(server.count(imageUrl), 2, 'a changed hash refreshes exactly the changed resource');
    assert.equal(server.count(audioUrl), 1, 'an unchanged audio resource is retained');
    assert.equal(await page.evaluate(async url => (await fetch(url)).headers.get('x-xianlai-sha256'), imageUrl), updatedManifest.assets[0].sha256);

    const retryUrl = '/assets/runtime/ink-controls/exp-fill.webp?entry-cache-retry=1';
    const retryManifest = { version: 'local-cache-retry', assets: [...updatedManifest.assets, descriptor(retryUrl, replacement, 'image')] };
    server.overrides.set(retryUrl, { status: 503, body: Buffer.from('local test failure') });
    const failed = await prepare(retryManifest);
    assert.equal(failed.result.ready, false);
    assert.deepEqual(failed.result.failed, [retryUrl]);
    assert.ok(failed.progress.every(value => value.percent < 100));
    server.overrides.delete(retryUrl);
    assert.equal((await prepare(retryManifest)).result.ready, true);
    assert.equal(server.count(retryUrl), 2, 'retry requests the one failed resource again');
    assert.equal(server.count(imageUrl), 2);
    assert.equal(server.count(audioUrl), 1);
    assert.deepEqual(errors, []);
    return { coldDownloads: 2, sameContextWarmDownloads: 0, imageDecodeFromCache: true, audioFromCache: true,
      rangeStatuses: ranges.map(value => value.status), changedFileDownloads: 1, failedResourceOnlyRetry: true };
  } finally {
    server.overrides.delete(imageUrl);
    await context.close();
  }
}

async function frames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function preparationGeometry(page, viewport) {
  await frames(page);
  const result = await page.evaluate(() => {
    const rect = node => {
      const { x, y, right, bottom, width, height } = node.getBoundingClientRect();
      return { x, y, right, bottom, width, height };
    };
    const overlay = document.getElementById('login-boot');
    const shell = document.querySelector('.login-shell');
    document.getElementById('login-password').focus();
    return { phase: LoginBoot.getState().phase, readyResources: LoginBoot.getState().resourcesReady,
      inert: shell.inert, focusedInput: document.activeElement.id === 'login-password',
      overflow: document.documentElement.scrollWidth > innerWidth,
      overlayOverflow: overlay.scrollWidth > overlay.clientWidth || overlay.scrollHeight > overlay.clientHeight,
      overlay: rect(overlay), content: rect(document.querySelector('.login-boot-content')),
      quote: rect(document.getElementById('login-boot-quote')), track: rect(document.getElementById('login-boot-track')),
      meta: rect(document.querySelector('.login-boot-meta')),
      quoteText: document.getElementById('login-boot-quote').textContent,
      percent: document.getElementById('login-boot-percent').textContent,
      ariaPercent: document.getElementById('login-boot-track').getAttribute('aria-valuenow'),
      background: getComputedStyle(overlay).backgroundImage, backgroundSize: getComputedStyle(overlay).backgroundSize };
  });
  assert.equal(result.phase, 'runtime');
  assert.equal(result.readyResources, true);
  assert.equal(result.inert, true);
  assert.equal(result.focusedInput, false, 'preparation prevents premature password entry');
  assert.equal(result.overflow, false, `${viewport.width}x${viewport.height}: page does not overflow horizontally`);
  assert.equal(result.overlayOverflow, false, `${viewport.width}x${viewport.height}: preparation needs no internal scrolling`);
  assert.ok(result.quoteText.trim());
  assert.ok(Number(result.ariaPercent) >= 0 && Number(result.ariaPercent) < 100);
  assert.equal(result.percent, `${result.ariaPercent}%`);
  assert.match(result.background, /entry-preparation\/background\.webp/);
  assert.equal(result.backgroundSize, 'cover', 'the source artwork retains its aspect ratio');
  for (const name of ['overlay', 'content', 'quote', 'track', 'meta']) {
    const box = result[name];
    assert.ok(box.width > 0 && box.height > 0 && box.x >= -1 && box.y >= -1
      && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1,
    `${viewport.width}x${viewport.height}: ${name} fits the viewport: ${JSON.stringify(box)}`);
  }
  return { viewport, content: result.content, quote: result.quote, track: result.track, percent: result.percent };
}

async function loginBusyCheck(page) {
  await page.evaluate(() => {
    window.entryLoginFixture = { verifies: 0, release: null, toasts: [] };
    AccountSession.verify = () => {
      entryLoginFixture.verifies++;
      return new Promise(resolve => { entryLoginFixture.release = resolve; });
    };
    UI.toast = message => entryLoginFixture.toasts.push(message);
    AudioManager.playEffect = async () => false;
  });
  await page.locator('#login-password').fill('local-browser-fixture');
  await page.locator('#login-submit').click();
  await page.waitForFunction(() => entryLoginFixture.verifies === 1 && typeof entryLoginFixture.release === 'function');
  const busy = await page.evaluate(() => {
    const button = document.getElementById('login-submit');
    const form = document.getElementById('login-form-panel');
    const oldLoading = document.getElementById('login-loading');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return { disabled: button.disabled, busy: button.getAttribute('aria-busy'), hasBusyClass: button.classList.contains('is-busy'),
      busyText: button.querySelector('.login-submit-busy').textContent,
      busyVisible: getComputedStyle(button.querySelector('.login-submit-busy')).display !== 'none',
      formVisible: !form.hidden && getComputedStyle(form).display !== 'none',
      oldLoadingHidden: oldLoading.hidden || getComputedStyle(oldLoading).display === 'none',
      passwordReadOnly: document.getElementById('login-password').readOnly,
      rolesDisabled: [...document.querySelectorAll('.role-card')].every(control => control.disabled) };
  });
  assert.deepEqual(busy, { disabled: true, busy: 'true', hasBusyClass: true, busyText: '正在入境', busyVisible: true,
    formVisible: true, oldLoadingHidden: true, passwordReadOnly: true, rolesDisabled: true });
  assert.equal(await page.evaluate(() => entryLoginFixture.verifies), 1, 'rapid repeated submission verifies only once');
  await page.evaluate(() => entryLoginFixture.release(null));
  await page.waitForFunction(() => !Auth._loggingIn);
  const restored = await page.evaluate(() => ({
    disabled: document.getElementById('login-submit').disabled,
    busy: document.getElementById('login-submit').getAttribute('aria-busy'),
    passwordReadOnly: document.getElementById('login-password').readOnly,
    formVisible: !document.getElementById('login-form-panel').hidden,
    errors: entryLoginFixture.toasts,
  }));
  assert.deepEqual(restored, { disabled: false, busy: 'false', passwordReadOnly: false,
    formVisible: true, errors: ['道号密码错误'] });
  return { inlineBusy: true, formRetained: true, repeatedSubmitBlocked: true, invalidAccountRestored: true };
}

async function successfulEntryCheck(page, server) {
  await page.evaluate(() => {
    AccountSession.verify = async () => ({ role: 'player', environment: 'live', playerRole: 'player_live' });
    Auth._credentials.saveVerified = async () => false;
    AudioManager.playBgm = async () => false;
    UI._updateMailBadge = () => {};
    UI._updateAchBadge = () => {};
    // Account and persistence boundaries are local fixtures. Auth, current-scene
    // decoding, real cultivation DOM, animator and first-chop guide stay real.
    Game.init = async () => {
      const axe = Object.values(ITEMS).find(item => item.type === 5 && item.quality === 1);
      const weapon = { id: 'entry-local-fixture-axe', itemId: String(axe.id), skillRolls: [] };
      Game.state = { level: 1, realmLevel: 1, treeRealm: TREE_REALMS[0].level,
        treeLevel: TREE_REALMS[0].treeLevel, axeId: String(axe.id), axeInstanceId: weapon.id,
        coin: 1234, choppingCount: 50, exp: 0, totalChops: 0 };
      Game.inventory = [];
      Game.weapons = [weapon];
      Game.equippedWeapon = weapon;
    };
  });
  const before = server.requests.length;
  await page.locator('#login-submit').click();
  await page.waitForFunction(() => !Auth._loggingIn && Auth.session?.role === 'player'
    && document.getElementById('player-dashboard').style.display === 'flex', null, { timeout: 15000 });
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('#player-main img')].map(image => image.decode()));
  });
  await page.waitForFunction(() => FirstChopGuide.isActive(), null, { timeout: 5000 });
  await frames(page);
  const result = await page.evaluate(() => ({
    loginHidden: document.getElementById('login-screen').style.display === 'none',
    spriteReady: document.getElementById('cultivator-sprite').naturalWidth > 0,
    firstChopGuide: FirstChopGuide.isActive(),
    totalChops: Game.state.totalChops, remainingChops: Game.state.choppingCount,
    databaseAttempts: entryDatabaseAttempts,
  }));
  assert.deepEqual(result, { loginHidden: true, spriteReady: true, firstChopGuide: true,
    totalChops: 0, remainingChops: 50, databaseAttempts: [] });
  const network = server.mediaSince(before);
  const gameMedia = network.filter(request => !request.key.startsWith('/assets/runtime/app-icon/'));
  assert.equal(gameMedia.length, 12, 'login fetches only the current tree pair and equipped axe frames');
  assert.equal(gameMedia.filter(request => request.key.includes('/wish-trees/')).length, 2);
  assert.equal(gameMedia.filter(request => request.key.includes('/character/idle-axes/51001/')).length, 4);
  assert.equal(gameMedia.filter(request => request.key.includes('/character/axes/51001/')).length, 6);
  assert.ok(gameMedia.every(request => request.key.includes('/wish-trees/') || request.key.includes('/51001/')),
    `no unused tree or axe is fetched after login: ${JSON.stringify(gameMedia)}`);
  return { successfulLocalAccount: true, currentSceneMediaDownloads: gameMedia.length,
    browserMetadataRequests: network.map(request => request.key), firstChopGuide: true,
    noPlayerDataMutation: true };
}

async function pageChecks(browser, server) {
  await fs.access(path.join(ROOT, 'boot-assets.js'));
  const context = await browser.newContext({ viewport: VIEWPORTS[0], hasTouch: true, serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [], externalAttempts = [], geometries = [], gates = [];
  let sdkGate;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== server.origin && /^https?:$/.test(url.protocol)) externalAttempts.push(`${request.method()} ${url.origin}`);
  });
  await context.addInitScript(() => { window.entryDatabaseAttempts = []; });
  server.fixture.externalStubs = true;
  try {
    let coldMedia = 0, coldUniqueMedia = 0, coldBackgroundRequests = 0;
    const warmMedia = [];
    for (const [index, viewport] of VIEWPORTS.entries()) {
      await page.setViewportSize(viewport);
      sdkGate = deferred(); gates.push(sdkGate);
      server.fixture.sdkGate = sdkGate;
      const start = server.requests.length;
      await page.goto(`${server.origin}/`, { waitUntil: 'commit' });
      await page.waitForFunction(() => typeof LoginBoot !== 'undefined' && LoginBoot.getState().phase === 'runtime', null, { timeout: 60000 });
      geometries.push(await preparationGeometry(page, viewport));
      sdkGate.resolve();
      await page.waitForFunction(() => typeof Auth !== 'undefined' && LoginBoot.getState().phase === 'ready', null, { timeout: 60000 });
      const ready = await page.evaluate(() => ({
        inert: document.querySelector('.login-shell').inert,
        preparationHidden: document.getElementById('login-boot').hidden,
        resources: ResourcePack.isReady(), persistent: LoginBoot.getState().persistent,
        readyPercent: document.getElementById('login-boot-track').getAttribute('aria-valuenow'),
      }));
      assert.deepEqual(ready, { inert: false, preparationHidden: true, resources: true, persistent: true, readyPercent: '100' });
      const network = server.mediaSince(start);
      if (index === 0) {
        coldMedia = network.length;
        coldUniqueMedia = new Set(network.map(request => request.key)).size;
        coldBackgroundRequests = network.filter(request => request.key.includes('/entry-preparation/background.webp')).length;
      }
      else {
        warmMedia.push({ viewport, requests: network.map(request => request.key) });
        const uncachedGameMedia = network.filter(request => !request.key.startsWith('/assets/runtime/app-icon/favicon.png'));
        assert.equal(uncachedGameMedia.length, 0, `same-context warm preparation must reuse game media: ${JSON.stringify(uncachedGameMedia)}`);
      }
      assert.deepEqual(await page.evaluate(() => entryDatabaseAttempts), []);
    }
    const login = await loginBusyCheck(page);
    const successfulEntry = await successfulEntryCheck(page, server);
    assert.deepEqual(errors, [], 'no browser runtime errors');
    assert.deepEqual(externalAttempts, [], 'no external account, database, SDK or font request was attempted');
    return { geometries, coldMediaRequests: coldMedia, coldUniqueMedia, coldBackgroundRequests,
      sameContextWarmMediaRequests: warmMedia.map(value => value.requests.length),
      sameContextWarmGameMediaRequests: warmMedia.map(value => value.requests.filter(key => !key.startsWith('/assets/runtime/app-icon/favicon.png')).length),
      login, successfulEntry, pageErrors: errors, databaseRequests: 0, externalNetworkRequests: 0 };
  } finally {
    gates.forEach(gate => gate.resolve());
    await context.close();
  }
}

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const server = await localServer();
  const browser = await playwright.chromium.launch({ headless: true,
    args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'],
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const cache = await cacheChecks(browser, server);
    const entry = process.argv.includes('--cache-only') ? null : await pageChecks(browser, server);
    console.log(JSON.stringify({ ok: true, screenshots: 0, cache, entry }, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
