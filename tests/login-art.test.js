const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create, getImageAssets } = require('../login-art');

function eventTarget(values = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    emit(type, event = {}) { for (const listener of listeners.get(type) || []) listener(event); },
  }, values);
}

function element() {
  const classes = new Set();
  const animations = [];
  return eventTarget({
    style: {}, hidden: false, textContent: '', attrs: {}, animations,
    classList: {
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    animate(keyframes, options) {
      const animation = { keyframes, options, state: 'running',
        play() { this.state = 'running'; }, pause() { this.state = 'paused'; }, cancel() { this.state = 'cancelled'; } };
      animations.push(animation);
      return animation;
    },
  });
}

function setup({ cached = false, reduced = false, contextAvailable = true, texturesReady = true, backdropReady = true, width = 960, height = 720, prepared = null } = {}) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const logo = get('login-brand-image');
  logo.complete = cached;
  logo.naturalWidth = cached ? 949 : 0;
  const fallback = get('login-brand-fallback');
  fallback.hidden = true;
  const inkCalls = [];
  const context = { clearRect: (...args) => inkCalls.push(['clear', ...args]),
    setTransform: (...args) => inkCalls.push(['transform', ...args]),
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo: (...args) => inkCalls.push(['move', ...args]),
    lineTo: (...args) => inkCalls.push(['line', ...args]),
    rect: (...args) => inkCalls.push(['rect', ...args]),
    clip: (...args) => inkCalls.push(['clip', ...args]),
    translate: (...args) => inkCalls.push(['translate', ...args]),
    rotate: (...args) => inkCalls.push(['rotate', ...args]),
    scale: (...args) => inkCalls.push(['scale', ...args]),
    drawImage(image, ...args) { inkCalls.push(['image', image.src || 'logo', this.globalAlpha, this.globalCompositeOperation, ...args]); },
  };
  let bounds = { left: 0, top: 0, width, height };
  get('login-screen').getBoundingClientRect = () => bounds;
  get('login-loading-track').style.setProperty = function (name, value) { this[name] = value; };
  Object.assign(get('login-ink-canvas'), { width: 960, height: 720, getContext: () => contextAvailable ? context : null });
  const doc = eventTarget({ hidden: false, getElementById: get });
  const media = eventTarget({ matches: reduced });
  let observe;
  let resize;
  const images = [];
  const host = eventTarget({ devicePixelRatio: 2, Image: class {
    constructor() { images.push(this); }
    set src(value) {
      this.url = value;
      if (value.includes('/backgrounds/') ? backdropReady : texturesReady) {
        this.naturalWidth = this.naturalHeight = 512;
        this.onload?.();
      }
    }
    get src() { return this.url; }
  }, matchMedia: () => media, ResizeObserver: class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() {}
  }, IntersectionObserver: class {
    constructor(callback) { observe = callback; }
    observe() {}
    disconnect() {}
  } });
  let timestamp = 0;
  let nextId = 0;
  const frames = new Map();
  const timers = new Map();
  const controller = create({ document: doc, window: host, prepared,
    now: () => timestamp,
    requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: timestamp + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  controller.init();
  function step(time) {
    timestamp = time;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= time) { timers.delete(id); timer.callback(); }
    }
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(time));
  }
  const shown = () => Number(get('login-loading-bar').style.transform.match(/scaleX\(([^)]+)\)/)[1]) * 100;
  const textureImages = () => images.filter(image => image.src.includes('/effects/'));
  const backdrop = () => images.find(image => image.src.includes('/backgrounds/'));
  return { controller, get, doc, media, logo, fallback, frames, inkCalls, step, shown, images, timers, textureImages, backdrop,
    loadBackdrop() { const image = backdrop(); image.naturalWidth = 1448; image.naturalHeight = 1086; image.onload?.(); },
    loadTexture(index) { const image = textureImages()[index]; image.naturalWidth = image.naturalHeight = 512; image.onload?.(); },
    failTextures() { textureImages().forEach(image => image.onerror?.()); },
    resize(width, height) { bounds = { ...bounds, width, height }; resize(); },
    intersect(value) { observe([{ isIntersecting: value }]); },
    load() { logo.naturalWidth = 949; logo.emit('load'); },
  };
}

