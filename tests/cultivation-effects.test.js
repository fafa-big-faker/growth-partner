const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCultivationEffects } = require('../cultivation-effects');
const effectsSource = fs.readFileSync(path.join(__dirname, '..', 'cultivation-effects.js'), 'utf8');

function fixture(options = {}) {
  const { environment, ...effectOptions } = options;
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
    dataset: {},
    isConnected: true,
    getBoundingClientRect() { return { left: 190, top: 60, width: 80, height: 100 }; },
    querySelector() { return image; },
  };
  let createEffects = createCultivationEffects;
  if (environment) {
    const sandbox = { module: { exports: {} }, clearTimeout, ...environment };
    vm.runInNewContext(effectsSource, sandbox);
    sandbox.CultivationEffects.destroy();
    createEffects = sandbox.module.exports.createCultivationEffects;
  }
  const effects = createEffects({
    document,
    random: () => 0.5,
    schedule(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    cancelSchedule(id) { timers.delete(id); },
    ...effectOptions,
  });
  return { document, scene, tree, image, effects, listeners, timers };
}

function fittingFixture() {
  const observers = [];
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.disconnected = true; }
    notify() { this.callback(this.targets.map(target => ({ target }))); }
  }
  const state = fixture({ environment: { ResizeObserver, getComputedStyle: tree => ({ bottom: tree.bottom || '12px' }) } });
  const createStage = () => ({
    style: {
      transform: '',
      removed: [],
      removeProperty(name) { this.removed.push(name); delete this[name]; },
    },
  });
  const stage = createStage();
  state.scene.clientHeight = 160;
  state.scene.querySelector = selector => selector === '.mobile-scene-stage' ? stage : null;
  state.tree.offsetHeight = 216;
  state.tree.style = { left: '-103px', bottom: '12px' };
  state.tree.closest = selector => selector === '.cult-scene' ? state.scene : null;
  const getScale = () => Number(stage.style.transform.match(/^scale\(([\d.]+)\)$/)?.[1]);
  return { ...state, stage, observers, createStage, getScale };
}

test('scene fitting reserves every skin equally and rescales the shared stage when height changes', () => {
  const { effects, tree, scene, stage, observers, getScale } = fittingFixture();
  const originalTreeStyle = { ...tree.style };
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets/runtime/wish-trees/manifest.json'), 'utf8'));
  let firstScale;
  for (const key of ['tree_01', 'tree_02', 'tree_03', 'tree_04', 'tree_05']) {
    tree.dataset.crownY = String(manifest[key].anchors.crown[1]);
    tree.skin = key;
    effects.observeTree(tree);
    const scale = getScale();
    assert.ok(scale > .1 && scale < 1, `${key} must fit the short scene`);
    firstScale ??= scale;
    assert.equal(scale, firstScale, 'changing the skin must not change the actor scale');
    assert.deepEqual(observers.at(-1).targets, [scene, tree], 'both scene height and tree breakpoint size must be observed');
    assert.deepEqual(tree.style, originalTreeStyle, 'fitting must transform the common stage, not move the tree alone');
  }
  const latest = observers.at(-1);
  scene.clientHeight = 320;
  latest.notify();
  assert.equal(stage.style.transform, 'scale(1)', 'a tall scene must keep the native actor and tree size');
  scene.clientHeight = 120;
  latest.notify();
  assert.ok(getScale() < firstScale, 'reducing the available scene height must shrink both actors together');
  const narrowScale = getScale();
  tree.offsetHeight = 288;
  latest.notify();
  assert.ok(getScale() < narrowScale, 'a larger tree breakpoint must be fitted without waiting for a scene remount');
  effects.destroy();
});

