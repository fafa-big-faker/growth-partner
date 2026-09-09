/* Actual CSS/timer geometry with local rewards and audio spies; no screenshots or accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

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
      if (url.origin !== 'http://reveal.local') return route.abort();
      const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });

    async function start(single = false) {
      return page.evaluate(async single => {
        window.revealProbe?.observer.disconnect();
        window.revealProbe?.controller.cancel();
        document.getElementById('modal-container').replaceChildren();
        const base = { itemId: '40001', quantity: 12, baseQuantity: 2, quality: 3, refundChopping: 2,
          buffTriggers: [{ type: 1, beforeQuantity: 2, afterQuantity: 6, multiplier: 3, buffQuality: 3 }, { beforeQuantity: 6, afterQuantity: 12, multiplier: 2, buffQuality: 5 }] };
        const regular = [base, { itemId: '1', quantity: 1, quality: 1, refundChopping: 3 },
          ...Array.from({ length: 8 }, (_, index) => ({ itemId: '40001', quantity: index + 1, quality: index % 5 + 1 }))];
        const extra = { ...base, itemId: '0', quantity: 12, refundChopping: 0, isExtra: true };
        const input = single ? [base] : [extra, ...regular];
        const source = JSON.stringify(input);
        const rewards = RewardPresentation.createRenderer({ items: ITEMS, quality: QUALITY, renderItemIcon, escapeHtml });
        const body = single ? rewards.renderItem(base, { size: 'large' }) + rewards.renderNotice() : rewards.renderResults(input);
        const overlay = UI.modal(body, { title: single ? '获得物品' : '十连砍结果',
          footer: `<div class="modal-footer"><button class="btn btn-primary reward-reveal-confirm">${single ? '收下' : '显示全部'}</button></div>` });
        overlay.classList.add('reward-dialog-overlay');
        const modal = overlay.querySelector('.modal');
        modal.classList.add('reward-dialog', single ? 'reward-dialog--single' : 'reward-dialog--ten');
        await Promise.all([...overlay.querySelectorAll('img')].map(image => image.decode()));
        await Promise.all(modal.getAnimations().map(animation => animation.finished.catch(() => {})));
        const button = overlay.querySelector('.reward-reveal-confirm');
        const probe = { overlay, input, source, played: [], stopped: [], completed: 0, quantities: [], snapshots: [], animations: new Set(), states: [], phases: [], startedAt: 0 };
        function capture() {
          const footer = button.getBoundingClientRect();
          const content = overlay.querySelector('.modal-body').getBoundingClientRect();
          const items = [...overlay.querySelectorAll('.reward-item')];
          const quantity = items[0].querySelector('.reward-item-quantity-value').textContent;
          if (probe.quantities.at(-1) !== quantity) probe.quantities.push(quantity);
          const values = items.map(item => item.dataset.revealState || 'final');
          if (JSON.stringify(probe.states.at(-1)) !== JSON.stringify(values)) probe.states.push(values);
          for (const node of overlay.querySelectorAll('.reward-quality-ink, .reward-item-quantity-value')) {
            const name = getComputedStyle(node).animationName;
            if (name !== 'none') probe.animations.add(name);
          }
          const notice = overlay.querySelector('.reward-skill-notice');
          const noticeText = notice.querySelector('.reward-skill-notice-text');
          const countBox = items[0].querySelector('.reward-item-quantity').getBoundingClientRect();
          const multiplierBox = items[0].querySelector('.reward-item-buff').getBoundingClientRect();
          if (probe.startedAt) probe.phases.push({ at: performance.now() - probe.startedAt, quantity,
            notice: noticeText.textContent, color: getComputedStyle(noticeText).color,
            shaking: items[0].classList.contains('is-count-shaking'), changing: items[0].classList.contains('is-count-changing'),
            duration: getComputedStyle(items[0].querySelector('.reward-item-quantity-value')).animationDuration });
          probe.snapshots.push({ buttonY: footer.y, buttonBottom: footer.bottom, bodyBottom: content.bottom,
            modalHeight: modal.getBoundingClientRect().height,
            noticeHeight: notice.getBoundingClientRect().height, noticeTop: notice.getBoundingClientRect().top, noticeBottom: notice.getBoundingClientRect().bottom,
            bodyTop: content.top, countHeight: countBox.height, multiplierTop: multiplierBox.top - countBox.top,
            noticeFits: noticeText.scrollWidth <= noticeText.clientWidth + 1,
            scrollbarWidth: getComputedStyle(overlay.querySelector('.modal-body')).scrollbarWidth,
            scrollbarGutter: getComputedStyle(overlay.querySelector('.modal-body')).scrollbarGutter,
            footerTop: overlay.querySelector('.modal-footer').getBoundingClientRect().top,
            bodyOverflow: overlay.querySelector('.modal-body').scrollWidth > overlay.querySelector('.modal-body').clientWidth + 1,
            reachable: button.contains(document.elementFromPoint(footer.x + footer.width / 2, footer.y + footer.height / 2)),
            items: items.map(item => { const box = item.getBoundingClientRect(); return { y: box.y, height: box.height }; }) });
        }
        capture();
        probe.baseline = probe.snapshots[0];
        probe.quantities = [];
        probe.observer = new MutationObserver(capture);
        probe.observer.observe(overlay, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-reveal-state'] });
        probe.startedAt = performance.now();
        probe.controller = RewardPresentation.playReveal(overlay, {
          audio: { playEffect(name, options) { probe.played.push({ name, group: options.group, at: performance.now() - probe.startedAt }); return Promise.resolve(true); }, stopEffects(group) { probe.stopped.push(group); } },
          onComplete() { probe.completed++; button.textContent = '收下'; },
        });
        button.addEventListener('click', () => {
          if (!single && !probe.completed) probe.controller.finish();
          else { probe.controller.cancel(); overlay.remove(); }
        });
        window.revealProbe = probe;
        capture();
        return { count: input.length, firstQuantity: probe.quantities[0], initialState: overlay.dataset.rewardRevealState,
          refunds: overlay.querySelectorAll('.reward-item-refund, .reward-refund-total').length,
          notices: overlay.querySelectorAll('.reward-skill-notice').length, button: button.textContent };
      }, single);
    }

    async function report() {
      return page.evaluate(() => {
        const probe = revealProbe;
        return { completed: probe.completed, quantities: probe.quantities, played: probe.played, stopped: probe.stopped,
          snapshots: probe.snapshots, baseline: probe.baseline, animations: [...probe.animations], states: probe.states, phases: probe.phases,
          unchanged: probe.source === JSON.stringify(probe.input), state: probe.overlay.dataset.rewardRevealState,
          finalQuantities: [...probe.overlay.querySelectorAll('.reward-item-quantity-value')].map(node => node.textContent),
          button: probe.overlay.querySelector('button.reward-reveal-confirm').textContent };
      });
    }

    function assertStable(result, viewport) {
      for (const snapshot of result.snapshots) {
        assert.ok(Math.abs(snapshot.buttonY - result.baseline.buttonY) <= 1, 'reveal must not move the footer: ' + JSON.stringify({ viewport, baseline: result.baseline, snapshot }));
        assert.ok(snapshot.buttonBottom <= viewport.height - 11, 'confirmation remains onscreen');
        assert.ok(snapshot.bodyBottom <= snapshot.footerTop + 1, 'body never overlaps footer');
        assert.equal(snapshot.bodyOverflow, false, 'long feedback remains inside the scroll body');
        assert.equal(snapshot.reachable, true, 'confirmation stays reachable during all animation phases');
        assert.equal(snapshot.noticeHeight, 32, 'one shared notice retains stable compact height');
        assert.ok(snapshot.noticeBottom <= snapshot.footerTop + 1, 'shared notice remains above the footer');
        assert.ok(snapshot.noticeTop >= snapshot.bodyTop - 1, 'sticky notice stays visible even in short landscape');
        assert.ok(snapshot.countHeight <= 20, 'ordinary quantity and its compact multiplier mark stay on one line');
        assert.ok(snapshot.multiplierTop < 6, 'multiplier does not silently wrap below the quantity');
        assert.equal(snapshot.noticeFits, true, 'skill notice fits on one line');
        assert.equal(snapshot.scrollbarWidth, 'none', 'reward scrollbar track is hidden');
        assert.equal(snapshot.scrollbarGutter, 'auto', 'no empty scrollbar gutter is reserved');
      }
      assert.equal(result.unchanged, true, 'presentation does not mutate granted rewards');
    }

    for (const viewport of [{ width: 360, height: 540 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize(viewport);
      await page.goto('http://reveal.local');
      await page.evaluate(() => { LoginArt.setVisible(false); document.getElementById('login-screen').style.display = 'none'; });
      const initial = await start();
      assert.equal(initial.firstQuantity, '×2');
      assert.equal(initial.initialState, 'running');
      assert.equal(initial.refunds, 0);
      assert.equal(initial.notices, 1);
      assert.equal(initial.button, '显示全部');
      await page.waitForFunction(() => revealProbe.completed === 1, null, { timeout: 6000 });
      const natural = await report();
      assertStable(natural, viewport);
      assert.deepEqual(natural.quantities, ['×2', '×6', '×12']);
      const skillSounds = natural.played.filter(sound => sound.name === 'skillTrigger');
      assert.equal(skillSounds.length, 2, 'only true multiplier skills animate in results; refunds do not');
      assert.ok(Math.abs(skillSounds[1].at - skillSounds[0].at - 1300) < 90, 'second trigger follows the full first 1300ms');
      for (const [index, expected] of [{ old: '×2', next: '×6', multiplier: 3 }, { old: '×6', next: '×12', multiplier: 2 }].entries()) {
        const at = skillSounds[index].at;
        const phase = natural.phases.find(entry => entry.notice === `斧技发动 · 数量×${expected.multiplier}`);
        assert.ok(phase && phase.quantity === expected.old && !phase.shaking && !phase.changing, 'notice starts with the unchanged still quantity');
        assert.equal(phase.color, 'rgb(124, 76, 168)', 'notice uses active item quality, not the skill rarity');
        const shaking = natural.phases.find(entry => entry.at >= at && entry.shaking && entry.quantity === expected.old);
        assert.ok(shaking && Math.abs(shaking.at - at - 300) < 90, 'old quantity begins a 500ms shake after the notice hold');
        assert.equal(shaking.duration, '0.5s');
        const changed = natural.phases.find(entry => entry.at >= at && entry.changing && entry.quantity === expected.next);
        assert.ok(changed && Math.abs(changed.at - at - 800) < 90, 'new quantity appears only after all 300+500ms');
        assert.equal(changed.duration, '0.5s');
        assert.ok(natural.phases.filter(entry => entry.at >= at && entry.at < changed.at).every(entry => entry.quantity === expected.old), 'all observed old-quantity phases retain the old value');
        const settled = natural.phases.find(entry => entry.at > changed.at && !entry.changing && entry.quantity === expected.next);
        assert.ok(settled && Math.abs(settled.at - at - 1300) < 90, 'new quantity settles only after its full 500ms');
      }
      assert.equal(new Set(natural.played.map(sound => sound.group)).size, 1, 'one modal owns one audio group');
      assert.equal(natural.stopped.length, 0, 'natural completion lets the last audio tail finish');
      assert.ok(natural.animations.includes('reward-skill-ink'), 'real ink pulse is active');
      assert.ok(natural.animations.includes('reward-count-shake'), 'old number has a real dedicated shake');
      assert.ok(natural.animations.includes('reward-count-arrive'), 'new number has a real scale-and-settle animation');
      assert.equal(natural.animations.includes('reward-refund-reveal'), false);
      assert.equal(natural.finalQuantities.at(-1), '×12', 'extra reward remains final and does not acquire fake skills');
      assert.equal(natural.button, '收下');
      const firstLaterReveal = natural.states.find(states => states[1] !== 'pending' && states[0] !== 'final');
      assert.equal(firstLaterReveal[0], 'complete', 'next item starts only after every type-1 presentation completes');

      const immediate = await start(true);
      assert.equal(immediate.button, '收下');
      await page.locator('.reward-reveal-confirm').click();
      assert.equal(await page.locator('.reward-dialog-overlay').count(), 0, 'single reward closes on its first click, including during a skill');
      const closed = await report();
      assert.equal(closed.state, 'cancelled');
      assert.equal(closed.completed, 0);

      const modes = [];
      for (const mode of ['finish', 'cancel', 'removed', 'hidden']) {
        await start(true);
        const action = await page.evaluate(mode => {
          const probe = revealProbe;
          if (mode === 'removed') probe.overlay.remove();
          else if (mode === 'hidden') probe.overlay.hidden = true;
          else probe.controller[mode]();
          return { sounds: probe.played.length, group: probe.played[0].group };
        }, mode);
        await page.waitForTimeout(450);
        const result = await report();
        assert.equal(result.played.length, action.sounds, 'cancel/skip/hide/remove cannot emit late sounds');
        assert.ok(result.stopped.includes(action.group), 'owned group is stopped');
        assert.equal(result.completed, ['finish', 'hidden'].includes(mode) ? 1 : 0);
        assert.equal(result.finalQuantities[0], '×12');
        assert.equal(result.unchanged, true);
        if (mode === 'finish') {
          assertStable(result, viewport);
          await page.locator('.reward-reveal-confirm').click();
          assert.equal(await page.locator('.reward-dialog-overlay').count(), 0, 'after skip the same button closes the final rewards');
        }
        if (mode === 'hidden') {
          await page.evaluate(() => { revealProbe.overlay.hidden = false; });
          assert.equal(await page.locator('.reward-reveal-confirm').textContent(), '收下', 'restored hidden modal has a working completed footer');
        }
        modes.push(mode);
      }

      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reduced = await start();
      assert.equal(reduced.initialState, 'complete');
      const staticResult = await report();
      assert.equal(staticResult.played.length, 0);
      assert.equal(staticResult.completed, 1);
      assert.equal(staticResult.finalQuantities[0], '×12');
      assertStable(staticResult, viewport);
      checks.push({ viewport, realQuantityStages: natural.quantities, skillCues: 2, triggerDuration: 1300, animations: natural.animations,
        stableSnapshots: natural.snapshots.length, cancellationModes: modes, reducedMotion: 'final without audio' });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(JSON.stringify({ ok: true, viewports: checks.length, pageErrors: errors, writes: 0, checks }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
