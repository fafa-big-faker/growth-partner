/* Full-app layout regression, isolated fixtures only: no screenshots or account writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const bounds = JSON.parse(await fs.readFile(path.join(root, 'assets/runtime/reward-bursts/manifest.json'), 'utf8')).assets;
  const errors = [], writes = [], checks = [];
  const page = await browser.newPage({ reducedMotion: 'no-preference' });
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method()); return route.abort(); }
      if (url.origin !== 'http://compact.local') return route.abort();
      const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        await route.fulfill({ body: await fs.readFile(file), contentType: {
          '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
          '.webp': 'image/webp', '.svg': 'image/svg+xml',
        }[path.extname(file)] || 'application/octet-stream' });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });

    for (const demo of [false, true]) {
      await page.goto(`http://compact.local/${demo ? '?demo=1' : ''}`);
      await page.evaluate(demo => {
        LoginArt.setVisible(false);
        AudioManager.playEffect = async () => false;
        document.getElementById('login-screen').style.display = 'none';
        // Select account display context without logging in or resetting any account.
        Auth.session = { environment: demo ? 'demo' : 'production' };
        window.compactFixture = async options => {
          const { quality, extra, longName } = options;
          ITEMS['compact-fixture'] = { ...ITEMS['40001'], id: 'compact-fixture',
            name: longName ? '这是用于检查窄屏换行的超长道具名称' : '开工石', quality };
          const item = { itemId: 'compact-fixture', quality, quantity: quality >= 3 ? 3 : 1,
            baseQuantity: 1, buffTriggers: quality >= 3
              ? [{ type: 1, beforeQuantity: 1, afterQuantity: 3, multiplier: 3, buffQuality: 5 }] : [] };
          if (extra) item.extraDrop = { itemId: 'compact-fixture', quality: 5, quantity: 99999 };
          const overlay = PlayerView._showRewardModal(item);
          overlay._rewardReveal?.finish();
          await Promise.all([...overlay.querySelectorAll('img')].map(image => image.decode().catch(() => {})));
          await Promise.all(overlay.querySelector('.modal').getAnimations()
            .filter(animation => animation.effect.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => {})));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        };
      }, demo);
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 },
        { width: 430, height: 932 }, { width: 390, height: 400 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        for (const variant of [{ quality: 1 }, { quality: 3 }, { quality: 5 }, { quality: 5, extra: true, longName: true }]) {
          await page.evaluate(options => compactFixture(options), variant);
          const metrics = await page.evaluate(({ bounds, quality }) => {
            const box = element => {
              const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
              return { x, y, width, height, right, bottom };
            };
            const modal = document.querySelector('.reward-dialog--single');
            const body = modal.querySelector('.modal-body');
            const item = modal.querySelector('.reward-item--large');
            const art = item.querySelector('.reward-art');
            const name = item.querySelector('.reward-item-name');
            const button = modal.querySelector('.reward-reveal-confirm');
            const violations = [];
            const burst = item.querySelector('.reward-burst');
            if (burst) {
              const b = box(burst);
              for (const frame of bounds[quality === 3 ? 'rare' : 'high'].frames) {
                const [left, top, right, bottom] = frame.alpha_bounds;
                const paint = { x: b.x + left / 256 * b.width, y: b.y + top / 256 * b.height,
                  right: b.x + right / 256 * b.width, bottom: b.y + bottom / 256 * b.height };
                for (const limit of [box(modal), box(body)]) {
                  if (paint.x < limit.x - 1 || paint.right > limit.right + 1
                    || paint.y < limit.y - 1 || paint.bottom > limit.bottom + 1) violations.push({ frame: frame.index, paint, limit });
                }
              }
            }
            return { modal: box(modal), body: box(body), art: box(art),
              icon: box(art.querySelector('.reward-art-icon')), nameFont: parseFloat(getComputedStyle(name).fontSize),
              button: box(button), buttonText: button.textContent.trim(),
              footerScrolls: body.contains(button), overflow: modal.scrollWidth > modal.clientWidth + 1,
              scrollbar: getComputedStyle(body).scrollbarWidth, violations };
          }, { bounds, quality: variant.quality });
          const context = JSON.stringify({ viewport, demo, variant, metrics });
          const mobile = viewport.width < 720;
          assert.ok(Math.abs(metrics.modal.width - (mobile ? 280 : 320)) < 1, 'scoped modal width: ' + context);
          assert.ok(Math.abs(metrics.art.width - (mobile ? 78 : 104)) < 1, 'scoped ink size: ' + context);
          assert.ok(Math.abs(metrics.icon.width - (mobile ? 62.4 : 83.2)) < 1, 'icon keeps its inset: ' + context);
          assert.equal(metrics.nameFont, mobile ? 15 : 17);
          assert.ok(metrics.button.height >= 43.9, 'collect touch area remains usable: ' + context);
          assert.equal(metrics.buttonText, '收下');
          assert.equal(metrics.footerScrolls, false);
          assert.equal(metrics.overflow, false, context);
          assert.equal(metrics.scrollbar, 'none');
          assert.ok(metrics.modal.y >= 11 && metrics.modal.bottom <= viewport.height - 11, 'dialog stays on screen: ' + context);
          assert.ok(metrics.button.bottom < viewport.height - 11 && metrics.button.y > 0, 'collect stays visible: ' + context);
          if (!variant.extra) {
            assert.deepEqual(metrics.violations, [], 'all twelve frames fit: ' + context);
            if (mobile) assert.ok(metrics.modal.height <= (variant.quality === 1 ? 262 : 288), 'compact height: ' + context);
          }
          await page.locator('.reward-reveal-confirm').click();
          await page.waitForFunction(() => !document.querySelector('.reward-dialog-overlay'));
          checks.push({ demo, viewport, ...variant, modal: [metrics.modal.width, metrics.modal.height], art: metrics.art.width });
        }
      }
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(JSON.stringify({ ok: true, cases: checks.length, checks, pageErrors: errors, writes: 0 }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
