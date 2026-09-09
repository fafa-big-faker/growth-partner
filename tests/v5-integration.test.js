const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'mobile-cultivation.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('V7 replaces the old mobile drawer with one shared inventory paper', () => {
  assert.match(css, /assets\/runtime\/v7\/ui\/inventory-paper\.webp/);
  assert.match(css, /\.mobile-inventory-columns/);
  assert.doesNotMatch(css, /\.mobile-inventory-trigger|\.mobile-inventory-overlay/);
});

test('V5 preloads required paper without making optional login textures block entry', () => {
  const preload = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)[0];
  assert.match(preload, /assets\/runtime\/v5\/ui\/task-paper\.webp/);
  assert.match(preload, /assets\/runtime\/v5\/ui\/shop-paper\.webp/);
  assert.doesNotMatch(preload, /LoginArt\.getImageAssets\(\)|v5\/effects/);
  const LoginArt = require('../login-art');
  assert.equal(LoginArt.getImageAssets().length, 6);
  assert.ok(LoginArt.getImageAssets().every(url => url.endsWith('?v=xianlai-v5-20260908')));
  for (const file of ['app.js', 'login-art.js', 'mobile-cultivation.css', 'ink-pages.css']) {
    const version = file === 'ink-pages.css' ? 'forge-login-polish-20260908'
      : file === 'app.js' ? 'forge-workshop-20260909' : 'reward-login-20260909';
    assert.ok(html.includes(`${file}?v=${version}`), `release version missing for ${file}`);
  }
});
