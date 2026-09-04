const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'assets', 'images', 'v2', 'manifest.json');

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
