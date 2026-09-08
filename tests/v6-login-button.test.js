const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create } = require('../login-art');

function element(values = {}) {
  const events = new Map();
  const classes = new Set();
  return Object.assign({
    style: {}, disabled: false,
    classList: {
      add(name) { classes.add(name); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, listener) {
      if (!events.has(type)) events.set(type, new Set());
      events.get(type).add(listener);
    },
    removeEventListener(type, listener) { events.get(type)?.delete(listener); },
    emit(type) { for (const listener of events.get(type) || []) listener(); },
    listenerCount() { return [...events.values()].reduce((sum, listeners) => sum + listeners.size, 0); },
  }, values);
}

function fixture({ brushReady = false, letteringReady = false } = {}) {
  const brush = element({ complete: brushReady, naturalWidth: brushReady ? 960 : 0 });
  const lettering = element({ complete: letteringReady, naturalWidth: letteringReady ? 768 : 0 });
  const button = element();
  const screen = element();
  const form = element();
  const elements = { 'login-submit-brush': brush, 'login-submit-lettering': lettering,
    'login-submit': button, 'login-screen': screen, 'login-form-panel': form };
  const document = element({ hidden: false, getElementById: id => elements[id] || null });
  const controller = create({ document, window: {}, requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {}, now: () => 0 });
  controller.init();
  return { controller, brush, lettering, button, form,
    load(image) { image.complete = true; image.naturalWidth = 512; image.emit('load'); },
    fail(image) { image.complete = true; image.naturalWidth = 0; image.emit('error'); },
  };
}

test('login button uses supplied layers only after both images are ready', () => {
  const state = fixture();
  assert.equal(state.button.classList.contains('login-submit-art-ready'), false);
  assert.equal(state.button.disabled, false);
  state.load(state.brush);
  assert.equal(state.button.classList.contains('login-submit-art-ready'), false);
  state.load(state.lettering);
  assert.equal(state.button.classList.contains('login-submit-art-ready'), true);
  state.controller.destroy();
});

test('cached artwork is used immediately and any later failure restores readable fallback', () => {
  const state = fixture({ brushReady: true, letteringReady: true });
  assert.equal(state.button.classList.contains('login-submit-art-ready'), true);
  state.fail(state.lettering);
  assert.equal(state.button.classList.contains('login-submit-art-ready'), false);
  assert.equal(state.button.disabled, false);
  state.load(state.lettering);
  assert.equal(state.button.classList.contains('login-submit-art-ready'), true);
  state.controller.destroy();
});

test('loading or authentication failure never overwrites native button artwork', () => {
  const state = fixture({ brushReady: true, letteringReady: true });
  state.controller.setLoading(true, 40);
  state.controller.setVisible(false);
  state.controller.setVisible(true);
  state.controller.setLoading(false);
  assert.equal(state.button.classList.contains('login-submit-art-ready'), true);
  assert.equal(state.button.disabled, false);
  state.controller.destroy();
});

test('destroy removes image listeners and late image completion cannot change readiness', () => {
  const state = fixture();
  assert.ok(state.brush.listenerCount() > 0);
  state.controller.destroy();
  assert.equal(state.brush.listenerCount(), 0);
  assert.equal(state.lettering.listenerCount(), 0);
  state.load(state.brush);
  state.load(state.lettering);
  assert.equal(state.button.classList.contains('login-submit-art-ready'), false);
});

test('button CSS preserves space, complete lettering, guarded glow and motion fallback', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'login-art.css'), 'utf8');
  assert.match(css, /\.login-submit\s*\{[^}]*height:\s*70px/s);
  assert.match(css, /\.login-submit\s*\{[^}]*height:\s*64px/s);
  assert.match(css, /\.login-submit-lettering\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.login-submit-lettering\s*\{[^}]*transition:\s*filter\s+180ms/s);
  assert.match(css, /\.login-submit:hover:not\(:disabled\)\s+\.login-submit-lettering/);
  assert.match(css, /\.login-submit:focus-visible:not\(:disabled\)\s+\.login-submit-lettering/);
  assert.match(css, /\.login-submit:active:not\(:disabled\)\s*\{[^}]*scale\(\.98\)/s);
  assert.match(css, /\.login-submit-art-ready\s+\.login-submit-fallback\s*\{[^}]*visibility:\s*hidden/s);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /border-image:\s*url\('assets\/runtime\/v3\/ui\/button-primary/);
  assert.doesNotMatch(css, /#login-button-ink\s*\{[^}]*border-radius:\s*50%/s);
});
