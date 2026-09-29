// Functional checks only. All assets are local; any database attempt fails the test.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'http://127.0.0.1:9873';
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function readyGuide(page, text) {
  await page.waitForFunction(text => document.querySelector('.first-chop-guide')?.dataset.phase === 'ready'
    && document.getElementById('first-chop-guide-title')?.textContent.includes(text), text, { timeout: 8000 });
  const hintFits = await page.evaluate(() => {
    const bubble = document.querySelector('.first-chop-guide-bubble').getBoundingClientRect();
    return bubble.left >= 0 && bubble.right <= innerWidth + 1 && bubble.top >= 0 && bubble.bottom <= innerHeight + 1;
  });
  assert.ok(hintFits, 'tutorial hint stays inside the usable screen');
}
async function waitReward(page, single = false) {
  await page.waitForSelector(single ? '.reward-dialog--single' : '.reward-dialog--ten', { timeout: 20000 });
  await page.waitForFunction(() => !OperationGuard.isBusy() && !FirstChopGuide.isActive());
}
async function collect(page) {
  const button = page.locator('.reward-reveal-confirm');
  if ((await button.textContent()).trim() === '显示全部') await button.click();
  await button.click();
  await page.waitForSelector('.reward-dialog-overlay', { state: 'detached' });
}
async function login(page) {
  await page.waitForFunction(() => typeof Auth !== 'undefined' && !document.querySelector('.login-shell').inert, null, { timeout: 30000 });
  await page.locator('#login-password').fill('888');
  await page.locator('#login-submit').click();
  await readyGuide(page, '开始砍树');
  assert.equal(await page.evaluate(() => dbClient), null, 'demo has no live database client');
}
async function main() {
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const errors = [], databaseRequests = [], checks = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (/supabase\.co$/.test(url.hostname) || !['GET', 'HEAD'].includes(request.method())) {
      databaseRequests.push(`${request.method()} ${url.hostname}${url.pathname}`); return route.abort();
    }
    if (url.origin !== origin) return route.fulfill({ status: 200, body: '', contentType: 'application/javascript' });
    const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
    if (!file.startsWith(root + path.sep)) return route.abort();
    try {
      const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
      await route.fulfill({ status: 200, body: await fs.readFile(file), contentType });
    } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/?demo=1');
      await page.waitForFunction(() => typeof Auth !== 'undefined');
      assert.equal(await page.locator('.demo-boot-notice').count(), 1);
      assert.equal(await page.locator('.demo-login-hint').textContent().then(text => text.includes('888')), true);
      assert.equal(await page.locator('.role-card[data-role="admin"]').isVisible(), false);
      await login(page);
      const initial = await page.evaluate(() => ({
        level: Game.state.level, realm: Game.state.realmLevel, tree: Game.state.treeLevel,
        chops: Game.state.choppingCount, materials: Game.inventory, gift: DemoSession.giftId,
        rating: WeaponAffixes.getWeaponRating(Game.weapons.find(w => w.id === DemoSession.giftId)).label,
      }));
      assert.deepEqual([initial.level, initial.realm, initial.tree, initial.chops, initial.rating], [10, 1, 14, 999, 'SSS']);
      console.log(`login and seed OK ${viewport.width}`);
      await page.locator('#chop-btn').click();
      await waitReward(page, true); await collect(page);
      assert.equal(await page.evaluate(() => Game.state.choppingCount), 998);
      await page.locator('button[onclick="PlayerView.showBreakThrough()"]').click();
      await page.locator('#breakthrough-ok').click();
      await page.waitForFunction(() => Game.state.realmLevel === 2 && !OperationGuard.isBusy());
      await page.locator('#ten-chop-toggle').check();
      await page.locator('#chop-btn').click();
      await waitReward(page);
      assert.equal(await page.evaluate(() => FirstChopGuide.isActive()), false, 'no gift guide before result dismissal');
      await collect(page);
      await readyGuide(page, 'SSS仙斧');
      await page.locator('#mobile-weapon-toggle').click();
      await readyGuide(page, 'SSS斧技');
      await page.locator(`[data-weapon-id="${initial.gift}"]`).click();
      await readyGuide(page, '换上它');
      await page.locator(`[data-equip-weapon="${initial.gift}"]`).click();
      await page.waitForFunction(gift => Game.state.axeInstanceId === gift && !FirstChopGuide.isActive()
        && !document.querySelector('.modal-overlay'), initial.gift, { timeout: 15000 });
      console.log(`full tutorial chain OK ${viewport.width}`);
      // Actual forge consumes local materials and returns a separate weapon instance.
      const forged = await page.evaluate(async () => {
        const before = Game._getItemQty('40001');
        const result = await Game.forge();
        return { id: result?.weapon.id, before, after: Game._getItemQty('40001') };
      });
      assert.ok(forged.id); assert.equal(forged.before - forged.after, 1);
      await page.evaluate(() => Router.playerTab('tasks'));
      await page.waitForFunction(() => PlayerView._weeklyTasks.length === 3 && PlayerView._themeTasks.length === 5);
      assert.equal(await page.locator('.demo-page-note').first().isVisible(), true);
      await page.locator('button[onclick="PlayerView.submitTask(\'demo-task-2\')"]').click();
      await page.locator('#submit-desc').fill('演示：已完成这次通话，体验任务反馈流程。');
      await page.locator('#submit-ok').click();
      await page.locator('.demo-review-button').click();
      const beforeClaim = await page.evaluate(() => Game.state.choppingCount);
      await page.locator('button[onclick="PlayerView.claimTaskReward(\'demo-task-2\',this)"]').click();
      await page.waitForFunction(() => PlayerView._submissions.some(s => s.taskId === 'demo-task-2' && s.status === 'claimed'));
      assert.equal(await page.evaluate(() => Game.state.choppingCount), beforeClaim + 33);
      assert.equal(await page.evaluate(() => Game._getItemQty('30201')), 1);
      console.log(`task submit / explicit simulated review / claim OK ${viewport.width}`);
      // Reloading does not retain progress or task history.
      await page.evaluate(() => Auth.logout());
      await login(page);
      assert.deepEqual(await page.evaluate(() => [Game.state.level, Game.state.realmLevel, Game.state.totalChops,
        Game.state.choppingCount, Game._getItemQty('40001'), Game._getItemQty('30001')]), [10, 1, 0, 999, 999, 1]);
      assert.equal(await page.evaluate(async () => (await DB.getSubmissions()).length), 0);
      assert.notEqual(await page.evaluate(() => DemoSession.giftId), initial.gift);
      if (viewport.width === 390) {
        await page.evaluate(() => DB.addItem('40001', 5));
        const other = await context.newPage();
        other.on('pageerror', error => errors.push(error.message));
        await other.goto(origin + '/?demo=1');
        await login(other);
        assert.equal(await other.evaluate(() => Game._getItemQty('40001')), 999);
        assert.equal(await page.evaluate(async () => (await DB.getInventory()).find(row => row.itemId === '40001').quantity), 1004,
          'another visitor logging in cannot reset the first visitor');
        await other.close();
        await page.reload();
        await login(page);
        assert.equal(await page.evaluate(() => Game._getItemQty('40001')), 999, 'reload starts a fresh demo');
        assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => /inventory.*:demo/.test(key))), false,
          'demo inventory, novelty and sorting never persist in browser storage');
      }
      checks.push({ viewport, initialState: true, firstChop: true, breakthrough: true, tenChop: true,
        giftTutorial: true, forging: true, taskClaim: true, reloginReset: true });
      await page.close();
    }
    assert.deepEqual(databaseRequests, [], 'demo never contacts Supabase');
    assert.deepEqual(errors, [], 'no browser runtime exceptions');
    console.log(JSON.stringify({ ok: true, checks, databaseRequests, errors }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
