const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'ink-pages.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('page and section headings do not restore solid rectangular backing', () => {
  for (const selector of [
    '#player-dashboard .ink-reward-page .ink-page-heading .page-title',
    '#player-dashboard .ink-task-page .task-section-label',
    '#player-dashboard .ink-task-page .theme-head',
    '#player-dashboard .ink-reward-page .shop-tip',
  ]) {
    const start = css.lastIndexOf(selector);
    assert.ok(start >= 0);
    assert.match(css.slice(start, css.indexOf('}', start)), /background: transparent/);
  }
  assert.match(css, /--page-ink: #252b29/);
  assert.match(css, /assets\/runtime\/v5\/ui\/task-paper.webp/);
  assert.match(css, /assets\/runtime\/v5\/ui\/shop-paper.webp/);
});

test('browser and saved-page names are exactly the game name', () => {
  assert.match(html, /<title>仙来<\/title>/);
  assert.match(html, /name="application-name" content="仙来"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="仙来"/);
});
