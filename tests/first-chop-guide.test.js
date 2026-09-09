const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createController, shouldStart } = require('../first-chop-guide');

function events(surface = {}) {
  const listeners = new Map();
  return Object.assign(surface, {
    listeners,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
  });
}

function fixture({ reduced = false, hidden = false } = {}) {
  const doc = events({ hidden });
  const motion = events({ matches: reduced });
  const host = events({ innerWidth: 390, innerHeight: 844, document: doc, matchMedia: () => motion });
  host.visualViewport = events({ width: 390, height: 844, offsetLeft: 0, offsetTop: 0 });
  let serial = 0, now = 0;
  const frames = new Map(), timers = new Map(), observers = [];
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map(); this.style = {};
      this.dataset = {}; this.isConnected = false; this.disabled = false; this.classes = new Set();
      this.classList = {
        add: (...values) => values.forEach(value => this.classes.add(value)),
        remove: (...values) => values.forEach(value => this.classes.delete(value)),
        contains: value => this.classes.has(value),
        toggle: (value, enabled) => enabled ? this.classes.add(value) : this.classes.delete(value),
      };
      this.rect = { left: 0, top: 0, width: 20, height: 20 };
    }
    get className() { return [...this.classes].join(' '); }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    appendChild(child) { child.parent = this; this.children.push(child); child.connect(this.isConnected); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    connect(connected) { this.isConnected = connected; this.children.forEach(child => child.connect(connected)); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.connect(false); }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    querySelector(selector) {
      if (selector === '.chop-axe-icon img') return this.querySelector('.chop-axe-icon')?.descendants().find(child => child.tagName === 'IMG');
      if (selector.startsWith('button:not')) return this.descendants().find(child => child.tagName === 'BUTTON' && !child.disabled);
      return this.descendants().find(child => selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tagName === selector.toUpperCase()) || null;
    }
    getBoundingClientRect() {
      const rect = { ...this.rect };
      if (this.classList.contains('first-chop-guide-bubble')) rect.height = 88;
      for (const key of ['left', 'top', 'width', 'height']) if (this.style[key] !== undefined) rect[key] = parseFloat(this.style[key]);
      return { ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height };
    }
    focus() { doc.activeElement = this; dispatch('focusin', this); }
  }
  doc.createElement = tag => new Element(tag);
  doc.documentElement = new Element('html'); doc.documentElement.connect(true);
  doc.body = doc.documentElement.appendChild(new Element('body'));
  doc.querySelectorAll = selector => doc.body.descendants().filter(node => node.classList.contains(selector.slice(1)));
  const previous = doc.body.appendChild(new Element('button')); previous.id = 'previous'; doc.activeElement = previous;
  const outside = doc.body.appendChild(new Element('button')); outside.id = 'outside';
  function makeButton() {
    const button = doc.body.appendChild(new Element('button')); button.id = 'chop-btn';
    button.rect = { left: 152, top: 718, width: 86, height: 86 };
    button.setAttribute('aria-describedby', 'existing-description');
    button.onclick = () => { state.inlineCalls++; };
    const axe = button.appendChild(new Element('span')); axe.className = 'chop-axe-icon';
    axe.rect = { left: 149, top: 699, width: 92, height: 97 };
    const image = axe.appendChild(new Element('img')); image.rect = { ...axe.rect };
    return button;
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.observed = new Set(); observers.push(this); }
    observe(node) { this.observed.add(node); }
    disconnect() { this.observed.clear(); }
  }
  const controller = createController({ document: doc, window: host, ResizeObserver,
    requestAnimationFrame(callback) { const id = ++serial; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); } });
  const state = { inlineCalls: 0, calls: 0, current: true, result: false };
  state.button = makeButton();
  function dispatch(type, target = state.button, extra = {}) {
    const event = { type, target, button: 0, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; }, ...extra };
    for (const surface of [host, doc]) {
      for (const fn of surface.listeners.get(type) || []) { fn(event); if (event.stopped) break; }
      if (event.stopped) break;
    }
    if (!event.stopped && type === 'click') target.onclick?.();
    return event;
  }
  function frame(count = 1) {
    for (let step = 0; step < count; step++) { const tasks = [...frames.values()]; frames.clear(); tasks.forEach(callback => callback()); }
  }
  function advance(ms) {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  }
  function start(onChop = () => { state.calls++; return state.result; }) {
    return controller.start({ getTarget: () => state.button, onChop, isCurrent: () => state.current });
  }
  const guide = () => doc.body.querySelector('.first-chop-guide');
  return { controller, doc, host, motion, state, previous, outside, makeButton, dispatch, frame, advance,
    frames, timers, observers, start, guide };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('only a live player with known zero cloud progress starts automatically', () => {
  assert.equal(shouldStart({ role: 'player', environment: 'live', totalChops: 0 }), true);
  assert.equal(shouldStart({ role: 'player', environment: 'live', totalChops: '0' }), true);
  for (const role of ['admin', 'gm', undefined]) assert.equal(shouldStart({ role, environment: 'live', totalChops: 0 }), false);
  for (const environment of ['test', undefined]) assert.equal(shouldStart({ role: 'player', environment, totalChops: 0 }), false);
  for (const totalChops of [1, -1, undefined, null, '', ' ', false, NaN, Infinity, 'bad']) {
    assert.equal(shouldStart({ role: 'player', environment: 'live', totalChops }), false);
  }
});

