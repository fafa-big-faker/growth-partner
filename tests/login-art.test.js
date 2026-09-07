const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create } = require('../login-art');

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

function setup({ cached = false, reduced = false, contextAvailable = true } = {}) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const logo = get('login-brand-image');
  logo.complete = cached;
  logo.naturalWidth = cached ? 949 : 0;
  const fallback = get('login-brand-fallback');
  fallback.hidden = true;
  const inkCalls = [];
  const context = { clearRect: (...args) => inkCalls.push(['clear', ...args]),
    beginPath() {}, moveTo() {}, bezierCurveTo() {}, stroke: () => inkCalls.push(['stroke']) };
  Object.assign(get('login-ink-canvas'), { width: 960, height: 720, getContext: () => contextAvailable ? context : null });
  const doc = eventTarget({ hidden: false, getElementById: get });
  const media = eventTarget({ matches: reduced });
  let observe;
  const host = { matchMedia: () => media, IntersectionObserver: class {
    constructor(callback) { observe = callback; }
    observe() {}
    disconnect() {}
  } };
  let timestamp = 0;
  let nextId = 0;
  const frames = new Map();
  const controller = create({ document: doc, window: host,
    now: () => timestamp,
    requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  controller.init();
  function step(time) {
    timestamp = time;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(time));
  }
  const shown = () => Number(get('login-loading-bar').style.transform.match(/scaleX\(([^)]+)\)/)[1]) * 100;
  return { controller, get, doc, media, logo, fallback, frames, inkCalls, step, shown,
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
  assert.equal(state.logo.style.visibility, 'visible');
  assert.equal(state.logo.animations.length, 1);
  assert.equal(state.logo.animations[0].options.duration, 1500);
  state.load();
  state.controller.setVisible(false);
  state.controller.setVisible(true);
  assert.equal(state.logo.animations.length, 1);
});

test('cached bitmap reveals immediately; a failed bitmap has a readable fallback', () => {
  const cached = setup({ cached: true });
  assert.equal(cached.logo.animations.length, 1);
  const failed = setup();
  failed.logo.emit('error');
  assert.equal(failed.fallback.hidden, false);
  assert.equal(failed.logo.animations.length, 0);
});

test('logo loaded on a hidden login screen waits and resumes on return', () => {
  const state = setup();
  state.controller.setVisible(false);
  state.load();
  assert.equal(state.logo.animations.length, 0);
  state.controller.setVisible(true);
  assert.equal(state.logo.animations.length, 1);
  state.controller.setVisible(false);
  assert.equal(state.logo.animations[0].state, 'paused');
  state.controller.setVisible(true);
  assert.equal(state.logo.animations[0].state, 'running');
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
  assert.ok(state.inkCalls.some(call => call[0] === 'stroke'));
  state.intersect(false);
  assert.equal(state.frames.size, 0);
  state.intersect(true);
  assert.equal(state.frames.size, 1);
  state.doc.hidden = true;
  state.doc.emit('visibilitychange');
  assert.equal(state.frames.size, 0);
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
  state.media.emit('change', { matches: true });
  assert.equal(state.frames.size, 0);
  assert.equal(state.logo.animations[0].state, 'cancelled');
  state.media.emit('change', { matches: false });
  assert.equal(state.frames.size, 1);
  assert.equal(state.logo.animations.length, 1);
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
