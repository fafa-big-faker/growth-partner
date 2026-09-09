/* Local mocked inventory sorting and scroll preservation. No screenshots or account requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function snapshot(page) {
  return page.evaluate(() => {
    const slots = [...document.querySelectorAll('#inventory-grid .item-slot:not(.empty)')].map(slot => {
      const id = slot.getAttribute('onclick').match(/showItemDetail\('([^']+)'/)?.[1];
      return { id, count: slot.querySelector('.item-count').textContent,
        isNew: Boolean(slot.querySelector('.item-new-badge')) };
    });
    return {
      order: slots.map(slot => slot.id),
      content: Object.fromEntries(slots.map(({ id, ...content }) => [id, content])),
      leftScroll: document.getElementById('inventory-grid').scrollTop,
      rightScroll: document.getElementById('mobile-weapon-grid').scrollTop,
      mode: document.getElementById('mobile-weapon-toggle').getAttribute('aria-expanded'),
      weaponIds: [...document.querySelectorAll('#mobile-weapon-grid .weapon-slot')]
        .map(slot => slot.getAttribute('onclick').match(/showItemDetail\('[^']+','([^']+)'/)?.[1]),
      currentWeapon: Game.state.axeInstanceId,
      legacyTab: PlayerView.currentInvTab,
      inventory: JSON.stringify(Game.inventory),
      weapons: JSON.stringify(Game.weapons),
      gridCount: document.querySelectorAll('#inventory-grid').length,
    };
  });
}

function sameRight(before, after) {
  for (const field of ['rightScroll', 'mode', 'weaponIds', 'currentWeapon', 'weapons', 'legacyTab', 'gridCount']) {
    assert.deepEqual(after[field], before[field], `sorting preserves ${field}`);
  }
}

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const page = await browser.newPage();
  const errors = [], writes = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method()); return route.abort(); }
      const url = new URL(request.url());
      if (url.origin !== 'http://inventory-sort.local') return route.abort();
      const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
          '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });

    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://inventory-sort.local');
      await page.waitForFunction(() => typeof InventoryOrder !== 'undefined' && typeof PlayerView !== 'undefined');
      await page.evaluate(() => LoginBoot.whenReady());
      const expectedOrder = await page.evaluate(() => {
        LoginArt.setVisible(false);
        AudioManager.setMuted(true);
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        UI.toast = () => {};
        DB.playerRole = `inventory-sort-fixture-${innerWidth}`;
        localStorage.removeItem(`growth-partner:inventory-order:${DB.playerRole}`);
        PlayerView._inventoryOrderStore = null;
        PlayerView._inventoryOrderAccount = null;
        PlayerView.currentInvTab = 'weapons';

        const source = Object.values(ITEMS).find(item => item.type === 1);
        const materialIcon = getItemIconPath(source.id, source.iconImage);
        const ids = ['99', '100', '9', '10', '1000', '21', ...Array.from({ length: 30 }, (_, index) => String(81000 + index))];
        ids.forEach((id, index) => {
          ITEMS[id] = { ...source, id, type: index % 4 + 1, name: `Sort fixture ${id}`, iconImage: materialIcon };
        });
        // Numeric IDs with the same type must sort numerically, not lexicographically.
        for (const id of ['99', '100', '9', '10']) ITEMS[id].type = 1;
        Game.inventory = [...ids].reverse().map((itemId, index) => ({ itemId, quantity: index * 7 + 1 }));
        const axe = Object.values(ITEMS).find(item => item.type === 5);
        Game.weapons = Array.from({ length: 20 }, (_, index) => ({ id: `sort-weapon-${index}`, itemId: String(axe.id), skillRolls: [] }));
        Game.equippedWeapon = Game.weapons[3];
        Game.state = { level: 1, realmLevel: 1, treeRealm: 1, treeLevel: 1, exp: 0, coin: 100,
          choppingCount: 50, axeId: String(axe.id), axeInstanceId: Game.equippedWeapon.id };
        InventoryNewState.setRole(DB.playerRole);
        InventoryNewState.sync([], []);
        InventoryNewState.sync(Game.inventory, Game.weapons);
        InventoryNewState.clearItem('99');
        InventoryNewState.clearItem('10');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('player-dashboard').style.display = 'flex';
        Router.playerTab('cultivate', { force: true });
        return [...Game.inventory].sort((a, b) => ITEMS[a.itemId].type - ITEMS[b.itemId].type || Number(a.itemId) - Number(b.itemId))
          .map(item => item.itemId);
      });
      await settle(page);
      await page.locator('#mobile-weapon-toggle').click();
      await settle(page);
      await page.evaluate(() => {
        document.getElementById('inventory-grid').scrollTop = 80;
        document.getElementById('mobile-weapon-grid').scrollTop = 96;
      });
      await settle(page);
      const before = await snapshot(page);
      assert.equal(before.leftScroll, 80, 'left fixture must really scroll');
      assert.equal(before.rightScroll, 96, 'right fixture must really scroll');
      assert.equal(before.mode, 'true', 'weapon library must be open');
      assert.equal(before.legacyTab, 'weapons', 'sorting must not overwrite the legacy tab preference');
      assert.notDeepEqual(before.order, expectedOrder, 'fixture starts unsorted');
      assert.ok(Object.values(before.content).some(item => item.isNew) && Object.values(before.content).some(item => !item.isNew));

      const geometry = await page.locator('#inventory-sort').evaluate(button => {
        const control = button.getBoundingClientRect();
        const grid = document.getElementById('inventory-grid').getBoundingClientRect();
        const pane = button.parentElement.getBoundingClientRect();
        return { width: control.width, height: control.height, top: control.top, bottom: control.bottom,
          gridBottom: grid.bottom, paneBottom: pane.bottom, outsideGrid: !button.closest('#inventory-grid'),
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(geometry.width >= 44 && geometry.height >= 43.99, 'sort uses a full touch target');
      assert.ok(geometry.outsideGrid && geometry.top >= geometry.gridBottom - 0.75, 'sort is outside the scrollable cells');
      assert.ok(geometry.bottom <= geometry.paneBottom + 0.75 && !geometry.horizontalOverflow, 'sort fits its pane');

      await page.locator('#inventory-sort').click();
      await settle(page);
      const sorted = await snapshot(page);
      assert.deepEqual(sorted.order, expectedOrder, 'real button sorts by type and numeric ID');
      assert.deepEqual(sorted.content, before.content, 'quantities and new markers survive sorting');
      assert.equal(sorted.inventory, before.inventory, 'sorting changes presentation only');
      assert.equal(sorted.leftScroll, 0, 'sort resets only the left scroll');
      sameRight(before, sorted);

      await page.evaluate(() => PlayerView.renderInventory(PlayerView.currentInvTab));
      await settle(page);
      assert.deepEqual(await snapshot(page), sorted, 'background inventory render preserves explicit order and both scroll positions');
      await page.evaluate(() => {
        PlayerView._inventoryOrderStore = null;
        PlayerView._inventoryOrderAccount = null;
        PlayerView.renderInventory(PlayerView.currentInvTab);
      });
      await settle(page);
      assert.deepEqual(await snapshot(page), sorted, 'order is restored from local account storage');

      await page.evaluate(() => {
        ITEMS['8'] = { ...ITEMS['9'], id: '8', name: 'New sort fixture' };
        Game.inventory.unshift({ itemId: '8', quantity: 37 });
        Game._syncInventoryNovelty();
        PlayerView.renderInventory(PlayerView.currentInvTab);
      });
      await settle(page);
      const appended = await snapshot(page);
      assert.deepEqual(appended.order, [...expectedOrder, '8'], 'a newly received kind appends until explicit sorting');
      assert.deepEqual(appended.content['8'], { count: '\u00d737', isNew: true });
      assert.deepEqual(Object.fromEntries(Object.entries(appended.content).filter(([id]) => id !== '8')), sorted.content);
      sameRight(sorted, appended);
      await page.locator('#inventory-sort').click();
      await settle(page);
      const resorted = await snapshot(page);
      assert.deepEqual(resorted.order, ['8', ...expectedOrder], 'explicit sorting places the new smaller ID correctly');
      assert.deepEqual(resorted.content, appended.content, 'sorting does not clear the new-kind badge');
      sameRight(appended, resorted);
      assert.equal(resorted.leftScroll, 0);
      checks.push({ viewport, initialItems: before.order.length, initialOrder: before.order, sortedOrder: sorted.order,
        appendedId: appended.order.at(-1), resortedFirst: resorted.order[0], rightScroll: resorted.rightScroll,
        newMarkers: Object.values(sorted.content).filter(item => item.isNew).length, geometry });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, [], 'no account/database write requests are attempted');
    console.log(JSON.stringify({ ok: true, viewports: checks.length, pageErrors: errors, writes: writes.length, checks }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
