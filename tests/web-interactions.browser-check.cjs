/* Real local app, isolated browser data, no screenshots or account/database requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..');
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage();
  const errors = [], accountRequests = [], missingSources = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method()) || /supabase\./.test(url.hostname)) {
        accountRequests.push(`${request.method()} ${url.origin}`);
        return route.abort();
      }
      if (url.origin !== 'http://web-interactions.local') return route.abort();
      const file = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html');
      if (!file.startsWith(root + path.sep)) return route.abort();
      try {
        await route.fulfill({ status: 200, body: await fs.readFile(file),
          contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
            '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream' });
      } catch {
        if (/\.(js|css)$/.test(file)) missingSources.push(path.relative(root, file));
        await route.fulfill({ status: 404, body: '' });
      }
    });
    await page.addInitScript(() => {
      const original = Event.prototype.preventDefault;
      window.interactionPrevented = [];
      Event.prototype.preventDefault = function () {
        window.interactionPrevented.push(this.type);
        return original.call(this);
      };
    });
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('http://web-interactions.local');
      const result = await page.evaluate(() => {
        if (!window.WebInteractions || typeof PlayerView === 'undefined') throw new Error('Full app runtime did not load');
        const modal = document.createElement('section');
        modal.id = 'interaction-fixture';
        modal.style.cssText = 'position:fixed;inset:12px auto auto 12px;width:280px;padding:12px;background:white;z-index:2147483647;display:grid;gap:6px';
        modal.innerHTML = '<input id="interaction-input" value="native selection"><textarea id="interaction-textarea">native text</textarea><select id="interaction-select"><option value="one">One</option><option value="two">Two</option></select><div contenteditable="true" id="interaction-editable"><span>editable descendant</span></div><div data-native-interaction id="interaction-native"><span>native descendant</span></div><button id="interaction-button">Action <span>nested text</span></button><a id="interaction-link" href="#interaction-link-target"><span>game link</span></a><img id="interaction-image" alt="fixture" width="20" height="20" src="assets/runtime/v3/ui/logo.webp"><div id="interaction-scroll" style="height:100px;overflow-y:auto"><div style="height:900px">scrollable game content</div></div>';
        document.getElementById('modal-container').append(modal);
        window.interactionClicks = 0;
        document.getElementById('interaction-button').addEventListener('click', () => window.interactionClicks++);
        const dispatch = (node, type) => {
          const event = new Event(type, { bubbles: true, cancelable: true });
          node.dispatchEvent(event);
          return event.defaultPrevented;
        };
        const native = ['#login-password', '#interaction-input', '#interaction-textarea', '#interaction-select', '#interaction-select option', '#interaction-editable span', '#interaction-native span'];
        const guarded = ['#login-brand-image', '#interaction-image', '#interaction-button span', '#interaction-link span', '#interaction-scroll div'];
        const eventTypes = ['contextmenu', 'dragstart', 'selectstart'];
        const events = selectors => selectors.map(selector => ({ selector, prevented: eventTypes.map(type => dispatch(document.querySelector(selector), type)) }));
        const nativeEvents = events(native), guardedEvents = events(guarded);
        const textNode = document.querySelector('#interaction-button span').firstChild;
        const textPrevented = eventTypes.map(type => dispatch(textNode, type));
        const getStyle = selector => {
          const css = getComputedStyle(document.querySelector(selector));
          return { selector, select: css.userSelect, callout: css.getPropertyValue('-webkit-touch-callout') };
        };
        const styles = native.map(getStyle), artwork = getStyle('#interaction-image');
        const scrollingEvents = ['touchstart', 'touchmove', 'pointerdown', 'pointermove', 'wheel'].map(type => ({ type, prevented: dispatch(document.getElementById('interaction-scroll'), type) }));
        window.interactionPrevented = [];
        return { nativeEvents, guardedEvents, textPrevented, styles, artwork, scrollingEvents,
          calloutSupported: CSS.supports('-webkit-touch-callout', 'none'),
          viewportMeta: document.querySelector('meta[name="viewport"]').content };
      });
      for (const row of result.nativeEvents) assert.deepEqual(row.prevented, [false, false, false], `${row.selector}: native context menu/drag/selection remain available`);
      for (const row of result.guardedEvents) assert.deepEqual(row.prevented, [true, true, true], `${row.selector}: game surface is protected, including newly inserted modal content`);
      assert.deepEqual(result.textPrevented, [true, true, true], 'nested text targets are protected');
      for (const style of result.styles) {
        assert.equal(style.select, 'text', `${style.selector}: native text selection CSS`);
        if (result.calloutSupported) assert.equal(style.callout, 'default', `${style.selector}: native callout CSS`);
      }
      assert.equal(result.artwork.select, 'none');
      if (result.calloutSupported) assert.equal(result.artwork.callout, 'none');
      assert.ok(result.scrollingEvents.every(event => !event.prevented), 'touch/pointer/wheel events remain uncanceled');
      assert.ok(!/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?(?:\s*[,;]|$)/i.test(result.viewportMeta), 'viewport preserves user zoom');
      await page.locator('#interaction-button').click();
      assert.equal(await page.evaluate(() => window.interactionClicks), 1, 'one real click executes once');
      await page.locator('#interaction-link').click();
      assert.equal(await page.evaluate(() => location.hash), '#interaction-link-target', 'normal link clicks still navigate');
      await page.locator('#interaction-input').click();
      await page.keyboard.press('Control+A');
      assert.deepEqual(await page.locator('#interaction-input').evaluate(input => ({ focused: document.activeElement === input, start: input.selectionStart, end: input.selectionEnd })),
        { focused: true, start: 0, end: 16 }, 'native input focus and keyboard selection work');
      await page.keyboard.type('replacement');
      assert.equal(await page.locator('#interaction-input').inputValue(), 'replacement');
      await page.locator('#interaction-textarea').fill('textarea replacement');
      await page.locator('#interaction-select').selectOption('two');
      assert.equal(await page.locator('#interaction-select').inputValue(), 'two');
      await page.locator('#interaction-editable').fill('editable replacement');
      assert.equal(await page.locator('#interaction-editable').textContent(), 'editable replacement');
      await page.locator('#interaction-scroll').hover();
      await page.mouse.wheel(0, 200);
      await page.waitForFunction(() => document.getElementById('interaction-scroll').scrollTop > 0);
      const scroll = await page.evaluate(() => ({ top: document.getElementById('interaction-scroll').scrollTop,
        prevented: window.interactionPrevented.filter(type => /^(touchstart|touchmove|pointerdown|pointermove|wheel)$/.test(type)) }));
      assert.deepEqual(scroll.prevented, [], 'real scrolling is not canceled');
      checks.push({ viewport, nativeControls: result.nativeEvents.length, guardedTargets: result.guardedEvents.length,
        realClickCount: 1, nativeFocusSelection: true, scrollTop: scroll.top, calloutSupported: result.calloutSupported,
        viewportMeta: result.viewportMeta });
    }
    assert.deepEqual(errors, [], 'full app has no uncaught browser errors');
    assert.deepEqual(accountRequests, [], 'no account/database requests are attempted');
    assert.deepEqual(missingSources, [], 'all local JavaScript and CSS sources are present');
    console.log(JSON.stringify({ ok: true, checks, pageErrors: errors, accountRequests, missingSources,
      limitation: 'Chromium does not implement iOS touch-callout; actual Safari callout behavior requires a Safari/device check.' }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
