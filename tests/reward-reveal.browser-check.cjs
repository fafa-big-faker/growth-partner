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

    async function start(single = false, variant = 'normal') {
      return page.evaluate(async ({ single, variant }) => {
        window.revealProbe?.observer.disconnect();
        window.revealProbe?.controller.cancel();
        window.clearTimeout(window.revealProbe?.preSkillTimer);
        document.getElementById('modal-container').replaceChildren();
        const rarities = variant === 'reverse' ? [5, 2] : [2, 5];
        const base = { itemId: '40001', quantity: 12, baseQuantity: 2, quality: 3, refundChopping: 2,
          buffTriggers: [{ type: 1, beforeQuantity: 2, afterQuantity: 6, multiplier: 3, buffQuality: rarities[0] }, { beforeQuantity: 6, afterQuantity: 12, multiplier: 2, buffQuality: rarities[1] }] };
        const regular = [base, { itemId: '1', quantity: 1, quality: 1, refundChopping: 3 },
          ...Array.from({ length: 8 }, (_, index) => ({ itemId: '40001', quantity: index + 1, quality: index % 5 + 1 }))];
        if (variant === 'long') {
          regular[0] = { itemId: '40001', quantity: 2, quality: 3 };
          ITEMS['reveal-long'] = { ...ITEMS['40001'], name: '检验长名称换行用锻造石' };
          regular[8] = { itemId: 'reveal-long', baseQuantity: 2, quantity: 24690, quality: 4,
            buffTriggers: [{ type: 1, beforeQuantity: 2, afterQuantity: 24690, multiplier: 12345, buffQuality: 4 }] };
        }
        const extra = { ...base, itemId: '0', quantity: 12, refundChopping: 0, isExtra: true };
        const input = single ? [base] : [extra, ...regular];
        const source = JSON.stringify(input);
        const rewards = RewardPresentation.createRenderer({ items: ITEMS, quality: QUALITY, renderItemIcon, escapeHtml });
        const body = single ? rewards.renderItem(base, { size: 'large' }) : rewards.renderResults(input);
        const overlay = UI.modal(body, { title: single ? '获得物品' : '十连砍结果',
          footer: `<div class="modal-footer"><button class="btn btn-primary reward-reveal-confirm">${single ? '收下' : '显示全部'}</button></div>` });
        overlay.classList.add('reward-dialog-overlay');
        const modal = overlay.querySelector('.modal');
        modal.classList.add('reward-dialog', single ? 'reward-dialog--single' : 'reward-dialog--ten');
        // Keep room for the 153px long-name item while its second row still starts outside the short body.
        if (variant === 'long') modal.style.maxHeight = '330px';
        await Promise.all([...overlay.querySelectorAll('img')].map(image => image.decode()));
        await Promise.all(modal.getAnimations().map(animation => animation.finished.catch(() => {})));
        const button = overlay.querySelector('.reward-reveal-confirm');
        const probe = { overlay, input, source, played: [], stopped: [], audioActions: [], completed: 0, quantities: [], snapshots: [], animations: new Set(), states: [], phases: [], startedAt: 0, arrivals: [],
          originalNames: [...overlay.querySelectorAll('.reward-item-name')].map(name => name.textContent),
          originalNameClasses: [...overlay.querySelectorAll('.reward-item-name')].map(name => name.className),
          originalNameColors: [...overlay.querySelectorAll('.reward-item-name')].map(name => getComputedStyle(name).color),
          staticQuantities: [...overlay.querySelectorAll('.reward-item-quantity-value')].map(count => ({ text: count.textContent, classes: count.className, color: getComputedStyle(count).color })), pageY: window.scrollY };
        function capture() {
          const footer = button.getBoundingClientRect();
          const content = overlay.querySelector('.modal-body').getBoundingClientRect();
          const items = [...overlay.querySelectorAll('.reward-item')];
          const quantityNode = items[0].querySelector('.reward-item-quantity-value');
          const quantity = quantityNode.textContent;
          if (probe.quantities.at(-1) !== quantity) probe.quantities.push(quantity);
          const values = items.map(item => item.dataset.revealState || 'final');
          if (JSON.stringify(probe.states.at(-1)) !== JSON.stringify(values)) probe.states.push(values);
          for (const node of overlay.querySelectorAll('.reward-quality-ink, .reward-burst-atlas, .reward-art-icon, .reward-item-quantity-value')) {
            const name = getComputedStyle(node).animationName;
            if (name !== 'none') probe.animations.add(name);
          }
          const name = items[0].querySelector('.reward-item-name');
          const countBox = items[0].querySelector('.reward-item-quantity').getBoundingClientRect();
          if (probe.startedAt) probe.phases.push({ at: performance.now() - probe.startedAt, quantity,
            label: name.textContent, fullLabel: name.getAttribute('aria-label'), color: getComputedStyle(name).color,
            quantityColor: getComputedStyle(quantityNode).color, quantityClasses: quantityNode.className,
            shaking: items[0].classList.contains('is-count-shaking'), changing: items[0].classList.contains('is-count-changing'),
            duration: getComputedStyle(items[0].querySelector('.reward-item-quantity-value')).animationDuration,
            revealState: items[0].dataset.revealState,
            iconOpacity: +getComputedStyle(items[0].querySelector('.reward-art-icon')).opacity });
          if (probe.startedAt) items.forEach((item, index) => {
            if (item.dataset.revealState && item.dataset.revealState !== 'pending' && !probe.arrivals.some(entry => entry.index === index)) {
              probe.arrivals.push({ index, at: performance.now() - probe.startedAt, quality: +item.dataset.rewardQuality });
            }
          });
          probe.snapshots.push({ buttonY: footer.y, buttonBottom: footer.bottom, bodyBottom: content.bottom,
            modalHeight: modal.getBoundingClientRect().height,
            bodyTop: content.top, countHeight: countBox.height, pageY: window.scrollY,
            bodyScrollTop: overlay.querySelector('.modal-body').scrollTop,
            scrollbarWidth: getComputedStyle(overlay.querySelector('.modal-body')).scrollbarWidth,
            scrollbarGutter: getComputedStyle(overlay.querySelector('.modal-body')).scrollbarGutter,
            footerTop: overlay.querySelector('.modal-footer').getBoundingClientRect().top,
            bodyOverflowX: getComputedStyle(overlay.querySelector('.modal-body')).overflowX,
            bodyWidth: content.width,
            reachable: button.contains(document.elementFromPoint(footer.x + footer.width / 2, footer.y + footer.height / 2)),
            items: items.map(item => {
              const box = item.getBoundingClientRect(), name = item.querySelector('.reward-item-name'), nameBox = name.getBoundingClientRect();
              const artBox = item.querySelector('.reward-art').getBoundingClientRect(), count = item.querySelector('.reward-item-quantity').getBoundingClientRect();
              return { y: box.y, height: box.height, nameHeight: nameBox.height, active: item.classList.contains('is-skill-active'), label: name.textContent,
                fullLabel: name.getAttribute('aria-label'), title: name.getAttribute('title'),
                nameFits: name.scrollWidth <= name.clientWidth + 1, nameSize: parseFloat(getComputedStyle(name).fontSize),
                nameWidth: nameBox.width, nameScrollWidth: name.scrollWidth, nameClientWidth: name.clientWidth,
                textInsideBody: nameBox.left >= content.left - 1 && nameBox.right <= content.right + 1 && count.left >= content.left - 1 && count.right <= content.right + 1,
                imageVisible: artBox.top >= content.top - 1 && artBox.bottom <= content.bottom + 1,
                countVisible: count.top >= content.top - 1 && count.bottom <= content.bottom + 1 };
            }) });
        }
        capture();
        probe.baseline = probe.snapshots[0];
        probe.quantities = [];
        probe.observer = new MutationObserver(capture);
        probe.observer.observe(overlay, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-reveal-state'] });
        probe.startedAt = performance.now();
        // During rare ink gathering, the underlying real name/base quantity must remain intact.
        probe.preSkillTimer = window.setTimeout(() => {
          const item = overlay.querySelector('.reward-item');
          const name = item.querySelector('.reward-item-name');
          probe.preSkillAt299 = { name: name.textContent, active: item.classList.contains('is-skill-active'),
            quantity: item.querySelector('.reward-item-quantity-value').textContent };
        }, 299);
        probe.controller = RewardPresentation.playReveal(overlay, {
          audio: { playEffect(name, options) { probe.played.push({ name, group: options.group, at: performance.now() - probe.startedAt }); probe.audioActions.push({ type: 'play', name, group: options.group }); return Promise.resolve(true); },
            stopEffects(group) { probe.stopped.push(group); probe.audioActions.push({ type: 'stop', group }); } },
          onComplete() { probe.completed++; button.textContent = '收下'; },
        });
        button.addEventListener('click', () => {
          if (!single && !probe.completed) probe.controller.finish();
          else { probe.controller.cancel(); overlay.remove(); }
        });
        window.revealProbe = probe;
        capture();
        return { count: input.length, firstQuantity: probe.quantities[0], initialState: overlay.dataset.rewardRevealState,
          firstColor: probe.phases[0].quantityColor, firstClasses: probe.phases[0].quantityClasses, staticQuantities: probe.staticQuantities,
          refunds: overlay.querySelectorAll('.reward-item-refund, .reward-refund-total').length,
          notices: overlay.querySelectorAll('.reward-skill-notice').length, multiplierMarks: overlay.querySelectorAll('.reward-item-buff').length,
          targetClipped: !probe.baseline.items[8]?.countVisible, button: button.textContent };
      }, { single, variant });
    }

    async function report() {
      return page.evaluate(() => {
        const probe = revealProbe;
        return { completed: probe.completed, connected: probe.overlay.isConnected, quantities: probe.quantities, played: probe.played, stopped: probe.stopped, audioActions: probe.audioActions,
          snapshots: probe.snapshots, baseline: probe.baseline, animations: [...probe.animations], states: probe.states, phases: probe.phases, arrivals: probe.arrivals,
          preSkillAt299: probe.preSkillAt299, originalNames: probe.originalNames,
          unchanged: probe.source === JSON.stringify(probe.input), state: probe.overlay.dataset.rewardRevealState,
          finalQuantities: [...probe.overlay.querySelectorAll('.reward-item-quantity-value')].map(node => node.textContent),
          finalQuantityColors: [...probe.overlay.querySelectorAll('.reward-item-quantity-value')].map(node => getComputedStyle(node).color),
          finalQuantityClasses: [...probe.overlay.querySelectorAll('.reward-item-quantity-value')].map(node => node.className),
          namesRestored: [...probe.overlay.querySelectorAll('.reward-item-name')].every((name, index) => name.textContent === probe.originalNames[index]
            && name.className === probe.originalNameClasses[index] && (!probe.overlay.isConnected || getComputedStyle(name).color === probe.originalNameColors[index])),
          button: probe.overlay.querySelector('button.reward-reveal-confirm').textContent };
      });
    }

    function assertStable(result, viewport, { extremeMultiplier = false } = {}) {
      for (const snapshot of result.snapshots) {
        assert.ok(Math.abs(snapshot.buttonY - result.baseline.buttonY) <= 1, 'reveal must not move the footer: ' + JSON.stringify({ viewport, baseline: result.baseline, snapshot }));
        assert.ok(snapshot.buttonBottom <= viewport.height - 11, 'confirmation remains onscreen');
        assert.ok(snapshot.bodyBottom <= snapshot.footerTop + 1, 'body never overlaps footer');
        assert.equal(snapshot.bodyOverflowX, 'hidden', 'temporary ink overshoot never exposes a horizontal scrollbar');
        assert.ok(Math.abs(snapshot.bodyWidth - result.baseline.bodyWidth) <= 1, 'ink overshoot cannot expand the result layout');
        assert.equal(snapshot.reachable, true, 'confirmation stays reachable during all animation phases');
        assert.equal(snapshot.pageY, result.baseline.pageY, 'the page never scrolls with a reward reveal');
        assert.ok(Math.abs(snapshot.modalHeight - result.baseline.modalHeight) <= 1, 'no extra height is added for local skill text');
        assert.ok(snapshot.countHeight <= 20, 'ordinary quantity stays on one line without a second multiplier');
        for (const [index, item] of snapshot.items.entries()) {
          assert.equal(item.textInsideBody, true, 'name and actual quantity remain inside the scroll body');
          assert.ok(Math.abs(item.nameHeight - result.baseline.items[index].nameHeight) <= 1, 'replacing a long name cannot collapse its existing area');
          if (!item.active) continue;
          assert.equal(item.nameFits, true, `skill label fits its own cell: ${JSON.stringify({ viewport, item })}`);
          if (!extremeMultiplier) assert.ok(item.nameSize >= 11, 'normal skill text stays readable in a 320px five-column layout');
          assert.match(item.label, /(?:！！|!!)$/, 'even a compact local label keeps both exclamations');
          assert.match(item.fullLabel, /^斧技·\d+(?:\.\d+)?倍！！$/, 'accessible label always retains full wording');
          assert.equal(item.title, item.fullLabel);
          assert.equal(item.imageVisible, true, 'active icon remains visible inside the body');
          assert.equal(item.countVisible, true, 'active quantity remains visible inside the body: ' + JSON.stringify({ viewport, index, item, snapshot }));
        }
        assert.equal(snapshot.scrollbarWidth, 'none', 'reward scrollbar track is hidden');
        assert.equal(snapshot.scrollbarGutter, 'auto', 'no empty scrollbar gutter is reserved');
      }
      assert.equal(result.unchanged, true, 'presentation does not mutate granted rewards');
    }

    const buffColors = { 2: 'rgb(74, 144, 217)', 4: 'rgb(232, 90, 138)', 5: 'rgb(240, 180, 41)' };
    const neutralQuantity = 'rgb(78, 87, 81)';

    function assertSkillSequence(result, rarities) {
      assert.deepEqual(result.quantities, ['×2', '×6！', '×12！']);
      const skillSounds = result.played.filter(sound => sound.name === 'skillTrigger');
      assert.equal(skillSounds.length, 2, 'only true multiplier skills animate in results; refunds do not');
      assert.deepEqual(result.preSkillAt299, { name: result.originalNames[0], active: false, quantity: '×2' }, '299ms still shows the original item name and plain base quantity');
      const firstArrival = result.played.find(sound => sound.name === 'rewardRare');
      assert.ok(firstArrival, 'the rare item uses its own complete arrival phrase');
      assert.ok(Math.abs(skillSounds[0].at - firstArrival.at - 1180) < 120, 'first skill follows the rare880ms arrival and full300ms real-name hold');
      assert.ok(Math.abs(skillSounds[1].at - skillSounds[0].at - 1300) < 90, 'second trigger follows the full first 1300ms');
      for (const [index, expected] of [{ old: '×2', next: '×6！', multiplier: 3 }, { old: '×6！', next: '×12！', multiplier: 2 }].entries()) {
        const at = skillSounds[index].at;
        const oldColor = index === 0 ? neutralQuantity : buffColors[rarities[index - 1]];
        const nextColor = buffColors[rarities[index]];
        const phase = result.phases.find(entry => entry.fullLabel === `斧技·${expected.multiplier}倍！！`);
        assert.ok(phase && phase.quantity === expected.old && !phase.shaking && !phase.changing, 'local name replacement starts with the unchanged still quantity');
        assert.equal(phase.color, nextColor, 'skill name immediately uses this trigger rarity');
        assert.equal(phase.quantityColor, oldColor, 'old quantity keeps its preceding color during the next trigger hold');
        const shaking = result.phases.find(entry => entry.at >= at && entry.shaking && entry.quantity === expected.old);
        assert.ok(shaking && Math.abs(shaking.at - at - 300) < 90, 'old quantity begins a 500ms shake after the notice hold');
        assert.equal(shaking.duration, '0.5s');
        assert.equal(shaking.quantityColor, oldColor);
        const changed = result.phases.find(entry => entry.at >= at && entry.changing && entry.quantity === expected.next);
        assert.ok(changed && Math.abs(changed.at - at - 800) < 90, 'new quantity appears only after all 300+500ms');
        assert.equal(changed.duration, '0.5s');
        assert.equal(changed.quantityColor, nextColor, 'new number and current rarity color change together at +800ms');
        assert.match(changed.quantityClasses, new RegExp(`\\bbuff-quality-${rarities[index]}\\b`));
        assert.ok(result.phases.filter(entry => entry.at >= at && entry.at < changed.at).every(entry => entry.quantity === expected.old && entry.quantityColor === oldColor), 'old value and old color remain unchanged until the quantity event');
        const settled = result.phases.find(entry => entry.at > changed.at && !entry.changing && entry.quantity === expected.next);
        assert.ok(settled && Math.abs(settled.at - at - 1300) < 90, 'new quantity settles only after its full 500ms');
      }
      assert.equal(result.finalQuantities[0], '×12！');
      assert.equal(result.finalQuantityColors[0], buffColors[rarities[1]], 'final color uses the last actual trigger, never maximum rarity');
      assert.equal(result.namesRestored, true, 'name text and original item-quality classes/color are restored');
    }

    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 540 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize(viewport);
      await page.goto('http://reveal.local');
      await page.evaluate(() => { LoginArt.setVisible(false); document.getElementById('login-screen').style.display = 'none'; });
      const initial = await start();
      assert.equal(initial.firstQuantity, '×2');
      assert.equal(initial.firstColor, neutralQuantity);
      assert.doesNotMatch(initial.firstClasses, /buff-quality-/);
      assert.equal(initial.staticQuantities[0].text, '×12！');
      assert.equal(initial.staticQuantities[0].color, buffColors[5], 'renderer is already final before animation starts');
      assert.equal(initial.initialState, 'running');
      assert.equal(initial.refunds, 0);
      assert.equal(initial.notices, 0);
      assert.equal(initial.multiplierMarks, 0);
      assert.equal(initial.button, '显示全部');
      await page.waitForFunction(() => revealProbe.completed === 1, null, { timeout: 18000 });
      const natural = await report();
      assertStable(natural, viewport);
      assertSkillSequence(natural, [2, 5]);
      assert.deepEqual(natural.arrivals.map(entry => entry.quality), [3, 1, 1, 2, 3, 4, 5, 1, 2, 3, 3]);
      for (let index = 1; index < natural.arrivals.length; index++) {
        const preceding = natural.arrivals[index - 1];
        const expected = index === 1 ? 3780 : preceding.quality >= 4 ? 1580 : preceding.quality === 3 ? 1180 : 210;
        assert.ok(Math.abs(natural.arrivals[index].at - preceding.at - expected) < 200,
          `next item follows its predecessor's completed rarity/skill presentation: ${JSON.stringify({ index, expected, arrivals: natural.arrivals })}`);
      }
      assert.equal(natural.played.filter(sound => sound.name === 'rewardRare').length, 4);
      assert.equal(natural.played.filter(sound => sound.name === 'rewardHigh').length, 2);
      assert.ok(natural.phases.some(phase => phase.revealState === 'ink' && phase.iconOpacity === 0), 'real rare ink begins with its item icon hidden');
      assert.equal(new Set(natural.played.map(sound => sound.group)).size, 1, 'one modal owns one audio group');
      assert.equal(natural.stopped.length, 2, 'only skill starts stop their preceding reveal tails');
      for (const [index, action] of natural.audioActions.entries()) {
        if (action.name === 'skillTrigger') assert.deepEqual(natural.audioActions[index - 1], { type: 'stop', group: action.group });
      }
      assert.equal(natural.namesRestored, true);
      assert.ok(natural.animations.includes('reward-skill-ink'), 'real ink pulse is active');
      assert.ok(natural.animations.includes('reward-burst-rare'), 'rare reward plays its imported twelve-frame burst');
      assert.ok(natural.animations.includes('reward-rare-icon'), 'rare icon has its own delayed entrance');
      assert.ok(natural.animations.includes('reward-burst-high'), 'high rarity plays its distinct twelve-frame burst');
      assert.ok(natural.animations.includes('reward-count-shake'), 'old number has a real dedicated shake');
      assert.ok(natural.animations.includes('reward-count-arrive'), 'new number has a real scale-and-settle animation');
      assert.equal(natural.animations.includes('reward-refund-reveal'), false);
      assert.equal(natural.finalQuantities.at(-1), '×12', 'extra reward remains final and does not acquire fake skills');
      assert.equal(natural.finalQuantities[1], '×1', 'refund-only quantity has no skill punctuation');
      assert.equal(natural.finalQuantities[2], '×1', 'ordinary quantity has no skill punctuation');
      assert.doesNotMatch(natural.finalQuantityClasses[1] + natural.finalQuantityClasses.at(-1), /buff-quality-/);
      assert.equal(natural.button, '收下');
      const firstLaterReveal = natural.states.find(states => states[1] !== 'pending' && states[0] !== 'final');
      assert.equal(firstLaterReveal[0], 'complete', 'next item starts only after every type-1 presentation completes');

      const reverseInitial = await start(true, 'reverse');
      assert.equal(reverseInitial.staticQuantities[0].text, '×12！');
      assert.equal(reverseInitial.staticQuantities[0].color, buffColors[2], 'static result also keeps the last lower-quality trigger');
      await page.waitForFunction(() => revealProbe.completed === 1, null, { timeout: 5000 });
      const reverse = await report();
      assertStable(reverse, viewport);
      assertSkillSequence(reverse, [5, 2]);

      const longInitial = await start(false, 'long');
      assert.equal(longInitial.targetClipped, true, 'long-name trigger starts outside the short body');
      await page.waitForFunction(() => revealProbe.overlay.querySelectorAll('.reward-item')[8].classList.contains('is-skill-active'), null, { timeout: 18000 });
      await page.waitForTimeout(850);
      const longRunning = await report();
      // An artificial five-digit multiplier checks exact fit; normal triggers above still require at least 11px.
      assertStable(longRunning, viewport, { extremeMultiplier: true });
      const longActive = longRunning.snapshots.flatMap(snapshot => snapshot.items).find(item => item.active);
      assert.ok(longActive && longActive.nameFits, 'extreme multiplier remains local and single-line');
      assert.equal(longActive.fullLabel, '斧技·12345倍！！', 'extreme multiplier is never rounded or truncated');
      assert.ok(longRunning.snapshots.some(snapshot => snapshot.bodyScrollTop > 0), 'the clipped item is brought into view by body scrolling');
      await page.evaluate(() => revealProbe.controller.finish());
      assert.equal((await report()).namesRestored, true);

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
        await page.waitForFunction(() => revealProbe.played.length > 0);
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
        assert.equal(result.finalQuantities[0], '×12！');
        if (result.connected) assert.equal(result.finalQuantityColors[0], buffColors[5]);
        assert.match(result.finalQuantityClasses[0], /\bbuff-quality-5\b/);
        assert.equal(result.namesRestored, true);
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
      assert.equal(reduced.initialState, 'running');
      await page.waitForFunction(() => revealProbe.overlay.querySelector('.reward-item').classList.contains('is-skill-active'), null, { timeout: 5000 });
      const reducedRunning = await report();
      assert.ok(reducedRunning.states.some(states => states.slice(1).every(state => state === 'pending')), 'reduced motion still presents one result at a time');
      assert.ok(reducedRunning.played.some(sound => sound.name === 'skillTrigger'), 'reduced motion retains skill information and audio');
      assert.equal(reducedRunning.animations.length, 0, 'reduced motion removes reward movement and scaling');
      await page.evaluate(() => revealProbe.controller.finish());
      const staticResult = await report();
      assert.equal(staticResult.completed, 1);
      assert.equal(staticResult.finalQuantities[0], '×12！');
      assert.equal(staticResult.finalQuantityColors[0], buffColors[5]);
      assert.equal(staticResult.namesRestored, true);
      assertStable(staticResult, viewport);
      checks.push({ viewport, realQuantityStages: natural.quantities, mixedRarities: ['2→5', '5→2'], originalNameHold: 300, checkedAt299: true,
        skillCues: 2, triggerDuration: 1300, animations: natural.animations,
        stableSnapshots: natural.snapshots.length, cancellationModes: modes, reducedMotion: 'sequential information without movement' });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(JSON.stringify({ ok: true, viewports: checks.length, pageErrors: errors, writes: 0, checks }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
