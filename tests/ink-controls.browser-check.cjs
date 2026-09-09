/* Real app rendering with local-only assets and in-memory player fixtures. No screenshots. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const ASSET_BASE = 'assets/runtime/ink-controls/';
const VERSION = 'ink-controls-20260909';

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    document.querySelectorAll('.status-exp-fill').forEach(node => {
      for (const animation of node.getAnimations()) {
        if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
      }
    });
    requestAnimationFrame(resolve);
  })));
}

async function inspectExperience(page) {
  await settle(page);
  return page.evaluate(() => {
    const bar = document.querySelector('.status-exp-bar');
    const fill = document.querySelector('.status-exp-fill');
    const box = node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    const styles = node => {
      const style = getComputedStyle(node);
      const before = getComputedStyle(node, '::before');
      return { background: style.backgroundImage, borderImage: style.borderImageSource,
        beforeBackground: before.backgroundImage, beforeBorderImage: before.borderImageSource,
        progress: style.getPropertyValue('--exp-progress'), clip: style.clipPath };
    };
    const aria = bar.getAttribute('role') === 'progressbar' ? bar : bar.querySelector('[role="progressbar"]');
    return {
      state: { level: Game.state.level, exp: Game.state.exp, maximum: getExpForLevel(Game.state.level), realm: Game.state.realmLevel },
      bar: box(bar), fill: box(fill), barStyle: styles(bar), fillStyle: styles(fill),
      inlineFillWidth: fill.style.width,
      text: document.querySelector('.status-exp-text').textContent,
      aria: aria ? { min: aria.getAttribute('aria-valuemin'), max: aria.getAttribute('aria-valuemax'), value: aria.getAttribute('aria-valuenow'), text: aria.getAttribute('aria-valuetext'), label: aria.getAttribute('aria-label') } : null,
      sameFill: !window.inkControlFillRef || window.inkControlFillRef === fill,
    };
  });
}

function assertExperience(snapshot, percentage, reference = null) {
  const { bar, fill, barStyle, fillStyle } = snapshot;
  assert.ok(bar.width > 40 && bar.height > 0, 'experience track has a visible, nonzero frame');
  assert.ok(Math.abs(fill.width - bar.width) <= 1 && Math.abs(fill.height - bar.height) <= 1, 'the complete fill image retains the track dimensions at every percentage: ' + JSON.stringify(snapshot));
  assert.ok(Math.abs(fill.x - bar.x) <= 1 && Math.abs(fill.y - bar.y) <= 1, 'track and fill are aligned');
  assert.ok(!snapshot.inlineFillWidth || snapshot.inlineFillWidth === '100%', 'progress must not scale image width');
  assert.match(JSON.stringify(barStyle), /ink-controls\/exp-track\.webp\?v=ink-controls-20260909/);
  assert.match(JSON.stringify(fillStyle), /ink-controls\/exp-fill\.webp\?v=ink-controls-20260909/);
  const progress = parseFloat(fillStyle.progress || barStyle.progress);
  assert.ok(Number.isFinite(progress) && Math.abs(progress - percentage) < .02, 'CSS progress matches actual game experience: ' + JSON.stringify(snapshot));
  const inset = fillStyle.clip.match(/^inset\(\S+\s+([\d.]+)%/);
  assert.ok(inset, 'fill reveal uses a percentage inset clip: ' + fillStyle.clip);
  assert.ok(Math.abs(Number(inset[1]) - (100 - percentage)) < .02, 'clip reveals the correct percentage');
  assert.ok(snapshot.aria, 'the actual experience bar exposes progress semantics');
  const min = Number(snapshot.aria.min);
  const max = Number(snapshot.aria.max);
  const value = Number(snapshot.aria.value);
  assert.ok(max > min && Number.isFinite(value), 'progress accessibility values are finite');
  assert.ok(Math.abs((value - min) / (max - min) * 100 - percentage) < .02, 'accessible progress agrees with the visual reveal');
  assert.ok(snapshot.aria.label || snapshot.aria.text, 'progress has an accessible name or value description');
  assert.ok(!/NaN|Infinity|undefined/.test(snapshot.text), 'experience text remains valid at configuration limits');
  assert.equal(snapshot.text.replace(/\s/g, ''), `${snapshot.state.exp}/${snapshot.state.maximum}`, 'experience numbers use the same real game values as the artwork');
  if (reference) {
    for (const dimension of ['width', 'height']) assert.ok(Math.abs(bar[dimension] - reference.bar[dimension]) <= 1, `progress updates do not resize the track ${dimension}`);
  }
}

async function inspectPaper(page) {
  return page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
    };
    return {
      width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight, inventory: box('.mobile-inventory-columns'),
      dock: box('.bottom-nav'), navPaperHeight: parseFloat(getComputedStyle(document.querySelector('.bottom-nav'), '::before').height),
      bar: box('.status-exp-bar'), fill: box('.status-exp-fill'),
      enabled: MobileCultivation.isEnabled(), fullscreen: !!document.fullscreenElement,
    };
  });
}

function assertPaper(snapshot, baseline = null) {
  const short = snapshot.width < 720 && snapshot.height <= 609;
  const inventoryHeight = snapshot.width >= 720 ? 280 : short ? 180 : 224;
  assert.equal(snapshot.enabled, true);
  assert.ok(Math.abs(snapshot.inventory.height - inventoryHeight) <= 1, 'experience art changes do not stretch inventory paper');
  assert.ok(Math.abs(snapshot.dock.height - (short ? 112 : 124)) <= 1, 'dock operation height remains fixed');
  assert.ok(Math.abs(snapshot.navPaperHeight - (short ? 64 : 72)) <= 1, 'dock paper remains a shallow strip');
  assert.ok(Math.abs(snapshot.dock.bottom - snapshot.height) <= 1, 'dock follows the viewport bottom');
  assert.ok(snapshot.pageWidth <= snapshot.width && snapshot.pageHeight <= snapshot.height + 1, 'tall/fullscreen layout has no page overflow');
  if (baseline) {
    for (const key of ['inventory', 'dock', 'bar', 'fill']) {
      for (const dimension of ['width', 'height']) assert.ok(Math.abs(snapshot[key][dimension] - baseline[key][dimension]) <= 1, `${key} does not scale when only height changes`);
    }
  }
}

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const page = await browser.newPage();
  const errors = [];
  const unexpectedRequests = [];
  const results = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== 'http://ink.local') {
        if (request.method() !== 'GET' || /supabase\./.test(url.hostname)) unexpectedRequests.push(request.method() + ' ' + url.origin);
        return route.abort();
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = relative.endsWith('.css') ? 'text/css' : relative.endsWith('.js') ? 'application/javascript'
          : relative.endsWith('.html') ? 'text/html' : relative.endsWith('.webp') ? 'image/webp' : relative.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
        await route.fulfill({ status: 200, contentType, body });
      } catch {
        await route.fulfill({ status: 404, body: '' });
      }
    });

    for (const viewport of [{ width: 360, height: 540 }, { width: 390, height: 680 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://ink.local');
      const levels = await page.evaluate(() => {
        UI._updateMailBadge = () => {};
        UI._updateAchBadge = () => {};
        DB.updatePlayerState = async () => true;
        const entry = GAME_CONFIG.expTable.find(row => row.exp > 0 && row.exp % 4 === 0 && GAME_CONFIG.expTable.some(next => next.level === row.level + 1 && next.exp > 0));
        const last = [...GAME_CONFIG.expTable].sort((a, b) => b.level - a.level)[0];
        Game.state = { level: entry.level, realmLevel: 1, treeRealm: 1, treeLevel: 1, axeId: '51001', axeInstanceId: 'equipped', coin: 100, choppingCount: 50, exp: 0 };
        Game.inventory = Object.values(ITEMS).filter(item => item.type >= 1 && item.type <= 4).map(item => ({ itemId: item.id, quantity: 12 }));
        Game.weapons = [{ id: 'equipped', itemId: '51001', skillRolls: [] }];
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('player-dashboard').style.display = 'flex';
        Router.playerTab('cultivate', { force: true });
        return { base: entry.level, maximum: entry.exp, last: last.level, lastMaximum: last.exp, highestRealm: Math.max(...REALMS.map(realm => realm.level)) };
      });
      await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0), null, { timeout: 7000 });
      const assets = await page.evaluate(async ({ base, version }) => {
        const results = [];
        for (const file of ['return-arrow.webp', 'exp-track.webp', 'exp-fill.webp']) {
          const image = new Image();
          image.src = `${base}${file}?v=${version}`;
          try { await image.decode(); }
          catch (error) { throw new Error(`Cannot decode ${file}: ${error.message}`); }
          const canvas = document.createElement('canvas');
          canvas.width = 64; canvas.height = 32;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0, 64, 32);
          const pixels = context.getImageData(0, 0, 64, 32).data;
          let visible = 0;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 20) visible++;
          results.push({ file, width: image.naturalWidth, height: image.naturalHeight, visible });
        }
        return results;
      }, { base: ASSET_BASE, version: VERSION });
      assert.ok(assets.every(asset => asset.width > 0 && asset.height > 0 && asset.visible > 8), 'all three real assets decode with nontransparent pixels');

      const progressChecks = [];
      for (const pathName of ['render', 'update']) {
        let reference = null;
        for (const percentage of [0, 25, 50, 100]) {
          await page.evaluate(async ({ level, maximum, percentage, pathName }) => {
            Game.state.level = level;
            Game.state.exp = maximum * percentage / 100;
            if (pathName === 'render') {
              delete window.inkControlFillRef;
              await PlayerView.renderCultivate();
            } else {
              window.inkControlFillRef = document.querySelector('.status-exp-fill');
              UI._updateCultivateStats();
            }
          }, { level: levels.base, maximum: levels.maximum, percentage, pathName });
          const snapshot = await inspectExperience(page);
          assertExperience(snapshot, percentage, reference);
          assert.equal(snapshot.sameFill, true, 'lightweight stat updates keep the existing fill node');
          if (!reference) reference = snapshot;
          progressChecks.push({ path: pathName, percentage, frame: snapshot.bar, fill: snapshot.fill, clip: snapshot.fillStyle.clip, aria: snapshot.aria });
        }
      }

      const upgrade = await page.evaluate(async ({ level, maximum }) => {
        Game.state.level = level;
        Game.state.exp = maximum - 1;
        const upgraded = await Game._addExp(1);
        UI._updateCultivateStats();
        return { upgraded, level: Game.state.level, exp: Game.state.exp };
      }, { level: levels.base, maximum: levels.maximum });
      assert.deepEqual(upgrade, { upgraded: true, level: levels.base + 1, exp: 0 });
      assertExperience(await inspectExperience(page), 0);

      await page.evaluate(async ({ last, highestRealm }) => {
        Game.state.level = last;
        Game.state.realmLevel = highestRealm;
        Game.state.exp = getExpForLevel(last) / 2;
        await PlayerView.renderCultivate();
      }, levels);
      assertExperience(await inspectExperience(page), 50);
      assert.match(await page.locator('.cult-status').innerText(), /已满阶/, 'highest realm still renders its existing status');
      await page.evaluate(({ last }) => {
        Game.state.level = last + 1;
        Game.state.exp = 0;
        UI._updateCultivateStats();
      }, levels);
      assertExperience(await inspectExperience(page), 0);

      await page.evaluate(async ({ base, maximum }) => {
        Game.state.level = base; Game.state.realmLevel = 1; Game.state.exp = maximum / 2;
        await PlayerView.renderCultivate();
        PlayerView.renderTasks = () => document.getElementById('player-main').replaceChildren();
      }, levels);
      const originalCircle = await page.locator('#chop-btn').evaluate(node => ({ width: node.offsetWidth, height: node.offsetHeight, background: getComputedStyle(node).backgroundImage }));
      await page.locator('.bottom-nav [data-tab="tasks"]').click();
      const returnButton = page.locator('.bottom-nav [data-tab="cultivate"]');
      await returnButton.locator('img').evaluate(image => image.decode());
      const arrow = await returnButton.evaluate(node => {
        const image = node.querySelector('img');
        const rect = image.getBoundingClientRect();
        return { source: image.getAttribute('src'), fit: getComputedStyle(image).objectFit, width: rect.width, height: rect.height,
          buttonWidth: node.offsetWidth, buttonHeight: node.offsetHeight, background: getComputedStyle(node).backgroundImage,
          label: node.getAttribute('aria-label') };
      });
      assert.equal(arrow.source, `${ASSET_BASE}return-arrow.webp?v=${VERSION}`);
      assert.equal(arrow.fit, 'contain');
      assert.ok(arrow.width >= 56 && arrow.width <= 64 && arrow.height >= 56 && arrow.height <= 64, 'new arrow is approximately 60px');
      assert.equal(arrow.buttonWidth, originalCircle.width);
      assert.equal(arrow.buttonHeight, originalCircle.height);
      assert.equal(arrow.background, originalCircle.background);
      assert.equal(arrow.label, '返回修仙');
      await returnButton.click();
      assertExperience(await inspectExperience(page), 50);

      const paper = [];
      let fullscreen = null;
      if (viewport.height > 609) {
        const basePaper = await inspectPaper(page);
        assertPaper(basePaper);
        paper.push(basePaper);
        await page.setViewportSize({ width: viewport.width, height: 1200 });
        await settle(page);
        const tall = await inspectPaper(page);
        assertPaper(tall, basePaper);
        assertExperience(await inspectExperience(page), 50);
        paper.push(tall);
        fullscreen = await page.evaluate(async () => {
          if (!document.fullscreenEnabled) return { supported: false };
          try { await document.documentElement.requestFullscreen(); return { supported: true, entered: !!document.fullscreenElement }; }
          catch (error) { return { supported: false, reason: error.name }; }
        });
        if (fullscreen.supported) {
          assert.equal(fullscreen.entered, true);
          await settle(page);
          const full = await inspectPaper(page);
          assertPaper(full, tall);
          assertExperience(await inspectExperience(page), 50);
          paper.push(full);
          await page.evaluate(() => document.exitFullscreen());
          await settle(page);
          assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
          assertPaper(await inspectPaper(page), tall);
        }
        await page.setViewportSize(viewport);
        await settle(page);
        assertPaper(await inspectPaper(page), basePaper);
      }
      results.push({ viewport, levels, assets, progressChecks, upgrade, arrow, paper, fullscreen });
      await page.evaluate(() => Auth.logout());
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedRequests, [], 'no player/account/database requests escaped the local fixtures');
    console.log(JSON.stringify({ ok: true, pageErrors: errors, unexpectedRequests, results }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
