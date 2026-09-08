/* Local-only interaction/geometry check. No screenshots or account requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

function isInside(outer, inner, tolerance = 1) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance
    && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
}

async function inspectGrid(page, selector) {
  return page.evaluate(selector => {
    const box = node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    return Array.from(document.querySelectorAll(`${selector} .item-slot:not(.empty)`)).map(slot => ({
      slot: box(slot),
      icon: box(slot.querySelector('.item-icon img')),
      badges: Array.from(slot.querySelectorAll('.item-new-badge, .item-count')).map(badge => {
        const style = getComputedStyle(badge);
        return { type: badge.className, box: box(badge), font: parseFloat(style.fontSize),
          background: style.backgroundColor, image: style.backgroundImage, border: style.borderWidth,
          shadow: style.boxShadow, pointer: style.pointerEvents };
      }),
    }));
  }, selector);
}

function checkCompactBadges(cells) {
  const badges = cells.flatMap(cell => cell.badges);
  assert.ok(badges.some(badge => badge.type === 'item-new-badge'), 'new-item fixture is rendered');
  for (const cell of cells) {
    for (const badge of cell.badges) {
      assert.ok(isInside(cell.slot, badge.box), 'badge stays inside its own slot: ' + JSON.stringify(badge));
      assert.equal(badge.background, 'rgba(0, 0, 0, 0)', 'badges have no opaque backing');
      assert.equal(badge.image, 'none');
      assert.equal(badge.border, '0px');
      assert.equal(badge.shadow, 'none');
      assert.equal(badge.pointer, 'none');
      assert.ok(badge.font >= 8 && badge.font <= 10 && badge.box.height <= 14, 'badges remain compact');
      if (badge.type === 'item-new-badge') assert.ok(badge.box.width <= 16, 'new mark is not a large plate');
    }
  }
}

function checkWeaponRows(cells) {
  assert.ok(cells.length >= 8, 'multiple weapon rows are exercised');
  cells.forEach((cell, index) => {
    assert.ok(cell.slot.width >= 44 && cell.slot.height >= 44, 'weapon touch target stays usable');
    assert.ok(Math.abs(cell.slot.height - cell.slot.width * 4 / 3) < 1, 'weapon slot keeps 3:4 geometry: ' + JSON.stringify(cell));
    assert.ok(isInside(cell.slot, cell.icon), 'weapon icon stays inside its slot: ' + JSON.stringify(cell));
    assert.ok(cell.icon.width >= 35, 'library axes do not fall back to legacy 28px icons');
    if (index % 2 === 1) {
      assert.ok(Math.abs(cell.slot.y - cells[index - 1].slot.y) < 1, 'two weapon columns align');
      assert.ok(cell.slot.x >= cells[index - 1].slot.right + 2, 'weapon columns do not overlap');
    }
    if (index >= 2) {
      const gap = cell.slot.y - cells[index - 2].slot.bottom;
      assert.ok(gap >= 2 && gap <= 12, 'weapon rows stay separated without excess spacing: ' + JSON.stringify({ index, gap, cell }));
    }
  });
  checkCompactBadges(cells);
}

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
    for (const viewport of [{ width: 360, height: 640 }, { width: 360, height: 540 }, { width: 360, height: 480 }, { width: 390, height: 680 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://mobile.local');
      await page.evaluate(() => {
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        Game.state = { level: 1, realmLevel: 1, treeRealm: 1, treeLevel: 1, axeId: '51001', axeInstanceId: 'equipped', coin: 1234, choppingCount: 50, exp: 0 };
        Game.inventory = Object.values(ITEMS).filter(item => item.type >= 1 && item.type <= 4).map(item => ({ itemId: item.id, quantity: 12 }));
        Game.weapons = [{ id: 'equipped', itemId: '51001', skillRolls: [] }, ...Array.from({ length: 12 }, (_, index) => ({ id: 'weapon-' + index, itemId: '51001', skillRolls: [] }))];
        InventoryNewState.setRole(`mobile-geometry-${innerWidth}-${innerHeight}`);
        InventoryNewState.sync([], []);
        InventoryNewState.sync(Game.inventory, Game.weapons);
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
        const effects = Array.from(scene.querySelectorAll('.cult-effect'));
        const effectStyles = effects.map(el => {
          const style = getComputedStyle(el);
          return { name: style.animationName, delay: parseFloat(style.animationDelay), pointer: style.pointerEvents };
        });
        const animations = effects.flatMap(el => el.getAnimations());
        await Promise.all(animations.map(animation => animation.ready));
        // Sample the real CSS animation timeline instead of assuming headless frame timing.
        for (const animation of animations) {
          const timing = animation.effect.getTiming();
          animation.pause();
          animation.currentTime = timing.delay + timing.duration * .35;
        }
        const visible = effects.filter(el => Number(getComputedStyle(el).opacity) > .2).length;
        const animationState = effects.map(el => ({
          opacity: getComputedStyle(el).opacity,
          animations: el.getAnimations().map(animation => ({
            time: animation.currentTime,
            delay: animation.effect.getTiming().delay,
            duration: animation.effect.getTiming().duration,
          })),
        }));
        const connected = scene.isConnected;
        CultivationEffects.clear();
        return { count, effectStyles, visible, animationState, connected, remaining: scene.querySelectorAll('.cult-effect').length, loaded: leaf.naturalWidth > 0 };
      });
      assert.equal(effectsCheck.count, 5);
      assert.equal(effectsCheck.loaded, true);
      assert.ok(effectsCheck.visible > 0, 'hit effects become visible after the swing delay: ' + JSON.stringify(effectsCheck));
      assert.ok(effectsCheck.animationState.every(effect => effect.animations.length > 0 && effect.animations.every(animation => Number.isFinite(animation.duration) && animation.time > animation.delay && animation.time < animation.delay + animation.duration)), 'effects are sampled within their active animation interval');
      assert.ok(effectsCheck.effectStyles.every(style => style.pointer === 'none' && style.delay >= .18));
      assert.equal(effectsCheck.remaining, 0);
      const geometry = await page.evaluate(() => {
        const box = selector => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
        };
        const nav = box('.bottom-nav');
        const paper = getComputedStyle(document.querySelector('.bottom-nav'), '::before');
        const paperHeight = parseFloat(paper.height);
        return { main: box('#player-main'), scene: box('.cult-scene'), chop: box('#chop-btn'),
          chopArt: getComputedStyle(document.getElementById('chop-btn')).backgroundImage,
          count: box('.chop-count-badge'), toggle: box('.ten-toggle'), forge: box('.forge-btn'), nav,
          navPaper: { height: paperHeight, y: nav.bottom - parseFloat(paper.bottom) - paperHeight, art: paper.borderImageSource, pointer: paper.pointerEvents },
          width: document.documentElement.scrollWidth };
      });
      assert.ok(geometry.width <= viewport.width, 'no horizontal overflow');
      const mobile = viewport.width < 720 || viewport.height <= 500 && viewport.width <= 950;
      if (mobile) {
        assert.ok(geometry.navPaper.height >= 62 && geometry.navPaper.height <= 76, 'navigation paper is a shallow bottom strip: ' + JSON.stringify(geometry));
        assert.match(geometry.navPaper.art, /v3\/ui\/frame-nav.webp/);
        assert.equal(geometry.navPaper.pointer, 'none');
        assert.ok(geometry.toggle.bottom <= geometry.navPaper.y + 1, 'paper does not rise behind ten-chop control: ' + JSON.stringify(geometry));
        assert.ok(geometry.forge.bottom <= geometry.navPaper.y + 1, 'paper does not rise behind forge control: ' + JSON.stringify(geometry));
      }
      if (mobile && viewport.height > viewport.width) {
        assert.ok(geometry.nav.bottom <= viewport.height + 1, 'navigation remains onscreen');
        assert.ok(geometry.count.bottom <= viewport.height, 'chop count remains onscreen within unified navigation');
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
        assert.equal(await page.locator('.mobile-inventory-overlay').count(), 0, 'legacy drawer is gone');
        assert.equal(await page.locator('#inventory-grid').count(), 1, 'one item grid');
        const splitGeometry = await page.evaluate(() => {
          const left = document.querySelector('.mobile-items-pane').getBoundingClientRect();
          const right = document.querySelector('.mobile-equipment-pane').getBoundingClientRect();
          const paper = document.querySelector('.mobile-inventory-columns');
          const paperStyle = getComputedStyle(paper);
          const beforeStyle = getComputedStyle(paper, '::before');
          const slots = Array.from(document.querySelectorAll('#inventory-grid .item-slot')).map(node => node.getBoundingClientRect().width);
          return { ratio: left.width / right.width, separated: left.right <= right.x + 1,
            art: paperStyle.borderImageSource + beforeStyle.borderImageSource + paperStyle.backgroundImage,
            slots, bottom: paper.getBoundingClientRect().bottom };
        });
        assert.ok(splitGeometry.ratio > 1.3 && splitGeometry.ratio < 1.8, 'inventory uses a clear 3:2 split');
        assert.ok(splitGeometry.separated);
        assert.match(splitGeometry.art, /v7\/ui\/inventory-paper.webp/);
        assert.ok(splitGeometry.slots.every(width => width >= 44), 'item touch targets are at least 44px');
        const itemGeometry = await inspectGrid(page, '#inventory-grid');
        assert.ok(itemGeometry.every(cell => isInside(cell.slot, cell.icon)), 'item icons stay bounded by their slots');
        checkCompactBadges(itemGeometry);
        const equipmentStyle = await page.evaluate(() => {
          const tag = document.querySelector('.mobile-equipped-quality .tag');
          const button = document.getElementById('mobile-weapon-toggle');
          const rect = button.getBoundingClientRect();
          return { tag: tag ? { text: tag.textContent, background: getComputedStyle(tag).backgroundColor,
            height: tag.getBoundingClientRect().height } : null,
          button: { art: getComputedStyle(button).borderImageSource, width: rect.width, height: rect.height } };
        });
        assert.ok(equipmentStyle.tag?.text, 'equipment quality uses the shared backed tag');
        assert.notEqual(equipmentStyle.tag.background, 'rgba(0, 0, 0, 0)');
        assert.ok(equipmentStyle.tag.height >= 16 && equipmentStyle.tag.height <= 26);
        assert.match(equipmentStyle.button.art, /v3\/ui\/button-primary.webp/);
        assert.ok(equipmentStyle.button.height >= 44);
        const skillVisible = await page.evaluate(() => {
          const content = document.getElementById('mobile-equipment-content').getBoundingClientRect();
          const skill = document.querySelector('.mobile-equipped-skills').getBoundingClientRect();
          return skill.y + 12 <= content.bottom;
        });
        assert.ok(skillVisible, 'current skill begins onscreen without scrolling the equipment');
        assert.equal(await page.locator('#mobile-weapon-toggle').textContent(), '武器库');
        const leftScroll = await page.evaluate(() => {
          const grid = document.getElementById('inventory-grid');
          grid.scrollTop = 100;
          return grid.scrollTop;
        });
        assert.ok(leftScroll > 0, 'items scroll internally');
        await page.locator('#mobile-weapon-toggle').click();
        assert.equal(await page.locator('#mobile-weapon-toggle').textContent(), '返回');
        if (viewport.height <= 519) {
          const shortScreen = await page.evaluate(() => {
            const main = document.getElementById('player-main');
            const toggle = document.getElementById('mobile-weapon-toggle').getBoundingClientRect();
            const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
            return { scroll: main.scrollTop, scrollable: main.scrollHeight > main.clientHeight,
              overflow: getComputedStyle(main).overflowY, toggleBottom: toggle.bottom, navTop: nav.y };
          });
          assert.ok(shortScreen.scrollable && shortScreen.overflow === 'auto', 'short screens scroll the main content instead of clipping it');
          assert.ok(shortScreen.scroll > 0 && shortScreen.toggleBottom <= shortScreen.navTop + 1, 'weapon toggle scrolls into view above fixed navigation: ' + JSON.stringify(shortScreen));
        }
        assert.equal(await page.locator('#mobile-weapon-grid .weapon-slot').count(), 13);
        checkWeaponRows(await inspectGrid(page, '#mobile-weapon-grid'));
        const returnButtonStyle = await page.locator('#mobile-weapon-toggle').evaluate(node => ({
          art: getComputedStyle(node).borderImageSource, width: node.offsetWidth, height: node.offsetHeight,
        }));
        assert.equal(returnButtonStyle.art, equipmentStyle.button.art, 'library and return share the backed button');
        assert.ok(Math.abs(returnButtonStyle.width - equipmentStyle.button.width) < 1);
        assert.ok(Math.abs(returnButtonStyle.height - equipmentStyle.button.height) < 1);
        assert.match(await page.locator('#mobile-weapon-grid .weapon-slot').first().getAttribute('onclick'), /equipped/);
        await page.locator('#mobile-weapon-grid .weapon-slot').first().focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.modal-overlay').count(), 1);
        assert.equal(await page.locator('.weapon-detail-actions').innerText(), '当前装备');
        assert.equal(await page.locator('.weapon-detail-actions button').count(), 0, 'current axe cannot be sold or re-equipped');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.modal-overlay').count(), 0);
        assert.equal(await page.locator('#mobile-weapon-toggle').textContent(), '返回');
        assert.equal(await page.evaluate(() => document.getElementById('inventory-grid').scrollTop), leftScroll);
        const rightScroll = await page.evaluate(() => {
          const grid = document.getElementById('mobile-weapon-grid');
          grid.scrollTop = 100;
          return grid.scrollTop;
        });
        assert.ok(rightScroll > 0, 'weapons scroll independently');
        checkWeaponRows(await inspectGrid(page, '#mobile-weapon-grid'));
        await page.locator('#mobile-weapon-toggle').click();
        assert.equal(await page.locator('#mobile-weapon-toggle').textContent(), '武器库', 'return without equipping');
        await page.locator('#mobile-weapon-toggle').click();
        assert.equal(await page.evaluate(() => document.getElementById('mobile-weapon-grid').scrollTop), rightScroll);
        await page.evaluate(() => {
          Game.state.axeInstanceId = 'weapon-1';
          ITEMS['51001'].name = '一把名字特别长但是不应该把背包撑出手机屏幕的斧头'.repeat(3);
        });
        await page.evaluate(() => PlayerView.renderCultivate());
        assert.equal(await page.locator('#inventory-grid').count(), 1);
        assert.equal(await page.locator('#mobile-weapon-toggle').textContent(), '返回');
        assert.equal(await page.evaluate(() => document.getElementById('inventory-grid').scrollTop), leftScroll);
        assert.equal(await page.evaluate(() => document.getElementById('mobile-weapon-grid').scrollTop), rightScroll);
        assert.match(await page.locator('#mobile-weapon-grid .weapon-slot').first().getAttribute('onclick'), /weapon-1/);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.evaluate(() => {
          PlayerView.renderTasks = () => { document.getElementById('player-main').innerHTML = '<p>Tasks fixture</p>'; };
          PlayerView.renderReward = () => { document.getElementById('player-main').innerHTML = '<p>Shop fixture</p>'; };
        });
        for (const tab of ['tasks', 'reward']) {
          await page.locator(`#player-dashboard .bottom-nav [data-tab="${tab}"]`).click();
          const back = page.locator('#player-dashboard .bottom-nav [data-tab="cultivate"]');
          await back.locator('img').evaluate(image => image.decode());
          const backGeometry = await back.evaluate(node => {
            const rect = node.getBoundingClientRect();
            const image = node.querySelector('img');
            const imageRect = image.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
              background: getComputedStyle(node).backgroundImage, label: node.getAttribute('aria-label'),
              visibleText: node.innerText, image: image.getAttribute('src'),
              iconWidth: imageRect.width, iconHeight: imageRect.height, loaded: image.naturalWidth > 0 };
          });
          assert.equal(backGeometry.label, '返回修仙');
          assert.equal(backGeometry.visibleText, '', 'return is an icon command, not a tiny text tab');
          assert.equal(backGeometry.background, geometry.chopArt, 'return reuses the actual chop circle artwork');
          for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(backGeometry[key] - geometry.chop[key]) < 1, `return circle preserves chop ${key}: ` + JSON.stringify(backGeometry));
          assert.match(backGeometry.image, /\/undo-2\.svg$/);
          assert.ok(backGeometry.loaded && backGeometry.iconWidth >= 48 && backGeometry.iconHeight >= 48, 'return undo icon is loaded and prominent');
          assert.equal(await page.locator('#chop-btn:visible').count(), 0);
          assert.equal(await page.locator('.ten-toggle:visible').count(), 0);
          assert.equal(await page.locator('.forge-btn:visible').count(), 0);
        }
        await page.locator('#player-dashboard .bottom-nav [data-tab="cultivate"]').click();
        assert.equal(await page.locator('#mobile-weapon-toggle').textContent(), '返回');
        assert.equal(await page.evaluate(() => document.getElementById('inventory-grid').scrollTop), leftScroll);
        assert.equal(await page.evaluate(() => document.getElementById('mobile-weapon-grid').scrollTop), rightScroll);
        await page.evaluate(() => { PlayerView.currentInvTab = 'weapons'; });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForFunction(() => !document.getElementById('player-dashboard').classList.contains('mobile-cultivation'));
        assert.equal(await page.evaluate(() => document.querySelector('.forge-btn').parentElement.className), 'equip-info-bar');
        assert.equal(await page.evaluate(() => !!document.getElementById('inventory-grid').closest('#player-main')), true);
        assert.equal(await page.evaluate(() => document.getElementById('inventory-grid').classList.contains('weapons-grid')), true, 'desktop tab restored');
        await page.setViewportSize(viewport);
        await page.waitForFunction(() => document.getElementById('player-dashboard').classList.contains('mobile-cultivation'));
        assert.equal(await page.evaluate(() => document.getElementById('inventory-grid').classList.contains('weapons-grid')), false);
        assert.equal(await page.evaluate(() => document.getElementById('inventory-grid').scrollTop), leftScroll, 'item scroll survives responsive round trip');
        assert.equal(await page.evaluate(() => document.getElementById('mobile-weapon-grid').scrollTop), rightScroll, 'weapon scroll survives responsive round trip');
        await page.evaluate(() => Auth.logout());
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
