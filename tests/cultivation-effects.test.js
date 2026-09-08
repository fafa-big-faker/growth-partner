const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCultivationEffects } = require('../cultivation-effects');

function fixture(options = {}) {
  const listeners = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const document = {
    hidden: false,
    createElement() {
      return {
        dataset: {},
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        style: {
          properties: {},
          setProperty(name, value) { this.properties[name] = value; },
        },
      };
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const scene = {
    children: [],
    offsetWidth: 300,
    offsetHeight: 200,
    clientLeft: 0,
    clientTop: 0,
    appendChild(node) {
      this.children.push(node);
      node.isConnected = true;
      node.remove = () => {
        node.isConnected = false;
        const index = this.children.indexOf(node);
        if (index >= 0) this.children.splice(index, 1);
      };
    },
    getBoundingClientRect() { return { left: 10, top: 20, width: 300, height: 200 }; },
  };
  const image = { getBoundingClientRect() { return { left: 190, top: 60, width: 80, height: 80 }; } };
  const tree = {
    getBoundingClientRect() { return { left: 190, top: 60, width: 80, height: 100 }; },
    querySelector() { return image; },
  };
  const effects = createCultivationEffects({
    document,
    random: () => 0.5,
    schedule(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    cancelSchedule(id) { timers.delete(id); },
    ...options,
  });
  return { document, scene, tree, image, effects, listeners, timers };
}

test('hits use one short ink cut and four clean runtime leaves, never legacy glows', () => {
  const { effects, scene, tree, timers } = fixture();
  assert.equal(effects.playHit({ scene, tree }), 5);
  const cut = scene.children.filter(node => node.dataset.effect === 'cut');
  const leaves = scene.children.filter(node => node.dataset.effect === 'leaf');
  assert.equal(cut.length, 1);
  assert.equal(leaves.length, 4);
  assert.ok(leaves.every(node => /assets\/runtime\/effects\/leaf-ink\.webp/.test(node.style.backgroundImage)));
  assert.ok(scene.children.every(node => !/spark|glow|gold/.test(node.className + (node.style.backgroundImage || ''))));
  assert.ok(scene.children.every(node => node.attributes['aria-hidden'] === 'true'));
  assert.ok(leaves.every(node => parseFloat(node.style.top) < parseFloat(cut[0].style.top)));
  for (const [id, timer] of [...timers]) {
    timers.delete(id);
    timer.callback();
  }
  assert.equal(scene.children.length, 0);
  effects.destroy();
});

test('ten-chop speed shortens both complete effect lifetimes without adding particles', () => {
  const slow = fixture();
  const fast = fixture();
  const slowCount = slow.effects.playHit({ scene: slow.scene, tree: slow.tree, speed: 1 });
  const fastCount = fast.effects.playHit({ scene: fast.scene, tree: fast.tree, speed: 3 });
  assert.equal(slowCount, fastCount);
  assert.ok(fastCount < 7);
  assert.equal(slow.scene.children[0].style.properties['--effect-delay'], '180ms');
  assert.equal(fast.scene.children[0].style.properties['--effect-delay'], '60ms');
  for (let index = 0; index < slow.scene.children.length; index += 1) {
    const slowProperties = slow.scene.children[index].style.properties;
    const fastProperties = fast.scene.children[index].style.properties;
    assert.ok(parseFloat(fastProperties['--effect-duration']) < parseFloat(slowProperties['--effect-duration']));
    assert.ok(parseFloat(fastProperties['--effect-delay']) <= parseFloat(slowProperties['--effect-delay']));
  }
  assert.ok(Math.max(...[...fast.timers.values()].map(timer => timer.delay)) < Math.max(...[...slow.timers.values()].map(timer => timer.delay)));
  slow.effects.destroy();
  fast.effects.destroy();
});

test('scale conversion preserves the existing strike anchor in scene CSS pixels', () => {
  const plain = fixture();
  plain.effects.playHit({ scene: plain.scene, tree: plain.tree });
  const zoomed = fixture();
  zoomed.scene.getBoundingClientRect = () => ({ left: 10, top: 20, width: 600, height: 400 });
  zoomed.tree.getBoundingClientRect = () => ({ left: 370, top: 100, width: 160, height: 200 });
  zoomed.image.getBoundingClientRect = () => ({ left: 370, top: 100, width: 160, height: 160 });
  zoomed.effects.playHit({ scene: zoomed.scene, tree: zoomed.tree });
  for (let index = 0; index < plain.scene.children.length; index += 1) {
    assert.equal(zoomed.scene.children[index].style.left, plain.scene.children[index].style.left);
    assert.equal(zoomed.scene.children[index].style.top, plain.scene.children[index].style.top);
  }
  assert.equal(parseFloat(plain.scene.children[0].style.left), 213.6);
  assert.equal(parseFloat(plain.scene.children[0].style.top), 85);
  plain.effects.destroy();
  zoomed.effects.destroy();
});

test('repeated hits cap active particles and clear cancels every outstanding timer', () => {
  const { effects, scene, tree, timers } = fixture();
  for (let index = 0; index < 40; index += 1) {
    assert.ok(effects.playHit({ scene, tree, intensity: 2, speed: 3 }) <= 6);
    assert.ok(scene.children.length <= 24);
    assert.equal(timers.size, scene.children.length);
  }
  const lateCallbacks = [...timers.values()].map(timer => timer.callback);
  effects.clear();
  assert.equal(scene.children.length, 0);
  assert.equal(timers.size, 0);
  lateCallbacks.forEach(callback => callback());
  effects.clear();
  assert.equal(scene.children.length, 0);
  effects.destroy();
});

test('reduced motion uses one stationary ink mark, with no falling leaves', () => {
  const { effects, scene, tree, timers } = fixture({ reducedMotion: true });
  assert.equal(effects.playHit({ scene, tree, speed: 3 }), 1);
  assert.match(scene.children[0].className, /cult-effect-reduced/);
  assert.equal(scene.children[0].dataset.effect, 'cut');
  assert.ok([...timers.values()].every(timer => timer.delay <= 200));
  effects.destroy();
});

test('hidden scenes stop effects, destroy releases listeners, and invalid targets are ignored', () => {
  const { effects, scene, tree, document, listeners, timers } = fixture();
  assert.equal(effects.playHit(), 0);
  assert.equal(effects.playHit({ scene }), 0);
  effects.playHit({ scene, tree });
  document.hidden = true;
  listeners.get('visibilitychange')();
  assert.equal(scene.children.length, 0);
  assert.equal(timers.size, 0);
  assert.equal(effects.playHit({ scene, tree }), 0);
  document.hidden = false;
  assert.ok(effects.playHit({ scene, tree }) > 0);
  effects.destroy();
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(effects.playHit({ scene, tree }), 0);
});

test('effect CSS includes randomized delay, native motion fallback, and no click interception', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.match(css, /\.cult-effect\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /animation:\s*ink-leaf-fall\s+var\(--effect-duration\)[^;]+var\(--effect-delay\)/);
  assert.match(css, /\.cult-effect-reduced\s*\{[^}]*animation:\s*ink-hit-still/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.cult-effect-leaf/s);
});

test('the extracted leaf is tiny, traceable, and its source is unchanged', () => {
  const root = path.join(__dirname, '..');
  const trace = JSON.parse(fs.readFileSync(path.join(root, 'assets/images/effects/leaf-ink-source.json'), 'utf8'));
  const png = fs.readFileSync(path.join(root, 'assets/images/effects/leaf-ink.png'));
  const webp = fs.readFileSync(path.join(root, 'assets/runtime/effects/leaf-ink.webp'));
  const crypto = require('node:crypto');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, trace.source))).digest('hex'), trace.source_sha256);
  assert.deepEqual(trace.output_size, [48, 64]);
  assert.equal(png.readUInt32BE(16), 48);
  assert.equal(png.readUInt32BE(20), 64);
  assert.equal(png[25], 6);
  assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
  assert.ok(webp.length < 4096);
});
