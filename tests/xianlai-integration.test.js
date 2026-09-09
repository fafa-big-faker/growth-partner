const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AssetPreloader = require('../asset-preloader');
const { createAudioManager } = require('../audio-manager');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const treeSource = app.slice(app.indexOf('const TREE_APPEARANCES ='), app.indexOf('function getTreeAppearance('));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const iconSource = app.slice(app.indexOf('const V3_IMAGE_ROOT'), app.indexOf('function escapeHtml'));

test('feature icons resolve the new atlas while keeping unmodified icons intact', () => {
  const context = { V2_IMAGE_ROOT: 'assets/runtime/v2' };
  vm.runInNewContext(`${iconSource}\nglobalThis.resolveIcon = getFeatureIconPath;`, context);
  for (const name of ['cultivate', 'tasks', 'shop', 'mail', 'achievement', 'sound']) {
    assert.equal(context.resolveIcon(`icon-${name}`), `assets/runtime/v3/icons/icon-${name}.webp`);
  }
  assert.equal(context.resolveIcon('icon-reward'), 'assets/runtime/v3/icons/icon-shop.webp');
  assert.equal(context.resolveIcon('icon-forge'), 'assets/runtime/v4/icons/icon-forge.webp');
});

test('all new runtime artwork is included in preload and old login art is no longer requested', () => {
  const source = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)?.[0];
  const context = {
    V2_IMAGE_ROOT: 'assets/runtime/v2', V3_IMAGE_ROOT: 'assets/runtime/v3',
    GAME_CONFIG: { itemTable: [] }, ITEM_IMAGES: {}, AssetPreloader,
    getItemIconPath: () => '',
  };
  vm.runInNewContext(`${treeSource}\n${source}\nglobalThis.assets = getInitialGameImageAssets();`, context);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/runtime/v3/manifest.json'), 'utf8'));
  for (const group of Object.values(manifest)) {
    for (const item of Object.values(group)) {
      assert.ok(context.assets.includes(item.path), `preload missing ${item.path}`);
      assert.ok(fs.existsSync(path.join(root, item.path)), `asset missing ${item.path}`);
    }
  }
  assert.equal(context.assets.includes('assets/runtime/v2/backgrounds/login-main.webp'), false);
});

test('login and UI art resources load before the application starts', () => {
  for (const file of ['xianlai-ui.css', 'login-art.css', 'login-art.js']) {
    const version = file === 'xianlai-ui.css' ? 'xianlai-art-v3-20260908' : 'reward-login-20260909';
    assert.ok(html.includes(`${file}?v=${version}`));
    assert.ok(html.indexOf(file) < html.indexOf('src="app.js'));
  }
  assert.match(html, /<title>仙来/);
  assert.match(html, /id="login-brand-image" data-boot-src="assets\/runtime\/v3\/ui\/logo.webp"/);
  assert.ok(html.indexOf('src="boot-assets.js') < html.indexOf('src="login-boot.js'));
  assert.match(app, /LoginArt\.init\(\{ prepared \}\)/);
});

test('muting preserves the new bitmap and toggles its accessible state', () => {
  const classes = new Set();
  const attributes = new Map();
  let iconReplacements = 0;
  const control = {
    classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
    setAttribute: (key, value) => attributes.set(key, value),
    querySelector: () => ({ set textContent(_value) { iconReplacements++; } }),
  };
  const manager = createAudioManager({
    storage: { getItem: () => null, setItem() {} },
    documentRef: { querySelectorAll: () => [control] },
  });
  manager.setMuted(true);
  assert.ok(classes.has('is-muted'));
  assert.equal(attributes.get('aria-pressed'), 'true');
  manager.setMuted(false);
  assert.equal(classes.has('is-muted'), false);
  assert.equal(attributes.get('aria-pressed'), 'false');
  assert.equal(iconReplacements, 0);
});
