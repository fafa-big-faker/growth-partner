/* Real local UI, mocked in-memory chop result. No screenshots, login or database traffic. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const VIEWPORTS = [
  { width: 320, height: 568 }, { width: 390, height: 844 },
  { width: 390, height: 1200 }, { width: 844, height: 390 },
  { width: 1440, height: 900 },
];
const ORIGIN = 'http://first-chop-guide.local';

async function frames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function fixture(page, settings = {}) {
  await page.evaluate(settings => {
    window.FirstChopGuide?.destroy();
    PlayerView.cancelChopPresentation();
    document.querySelectorAll('.modal-overlay').forEach(overlay => UI.closeModal(overlay));
    LoginArt.setVisible(false);
    Auth._warmup?.abort();
    AudioManager.playEffect = async () => false;
    AudioManager.startLoop = async () => false;
    AudioManager.stopLoop = () => {};
    AudioManager.playBgm = async () => false;
    UI._updateMailBadge = () => {};
    UI._updateAchBadge = () => {};
    const account = { role: settings.role || 'player', environment: settings.environment || 'live',
      playerRole: settings.environment === 'test' ? 'player' : 'player_live' };
    Auth.session = account;
    DB.playerRole = account.playerRole;
    const axe = Object.values(ITEMS).find(item => item.type === 5 && item.quality === 1);
    const weapon = { id: 'first-guide-fixture-axe', itemId: String(axe.id), skillRolls: [] };
    Game.state = { level: 1, realmLevel: 1, treeRealm: TREE_REALMS[0].level,
      treeLevel: TREE_REALMS[0].treeLevel, axeId: String(axe.id), axeInstanceId: weapon.id,
      coin: 1234, choppingCount: settings.choppingCount ?? 50, exp: 0, totalChops: settings.totalChops ?? 0 };
    Game.inventory = [];
    Game.weapons = [weapon];
    Game.equippedWeapon = weapon;
    PlayerView._tenChopMode = false;
    PlayerView.renderTasks = () => document.getElementById('player-main').replaceChildren();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('player-dashboard').style.display = account.role === 'player' ? 'flex' : 'none';
    document.getElementById('admin-dashboard').style.display = account.role === 'admin' ? 'flex' : 'none';
    const previousSingle = window.guideFixture?.originalSingle || PlayerView.doChop;
    window.guideFixture = { singleEntries: 0, chopCalls: 0, tenCalls: 0, outsideClicks: 0,
      toasts: [], finishChop: null, originalSingle: previousSingle };
    UI.toast = message => guideFixture.toasts.push(message);
    PlayerView.doChop = function (...args) {
      guideFixture.singleEntries++;
      return guideFixture.originalSingle.apply(this, args);
    };
    PlayerView.doChopTen = async () => { guideFixture.tenCalls++; return false; };
    // Keep PlayerView.doChop, OperationGuard, character animation and reward UI real.
    // Only the persistence/random-drop boundary is replaced by a manually resolved local promise.
    Game.chop = () => {
      guideFixture.chopCalls++;
      return new Promise(resolve => {
        guideFixture.finishChop = success => {
          guideFixture.finishChop = null;
          if (!success) { resolve(null); return; }
          const item = Object.values(ITEMS).find(entry => entry.type === 1 && entry.quality === 1);
          Game.state.choppingCount--;
          Game.state.totalChops++;
          Game.state.exp++;
          Game.inventory = [{ itemId: String(item.id), quantity: 1 }];
          resolve({ itemId: String(item.id), quantity: 1, quality: 1,
            qualityName: QUALITY[1].name, item, kind: 'item' });
        };
      });
    };
    let outside = document.getElementById('guide-fixture-outside');
    if (!outside) {
      outside = document.createElement('button');
      outside.id = 'guide-fixture-outside';
      outside.type = 'button';
      outside.textContent = 'Fixture outside control';
      Object.assign(outside.style, { position: 'fixed', left: '8px', top: '8px', width: '100px',
        height: '44px', zIndex: '1' });
      document.body.appendChild(outside);
    }
    outside.onclick = () => guideFixture.outsideClicks++;
    outside.focus();
    Router.playerTab('cultivate', { force: true });
  }, settings);
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('#player-main img')].map(image => image.decode().catch(() => {})));
  });
  await frames(page);
}

async function ready(page) {
  await page.waitForFunction(() => FirstChopGuide.isActive()
    && document.querySelector('.first-chop-guide')?.dataset.phase === 'ready', null, { timeout: 5000 });
  await page.evaluate(async () => {
    const overlay = document.querySelector('.first-chop-guide');
    const animations = overlay.getAnimations({ subtree: true });
    await Promise.all(animations.map(animation => animation.ready));
    await Promise.all(animations.filter(animation => animation.effect.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
  });
}

async function geometry(page, label) {
  const value = await page.evaluate(() => {
    const box = node => {
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const button = document.getElementById('chop-btn');
    const bubble = document.querySelector('.first-chop-guide-bubble');
    const paper = document.querySelector('.first-chop-guide-paper');
    const hole = document.querySelector('.first-chop-guide-hole');
    const ring = document.querySelector('.first-chop-guide-ring');
    const nodes = [button, button.querySelector('.chop-axe-icon'), button.querySelector('.chop-axe-icon img')].filter(Boolean);
    const paperBounds = box(paper);
    const text = [...paper.children].map(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return box(range);
    });
    return { viewport: { width: innerWidth, height: innerHeight }, button: box(button),
      targetBoxes: nodes.map(box), bubble: box(bubble), paper: paperBounds, hole: box(hole), text,
      title: paper.querySelector('strong').textContent,
      activeTarget: document.activeElement === button, count: document.querySelectorAll('#chop-btn').length,
      paperMotion: paper.getAnimations().map(animation => ({ state: animation.playState,
        duration: animation.effect.getTiming().duration, infinite: animation.effect.getTiming().iterations === Infinity,
        frames: animation.effect.getKeyframes().map(frame => frame.transform).filter(Boolean) })),
      ringMotion: ring.getAnimations().filter(animation => animation.playState === 'running').length,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  for (const name of ['bubble', 'paper']) {
    const rect = value[name];
    assert.ok(rect.width > 0 && rect.height > 0, `${label}: ${name} has visible area`);
    assert.ok(rect.x >= -1 && rect.y >= -1 && rect.right <= value.viewport.width + 1 && rect.bottom <= value.viewport.height + 1,
      `${label}: ${name} stays in viewport ${JSON.stringify(value)}`);
  }
  assert.ok(value.hole.x >= -1 && value.hole.right <= value.viewport.width + 1 && value.hole.y >= -1,
    `${label}: round highlight keeps its sides and top visible`);
  // The approved circle can continue below the viewport to surround a bottom-anchored
  // button; every real button/axe pixel must still remain visible inside the circle.
  for (const target of value.targetBoxes) {
    assert.ok(target.x >= -1 && target.y >= -1 && target.right <= value.viewport.width + 1
      && target.bottom <= value.viewport.height + 1, `${label}: actual button and axe remain fully onscreen`);
    assert.ok(value.hole.x <= target.x + 1 && value.hole.y <= target.y + 1
      && value.hole.right >= target.right - 1 && value.hole.bottom >= target.bottom - 1,
    `${label}: highlight includes the real button and protruding axe`);
    const cx = value.hole.x + value.hole.width / 2, cy = value.hole.y + value.hole.height / 2;
    for (const [x, y] of [[target.x, target.y], [target.right, target.y], [target.x, target.bottom], [target.right, target.bottom]]) {
      assert.ok(Math.hypot(x - cx, y - cy) <= value.hole.width / 2 + 1,
        `${label}: round opening does not shade corners of the real button or axe`);
    }
  }
  for (const rect of value.text) assert.ok(rect.x >= value.paper.x - 1 && rect.right <= value.paper.right + 1
    && rect.y >= value.paper.y - 1 && rect.bottom <= value.paper.bottom + 1, `${label}: all hint text fits the paper`);
  assert.ok(value.bubble.bottom <= value.hole.y + 1 || value.bubble.y >= value.hole.bottom - 1,
    `${label}: hint does not cover the axe or chopping count`);
  assert.equal(value.title, '点一下仙斧，开始砍树');
  assert.equal(value.count, 1, `${label}: no cloned chop button`);
  assert.equal(value.pageOverflow, false, `${label}: no horizontal page overflow`);
  return value;
}

async function blockOutside(page) {
  const initial = await page.evaluate(() => ({ root: document.scrollingElement.scrollTop,
    main: document.getElementById('player-main').scrollTop, muted: AudioManager.isMuted() }));
  await page.mouse.click(20, 20);
  const blocked = await page.evaluate(() => {
    const outside = document.getElementById('guide-fixture-outside');
    outside.click();
    document.querySelector('.audio-toggle')?.click();
    const events = [new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      new WheelEvent('wheel', { deltaY: 500, bubbles: true, cancelable: true }),
      new Event('touchmove', { bubbles: true, cancelable: true })];
    events.forEach(event => outside.dispatchEvent(event));
    outside.focus();
    return { prevented: events.map(event => event.defaultPrevented), outsideClicks: guideFixture.outsideClicks,
      focus: document.activeElement === document.getElementById('chop-btn'), back: XianlaiShell.handleBack() };
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Escape');
  await page.mouse.wheel(0, 500);
  await frames(page);
  assert.deepEqual(blocked.prevented, [true, true, true], 'outside keyboard/wheel/touch scrolling is blocked');
  assert.equal(blocked.outsideClicks, 0, 'outside native and programmatic clicks do not reach handlers');
  assert.equal(blocked.focus, true, 'focus returns to the one actionable button');
  assert.equal(blocked.back, true, 'Android back is consumed while guiding');
  assert.deepEqual(await page.evaluate(() => ({ root: document.scrollingElement.scrollTop,
    main: document.getElementById('player-main').scrollTop, muted: AudioManager.isMuted() })), initial,
  'blocked scrolling and audio click leave the page unchanged');
  assert.equal(await page.evaluate(() => FirstChopGuide.isActive()), true, 'Escape cannot dismiss the guide');
}

async function clickChop(page, keyboard = false) {
  const box = await page.locator('#chop-btn').boundingBox();
  if (keyboard) await page.keyboard.press('Enter');
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => typeof guideFixture.finishChop === 'function', null, { timeout: 4000 });
}

async function finishChop(page, success) {
  await page.evaluate(success => guideFixture.finishChop(success), success);
  await page.waitForFunction(() => !OperationGuard.isBusy(), null, { timeout: 6000 });
  if (success) await page.waitForFunction(() => !FirstChopGuide.isActive(), null, { timeout: 3000 });
  else await ready(page);
}

async function firstChopScenario(page, viewport) {
  await fixture(page);
  await ready(page);
  const initial = await geometry(page, 'new player');
  assert.equal(initial.activeTarget, true, 'real chop button receives initial focus');
  assert.ok(initial.paperMotion.some(animation => animation.state === 'running' && animation.duration === 2600 && animation.infinite
    && animation.frames.some(transform => transform.includes('-5px'))), 'hint floats continuously by five pixels every 2.6 seconds');
  assert.ok(initial.ringMotion > 0, 'highlight keeps a restrained active breathing animation');
  const motionProgress = await page.evaluate(async () => {
    const animation = document.querySelector('.first-chop-guide-paper').getAnimations()[0];
    const first = animation.currentTime;
    await new Promise(resolve => setTimeout(resolve, 90));
    return { first, next: animation.currentTime, state: animation.playState };
  });
  assert.ok(motionProgress.next > motionProgress.first && motionProgress.state === 'running', 'floating animation advances in the live browser');
  assert.equal(await page.locator('.guide-replay-button').count(), 0, 'live player has no test replay entry');
  await blockOutside(page);
  await page.evaluate(() => {
    guideFixture.oldButton = document.getElementById('chop-btn');
    PlayerView.renderCultivate();
  });
  await page.waitForFunction(() => document.getElementById('chop-btn') !== guideFixture.oldButton
    && document.getElementById('chop-btn').classList.contains('first-chop-guide-target'), null, { timeout: 3000 });
  await frames(page);
  await geometry(page, 'redrawn target');
  if (viewport.width === 390 && viewport.height === 844) {
    for (const next of [{ width: 390, height: 1200 }, { width: 844, height: 390 }, viewport]) {
      await page.setViewportSize(next); await frames(page); await geometry(page, 'live resize');
    }
  }
  // Force a stale ten-chop preference: the integration must explicitly choose one chop.
  await page.evaluate(() => { PlayerView._tenChopMode = true; document.getElementById('ten-chop-toggle').checked = true; });
  await clickChop(page);
  await page.evaluate(() => {
    const button = document.getElementById('chop-btn');
    for (let index = 0; index < 4; index++) button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => ({ singles: guideFixture.singleEntries, chops: guideFixture.chopCalls,
    tens: guideFixture.tenCalls, active: FirstChopGuide.isActive(), mode: PlayerView._tenChopMode,
    phase: document.querySelector('.first-chop-guide').dataset.phase })),
  { singles: 1, chops: 1, tens: 0, active: true, mode: false, phase: 'pending' }, 'rapid input invokes one real single-chop and retains pending guard');
  await finishChop(page, false);
  assert.equal(await page.evaluate(() => Game.state.totalChops), 0, 'failed chop does not complete the tutorial');
  assert.equal(await page.evaluate(() => Game.state.choppingCount), 50, 'failed chop does not consume fixture resources');
  await geometry(page, 'failure restores guide');
  await clickChop(page, true);
  await finishChop(page, true);
  assert.deepEqual(await page.evaluate(() => ({ singles: guideFixture.singleEntries, chops: guideFixture.chopCalls,
    tens: guideFixture.tenCalls, remaining: Game.state.choppingCount, total: Game.state.totalChops,
    coin: Game.state.coin, quantity: Game.inventory.reduce((sum, item) => sum + item.quantity, 0),
    overlay: document.querySelectorAll('.first-chop-guide').length,
    locked: document.documentElement.classList.contains('first-chop-guide-open') })),
  { singles: 2, chops: 2, tens: 0, remaining: 49, total: 1, coin: 1234, quantity: 1, overlay: 0, locked: false },
  'one failed attempt plus one success produces exactly one local reward and fully clears the guide');
  assert.equal(await page.locator('.reward-dialog--single').count(), 1, 'existing single-chop reward dialog is retained');
  await page.locator('.reward-reveal-confirm').click();
  await page.evaluate(() => document.getElementById('guide-fixture-outside').click());
  assert.equal(await page.evaluate(() => guideFixture.outsideClicks), 1, 'normal controls work again after success');
  await page.evaluate(() => PlayerView.renderCultivate());
  await frames(page);
  assert.equal(await page.evaluate(() => FirstChopGuide.isActive()), false, 'saved totalChops prevents a repeat guide on redraw');
  return { viewport, hole: initial.hole, bubble: initial.bubble, singleAttempts: 2, successfulChops: 1 };
}

async function eligibilityAndLifecycle(page) {
  for (const settings of [{ totalChops: 8 }, { environment: 'test' }, { role: 'admin' }, { choppingCount: 0 }]) {
    await fixture(page, settings);
    assert.equal(await page.evaluate(() => FirstChopGuide.isActive()), false, `automatic guide skips ${JSON.stringify(settings)}`);
  }
  await fixture(page, { environment: 'test', totalChops: 73, choppingCount: 50 });
  const before = await page.evaluate(() => JSON.stringify({ state: Game.state, inventory: Game.inventory, weapons: Game.weapons }));
  const replay = page.locator('.guide-replay-button');
  assert.equal(await replay.count(), 1);
  assert.ok((await replay.boundingBox()).height >= 44, 'test replay has at least a 44px touch target');
  await replay.click();
  await ready(page);
  assert.equal(await page.evaluate(() => JSON.stringify({ state: Game.state, inventory: Game.inventory, weapons: Game.weapons })), before,
    'starting replay does not reset saved progression or grant resources');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await frames(page);
  assert.equal(await page.evaluate(() => document.querySelector('.first-chop-guide')
    .getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0,
  'reduced-motion mode makes guide stable');
  await geometry(page, 'reduced motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await frames(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await frames(page);
  assert.equal(await page.evaluate(() => document.querySelector('.first-chop-guide')
    .getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0,
  'background document pauses guide motion');
  await page.evaluate(() => {
    delete document.hidden; delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await ready(page);
  await page.evaluate(() => XianlaiShell.setBackgrounded(true));
  await frames(page);
  assert.equal(await page.evaluate(() => document.querySelector('.first-chop-guide')
    .getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0,
  'native Android background lifecycle pauses guide motion');
  await page.evaluate(() => XianlaiShell.setBackgrounded(false));
  await ready(page);
  await clickChop(page, true);
  await finishChop(page, true);
  assert.equal(await page.evaluate(() => Game.state.totalChops), 74, 'test replay adds the one successful chop without resetting prior 73');
  await page.locator('.reward-reveal-confirm').click();
  await fixture(page, { environment: 'test', choppingCount: 0, totalChops: 73 });
  await page.locator('.guide-replay-button').click();
  assert.equal(await page.evaluate(() => FirstChopGuide.isActive()), false, 'zero-count replay never locks the player');
  assert.ok((await page.evaluate(() => guideFixture.toasts)).some(message => message.includes('次数')), 'zero-count replay explains missing resource');
  await fixture(page);
  await ready(page);
  await page.evaluate(() => Router.playerTab('tasks'));
  assert.equal(await page.evaluate(() => FirstChopGuide.isActive()), false, 'leaving cultivation cleans up the guide');
  await fixture(page);
  await ready(page);
  await clickChop(page);
  await page.evaluate(() => { Auth.session = null; Router.playerTab('tasks'); });
  await page.evaluate(() => guideFixture.finishChop(false));
  await page.waitForFunction(() => !OperationGuard.isBusy());
  assert.equal(await page.evaluate(() => FirstChopGuide.isActive()), false, 'late failed request cannot restore a departed account guide');
  assert.equal(await page.locator('.first-chop-guide').count(), 0);
  return { existingSkipped: true, testReplay: true, adminSkipped: true, zeroCountSkipped: true,
    reducedMotion: true, documentBackground: true, nativeBackground: true, staleRequestCleaned: true };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage();
  const errors = [], requests = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method()) || /supabase\./.test(url.hostname)) {
        requests.push(`${request.method()} ${url.origin}`); return route.abort();
      }
      if (url.origin !== ORIGIN) return route.abort();
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
          '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });
    const selected = process.argv.find(argument => argument.startsWith('--viewport='))?.split('=')[1];
    const viewports = selected ? VIEWPORTS.filter(viewport => `${viewport.width}x${viewport.height}` === selected) : VIEWPORTS;
    assert.ok(viewports.length, 'viewport must be one of the five declared sizes');
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(ORIGIN);
      checks.push(await firstChopScenario(page, viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ORIGIN);
    const lifecycle = await eligibilityAndLifecycle(page);
    assert.deepEqual(errors, [], 'no browser runtime errors');
    assert.deepEqual(requests, [], 'no player/account/database request was attempted');
    console.log(JSON.stringify({ ok: true, pageErrors: errors, unexpectedRequests: requests, checks, lifecycle }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