test('logo reveal waits for its real bitmap and runs only once without blocking controls', () => {
  const state = setup();
  assert.equal(state.logo.animations.length, 0);
  assert.equal(state.logo.style.visibility, 'hidden');
  assert.notEqual(state.get('login-submit').disabled, true);
  state.load();
  assert.equal(state.logo.style.visibility, 'hidden');
  state.step(499);
  assert.equal(state.logo.animations.length, 0);
  state.step(500);
  assert.equal(state.logo.style.visibility, 'visible');
  assert.equal(state.logo.animations.length, 1);
  assert.equal(state.logo.animations[0].options.duration, 1500);
  state.load();
  state.controller.setVisible(false);
  state.controller.setVisible(true);
  assert.equal(state.logo.animations.length, 1);
});

test('cached backdrop and logo still settle before entrance; failed logo has a readable fallback', () => {
  const cached = setup({ cached: true });
  assert.equal(cached.logo.animations.length, 0);
  cached.step(500);
  assert.equal(cached.logo.animations.length, 1);
  const failed = setup();
  failed.logo.emit('error');
  assert.equal(failed.fallback.hidden, false);
  assert.equal(failed.logo.animations.length, 0);
});

test('boot-prepared artwork reuses decoded textures and only waits the normal entrance settle', () => {
  const images = Object.fromEntries(getImageAssets().map(src => [src, { src, naturalWidth: 512, naturalHeight: 512 }]));
  const state = setup({ cached: true, prepared: { criticalReady: true, images } });
  assert.equal(state.images.length, 0, 'prepared background and ink never initiate another image request');
  assert.equal(state.logo.animations.length, 0);
  state.step(500);
  assert.equal(state.logo.animations[0].options.duration, 1500);
  assert.ok(state.inkCalls.some(call => call[0] === 'image' && call[1].includes('/effects/')));
});

test('simplified prepared mode does not restart failed decorative downloads', () => {
  const state = setup({ cached: true, prepared: { criticalReady: true, simplified: true, images: {} } });
  assert.equal(state.images.length, 0);
  assert.equal(state.frames.size, 0);
  state.step(500);
  assert.equal(state.logo.animations.length, 1);
});

test('logo loaded on a hidden login screen waits and resumes on return', () => {
  const state = setup();
  state.controller.setVisible(false);
  state.load();
  assert.equal(state.logo.animations.length, 0);
  state.controller.setVisible(true);
  assert.equal(state.logo.animations.length, 0);
  state.step(500);
  assert.equal(state.logo.animations.length, 1);
  state.controller.setVisible(false);
  assert.equal(state.logo.animations[0].state, 'paused');
  state.controller.setVisible(true);
  assert.equal(state.logo.animations[0].state, 'running');
});

test('entrance waits for late backdrop readiness and then an uninterrupted 500ms visible settle', () => {
  const state = setup({ cached: true, backdropReady: false });
  state.step(1200);
  assert.equal(state.logo.animations.length, 0);
  assert.equal(state.timers.size, 1, 'only the bounded backdrop deadline is pending');
  assert.notEqual(state.get('login-submit').disabled, true);
  state.loadBackdrop();
  state.step(1699);
  assert.equal(state.logo.animations.length, 0);
  state.step(1700);
  assert.equal(state.logo.animations.length, 1);
});

test('backdrop failure falls back to the existing scene without indefinitely hiding logo', () => {
  const state = setup({ cached: true, backdropReady: false });
  state.backdrop().onerror();
  state.step(500);
  assert.equal(state.logo.style.visibility, 'visible');
  assert.equal(state.logo.animations.length, 1);
});

test('pending backdrop falls back after 2500ms then uses the normal visible settle', () => {
  const state = setup({ cached: true, backdropReady: false });
  state.step(2499);
  assert.equal(state.logo.style.visibility, 'hidden');
  state.step(2500);
  assert.equal(state.logo.animations.length, 0);
  assert.notEqual(state.get('login-submit').disabled, true);
  state.step(2999);
  assert.equal(state.logo.animations.length, 0);
  state.step(3000);
  assert.equal(state.logo.animations.length, 1);
  assert.equal(state.timers.size, 0);
});

test('successful backdrop load cancels its deadline instead of postponing entrance', () => {
  const state = setup({ cached: true, backdropReady: false });
  state.step(100);
  state.loadBackdrop();
  assert.deepEqual([...state.timers.values()].map(timer => timer.at), [600]);
  state.step(600);
  assert.equal(state.logo.animations.length, 1);
  assert.equal(state.timers.size, 0);
  state.step(3000);
  assert.equal(state.logo.animations.length, 1);
});

test('destroy removes a pending backdrop deadline and ignores its late callback', () => {
  const state = setup({ cached: true, backdropReady: false });
  const late = [...state.timers.values()][0].callback;
  state.controller.destroy();
  assert.equal(state.timers.size, 0);
  late();
  state.step(3000);
  assert.equal(state.logo.animations.length, 0);
  assert.equal(state.timers.size, 0);
});

