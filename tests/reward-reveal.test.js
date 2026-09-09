const test = require('node:test');
const assert = require('node:assert/strict');
const Rewards = require('../reward-presentation');

const bonus = { itemId: '40001', quantity: 12, baseQuantity: 2, refundChopping: 2, buffTriggers: [
  { beforeQuantity: 2, afterQuantity: 6, multiplier: 3, skillId: 1, buffId: 1, buffRowId: 3, buffQuality: 3 },
  { beforeQuantity: 6, afterQuantity: 12, multiplier: 2, skillId: 2, buffId: 1, buffRowId: 5, buffQuality: 5 },
] };

test('metadata uses complete ordered real trigger chains and never reverse engineers legacy or extra quantities', () => {
  const original = structuredClone(bonus);
  const metadata = Rewards.getRewardMetadata(bonus);
  assert.equal(metadata.baseQuantity, 2);
  assert.equal(metadata.quantity, 12);
  assert.equal(metadata.refund, 2);
  assert.deepEqual(metadata.triggers, bonus.buffTriggers);
  assert.deepEqual(bonus, original);
  for (const reward of [
    { quantity: 12, buffText: '×3' },
    { ...bonus, isExtra: true },
    { ...bonus, baseQuantity: 3 },
    { ...bonus, quantity: 100 },
    { ...bonus, buffTriggers: [{ beforeQuantity: 2, afterQuantity: 12, multiplier: 2 }] },
  ]) {
    const result = Rewards.getRewardMetadata(reward);
    assert.equal(result.baseQuantity, reward.quantity);
    assert.deepEqual(result.triggers, []);
  }
  assert.deepEqual(Rewards.getRewardMetadata(null), { quantity: 1, baseQuantity: 1, triggers: [], refund: 0 });
});

test('reveal plan staggers ordinary rewards and finishes both true skill transitions before the next item', () => {
  const plan = Rewards.getRevealPlan([Rewards.getRewardMetadata(bonus), Rewards.getRewardMetadata({ quantity: 8 })]);
  assert.deepEqual(plan.events.filter(event => event.type === 'reveal').map(event => event.at), [0, 990]);
  assert.deepEqual(plan.events.filter(event => event.type === 'trigger').map(event => event.at), [120, 570]);
  assert.deepEqual(plan.events.filter(event => event.type === 'quantity').map(event => [event.at, event.quantity]), [[390, 6], [750, 12]]);
  assert.deepEqual(plan.events.filter(event => event.type === 'settle').map(event => event.at), [570, 870]);
  assert.equal(plan.events.find(event => event.type === 'refund').at, 870);
  assert.equal(plan.duration, 1210);
  const ordinary = Rewards.getRevealPlan(Array.from({ length: 10 }, () => Rewards.getRewardMetadata({ quantity: 1 })));
  assert.deepEqual(ordinary.events.filter(event => event.type === 'reveal').map(event => event.at), Array.from({ length: 10 }, (_, index) => index * 120));
});

test('only the first skill across the batch gets 450ms and refund-only items share the trigger timeline', () => {
  const one = { quantity: 6, baseQuantity: 2, buffTriggers: [bonus.buffTriggers[0]] };
  const plan = Rewards.getRevealPlan([one, one, { quantity: 1, refundChopping: 2 }].map(Rewards.getRewardMetadata));
  assert.deepEqual(plan.events.filter(event => event.type === 'trigger' || event.type === 'refund-trigger').map(event => event.at), [120, 690, 1110]);
  assert.deepEqual(plan.events.filter(event => event.type === 'settle').map(event => event.at), [570, 990, 1410]);
  assert.equal(plan.events.find(event => event.type === 'refund').at, 1290);
});

