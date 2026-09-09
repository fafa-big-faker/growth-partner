/* Local geometry, timing and click-through checks; no screenshots or real accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const page = await browser.newPage();
  const errors = [];
  const results = [];
  page.on('pageerror', error => errors.push(error.message));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/chop-refund-feedback.css"><style>
    body{margin:0;min-height:1800px}#underlay{position:fixed;inset:0;border:0;background:#e8f1ec;z-index:0}
    #bottom-bar{position:fixed;bottom:0;left:0;right:0;height:128px;pointer-events:none}
    #chop-button{position:fixed;bottom:28px;left:50%;width:88px;height:88px;padding:0;border:0;background:transparent;transform:translateX(-50%);z-index:2}
    #chop-button img{width:100%;height:100%;object-fit:contain;pointer-events:none}
    </style></head><body><button id="underlay" aria-label="Scene"></button><div id="bottom-bar"></div>
    <button id="chop-button" aria-label="Chop"><img src="/assets/runtime/v2/ui/chop-button-bg.webp" alt=""></button>
    <script src="/chop-refund-feedback.js"></script><script>
    window.probe={chops:0,scene:0,played:[],stopped:[]};window.audio={playEffect(name,options){probe.played.push({name,...options});return Promise.resolve()},stopEffects(group){probe.stopped.push(group)}};
    document.getElementById('chop-button').addEventListener('click',()=>probe.chops++);
    document.getElementById('underlay').addEventListener('click',()=>probe.scene++);
    </script></body></html>`;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://refund.local') return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
    const file = path.resolve(root, url.pathname.replace(/^\//, ''));
    if (!file.startsWith(root + path.sep)) return route.abort();
    try {
      return route.fulfill({ body: await fs.readFile(file), contentType:
        { '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream' });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  try {
    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://refund.local');
      const repeated = await page.evaluate(async () => {
        const button = document.getElementById('chop-button');
        const bar = document.getElementById('bottom-bar');
        const baseline = bar.getBoundingClientRect().height;
        const samples = [];
        for (let index = 0; index < 12; index++) {
          const synchronous = ChopRefundFeedback.show(button, index + 1, { audio });
          if (synchronous !== true) throw new Error('Feedback must return synchronously');
          for (let frame = 0; frame < 5; frame++) {
            await new Promise(requestAnimationFrame);
            const rows = [...document.querySelectorAll('.chop-refund-row')];
            const visible = rows.map(row => row.querySelector('.chop-refund-copy'))
              .filter(copy => Number(getComputedStyle(copy).opacity) > .08)
              .map(copy => { const rect = copy.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }; })
              .sort((a, b) => a.top - b.top);
            samples.push({ count: rows.length, overlap: visible.some((rect, item) => item > 0 && visible[item - 1].bottom > rect.top + 1),
              outside: visible.some(rect => rect.left < 0 || rect.right > innerWidth || rect.top < 0),
              barChanged: bar.getBoundingClientRect().height !== baseline, overflow: document.documentElement.scrollWidth > innerWidth });
          }
        }
        return { samples, played: probe.played.length, messages: [...document.querySelectorAll('.chop-refund-row')].map(row => row.textContent) };
      });
      assert.ok(repeated.samples.every(sample => sample.count <= 4), 'nodes are capped');
      assert.ok(repeated.samples.every(sample => !sample.overlap), `visible rows never overlap: ${JSON.stringify(repeated.samples.filter(sample => sample.overlap))}`);
      assert.ok(repeated.samples.every(sample => !sample.outside && !sample.barChanged && !sample.overflow));
      assert.ok(repeated.played > 0 && repeated.played < 6, 'dense calls keep audio bounded');
      assert.equal(repeated.messages.length, 4);
      await page.locator('#chop-button').click();
      assert.equal(await page.evaluate(() => probe.chops), 1);
      const point = await page.locator('.chop-refund-copy').last().evaluate(copy => {
        const rect = copy.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
          target: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.id };
      });
      assert.equal(point.target, 'underlay');
      await page.mouse.click(point.x, point.y);
      assert.equal(await page.evaluate(() => probe.scene), 1);

      await page.evaluate(() => {
        const button = document.getElementById('chop-button');
        button.style.position = 'absolute'; button.style.top = '480px'; button.style.bottom = 'auto';
        button.style.transform = 'translateX(-50%) scale(1.25)';
        window.scrollTo(0, 100);
        ChopRefundFeedback.show(button, 4, { audio });
      });
      await page.waitForFunction(() => {
        const button = document.getElementById('chop-button').getBoundingClientRect();
        const feed = document.querySelector('.chop-refund-feed')?.getBoundingClientRect();
        return feed && Math.abs(feed.top - (button.top - 10)) < 1;
      });
      const alignment = await page.evaluate(() => ({
        button: document.getElementById('chop-button').getBoundingClientRect().top,
        feed: document.querySelector('.chop-refund-feed').getBoundingClientRect().top,
      }));
      assert.equal(alignment.feed, alignment.button - 10);

      await page.evaluate(() => ChopRefundFeedback.clear());
      assert.equal(await page.locator('.chop-refund-feed').count(), 0);
      await page.evaluate(() => ChopRefundFeedback.show(document.getElementById('chop-button'), 6, { audio }));
      await page.waitForFunction(() => {
        const copy = document.querySelector('.chop-refund-leaving .chop-refund-copy');
        return copy && Number(getComputedStyle(copy).opacity) < .95;
      });
      await page.waitForFunction(() => !document.querySelector('.chop-refund-feed'));
      await page.evaluate(() => {
        ChopRefundFeedback.show(document.getElementById('chop-button'), 2, { audio });
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
      });
      assert.equal(await page.locator('.chop-refund-feed').count(), 0);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => ChopRefundFeedback.show(document.getElementById('chop-button'), 8, { audio }));
      const reduced = await page.locator('.chop-refund-copy').evaluate(copy => ({
        animation: getComputedStyle(copy).animationName, transition: getComputedStyle(copy).transitionDuration,
      }));
      assert.deepEqual(reduced, { animation: 'none', transition: '0s' });
      await page.waitForFunction(() => !document.querySelector('.chop-refund-feed'));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => {
        const button = document.getElementById('chop-button');
        ChopRefundFeedback.show(button, 1, { audio });
        button.remove();
      });
      await page.waitForFunction(() => !document.querySelector('.chop-refund-feed'));
      assert.equal(await page.evaluate(() => probe.stopped.at(-1)), 'chop-refunds');
      results.push({ viewport, samples: repeated.samples.length, maxRows: Math.max(...repeated.samples.map(sample => sample.count)),
        audioCues: repeated.played, clickThrough: true, alignment, reduced, fade: true, hiddenCleanup: true, removedCleanup: true });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, errors, results, screenshots: 0, externalRequests: 0 }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
