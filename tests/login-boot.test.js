const test = require('node:test');
const assert = require('node:assert/strict');
const { create, getCriticalAssets, getDecorationAssets, getEntryAssets } = require('../login-boot');

const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };

function fixture({ reduced = false, waitForRuntime = false, resourcePack, manifest, requireResourcePack = false } = {}) {
  const elements = new Map();
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  function element() {
    const classes = new Set();
    const listeners = new Map();
    return { attrs: {}, children: [], dataset: {}, style: {}, hidden: false, complete: true, naturalWidth: 100,
      classList: { add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); },
        toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } },
      append(...children) { this.children.push(...children); children.forEach(child => { if (child.id) elements.set(child.id, child); }); },
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this.attrs[name]; },
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
      emit(type) { for (const listener of listeners.get(type) || []) listener(); },
      decode() { this.decodeCalls = (this.decodeCalls || 0) + 1; return this.decodeResult; },
    };
  }
  const screen = element();
  const shell = element();
  screen.querySelector = () => shell;
  elements.set('login-screen', screen);
  for (const id of ['login-brand-image', 'login-submit-brush', 'login-submit-lettering']) elements.set(id, element());
  const preloader = {
    preload(urls, progress, settings) {
      return new Promise((resolve, reject) => calls.push({ urls, settings, progress, reject, resolve(failed = []) {
        resolve({ failed, cancelled: [], total: urls.length, loaded: urls.length - failed.length });
      } }));
    },
    getImage(src) { return { src, naturalWidth: 512 }; },
  };
  const boot = create({ document: { createElement: element, getElementById: id => elements.get(id) },
    window: { matchMedia: () => ({ matches: reduced }) }, preloader, waitForRuntime, resourcePack, manifest, requireResourcePack,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { boot, screen, shell, calls, timers, get: id => elements.get(id),
    expire() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } } };
}

test('cold login waits for critical images and DOM decode before decorations and uniform reveal', async () => {
  const state = fixture();
  let decoded;
  state.get('login-brand-image').decodeResult = new Promise(resolve => { decoded = resolve; });
  const ready = state.boot.start();
  assert.equal(state.boot.whenReady(), ready);
  assert.equal(state.shell.inert, true);
  assert.equal(state.screen.classList.contains('login-boot-pending'), true);
  assert.deepEqual(state.calls[0].urls, getCriticalAssets());
  assert.equal(state.calls[0].settings.retries, 1);
  state.calls[0].resolve();
  await flush();
  assert.equal(state.calls.length, 1, 'decorations cannot race critical DOM decoding');
  decoded();
  await flush();
  assert.deepEqual(state.calls[1].urls, getDecorationAssets());
  assert.equal(state.shell.inert, true);
  state.calls[1].resolve();
  const result = await ready;
  assert.equal(result.criticalReady, true);
  assert.equal(result.simplified, false);
  assert.equal(Object.keys(result.images).length, 10);
  assert.equal(state.shell.inert, false);
  assert.equal(state.get('login-boot').hidden, true);
  assert.equal(state.screen.classList.contains('login-boot-pending'), false);
  assert.equal(state.get('login-brand-image').decodeCalls, 1);
  assert.equal(state.boot.start(), ready, 'warm access to the controller never flashes another loader');
  assert.equal(state.calls.length, 2);
});

test('critical failure remains blocked, exposes retry only and can recover', async () => {
  const state = fixture();
  const ready = state.boot.start();
  state.calls[0].resolve([getCriticalAssets()[0]]);
  await flush();
  assert.equal(state.boot.getState().phase, 'error');
  assert.equal(state.get('login-boot-retry').hidden, false);
  assert.equal(state.get('login-boot-simple').hidden, true);
  assert.equal(state.shell.inert, true);
  state.boot.enterSimplified();
  assert.equal(state.shell.inert, true);
  state.get('login-boot-retry').emit('click');
  state.get('login-boot-retry').emit('click');
  assert.equal(state.calls.length, 2, 'rapid retry clicks share one attempt');
  state.calls[1].resolve();
  await flush();
  state.calls[2].resolve();
  assert.equal((await ready).criticalReady, true);
});

