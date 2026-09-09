/* Local mocked rating images, geometry and interactions. No screenshots or account requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const RATING_NAMES = ['B', 'A', 'S', 'SS', 'SSS'];

function inside(outer, inner, tolerance = 0.75) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance
    && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
}

function overlaps(a, b, tolerance = 0.5) {
  return Math.min(a.right, b.right) - Math.max(a.x, b.x) > tolerance
    && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > tolerance;
}

async function settle(page) {
  await page.evaluate(async () => {
    const modal = document.querySelector('.modal');
    if (modal) await Promise.all(modal.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function decodeRatings(page, selector) {
  return page.locator(selector + ' .weapon-rating-image').evaluateAll(async images => {
    return Promise.all(images.map(async image => {
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let visiblePixels = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 32) visiblePixels++;
      return {
        rating: image.closest('.weapon-rating').dataset.rating,
        quality: Number(image.closest('.weapon-rating').dataset.ratingQuality),
        path: new URL(image.currentSrc).pathname,
        version: new URL(image.currentSrc).searchParams.get('v'),
        width: image.naturalWidth, height: image.naturalHeight, visiblePixels,
      };
    }));
  });
}

function assertImages(images) {
  assert.ok(images.length > 0, 'real rating image elements exist');
  for (const image of images) {
    assert.deepEqual([image.width, image.height], [192, 96]);
    assert.equal(image.rating, RATING_NAMES[image.quality - 1]);
    assert.equal(image.path, `/assets/runtime/weapon-ratings/rating-${image.rating.toLowerCase()}.webp`);
    assert.equal(image.version, 'weapon-ratings-20260909');
    assert.ok(image.visiblePixels > 100, 'decoded rating contains visible bitmap content');
  }
}

async function inspectLibrary(page) {
  return page.evaluate(() => {
    const box = node => {
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    return [...document.querySelectorAll('#mobile-weapon-grid .weapon-slot')].map(slot => {
      const weapon = Game.weapons.find(entry => slot.getAttribute('onclick').includes(`'${entry.id}'`));
      const rating = slot.querySelector('.weapon-rating-slot');
      const image = rating?.querySelector('.weapon-rating-image');
      const icon = slot.querySelector('.item-icon');
      const markers = [...slot.querySelectorAll('.mobile-current-badge, .item-lock-badge, .item-new-badge')];
      const mark = getComputedStyle(slot, '::after');
      const slotBox = box(slot);
      return {
        id: weapon?.id, itemId: weapon?.itemId, slot: slotBox,
        axeQuality: Number(ITEMS[weapon.itemId].quality),
        rating: rating ? { name: rating.dataset.rating, quality: Number(rating.dataset.ratingQuality), box: box(rating), image: box(image) } : null,
        icon: box(icon.querySelector('img')), iconBottomPadding: parseFloat(getComputedStyle(icon).paddingBottom),
        markers: markers.map(marker => ({ type: marker.className, box: box(marker), image: !!marker.querySelector('img'), text: marker.textContent.trim() })),
        qualityMark: { x: slotBox.x + parseFloat(mark.left), y: slotBox.y + parseFloat(mark.top),
          right: slotBox.x + parseFloat(mark.left) + parseFloat(mark.width), bottom: slotBox.y + parseFloat(mark.top) + parseFloat(mark.height) },
      };
    });
  });
}

function assertLibrary(cells, expected) {
  assert.ok(cells.length >= 15, 'multiple rows exercise the library scroll');
  const sameAxe = new Set(cells.map(cell => cell.itemId));
  assert.equal(sameAxe.size, 1, 'instance fixture uses the same axe definition');
  for (const cell of cells) {
    const context = JSON.stringify(cell);
    assert.ok(cell.rating, 'each weapon instance has its own rating: ' + context);
    assert.equal(cell.rating.name, expected[cell.id], 'rating follows instance UUID: ' + context);
    assert.equal(cell.rating.quality, RATING_NAMES.indexOf(expected[cell.id]) + 1);
    assert.equal(cell.axeQuality, 3, 'axe quality is independent of the rating fixture');
    assert.ok(Math.abs(cell.slot.height - cell.slot.width * 4 / 3) < 1, 'weapon cell stays 3:4: ' + context);
    assert.ok(cell.slot.width >= 44 && cell.slot.width <= 80.5, 'weapon touch target remains bounded: ' + context);
    assert.equal(cell.rating.box.height, 18, 'rating has a dedicated fixed bottom slot: ' + context);
    assert.ok(cell.rating.box.width >= 32 && cell.rating.box.width <= cell.slot.width - 4, 'SSS remains readable in narrow cells: ' + context);
    assert.ok(inside(cell.slot, cell.rating.box) && inside(cell.rating.box, cell.rating.image), 'rating bitmap stays entirely inside the cell: ' + context);
    assert.ok(Math.abs(cell.rating.image.width / cell.rating.image.height - 2) < 0.02, 'small-cell rating keeps its original 2:1 proportions: ' + context);
    assert.ok(cell.slot.bottom - cell.rating.box.bottom >= 2 && cell.slot.bottom - cell.rating.box.bottom <= 6, 'rating remains near the inner bottom edge: ' + context);
    assert.ok(cell.iconBottomPadding >= 22, 'axe art reserves space for the rating');
    assert.ok(!overlaps(cell.icon, cell.rating.box), 'rating must not cover the axe art: ' + context);
    for (let index = 0; index < cell.markers.length; index++) {
      const marker = cell.markers[index];
      assert.ok(inside(cell.slot, marker.box), 'status stays inside its weapon cell: ' + context);
      assert.ok(!overlaps(marker.box, cell.rating.box), 'status does not cover the rating: ' + context);
      assert.ok(!overlaps(marker.box, cell.qualityMark), 'status does not cover the axe-quality mark: ' + context);
      for (const other of cell.markers.slice(index + 1)) assert.ok(!overlaps(marker.box, other.box), 'current/locked/new markers do not overlap: ' + context);
      if (marker.type.includes('mobile-current-badge')) {
        assert.equal(marker.image, true, 'current equipment uses the small check image');
        assert.ok(marker.box.y < cell.slot.y + cell.slot.height / 2, 'current marker is moved out of the bottom rating area');
      }
    }
  }
}

async function inspectEquipped(page) {
  return page.evaluate(() => {
    const box = node => {
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const quality = document.querySelector('.mobile-equipped-quality');
    const rating = quality.querySelector('.weapon-rating');
    const tag = quality.querySelector('.tag');
    return {
      rating: rating?.dataset.rating, ratingQuality: Number(rating?.dataset.ratingQuality),
      ratingBox: rating ? box(rating) : null, imageBox: rating ? box(rating.querySelector('img')) : null,
      tag: box(tag), tagText: tag.textContent.trim(), tagFont: parseFloat(getComputedStyle(tag).fontSize),
      expectedTag: QUALITY[ITEMS[Game.equippedWeapon.itemId].quality].name,
      quality: box(quality), title: box(document.querySelector('.mobile-equipped-title')),
      art: box(document.querySelector('.mobile-equipped-art')), skills: box(document.querySelector('.mobile-equipped-skills')),
      pane: box(document.querySelector('.mobile-equipment-pane')),
      horizontalOverflow: quality.scrollWidth > quality.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth,
    };
  });
}

function assertEquipped(state, expected) {
  const context = JSON.stringify(state);
  assert.equal(state.rating, expected, 'equipped rating follows the selected instance: ' + context);
  assert.equal(state.ratingQuality, RATING_NAMES.indexOf(expected) + 1);
  assert.equal(state.tagText, state.expectedTag, 'axe quality keeps its own configured label');
  assert.ok(state.tagFont >= 10, 'quality label is not reduced to unreadable text');
  assert.equal(state.horizontalOverflow, false, 'inline quality/rating row fits the narrow pane: ' + context);
  assert.ok(state.ratingBox.width >= 32 && state.ratingBox.height >= 16, 'inline SSS has a readable image size: ' + context);
  assert.ok(Math.abs(state.imageBox.width / state.imageBox.height - 2) < 0.02, 'equipped rating is not squeezed to fit the quality row: ' + context);
  assert.ok(inside(state.pane, state.quality) && inside(state.quality, state.ratingBox) && inside(state.ratingBox, state.imageBox), 'equipped rating is not clipped: ' + context);
  for (const rect of [state.tag, state.title, state.art, state.skills]) assert.ok(!overlaps(state.ratingBox, rect), 'equipped rating does not overlap other information: ' + context);
}

async function scrollState(page) {
  return page.evaluate(() => ({
    mode: document.getElementById('mobile-weapon-toggle').textContent.trim(),
    left: document.getElementById('inventory-grid').scrollTop,
    right: document.getElementById('mobile-weapon-grid').scrollTop,
    uniqueGrid: document.querySelectorAll('#inventory-grid').length,
  }));
}

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const page = await browser.newPage();
  const errors = [], writes = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method()); return route.abort(); }
      const url = new URL(request.url());
      if (url.origin !== 'http://rating.local') return route.abort();
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return route.abort();
      if (url.searchParams.has('fixtureMissing')) return route.fulfill({ status: 404, body: '' });
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });

    for (const viewport of [{ width: 320, height: 640 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://rating.local');
      assert.equal(await page.evaluate(() => typeof renderWeaponRating), 'function', 'new rating renderer is available');
      const expected = await page.evaluate(() => {
        LoginArt.setVisible(false);
        AudioManager.playEffect = async () => {};
        AudioManager.startLoop = async () => {};
        AudioManager.stopLoop = () => {};
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        preloadAxeAnimation = async () => {};
        const axe = Object.values(ITEMS).find(item => item.type === 5 && item.quality === 3);
        const lowerRealm = REALMS.find(realm => realm.maxAxeQuality < 3);
        const equipRealm = REALMS.find(realm => realm.maxAxeQuality >= 3);
        const forge = GAME_CONFIG.forgeTable[0];
        const qualities = [1, 2, 3, 4, 5];
        const names = ['B', 'A', 'S', 'SS', 'SSS'];
        const roll = quality => ({ skillId: 1, buffId: 1, buffRowId: quality, buffQuality: quality,
          effectType: 'reward_multiplier', values: { value1: 1, value2: 15, value3: 2 },
          description: '每次砍树获得{value1}奖励时，有{value2}概率使掉落数量翻倍。' });
        const weapons = qualities.map((quality, index) => ({ id: `rating-${index}`, itemId: String(axe.id), skillRolls: index === 0 ? [] : [roll(quality), roll(1)] }));
        for (let index = 0; index < 15; index++) weapons.push({ ...weapons[index % 5], id: `rating-extra-${index}` });
        Game.state = { level: 1, realmLevel: lowerRealm.level, treeRealm: 1, treeLevel: 1, axeId: String(axe.id), axeInstanceId: 'rating-4', coin: 1234, choppingCount: 50, exp: 0 };
        Game.weapons = weapons;
        Game.equippedWeapon = weapons[4];
        const source = Object.values(ITEMS).find(item => item.type === 1);
        for (let index = 0; index < 28; index++) {
          const id = `rating-material-${index}`;
          ITEMS[id] = { ...source, id, name: `测试材料${index}`, iconImage: getItemIconPath(source.id, source.iconImage) };
        }
        Game.inventory = Object.values(ITEMS).filter(item => item.type >= 1 && item.type <= 4).map(item => ({ itemId: String(item.id), quantity: 12 }));
        if (!Game.inventory.some(item => item.itemId === String(forge.costItemId))) Game.inventory.push({ itemId: String(forge.costItemId), quantity: 12 });
        InventoryNewState.setRole(`weapon-rating-fixture-${innerWidth}`);
        InventoryNewState.sync([], []);
        InventoryNewState.sync(Game.inventory, Game.weapons);
        window.ratingFixture = {
          expected: Object.fromEntries(weapons.map((weapon, index) => [weapon.id, names[index < 5 ? index : (index - 5) % 5]])),
          axe, equipRealm: equipRealm.level, cost: forge.costCount, costItemId: String(forge.costItemId),
          equipCalls: 0, forgeCalls: 0, nextQuality: 2, pending: null, roll,
        };
        Game.equipAxe = async instanceId => {
          const weapon = Game.weapons.find(entry => entry.id === instanceId);
          ratingFixture.equipCalls++;
          Game.state.axeInstanceId = weapon.id;
          Game.state.axeId = weapon.itemId;
          Game.equippedWeapon = weapon;
          return true;
        };
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('player-dashboard').style.display = 'flex';
        Router.playerTab('cultivate', { force: true });
        return ratingFixture.expected;
      });
      await settle(page);
      const equipped = await inspectEquipped(page);
      assertEquipped(equipped, 'SSS');
      assertImages(await decodeRatings(page, '.mobile-equipped-quality'));

      await page.locator('#mobile-weapon-toggle').click();
      await settle(page);
      const images = await decodeRatings(page, '#mobile-weapon-grid');
      assertImages(images);
      assert.deepEqual([...new Set(images.map(image => image.rating))].sort(), [...RATING_NAMES].sort(), 'all five approved rank images load');
      const initialCells = await inspectLibrary(page);
      assertLibrary(initialCells, expected);
      const current = initialCells.find(cell => cell.id === 'rating-4');
      assert.equal(current.markers.length, 3, 'current, locked and new are exercised together');

      await page.evaluate(() => {
        document.getElementById('inventory-grid').scrollTop = 48;
        document.getElementById('mobile-weapon-grid').scrollTop = 48;
      });
      await settle(page);
      const before = await scrollState(page);
      assert.equal(before.left, 48);
      assert.equal(before.right, 48);
      await page.evaluate(() => PlayerView.renderInventory(PlayerView.currentInvTab));
      await settle(page);
      assert.deepEqual(await scrollState(page), before, 'inventory redraw retains library mode and both scroll offsets');
      assertLibrary(await inspectLibrary(page), expected);

      await page.evaluate(async () => {
        Game.state.realmLevel = ratingFixture.equipRealm;
        await PlayerView.equipItem('rating-1', null);
      });
      await settle(page);
      const afterEquip = await scrollState(page);
      assert.deepEqual(afterEquip, before, 'equipping and full cultivation redraw retain library mode and scroll offsets');
      const afterCells = await inspectLibrary(page);
      assertLibrary(afterCells, expected);
      assert.equal(afterCells[0].id, 'rating-1', 'newly equipped instance moves to the current position');
      await page.locator('#mobile-weapon-toggle').click();
      await settle(page);
      const changed = await inspectEquipped(page);
      assertEquipped(changed, 'A');
      assertImages(await decodeRatings(page, '.mobile-equipped-quality'));

      await page.evaluate(() => {
        Game.forge = async () => {
          ratingFixture.forgeCalls++;
          const weapon = { id: `rating-forged-${ratingFixture.forgeCalls}`, itemId: String(ratingFixture.axe.id),
            skillRolls: [ratingFixture.roll(ratingFixture.nextQuality), ratingFixture.roll(1)] };
          Game.weapons.push(weapon);
          Game.inventory.find(item => item.itemId === ratingFixture.costItemId).quantity -= ratingFixture.cost;
          return { item: { ...ratingFixture.axe }, itemId: weapon.itemId, quality: ratingFixture.axe.quality, weapon };
        };
        // Only layout owns this local gate; production timing remains covered by forge-layout/ForgeReveal tests.
        ForgeReveal.run = async (elements, outcome) => {
          const result = await outcome;
          await new Promise(resolve => { ratingFixture.pending = resolve; });
          elements.name.textContent = result.item.name;
          elements.art.innerHTML = renderItemIcon(result.itemId, result.item.icon, 'forge-reveal-icon');
          ratingFixture.pending = null;
          return result;
        };
        PlayerView.showForge();
      });
      await settle(page);
      const forgeButton = await page.locator('#forge-ok').boundingBox();
      assert.equal(await page.locator('.forge-result-quality .weapon-rating').count(), 0, 'idle forge does not show an outcome rating');
      const forgeResults = [];
      for (const quality of [2, 5]) {
        await page.evaluate(quality => { ratingFixture.nextQuality = quality; }, quality);
        await page.locator('#forge-ok').click();
        await page.waitForFunction(() => typeof ratingFixture.pending === 'function');
        assert.equal(await page.locator('.forge-result-quality .weapon-rating').count(), 0, 'new forge clears the previous outcome rating');
        assert.equal(await page.locator('#forge-result-detail').isVisible(), false);
        await page.evaluate(() => ratingFixture.pending());
        await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'result');
        await settle(page);
        const outcomeImages = await decodeRatings(page, '.forge-result-quality');
        assertImages(outcomeImages);
        assert.equal(outcomeImages.length, 1);
        assert.equal(outcomeImages[0].rating, RATING_NAMES[quality - 1]);
        const geometry = await page.locator('.forge-result-quality').evaluate(element => {
          const box = node => { const { x, y, width, height, right, bottom } = node.getBoundingClientRect(); return { x, y, width, height, right, bottom }; };
          const rating = element.querySelector('.weapon-rating');
          const tag = [...element.children].find(child => !child.classList.contains('weapon-rating'));
          return { outer: box(element), rating: box(rating), image: box(rating.querySelector('img')), tag: tag ? box(tag) : null, text: element.textContent.trim(),
            expectedQuality: QUALITY[ratingFixture.axe.quality].name, button: box(document.getElementById('forge-ok')) };
        });
        assert.ok(inside(geometry.outer, geometry.rating) && inside(geometry.rating, geometry.image), 'forge quality row does not clip the rating: ' + JSON.stringify(geometry));
        assert.ok(geometry.tag && !overlaps(geometry.tag, geometry.rating), 'forge axe quality and rating stay side by side without overlap: ' + JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.image.width / geometry.image.height - 2) < 0.02, 'forge rating retains its aspect ratio');
        assert.ok(geometry.text.includes(geometry.expectedQuality), 'forge retains the axe quality alongside its independent rating');
        assert.ok(Math.abs(geometry.button.y - forgeButton.y) <= 1, 'result rating does not move repeated forge control');
        await page.locator('#forge-result-action button').click();
        await page.waitForFunction(() => document.querySelector('#forge-result-action button').textContent === '已装备');
        assert.equal(await page.locator('.forge-result-quality .weapon-rating').getAttribute('data-rating'), RATING_NAMES[quality - 1], 'equipping preserves the result rating');
        assert.equal(await page.locator('.mobile-equipped-quality .weapon-rating').getAttribute('data-rating'), RATING_NAMES[quality - 1], 'forge equip updates current equipment rating');
        const afterButton = await page.locator('#forge-ok').boundingBox();
        assert.ok(Math.abs(afterButton.y - forgeButton.y) <= 1, 'forge equip redraw keeps the primary button fixed');
        forgeResults.push({ rating: RATING_NAMES[quality - 1], buttonY: afterButton.y });
      }

      const fallback = page.locator('.forge-result-quality .weapon-rating');
      const fallbackBefore = await fallback.boundingBox();
      await fallback.locator('img').evaluate(image => { image.src += '&fixtureMissing=1'; });
      await page.waitForFunction(() => {
        const fallback = document.querySelector('.forge-result-quality .weapon-rating-fallback');
        return !!fallback && fallback.getClientRects().length > 0 && getComputedStyle(fallback).visibility !== 'hidden' && Number(getComputedStyle(fallback).opacity) > 0;
      });
      assert.equal(await fallback.locator('.weapon-rating-fallback').textContent(), 'SSS');
      const fallbackAfter = await fallback.boundingBox();
      const textBox = await fallback.locator('.weapon-rating-fallback').boundingBox();
      assert.ok(inside({ ...fallbackAfter, right: fallbackAfter.x + fallbackAfter.width, bottom: fallbackAfter.y + fallbackAfter.height },
        { ...textBox, right: textBox.x + textBox.width, bottom: textBox.y + textBox.height }), 'readable fallback text remains inside its rating area');
      assert.deepEqual(fallbackAfter, fallbackBefore, 'failed art does not shift or resize the rating');
      checks.push({ viewport, decodedRatings: [...new Set(images.map(image => image.rating))], weaponCells: initialCells.length,
        simultaneousMarkers: current.markers.map(marker => marker.type), equipped: [equipped.rating, changed.rating], retainedScroll: afterEquip, forgeResults, fallback: 'SSS' });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, [], 'no account/database write requests are attempted');
    console.log(JSON.stringify({ ok: true, viewports: checks.length, pageErrors: errors, writes: writes.length, checks }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
