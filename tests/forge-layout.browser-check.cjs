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
  const errors = [], writes = [];
  const checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.method()); return route.abort(); }
      const url = new URL(request.url());
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
          const node = document.querySelector(selector);
          if (!node) return null;
          const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
          return { x, y, width, height, right, bottom };
        };
        const rendered = selector => {
          const element = document.querySelector(selector);
          return !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && Number(getComputedStyle(element).opacity) > 0;
        };
        const reachable = selector => {
          const element = document.querySelector(selector);
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return box.y >= 0 && box.bottom <= innerHeight && (element.disabled || hit === element || element.contains(hit));
        };
        const modal = document.querySelector('.forge-modal');
        const content = document.querySelector('.forge-modal-content');
        const action = document.getElementById('forge-result-action');
        const detail = document.getElementById('forge-result-detail');
        const name = document.getElementById('forge-reveal-name');
        const frame = document.querySelector('.forge-reveal-frame');
        const art = document.getElementById('forge-reveal-art');
        const background = document.querySelector('.forge-scene-background');
        const equip = action.querySelector('button');
        const summary = document.getElementById('forge-result-summary');
        const button = rect('#forge-ok');
        return {
          button, frame: rect('.forge-reveal-frame'), action: rect('#forge-result-action'),
          icon: rect('.forge-reveal-art .forge-reveal-icon'), name: rect('#forge-reveal-name'), summary: rect('#forge-result-summary'),
          title: modal.querySelector('.modal-title')?.textContent.trim(), titleCount: modal.querySelectorAll('.modal-title').length,
          duplicateHeadings: modal.querySelectorAll('.forge-heading').length,
          legacyCopy: /锻造仙斧|器灵待启|准备锻造|\?/.test(modal.textContent),
          artLayout: { x: art.offsetLeft, y: art.offsetTop, width: art.offsetWidth, height: art.offsetHeight, position: getComputedStyle(art).position, frameWidth: frame.clientWidth, frameHeight: frame.clientHeight },
          shaking: art.classList.contains('is-shaking'), actionPosition: getComputedStyle(action).position,
          equip: equip ? { ...rect('#forge-result-action button'), disabled: equip.disabled, background: getComputedStyle(equip).backgroundImage, reachable: reachable('#forge-result-action button') } : null,
          enabledActionCount: action.querySelectorAll('button:not(:disabled),a[href]').length,
          actionFits: action.scrollWidth <= action.clientWidth + 1,
          summaryContent: summary.textContent.trim(), summaryFits: summary.scrollWidth <= summary.clientWidth + 1,
          scene: { src: background?.getAttribute('src'), decoded: !!background?.complete && background.naturalWidth > 0, fit: background ? getComputedStyle(background).objectFit : '' },
          modal: rect('.forge-modal'), content: rect('.forge-modal-content'),
          information: rect('.forge-reveal-information'), detail: rect('#forge-result-detail'),
          probability: rect('.forge-probability-details summary'), material: rect('.forge-material-cost'),
          actionContent: action.textContent.trim(),
          actionOutsideArt: !document.getElementById('forge-reveal-art').contains(action),
          buttonContentY: button.y - modal.getBoundingClientRect().y + modal.scrollTop,
          scrollTop: modal.scrollTop, contentScrollTop: content?.scrollTop || 0,
          modalFlex: getComputedStyle(modal).display === 'flex' && getComputedStyle(modal).flexDirection === 'column',
          contentScrolls: !!content && ['auto', 'scroll'].includes(getComputedStyle(content).overflowY),
          controlsOutsideContent: !!content && !content.contains(document.getElementById('forge-ok')),
          probabilitiesInsideContent: content.contains(document.querySelector('.forge-probability-details')),
          probabilityOpen: document.querySelector('.forge-probability-details').open,
          controlsReachable: reachable('#forge-ok') && reachable('.forge-probability-details summary'),
          controlsLocked: document.querySelector('.forge-modal-overlay').classList.contains('modal-locked'),
          controlHits: ['#forge-ok', '.forge-probability-details summary'].map(selector => {
            const box = document.querySelector(selector).getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return { selector, hit: hit?.tagName + '.' + hit?.className };
          }),
          overflow: document.documentElement.scrollWidth > innerWidth || modal.scrollWidth > modal.clientWidth + 1,
          nameFits: name.scrollHeight <= name.clientHeight + 1 && name.scrollWidth <= name.clientWidth + 1,
          detailBeforeButton: !!(detail.compareDocumentPosition(document.getElementById('forge-ok')) & Node.DOCUMENT_POSITION_FOLLOWING) && !!content?.contains(detail),
          progressVisible: rendered('.forge-reveal-progress'), runningVisible: rendered('.forge-reveal-running'),
          detailVisible: rendered('#forge-result-detail'),
          detailScrollable: ['auto', 'scroll'].includes(getComputedStyle(detail).overflowY) && detail.scrollHeight > detail.clientHeight + 1,
          detailScrollTop: detail.scrollTop,
          materialQuantity: Number(document.querySelector('.forge-material-cost b').textContent),
          lockedColour: document.querySelector('.forge-result-locked') ? getComputedStyle(document.querySelector('.forge-result-locked')).color : '',
        };
      });
    }

    async function settleModal() {
      const decodedSlip = await page.locator('.forge-modal').evaluate(async element => {
        await Promise.all([...element.querySelectorAll('img')].map(image => image.decode().catch(() => {})));
        const entrances = element.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity);
        await Promise.all(entrances.map(animation => animation.finished.catch(() => {})));
        const equip = element.querySelector('.forge-result-equip');
        if (!equip) return null;
        const url = getComputedStyle(equip).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
        if (!url) return false;
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => {});
        return image.complete && image.naturalWidth === 288 && image.naturalHeight === 86;
      });
      if (decodedSlip !== null) assert.equal(decodedSlip, true, 'new equipment slip bitmap decodes at its original dimensions');
    }

    function assertStable(state, idle, viewport, label) {
      assert.equal(state.overflow, false, label + ': no horizontal overflow');
      assert.equal(state.title, '天工开物');
      assert.equal(state.titleCount, 1);
      assert.equal(state.duplicateHeadings, 0);
      assert.equal(state.legacyCopy, false, label + ': no repeated title or question-mark placeholder');
      assert.ok(state.modal.width <= Math.min(360, viewport.width - 24) + 1, label + ': compact shell fits the viewport');
      assert.ok(state.modal.height <= Math.min(540, viewport.height - 24) + 1, label + ': shell fits short screens');
      if (viewport.height >= 568) assert.ok(state.modal.height >= 500, label + ': normal mobile scene has useful height');
      assert.ok(Math.abs(state.modal.height - idle.modal.height) <= 1, label + ': session height remains fixed');
      assert.equal(state.detailBeforeButton, true, label + ': skill details precede controls in the scrollable content');
      assert.equal(state.controlsOutsideContent, true, label + ': controls stay outside the scrolling content');
      assert.equal(state.probabilitiesInsideContent, true, label + ': probability details belong to the content region');
      assert.ok(state.button.y >= 0 && state.button.bottom <= viewport.height && state.probability.y >= 0 && state.probability.bottom <= viewport.height,
        label + ': forge and probability controls remain onscreen');
      if (!state.controlsLocked) assert.equal(state.controlsReachable, true, label + ': unlocked controls remain unobstructed ' + JSON.stringify(state.controlHits));
      assert.ok(state.content.bottom <= state.material.y + 1, label + ': scrolling content cannot overlap materials');
      assert.ok(state.information.height <= (viewport.height <= 480 ? 60 : 126) + 1, label + ': information uses a compact natural height');
      assert.ok(Math.abs(state.buttonContentY - idle.buttonContentY) <= 1, label + ': result details must not shift repeated forge controls');
      assert.ok(Math.abs(state.button.y - idle.button.y) <= 1, label + ': modal anchor must not recenter after results');
      assert.ok(Math.abs(state.button.x + state.button.width / 2 - (state.modal.x + state.modal.width / 2)) <= 2, label + ': forge remains centered ' + JSON.stringify({ button: state.button, modal: state.modal }));
      assert.ok(state.button.height >= 44, label + ': forge keeps a touch-sized target');
      assert.equal(state.actionPosition, 'absolute', label + ': equipment action is a scene overlay');
      assert.equal(state.artLayout.position, 'absolute');
      assert.ok(Math.abs(state.artLayout.x) <= 1 && Math.abs(state.artLayout.y) <= 1);
      assert.ok(Math.abs(state.artLayout.width - state.artLayout.frameWidth) <= 1 && Math.abs(state.artLayout.height - state.artLayout.frameHeight) <= 1,
        label + ': axe art fills the whole scene without a reserved bottom row');
      assert.equal(state.actionOutsideArt, true);
      assert.ok(Math.abs(state.action.bottom - state.frame.bottom) <= 1, label + ': action anchors to scene bottom');
      assert.equal(state.actionFits, true, label + ': long equipment requirement fits');
      assert.equal(state.nameFits, true, label + ': long axe name is not clipped');
      assert.equal(state.summaryFits, true, label + ': quality and rating fit');
      assert.equal(state.scene.decoded, true, label + ': new scene bitmap decodes');
      assert.ok(state.scene.src.endsWith('stage.webp?v=forge-workshop-20260909'));
      assert.equal(state.scene.fit, 'contain', label + ': scene keeps original proportions');
      if (state.icon && !state.shaking) {
        assert.ok(Math.abs(state.icon.x + state.icon.width / 2 - (state.frame.x + state.frame.width / 2)) <= 2, label + ': axe horizontally centered');
        assert.ok(Math.abs(state.icon.y + state.icon.height / 2 - (state.frame.y + state.frame.height / 2)) <= 2, label + ': axe vertically centered in full scene');
      }
      if (state.equip) {
        assert.ok(state.equip.width >= 44 && state.equip.width <= 110 && state.equip.height >= 44, label + ': compact equip art retains a 44px target');
        assert.ok(state.equip.background.includes('equip-slip.webp?v=forge-workshop-20260909'));
        if (!state.probabilityOpen) assert.equal(state.equip.reachable, true);
      }
    }

    async function forgeAndWait(viewport, idle, label, fixture = {}) {
      await page.evaluate(values => Object.assign(forgeFixture, values), fixture);
      await page.locator('#forge-ok').click();
      await page.waitForFunction(() => typeof forgeFixture.completeForge === 'function');
      await settleModal();
      const running = await measure();
      assert.equal(running.actionContent, '', label + ': old equip action clears on repeat');
      assert.equal(running.progressVisible, true, label + ': progress reappears on repeat');
      assert.equal(running.runningVisible, true);
      assert.equal(running.detailVisible, false, label + ': old skill details are hidden while forging');
      assert.equal(running.detailScrollTop, 0, label + ': previous result scroll is reset');
      assertStable(running, idle, viewport, label + ' running');
      const calls = await page.evaluate(() => forgeFixture.calls);
      await page.evaluate(() => { document.getElementById('forge-ok').click(); document.getElementById('forge-ok').click(); });
      assert.equal(await page.evaluate(() => forgeFixture.calls), calls, label + ': repeat clicks cannot create additional forges');
      await page.evaluate(() => forgeFixture.completeForge());
      await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'result');
      await settleModal();
      const result = await measure();
      assert.equal(result.progressVisible, false, label + ': completed progress is hidden');
      assert.equal(result.runningVisible, false);
      assert.equal(result.detailVisible, true, label + ': result details replace the running area');
      assertStable(result, idle, viewport, label + ' result');
      return result;
    }

    async function checkResultScroll(viewport, idle) {
      const scroll = await page.evaluate(() => {
        const detail = document.getElementById('forge-result-detail');
        const content = document.querySelector('.forge-modal-content');
        content.scrollTop = content.scrollHeight;
        detail.scrollTop = detail.scrollHeight;
        return {
          detailScroll: detail.scrollTop, detailMax: detail.scrollHeight - detail.clientHeight,
          contentScroll: content.scrollTop,
        };
      });
      assert.ok(scroll.detailScroll > 0, 'long skill text can scroll inside the result area');
      assert.ok(Math.abs(scroll.detailScroll - scroll.detailMax) <= 1, 'all long text is reachable');
      const scrolled = await measure();
      assertStable(scrolled, idle, viewport, 'scrolled long result');
      assert.ok(scrolled.detail.bottom <= scrolled.material.y + 1, 'last skill/lore rows remain above the controls after scrolling');
      assert.equal(scroll.contentScroll, 0, 'only the long detail scrolls, without nested content scrolling');
      return { scroll, measured: scrolled };
    }

    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://forge.local');
      await page.evaluate(() => {
        LoginArt.setVisible(false);
        AudioManager.playEffect = async () => {};
        AudioManager.startLoop = async () => {};
        AudioManager.stopLoop = () => {};
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        UI.toast = () => {};
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
        window.forgeFixture = { low, high, cost: config.costCount, materialName: ITEMS[config.costItemId].name, next: 'low', skillMode: 'single', calls: 0, equipped: 0, fail: false };
        const originalRequirement = getMinRealmForAxeQuality;
        getMinRealmForAxeQuality = quality => quality === high.quality
          ? { ...originalRequirement(quality), name: '风起云涌的大卡拉米' } : originalRequirement(quality);
        Game.forge = async () => {
          forgeFixture.calls++;
          if (forgeFixture.fail) throw new Error('Expected local fixture failure');
          Game.inventory[0].quantity -= config.costCount;
          const item = { ...forgeFixture[forgeFixture.next] };
          if (forgeFixture.next === 'high') item.name = '尚未满足仙阶也不会挤走锻造按钮的测试仙斧';
          item.desc = forgeFixture.skillMode === 'double' ? '每一段认真尝试都值得留下自己的痕迹。'.repeat(5) : '认真尝试，自有回响。';
          const weapon = { id: 'fixture-' + forgeFixture.calls, itemId: item.id, skillMode: forgeFixture.skillMode };
          Game.weapons.push(weapon);
          return { item, itemId: item.id, quality: item.quality, weapon };
        };
        Game.equipAxe = async () => {
          forgeFixture.equipped++;
          await new Promise(resolve => { forgeFixture.completeEquip = resolve; });
          forgeFixture.completeEquip = null;
          return true;
        };
        // This fixture gates visual states only; the real 2–3s timeline has separate ForgeReveal tests.
        ForgeReveal.run = async (elements, outcome) => {
          const result = await outcome;
          elements.name.textContent = result.item.name;
          elements.art.innerHTML = renderItemIcon(result.itemId, result.item.icon, 'forge-reveal-icon');
          elements.art.classList.add('is-shaking');
          elements.status.textContent = '锻造中';
          ForgeReveal.setProgress(elements, 42);
          await new Promise(resolve => { forgeFixture.completeForge = resolve; });
          forgeFixture.completeForge = null;
          elements.art.classList.remove('is-shaking');
          elements.art.classList.add('is-revealed');
          ForgeReveal.setProgress(elements, 100);
          return result;
        };
        preloadAxeAnimation = async () => {};
        renderWeaponSkills = weapon => {
          if (weapon.skillMode === 'none') return '';
          if (weapon.skillMode === 'double') {
            return '<div class="weapon-skill" data-fixture-skill="first">' + '每次砍树获得指定品质奖励时，有固定概率使掉落数量翻倍。'.repeat(9) + '</div>'
              + '<div class="weapon-skill" data-fixture-skill="second">' + '每次砍树结束后，有固定概率返还本次砍树消耗次数。'.repeat(9) + '</div>';
          }
          return '<div class="weapon-skill">每次砍树都有机会获得额外奖励，固定词条不会在再次展示时重抽。</div>';
        };
        PlayerView.renderCultivate = async () => {};
        PlayerView.showForge();
      });
      await settleModal();
      const idle = await measure();
      assert.equal(idle.actionContent, '');
      assert.equal(idle.modalFlex, true);
      assert.equal(idle.contentScrolls, false);
      assert.equal(idle.enabledActionCount, 0);
      assert.equal(idle.progressVisible, false);
      assert.equal(idle.runningVisible, false);
      assert.equal(idle.detailVisible, false);
      assertStable(idle, idle, viewport, 'idle');

      const eligible = await forgeAndWait(viewport, idle, 'eligible');
      assert.equal(eligible.actionContent, '立即装备');
      assert.equal(await page.locator('.forge-result-locked, .forge-modal .axe-realm-requirement').count(), 0);
      await page.locator('#forge-result-action button').click();
      await page.waitForFunction(() => typeof forgeFixture.completeEquip === 'function');
      await page.evaluate(() => { document.querySelector('#forge-result-action button').click(); document.querySelector('#forge-result-action button').click(); });
      assert.equal(await page.evaluate(() => forgeFixture.equipped), 1, 'repeated equipment clicks remain locked');
      await page.evaluate(() => forgeFixture.completeEquip());
      await page.waitForFunction(() => document.querySelector('#forge-result-action button').textContent === '已装备');
      await settleModal();
      const equipped = await measure();
      assertStable(equipped, idle, viewport, 'equipped');
      assert.equal(equipped.equip.disabled, true);
      assert.equal(equipped.enabledActionCount, 0);
      assert.equal(await page.locator('.forge-result-equipped').count(), 1);
      assert.equal(await page.evaluate(() => forgeFixture.equipped), 1);
      assert.equal(await page.locator('.forge-modal').count(), 1);

      const locked = await forgeAndWait(viewport, idle, 'realm locked', { next: 'high' });
      assert.equal(locked.actionContent, await page.evaluate(() => getMinRealmForAxeQuality(forgeFixture.high.quality).name + '及以上可装备'));
      assert.equal(locked.lockedColour, 'rgb(157, 56, 54)');
      assert.equal(await page.locator('#forge-result-action button').count(), 0);
      assert.equal(locked.nameFits, true);

      await page.evaluate(() => { forgeFixture.fail = true; });
      await page.locator('#forge-ok').click();
      await page.waitForFunction(() => document.getElementById('forge-reveal-stage').dataset.state === 'idle' && !document.querySelector('.forge-modal-overlay').classList.contains('modal-locked'));
      await page.waitForFunction(() => document.querySelectorAll('#toast-container .toast').length === 0);
      const failed = await measure();
      assert.equal(failed.actionContent, '');
      assert.equal(await page.locator('#forge-ok').isDisabled(), false);
      assert.equal(await page.evaluate(() => forgeFixture.calls), 3);
      assert.equal(failed.progressVisible, false);
      assert.equal(failed.summaryContent, '');
      assert.equal(failed.detailVisible, false);
      assertStable(failed, idle, viewport, 'failed');

      const noSkill = await forgeAndWait(viewport, idle, 'no skill', { fail: false, next: 'low', skillMode: 'none' });
      assert.equal(await page.locator('#forge-result-summary .forge-result-no-skill').textContent(), '· 无斧技');
      assert.equal(await page.locator('#forge-result-detail .forge-result-no-skill').count(), 0);
      assert.equal(await page.locator('.forge-result-skill').count(), 0);
      assert.ok(noSkill.information.height < 64, 'no-skill outcome does not reserve a large empty detail slab');
      assert.ok((await page.locator('.forge-result-copy').textContent()).length > 0, 'no-skill axes still show their lore');

      const doubleSkill = await forgeAndWait(viewport, idle, 'two long skills', { skillMode: 'double' });
      assert.equal(await page.locator('#forge-result-detail .weapon-skill').count(), 2);
      assert.equal(doubleSkill.detailScrollable, true);
      const scrolled = await checkResultScroll(viewport, idle);

      await page.evaluate(() => { Game.inventory[0].quantity = forgeFixture.cost; });
      const exhausted = await forgeAndWait(viewport, idle, 'last material', { skillMode: 'none' });
      assert.equal(exhausted.materialQuantity, 0);
      assert.equal(await page.locator('#forge-ok').isDisabled(), true);
      assert.equal(await page.locator('#forge-ok').textContent(), await page.evaluate(() => forgeFixture.materialName + '不足'));
      assert.equal(await page.evaluate(() => forgeFixture.calls), 6);
      await page.evaluate(() => document.getElementById('forge-ok').click());
      assert.equal(await page.evaluate(() => forgeFixture.calls), 6, 'disabled forge cannot consume another material');
      await page.locator('.forge-probability-details summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.forge-probability-details').evaluate(element => element.open), true, 'probabilities remain available after materials run out');
      const probabilityOpen = await measure();
      assert.equal(probabilityOpen.controlsReachable, true, 'expanded probabilities do not obscure the forge button or probability toggle');
      assert.equal(probabilityOpen.overflow, false);
      assertStable(probabilityOpen, idle, viewport, 'probability expanded');
      assert.deepEqual(probabilityOpen.frame, exhausted.frame, 'probability expansion does not resize the scene');
      assert.ok(probabilityOpen.material.y >= probabilityOpen.content.bottom - 1, 'expanding probabilities cannot make content overlap the controls');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.forge-probability-details').evaluate(element => element.open), false);

      await page.locator('.forge-modal .modal-close').click();
      await page.evaluate(() => PlayerView.showForge());
      await settleModal();
      const emptyIdle = await measure();
      assertStable(emptyIdle, idle, viewport, 'reopened without materials');
      assert.equal(emptyIdle.materialQuantity, 0);
      assert.equal(await page.locator('#forge-ok').isDisabled(), true);
      checks.push({ viewport, idle, eligible, equipped, locked, failed, noSkill, doubleSkill, scrolled, exhausted, probabilityOpen, emptyIdle });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, [], 'no account/database write requests are attempted');
    const summary = checks.map(check => {
      const states = [check.eligible, check.equipped, check.locked, check.failed, check.noSkill, check.doubleSkill, check.scrolled.measured, check.exhausted, check.emptyIdle];
      return {
        viewport: check.viewport,
        shell: [check.idle.modal.width, check.idle.modal.height],
        sceneHeights: [check.idle.frame.height, check.noSkill.frame.height, check.doubleSkill.frame.height],
        actionHeight: check.idle.action.height,
        maxButtonShift: Math.max(...states.map(state => Math.abs(state.button.y - check.idle.button.y))),
        longSkillsScroll: check.scrolled.scroll,
        resultProgressHidden: states.filter(state => state.detailVisible).every(state => !state.progressVisible),
        probabilityExpandedControlsReachable: check.probabilityOpen.controlsReachable,
        exhaustedQuantity: check.exhausted.materialQuantity,
      };
    });
    console.log(JSON.stringify({ ok: true, viewports: checks.length, pageErrors: errors, writes: writes.length, checks: process.env.FORGE_LAYOUT_VERBOSE ? checks : summary }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
