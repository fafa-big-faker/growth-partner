const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'assets', 'images', 'v2', 'manifest.json');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('visual manifest exposes every player-facing asset group', () => {
  assert.ok(fs.existsSync(manifestPath), 'visual asset manifest is missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.deepEqual(Object.keys(manifest.backgrounds), ['login', 'cultivate', 'tasks', 'reward']);
  assert.deepEqual(Object.keys(manifest.trees), ['sprout', 'spirit', 'divine']);
  assert.ok(Object.keys(manifest.ui).length >= 8, 'UI atlas did not produce enough components');
  assert.ok(Object.keys(manifest.icons).length >= 8, 'feature atlas did not produce enough icons');
  assert.ok(Object.keys(manifest.effects).length >= 4, 'feature atlas did not produce enough effects');

  for (const group of Object.values(manifest)) {
    for (const relativePath of Object.values(group)) {
      assert.ok(fs.existsSync(path.join(root, relativePath)), `missing generated asset: ${relativePath}`);
    }
  }
});

test('player pages consume v2 backgrounds, trees, navigation, and inventory frames', () => {
  assert.match(html, /assets\/images\/v2\/icons\/icon-cultivate\.png/);
  assert.match(html, /assets\/images\/v2\/icons\/icon-tasks\.png/);
  assert.match(html, /assets\/images\/v2\/icons\/icon-reward\.png/);

  assert.match(app, /assets\/images\/v2\/trees\/sprout\.png/);
  assert.match(app, /assets\/images\/v2\/trees\/spirit\.png/);
  assert.match(app, /assets\/images\/v2\/trees\/divine\.png/);
  assert.match(app, /dashboard\.dataset\.playerScene\s*=\s*tab/);

  for (const scene of ['login', 'cultivate', 'tasks', 'reward']) {
    assert.match(styles, new RegExp(`backgrounds/${scene}\\.webp`));
  }
  for (const slot of ['neutral', 'blue', 'purple', 'rose', 'gold']) {
    assert.match(styles, new RegExp(`ui/slot-${slot}\\.png`));
  }
  assert.match(styles, /\.item-slot\s*\{[\s\S]*?aspect-ratio:\s*1/);
});
