const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const RewardPresentation = require('../reward-presentation');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const treeSource = app.slice(app.indexOf('const TREE_APPEARANCES ='), app.indexOf('function getTreeAppearance('));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const version = 'xianlai-v7-20260909';

test('every V7 image is preloaded with the exact runtime cache key', () => {
  const preload = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)[0];
  const context = {
    AssetPreloader: { collect: lists => [...new Set(lists.flat())] },
    GAME_CONFIG: { itemTable: [] }, ITEM_IMAGES: {},
    V2_IMAGE_ROOT: 'assets/runtime/v2', V3_IMAGE_ROOT: 'assets/runtime/v3',
    getItemIconPath() {},
  };
  const urls = vm.runInNewContext(`${treeSource}\n${preload}; getInitialGameImageAssets()`, context);
  const controls = ['return-arrow', 'exp-track', 'exp-fill'].map(name => `assets/runtime/ink-controls/${name}.webp?v=ink-controls-20260909`);
  for (const url of [...RewardPresentation.getAssetUrls(), `assets/runtime/v7/ui/inventory-paper.webp?v=${version}`, ...controls]) {
    assert.equal(urls.filter(candidate => candidate === url).length, 1, url);
    assert.ok(fs.statSync(path.join(root, url.split('?')[0])).size > 0, url);
  }
});

test('new modules load before application and paper/quality style before scrollbar overrides', () => {
  for (const file of ['mobile-cultivation.js', 'reward-presentation.js', 'mobile-cultivation.css', 'reward-presentation.css', 'audio-manager.js', 'app.js']) {
    const codeVersion = file.startsWith('mobile-cultivation.') ? 'reward-login-20260909'
      : file === 'reward-presentation.js' ? 'skill-quality-20260909'
        : file === 'app.js' ? 'wish-trees-20260909'
          : file === 'audio-manager.js' ? 'android-entry-20260909' : 'local-skill-20260909';
    assert.ok(html.includes(`${file}?v=${codeVersion}`), file);
  }
  assert.ok(html.indexOf('src="reward-presentation.js') < html.indexOf('src="app.js'));
  assert.ok(html.indexOf('href="reward-presentation.css') < html.indexOf('href="ink-scrollbars.css'));
  for (const file of ['chop-refund-feedback.js', 'chop-refund-feedback.css', 'weapon-affixes.js', 'game-config.js']) {
    assert.ok(html.includes(`${file}?v=${file === 'game-config.js' ? 'wish-trees-20260909' : 'reward-focus-20260909'}`), file);
    assert.ok(html.indexOf(file) < html.indexOf('src="app.js'));
  }
});