test('hiding during settling cancels the timer and restarts a full visible settling period', () => {
  const state = setup({ cached: true });
  state.step(300);
  state.controller.setVisible(false);
  assert.equal(state.timers.size, 0);
  state.step(1000);
  assert.equal(state.logo.animations.length, 0);
  state.controller.setVisible(true);
  state.step(1499);
  assert.equal(state.logo.animations.length, 0);
  state.step(1500);
  assert.equal(state.logo.animations.length, 1);
});

test('destroy cancels settling and ignores an already queued timer callback', () => {
  const state = setup({ cached: true });
  const late = [...state.timers.values()][0].callback;
  state.controller.destroy();
  assert.equal(state.timers.size, 0);
  late();
  state.step(600);
  assert.equal(state.logo.animations.length, 0);
  assert.equal(state.backdrop().onload, null);
  assert.equal(state.backdrop().onerror, null);
});

test('reduced motion skips both backdrop waiting and settling without delaying controls', () => {
  const state = setup({ cached: true, backdropReady: false });
  state.media.emit('change', { matches: true });
  assert.equal(state.logo.style.visibility, 'visible');
  assert.equal(state.logo.animations.length, 0);
  assert.equal(state.timers.size, 0);
  assert.notEqual(state.get('login-submit').disabled, true);
});

test('restoring motion before logo loads does not strand a cancelled backdrop wait', () => {
  const state = setup({ backdropReady: false });
  state.media.emit('change', { matches: true });
  state.media.emit('change', { matches: false });
  state.load();
  state.step(500);
  assert.equal(state.logo.animations.length, 1);
});

test('progress interpolates actual progress, stays bounded and resets for a new attempt', () => {
  const state = setup();
  state.controller.setLoading(true, 80);
  assert.equal(state.shown(), 0);
  state.step(110);
  assert.ok(state.shown() > 0 && state.shown() < 80);
  const mid = state.shown();
  state.controller.setLoading(true, 40);
  assert.equal(state.shown(), mid);
  state.step(330);
  assert.equal(state.shown(), 80);
  assert.equal(state.get('login-loading-track').attrs['aria-valuenow'], '80');
  state.controller.setLoading(true, 500);
  state.step(550);
  assert.equal(state.shown(), 100);
  state.controller.setLoading(false);
  assert.equal(state.shown(), 0);
  state.controller.setLoading(true, 20);
  state.step(770);
  assert.equal(state.shown(), 20);
});

test('no invented progress accumulates while the real loader is stalled', () => {
  const state = setup();
  state.controller.setLoading(true, 25);
  state.step(500);
  state.step(8000);
  assert.equal(state.shown(), 25);
  assert.equal(state.get('login-loading-percent').textContent, '25%');
});

test('duplicate progress notifications do not postpone an already running tween', () => {
  const state = setup();
  state.controller.setLoading(true, 80);
  state.step(100);
  state.controller.setLoading(true, 80);
  state.step(180);
  state.controller.setLoading(true, 80);
  state.step(220);
  assert.equal(state.shown(), 80);
});

test('offscreen, document hiding and explicit hiding cancel all scheduled drawing', () => {
  const state = setup({ cached: true });
  state.step(40);
  assert.ok(state.inkCalls.some(call => call[0] === 'image'));
  state.intersect(false);
  assert.equal(state.frames.size, 0);
  assert.equal(state.timers.size, 0);
  state.intersect(true);
  assert.equal(state.frames.size, 1);
  assert.equal(state.timers.size, 1);
  state.doc.hidden = true;
  state.doc.emit('visibilitychange');
  assert.equal(state.frames.size, 0);
  assert.equal(state.timers.size, 0);
  state.doc.hidden = false;
  state.doc.emit('visibilitychange');
  assert.equal(state.frames.size, 1);
  state.controller.setVisible(false);
  assert.equal(state.frames.size, 0);
  state.controller.setLoading(true, 55);
  assert.ok(Math.abs(state.shown() - 55) < 0.0001);
  assert.equal(state.frames.size, 0);
});

test('reduced motion renders static logo and actual progress with no animation loop', () => {
  const state = setup({ reduced: true, cached: true });
  assert.equal(state.logo.animations.length, 0);
  assert.equal(state.logo.style.visibility, 'visible');
  assert.equal(state.frames.size, 0);
  state.controller.setLoading(true, 45);
  assert.equal(state.shown(), 45);
  state.get('login-submit').emit('pointerdown', { button: 0 });
  assert.equal(state.get('login-button-ink').animations.length, 0);
});