test('decorative failures offer simplified entry without claiming complete artwork', async () => {
  const state = fixture();
  const ready = state.boot.start();
  state.calls[0].resolve();
  await flush();
  state.calls[1].resolve([getDecorationAssets()[2]]);
  await flush();
  assert.equal(state.boot.getState().criticalReady, true);
  assert.equal(state.get('login-boot-simple').hidden, false);
  assert.equal(state.shell.inert, true);
  assert.doesNotMatch(state.get('login-boot-status').textContent, /100%/);
  state.get('login-boot-simple').emit('click');
  const result = await ready;
  assert.equal(result.simplified, true);
  assert.deepEqual(result.failed, [getDecorationAssets()[2]]);
});

test('DOM decode failure and hanging decode cannot silently pass readiness', async () => {
  const failed = fixture();
  failed.get('login-submit-brush').decodeResult = Promise.reject(new Error('decode failed'));
  failed.boot.start();
  failed.calls[0].resolve();
  await flush();
  assert.equal(failed.boot.getState().phase, 'error');
  assert.equal(failed.calls.length, 1);
  failed.boot.destroy();
  const pending = fixture();
  pending.get('login-brand-image').decodeResult = new Promise(() => {});
  pending.boot.start();
  pending.calls[0].resolve();
  await flush();
  pending.expire();
  await flush();
  assert.equal(pending.boot.getState().phase, 'error');
  assert.equal(pending.shell.inert, true);
  pending.boot.destroy();
});

test('reduced motion loads only critical art and skips unused animation textures', async () => {
  const state = fixture({ reduced: true });
  const ready = state.boot.start();
  state.calls[0].resolve();
  assert.equal((await ready).simplified, true);
  assert.equal(state.calls.length, 1);
});

test('destroy aborts the attempt and ignores all late completions', async () => {
  const state = fixture();
  const ready = state.boot.start();
  state.boot.destroy();
  assert.equal(state.calls[0].settings.signal.aborted, true);
  assert.equal((await ready).cancelled, true);
  state.calls[0].resolve();
  await flush();
  assert.equal(state.screen.classList.contains('login-boot-ready'), false);
  assert.equal(state.calls.length, 1);
});

test('completed artwork cannot expose an unbound form while the runtime is still loading', async () => {
  const state = fixture({ waitForRuntime: true });
  const ready = state.boot.start();
  let resolved = false;
  void ready.then(() => { resolved = true; });
  state.calls[0].resolve();
  await flush();
  state.calls[1].resolve();
  await flush();
  assert.equal(state.boot.getState().phase, 'runtime');
  assert.equal(state.boot.getState().runtimeReady, false);
  assert.equal(state.shell.inert, true);
  assert.equal(resolved, false);
  state.boot.markRuntimeReady();
  assert.equal((await ready).criticalReady, true);
  assert.equal(state.shell.inert, false);
  assert.equal(state.boot.getState().phase, 'ready');
});

test('early runtime readiness still waits for every required image', async () => {
  const state = fixture({ waitForRuntime: true });
  const ready = state.boot.start();
  state.boot.markRuntimeReady();
  assert.equal(state.shell.inert, true);
  state.calls[0].resolve();
  await flush();
  assert.equal(state.shell.inert, true);
  state.calls[1].resolve();
  assert.equal((await ready).criticalReady, true);
  assert.equal(state.shell.inert, false);
});

