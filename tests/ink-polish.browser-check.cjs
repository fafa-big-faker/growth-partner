/* Local-only geometry, motion and interaction checks; no screenshots or real accounts. */
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
  const results = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://ink.local') return route.abort();
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const data = await fs.readFile(file);
        const extension = path.extname(file);
        const contentType = { '.css': 'text/css', '.js': 'application/javascript', '.html': 'text/html', '.webp': 'image/webp' }[extension] || 'application/octet-stream';
        await route.fulfill({ status: 200, body: data, contentType });
      } catch {
        await route.fulfill({ status: 404, body: '' });
      }
    });

    for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://ink.local');
      await page.waitForFunction(() => document.getElementById('login-brand-image').naturalWidth > 0);
      await page.waitForFunction(() => document.getElementById('login-brand-image').getAnimations().some(animation => animation.effect.getTiming().iterations === Infinity));
      const motion = await page.evaluate(async () => {
        const canvas = document.getElementById('login-ink-canvas');
        const hash = () => {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let sum = 0;
          let visible = 0;
          for (let index = 3; index < pixels.length; index += 4) {
            sum = (Math.imul(sum, 31) + pixels[index]) >>> 0;
            if (pixels[index]) visible++;
          }
          return { sum, visible };
        };
        const first = hash();
        await new Promise(resolve => setTimeout(resolve, 240));
        return { first, second: hash(), width: canvas.width, height: canvas.height };
      });
      assert.ok(motion.first.visible > 0 && motion.second.visible > 0, 'water canvas is nonblank');
      assert.notEqual(motion.first.sum, motion.second.sum, 'water continues moving after the entrance');

      await page.evaluate(() => {
        AccountSession.verify = () => new Promise(resolve => { window.finishVerification = resolve; });
        Auth._credentials = { readPassword: () => 'local-fixture', clear() {} };
        void Auth.doLogin();
      });
      const loading = await page.evaluate(() => {
        const rect = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right };
        };
        return {
          hidden: document.getElementById('login-form-panel').hidden,
          status: document.getElementById('login-loading-status').textContent,
          copy: rect('.loading-copy'), percent: rect('.loading-percent'),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(loading.hidden, true);
      assert.equal(loading.status, '正在核验道号');
      assert.equal(loading.overflow, false);
      assert.ok(Math.abs(loading.copy.y - loading.percent.y) < 5, 'status and percentage share a baseline');
      assert.ok(loading.copy.right <= loading.percent.x, 'loading labels do not overlap');
      await page.evaluate(() => window.finishVerification(null));
      await page.waitForFunction(() => !Auth._loggingIn && !document.getElementById('login-form-panel').hidden);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.getElementById('login-brand-image').getAnimations().length === 0);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      if (process.argv.includes('--login-only')) {
        results.push({ viewport, motion, loading });
        continue;
      }
      await page.evaluate(() => {
        LoginArt.setVisible(false);
        AudioManager.playEffect = async () => {};
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        Game.state = { realmLevel: 5, balance: 12800, totalWithdrawn: 800, coin: 999999, shopPurchases: {}, lastDailyDate: '' };
        Game.getSignInState = () => ({ days: 2, claims: [] });
        const weeklyTasks = Array.from({ length: 12 }, (_, index) => ({
          id: 'weekly-' + index, title: '和同学分享一件今天发现的小事 ' + index,
          description: '主动开启一段轻松的交流，听听对方的回应，也说说自己的感受。'.repeat(3),
          taskType: 'weekly', rewardChopping: 3, rewardItems: [], sortOrder: index, difficulty: 2,
        }));
        const data = { dailyTasks: [], weeklyTasks, themeTasks: [], submissions: [{ taskId: 'weekly-0', status: 'approved' }] };
        PlayerView._taskCache.peek = () => data;
        PlayerView._loadTaskData = async () => data;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('player-dashboard').style.display = 'flex';
        Router.playerTab('tasks', { force: true });
        window.probe = { claim: 0, buy: 0 };
        PlayerView.claimTaskReward = () => { probe.claim++; };
      });
      await page.locator('.filter-chip[data-filter="weekly"]').click();
      await page.locator('[onclick^="PlayerView.claimTaskReward"]').click();
      assert.equal(await page.evaluate(() => probe.claim), 1);
      const taskGeometry = await page.evaluate(async () => {
        window.scrollTo({ top: 320, behavior: 'instant' });
        const before = scrollY;
        await PlayerView.renderTasks();
        return {
          before, after: scrollY, filter: PlayerView.currentTaskFilter,
          overflow: document.documentElement.scrollWidth > innerWidth,
          inactiveHeight: document.getElementById('theme-section').getBoundingClientRect().height,
          clipped: Array.from(document.querySelectorAll('.task-title, .task-desc')).some(el => el.scrollWidth > el.clientWidth + 1),
        };
      });
      assert.equal(taskGeometry.filter, 'weekly');
      assert.equal(taskGeometry.overflow, false);
      assert.equal(taskGeometry.clipped, false);
      assert.ok(taskGeometry.inactiveHeight < 70, 'inactive activity occupies a compact line');
      assert.ok(Math.abs(taskGeometry.after - taskGeometry.before) < 2, 'task refresh preserves scroll: ' + JSON.stringify(taskGeometry));

      await page.evaluate(() => {
        const sample = getShopItems()[0];
        getShopItems = () => Array.from({ length: 4 }, (_, index) => ({
          ...sample, shopId: 900 + index, name: '一份带着春山气息的小礼物',
          description: '攒下每一次认真尝试，让微小的进步也有值得期待的回响。'.repeat(3),
          price: 280, limitType: 0, itemCount: 2,
        }));
        PlayerView._loadWithdrawals = async () => [];
        Router.playerTab('reward', { force: true });
        PlayerView.buyShopItem = () => { probe.buy++; };
      });
      await page.locator('.shop-action').first().click();
      assert.equal(await page.evaluate(() => probe.buy), 1);
      const shopGeometry = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        columns: getComputedStyle(document.getElementById('shop-grid')).gridTemplateColumns.split(' ').length,
        records: document.querySelectorAll('[onclick*="showWithdrawRecords"]').length,
        clipped: Array.from(document.querySelectorAll('.shop-description, .shop-name')).some(el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1),
        actionOverflow: Array.from(document.querySelectorAll('.shop-action')).some(el => el.scrollWidth > el.clientWidth + 1),
      }));
      assert.equal(shopGeometry.overflow, false);
      assert.equal(shopGeometry.columns, viewport.width <= 640 ? 1 : 2);
      assert.equal(shopGeometry.records, 1);
      assert.equal(shopGeometry.clipped, false);
      assert.equal(shopGeometry.actionOverflow, false);
      results.push({ viewport, motion, loading, taskGeometry, shopGeometry });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, pageErrors: errors, results }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