test('changing reduced-motion preference cancels running effects and can restore ambient motion', () => {
  const state = setup({ cached: true });
  state.step(500);
  state.media.emit('change', { matches: true });
  assert.equal(state.frames.size, 0);
  assert.equal(state.logo.animations[0].state, 'cancelled');
  state.media.emit('change', { matches: false });
  assert.equal(state.frames.size, 1);
  assert.equal(state.logo.animations.length, 2);
  assert.equal(state.logo.animations[1].options.iterations, Infinity);
});

test('logo floats only after the entrance, and float pauses or cancels with lifecycle', () => {
  const state = setup({ cached: true });
  state.step(500);
  const reveal = state.logo.animations[0];
  assert.equal(state.logo.animations.length, 1);
  reveal.onfinish();
  const floating = state.logo.animations[1];
  assert.equal(reveal.state, 'cancelled');
  assert.equal(floating.options.iterations, Infinity);
  assert.equal(floating.options.duration, 6400);
  assert.ok(floating.keyframes.some(keyframe => keyframe.transform === 'translateY(-10px)'));
  assert.ok(floating.keyframes.every(keyframe => !/scale|rotate/.test(keyframe.transform)));
  state.controller.setVisible(false);
  assert.equal(floating.state, 'paused');
  state.controller.setVisible(true);
  assert.equal(floating.state, 'running');
  state.controller.destroy();
  assert.equal(floating.state, 'cancelled');
});

test('optional ink assets use exact versioned URLs and mobile backing stays bounded', () => {
  assert.equal(getImageAssets().length, 6);
  assert.ok(getImageAssets().every(url => /assets\/runtime\/v5\/effects\/ink-0[1-6]\.webp\?v=xianlai-v5-20260908$/.test(url)));
  const state = setup({ width: 1448, height: 1086 });
  state.step(40);
  assert.deepEqual(state.textureImages().map(image => image.src), getImageAssets());
  state.inkCalls.length = 0;
  state.resize(390, 844);
  state.step(120);
  assert.equal(state.get('login-ink-canvas').width, 390);
  assert.equal(state.get('login-ink-canvas').height, 844);
  assert.equal(state.textureImages().length, 6, 'resize does not reload decorations');
});

