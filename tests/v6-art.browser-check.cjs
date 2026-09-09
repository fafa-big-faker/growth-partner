/* Local bitmap, geometry and native-form checks; no screenshots or account writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const VERSION = 'xianlai-v6-20260908';
const ASSETS = [
  ...Array.from({ length: 5 }, (_, index) => `assets/runtime/v6/quality/quality-${index + 1}.webp?v=${VERSION}`),
  ...['login-brush', 'login-lettering'].map(name => `assets/runtime/v6/ui/${name}.webp?v=${VERSION}`),
];

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const page = await browser.newPage();
  const pageErrors = [];
  const results = [];
  let failedAsset = '';
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://v6.local') return route.abort();
      if (failedAsset && url.pathname.endsWith(failedAsset)) return route.fulfill({ status: 404, body: '' });
      const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch {
        await route.fulfill({ status: 404, body: '' });
      }
    });

    async function loginStyle() {
      return page.evaluate(() => {
        const button = document.getElementById('login-submit');
        const brush = document.getElementById('login-submit-brush');
        const lettering = document.getElementById('login-submit-lettering');
        const rect = button.getBoundingClientRect();
        return {
          tag: button.tagName, type: button.type, disabled: button.disabled,
          buttonFilter: getComputedStyle(button).filter,
          brushFilter: getComputedStyle(brush).filter,
          letteringFilter: getComputedStyle(lettering).filter,
          brushPointer: getComputedStyle(brush).pointerEvents,
          letteringPointer: getComputedStyle(lettering).pointerEvents,
          width: rect.width, height: rect.height,
        };
      });
    }

    async function checkNativeLogin() {
      await page.evaluate(() => {
        window.v6VerifyCalls = 0;
        window.v6SubmitElement = document.getElementById('login-submit');
        AccountSession.verify = () => { v6VerifyCalls++; return new Promise(resolve => { window.v6VerifyDone = resolve; }); };
        AudioManager.playEffect = async () => {};
      });
      await page.locator('#login-password').fill('local-wrong-password');
      await page.locator('#login-submit').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => Auth._loggingIn && document.getElementById('login-form-panel').hidden);
      const pending = await page.evaluate(() => ({ calls: v6VerifyCalls, disabled: v6SubmitElement.disabled,
        loading: !document.getElementById('login-loading').hidden,
        sameElement: document.getElementById('login-submit') === v6SubmitElement }));
      assert.deepEqual(pending, { calls: 1, disabled: true, loading: true, sameElement: true });
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => v6VerifyCalls), 1, 'disabled loading cannot submit a second verification');
      await page.evaluate(() => v6VerifyDone(null));
      await page.waitForFunction(() => !Auth._loggingIn && !document.getElementById('login-form-panel').hidden);
      assert.equal(await page.locator('#login-submit').isDisabled(), false);
      assert.equal(await page.evaluate(() => document.getElementById('login-submit') === v6SubmitElement), true);
      return pending;
    }

    for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://v6.local');
      const images = await page.evaluate(async urls => Promise.all(urls.map(async url => {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0, transparent = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] > 10) visible++;
          if (!pixels[index]) transparent++;
        }
        return { url, width: canvas.width, height: canvas.height, visible, transparent };
      })), ASSETS);
      assert.equal(images.length, 7);
      assert.ok(images.every(image => image.width > 0 && image.height > 0 && image.visible > 10 && image.transparent > 0));
      await page.waitForFunction(() => ['login-submit-brush', 'login-submit-lettering'].every(id => {
        const image = document.getElementById(id);
        return image?.complete && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) > 0;
      }));
      await page.mouse.move(0, 0);
      const idle = await loginStyle();
      assert.equal(idle.tag, 'BUTTON'); assert.equal(idle.type, 'submit');
      assert.equal(idle.brushPointer, 'none'); assert.equal(idle.letteringPointer, 'none');
      await page.locator('#login-submit').hover();
      await page.waitForFunction(filter => getComputedStyle(document.getElementById('login-submit-lettering')).filter !== filter, idle.letteringFilter);
      const hover = await loginStyle();
      assert.equal(hover.buttonFilter, idle.buttonFilter);
      assert.equal(hover.brushFilter, idle.brushFilter);
      assert.notEqual(hover.letteringFilter, idle.letteringFilter);
      assert.equal(hover.width, idle.width); assert.equal(hover.height, idle.height);
      await page.mouse.move(0, 0);
      await page.waitForFunction(filter => getComputedStyle(document.getElementById('login-submit-lettering')).filter === filter, idle.letteringFilter);
      await page.keyboard.press('Tab');
      await page.locator('#login-submit').focus();
      await page.waitForFunction(filter => getComputedStyle(document.getElementById('login-submit-lettering')).filter !== filter, idle.letteringFilter);
      const focus = await loginStyle();
      assert.equal(focus.buttonFilter, idle.buttonFilter);
      assert.equal(focus.brushFilter, idle.brushFilter);
      assert.notEqual(focus.letteringFilter, idle.letteringFilter);
      const login = await checkNativeLogin();

      const quality = await page.evaluate(version => {
        LoginArt.setVisible(false);
        const oldLogin = document.getElementById('login-screen'); oldLogin.style.display = 'none';
        const dashboard = document.getElementById('player-dashboard');
        dashboard.style.cssText = 'display:block;min-height:0;height:auto;position:relative;padding:12px';
        const slotMarkup = Array.from({ length: 5 }, (_, index) => `<div class="item-slot quality-${index + 1}" data-quality="${index + 1}" style="width:72px;height:72px"><span class="item-new-badge">新</span><span class="item-count">999+</span></div>`).join('');
        dashboard.innerHTML = `<div class="v6-quality-fixture" style="display:flex;flex-wrap:wrap;gap:12px">${slotMarkup}</div>`;
        const drawer = document.createElement('section'); drawer.className = 'mobile-inventory-panel';
        drawer.style.cssText = 'position:relative;padding:12px';
        drawer.innerHTML = `<div class="v6-quality-fixture" style="display:flex;flex-wrap:wrap;gap:12px">${slotMarkup}</div>`;
        document.body.appendChild(drawer);
        window.v6SlotClicks = 0;
        for (const slot of document.querySelectorAll('.v6-quality-fixture .item-slot')) slot.addEventListener('click', () => v6SlotClicks++);
        const overlap = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        return [...document.querySelectorAll('.v6-quality-fixture .item-slot')].map(slot => {
          const style = getComputedStyle(slot, '::after');
          const slotRect = slot.getBoundingClientRect();
          const mark = { x: slotRect.x + parseFloat(style.left), y: slotRect.y + parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) };
          mark.right = mark.x + mark.width; mark.bottom = mark.y + mark.height;
          return { quality: Number(slot.dataset.quality), context: slot.closest('#player-dashboard') ? 'desktop' : 'drawer',
            image: style.backgroundImage, expected: `assets/runtime/v6/quality/quality-${slot.dataset.quality}.webp?v=${version}`,
            width: mark.width, height: mark.height, contain: style.backgroundSize,
            pointer: style.pointerEvents, newOverlap: overlap(mark, slot.querySelector('.item-new-badge').getBoundingClientRect()),
            countOverlap: overlap(mark, slot.querySelector('.item-count').getBoundingClientRect()),
            inside: mark.x >= slotRect.x && mark.y >= slotRect.y && mark.right <= slotRect.right && mark.bottom <= slotRect.bottom,
            point: { x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 } };
        });
      }, VERSION);
      assert.equal(quality.length, 10);
      for (const mark of quality) {
        assert.ok(mark.image.includes(mark.expected), `${mark.context} quality ${mark.quality} uses its actual bitmap`);
        assert.deepEqual([mark.width, mark.height, mark.contain, mark.pointer], [12, 26, 'contain', 'none']);
        assert.equal(mark.newOverlap, false); assert.equal(mark.countOverlap, false); assert.equal(mark.inside, true);
        await page.mouse.click(mark.point.x, mark.point.y);
      }
      assert.equal(await page.evaluate(() => v6SlotClicks), 10, 'quality artwork never intercepts inventory clicks');
      assert.equal(await page.evaluate(() => !!document.querySelector('.mobile-inventory-panel').closest('#player-dashboard')), false);
      results.push({ viewport, images, login, quality: quality.map(({ point, ...mark }) => mark) });
    }

    const fallbacks = [];
    await page.setViewportSize({ width: 390, height: 844 });
    for (const asset of ['login-brush.webp', 'login-lettering.webp']) {
      failedAsset = asset;
      await page.goto('http://v6.local');
      await page.waitForFunction(() => LoginBoot.getState().phase === 'error');
      assert.equal(await page.locator('.login-shell').evaluate(shell => shell.inert), true);
      assert.equal(await page.locator('#login-boot-retry').isVisible(), true);
      assert.equal(await page.locator('#login-boot-simple').isVisible(), false);
      const text = await page.locator('#login-boot-status').textContent();
      assert.ok(text.trim().length >= 2, 'failed critical art has a readable recovery state');
      failedAsset = '';
      await page.locator('#login-boot-retry').click();
      await page.waitForFunction(() => LoginBoot.getState().phase === 'ready');
      await checkNativeLogin();
      fallbacks.push({ failed: asset, text, recovered: true });
    }
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ ok: true, viewports: results.length, images: 7, pageErrors, fallbacks, results }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
