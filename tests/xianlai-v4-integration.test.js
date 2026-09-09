const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AssetPreloader = require('../asset-preloader');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/runtime/v4/manifest.json'), 'utf8'));
const resolver = app.match(/function getItemIconPath\([^]*?\n\}/)[0];
const items = Object.fromEntries(Object.keys(manifest.items).map(id => [id, `assets/images/icons/${id}.png`]));

test('synchronized item names and icons match the approved atlas without changing recipes', () => {
  const context = {};
  vm.runInNewContext(`${fs.readFileSync(path.join(root, 'game-config.js'), 'utf8')};globalThis.config = GAME_CONFIG;`, context);
  const byId = Object.fromEntries(context.config.itemTable.map(item => [String(item.id), item]));
  const names = { 0: '小钱钱', 10001: '月屑', 10002: '月牙片', 10101: '星尘', 10102: '星叶', 10201: '日光屑', 10202: '暖阳露', 10301: '云石', 10302: '云玉', 20001: '一弯月', 20101: '一颗星', 20201: '一束光', 20301: '一朵云', 40001: '开工石', 40002: '菩提露' };
  for (const [id, name] of Object.entries(names)) assert.equal(byId[id].name, name);
  for (const id of Object.keys(items)) assert.equal(byId[id].iconImage, `assets/runtime/v4/items/${id}.webp`);
  for (const [id, params] of Object.entries({ 10001: '20001,50', 10002: '20001,10', 20001: '0.5', 20301: '10' })) {
    assert.equal(byId[id].interactionParams, params);
  }
  assert.equal(byId['30001'].name, '期石');
  assert.equal(byId['30101'].name, '望石');
  assert.equal(byId['30201'].name, '待石');
  const sync = fs.readFileSync(path.join(root, 'sync-config.py'), 'utf8');
  assert.match(sync, /icon_image = approved_item_art\(item_id\)/);
  assert.match(sync, /if img_token and not icon_image:/);
});

test('all 28 current item IDs use V4 without losing future configured art', () => {
  const context = { ITEM_IMAGES: items };
  vm.runInNewContext(`${resolver};globalThis.resolve = getItemIconPath;`, context);
  assert.equal(Object.keys(items).length, 28);
  for (const id of Object.keys(items)) {
    assert.equal(context.resolve(id, items[id]), `assets/runtime/v4/items/${id}.webp`);
    assert.equal(context.resolve(Number(id)), context.resolve(id));
  }
  assert.equal(context.resolve('99999', 'custom.webp'), 'custom.webp');
  assert.equal(context.resolve('99999'), '');
  assert.equal(context.resolve('constructor'), '');
  assert.match(app, /const img = getItemIconPath\(id, def\?\.iconImage\)/);
});

test('preloads cover the complete V4 set without requesting replaced icons and frames', () => {
  const preload = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)[0];
  const context = {
    ITEM_IMAGES: items, AssetPreloader,
    V2_IMAGE_ROOT: 'assets/runtime/v2', V3_IMAGE_ROOT: 'assets/runtime/v3',
    GAME_CONFIG: { itemTable: [...Object.keys(items).map(id => ({ id, iconImage: items[id] })), { id: 99999, iconImage: 'custom.webp' }] },
  };
  vm.runInNewContext(`${resolver}\n${preload}\nglobalThis.assets = getInitialGameImageAssets();`, context);
  for (const group of Object.values(manifest)) {
    for (const asset of Object.values(group)) {
      assert.ok(context.assets.includes(asset.path), `missing ${asset.path}`);
      assert.ok(fs.existsSync(path.join(root, asset.path)));
    }
  }
  assert.ok(context.assets.includes('custom.webp'));
  assert.equal(context.assets.some(p => p.startsWith('assets/images/icons/')), false);
  assert.equal(context.assets.some(p => /v2\/ui\/(?:slot-|modal-crest)/.test(p)), false);
  assert.equal(context.assets.includes('assets/runtime/v2/icons/icon-forge.webp'), false);
});

test('new resources and mobile controller load before app with a coherent release marker', () => {
  for (const file of ['xianlai-v4.css', 'mobile-cultivation.css', 'mobile-cultivation.js']) {
    const version = file === 'xianlai-v4.css' ? 'xianlai-v6-20260908'
      : 'reward-login-20260909';
    assert.ok(html.includes(`${file}?v=${version}`));
    assert.ok(html.indexOf(file) < html.indexOf('src="app.js'));
  }
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /game-config\.js\?v=xianlai-v4-20260908/);
  assert.doesNotMatch(html, /v2\/icons\/icon-forge/);
});
