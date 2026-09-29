/* Real DOM input and geometry checks, no screenshots, live login or remote writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function main() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [], checks = [];
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width < 720 });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.abort());
      await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>*{box-sizing:border-box}body{margin:0;height:1600px}main{position:relative;margin:210px auto 0;max-width:560px;padding:12px}
        #breakthrough-btn{display:block;margin-left:auto;width:76px;height:40px}
        #ten-label{display:block;padding:16px;margin-top:70px}#empty{width:60px;height:44px}</style>
        <main><button id="breakthrough-btn">突破</button>
        <label id="ten-label"><input id="toggle" type="checkbox">十连砍</label><button id="empty">其他操作</button></main>`);
      await page.addStyleTag({ content: await fs.readFile(path.join(root, 'demo-session.css'), 'utf8') });
      await page.addScriptTag({ content: await fs.readFile(path.join(root, 'demo-guide.js'), 'utf8') });
      await page.evaluate(() => {
        window.f = { current: true, opened: 0, other: 0, hint: DemoWeaponGuide.createBreakthroughHint() };
        f.show = () => f.hint.show({ getTarget: () => document.getElementById('breakthrough-btn'), isCurrent: () => f.current });
        document.getElementById('toggle').onchange = event => {
          if (event.target.checked) { event.target.checked = false; f.show(); }
        };
        document.getElementById('breakthrough-btn').onclick = () => { f.opened++; };
        document.getElementById('empty').onclick = () => { f.other++; };
      });
      const assertHint = async () => {
        assert.equal(await page.locator('.demo-breakthrough-hint').count(), 1);
        assert.equal(await page.locator('#toggle').isChecked(), false);
        const state = await page.evaluate(() => {
          const hint = document.querySelector('.demo-breakthrough-hint');
          const box = hint.getBoundingClientRect(), target = document.getElementById('breakthrough-btn').getBoundingClientRect();
          return { fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom < target.top,
            arrowError: Math.abs(box.left + parseFloat(hint.style.getPropertyValue('--hint-arrow-x')) - (target.left + target.width / 2)),
            pointer: getComputedStyle(hint).pointerEvents, text: hint.textContent,
            animation: getComputedStyle(hint.querySelector('.demo-breakthrough-hint-arrow')).animationName,
            active: f.hint.isActive() };
        });
        assert.ok(state.fits, 'hint is above its target and wholly in viewport');
        assert.ok(state.arrowError < 1, 'arrow points at the actual target center');
        assert.equal(state.pointer, 'none');
        assert.equal(state.text, '突破至中卡拉米，解锁十连砍');
        assert.equal(state.active, true);
      };
      await page.locator('#toggle').click();
      await assertHint();
      await page.locator('#breakthrough-btn').click();
      assert.equal(await page.locator('.demo-breakthrough-hint').count(), 0);
      assert.equal(await page.evaluate(() => f.opened), 1, 'same click dismisses and opens breakthrough');
      await page.locator('#ten-label').click();
      await assertHint();
      await page.locator('#empty').click();
      assert.equal(await page.evaluate(() => f.other), 1, 'other actions also retain the dismissing click');
      assert.equal(await page.locator('.demo-breakthrough-hint').count(), 0);
      // Repeated rejection replaces, not stacks; keyboard-generated checkbox clicks work too.
      for (let i = 0; i < 3; i++) { await page.locator('#toggle').click(); await assertHint(); }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.demo-breakthrough-hint').count(), 0);
      await page.locator('#toggle').focus();
      await page.keyboard.press('Space');
      await assertHint();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.demo-breakthrough-hint-arrow').evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => window.scrollTo(0, 45));
      await page.waitForTimeout(60);
      await assertHint();
      await page.setViewportSize({ ...viewport, width: viewport.width + 20 });
      await page.waitForTimeout(60);
      await assertHint();
      await page.evaluate(() => { const modal = document.createElement('div'); modal.className = 'modal-overlay'; document.body.append(modal); });
      await page.waitForSelector('.demo-breakthrough-hint', { state: 'detached' });
      await page.evaluate(() => document.querySelector('.modal-overlay').remove());
      await page.locator('#toggle').click();
      await assertHint();
      await page.evaluate(() => { f.current = false; window.dispatchEvent(new Event('resize')); });
      assert.equal(await page.locator('.demo-breakthrough-hint').count(), 0, 'stale session/page cancels on update');
      await page.evaluate(() => { f.current = true; });
      if (viewport.width < 720) {
        await page.locator('#toggle').tap();
        await assertHint();
        await page.locator('#breakthrough-btn').tap();
        assert.equal(await page.evaluate(() => f.opened), 2, 'touch input opens on first tap too');
      }
      await page.locator('#toggle').click();
      await assertHint();
      await page.evaluate(() => document.getElementById('breakthrough-btn').remove());
      await page.waitForSelector('.demo-breakthrough-hint', { state: 'detached' });
      assert.equal(await page.evaluate(() => f.show()), false, 'missing target safely refuses');
      assert.equal(await page.locator('.demo-breakthrough-hint').count(), 0);
      await page.evaluate(() => f.hint.cancel());
      checks.push({ viewport, mouse: true, keyboard: true, touch: viewport.width < 720,
        clickThrough: true, anchored: true, repeated: true, reducedMotion: true, teardown: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, checks, errors }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
