/* Local mocked geometry and interaction checks. No screenshots or account writes. */
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
  const checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://forge.local') return route.abort();
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch {
        await route.fulfill({ status: 404, body: '' });
      }
    });

    async function measure() {
      return page.evaluate(() => {
        const rect = selector => {
          const { x, y, width, height, right, bottom } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height, right, bottom };
        };
        const modal = document.querySelector('.forge-modal');
        const action = document.getElementById('forge-result-action');
        const name = document.getElementById('forge-reveal-name');
        const button = rect('#forge-ok');
        return {
          button, frame: rect('.forge-reveal-frame'), action: rect('#forge-result-action'),
          modal: rect('.forge-modal'), actionContent: action.textContent.trim(),
          actionOutsideArt: !document.getElementById('forge-reveal-art').contains(action),
          buttonContentY: button.y - modal.getBoundingClientRect().y + modal.scrollTop,
          scrollTop: modal.scrollTop,
          overflow: document.documentElement.scrollWidth > innerWidth || modal.scrollWidth > modal.clientWidth + 1,
          nameFits: name.scrollHeight <= name.clientHeight + 1 && name.scrollWidth <= name.clientWidth + 1,
          detailAfterButton: document.getElementById('forge-result-detail').hidden || rect('#forge-result-detail').y >= button.bottom,
          lockedColour: document.querySelector('.forge-result-locked') ? getComputedStyle(document.querySelector('.forge-result-locked')).color : '',
        };
      });
    }

    for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://forge.local');
      await page.evaluate(() => {
        LoginArt.setVisible(false);
        AudioManager.playEffect = async () => {};
        AudioManager.startLoop = async () => {};
        AudioManager.stopLoop = () => {};
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('player-dashboard').style.display = 'flex';
        const realm = REALMS.find(entry => entry.maxAxeQuality >= 1 && entry.maxAxeQuality < 5);
        const axes = Object.values(ITEMS).filter(item => item.type === 5);
        const low = axes.find(item => item.quality <= realm.maxAxeQuality);
        const high = axes.find(item => item.quality > realm.maxAxeQuality);
        const config = GAME_CONFIG.forgeTable[0];
        Game.state = { realmLevel: realm.level, axeId: low.id };
        Game.inventory = [{ itemId: String(config.costItemId), quantity: 12 * config.costCount }];
        Game.weapons = [];
        window.forgeFixture = { low, high, next: 'low', calls: 0, equipped: 0, fail: false };
        Game.forge = async () => {
          forgeFixture.calls++;
          if (forgeFixture.fail) throw new Error('Expected local fixture failure');
          Game.inventory[0].quantity -= config.costCount;
          const item = { ...forgeFixture[forgeFixture.next] };
          if (forgeFixture.next === 'high') item.name = '尚未满足仙阶也不会挤走锻造按钮的测试仙斧';
          item.desc = '每一段认真尝试都值得留下自己的痕迹。'.repeat(5);
          const weapon = { id: 'fixture-' + forgeFixture.calls, itemId: item.id };
          Game.weapons.push(weapon);
          return { item, itemId: item.id, quality: item.quality, weapon };
        };
        Game.equipAxe = async () => { forgeFixture.equipped++; return true; };
        preloadAxeAnimation = async () => {};
        renderWeaponSkills = () => '<span>每次砍树都有机会获得额外奖励，固定词条不会在再次展示时重抽。</span>';
        PlayerView.renderCultivate = async () => {};
        PlayerView.showForge();
      });
      const idle = await measure();
      assert.equal(idle.actionContent, '');
      assert.equal(idle.action.height, 44);
      assert.equal(idle.actionOutsideArt, true);
      assert.ok(idle.action.y >= idle.frame.y && idle.action.bottom <= idle.frame.bottom);
      if (viewport.height >= 640) assert.ok(idle.button.bottom < viewport.height, 'primary button starts onscreen');

      await page.evaluate(() => document.getElementById('forge-ok').click());
      await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'running');
      assert.equal((await measure()).actionContent, '');
      await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'result');
      const eligible = await measure();
      assert.equal(eligible.actionContent, '立即装备');
      assert.equal(await page.locator('.forge-result-locked, .forge-modal .axe-realm-requirement').count(), 0);
      await page.evaluate(() => document.querySelector('#forge-result-action button').click());
      await page.waitForFunction(() => document.querySelector('#forge-result-action button').textContent === '已装备');
      assert.equal(await page.evaluate(() => forgeFixture.equipped), 1);
      assert.equal(await page.locator('.forge-modal').count(), 1);

      await page.evaluate(() => { forgeFixture.next = 'high'; document.getElementById('forge-ok').click(); });
      await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'running');
      assert.equal((await measure()).actionContent, '', 'starting another forge clears the old equip action');
      await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'result');
      const locked = await measure();
      assert.equal(locked.actionContent, await page.evaluate(() => getMinRealmForAxeQuality(forgeFixture.high.quality).name + '及以上可装备'));
      assert.equal(locked.lockedColour, 'rgb(157, 56, 54)');
      assert.equal(await page.locator('#forge-result-action button').count(), 0);
      assert.equal(locked.nameFits, true);

      await page.evaluate(() => { forgeFixture.fail = true; document.getElementById('forge-ok').click(); });
      await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'idle' && !document.querySelector('.forge-modal-overlay').classList.contains('modal-locked'));
      const failed = await measure();
      assert.equal(failed.actionContent, '');
      assert.equal(await page.locator('#forge-ok').isDisabled(), false);
      assert.equal(await page.evaluate(() => forgeFixture.calls), 3);

      for (const state of [eligible, locked, failed]) {
        assert.equal(state.overflow, false);
        assert.equal(state.detailAfterButton, true);
        assert.ok(Math.abs(state.buttonContentY - idle.buttonContentY) <= 1, 'result details must not shift the repeated forge control');
        assert.ok(Math.abs(state.button.y - idle.button.y) <= 1, 'fixed modal anchor must not recenter after results');
        assert.equal(state.action.height, idle.action.height);
      }
      checks.push({ viewport, idle, eligible, locked, failed });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, viewports: checks.length, pageErrors: errors, checks }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