test('ink textures deform locally and keep moving after reveal with bounded drawing', () => {
  const state = setup({ cached: true });
  state.step(500);
  state.logo.animations[0].onfinish();
  state.inkCalls.length = 0;
  state.step(5000);
  const first = state.inkCalls.filter(call => call[0] === 'image' && call[1] !== 'logo');
  assert.ok(first.length > 8 && first.length < 100);
  assert.ok(first.some(call => call.length > 10), 'source strips, not a uniformly rotated full-image sticker');
  state.inkCalls.length = 0;
  state.step(6000);
  const second = state.inkCalls.filter(call => call[0] === 'image' && call[1] !== 'logo');
  assert.notDeepEqual(second, first);
  assert.equal(state.frames.size, 1);
  const source = fs.readFileSync(path.join(__dirname, '..', 'login-art.js'), 'utf8');
  assert.doesNotMatch(source, /visibleLakeSegments|context\.ellipse\(|context\.stroke\(/);
});

test('mobile ink excludes the entire stable form area', () => {
  const state = setup({ width: 360, height: 640 });
  state.get('login-form-panel').parentElement = {
    getBoundingClientRect: () => ({ left: 24, top: 340, width: 312, height: 230 }),
  };
  state.step(1000);
  assert.ok(state.inkCalls.some(call => call[0] === 'rect' && call[1] === 12 && call[2] === 328
    && call[3] === 336 && call[4] === 254));
  assert.ok(state.inkCalls.some(call => call[0] === 'clip' && call[1] === 'evenodd'));
  assert.ok(state.inkCalls.filter(call => call[0] === 'image').length < 70);
});

test('loaded logo silhouette is protected and stable layout avoids canvas resizing each frame', () => {
  const state = setup({ cached: true, width: 390, height: 844 });
  state.step(0);
  assert.ok(state.inkCalls.some(call => call[0] === 'image' && call[1] === 'logo' && call[3] === 'destination-out'));
  state.inkCalls.length = 0;
  state.step(100);
  assert.ok(!state.inkCalls.some(call => call[0] === 'transform'), 'stable layout does not resize canvas each frame');
});

test('mobile ink rendering is capped below desktop frame rate', () => {
  const state = setup({ width: 390, height: 844 });
  state.step(0);
  state.inkCalls.length = 0;
  state.step(40);
  assert.equal(state.inkCalls.length, 0);
  state.step(55);
  assert.ok(state.inkCalls.some(call => call[0] === 'image'));
});

test('failed or pending optional textures never create an empty endless animation loop', () => {
  const state = setup({ texturesReady: false });
  assert.equal(state.frames.size, 0);
  state.failTextures();
  assert.equal(state.frames.size, 0);
  state.controller.setLoading(true, 60);
  state.step(220);
  assert.equal(state.shown(), 60);
  assert.equal(state.frames.size, 0);
});

test('late image callbacks cannot restart a hidden or destroyed login controller', () => {
  const hidden = setup({ texturesReady: false });
  hidden.controller.setVisible(false);
  hidden.loadTexture(0);
  assert.equal(hidden.frames.size, 0);
  hidden.controller.setVisible(true);
  assert.equal(hidden.frames.size, 1);
  const destroyed = setup({ texturesReady: false });
  const late = destroyed.textureImages()[0].onload;
  destroyed.controller.destroy();
  late();
  assert.equal(destroyed.frames.size, 0);
  assert.ok(destroyed.images.every(image => !image.onload && !image.onerror));
});

test('loading keeps its ink edge tied to real progress and places status on one baseline', () => {
  const state = setup({ reduced: true });
  state.controller.setLoading(true, 45);
  assert.equal(state.get('login-loading-track').style['--login-progress'], '45%');
  const css = fs.readFileSync(path.join(__dirname, '..', 'login-art.css'), 'utf8');
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
  assert.match(css, /left:\s*var\(--login-progress/);
  assert.match(css, /login-ink-edge/);
});

test('pointer and submit share one short pulse; keyboard submit also works', () => {
  const state = setup();
  const button = state.get('login-submit');
  const form = state.get('login-form-panel');
  const ripple = state.get('login-button-ink');
  button.emit('pointerdown', { button: 0 });
  form.emit('submit');
  assert.equal(ripple.animations.length, 1);
  assert.equal(ripple.animations[0].options.duration, 420);
  state.step(300);
  form.emit('submit');
  assert.equal(ripple.animations.length, 2);
  assert.equal(ripple.animations[0].state, 'cancelled');
  state.controller.setVisible(false);
  assert.equal(ripple.animations[1].state, 'cancelled');
});

test('touch gives the lettering a 250ms glow without preventing or delaying native submit', () => {
  const state = setup();
  const button = state.get('login-submit');
  let prevented = false;
  button.emit('pointerdown', { button: 0, pointerType: 'touch', preventDefault() { prevented = true; } });
  assert.equal(button.classList.contains('login-submit-touch-glow'), true);
  assert.equal(prevented, false);
  let submitted = 0;
  state.get('login-form-panel').addEventListener('submit', () => { submitted++; });
  state.get('login-form-panel').emit('submit');
  assert.equal(submitted, 1);
  state.step(249);
  assert.equal(button.classList.contains('login-submit-touch-glow'), true);
  state.step(250);
  assert.equal(button.classList.contains('login-submit-touch-glow'), false);
  button.emit('pointerdown', { button: 0, pointerType: 'touch' });
  state.controller.destroy();
  assert.equal(button.classList.contains('login-submit-touch-glow'), false);
});

test('unsupported canvas and Web Animations retain login and progress updates', () => {
  const state = setup({ contextAvailable: false });
  state.logo.animate = undefined;
  state.load();
  assert.equal(state.logo.style.visibility, 'visible');
  assert.equal(state.frames.size, 0);
  state.controller.setLoading(true, 60);
  state.step(220);
  assert.equal(state.shown(), 60);
  assert.equal(state.frames.size, 0);
});

test('destroy removes listeners and cancels pending animation work', () => {
  const state = setup({ cached: true });
  state.controller.destroy();
  assert.equal(state.frames.size, 0);
  state.doc.emit('visibilitychange');
  state.get('login-submit').emit('pointerdown', { button: 0 });
  assert.equal(state.frames.size, 0);
  assert.equal(state.get('login-button-ink').animations.length, 0);
});

test('login artwork preserves the native credential form and responsive layout contracts', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'login-art.css'), 'utf8');
  assert.match(html, /id="login-brand-image"[^>]+src="assets\/runtime\/v3\/ui\/logo.webp"/);
  assert.match(html, /name="username"[^>]+autocomplete="username"/);
  assert.match(html, /name="password"[^>]+autocomplete="current-password"/);
  assert.match(html, /onsubmit="event.preventDefault\(\)"/);
  assert.match(css, /backgrounds\/login.webp/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /grid-template-rows:/);
  assert.match(css, /max-height: 620px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /blur\(/);
});
