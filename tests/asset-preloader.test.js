const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collect, create } = require('../asset-preloader');

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

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

function fixture(options = {}) {
  const images = [];
  const timers = new Map();
  let nextTimer = 0;
  class Image {
    constructor() { this.complete = false; this.naturalWidth = 0; images.push(this); }
    set src(value) { this.url = value; }
    get src() { return this.url; }
    decode() { this.decodeCalls = (this.decodeCalls || 0) + 1; return this.decodeResult; }
    succeed() { this.complete = true; this.naturalWidth = 128; this.onload?.(); }
    fail() { this.complete = true; this.onerror?.(); }
  }
  const loader = create({ Image, concurrency: 2, ...options,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { loader, images, timers, expire() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } } };
}

test('shared preloads bound concurrency, deduplicate in-flight URLs and wait for decode', async () => {
  const state = fixture();
  const first = state.loader.preload(['a.webp', 'a.webp', 'b.webp', 'c.webp']);
  const second = state.loader.preload(['a.webp', 'd.webp']);
  assert.deepEqual(state.images.map(image => image.src), ['a.webp', 'b.webp']);
  let decoded;
  state.images[0].decodeResult = new Promise(resolve => { decoded = resolve; });
  state.images[0].succeed();
  await flush();
  assert.equal(state.images.length, 2, 'decode retains its concurrency slot');
  decoded();
  await flush();
  assert.equal(state.images[2].src, 'c.webp');
  state.images[1].succeed();
  await flush();
  assert.equal(state.images[3].src, 'd.webp');
  state.images[2].succeed();
  state.images[3].succeed();
  assert.equal((await first).loaded, 3);
  assert.equal((await second).loaded, 2);
  assert.equal(state.images[0].decodeCalls, 1);
  assert.equal(state.timers.size, 0);
});

test('decoded success is reused on warm loads without another Image', async () => {
  const state = fixture();
  const first = state.loader.preload(['cached.webp']);
  state.images[0].succeed();
  await first;
  const updates = [];
  const result = await state.loader.preload(['cached.webp'], update => updates.push(update));
  assert.equal(result.loaded, 1);
  assert.equal(state.images.length, 1);
  assert.equal(state.loader.getImage('cached.webp'), state.images[0]);
  assert.equal(updates.at(-1).percent, 100);
});

test('failed image is not cached, retries are bounded and failure never reports 100 percent', async () => {
  const state = fixture();
  const updates = [];
  const first = state.loader.preload(['bad.webp', 'good.webp'], value => updates.push(value), { retries: 1 });
  state.images[0].fail();
  assert.equal(state.images[2].src, 'bad.webp');
  state.images[2].fail();
  state.images[1].succeed();
  const result = await first;
  assert.deepEqual(result.failed, ['bad.webp']);
  assert.equal(result.loaded, 1);
  assert.equal(result.completed, 2);
  assert.equal(updates.at(-1).percent, 50);
  assert.ok(updates.every(value => value.percent < 100));
  const retry = state.loader.preload(['bad.webp']);
  assert.equal(state.images[3].src, 'bad.webp');
  state.images[3].succeed();
  assert.deepEqual((await retry).failed, []);
});

test('timeout covers pending image decoding and ignores its late completion', async () => {
  const state = fixture({ concurrency: 1 });
  let decoded;
  const first = state.loader.load('late.webp');
  state.images[0].decodeResult = new Promise(resolve => { decoded = resolve; });
  state.images[0].succeed();
  await flush();
  state.expire();
  assert.equal((await first).reason, 'timeout');
  decoded();
  await flush();
  assert.equal(state.loader.getImage('late.webp'), null);
  const second = state.loader.load('late.webp');
  state.images[1].succeed();
  assert.equal((await second).ok, true);
});

test('one aborted consumer cannot cancel another shared consumer', async () => {
  const state = fixture();
  const controller = new AbortController();
  const first = state.loader.load('shared.webp', { signal: controller.signal });
  const second = state.loader.load('shared.webp');
  controller.abort();
  assert.equal((await first).cancelled, true);
  assert.equal(state.images.length, 1);
  assert.equal(state.images[0].src, 'shared.webp');
  state.images[0].succeed();
  assert.equal((await second).ok, true);
});

test('cancelling a batch releases active and queued images without starting cancelled URLs', async () => {
  const state = fixture({ concurrency: 1 });
  const controller = new AbortController();
  const batch = state.loader.preload(['one.webp', 'two.webp', 'three.webp'], () => {}, { signal: controller.signal });
  controller.abort();
  const result = await batch;
  assert.equal(result.loaded, 0);
  assert.equal(result.cancelled.length, 3);
  assert.equal(state.images.length, 1, 'queued images never start during a batch abort');
  assert.equal(state.timers.size, 0);
  assert.ok(state.images.every(image => image.src === ''));
  const count = state.images.length;
  const after = state.loader.load('after.webp');
  state.images[count].succeed();
  assert.equal((await after).ok, true);
});

test('SVG controls participate in asset preparation and empty batches are complete', async () => {
  assert.deepEqual(collect(['close.svg?v=1', 'notes.txt']), ['close.svg?v=1']);
  const state = fixture();
  const result = await state.loader.preload([]);
  assert.deepEqual(result, { total: 0, loaded: 0, completed: 0, failed: [], cancelled: [] });
});
