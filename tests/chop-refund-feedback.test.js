const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../chop-refund-feedback');

function events(values = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    emit(name, value = {}) { for (const callback of listeners.get(name) || []) callback(value); },
    listenerCount() { return [...listeners.values()].reduce((total, set) => total + set.size, 0); },
  }, values);
}

function element() {
  const classes = new Set();
  return events({
    children: [], isConnected: false, attrs: {}, textContent: '',
    style: { setProperty(name, value) { this[name] = value; } },
    classList: { add(name) { classes.add(name); }, contains(name) { return classes.has(name); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
    setAttribute(name, value) { this.attrs[name] = value; },
    append(...children) { children.forEach(child => this.appendChild(child)); },
    appendChild(child) { this.children.push(child); child.parent = this; child.isConnected = true; return child; },
    remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
  });
}

function fixture({ reduced = false } = {}) {
  let time = 0;
  let nextId = 0;
  let bounds = { left: 150, top: 520, right: 238, bottom: 608, width: 88, height: 88 };
  const timers = new Map();
  const frames = new Map();
  const media = events({ matches: reduced });
  const viewport = events({ width: 390, height: 844, offsetLeft: 0, offsetTop: 0 });
  const host = events({ visualViewport: viewport, innerWidth: 390, innerHeight: 844, matchMedia: () => media });
  const doc = events({ hidden: false, body: element(), createElement: element });
  const button = element();
  button.isConnected = true;
  button.getBoundingClientRect = () => bounds;
  const played = [];
  const stopped = [];
  const audio = { playEffect(name, settings) { played.push({ at: time, name, ...settings }); return Promise.resolve(); },
    stopEffects(group) { stopped.push(group); } };
  const controller = create({ document: doc, window: host, now: () => time,
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  function step(nextTime) {
    time = nextTime;
    for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); }
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(time));
  }
  const rows = () => doc.body.children[0]?.children || [];
  const text = row => row.children[0].children.map(child => child.textContent).join('');
  return { controller, button, doc, host, viewport, media, audio, played, stopped, timers, frames, step, rows, text,
    feed: () => doc.body.children[0],
    move(rect) { bounds = { ...bounds, ...rect }; },
    listeners: () => doc.listenerCount() + host.listenerCount() + viewport.listenerCount() + media.listenerCount() };
}

test('only positive finite refund counts synchronously create exact independent messages', () => {
  const state = fixture();
  for (const count of [0, -1, null, undefined, 'bad', Infinity, NaN, Number.MAX_VALUE]) {
    assert.equal(state.controller.show(state.button, count, { audio: state.audio }), false);
  }
  assert.equal(state.rows().length, 0);
  assert.equal(state.listeners(), 0);
  assert.equal(state.controller.show(state.button, 2, { audio: state.audio }), true);
  assert.equal(state.text(state.rows()[0]), '\u65a7\u6280\u53d1\u52a8\uff1a\u8fd4\u8fd82\u6b21');
  assert.equal(state.feed().style.top, '510px');
  assert.equal(state.feed().style.left, '54px');
  assert.equal(state.timers.size, 2);
  assert.equal(state.frames.size, 1);
  state.controller.clear();
});

test('accelerated calls cap four rows, move older ones upward and locally throttle only refund audio', () => {
  const state = fixture();
  for (let index = 0; index < 12; index++) {
    state.step(index * 80);
    assert.equal(state.controller.show(state.button, index + 1, { audio: state.audio }), true);
    assert.ok(state.rows().length <= 4);
    assert.ok(state.timers.size <= 8);
    assert.equal(state.frames.size, 1);
  }
  assert.deepEqual(state.rows().map(state.text), [9, 10, 11, 12].map(count => `\u65a7\u6280\u53d1\u52a8\uff1a\u8fd4\u8fd8${count}\u6b21`));
  assert.deepEqual(state.rows().map(row => row.style['--refund-offset']), ['-84px', '-56px', '-28px', '0px']);
  assert.equal(state.played.length, 3);
  assert.ok(state.played.every(cue => cue.name === 'skillTrigger' && cue.group === 'chop-refunds'));
  assert.ok(state.stopped.every(group => group === 'chop-refunds'));
  state.step(2480);
  assert.equal(state.rows().length, 0);
  assert.equal(state.timers.size, 0);
  assert.equal(state.frames.size, 0);
  assert.equal(state.listeners(), 0);
});

test('each row holds then fades and fully cleans up after 1600ms', () => {
  const state = fixture();
  state.controller.show(state.button, 1, { audio: state.audio });
  const row = state.rows()[0];
  state.step(1319);
  assert.equal(row.classList.contains('chop-refund-leaving'), false);
  state.step(1320);
  assert.equal(row.classList.contains('chop-refund-leaving'), true);
  state.step(1599);
  assert.equal(state.rows().length, 1);
  state.step(1600);
  assert.equal(state.doc.body.children.length, 0);
  assert.equal(state.frames.size + state.timers.size + state.listeners(), 0);
  assert.equal(state.stopped.at(-1), 'chop-refunds');
});

test('position follows actual animated bounds and visual viewport shifts without changing the button', () => {
  const state = fixture();
  state.controller.show(state.button, 1);
  state.move({ left: 260, right: 348, top: 400, bottom: 488 });
  state.step(16);
  assert.equal(state.feed().style.top, '390px');
  assert.equal(state.feed().style.left, '102px');
  state.viewport.width = 250;
  state.viewport.offsetLeft = 40;
  state.viewport.offsetTop = 60;
  state.viewport.emit('resize');
  assert.equal(state.feed().style.width, '234px');
  assert.equal(state.feed().style.left, '48px');
  assert.deepEqual(Object.keys(state.button.style), ['setProperty']);
  state.controller.clear();
});

test('clear, hiding and anchor removal clean all timers, listeners, frames and grouped sounds', () => {
  for (const kind of ['clear', 'hidden', 'removed', 'offscreen', 'collapsed']) {
    const state = fixture();
    state.controller.show(state.button, 3, { audio: state.audio });
    assert.ok(state.listeners() > 0);
    if (kind === 'clear') state.controller.clear();
    if (kind === 'hidden') { state.doc.hidden = true; state.doc.emit('visibilitychange'); }
    if (kind === 'removed') { state.button.isConnected = false; state.step(20); }
    if (kind === 'offscreen') { state.move({ top: 900, bottom: 988 }); state.host.emit('scroll'); }
    if (kind === 'collapsed') { state.move({ width: 0, height: 0 }); state.step(20); }
    assert.equal(state.doc.body.children.length, 0, kind);
    assert.equal(state.frames.size + state.timers.size + state.listeners(), 0, kind);
    assert.equal(state.stopped.at(-1), 'chop-refunds', kind);
    state.step(3000);
    assert.equal(state.rows().length, 0, kind);
  }
});

test('switching anchor clears the previous feed and lifecycle restarts with one set of listeners', () => {
  const state = fixture();
  state.controller.show(state.button, 1);
  const listenerCount = state.listeners();
  const another = element();
  another.isConnected = true;
  another.getBoundingClientRect = state.button.getBoundingClientRect;
  state.controller.show(another, 5);
  assert.equal(state.rows().length, 1);
  assert.equal(state.text(state.rows()[0]), '\u65a7\u6280\u53d1\u52a8\uff1a\u8fd4\u8fd85\u6b21');
  assert.equal(state.listeners(), listenerCount);
  state.controller.clear();
});

test('reduced motion keeps timed static text and failed audio is non-blocking', async () => {
  const state = fixture({ reduced: true });
  const audio = { playEffect() { return Promise.reject(new Error('denied')); }, stopEffects() {} };
  assert.equal(state.controller.show(state.button, 7, { audio }), true);
  assert.equal(state.feed().classList.contains('chop-refund-reduced'), true);
  state.media.matches = false;
  state.media.emit('change');
  assert.equal(state.feed().classList.contains('chop-refund-reduced'), false);
  state.step(1600);
  await Promise.resolve();
  assert.equal(state.listeners() + state.timers.size + state.frames.size, 0);
});