test('scene fitting disconnects old observers and removes its stage transform on replacement, leave and destroy', () => {
  const { effects, tree, scene, stage, observers, createStage } = fittingFixture();
  effects.observeTree(tree);
  const firstObserver = observers.at(-1);
  assert.match(stage.style.transform, /^scale\(/);

  const nextStage = createStage();
  const nextScene = { clientHeight: 140, querySelector: () => nextStage };
  const nextTree = { dataset: {}, offsetHeight: 216, isConnected: true, closest: () => nextScene };
  effects.observeTree(nextTree);
  assert.equal(firstObserver.disconnected, true);
  assert.equal(stage.style.transform, undefined);
  assert.deepEqual(stage.style.removed, ['transform']);
  assert.match(nextStage.style.transform, /^scale\(/);
  firstObserver.notify();
  assert.equal(stage.style.transform, undefined, 'a late old resize must not restore the old stage override');
  const secondObserver = observers.at(-1);
  effects.observeTree(null);
  assert.equal(secondObserver.disconnected, true);
  assert.equal(nextStage.style.transform, undefined);
  assert.deepEqual(nextStage.style.removed, ['transform']);
  secondObserver.notify();
  assert.equal(nextStage.style.transform, undefined, 'late resize after leaving must stay inert');

  effects.observeTree(tree);
  assert.match(stage.style.transform, /^scale\(/);
  assert.ok(observers.at(-1).targets.includes(scene));
  effects.destroy();
  assert.equal(stage.style.transform, undefined);
  assert.ok(observers.every(observer => observer.disconnected));
});

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

test('five wish-tree hit anchors follow the image canvas and retain scaled scene coordinates', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets/runtime/wish-trees/manifest.json'), 'utf8'));
  for (const key of ['tree_01', 'tree_02', 'tree_03', 'tree_04', 'tree_05']) {
    const { strike, crown } = manifest[key].anchors;
    const plain = fixture();
    const zoomed = fixture();
    for (const state of [plain, zoomed]) {
      Object.assign(state.tree.dataset, { strikeX: String(strike[0]), strikeY: String(strike[1]), crownX: String(crown[0]), crownY: String(crown[1]) });
    }
    zoomed.scene.getBoundingClientRect = () => ({ left: 10, top: 20, width: 600, height: 400 });
    zoomed.tree.getBoundingClientRect = () => ({ left: 370, top: 100, width: 160, height: 200 });
    zoomed.image.getBoundingClientRect = () => ({ left: 370, top: 100, width: 160, height: 160 });
    assert.equal(plain.effects.playHit({ scene: plain.scene, tree: plain.tree }), 5);
    assert.equal(zoomed.effects.playHit({ scene: zoomed.scene, tree: zoomed.tree }), 5);
    assert.equal(plain.scene.children[0].style.left, '216.7px', `${key} common trunk strike x`);
    assert.equal(plain.scene.children[0].style.top, '96.7px', `${key} strike must use the sprite, not the label-inclusive tree`);
    for (const leaf of plain.scene.children.slice(1)) {
      assert.equal(leaf.style.left, `${(180 + 80 * crown[0]).toFixed(1)}px`, `${key} crown x`);
      assert.equal(leaf.style.top, `${(40 + 80 * crown[1]).toFixed(1)}px`, `${key} crown y`);
    }
    for (let index = 0; index < 5; index++) {
      assert.equal(zoomed.scene.children[index].style.left, plain.scene.children[index].style.left);
      assert.equal(zoomed.scene.children[index].style.top, plain.scene.children[index].style.top);
    }
    plain.effects.destroy();
    zoomed.effects.destroy();
  }
});

test('tree light pauses when hidden or offscreen and disconnects on replacement, leaving and destroy', () => {
  const observers = [];
  const motionListeners = new Set();
  const motion = {
    matches: false,
    addEventListener(name, callback) { if (name === 'change') motionListeners.add(callback); },
    removeEventListener(name, callback) { if (name === 'change') motionListeners.delete(callback); },
  };
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.target = null; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    notify(visible) { this.callback([{ target: this.target, isIntersecting: visible }]); }
  }
  const { effects, document, tree, listeners } = fixture({ environment: { matchMedia: () => motion, IntersectionObserver } });
  assert.equal(motionListeners.size, 1);
  effects.observeTree(tree);
  assert.equal(tree.dataset.lightActive, 'true');
  const firstObserver = observers.at(-1);
  firstObserver.notify(false);
  assert.equal(tree.dataset.lightActive, 'false');
  document.hidden = true;
  listeners.get('visibilitychange')();
  firstObserver.notify(true);
  assert.equal(tree.dataset.lightActive, 'false', 'onscreen cannot restart a hidden tab');
  document.hidden = false;
  listeners.get('visibilitychange')();
  assert.equal(tree.dataset.lightActive, 'true');
  motion.matches = true;
  motionListeners.forEach(callback => callback());
  assert.equal(tree.dataset.lightActive, 'false', 'reduced motion disables the decorative pulse');
  motion.matches = false;
  motionListeners.forEach(callback => callback());
  assert.equal(tree.dataset.lightActive, 'true');

  const nextTree = { dataset: {}, isConnected: true };
  effects.observeTree(nextTree);
  assert.equal(tree.dataset.lightActive, 'false');
  assert.equal(firstObserver.disconnected, true);
  firstObserver.notify(false);
  assert.equal(nextTree.dataset.lightActive, 'true', 'late old-tree observation must not pause the current tree');
  nextTree.isConnected = false;
  listeners.get('visibilitychange')();
  assert.equal(nextTree.dataset.lightActive, 'false');
  nextTree.isConnected = true;
  effects.observeTree(null);
  assert.equal(nextTree.dataset.lightActive, 'false');
  assert.equal(observers.at(-1).disconnected, true);
  effects.observeTree(tree);
  effects.destroy();
  assert.equal(tree.dataset.lightActive, 'false');
  assert.equal(listeners.size, 0);
  assert.equal(motionListeners.size, 0);
  assert.ok(observers.every(observer => observer.disconnected));
});

test('tree lights still honor visibility and cleanup when intersection observation is unavailable', () => {
  const { effects, tree, document, listeners } = fixture();
  effects.observeTree(tree);
  assert.equal(tree.dataset.lightActive, 'true');
  document.hidden = true;
  listeners.get('visibilitychange')();
  assert.equal(tree.dataset.lightActive, 'false');
  document.hidden = false;
  listeners.get('visibilitychange')();
  assert.equal(tree.dataset.lightActive, 'true');
  effects.observeTree(null);
  assert.equal(tree.dataset.lightActive, 'false');
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

test('tree lights use the shared canvas and only a restrained eight-second opacity pulse', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const layers = css.match(/\.cult-tree \.tree-img,\s*\.cult-tree \.tree-light\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(layers, /position:\s*absolute/);
  assert.match(layers, /inset:\s*0/);
  assert.match(layers, /width:\s*100%/);
  assert.match(layers, /height:\s*100%/);
  assert.match(layers, /pointer-events:\s*none/);
  assert.match(css, /\.cult-tree \.tree-visual\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /animation:\s*wish-tree-light 8s ease-in-out infinite/);
  assert.match(css, /\.cult-tree \.tree-light\s*\{[^}]*animation-play-state:\s*paused/);
  assert.match(css, /\[data-light-active="true"\] \.tree-light\s*\{[^}]*animation-play-state:\s*running/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.cult-tree \.tree-light\s*\{[^}]*animation:\s*none/);
  const pulse = css.match(/@keyframes wish-tree-light\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(pulse);
  assert.doesNotMatch(pulse, /transform|filter|background|box-shadow/);
  const opacityValues = [...pulse.matchAll(/opacity:\s*([\d.]+)/g)].map(match => Number(match[1]));
  assert.ok(opacityValues.length >= 2 && opacityValues.every(value => value >= 0 && value <= .2));
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