test('rendered output keeps final quantities, escaped metadata, refund icons and a batch total', () => {
  const renderer = Rewards.createRenderer({ renderItemIcon: (id, fallback, cls) => `<img data-id="${id}" class="${cls}">` });
  const html = renderer.renderResults([bonus, { itemId: '1', quantity: 2, refundChopping: 3 }, { quantity: 7, isExtra: true }]);
  assert.match(html, /reward-item-quantity-value">×12</);
  assert.match(html, /reward-item-feedback/);
  assert.match(html, /data-reward-reveal="\{&quot;quantity&quot;:12/);
  assert.match(html, /reward-refund-icon/);
  assert.match(html, /data-refund-total="5"/);
  assert.match(html, /本次共返还/);
  assert.equal(renderer.renderRefundTotal([null, { quantity: 3 }]), '');
  assert.ok(html.indexOf('reward-results-extra') > html.indexOf('reward-results-regular'));
});

function fixture(rewards, reduced = false) {
  let now = 0, id = 0;
  const timers = new Map(), listeners = new Map(), observers = [], played = [], stopped = [];
  const node = (height = 40) => ({ style: {}, innerHTML: '', textContent: '', getBoundingClientRect: () => ({ height }),
    classList: { values: new Set(), add(...names) { names.forEach(name => this.values.add(name)); }, remove(...names) { names.forEach(name => this.values.delete(name)); } } });
  const view = {
    setTimeout(callback, delay) { timers.set(++id, { callback, at: now + delay }); return id; },
    clearTimeout(timer) { timers.delete(timer); },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    matchMedia: () => ({ matches: reduced }), addEventListener() {}, removeEventListener() {},
    MutationObserver: class { constructor(callback) { this.callback = callback; this.active = true; observers.push(this); } observe() {} disconnect() { this.active = false; } },
  };
  const document = { defaultView: view, documentElement: {}, hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } };
  const entries = rewards.map(reward => {
    const metadata = Rewards.getRewardMetadata(reward);
    const element = { ...node(), dataset: { rewardReveal: JSON.stringify(metadata) } };
    const quantity = node(); quantity.textContent = `×${metadata.quantity}`;
    const ticker = { ...node(), dataset: {} };
    const buff = metadata.triggers.length ? node() : null;
    if (buff) buff.innerHTML = 'final skill summary';
    const refund = metadata.refund ? node() : null;
    const reserves = [node(35), node(72)];
    const selectors = { '.reward-item-quantity-value': quantity, '.reward-item-buff': buff, '.reward-item-refund': refund,
      '.reward-item-quantity': reserves[0], '.reward-item-feedback': reserves[1], '.reward-quantity-ticker': ticker };
    element.querySelector = selector => selectors[selector];
    return { element, quantity, ticker, buff, refund, reserves };
  });
  const overlay = { ownerDocument: document, nodeType: 1, parentElement: null, isConnected: true, hidden: false, dataset: {},
    querySelectorAll: () => entries.map(entry => entry.element) };
  return {
    overlay, entries, timers, document, observers, played, stopped,
    audio: { playEffect(name, options) { played.push({ name, group: options.group, at: now }); return Promise.resolve(true); }, stopEffects(group) { stopped.push(group); } },
    notify() { observers.filter(observer => observer.active).forEach(observer => observer.callback()); },
    visibility() { listeners.get('visibilitychange')?.(); },
    advance(target) {
      while (true) {
        const next = [...timers.entries()].filter(([, entry]) => entry.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].callback();
      }
      now = target;
    },
  };
}

test('controller displays base and true intermediate quantities, holds later items and completes once', () => {
  const f = fixture([bonus, { quantity: 8 }]);
  let completed = 0;
  const controller = Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => completed++ });
  assert.equal(f.entries[0].quantity.textContent, '×2');
  assert.equal(f.entries[1].element.dataset.revealState, 'pending');
  assert.equal(f.entries[0].reserves[1].style.minHeight, '72px');
  f.advance(389); assert.equal(f.entries[0].quantity.textContent, '×2');
  f.advance(390); assert.equal(f.entries[0].quantity.textContent, '×6');
  assert.equal(f.entries[0].ticker.dataset.previousQuantity, '×2');
  f.advance(750); assert.equal(f.entries[0].quantity.textContent, '×12');
  f.advance(869); assert.equal(f.entries[0].refund.style.visibility, 'hidden');
  f.advance(870); assert.equal(f.entries[0].refund.style.visibility, '');
  assert.equal(f.entries[1].element.dataset.revealState, 'pending');
  f.advance(990); assert.equal(f.entries[1].element.dataset.revealState, 'revealing');
  f.advance(1210); assert.equal(completed, 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.overlay.dataset.rewardRevealState, 'complete');
  assert.equal(f.stopped.length, 0, 'natural completion does not truncate audio tails');
  assert.equal(f.played.filter(sound => sound.name === 'skillTrigger').length, 2);
  controller.finish(); assert.equal(completed, 1);
  controller.cancel(); assert.equal(f.stopped.length, 1, 'closing a completed presentation may stop remaining audio tails');
});