test('spotlight waits for layout then shows the paper after 300ms; target stays real and described', () => {
  const f = fixture(), originalClick = f.state.button.onclick;
  assert.equal(f.start(), true);
  assert.equal(f.start(), false);
  assert.equal(f.controller.isActive(), true);
  assert.equal(f.guide().classList.contains('is-visible'), false);
  f.frame(2);
  assert.equal(f.guide().dataset.phase, 'spotlight');
  f.advance(299); assert.equal(f.guide().classList.contains('is-ready'), false);
  f.advance(1); assert.equal(f.guide().dataset.phase, 'ready');
  assert.equal(f.doc.activeElement, f.state.button);
  assert.equal(f.state.button.onclick, originalClick);
  assert.equal(f.guide().descendants().some(node => node.tagName === 'BUTTON'), false);
  assert.match(f.state.button.getAttribute('aria-describedby'), /existing-description.*first-chop-guide-title/);
});

test('other controls, scrolling, Escape and keyboard focus cannot bypass the guide', () => {
  const f = fixture(); f.start(); f.frame(2); f.advance(300);
  for (const type of ['click', 'pointerdown', 'touchstart', 'touchmove', 'wheel', 'contextmenu', 'submit', 'change']) {
    assert.equal(f.dispatch(type, f.outside).defaultPrevented, true, type);
  }
  for (const key of ['Escape', 'ArrowDown', 'PageDown', 'Tab']) assert.equal(f.dispatch('keydown', f.state.button, { key }).defaultPrevented, true);
  f.outside.focus(); assert.equal(f.doc.activeElement, f.state.button);
  assert.equal(f.dispatch('pointerdown').defaultPrevented, false, 'real button keeps native press feedback');
  assert.equal(f.dispatch('touchmove').defaultPrevented, true);
  assert.equal(f.state.calls, 0);
});

test('one real target click submits once, suppresses inline onclick, and keeps guards while transparent/pending', async () => {
  const f = fixture(), pending = deferred();
  f.start(() => { f.state.calls++; return pending.promise; }); f.frame(2); f.advance(300);
  const axeImage = f.state.button.querySelector('.chop-axe-icon img');
  for (let i = 0; i < 8; i++) f.dispatch('click', axeImage);
  await settle();
  assert.equal(f.state.calls, 1); assert.equal(f.state.inlineCalls, 0);
  assert.equal(f.controller.isActive(), true);
  assert.equal(f.guide().classList.contains('is-pending'), true);
  assert.equal(f.dispatch('pointerdown').defaultPrevented, true);
  assert.equal(f.dispatch('wheel', f.outside).defaultPrevented, true);
  pending.resolve(true); await settle();
  assert.equal(f.controller.isActive(), false); assert.equal(f.guide(), null);
  assert.equal(f.doc.activeElement, f.previous);
  f.dispatch('click'); assert.equal(f.state.inlineCalls, 1);
});

