const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AssetPreloader = require('../asset-preloader');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'xianlai-v4.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const treeSource = app.slice(app.indexOf('const TREE_APPEARANCES ='), app.indexOf('function getTreeAppearance('));
const version = 'xianlai-v6-20260908';

test('five flat ink marks cover both inventory surfaces without changing slot geometry', () => {
  for (let quality = 1; quality <= 5; quality++) {
    const rule = css.match(new RegExp(`\\.item-slot\\.quality-${quality}\\s*\\{([^}]+)`))?.[1] || '';
    assert.ok(rule.includes(`assets/runtime/v6/quality/quality-${quality}.webp?v=${version}`));
  }
  const marker = css.match(/:is\(#player-dashboard, \.mobile-inventory-panel\) \.item-slot:not\(\.empty\)::after\s*\{([^}]+)/)?.[1] || '';
  assert.match(marker, /width: 12px/);
  assert.match(marker, /height: 26px/);
  assert.match(marker, /background: var\(--v6-quality-mark\) center \/ contain no-repeat/);
  assert.match(marker, /pointer-events: none/);
  assert.doesNotMatch(marker, /box-shadow|filter:|opacity:/);
});

test('game preload includes the exact five mark URLs but never waits on login decorations', () => {
  const preload = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)[0];
  const context = { V2_IMAGE_ROOT: 'assets/runtime/v2', V3_IMAGE_ROOT: 'assets/runtime/v3',
    GAME_CONFIG: { itemTable: [] }, ITEM_IMAGES: {}, AssetPreloader, getItemIconPath: () => '' };
  vm.runInNewContext(`${treeSource}\n${preload}\nglobalThis.assets = getInitialGameImageAssets();`, context);
  for (let quality = 1; quality <= 5; quality++) {
    const asset = `assets/runtime/v6/quality/quality-${quality}.webp?v=${version}`;
    assert.equal(context.assets.filter(url => url === asset).length, 1);
    assert.ok(fs.statSync(path.join(root, asset.split('?')[0])).size > 0);
  }
  assert.equal(context.assets.some(url => url.includes('/v6/ui/login-')), false);
});

test('native login button keeps accessible text and defers both image layers to verified entry preparation', () => {
  const button = html.match(/<button[^>]*id="login-submit"[^>]*>[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(button, /type="submit"/);
  assert.match(button, /aria-label="踏入仙途"/);
  assert.match(button, /class="login-submit-fallback">踏入仙途<\/span>/);
  for (const layer of ['brush', 'lettering']) {
    const url = `assets/runtime/v6/ui/login-${layer}.webp?v=${version}`;
    assert.ok(button.includes(`id="login-submit-${layer}"`));
    assert.ok(button.includes(`data-boot-src="${url}"`));
    assert.ok(!html.includes(`rel="preload" as="image" href="${url}"`));
    assert.ok(fs.statSync(path.join(root, url.split('?')[0])).size > 0);
  }
  for (const file of ['app.js', 'login-art.js', 'login-art.css', 'xianlai-v4.css']) {
    const codeVersion = file === 'xianlai-v4.css' ? version
      : file === 'app.js' ? 'mobile-audio-20260910'
        : file === 'login-art.js' ? 'entry-transitions-20260910' : 'reward-login-20260909';
    assert.ok(html.includes(`${file}?v=${codeVersion}`));
  }
});