test('entry downloads all resources before decoding public images and enabling login', async () => {
  let complete, report;
  const state = fixture({ waitForRuntime: true, manifest: { assets: [] }, resourcePack: {
    prepare(_, progress) { report = progress; return new Promise(resolve => { complete = resolve; }); },
  } });
  const ready = state.boot.start();
  state.boot.markRuntimeReady({ imageAssets: ['scene.webp', 'item.webp', 'scene.webp'] });
  assert.equal(state.calls.length, 0);
  report({ percent: 50 });
  assert.equal(state.get('login-boot-percent').textContent, '47%');
  assert.equal(state.get('login-boot-track').attrs['aria-valuenow'], '47');
  complete({ ready: true, persistent: true, failed: [], cancelled: [] });
  await flush();
  state.calls[0].resolve();
  await flush();
  state.calls[1].resolve();
  await flush();
  assert.deepEqual(state.calls[2].urls, ['scene.webp', 'item.webp']);
  assert.equal(state.shell.inert, true);
  assert.ok(state.boot.getState().percent < 100);
  state.calls[2].progress({ percent: 50 });
  assert.equal(state.boot.getState().percent, 98);
  state.calls[2].resolve();
  const result = await ready;
  assert.equal(result.resourcesReady, true);
  assert.equal(result.persistent, true);
  assert.equal(state.boot.getState().percent, 100);
  assert.equal(state.shell.inert, false);
  assert.equal(state.timers.size, 0);
});

test('failed resource packs cannot be bypassed and retry keeps the form locked', async () => {
  const attempts = [];
  const state = fixture({ manifest: { assets: [] }, resourcePack: {
    prepare() { return new Promise(resolve => attempts.push(resolve)); },
  } });
  state.boot.start();
  attempts[0]({ ready: false, failed: ['sound.mp3'], cancelled: [] });
  await flush();
  assert.equal(state.boot.getState().phase, 'error');
  assert.equal(state.get('login-boot-simple').hidden, true);
  state.boot.enterSimplified();
  assert.equal(state.shell.inert, true);
  state.boot.retry();
  state.boot.retry();
  assert.equal(attempts.length, 2);
  assert.equal(state.calls.length, 0);
  state.boot.destroy();
  attempts[1]({ ready: true, failed: [], cancelled: [] });
  await flush();
  assert.equal(state.calls.length, 0);
});

test('public image decode rejection recovers to retry instead of hanging', async () => {
  const state = fixture({ reduced: true, waitForRuntime: true });
  state.boot.start();
  state.boot.markRuntimeReady({ imageAssets: ['scene.webp'] });
  state.calls[0].resolve();
  await flush();
  state.calls[1].reject(new Error('decode failed'));
  await flush();
  assert.equal(state.boot.getState().phase, 'error');
  assert.equal(state.shell.inert, true);
  assert.equal(state.get('login-boot-retry').hidden, false);
  state.boot.destroy();
});

test('long preparation rotates one quiet quote and destroy cancels the pending swap', () => {
  const state = fixture();
  state.boot.start();
  const quote = state.get('login-boot-quote');
  const first = quote.textContent;
  state.expire();
  assert.equal(quote.classList.contains('is-changing'), true);
  state.expire();
  assert.notEqual(quote.textContent, first);
  assert.equal(quote.classList.contains('is-changing'), false);
  state.boot.destroy();
  assert.equal(state.timers.size, 0);
});

test('production entry cannot silently bypass a missing resource manifest', async () => {
  const state = fixture({ requireResourcePack: true });
  state.boot.start();
  await flush();
  assert.equal(state.boot.getState().phase, 'error');
  assert.equal(state.calls.length, 0);
  assert.equal(state.shell.inert, true);
  assert.equal(state.get('login-boot-simple').hidden, true);
  state.boot.destroy();
});

test('entry background waits for cache takeover even when its bytes finish first', () => {
  let report;
  const state = fixture({ manifest: { assets: [] }, resourcePack: {
    prepare(_, progress) { report = progress; return new Promise(() => {}); },
  } });
  state.boot.start();
  for (const url of getEntryAssets()) report({ url, ok: true, percent: 3, persistent: false });
  assert.equal(state.get('login-boot').classList.contains('has-art'), false);
  assert.equal(state.get('login-boot').classList.contains('has-track-art'), false);
  report({ percent: 4, persistent: true });
  assert.equal(state.get('login-boot').classList.contains('has-art'), true);
  assert.equal(state.get('login-boot').classList.contains('has-track-art'), true);
  state.boot.destroy();
});