test('keyboard Enter and Space use one guarded chop instead of a synthetic duplicate click', async () => {
  for (const key of ['Enter', ' ']) {
    const f = fixture(), pending = deferred();
    f.start(() => { f.state.calls++; return pending.promise; }); f.frame(2);
    f.dispatch('keydown', f.state.button, { key });
    f.dispatch('keydown', f.state.button, { key, repeat: true });
    f.dispatch('keyup', f.state.button, { key });
    f.dispatch('click'); await settle();
    assert.equal(f.state.calls, 1); assert.equal(f.state.inlineCalls, 0);
    pending.resolve(true); await settle();
  }
});

test('failed or throwing requests reacquire a redrawn target and allow a successful retry', async () => {
  for (const throws of [false, true]) {
    const f = fixture(); let attempt = 0;
    const old = f.state.button;
    f.start(() => {
      attempt++;
      if (attempt === 1) {
        old.remove(); f.state.button = f.makeButton();
        if (throws) throw new Error('fixture failure');
        return false;
      }
      return true;
    });
    f.frame(2); f.dispatch('click'); await settle(); f.frame(2); f.advance(300);
    assert.equal(f.guide().dataset.phase, 'ready');
    assert.equal(f.doc.activeElement, f.state.button);
    assert.equal(old.getAttribute('aria-describedby'), 'existing-description');
    f.dispatch('click'); await settle();
    assert.equal(attempt, 2); assert.equal(f.controller.isActive(), false);
  }
});

test('failure with a missing/disabled replacement releases the page instead of trapping the player', async () => {
  for (const disabled of [false, true]) {
    const f = fixture();
    f.start(() => { f.state.button.remove(); f.state.button = disabled ? f.makeButton() : null;
      if (disabled) f.state.button.disabled = true; return false; });
    f.frame(2); f.dispatch('click'); await settle();
    assert.equal(f.controller.isActive(), false);
    assert.equal(f.doc.documentElement.classList.contains('first-chop-guide-open'), false);
  }
});

test('destroy invalidates late promises, cleans listeners/frames/attributes, and allows another start', async () => {
  const f = fixture(), first = deferred(), second = deferred();
  f.start(() => first.promise); f.frame(2); f.dispatch('click'); await settle();
  f.controller.destroy(); f.controller.destroy();
  assert.equal(f.state.button.getAttribute('aria-describedby'), 'existing-description');
  assert.equal(f.state.button.classList.contains('first-chop-guide-target'), false);
  for (const surface of [f.host, f.doc, f.motion, f.host.visualViewport]) {
    assert.ok([...surface.listeners.values()].every(callbacks => callbacks.size === 0));
  }
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  assert.ok(f.observers.every(observer => observer.observed.size === 0));
  f.start(() => second.promise); f.frame(2); const next = f.guide();
  first.resolve(true); await settle();
  assert.equal(f.guide(), next); assert.equal(f.controller.isActive(), true);
  f.controller.destroy();
});

test('account/route invalidation discards a late failure and never creates a new bubble', async () => {
  const f = fixture(), pending = deferred();
  f.start(() => pending.promise); f.frame(2); f.dispatch('click'); await settle();
  f.state.current = false; pending.resolve(false); await settle(); f.frame(3); f.advance(500);
  assert.equal(f.controller.isActive(), false); assert.equal(f.guide(), null);
});

