const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const cssPath = path.join(root, 'ink-scrollbars.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const hosts = ':is(html, body, .cult-inventory .inventory-grid, .mobile-inventory-body, .modal, .forge-probability-list, textarea)';

test('ink scrollbars cover the actual page, inventory, drawer, dialog and input hosts', () => {
  assert.ok(css.includes(`${hosts} {`));
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-color:\s*var\(--ink-scroll-thumb\) var\(--ink-scroll-track\)/);
  for (const name of ['thumb', 'hover', 'active', 'track']) {
    assert.match(css, new RegExp(`--ink-scroll-${name}:\\s*[^;]+;`));
  }
});

test('native states stay visible without overriding scrolling or inventory geometry', () => {
  assert.ok(css.includes(`${hosts}:focus-within`));
  assert.ok(css.includes(`${hosts}:hover`));
  assert.ok(css.includes(`${hosts}:active`));
  assert.match(css, /@media \(hover: hover\)/);
  assert.doesNotMatch(css, /(?:^|[;{])\s*(?:overflow(?:-[xy])?|scroll-behavior|touch-action|pointer-events|grid-template-columns|max-height|padding(?:-[a-z]+)?)\s*:/m);
  assert.doesNotMatch(css, /scrollbar-width:\s*none|display:\s*none|animation:|transition:|url\(/);
  assert.match(css, /\.modal:not\(\.mobile-inventory-panel\)\s*\{\s*scrollbar-gutter:\s*stable;/);
  assert.equal((css.match(/scrollbar-gutter:/g) || []).length, 1);
});

test('WebKit thumb hover and drag remain effective despite modern standard overrides', () => {
  assert.match(css, /@supports selector\(::-webkit-scrollbar\)/);
  const webkit = css.slice(css.indexOf('@supports selector'));
  assert.match(webkit, /scrollbar-width:\s*auto;\s*scrollbar-color:\s*auto;/);
  assert.ok(webkit.includes(`${hosts}::-webkit-scrollbar {`));
  assert.match(webkit, /width:\s*10px;\s*height:\s*10px;/);
  assert.match(webkit, /::-webkit-scrollbar-thumb\s*\{[^}]*min-height:\s*32px;[^}]*background-clip:\s*padding-box/s);
  assert.match(webkit, /::-webkit-scrollbar-thumb:hover\s*\{\s*background-color:\s*var\(--ink-scroll-hover\)/);
  assert.match(webkit, /::-webkit-scrollbar-thumb:active\s*\{\s*background-color:\s*var\(--ink-scroll-active\)/);
  assert.match(webkit, /::-webkit-scrollbar-corner\s*\{/);
});

test('high contrast restores platform size and system colors', () => {
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.ok(forced.startsWith('@media (forced-colors: active)'));
  assert.match(forced, /scrollbar-color:\s*auto;\s*scrollbar-width:\s*auto;/);
  assert.match(forced, /::-webkit-scrollbar\s*\{\s*width:\s*auto;\s*height:\s*auto;/);
  assert.match(forced, /::-webkit-scrollbar-thumb:is\(:hover, :active\)/);
  assert.match(forced, /background-color:\s*ButtonText/);
  assert.match(forced, /background-color:\s*Canvas/);
  assert.doesNotMatch(css, /forced-color-adjust:\s*none/);
});
