/* Local-only interaction/geometry check. No screenshots or account requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const root = path.resolve(__dirname, '..');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://mobile.local') return route.abort();
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        let data = await fs.readFile(file);
        if (relative === 'index.html') {
          let html = data.toString();
          for (const sheet of ['xianlai-v4.css', 'mobile-cultivation.css']) {
            if (!html.includes(`href="${sheet}`)) html = html.replace('</head>', `<link rel="stylesheet" href="${sheet}"></head>`);
          }
          if (!html.includes('src="mobile-cultivation.js')) html = html.replace('<script src="app.js', '<script src="mobile-cultivation.js"></script><script src="app.js');
          data = Buffer.from(html);
        }
        await route.fulfill({ status: 200, body: data, contentType: relative.endsWith('.css') ? 'text/css' : relative.endsWith('.js') ? 'application/javascript' : relative.endsWith('.html') ? 'text/html' : relative.endsWith('.webp') ? 'image/webp' : relative.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
      } catch {
        await route.fulfill({ status: 404, body: '' });
      }
    });

    const results = [];
    for (const viewport of [{ width: 360, height: 640 }, { width: 360, height: 540 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://mobile.local');
      await page.evaluate(() => {
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        Game.state = { level: 1, realmLevel: 1, treeRealm: 1, treeLevel: 1, axeId: '51001', axeInstanceId: 'equipped', coin: 1234, choppingCount: 50, exp: 0 };
        Game.equippedWeapon = null;
        Game.inventory = Object.values(ITEMS).filter(item => item.type >= 1 && item.type <= 4).map(item => ({ itemId: item.id, quantity: 12 }));
        Game.weapons = Array.from({ length: 12 }, (_, index) => ({ id: 'weapon-' + index, itemId: '51001', skillRolls: [] }));
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('player-dashboard').style.display = 'flex';
        Router.playerTab('cultivate', { force: true });
        window.probe = { chop: 0, forge: 0, tree: 0 };
        PlayerView.doChop = () => { probe.chop++; };
        PlayerView.showForge = () => { probe.forge++; };
        PlayerView.showTreeDetail = () => { probe.tree++; };
      });
      await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0), null, { timeout: 7000 });
      const loadedImages = await page.evaluate(() => document.images.length);
      const effectsCheck = await page.evaluate(async () => {
        const scene = document.getElementById('tree-area');
        const tree = document.getElementById('tree-icon');
        const leaf = new Image();
        leaf.src = 'assets/runtime/effects/leaf-ink.webp?v=ink-feedback-20260908';
        await leaf.decode();
        CultivationEffects.clear();
        const count = CultivationEffects.playHit({ scene, tree, speed: 1 });
        const effectStyles = Array.from(scene.querySelectorAll('.cult-effect')).map(el => {
          const style = getComputedStyle(el);
          return { name: style.animationName, delay: parseFloat(style.animationDelay), pointer: style.pointerEvents };
        });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 300));
        const visible = Array.from(scene.querySelectorAll('.cult-effect')).filter(el => Number(getComputedStyle(el).opacity) > .2).length;
        const animationState = Array.from(scene.querySelectorAll('.cult-effect')).map(el => ({ opacity: getComputedStyle(el).opacity, time: el.getAnimations().map(animation => animation.currentTime) }));
        const connected = scene.isConnected;
        CultivationEffects.clear();
        return { count, effectStyles, visible, animationState, connected, remaining: scene.querySelectorAll('.cult-effect').length, loaded: leaf.naturalWidth > 0 };
      });
      assert.equal(effectsCheck.count, 5);
      assert.equal(effectsCheck.loaded, true);
      assert.ok(effectsCheck.visible > 0, 'hit effects become visible after the swing delay: ' + JSON.stringify(effectsCheck));
      assert.ok(effectsCheck.effectStyles.every(style => style.pointer === 'none' && style.delay >= .18));
      assert.equal(effectsCheck.remaining, 0);
      const geometry = await page.evaluate(() => {
        const box = selector => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
        };
        return { main: box('#player-main'), scene: box('.cult-scene'), chop: box('#chop-btn'), count: box('.chop-count-badge'), toggle: box('.ten-toggle'), forge: box('.forge-btn'), nav: box('.bottom-nav'), width: document.documentElement.scrollWidth };
      });
      assert.ok(geometry.width <= viewport.width, 'no horizontal overflow');
      const mobile = viewport.width < 720 || viewport.height <= 500 && viewport.width <= 950;
      if (mobile && viewport.height > viewport.width) {
        assert.ok(geometry.nav.bottom <= viewport.height + 1, 'navigation remains onscreen');
        assert.ok(geometry.count.bottom < geometry.nav.y, 'chop count remains above navigation');
        assert.ok(geometry.scene.bottom < geometry.chop.y, 'scene stays above the chop controls');
        assert.ok(geometry.toggle.right < geometry.chop.x, 'ten chop does not overlap chop');
        assert.ok(geometry.forge.x > geometry.chop.right, 'forge does not overlap chop');
        assert.ok(Math.abs(geometry.count.x + geometry.count.width / 2 - geometry.chop.x - geometry.chop.width / 2) < 1, 'count centers on chop');
        for (const key of ['sprout', 'spirit', 'divine']) {
          await page.evaluate(key => { document.getElementById('tree-icon').className = 'cult-tree tree-appearance-' + key; }, key);
          await page.locator('#tree-icon').click();
        }
        await page.locator('#chop-btn').click();
        await page.locator('.forge-btn').click();
        assert.deepEqual(await page.evaluate(() => probe), { chop: 1, forge: 1, tree: 3 });
        await page.locator('.mobile-inventory-trigger').click();
        await page.waitForFunction(() => document.querySelector('.mobile-inventory-panel').getBoundingClientRect().bottom <= innerHeight + 1);
        const paper = await page.evaluate(() => {
          const style = selector => getComputedStyle(document.querySelector(selector));
          return {
            trigger: getComputedStyle(document.querySelector('.mobile-inventory-trigger'), '::before').borderImageSource,
            outer: style('.mobile-inventory-panel').borderImageSource,
            inside: style('.mobile-inventory-body .cult-inventory').backgroundColor,
            innerBlur: style('.mobile-inventory-body .cult-inventory').backdropFilter,
            equipBlur: style('.mobile-inventory-body .equip-info-bar').backdropFilter,
            title: style('.mobile-inventory-header h2').color,
          };
        });
        assert.ok(paper.trigger.includes('v3/ui/frame-topbar.webp'));
        assert.ok(paper.outer.includes('v4/ui/modal-paper.webp'));
        assert.equal(paper.inside, 'rgba(0, 0, 0, 0)');
        assert.equal(paper.innerBlur, 'none');
        assert.equal(paper.equipBlur, 'none');
        assert.equal(paper.title, 'rgb(37, 43, 41)');
        await page.locator('[data-tab="weapons"].inv-tab-v').click();
        await page.evaluate(() => { document.getElementById('inventory-grid').scrollTop = 150; });
        await page.locator('[data-tab="items"].inv-tab-v').click();
        await page.locator('[data-tab="weapons"].inv-tab-v').click();
        assert.equal(await page.evaluate(() => document.getElementById('inventory-grid').scrollTop), 150);
        await page.locator('.item-slot:not(.empty)').first().focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.modal-overlay').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.modal-overlay').count(), 0);
        assert.equal(await page.evaluate(() => document.querySelector('.mobile-inventory-overlay').hidden), false);
        await page.evaluate(() => { ITEMS['51001'].name = '一把名字特别长但是不应该把背包撑出手机屏幕的斧头'.repeat(3); });
        await page.evaluate(() => PlayerView.renderCultivate());
        assert.equal(await page.locator('#inventory-grid').count(), 1);
        assert.equal(await page.locator('.mobile-inventory-overlay').count(), 1);
        assert.equal(await page.evaluate(() => document.querySelector('.mobile-inventory-overlay').hidden), false);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        await page.locator('.mobile-inventory-trigger').click();
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForFunction(() => !document.getElementById('player-dashboard').classList.contains('mobile-cultivation'));
        assert.equal(await page.evaluate(() => document.querySelector('.forge-btn').parentElement.className), 'equip-info-bar');
        assert.equal(await page.evaluate(() => !!document.getElementById('inventory-grid').closest('#player-main')), true);
        await page.setViewportSize(viewport);
        await page.locator('.mobile-inventory-trigger').click();
        await page.evaluate(() => { PlayerView.renderTasks = () => { document.getElementById('player-main').innerHTML = 'Tasks fixture'; }; Router.playerTab('tasks'); });
        assert.equal(await page.locator('.mobile-inventory-overlay').count(), 0);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        assert.equal(await page.evaluate(() => document.getElementById('player-dashboard').inert), false);
      }
      results.push({ viewport, mobile, loadedImages, geometry, effectsCheck });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, pageErrors: errors, results }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