test('circular hole contains the full axe/button union and follows resize/orientation/visual viewport', () => {
  const f = fixture(); f.start(); f.frame(2);
  function containsUnion() {
    const rect = f.guide().querySelector('.first-chop-guide-hole').getBoundingClientRect();
    assert.ok(Math.abs(rect.width - rect.height) < .000001);
    const radius = rect.width / 2, center = [rect.left + radius, rect.top + radius];
    for (const node of [f.state.button, f.state.button.querySelector('.chop-axe-icon')]) {
      const box = node.getBoundingClientRect();
      for (const x of [box.left, box.right]) for (const y of [box.top, box.bottom]) {
        assert.ok(Math.hypot(x - center[0], y - center[1]) <= radius - 9.9);
      }
    }
    const paper = f.guide().querySelector('.first-chop-guide-bubble').getBoundingClientRect();
    assert.ok(paper.left >= f.host.visualViewport.offsetLeft + 12);
    assert.ok(paper.right <= f.host.visualViewport.offsetLeft + f.host.visualViewport.width - 12);
    assert.ok(paper.top >= f.host.visualViewport.offsetTop + 17);
    return rect;
  }
  const initial = containsUnion();
  f.state.button.rect.left += 200;
  f.state.button.querySelector('.chop-axe-icon').rect.left += 200;
  f.state.button.querySelector('.chop-axe-icon img').rect.left += 200;
  f.host.visualViewport.width = 844;
  f.dispatch('orientationchange', f.host); f.frame();
  assert.ok(containsUnion().left > initial.left + 190);
  f.host.visualViewport.offsetLeft = 25;
  for (const callback of f.host.visualViewport.listeners.get('resize')) callback();
  f.frame(); containsUnion();
  f.controller.destroy();
});

test('document and native background states pause jointly; reduced motion presents a stable guide', () => {
  const f = fixture(); f.start(); f.frame(2); f.advance(300);
  f.controller.setBackgrounded(true);
  assert.equal(f.guide().classList.contains('is-paused'), true);
  f.doc.hidden = true; f.dispatch('visibilitychange', f.doc);
  f.controller.setBackgrounded(false);
  assert.equal(f.guide().classList.contains('is-paused'), true);
  f.doc.hidden = false; f.dispatch('visibilitychange', f.doc);
  assert.equal(f.guide().classList.contains('is-paused'), false);
  f.motion.matches = true; for (const callback of f.motion.listeners.get('change')) callback();
  assert.equal(f.guide().classList.contains('is-reduced'), true);
  assert.equal(f.guide().dataset.phase, 'ready');
  const background = fixture({ reduced: true }); background.controller.setBackgrounded(true); background.start();
  assert.equal(background.guide().classList.contains('is-paused'), true);
  assert.equal(background.frames.size, 0);
  background.controller.setBackgrounded(false); background.frame(2);
  assert.equal(background.guide().dataset.phase, 'ready');
});

test('successful result keeps focus inside the actual reward modal rather than hidden login/old controls', async () => {
  const f = fixture(); let close;
  f.start(() => {
    const modal = f.doc.body.appendChild(f.doc.createElement('div')); modal.className = 'modal-overlay';
    modal.rect = { left: 10, top: 10, width: 300, height: 400 };
    close = modal.appendChild(f.doc.createElement('button'));
    close.focus();
    return true;
  });
  f.frame(2); f.dispatch('click'); await settle();
  assert.equal(f.doc.activeElement, close); assert.equal(f.controller.isActive(), false);
});

test('a request that fails while backgrounded restores the guide when the app becomes visible again', async () => {
  const f = fixture(), pending = deferred();
  f.start(() => pending.promise); f.frame(2); f.advance(300); f.dispatch('click'); await settle();
  f.controller.setBackgrounded(true); pending.resolve(false); await settle();
  assert.equal(f.controller.isActive(), true);
  assert.equal(f.guide().dataset.phase, 'preparing');
  assert.equal(f.guide().classList.contains('is-pending'), false);
  assert.equal(f.frames.size, 0);
  f.controller.setBackgrounded(false); f.frame(2); f.advance(300);
  assert.equal(f.guide().dataset.phase, 'ready');
  assert.equal(f.guide().classList.contains('is-visible'), true);
});

test('styles reuse the preloaded paper, preserve focus, and keep gentle float independent of the circular hole', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'first-chop-guide.css'), 'utf8');
  assert.match(css, /assets\/runtime\/v5\/ui\/task-paper\.webp/);
  assert.match(css, /first-chop-guide-float 2\.6s/);
  assert.match(css, /translateY\(-5px\)/);
  assert.match(css, /transition:\s*opacity 300ms/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation-play-state:\s*paused/);
  assert.match(css, /first-chop-guide-target:focus-visible/);
  assert.match(css, /border-radius:\s*50%/);
  assert.match(css, /\.guide-replay-button\s*\{[^}]*min-height:\s*44px/s);
});
