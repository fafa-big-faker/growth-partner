/* Local-only reward geometry and bitmap checks. No screenshots or account operations. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const root = path.resolve(__dirname, '..');
  const app = await fs.readFile(path.join(root, 'app.js'), 'utf8');
  const tenMethod = app.slice(app.indexOf('  async doChopTen('), app.indexOf('  // 删除邮件'));
  const tenRenderStart = tenMethod.indexOf('    // 显示结果弹窗');
  const tenRender = tenMethod.slice(tenRenderStart, tenMethod.indexOf('\n    PlayerView.renderCultivate();', tenRenderStart));
  assert.ok(tenRender.includes('UI.modal(rewards.renderResults(results)'), 'exercise the actual ten-chop rendering block');
  const page = await browser.newPage();
  const pageErrors = [];
  const results = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://v7.local') return route.abort();
      const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        const body = await fs.readFile(file);
        const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch { await route.fulfill({ status: 404, body: '' }); }
    });

    async function inspectRewards() {
      await page.waitForFunction(() => [...document.querySelectorAll('.reward-art img')].every(image => image.complete && image.naturalWidth > 0));
      return page.evaluate(() => {
        const modal = document.querySelector('.modal:last-child');
        const body = modal.querySelector('.modal-body');
        const header = modal.querySelector('.modal-header');
        const footer = modal.querySelector('.modal-footer');
        const button = footer?.querySelector('button');
        const rect = element => {
          const box = element.getBoundingClientRect();
          return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
        };
        const buttonRect = button ? rect(button) : null;
        const buttonPoint = buttonRect ? { x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + buttonRect.height / 2 } : null;
        let buttonTextOffset = null;
        if (button) {
          const range = document.createRange();
          range.selectNodeContents(button);
          const textRect = range.getBoundingClientRect();
          buttonTextOffset = { x: textRect.x + textRect.width / 2 - buttonPoint.x,
            y: textRect.y + textRect.height / 2 - buttonPoint.y };
        }
        const items = [...document.querySelectorAll('.reward-item')].map(item => {
          const box = item.getBoundingClientRect();
          const name = item.querySelector('.reward-item-name');
          const count = item.querySelector('.reward-item-quantity');
          return { id: item.dataset.rewardItem, name: name.textContent, count: count.textContent,
            x: box.x, y: box.y, right: box.right, width: box.width,
            nameSize: parseFloat(getComputedStyle(name).fontSize),
            nameFits: name.scrollWidth <= name.clientWidth + 1,
            countFits: count.scrollWidth <= count.clientWidth + 1,
            framed: getComputedStyle(item).backgroundColor !== 'rgba(0, 0, 0, 0)' || getComputedStyle(item).boxShadow !== 'none',
          };
        });
        const regular = [...document.querySelectorAll('.reward-results-regular > .reward-item')].map(item => {
          const box = item.getBoundingClientRect(); return { id: item.dataset.rewardItem, x: box.x, y: box.y };
        });
        const extra = document.querySelector('.reward-results-extra-items');
        const extraRows = [];
        if (extra) {
          for (const item of extra.children) {
            const box = item.getBoundingClientRect();
            let row = extraRows.find(entry => Math.abs(entry.y - box.y) < 2);
            if (!row) { row = { y: box.y, left: box.x, right: box.right, count: 0 }; extraRows.push(row); }
            row.left = Math.min(row.left, box.x); row.right = Math.max(row.right, box.right); row.count++;
          }
        }
        const extraBox = extra?.getBoundingClientRect();
        return { items, regular, extraRows, extraCenter: extraBox ? extraBox.x + extraBox.width / 2 : null,
          modalFits: modal.scrollWidth <= modal.clientWidth + 1,
          modal: rect(modal), header: rect(header), body: rect(body), footer: footer ? rect(footer) : null,
          bodyScrollTop: body.scrollTop, bodyScrollHeight: body.scrollHeight, bodyHeight: body.clientHeight,
          bodyOverflow: getComputedStyle(body).overflowY, modalOverflow: getComputedStyle(modal).overflowY,
          buttonPoint, buttonRect, buttonTextOffset, buttonLabel: button?.textContent.trim() || '',
          buttonAccessible: buttonPoint ? button.contains(document.elementFromPoint(buttonPoint.x, buttonPoint.y)) : false,
          artWidth: document.querySelector('.reward-item--large .reward-art')?.getBoundingClientRect().width || null,
          pageFits: document.documentElement.scrollWidth <= window.innerWidth + 1 };
      });
    }

    function assertFits(geometry) {
      assert.ok(geometry.modalFits && geometry.pageFits, 'modal and page never overflow horizontally');
      for (const item of geometry.items) {
        assert.ok(item.nameFits && item.countFits, `${item.id} name and quantity fit`);
        assert.ok(item.nameSize >= 12, 'reward names remain readable on small screens');
        assert.equal(item.framed, false, 'ink backdrops are not square cards or glowing frames');
      }
      for (const row of geometry.extraRows) {
        assert.ok(Math.abs((row.left + row.right) / 2 - geometry.extraCenter) < 2, 'each extra row centers independently');
      }
    }

    function assertFooter(geometry, viewport) {
      assert.ok(geometry.footer, 'confirmation lives outside the body scroll container');
      assert.equal(geometry.modalOverflow, 'hidden');
      assert.equal(geometry.bodyOverflow, 'auto');
      assert.ok(geometry.modal.y >= 11 && geometry.modal.bottom <= viewport.height - 11);
      assert.ok(geometry.footer.y >= geometry.body.bottom - 1, 'footer never overlaps the scroll body');
      assert.ok(geometry.footer.bottom <= viewport.height - 11);
      assert.equal(geometry.buttonAccessible, true, 'confirmation is clickable before any scrolling');
      assert.ok(geometry.buttonRect.height >= 44, 'reward confirmation retains its 44px click target');
      assert.ok(Math.abs(geometry.buttonTextOffset.x) <= 1,
        `${geometry.buttonLabel} text is horizontally centered: ${JSON.stringify(geometry.buttonTextOffset)}`);
      assert.ok(Math.abs(geometry.buttonTextOffset.y) <= 1,
        `${geometry.buttonLabel} text is vertically centered: ${JSON.stringify(geometry.buttonTextOffset)}`);
    }

    async function closeFromCurrentPosition(geometry) {
      await page.mouse.click(geometry.buttonPoint.x, geometry.buttonPoint.y);
      assert.equal(await page.locator('.modal-overlay').count(), 0, 'direct pointer click closes without auto-scrolling');
    }

    for (const viewport of [{ width: 360, height: 540 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://v7.local');
      await page.evaluate(tenRenderSource => {
        LoginArt.setVisible(false);
        document.getElementById('login-screen').style.display = 'none';
        AudioManager.playEffect = async () => {};
        PlayerView.renderCultivate = () => {};
        window.v7ShowResults = new Function('results', tenRenderSource);
        ITEMS['v7-long'] = { name: '这是用于检查长名称换行的限定仙斧', type: 3, quality: 5,
          icon: '', iconImage: 'assets/runtime/v4/items/55001.webp', desc: '本地模拟道具。' };
        window.v7Renderer = RewardPresentation.createRenderer({ items: ITEMS, quality: QUALITY, renderItemIcon, escapeHtml });
        window.v7Regular = Array.from({ length: 10 }, (_, index) => ({ itemId: index === 0 ? 'v7-long' : '40001',
          quantity: index === 0 ? 123456789012 : index + 1, quality: index % 5 + 1,
          ...(index === 1 ? { buffText: '掉落量×2倍！', refundChopping: 2 } : {}) }));
      }, tenRender);

      const images = await page.evaluate(async () => Promise.all(RewardPresentation.getAssetUrls().map(async url => {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0, transparent = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] > 10) visible++;
          if (pixels[index] === 0) transparent++;
        }
        return { url, width: canvas.width, height: canvas.height, visible, transparent };
      })));
      assert.equal(images.length, 5);
      assert.ok(images.every(image => image.visible > 10 && image.transparent > 10));

      await page.evaluate(() => PlayerView._showRewardModal({ kind: 'coin', quantity: 12, quality: 1 }));
      const compact = await inspectRewards(); assertFits(compact); assertFooter(compact, viewport);
      assert.ok(compact.modal.width <= 320 && compact.modal.height <= 340, 'ordinary single result is a compact dialog');
      assert.ok(compact.artWidth <= 104, 'single icon cannot return to oversized 168px artwork');
      await closeFromCurrentPosition(compact);

      await page.evaluate(() => PlayerView._showRewardModal({ itemId: 'v7-long', quantity: 3,
        buffText: '掉落量×2倍！', refundChopping: 2,
        extraDrop: { kind: 'coin', quantity: 100, quality: 2 } }));
      const single = await inspectRewards(); assertFits(single); assertFooter(single, viewport);
      assert.equal(single.items.length, 2);
      assert.match(await page.locator('.reward-modal-v7').textContent(), /返还 2 次砍树/);
      await closeFromCurrentPosition(single);

      await page.evaluate(() => {
        const extra = { kind: 'coin', quantity: 1000, quality: 5, isExtra: true };
        v7Regular[2].extraDrop = extra;
        v7ShowResults([...v7Regular.slice(0, 3), extra, ...v7Regular.slice(3)]);
      });
      const ten = await inspectRewards(); assertFits(ten); assertFooter(ten, viewport);
      assert.equal(ten.items.length, 11); assert.equal(ten.regular.length, 10);
      for (let row = 0; row < 2; row++) assert.ok(ten.regular.slice(row * 5, row * 5 + 5).every(item => Math.abs(item.y - ten.regular[row * 5].y) < 2));
      assert.ok(ten.regular[5].y > ten.regular[0].y);
      assert.deepEqual(ten.regular.map(item => item.id), ['v7-long', ...Array(9).fill('40001')]);
      assert.equal(ten.extraRows[0].count, 1);
      assert.match(await page.locator('.reward-results').textContent(), /返还 2 次砍树/);

      await page.evaluate(() => {
        document.getElementById('modal-container').replaceChildren();
        v7ShowResults([...v7Regular,
          ...Array.from({ length: 7 }, (_, index) => ({ itemId: '40001', quantity: index + 1, quality: index % 5 + 1, isExtra: true }))]);
      });
      const multiple = await inspectRewards(); assertFits(multiple); assertFooter(multiple, viewport);
      assert.equal(multiple.items.length, 17);
      assert.ok(multiple.extraRows.length >= 2, 'multiple extras wrap into centered rows');

      await page.evaluate(() => {
        document.getElementById('modal-container').replaceChildren();
        v7ShowResults([...v7Regular.map((reward, index) => ({ ...reward,
          buffText: `掉落量×${index + 2}倍！每次砍树时抽到对应品质奖励后触发。`, refundChopping: index + 1,
        })), { kind: 'coin', quantity: 1000, quality: 5, isExtra: true }]);
      });
      const allBuffs = await inspectRewards(); assertFits(allBuffs); assertFooter(allBuffs, viewport);
      assert.equal(allBuffs.bodyScrollTop, 0);
      assert.equal(await page.locator('.reward-item-buff').count(), 10, 'all real buff descriptions are retained');
      assert.equal(await page.locator('.reward-item-refund').count(), 10, 'all per-reward refunds are retained');
      if (viewport.height <= 640) assert.ok(allBuffs.bodyScrollHeight > allBuffs.bodyHeight, 'short screens scroll only the reward contents');
      await page.evaluate(() => { const body = document.querySelector('.reward-dialog .modal-body'); body.scrollTop = body.scrollHeight; });
      const scrolled = await inspectRewards(); assertFooter(scrolled, viewport);
      assert.deepEqual(scrolled.header, allBuffs.header, 'header position remains stable while reward body scrolls');
      assert.deepEqual(scrolled.footer, allBuffs.footer, 'footer position remains stable while reward body scrolls');
      await page.evaluate(() => { document.querySelector('.reward-dialog .modal-body').scrollTop = 0; });
      await closeFromCurrentPosition(allBuffs);

      const details = await page.evaluate(() => {
        document.getElementById('modal-container').replaceChildren();
        PlayerView.renderInventory = () => {};
        Game._getItemQty = () => 99;
        PlayerView.showItemDetail('v7-long');
        const name = document.querySelector('.item-detail-name');
        return { text: name.textContent, classes: name.className, color: getComputedStyle(name).color,
          fits: name.scrollWidth <= name.clientWidth + 1 };
      });
      assert.match(details.classes, /quality-item-name quality-5/);
      assert.equal(details.color, 'rgb(131, 93, 9)'); assert.equal(details.fits, true);
      results.push({ viewport, images: images.length, singleItems: single.items.length, tenRows: 2,
        singleSize: compact.modal, singleArt: compact.artWidth,
        singleButtonTextOffset: compact.buttonTextOffset, tenButtonTextOffset: ten.buttonTextOffset,
        multipleExtraRows: multiple.extraRows.length, allBuffsFooterVisible: allBuffs.buttonAccessible, details });
    }
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ ok: true, viewports: results.length, pageErrors, results }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
