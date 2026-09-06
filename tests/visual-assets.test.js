const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'assets', 'runtime', 'v2', 'manifest.json');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('visual manifest exposes every player-facing asset group', () => {
  assert.ok(fs.existsSync(manifestPath), 'visual asset manifest is missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const background of ['login-main', 'cultivate', 'tasks', 'reward']) {
    assert.ok(manifest.backgrounds[background], `missing background: ${background}`);
  }
  for (const tree of ['sprout', 'spirit', 'divine']) {
    assert.ok(manifest.trees[tree], `missing tree: ${tree}`);
  }
  assert.ok(Object.keys(manifest.ui).length >= 8, 'UI atlas did not produce enough components');
  assert.ok(Object.keys(manifest.icons).length >= 8, 'feature atlas did not produce enough icons');
  assert.ok(Object.keys(manifest.effects).length >= 4, 'feature atlas did not produce enough effects');

  for (const group of Object.values(manifest)) {
    for (const relativePath of Object.values(group)) {
      assert.ok(fs.existsSync(path.join(root, relativePath)), `missing generated asset: ${relativePath}`);
    }
  }
});

test('player pages consume optimized runtime backgrounds, trees, navigation, and inventory frames', () => {
  assert.match(html, /assets\/runtime\/v2\/icons\/icon-cultivate\.webp/);
  assert.match(html, /assets\/runtime\/v2\/icons\/icon-tasks\.webp/);
  assert.match(html, /assets\/runtime\/v2\/icons\/icon-reward\.webp/);

  assert.match(app, /assets\/runtime\/v2\/trees\/sprout\.webp/);
  assert.match(app, /assets\/runtime\/v2\/trees\/spirit\.webp/);
  assert.match(app, /assets\/runtime\/v2\/trees\/divine\.webp/);
  assert.match(app, /dashboard\.dataset\.playerScene\s*=\s*tab/);

  assert.match(styles, /backgrounds\/login-main\.webp/);
  for (const scene of ['cultivate', 'tasks', 'reward']) {
    assert.match(styles, new RegExp(`backgrounds/${scene}\\.webp`));
  }
  for (const slot of ['neutral', 'blue', 'purple', 'rose', 'gold']) {
    assert.match(styles, new RegExp(`ui/slot-${slot}\\.webp`));
  }
  assert.match(styles, /\.item-slot\s*\{[\s\S]*?aspect-ratio:\s*1/);
});

test('shop cards expose descriptions and use a dedicated purchase footer', () => {
  const render = app.match(/\n  _renderShop\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(render, /item\.description/);
  assert.match(render, /shop-description/);
  assert.match(render, /shop-action/);
  assert.match(styles, /\.shop-description/);
  assert.match(styles, /\.shop-action/);
});

test('login submit has hover, press, keyboard focus, and disabled feedback', () => {
  assert.match(styles, /\.login-submit:hover:not\(:disabled\)/);
  assert.match(styles, /\.login-submit:active:not\(:disabled\)/);
  assert.match(styles, /\.login-submit:focus-visible/);
  assert.match(styles, /\.login-submit:disabled/);
});
