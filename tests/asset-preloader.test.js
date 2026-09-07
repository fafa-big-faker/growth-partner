const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collect } = require('../asset-preloader');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('asset collection flattens image groups and removes duplicates', () => {
  assert.deepEqual(collect({ a: ['a.png', 'a.png'], b: { one: 'b.webp' }, other: 'notes.txt' }), ['a.png', 'b.webp']);
});

test('cache-versioned idle frames remain eligible for preloading', () => {
  const frame = 'assets/runtime/character/idle-axes/51001/frame-01.webp?v=idle-anchor-20260907';
  assert.deepEqual(collect([frame]), [frame]);
  const frames = app.match(/function getAxeIdleFrames\([\s\S]*?\n\}/)?.[0] || '';
  assert.match(frames, /webp\?v=idle-anchor-20260907/);
});

test('login preload includes only the currently equipped weapon animation', () => {
  const selector = app.match(/function getInitialGameImageAssets\([\s\S]*?\n\}/)?.[0] || '';
  assert.match(selector, /getAxeIdleFrames\(axeId\)/);
  assert.match(selector, /getAxeChopFrames\(axeId\)/);
  assert.doesNotMatch(selector, /AXE_ANIMATION_IDS\.flatMap/);
  assert.match(app, /function preloadAxeAnimation\(itemId/);
});
