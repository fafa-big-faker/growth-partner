const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'mobile-cultivation.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('mobile inventory reuses paper artwork and removes the legacy inner backing', () => {
  assert.match(css, /assets\/runtime\/v3\/ui\/frame-topbar\.webp/);
  assert.match(css, /\.mobile-inventory-trigger::before\s*\{[^}]*pointer-events: none;/);
  assert.match(css, /\.mobile-inventory-body \.cult-inventory\s*\{[^}]*background: none;[^}]*backdrop-filter: none;/);
  assert.match(css, /\.mobile-inventory-body \.equip-info-bar\s*\{[^}]*backdrop-filter: none;/);
  assert.doesNotMatch(css, /\.mobile-inventory-body \.cult-inventory::before/);
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
    const version = file === 'mobile-cultivation.css' ? 'xianlai-v5-20260908' : 'forge-login-polish-20260908';
    assert.ok(html.includes(`${file}?v=${version}`), `release version missing for ${file}`);
  }
});
