/* Real PlayerView.doChopTen entry and cultivation redraw; no screenshots or live accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ORIGIN = 'http://reward-entry.local';
const ROOT = path.resolve(__dirname, '..');
const BASELINE = process.argv.find(argument => argument.startsWith('--baseline='))?.slice(11)
  || (process.argv.includes('--baseline') ? '4ed9ade6ee0c9132244d973bc02f7a0fb7f2487e' : null);

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage();
  const errors = [], writes = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method()); return route.abort(); }
      const url = new URL(request.url());
      if (url.origin !== ORIGIN) return route.abort();
      const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
      if (!file.startsWith(ROOT + path.sep)) return route.abort();
      try {
        const relative = path.relative(ROOT, file).replaceAll('\\', '/');
        const body = BASELINE && ['app.js', 'reward-presentation.js', 'reward-presentation.css'].includes(relative)
          ? execFileSync('git', ['show', `${BASELINE}:${relative}`], { cwd: ROOT }) : await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
          '.webp': 'image/webp', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });

    async function fixture(viewport, reducedMotion = 'no-preference', stallMs = 0) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion });
      await page.goto(ORIGIN);
      await page.evaluate(({ stallMs }) => {
        LoginArt.setVisible(false);
        Auth._warmup?.abort();
        LoginBoot.destroy?.();
        document.querySelector('.login-boot')?.remove();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('player-dashboard').style.display = 'flex';
        document.getElementById('admin-dashboard').style.display = 'none';
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        Auth.session = { role: 'player', environment: 'test', playerRole: 'reward-entry-fixture' };
        DB.playerRole = 'reward-entry-fixture';
        const axe = Object.values(ITEMS).find(item => item.type === 5 && item.quality === 1);
        const weapon = { id: 'reward-entry-fixture-axe', itemId: String(axe.id), skillRolls: [] };
        Game.state = { level: 100, realmLevel: 99, treeRealm: TREE_REALMS[0].level,
          treeLevel: TREE_REALMS[0].treeLevel, axeId: String(axe.id), axeInstanceId: weapon.id,
          coin: 1234, choppingCount: 50, exp: 0, totalChops: 100 };
        Game.inventory = [];
        Game.weapons = [weapon];
        Game.equippedWeapon = weapon;
        PlayerView._tenChopMode = true;
        const item = Object.values(ITEMS).find(entry => entry.type === 1 && entry.quality === 1);
        window.entryProbe = { calls: 0, redraws: 0, sounds: [], stops: [], frames: [], changes: [],
          overlay: null, started: 0, ended: 0, raf: 0, redrawStallMs: stallMs };
        Game.chopTen = async () => {
          entryProbe.calls++;
          Game.state.choppingCount -= 10;
          Game.state.totalChops += 10;
          const rewards = Array.from({ length: 10 }, () => ({ itemId: String(item.id), quantity: 1,
            quality: 1, qualityName: QUALITY[1].name, item, kind: 'item' }));
          rewards[9].extraDrop = { itemId: '0', quantity: 1, quality: 1, isExtra: true };
          entryProbe.granted = JSON.stringify(rewards);
          entryProbe.results = rewards;
          return rewards;
        };
        // The test targets the result entry, not the already-covered ten physical strikes.
        // Keep the real action, lock, renderer, modal and full cultivation redraw.
        CultivatorAnimator.playChop = async () => true;
        PlayerView._waitForChopFeedback = async (_ms, version) => version === PlayerView._chopPresentationVersion;
        UI.playScatterAnimation = () => null;
        AudioManager.playEffect = async (name, options = {}) => {
          if (options.group?.startsWith('reward-dialog-')) entryProbe.sounds.push({ name, group: options.group, at: performance.now() });
          return true;
        };
        AudioManager.stopEffects = group => entryProbe.stops.push(group);
        PlayerView.renderCultivate();
        const realRender = PlayerView.renderCultivate;
        PlayerView.renderCultivate = function (...args) {
          entryProbe.redraws++;
          const work = realRender.apply(this, args);
          const until = performance.now() + entryProbe.redrawStallMs;
          while (performance.now() < until) { /* Simulate a long synchronous layout/image task. */ }
          entryProbe.redrawDone = performance.now();
          return work;
        };
        const realModal = UI.modal;
        UI.modal = function (...args) {
          const overlay = realModal.apply(this, args);
          entryProbe.overlay = overlay;
          entryProbe.started = performance.now();
          function capture(target) {
            target.push({ at: performance.now(), state: overlay.dataset.rewardRevealState,
              visible: [...overlay.querySelectorAll('.reward-item')].filter(item => !item.classList.contains('is-reward-pending')).length,
              states: [...overlay.querySelectorAll('.reward-item')].map(item => item.dataset.revealState),
              pendingVisible: [...overlay.querySelectorAll('.is-reward-pending .reward-art')].some(art => +getComputedStyle(art).opacity > 0) });
          }
          entryProbe.observer = new MutationObserver(() => capture(entryProbe.changes));
          entryProbe.observer.observe(overlay, { attributes: true, childList: true, subtree: true,
            attributeFilter: ['class', 'data-reveal-state', 'data-reward-reveal-state'] });
          function frame() {
            capture(entryProbe.frames);
            if (overlay.isConnected && overlay.dataset.rewardRevealState === 'running') entryProbe.raf = requestAnimationFrame(frame);
          }
          entryProbe.raf = requestAnimationFrame(frame);
          return overlay;
        };
        entryProbe.work = PlayerView.doChopTen().then(value => { entryProbe.ended = performance.now(); return value; });
      }, { stallMs });
      await page.waitForFunction(() => entryProbe.ended > 0);
    }

    async function report() {
      return page.evaluate(() => ({ calls: entryProbe.calls, redraws: entryProbe.redraws,
        counts: Game.state.choppingCount, total: Game.state.totalChops,
        unchanged: entryProbe.granted === JSON.stringify(entryProbe.results),
        started: entryProbe.started, redrawDone: entryProbe.redrawDone,
        sounds: entryProbe.sounds, stops: entryProbe.stops, frames: entryProbe.frames, changes: entryProbe.changes,
        state: entryProbe.overlay.dataset.rewardRevealState,
        count: entryProbe.overlay.querySelectorAll('.reward-item').length,
        button: entryProbe.overlay.querySelector('.reward-reveal-confirm').textContent,
        connected: entryProbe.overlay.isConnected,
      }));
    }

    for (const settings of [
      { viewport: { width: 1440, height: 900 }, reduced: 'no-preference', stall: 0 },
      { viewport: { width: 390, height: 844 }, reduced: 'no-preference', stall: 0 },
      { viewport: { width: 1440, height: 900 }, reduced: 'reduce', stall: 0 },
      { viewport: { width: 1440, height: 900 }, reduced: 'no-preference', stall: 1900 },
    ]) {
      await fixture(settings.viewport, settings.reduced, settings.stall);
      await page.waitForTimeout(300);
      const initial = await report();
      if (process.argv.includes('--diagnose')) {
        checks.push({ settings, state: initial.state, firstFrameVisible: initial.frames[0]?.visible,
          finalVisible: initial.frames.at(-1)?.visible, cuesIn300ms: initial.sounds.length,
          cueOffsets: initial.sounds.map(sound => Math.round(sound.at - initial.started)),
          redrawMs: Math.round(initial.redrawDone - initial.started), pendingVisible: initial.frames.some(frame => frame.pendingVisible) });
        continue;
      }
      assert.equal(initial.calls, 1, 'real ten-chop entry calls the mocked persistence boundary once');
      assert.equal(initial.redraws, 1, 'real cultivation redraw is part of the tested path');
      assert.equal(initial.count, 11, 'real entry includes the extra drop');
      assert.equal(initial.state, 'running', 'results still reveal sequentially after entry');
      assert.equal(initial.button, '显示全部');
      assert.ok(initial.frames.length >= 2, 'entry reaches real browser paint frames');
      assert.ok(initial.frames[0].visible <= 1, 'first painted result frame cannot show the entire result');
      assert.ok(initial.frames.every(frame => !frame.pendingVisible), 'pending results stay visually hidden, including reduced motion');
      assert.ok(initial.sounds.length <= 3, 'a synchronous redraw does not burst all queued result cues');
      await page.waitForFunction(() => entryProbe.overlay.dataset.rewardRevealState === 'complete', null, { timeout: 5000 });
      const finished = await report();
      assert.equal(finished.sounds.length, 11, 'each ordinary result has exactly one arrival cue');
      assert.ok(finished.sounds.slice(1).every((sound, index) => sound.at - finished.sounds[index].at >= 185),
        'subsequent arrivals retain their visible cadence after real entry and redraw');
      assert.equal(finished.button, '收下');
      assert.equal(finished.unchanged, true);
      assert.equal(finished.counts, 40);
      assert.equal(finished.total, 110);
      checks.push({ settings, firstFrameVisible: initial.frames[0].visible,
        first300msCues: initial.sounds.length, finalCues: finished.sounds.length, resourceCalls: finished.calls });
    }

    if (!process.argv.includes('--diagnose')) {
      // A stall after animation has already begun must not drain the whole timeline either.
      await fixture({ width: 1440, height: 900 });
      await page.waitForFunction(() => entryProbe.sounds.length >= 2);
      const resumed = await page.evaluate(async () => {
        const before = entryProbe.sounds.length;
        const until = performance.now() + 1800;
        while (performance.now() < until) { /* An unrelated long browser task. */ }
        await new Promise(resolve => setTimeout(resolve, 40));
        return { before, after: entryProbe.sounds.length };
      });
      assert.ok(resumed.after - resumed.before <= 1, 'late timers resume one arrival rather than skip every overdue reward');
      await page.locator('.reward-reveal-confirm').click();
      const skipped = await report();
      assert.equal(skipped.state, 'complete');
      assert.equal(skipped.button, '收下');
      await page.waitForTimeout(280);
      assert.equal((await report()).sounds.length, skipped.sounds.length, 'skip cancels future owned sounds');
      assert.ok(skipped.stops.includes(skipped.sounds[0].group), 'skip stops its own audio group');
      await page.locator('.reward-reveal-confirm').click();
      assert.equal((await report()).connected, false, 'second click collects the real completed result');

      await fixture({ width: 1440, height: 900 });
      await page.waitForFunction(() => entryProbe.sounds.length > 0);
      await page.locator('.reward-dialog-overlay .modal-close').click();
      const closed = await report();
      assert.equal(closed.connected, false);
      assert.equal(closed.state, 'cancelled');
      await page.waitForTimeout(280);
      assert.equal((await report()).sounds.length, closed.sounds.length, 'close cannot emit late effects');
      assert.equal(closed.unchanged, true);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(JSON.stringify({ ok: true, pageErrors: errors, writes: 0, checks }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
