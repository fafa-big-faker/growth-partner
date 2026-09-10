const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../scene-transition');

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function fixture({ reduced = false, animation = true, throws = false } = {}) {
  const animations = [], listeners = new Map(), timers = new Map();
  let nextTimer = 0;
  const document = { hidden: false,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
  };
  function element(display = '') {
    const classes = new Set();
    const node = { style: { display }, inert: false, hidden: false,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      querySelector: () => null, querySelectorAll: () => [],
    };
    if (animation) node.animate = (keyframes, options) => {
      if (throws) throw new Error('animation unsupported');
      let resolve, reject;
      const handle = { node, keyframes, options, cancelled: false,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { resolve(); }, fail() { reject(new Error('interrupted')); },
        cancel() { this.cancelled = true; reject(new Error('cancelled')); },
      };
      animations.push(handle);
      return handle;
    };
    return node;
  }
  const window = { matchMedia: () => ({ matches: reduced }),
    setTimeout(callback, duration) { timers.set(++nextTimer, { callback, duration }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
  };
  const api = create({ document, window });
  const from = element(), to = element('none'), shell = element(), overlay = element();
  const content = element(), access = element(), nav = element(), inventory = element();
  shell.inert = true;
  shell.querySelector = selector => selector === '.login-access' ? access : null;
  overlay.querySelector = selector => selector === '.login-boot-content' ? content : null;
  to.querySelectorAll = selector => selector === '.bottom-nav > *, .mobile-inventory-columns > *' ? [nav, inventory] : [];
  from.classList.add('login-boot-pending');
  return { api, document, timers, listeners, animations, from, to, shell, overlay, content, access, nav, inventory,
    complete() { for (const handle of animations) handle.finish(); },
    hide() { document.hidden = true; listeners.get('visibilitychange')?.(); },
    expire() { for (const timer of [...timers.values()]) timer.callback(); },
  };
}

test('login reveal starts logo against the real background but keeps the form locked through 720 ms', async () => {
  const f = fixture();
  let called = 0;
  const promise = f.api.revealLogin({ screen: f.from, overlay: f.overlay, shell: f.shell, onReveal() {
    called++;
    assert.equal(f.from.classList.contains('login-boot-pending'), false);
    assert.equal(f.shell.inert, true);
    assert.equal(f.api.isActive(), true);
  } });
  assert.equal(called, 1);
  assert.equal(f.overlay.hidden, false);
  assert.equal(f.animations[0].options.duration, 720);
  assert.equal(f.animations[0].keyframes[1].opacity, 1, '100% remains briefly before the background fades');
  f.complete();
  assert.deepEqual(await promise, { cancelled: false });
  assert.equal(f.overlay.hidden, true);
  assert.equal(f.shell.inert, false);
  assert.equal(f.from.inert, false);
  assert.equal(f.api.isActive(), false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('game preparation locks both pages synchronously, overlays login, and shares duplicate entry', async () => {
  const f = fixture();
  let ready, calls = 0;
  const prepare = () => {
    calls++;
    assert.equal(f.api.isActive(), true);
    assert.equal(f.from.inert, true);
    assert.equal(f.to.inert, true);
    assert.equal(f.from.classList.contains('scene-transition-outgoing'), true);
    f.to.style.display = 'flex';
    return new Promise(resolve => { ready = resolve; });
  };
  const promise = f.api.enterGame({ from: f.from, to: f.to, prepare });
  assert.equal(f.api.enterGame({ from: f.from, to: f.to, prepare }), promise);
  assert.equal(calls, 1);
  assert.equal(f.animations.length, 0);
  ready();
  await flush();
  assert.equal(f.animations[0].options.duration, 700);
  assert.equal(f.animations[1].options.delay, 80);
  assert.ok(f.animations.every(handle => handle.node !== f.to), 'the fixed bottom bar keeps its containing block');
  assert.equal(f.from.style.display, '');
  f.complete();
  await promise;
  assert.equal(f.to.style.display, 'flex');
  assert.equal(f.from.style.display, 'none');
  assert.equal(f.to.inert, false);
  assert.equal(f.from.inert, false);
  assert.equal(f.from.classList.contains('scene-transition-outgoing'), false);
});

test('preparation failure returns the original login and releases all temporary state', async () => {
  const f = fixture();
  const error = new Error('account unavailable');
  await assert.rejects(f.api.enterGame({ from: f.from, to: f.to, prepare() {
    f.to.style.display = 'flex';
    throw error;
  } }), error);
  assert.equal(f.from.style.display, '');
  assert.equal(f.to.style.display, 'none');
  assert.equal(f.from.inert, false);
  assert.equal(f.to.inert, false);
  assert.equal(f.api.isActive(), false);
});

test('a stalled page preparation times out to login and cannot later start its animation', async () => {
  const f = fixture();
  let ready;
  const promise = f.api.enterGame({ from: f.from, to: f.to, prepare() {
    f.to.style.display = 'flex';
    return new Promise(resolve => { ready = resolve; });
  } });
  const rejected = assert.rejects(promise, /entry preparation timed out/);
  assert.equal([...f.timers.values()][0].duration, 12000);
  f.expire();
  await rejected;
  assert.equal(f.to.style.display, 'none');
  assert.equal(f.from.inert, false);
  assert.equal(f.api.isActive(), false);
  ready();
  await flush();
  assert.equal(f.animations.length, 0);
  assert.equal(f.timers.size, 0);
});

test('cancellation during preparation cannot start a late animation or interfere with the next entry', async () => {
  const f = fixture();
  let ready;
  const promise = f.api.enterGame({ from: f.from, to: f.to, prepare() {
    f.to.style.display = 'flex';
    return new Promise(resolve => { ready = resolve; });
  } });
  f.api.cancel();
  assert.deepEqual(await promise, { cancelled: true });
  assert.equal(f.to.style.display, 'none');
  const next = f.api.enterGame({ from: f.from, to: f.to, prepare() { f.to.style.display = 'flex'; } });
  ready();
  await flush();
  assert.equal(f.animations.length, 3);
  assert.equal(f.api.isActive(), true);
  f.complete();
  assert.deepEqual(await next, { cancelled: false });
});

test('cancel during animation restores page visibility, preexisting inert and classes', async () => {
  const f = fixture();
  f.to.inert = true;
  f.to.classList.add('scene-transition-locked');
  const promise = f.api.enterGame({ from: f.from, to: f.to, prepare() { f.to.style.display = 'flex'; } });
  await flush();
  f.api.cancel();
  assert.deepEqual(await promise, { cancelled: true });
  assert.equal(f.to.style.display, 'none');
  assert.equal(f.to.inert, true);
  assert.equal(f.to.classList.contains('scene-transition-locked'), true);
  assert.ok(f.animations.every(handle => handle.cancelled));
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('reduced motion uses short fades with neither delay nor transform', async () => {
  const f = fixture({ reduced: true });
  const promise = f.api.enterGame({ from: f.from, to: f.to });
  await flush();
  for (const handle of f.animations) {
    assert.equal(handle.options.duration, 160);
    assert.equal(handle.options.delay || 0, 0);
    assert.ok(handle.keyframes.every(frame => !('transform' in frame)));
  }
  f.complete();
  await promise;
});

test('missing or throwing animation APIs finish cleanly without delaying login', async () => {
  for (const settings of [{ animation: false }, { throws: true }]) {
    const f = fixture(settings);
    const promise = f.api.revealLogin({ screen: f.from, overlay: f.overlay, shell: f.shell });
    assert.deepEqual(await promise, { cancelled: false });
    assert.equal(f.shell.inert, false);
    assert.equal(f.overlay.hidden, true);
    assert.equal(f.timers.size, 0);
  }
});

test('backgrounding and a nonsettling animation both finish without a stuck interaction lock', async () => {
  for (const method of ['hide', 'expire']) {
    const f = fixture();
    const promise = f.api.enterGame({ from: f.from, to: f.to, prepare() { f.to.style.display = 'flex'; } });
    await flush();
    if (method === 'expire') assert.equal([...f.timers.values()][0].duration, 880);
    f[method]();
    assert.deepEqual(await promise, { cancelled: false });
    assert.equal(f.from.style.display, 'none');
    assert.equal(f.to.inert, false);
    assert.equal(f.api.isActive(), false);
    assert.equal(f.timers.size, 0);
  }
});

test('a hidden tab finishes only after preparation, while a cancelled reveal leaves a usable form', async () => {
  const f = fixture();
  f.document.hidden = true;
  let ready;
  const promise = f.api.enterGame({ from: f.from, to: f.to, prepare() {
    return new Promise(resolve => { ready = resolve; });
  } });
  assert.equal(f.api.isActive(), true);
  ready();
  await promise;
  assert.equal(f.animations.length, 0);
  f.document.hidden = false;
  const reveal = f.api.revealLogin({ screen: f.from, overlay: f.overlay, shell: f.shell });
  f.api.cancel();
  assert.deepEqual(await reveal, { cancelled: true });
  assert.equal(f.shell.inert, false);
  assert.equal(f.overlay.hidden, true);
});
