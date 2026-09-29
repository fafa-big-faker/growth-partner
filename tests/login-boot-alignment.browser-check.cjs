// Actual page markup and styles, no screenshots, scripts, database or external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'http://127.0.0.1:9869';
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main() {
  const browser = await playwright.chromium.launch({ headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [], failures = [];
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.fulfill({ body: '', contentType: 'text/css' });
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return route.abort();
    try {
      let body = await fs.readFile(file);
      if (relative === 'index.html') {
        let html = body.toString('utf8').replace(/<script\b[^>]*>[^]*?<\/script>/g, '');
        if (url.searchParams.get('demo') === '1') html = html.replace('<html lang="zh-CN">', '<html lang="zh-CN" class="demo-entry">');
        body = Buffer.from(html);
      }
      const contentType = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.webp': 'image/webp',
        '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
      return route.fulfill({ body, contentType });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  try {
    for (const demo of [false, true]) {
      const page = await context.newPage();
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 },
        { width: 390, height: 1200 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.goto(origin + (demo ? '/?demo=1' : '/'));
        for (const phase of ['static', 'runtime']) {
          if (phase === 'runtime') await page.evaluate(demo => {
            document.getElementById('login-boot-quote').textContent = demo
              ? '首次需缓存资源，\n加载稍慢，请稍候。' : '修仙可以慢慢来，\n饭要记得按时吃。';
          }, demo);
          const result = await page.evaluate(() => {
            const center = innerWidth / 2;
            const selectors = ['.login-boot-content', '.login-boot-brand', '.login-boot-kicker',
              '#login-boot-quote', '#demo-boot-notice', '.login-boot-preparation'];
            return selectors.flatMap(selector => {
              const el = document.querySelector(selector), box = el.getBoundingClientRect();
              if (!box.width || !box.height) return [];
              const lines = new Map(), walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
              // Only measure copy, not the intentionally split progress status/percentage.
              if (selector !== '.login-boot-content' && selector !== '.login-boot-preparation') {
                while (walker.nextNode()) {
                  const node = walker.currentNode;
                  for (let i = 0; i < node.length; i++) {
                    if (!node.data[i].trim()) continue;
                    const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
                    for (const rect of range.getClientRects()) {
                      if (!rect.width || !rect.height) continue;
                      const y = Math.round(rect.y), old = lines.get(y);
                      lines.set(y, { left: Math.min(old?.left ?? Infinity, rect.left),
                        right: Math.max(old?.right ?? -Infinity, rect.right) });
                    }
                  }
                }
              }
              return [{ selector, blockOffset: +(box.x + box.width / 2 - center).toFixed(2),
                lineOffsets: [...lines.values()].map(line => +((line.left + line.right) / 2 - center).toFixed(2)),
                left: box.left, right: box.right, top: box.top, bottom: box.bottom,
                align: getComputedStyle(el).textAlign, margin: getComputedStyle(el).margin }];
            });
          });
          results.push({ demo, viewport, phase, geometry: result });
          for (const item of result) {
            if (Math.abs(item.blockOffset) > 1.5 || item.lineOffsets.some(offset => Math.abs(offset) > 1.5)
              || item.left < -1 || item.right > viewport.width + 1
              || item.top < -1 || item.bottom > viewport.height + 1) {
              failures.push({ demo, viewport, phase, ...item });
            }
          }
        }
      }
      await page.close();
    }
    console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
    assert.deepEqual(failures, [], 'loading copy and progress use the same viewport centerline');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
