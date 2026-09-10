// Functional audio/entry check only: real decoders, no screenshots or accounts.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const bytes = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--autoplay-policy=document-user-activation-required'] });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
      const page = await context.newPage();
      await page.route('**/*', async route => {
        if (new URL(route.request().url()).origin === base) await route.continue();
        else if (route.request().resourceType() === 'script') await route.fulfill({ body: '', contentType: 'text/javascript' });
        else await route.abort();
      });
      await page.addInitScript(() => {
        window.audioProbe = { decoded: 0, starts: [], contexts: [], media: 0, clicks: [] };
        const NativeContext = window.AudioContext;
        window.AudioContext = class extends NativeContext {
          constructor(settings) { super(settings); window.audioProbe.contexts.push(this); }
          async decodeAudioData(bytes) { const buffer = await super.decodeAudioData(bytes); window.audioProbe.decoded++; return buffer; }
          createBufferSource() {
            const source = super.createBufferSource(), start = source.start.bind(source);
            source.start = (...args) => { window.audioProbe.starts.push({ at: performance.now(), loop: source.loop, duration: source.buffer?.duration }); return start(...args); };
            return source;
          }
        };
        const NativeAudio = window.Audio;
        window.Audio = class extends NativeAudio { constructor(src) { super(src); window.audioProbe.media++; } };
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForFunction(() => ['ready', 'error'].includes(window.LoginBoot?.getState().phase), null, { timeout: 45000 });
      const state = await page.evaluate(() => ({ boot: window.LoginBoot?.getState(), decoded: window.audioProbe?.decoded }));
      assert.equal(state.boot.phase, 'ready', JSON.stringify({ errors, state }));
      assert.equal(await page.evaluate(() => audioProbe.decoded), 12);
      assert.equal(await page.evaluate(() => audioProbe.contexts.length), 1);
      let audioRequests = 0;
      page.on('request', request => { if (/\/audio\//.test(request.url())) audioRequests++; });
      await page.evaluate(() => {
        const button = document.createElement('button');
        button.id = 'audio-test-only'; button.textContent = 'Test';
        button.style = 'position:fixed;inset:0 auto auto 0;z-index:999999;width:100px;height:60px';
        document.body.append(button);
        document.addEventListener('click', () => {
          const started = performance.now();
          window.audioProbe.clicks.push({ at: started, sourcesBeforeRender: window.audioProbe.starts.length });
          while (performance.now() - started < 80) { /* simulate a costly view update */ }
        });
      });
      if (mobile) await page.locator('#audio-test-only').tap();
      else await page.locator('#audio-test-only').click();
      await page.waitForFunction(() => audioProbe.starts.length > 0);
      const cue = await page.evaluate(() => ({ start: audioProbe.starts[0], click: audioProbe.clicks[0], state: audioProbe.contexts[0].state, baseLatency: audioProbe.contexts[0].baseLatency }));
      assert.equal(cue.state, 'running');
      assert.equal(cue.click.sourcesBeforeRender, 1);
      const timings = await page.evaluate(async () => {
        AudioManager.stopEffects();
        const results = [];
        for (const name of ['uiTap', 'uiOpen', 'chopHit', 'itemDrop', 'forgeSuccess', 'dropRare', 'dropHigh', 'rewardReveal', 'rewardRare', 'rewardHigh', 'skillTrigger']) {
          const index = audioProbe.starts.length, at = performance.now();
          const played = await AudioManager.playEffect(name);
          results.push({ name, played, schedulingMs: audioProbe.starts[index].at - at });
          AudioManager.stopEffects();
        }
        await AudioManager.startLoop('forgeProcess');
        AudioManager.stopLoop('forgeProcess');
        await AudioManager.playBgm();
        AudioManager.setSuspended(true);
        const count = audioProbe.starts.length;
        await AudioManager.playEffect('chopHit');
        AudioManager.setSuspended(false);
        return { results, backgroundSafe: count === audioProbe.starts.length, media: audioProbe.media };
      });
      assert.ok(timings.results.every(result => result.played && result.schedulingMs < 30));
      assert.equal(timings.media, 1, 'only BGM uses a media element');
      assert.equal(timings.backgroundSafe, true);
      assert.equal(audioRequests, 1, 'only streaming BGM requests a file during playback');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ mobile, decoded: 12, ...cue, ...timings, audioRequests }));
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
