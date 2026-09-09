const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createOperationGuard } = require('../operation-guard');
const TenChopTimeline = require('../ten-chop-timeline');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function method(name) {
  const source = app.match(new RegExp(`\\n  (?:async )?${name}\\([^]*?\\n  },`));
  assert.ok(source, `${name} exists`);
  return source[0].trim().replace(/,$/, '');
}

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function element() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  return {
    classes, attributes, listeners, style: { setProperty() {} }, dataset: {},
    innerHTML: 'original', textContent: '', disabled: false, isConnected: true, parentNode: null,
    classList: {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)),
      contains: value => classes.has(value),
      toggle: (value, force) => force ? classes.add(value) : classes.delete(value),
    },
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    addEventListener: (name, callback) => listeners.set(name, callback),
    remove() { this.isConnected = false; this.parentNode = null; },
    click() { listeners.get('click')?.(); },
  };
}

function fixture(options = {}) {
  let timerId = 0;
  let now = 0;
  const timers = new Map();
  const nodes = new Map();
  const overlays = [];
  const drops = [];
  const reveals = [];
  const events = [];
  const calls = { single: 0, batch: 0, character: 0, render: 0 };
  const guard = createOperationGuard();
  const getNode = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  getNode('player-main').dataset.renderedTab = 'cultivate';
  const schedule = (callback, ms = 0) => {
    timers.set(++timerId, { callback, at: now + ms, ms });
    return timerId;
  };
  getNode('modal-container').appendChild = overlay => {
    overlay.parentNode = getNode('modal-container');
    overlays.push(overlay);
  };
  const draw = (item, kind) => {
    const drop = element();
    drop.item = item;
    drop.classList.add(kind);
    drops.push(drop);
    return drop;
  };
  const result = { itemId: '100', quality: 3, quantity: 6, baseQuantity: 2,
    buffTriggers: [{ beforeQuantity: 2, afterQuantity: 6, multiplier: 3 }], refundChopping: 2 };
  const Game = {
    state: { choppingCount: 100, realmLevel: 99 }, inventory: [],
    chop: async () => { calls.single++; return options.single ? options.single() : result; },
    chopTen: async () => { calls.batch++; return options.batch ? options.batch() : Array.from({ length: 10 }, () => ({ ...result })); },
  };
  const UI = {
    toast: (...args) => events.push(['toast', ...args]),
    playDropAnimation: item => draw(item, 'falling-item'),
    playScatterAnimation: item => draw(item, 'scatter-item'),
  };
  const context = vm.createContext({
    Game, UI, OperationGuard: guard, TenChopTimeline,
    GameplayRules: { canUseTenChop: () => true },
    document: {
      getElementById: getNode,
      createElement: () => {
        const overlay = element();
        const children = new Map(['.modal', '.modal-close', '.reward-reveal-confirm'].map(selector => [selector, element()]));
        overlay.querySelector = selector => children.get(selector) || null;
        return overlay;
      },
      querySelectorAll: selector => {
        if (selector === '.reward-dialog-overlay') {
          return overlays.filter(overlay => overlay.isConnected && overlay.classes.has('reward-dialog-overlay'));
        }
        if (selector === '#floating-items-container .falling-item, #floating-items-container .scatter-item') {
          return drops.filter(drop => drop.isConnected);
        }
        return [];
      },
    },
    AudioManager: {
      playEffect: name => events.push(['audio', name]),
      stopEffects: group => events.push(['stop', group]),
      pauseBgm: () => events.push(['bgm-stop']),
    },
    CultivatorAnimator: {
      playChop: () => { calls.character++; return options.animation ? options.animation() : Promise.resolve(true); },
      resumeIdle: () => events.push(['idle']),
      stop: () => events.push(['character-stop']),
    },
    CultivationEffects: { playHit: () => {} },
    MobileCultivation: { setPage: () => {}, unmount: () => {} },
    LoginArt: { setVisible: () => {} },
    RewardPresentation: {
      createRenderer: () => ({ renderItem: () => 'item', renderResults: () => 'results', renderRefundTotal: () => 'refund' }),
      playReveal: (_overlay, settings) => {
        const controller = {
          finishCount: 0, cancelCount: 0,
          finish() { this.finishCount++; settings.onComplete(); },
          cancel() { this.cancelCount++; },
          complete() { settings.onComplete(); },
        };
        reveals.push(controller);
        return controller;
      },
    },
    ITEMS: {}, QUALITY: {}, renderItemIcon: () => '', renderFeatureIcon: () => '', escapeHtml: String,
    setTimeout: schedule, clearTimeout: id => timers.delete(id), requestAnimationFrame: callback => schedule(callback),
    console: { error: (...args) => events.push(['error', ...args]) },
  });
  Object.assign(UI, vm.runInContext(`({${['runLockedAction', 'modal', 'closeModal'].map(method).join(',')}})`, context));
  const view = vm.runInContext(`({${['_waitForChopFeedback', 'cancelChopPresentation', '_startRewardReveal',
    '_showRewardModal', 'doChop', 'doChopTen'].map(method).join(',')}})`, context);
  Object.assign(view, {
    _chopPresentationVersion: 0, _chopWait: null, _tenChopMode: false,
    _playChopButtonFeedback: () => {}, renderCultivate: () => { calls.render++; },
    renderTasks: () => {}, renderReward: () => {}, renderMail: () => {}, clearDataCaches: () => {},
  });
  context.PlayerView = view;
  const router = vm.runInContext(`({${method('playerTab')},${method('isCurrentPlayerRender')}})`, context);
  Object.assign(router, { currentPlayerTab: 'cultivate', _playerRenderVersion: 0 });
  context.Router = router;
  const auth = vm.runInContext(`({${method('logout')}})`, context);
  auth._setLoading = () => {};
  return {
    view, router, auth, Game, calls, guard, timers, nodes, overlays, drops, reveals, events, result,
    async advance(ms) {
      const target = now + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].callback();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

test('single chop remains guarded through feedback waiting and never grants again during reveal', async () => {
  const f = fixture();
  const work = f.view.doChop();
  await flush();
  assert.equal(f.calls.single, 1);
  assert.equal(f.guard.isActive('chop'), true);
  assert.ok(f.view._chopWait);
  assert.equal(await f.view.doChop(), false);
  assert.equal(await f.view.doChopTen(), false);
  await f.advance(799);
  assert.equal(f.overlays.length, 0);
  assert.equal(f.guard.isActive('chop'), true);
  await f.advance(1);
  assert.equal(await work, true);
  assert.equal(f.guard.isActive('chop'), false);
  assert.equal(f.view._chopWait, null);
  assert.equal(f.calls.single, 1);
  assert.equal(f.calls.batch, 0);
  assert.equal(f.overlays.length, 1);
  const button = f.overlays[0].querySelector('.reward-reveal-confirm');
  button.click();
  assert.equal(f.reveals[0].finishCount, 1);
  button.click();
  assert.equal(f.reveals[0].cancelCount, 1);
  assert.equal(f.overlays[0].isConnected, false);
  assert.equal(f.calls.single, 1, 'skip and close are presentation only');
});

test('route change during a saved single reward wait cancels the old modal and releases the guard', async () => {
  const f = fixture();
  const work = f.view.doChop();
  await flush();
  assert.equal(f.drops.length, 1);
  f.router.playerTab('tasks');
  assert.ok(f.drops.every(drop => !drop.isConnected), 'route change immediately removes old floating reward art');
  assert.equal(f.view._chopWait, null);
  assert.ok(![...f.timers.values()].some(timer => timer.ms === 800));
  assert.equal(await work, true);
  await f.advance(10000);
  assert.equal(f.overlays.length, 0);
  assert.equal(f.calls.render, 0);
  assert.equal(f.calls.single, 1);
  assert.equal(f.guard.isActive('chop'), false);
  assert.ok(f.events.some(event => event[0] === 'stop' && event[1] === 'chop-drops'));
});

test('route change while the single database outcome is pending never starts old reward feedback', async () => {
  const saved = deferred();
  const f = fixture({ single: () => saved.promise });
  const work = f.view.doChop();
  await flush();
  f.router.playerTab('tasks');
  assert.equal(f.guard.isActive('chop'), true, 'presentation cancellation must not unlock an unfinished resource action');
  assert.equal(await f.view.doChop(), false);
  saved.resolve(f.result);
  assert.equal(await work, true);
  await f.advance(10000);
  assert.equal(f.drops.length, 0);
  assert.equal(f.overlays.length, 0);
  assert.equal(f.calls.single, 1);
});

test('logout between ordinary and bonus drops removes pending waiting without inventing a second grant', async () => {
  const f = fixture();
  f.result.extraDrop = { itemId: '200', quantity: 1, quality: 1, isExtra: true };
  const work = f.view.doChop();
  await flush();
  assert.equal(f.drops.length, 1);
  assert.ok([...f.timers.values()].some(timer => timer.ms === 180));
  f.auth.logout();
  assert.ok(f.drops.every(drop => !drop.isConnected), 'logout immediately removes old falling reward art');
  assert.equal(f.Game.state, null);
  assert.equal(await work, true);
  await f.advance(10000);
  assert.equal(f.drops.length, 1, 'cancelled bonus animation does not get a late callback');
  assert.equal(f.overlays.length, 0);
  assert.equal(f.calls.single, 1);
  assert.equal(f.view._chopWait, null);
  assert.equal(f.guard.isActive('chop'), false);
});

test('ten-chop cancellation after one scatter removes its nodes without calling the batch twice', async () => {
  const f = fixture();
  const work = f.view.doChopTen();
  await flush();
  assert.equal(f.calls.batch, 1);
  assert.equal(f.calls.character, 1);
  assert.equal(f.drops.length, 1);
  assert.equal(await f.view.doChopTen(), false);
  f.router.playerTab('reward');
  assert.equal(await work, true);
  await f.advance(10000);
  assert.equal(f.calls.batch, 1);
  assert.equal(f.calls.character, 1);
  assert.ok(f.drops.every(drop => !drop.isConnected));
  assert.equal(f.overlays.length, 0);
  assert.equal(f.guard.isActive('chop'), false);
  assert.equal(f.view._chopWait, null);
});

test('logout before a pending batch resolves suppresses every old visual and preserves one batch call', async () => {
  const saved = deferred();
  const f = fixture({ batch: () => saved.promise });
  const work = f.view.doChopTen();
  await flush();
  f.auth.logout();
  assert.equal(f.guard.isActive('chop'), true);
  saved.resolve(Array.from({ length: 10 }, () => ({ ...f.result })));
  assert.equal(await work, true);
  await f.advance(10000);
  assert.equal(f.calls.batch, 1);
  assert.equal(f.calls.character, 0);
  assert.equal(f.drops.length, 0);
  assert.equal(f.overlays.length, 0);
  assert.equal(f.guard.isActive('chop'), false);
});

test('completed ten-chop presentation reveals one saved batch and keeps skip/close non-mutating', async () => {
  const f = fixture();
  const work = f.view.doChopTen();
  await flush();
  await f.advance(10000);
  assert.equal(await work, true);
  assert.equal(f.calls.batch, 1);
  assert.equal(f.calls.single, 0);
  assert.equal(f.calls.character, 10);
  assert.equal(f.drops.length, 10);
  assert.ok(f.drops.every(drop => !drop.isConnected));
  assert.equal(f.overlays.length, 1);
  assert.equal(f.view._chopWait, null);
  const button = f.overlays[0].querySelector('.reward-reveal-confirm');
  button.click();
  button.click();
  assert.equal(f.calls.batch, 1);
  assert.equal(f.overlays[0].isConnected, false);
});

test('failed resource outcome never displays success and the guard recovers', async () => {
  const f = fixture({ single: async () => null, batch: async () => null });
  assert.equal(await f.view.doChop(), false);
  assert.equal(await f.view.doChopTen(), false);
  assert.equal(f.overlays.length, 0);
  assert.equal(f.drops.length, 0);
  assert.equal(f.guard.isActive('chop'), false);
});

test('all close routes cancel reward playback after its natural visual completion', async () => {
  for (const close of ['button', 'backdrop', 'route', 'logout']) {
    const f = fixture();
    const work = f.view.doChop();
    await flush();
    await f.advance(800);
    await work;
    const overlay = f.overlays[0];
    f.reveals[0].complete();
    assert.equal(f.reveals[0].cancelCount, 0, 'natural completion can preserve the last sound tail');
    if (close === 'button') overlay.querySelector('.modal-close').click();
    if (close === 'backdrop') overlay.listeners.get('click')({ target: overlay });
    if (close === 'route') f.router.playerTab('tasks');
    if (close === 'logout') f.auth.logout();
    assert.equal(f.reveals[0].cancelCount, 1, close + ' cancels the controller even after completion');
    assert.equal(overlay.isConnected, false, close + ' removes the reward modal');
    assert.equal(f.calls.single, 1);
  }
});

test('late cancelled wait callbacks cannot clear a newer feedback timer', async () => {
  const f = fixture();
  const first = f.view._waitForChopFeedback(800, 0);
  const late = [...f.timers.values()][0].callback;
  f.view.cancelChopPresentation();
  assert.equal(await first, false);
  const second = f.view._waitForChopFeedback(400, f.view._chopPresentationVersion);
  const currentWait = f.view._chopWait;
  late();
  assert.equal(f.view._chopWait, currentWait);
  await f.advance(400);
  assert.equal(await second, true);
  assert.equal(f.view._chopWait, null);
  assert.equal(f.timers.size, 0);
});
