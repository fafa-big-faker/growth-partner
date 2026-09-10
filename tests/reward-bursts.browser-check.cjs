/* Real decoded atlas, clipped frame cells and cue timing; no screenshots or live account. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const errors = [], writes = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method()); return route.abort(); }
      if (url.origin !== 'http://bursts.local') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/reward-presentation.css">
        <style>body{margin:0;font:14px sans-serif}.modal-overlay{padding:12px}.modal{width:280px;margin:auto;box-sizing:border-box}</style>
        </head><body><div id="fixture"></div><script src="/reward-presentation.js"></script></body></html>` });
      const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, ''));
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        await route.fulfill({ body, contentType: { '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream' });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto('http://bursts.local');
    await page.evaluate(() => {
      window.makeBurstFixture = async quality => {
        window.burstProbe?.controller?.cancel();
        const reward = { itemId: 'fixture', quantity: 3, baseQuantity: 1, quality,
          buffTriggers: [{ type: 1, beforeQuantity: 1, afterQuantity: 3, multiplier: 3, buffQuality: 2 }] };
        const renderer = RewardPresentation.createRenderer({ items: { fixture: { name: '原本道具名' } } });
        document.getElementById('fixture').innerHTML = `<div class="modal-overlay"><div class="modal reward-dialog reward-dialog--single"><div class="modal-body">${renderer.renderItem(reward, { size: 'large' })}</div></div></div>`;
        const overlay = document.querySelector('.modal-overlay');
        await Promise.all([...overlay.querySelectorAll('img')].map(image => image.decode()));
        window.burstProbe = { overlay, item: overlay.querySelector('.reward-item'), played: [], stopped: [], completed: 0 };
        return true;
      };
      window.burstHidden = () => {
        const burst = burstProbe.item.querySelector('.reward-burst');
        if (!burst) return true;
        return [burst, burst.querySelector('.reward-burst-atlas')].filter(Boolean).some(node => {
          const style = getComputedStyle(node);
          return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
        });
      };
      window.playBurst = () => {
        const probe = burstProbe;
        probe.started = performance.now();
        probe.controller = RewardPresentation.playReveal(probe.overlay, {
          audio: { playEffect(name, options) { probe.played.push({ name, group: options.group, at: performance.now() }); return Promise.resolve(true); },
            stopEffects(group) { probe.stopped.push(group); } },
          onComplete() { probe.completed++; },
        });
      };
    });

    for (const quality of [3, 4, 5]) {
      await page.evaluate(quality => makeBurstFixture(quality), quality);
      const frames = await page.evaluate(async quality => {
        const { item } = burstProbe;
        const burst = item.querySelector('.reward-burst'), atlas = item.querySelector('.reward-burst-atlas');
        const baseline = item.getBoundingClientRect().toJSON();
        const beforeHidden = burstHidden();
        item.classList.add('is-reward-ink');
        const animation = atlas.getAnimations()[0];
        if (!animation) throw new Error('No imported burst animation');
        animation.pause();
        const duration = animation.effect.getTiming().duration;
        const keyframes = animation.effect.getKeyframes();
        const samples = [];
        for (let index = 0; index < keyframes.length; index++) {
          const frame = keyframes[index], next = keyframes[index + 1];
          animation.currentTime = duration * (next ? (frame.computedOffset + next.computedOffset) / 2 : frame.computedOffset);
          await new Promise(requestAnimationFrame);
          const style = getComputedStyle(atlas), matrix = new DOMMatrix(style.transform);
          samples.push({ column: -matrix.m41 / (parseFloat(style.width) / 4), row: -matrix.m42 / (parseFloat(style.height) / 3) });
        }
        item.classList.add('is-reward-icon');
        const icon = item.querySelector('.reward-art-icon');
        const iconAnimation = icon.getAnimations()[0];
        const iconFrames = iconAnimation.effect.getKeyframes();
        const peak = iconFrames.reduce((best, frame) => {
          const scale = new DOMMatrix(frame.transform).a;
          return scale > best.scale ? { scale, at: frame.computedOffset * iconAnimation.effect.getTiming().duration } : best;
        }, { scale: 0, at: 0 });
        const iconEvent = RewardPresentation.getRevealPlan([{ quality, quantity: 1, baseQuantity: 1, triggers: [] }]).events.find(event => event.type === 'icon');
        const result = { quality, source: atlas.getAttribute('src'), natural: [atlas.naturalWidth, atlas.naturalHeight],
          animation: animation.animationName, duration, beforeHidden, samples,
          peakScale: peak.scale, peakAt: iconEvent.at + peak.at,
          clip: [getComputedStyle(burst).overflowX, getComputedStyle(burst).overflowY],
          filter: getComputedStyle(burst).filter + ' ' + getComputedStyle(atlas).filter,
          layoutStable: Math.abs(item.getBoundingClientRect().height - baseline.height) < 1 && Math.abs(item.getBoundingClientRect().width - baseline.width) < 1 };
        item.classList.remove('is-reward-ink', 'is-reward-icon');
        result.afterHidden = burstHidden();
        result.animationsAfter = atlas.getAnimations().length;
        return result;
      }, quality);
      assert.deepEqual(frames.natural, [1024, 768], 'the actual compressed twelve-frame sheet decoded');
      assert.equal(frames.animation, quality === 3 ? 'reward-burst-rare' : 'reward-burst-high');
      assert.equal(frames.duration, quality === 3 ? 880 : 1280);
      const cells = [...new Set(frames.samples.map(sample => {
        assert.ok(Math.abs(sample.column - Math.round(sample.column)) < 0.001 && Math.abs(sample.row - Math.round(sample.row)) < 0.001,
          'step playback never interpolates across adjacent cells');
        return `${Math.round(sample.column)},${Math.round(sample.row)}`;
      }))];
      assert.deepEqual(cells, Array.from({ length: 12 }, (_, index) => `${index % 4},${Math.floor(index / 4)}`), 'all twelve real browser frame positions play in order');
      assert.deepEqual(frames.clip, ['hidden', 'hidden'], 'one atlas cell is clipped on both axes');
      assert.ok(frames.peakScale > 1, 'icon arrival has a distinct overshoot');
      assert.ok(Math.abs(frames.peakAt - (quality === 3 ? 400 : 430)) <= 25, 'icon climax aligns with the measured enhanced sound accent');
      assert.equal(frames.layoutStable, true);
      assert.equal(frames.beforeHidden, true);
      assert.equal(frames.afterHidden, true);
      assert.equal(frames.animationsAfter, 0, 'settled states retain no atlas animation');
      checks.push(frames);
    }
    assert.notEqual(checks[1].filter, checks[2].filter, 'god and immortal items tint the shared atlas independently');

    const bounds = JSON.parse(await fs.readFile(path.join(root, 'assets/runtime/reward-bursts/manifest.json'), 'utf8')).assets;
    for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      for (const ten of [false, true]) {
        const clipping = await page.evaluate(({ ten, bounds }) => {
          const renderer = RewardPresentation.createRenderer({ items: { fixture: { name: '测试道具' } } });
          const reward = { itemId: 'fixture', quantity: 1, quality: 5 };
          document.getElementById('fixture').innerHTML = `<div class="modal-overlay"><div class="modal reward-dialog reward-dialog--${ten ? 'ten' : 'single'}" style="width:min(480px,calc(100vw - 24px))"><div class="modal-header">获得物品</div><div class="modal-body">${ten ? renderer.renderResults(Array.from({ length: 10 }, () => reward)) : renderer.renderItem(reward, { size: 'large' })}</div><div class="modal-footer"><button class="btn">收下</button></div></div></div>`;
          const modal = document.querySelector('.modal'), body = modal.querySelector('.modal-body');
          const items = [...modal.querySelectorAll('.reward-item')];
          const limits = [body.getBoundingClientRect(), modal.getBoundingClientRect()];
          const violations = [];
          for (const index of ten ? [0, 4, 5, 9] : [0]) {
            const burst = items[index].querySelector('.reward-burst').getBoundingClientRect();
            for (const frame of bounds.high.frames) {
              const [left, top, right, bottom] = frame.alpha_bounds;
              const paint = { left: burst.left + left / 256 * burst.width, top: burst.top + top / 256 * burst.height,
                right: burst.left + right / 256 * burst.width, bottom: burst.top + bottom / 256 * burst.height };
              if (limits.some(limit => paint.left < limit.left - 1 || paint.right > limit.right + 1 || paint.top < limit.top - 1 || paint.bottom > limit.bottom + 1)) violations.push({ index, frame: frame.index, paint });
            }
          }
          return violations;
        }, { ten, bounds });
        assert.deepEqual(clipping, [], `visible ink stays inside all ancestor clipping boundaries: ${viewport.width}, ten=${ten}`);
      }
    }

    for (const mode of ['natural', 'finish', 'cancel', 'removed', 'reduced']) {
      await page.emulateMedia({ reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
      await page.evaluate(() => makeBurstFixture(4));
      await page.evaluate(() => playBurst());
      await page.waitForFunction(() => burstProbe.played.length > 0);
      if (mode === 'natural' || mode === 'reduced') {
        const initial = await page.evaluate(() => ({ hidden: burstHidden(), iconOpacity: +getComputedStyle(burstProbe.item.querySelector('.reward-art-icon')).opacity }));
        assert.equal(initial.hidden, mode === 'reduced', 'only reduced motion suppresses the frame layer during arrival');
        assert.equal(initial.iconOpacity, 0, 'item waits for its separate icon entrance');
        await page.waitForFunction(() => burstProbe.item.dataset.revealState === 'settled', null, { timeout: 3000 });
        assert.equal(await page.evaluate(() => burstHidden()), true, 'burst vanishes when arrival settles, before the skill');
        await page.waitForFunction(() => burstProbe.item.classList.contains('is-skill-active'));
        const skill = await page.evaluate(() => ({ label: burstProbe.item.querySelector('.reward-item-name').textContent,
          sounds: burstProbe.played.map(sound => ({ name: sound.name, elapsed: sound.at - burstProbe.played[0].at })),
          hidden: burstHidden(), atlasAnimations: burstProbe.item.querySelector('.reward-burst-atlas').getAnimations().length }));
        assert.match(skill.label, /3倍！！$/);
        assert.deepEqual(skill.sounds.map(sound => sound.name), ['rewardHigh', 'skillTrigger']);
        assert.ok(Math.abs(skill.sounds[1].elapsed - 1580) < 160, 'full arrival and 300ms original-name hold precede skill');
        assert.equal(skill.hidden, true);
        assert.equal(skill.atlasAnimations, 0);
        await page.evaluate(() => burstProbe.controller.finish());
      } else {
        await page.evaluate(mode => {
          if (mode === 'removed') burstProbe.overlay.remove();
          else burstProbe.controller[mode]();
        }, mode);
      }
      await page.waitForTimeout(320);
      const final = await page.evaluate(() => ({ hidden: burstHidden(),
        state: burstProbe.overlay.dataset.rewardRevealState,
        quantity: burstProbe.item.querySelector('.reward-item-quantity-value').textContent,
        name: burstProbe.item.querySelector('.reward-item-name').textContent,
        sounds: burstProbe.played.length, stopped: burstProbe.stopped,
        group: burstProbe.played[0].group,
        active: burstProbe.item.matches('.is-reward-ink, .is-reward-icon') }));
      assert.equal(final.hidden, true);
      assert.equal(final.active, false);
      assert.equal(final.quantity, '×3！');
      assert.equal(final.name, '原本道具名');
      assert.equal(final.state, ['cancel', 'removed'].includes(mode) ? 'cancelled' : 'complete');
      assert.ok(final.stopped.includes(final.group), 'owned enhanced sound is stopped with the presentation');
      assert.equal(final.sounds, ['natural', 'reduced'].includes(mode) ? 2 : 1, 'no late sound leaks after finalization');
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    console.log(JSON.stringify({ ok: true, checks, modes: ['natural', 'finish', 'cancel', 'removed', 'reduced'], pageErrors: errors, writes: 0 }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