test('finish and cancel clear all future callbacks and owned audio without affecting grants', () => {
  for (const mode of ['finish', 'cancel']) {
    const original = structuredClone(bonus);
    const f = fixture([bonus, { quantity: 8 }]);
    let completed = 0;
    const controller = Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => completed++ });
    f.advance(130);
    controller[mode]();
    const sounds = f.played.length;
    f.advance(10000);
    assert.equal(f.timers.size, 0);
    assert.equal(f.played.length, sounds);
    assert.equal(completed, mode === 'finish' ? 1 : 0);
    assert.equal(f.entries[0].quantity.textContent, '×12');
    assert.equal(f.entries[1].quantity.textContent, '×8');
    assert.equal(f.entries[0].buff.innerHTML, 'final skill summary');
    assert.equal(f.entries[0].reserves[1].style.minHeight, '');
    assert.equal(f.stopped.length, 1);
    assert.deepEqual(bonus, original);
  }
});

test('removed modals cancel while hidden surfaces finish so their confirmation cannot remain stuck', () => {
  for (const mode of ['removed', 'hidden', 'document']) {
    const f = fixture([bonus]);
    let completed = 0;
    Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => completed++ });
    if (mode === 'removed') f.overlay.isConnected = false;
    if (mode === 'hidden') f.overlay.hidden = true;
    if (mode === 'document') f.document.hidden = true;
    mode === 'document' ? f.visibility() : f.notify();
    assert.equal(f.overlay.dataset.rewardRevealState, mode === 'removed' ? 'cancelled' : 'complete');
    assert.equal(f.timers.size, 0);
    assert.equal(f.observers.every(observer => !observer.active), true);
    assert.equal(completed, mode === 'removed' ? 0 : 1);
  }
});

test('refund-only awards activate the skill cue once and combined multiplier/refund does not add a duplicate skill cue', () => {
  for (const reward of [{ quantity: 1, refundChopping: 2 }, bonus]) {
    const f = fixture([reward]);
    Rewards.playReveal(f.overlay, { audio: f.audio });
    f.advance(10000);
    assert.equal(f.played.filter(sound => sound.name === 'skillTrigger').length, reward.buffTriggers?.length || 1);
    assert.equal(f.entries[0].refund.style.visibility, '');
  }
});

test('reduced motion shows final quantities immediately without sounds or timers', () => {
  const f = fixture([bonus], true);
  let completed = 0;
  Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => completed++ });
  assert.equal(completed, 1);
  assert.equal(f.entries[0].quantity.textContent, '×12');
  assert.equal(f.played.length, 0);
  assert.equal(f.timers.size, 0);
});

test('a new reveal on the same overlay cancels the previous controller and rejected audio never blocks it', async () => {
  const f = fixture([bonus]);
  let first = 0, second = 0;
  Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => first++ });
  const replacement = Rewards.playReveal(f.overlay, { audio: { playEffect: () => Promise.reject(Error('muted or blocked')) }, onComplete: () => second++ });
  replacement.finish();
  f.advance(10000);
  await Promise.resolve();
  assert.equal(first, 0);
  assert.equal(second, 1);
  assert.equal(f.timers.size, 0);
});
