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
  assert.equal('refund' in metadata, false);
  assert.deepEqual(metadata.triggers, bonus.buffTriggers.map(trigger => ({ type: 1, ...trigger })));
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
  assert.deepEqual(Rewards.getRewardMetadata(null), { quantity: 1, baseQuantity: 1, triggers: [] });
});

test('reveal plan staggers ordinary rewards and finishes both true skill transitions before the next item', () => {
  const plan = Rewards.getRevealPlan([Rewards.getRewardMetadata(bonus), Rewards.getRewardMetadata({ quantity: 8 })]);
  assert.deepEqual(plan.events.filter(event => event.type === 'reveal').map(event => event.at), [0, 2900]);
  assert.deepEqual(plan.events.filter(event => event.type === 'trigger').map(event => event.at), [300, 1600]);
  assert.deepEqual(plan.events.filter(event => event.type === 'shake').map(event => event.at), [600, 1900]);
  assert.deepEqual(plan.events.filter(event => event.type === 'quantity').map(event => [event.at, event.quantity, event.triggerIndex]), [[1100, 6, 0], [2400, 12, 1]]);
  assert.deepEqual(plan.events.filter(event => event.type === 'settle').map(event => event.at), [1600, 2900]);
  assert.equal(plan.events.some(event => event.type.startsWith('refund')), false);
  assert.equal(plan.duration, 3120);
  const ordinary = Rewards.getRevealPlan(Array.from({ length: 10 }, () => Rewards.getRewardMetadata({ quantity: 1 })));
  assert.deepEqual(ordinary.events.filter(event => event.type === 'reveal').map(event => event.at), Array.from({ length: 10 }, (_, index) => index * 120));
});

test('every skill in the batch gets all 1300ms and refund-only items do not pause or animate', () => {
  const one = { quantity: 6, baseQuantity: 2, buffTriggers: [bonus.buffTriggers[0]] };
  const plan = Rewards.getRevealPlan([one, one, { quantity: 1, refundChopping: 2 }].map(Rewards.getRewardMetadata));
  assert.deepEqual(plan.events.filter(event => event.type === 'trigger').map(event => event.at), [300, 1900]);
  assert.deepEqual(plan.events.filter(event => event.type === 'settle').map(event => event.at), [1600, 3200]);
  assert.deepEqual(plan.events.filter(event => event.type === 'reveal').map(event => event.at), [0, 1600, 3200]);
  assert.equal(plan.events.some(event => event.type.startsWith('refund')), false);
  for (const trigger of plan.events.filter(event => event.type === 'trigger')) {
    for (const [type, delay] of [['shake', 300], ['quantity', 800], ['settle', 1300]]) {
      const next = plan.events.find(event => event.type === type && event.itemIndex === trigger.itemIndex);
      assert.equal(next.at - trigger.at, delay);
    }
  }
});

test('explicit type 2 never enters multiplier metadata or the presentation timeline, while legacy multipliers remain compatible', () => {
  const explicit = { ...bonus, buffTriggers: [
    { type: 2, refund: 2 }, { ...bonus.buffTriggers[0], type: '1' },
    { type: 2, beforeQuantity: 6, afterQuantity: 600, multiplier: 100 }, { ...bonus.buffTriggers[1], type: 1 },
  ] };
  const metadata = Rewards.getRewardMetadata(explicit);
  assert.equal(metadata.baseQuantity, 2);
  assert.equal(metadata.triggers.length, 2);
  assert.ok(metadata.triggers.every(trigger => trigger.type === 1));
  assert.deepEqual(Rewards.getRewardMetadata({ quantity: 2, baseQuantity: 1,
    buffTriggers: [{ type: 2, beforeQuantity: 1, afterQuantity: 2, multiplier: 2 }] }).triggers, []);
  const plan = Rewards.getRevealPlan([{ quantity: 2, baseQuantity: 1,
    triggers: [{ type: 2, beforeQuantity: 1, afterQuantity: 2, multiplier: 2 }], refund: 20 }]);
  assert.deepEqual(plan.events.map(event => event.type), ['reveal', 'complete-item']);
  assert.deepEqual(plan.events.map(event => event.at), [0, 120]);
  assert.equal(plan.duration, 220, 'a directly supplied type-2 trigger must not add the multiplier lead-in');
});

test('rendered output shows one actual quantity and no permanent multiplier or empty skill slot', () => {
  const renderer = Rewards.createRenderer({ renderItemIcon: (id, fallback, cls) => `<img data-id="${id}" class="${cls}">` });
  const html = renderer.renderResults([bonus, { itemId: '1', quantity: 2, refundChopping: 3 }, { quantity: 7, isExtra: true }]);
  assert.match(html, /reward-item-quantity-value buff-quality-5">×12！</);
  assert.doesNotMatch(html, /reward-item-buff|reward-skill-notice|reward-item-feedback|reward-item-refund|reward-refund|返还|斧技发动/);
  assert.match(html, /data-reward-reveal="\{&quot;quantity&quot;:12/);
  assert.equal((renderer.renderItem(bonus).match(/reward-item-quantity-value/g) || []).length, 1);
  assert.equal(renderer.renderNotice, undefined);
  assert.equal(Rewards.renderNotice, undefined);
  assert.ok(html.indexOf('reward-results-extra') > html.indexOf('reward-results-regular'));
});

function fixture(rewards, reduced = false) {
  let now = 0, id = 0;
  const timers = new Map(), listeners = new Map(), observers = [], played = [], stopped = [], audioActions = [];
  const node = (height = 40) => {
    const attributes = new Map();
    const classes = new Set();
    const element = { style: {}, innerHTML: '', textContent: '', attributes, getBoundingClientRect: () => ({ height }),
      setAttribute(name, value) { if (name === 'class') this.className = value; else attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      removeAttribute(name) { attributes.delete(name); if (name === 'class') classes.clear(); },
      classList: { values: classes, contains: name => classes.has(name),
        add(...names) { names.forEach(name => classes.add(name)); attributes.set('class', [...classes].join(' ')); },
        remove(...names) { names.forEach(name => classes.delete(name)); attributes.set('class', [...classes].join(' ')); } },
    };
    Object.defineProperty(element, 'className', {
      get: () => attributes.get('class') || '',
      set(value) { attributes.set('class', value); classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); },
    });
    return element;
  };
  const view = {
    setTimeout(callback, delay) { timers.set(++id, { callback, at: now + delay }); return id; },
    clearTimeout(timer) { timers.delete(timer); },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', fontSize: '12px' }),
    matchMedia: () => ({ matches: reduced }), addEventListener() {}, removeEventListener() {},
    MutationObserver: class { constructor(callback) { this.callback = callback; this.active = true; observers.push(this); } observe() {} disconnect() { this.active = false; } },
  };
  const document = { defaultView: view, documentElement: {}, hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } };
  const entries = rewards.map(reward => {
    const metadata = Rewards.getRewardMetadata(reward);
    const element = { ...node(), dataset: { rewardReveal: JSON.stringify(metadata), rewardQuality: '3' } };
    const quantity = node();
    const renderedQuantity = Rewards.renderItem(reward).match(/<span class="(reward-item-quantity-value[^"]*)">([^<]*)<\/span>/);
    assert.ok(renderedQuantity);
    quantity.className = renderedQuantity[1];
    quantity.textContent = renderedQuantity[2];
    const name = node(35); name.textContent = reward.name || '锻造石';
    name.className = 'reward-item-name quality-item-name quality-3 original-label';
    name.setAttribute('title', '原道具说明');
    const reserves = [name, node(17)];
    const selectors = { '.reward-item-quantity-value': quantity, '.reward-item-name': name,
      '.reward-item-quantity': reserves[1] };
    element.querySelector = selector => selectors[selector];
    return { element, quantity, name, reserves };
  });
  const body = { ...node(), clientHeight: 0, scrollTop: 0 };
  const overlay = { ownerDocument: document, nodeType: 1, parentElement: null, isConnected: true, hidden: false, dataset: {},
    querySelector: selector => selector === '.modal-body' ? body : null,
    querySelectorAll: () => entries.map(entry => entry.element) };
  return {
    overlay, entries, body, timers, document, observers, played, stopped, audioActions,
    audio: { playEffect(name, options) { played.push({ name, group: options.group, at: now }); audioActions.push({ type: 'play', name, group: options.group, at: now }); return Promise.resolve(true); },
      stopEffects(group) { stopped.push(group); audioActions.push({ type: 'stop', group, at: now }); } },
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

const mixedQualityBonus = {
  ...bonus,
  buffTriggers: bonus.buffTriggers.map((trigger, index) => ({ ...trigger, buffQuality: index === 0 ? 5 : 2 })),
};

function buffClasses(element) {
  return [...element.classList.values].filter(name => /^buff-quality-/.test(name)).sort();
}

function assertQuantity(entry, text, quality = null) {
  assert.equal(entry.quantity.textContent, text);
  assert.deepEqual(buffClasses(entry.quantity), quality === null ? [] : [`buff-quality-${quality}`]);
  assert.ok(entry.quantity.classList.contains('reward-item-quantity-value'));
}

test('mixed skill qualities 5 then 2 change number color only when that trigger updates the actual quantity', () => {
  const original = structuredClone(mixedQualityBonus);
  const f = fixture([mixedQualityBonus]);
  const entry = f.entries[0];
  const originalNameClass = entry.name.className;
  entry.name.style.color = 'rgb(32, 48, 41)';
  assertQuantity(entry, '×12！', 2);
  Rewards.playReveal(f.overlay, { audio: f.audio });
  assertQuantity(entry, '×2');
  f.advance(299);
  assert.equal(entry.name.textContent, '锻造石');
  assert.equal(entry.name.className, originalNameClass);
  assert.deepEqual(buffClasses(entry.name), []);
  assert.equal(f.played.some(sound => sound.name === 'skillTrigger'), false);
  f.advance(300);
  assert.equal(entry.name.textContent, '斧技·3倍！！');
  assert.deepEqual(buffClasses(entry.name), ['buff-quality-5']);
  assertQuantity(entry, '×2');
  f.advance(1099);
  assertQuantity(entry, '×2');
  f.advance(1100);
  assertQuantity(entry, '×6！', 5);
  f.advance(1600);
  assert.equal(entry.name.textContent, '斧技·2倍！！');
  assert.deepEqual(buffClasses(entry.name), ['buff-quality-2']);
  assertQuantity(entry, '×6！', 5);
  f.advance(2399);
  assertQuantity(entry, '×6！', 5);
  f.advance(2400);
  assertQuantity(entry, '×12！', 2);
  f.advance(10000);
  assertQuantity(entry, '×12！', 2);
  assert.equal(entry.name.textContent, '锻造石');
  assert.equal(entry.name.className, originalNameClass);
  assert.equal(entry.name.style.color, 'rgb(32, 48, 41)');
  assert.deepEqual(mixedQualityBonus, original, 'styling cannot change granted quantities or saved triggers');
});

test('finish, cancel, hidden, removal and reduced motion retain the last actual skill quality and exact final punctuation', () => {
  for (const mode of ['finish', 'cancel', 'hidden', 'removed', 'reduced']) {
    const f = fixture([mixedQualityBonus], mode === 'reduced');
    const entry = f.entries[0];
    const originalNameClass = entry.name.className;
    entry.name.style.color = 'rgb(32, 48, 41)';
    const controller = Rewards.playReveal(f.overlay, { audio: f.audio });
    if (mode !== 'reduced') {
      f.advance(310);
      if (mode === 'finish' || mode === 'cancel') controller[mode]();
      if (mode === 'hidden') { f.overlay.hidden = true; f.notify(); }
      if (mode === 'removed') { f.overlay.isConnected = false; f.notify(); }
    }
    f.advance(10000);
    assertQuantity(entry, '×12！', 2);
    assert.equal(entry.name.textContent, '锻造石', mode);
    assert.equal(entry.name.className, originalNameClass, mode);
    assert.equal(entry.name.style.color, 'rgb(32, 48, 41)', mode);
    assert.equal(entry.name.getAttribute('title'), '原道具说明', mode);
    assert.equal(entry.name.getAttribute('aria-label'), null, mode);
    assert.equal(f.timers.size, 0, mode);
    controller.finish();
    controller.cancel();
    assertQuantity(entry, '×12！', 2);
  }
});

test('finishing or cancelling during the original-name hold prevents every later skill cue', () => {
  for (const mode of ['finish', 'cancel']) {
    const f = fixture([mixedQualityBonus]);
    const controller = Rewards.playReveal(f.overlay, { audio: f.audio });
    f.advance(299);
    assert.equal(f.entries[0].name.textContent, '锻造石');
    assertQuantity(f.entries[0], '×2');
    controller[mode]();
    f.advance(10000);
    assert.equal(f.played.some(sound => sound.name === 'skillTrigger'), false, mode);
    assert.equal(f.timers.size, 0, mode);
    assertQuantity(f.entries[0], '×12！', 2);
    assert.equal(f.entries[0].name.textContent, '锻造石');
  }
});

test('ordinary, refund-only and extra rewards never gain skill punctuation or skill colors', () => {
  const rewards = [
    { quantity: 8, quality: 5 },
    { quantity: 4, refundChopping: 9 },
    { ...mixedQualityBonus, isExtra: true },
    { quantity: 6, baseQuantity: 2, buffTriggers: [{ type: 2, beforeQuantity: 2, afterQuantity: 6, multiplier: 3, buffQuality: 5 }] },
  ];
  const original = structuredClone(rewards);
  const f = fixture(rewards);
  Rewards.playReveal(f.overlay, { audio: f.audio });
  f.advance(10000);
  f.entries.forEach((entry, index) => assertQuantity(entry, `×${rewards[index].quantity}`));
  assert.equal(f.played.some(sound => sound.name === 'skillTrigger'), false);
  assert.deepEqual(rewards, original);
});

test('a real trigger without buffQuality uses quality 1 for its label and final number', () => {
  const reward = { quantity: 6, baseQuantity: 2, buffTriggers: [{ beforeQuantity: 2, afterQuantity: 6, multiplier: 3 }] };
  const f = fixture([reward]);
  const entry = f.entries[0];
  Rewards.playReveal(f.overlay, { audio: f.audio });
  f.advance(300);
  assert.equal(entry.name.textContent, '斧技·3倍！！');
  assert.deepEqual(buffClasses(entry.name), ['buff-quality-1']);
  assertQuantity(entry, '×2');
  f.advance(1100);
  assertQuantity(entry, '×6！', 1);
  f.advance(10000);
  assertQuantity(entry, '×6！', 1);
});

test('replaying a completed or active reveal removes old number emphasis before replay and restores exact names', () => {
  for (const previousTime of [310, 10000]) {
    const f = fixture([mixedQualityBonus]);
    const entry = f.entries[0];
    const originalNameClass = entry.name.className;
    Rewards.playReveal(f.overlay, { audio: f.audio });
    f.advance(previousTime);
    const replacement = Rewards.playReveal(f.overlay, { audio: f.audio });
    assertQuantity(entry, '×2');
    assert.equal(entry.name.textContent, '锻造石');
    assert.equal(entry.name.className, originalNameClass);
    f.advance(previousTime + 299);
    assert.equal(entry.name.textContent, '锻造石');
    assertQuantity(entry, '×2');
    f.advance(previousTime + 300);
    assert.equal(entry.name.textContent, '斧技·3倍！！');
    assert.deepEqual(buffClasses(entry.name), ['buff-quality-5']);
    assertQuantity(entry, '×2');
    replacement.finish();
    assertQuantity(entry, '×12！', 2);
    assert.equal(entry.name.className, originalNameClass);
    replacement.finish();
    replacement.cancel();
    assertQuantity(entry, '×12！', 2);
    assert.equal(f.timers.size, 0);
  }
});

test('controller displays base and true intermediate quantities, holds later items and completes once', () => {
  const f = fixture([bonus, { quantity: 8 }]);
  let completed = 0;
  const controller = Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => completed++ });
  assert.equal(f.entries[0].quantity.textContent, '×2');
  assert.equal(f.entries[1].element.dataset.revealState, 'pending');
  assert.equal(f.entries[0].reserves[0].style.minHeight, '35px');
  assert.equal(f.entries[0].reserves[1].style.minHeight, '17px');
  f.advance(299); assert.equal(f.entries[0].name.textContent, '锻造石');
  f.advance(300); assert.equal(f.entries[0].name.textContent, '斧技·3倍！！');
  assert.equal(f.entries[1].name.textContent, '锻造石');
  f.advance(599); assert.equal(f.entries[0].element.classList.values.has('is-count-shaking'), false);
  f.advance(600); assert.equal(f.entries[0].element.classList.values.has('is-count-shaking'), true);
  f.advance(1099); assert.equal(f.entries[0].quantity.textContent, '×2');
  f.advance(1100); assert.equal(f.entries[0].quantity.textContent, '×6！');
  assert.equal(f.entries[0].element.classList.values.has('is-count-shaking'), false);
  assert.equal(f.entries[0].element.classList.values.has('is-count-changing'), true);
  f.advance(1599); assert.equal(f.entries[0].element.classList.values.has('is-count-changing'), true);
  f.advance(1600); assert.equal(f.entries[0].name.textContent, '斧技·2倍！！');
  assert.equal(f.entries[0].element.classList.values.has('is-count-changing'), false);
  f.advance(1899); assert.equal(f.entries[0].element.classList.values.has('is-count-shaking'), false);
  f.advance(1900); assert.equal(f.entries[0].element.classList.values.has('is-count-shaking'), true);
  f.advance(2399); assert.equal(f.entries[0].quantity.textContent, '×6！');
  f.advance(2400); assert.equal(f.entries[0].quantity.textContent, '×12！');
  f.advance(2899); assert.equal(f.entries[0].element.classList.values.has('is-count-changing'), true);
  assert.equal(f.entries[1].element.dataset.revealState, 'pending');
  f.advance(2900); assert.equal(f.entries[1].element.dataset.revealState, 'revealing');
  assert.equal(f.entries[0].name.textContent, '锻造石');
  f.advance(3120); assert.equal(completed, 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.overlay.dataset.rewardRevealState, 'complete');
  assert.equal(f.stopped.length, 2, 'only each skill start truncates its own preceding reveal tail');
  assert.ok(f.audioActions.filter(action => action.type === 'stop').every(action => [300, 1600].includes(action.at)));
  assert.equal(f.played.filter(sound => sound.name === 'skillTrigger').length, 2);
  controller.finish(); assert.equal(completed, 1);
  controller.cancel(); assert.equal(f.stopped.length, 3, 'closing a completed presentation may stop remaining audio tails');
});

test('each skill clears only its own group immediately before its cue', () => {
  const f = fixture([bonus]);
  Rewards.playReveal(f.overlay, { audio: f.audio });
  f.advance(10000);
  for (const [index, action] of f.audioActions.entries()) {
    if (action.name !== 'skillTrigger') continue;
    assert.deepEqual(f.audioActions[index - 1], { type: 'stop', group: action.group, at: action.at });
  }
  assert.ok(f.stopped.every(group => group === f.played[0].group));
  assert.match(f.played[0].group, /^reward-dialog-\d+$/);
});

test('clipped rewards scroll only their modal body, including when the user scrolls away before a trigger', () => {
  const f = fixture([bonus]);
  f.body.clientHeight = 100;
  f.body.getBoundingClientRect = () => ({ top: 100, bottom: 200, height: 100 });
  f.entries[0].element.getBoundingClientRect = () => ({ top: 230 - f.body.scrollTop, bottom: 320 - f.body.scrollTop, height: 90 });
  f.entries[0].reserves[1].getBoundingClientRect = () => ({ bottom: 320 - f.body.scrollTop, height: 17 });
  f.entries[0].element.scrollIntoView = () => assert.fail('never scroll ancestors or the document');
  const controller = Rewards.playReveal(f.overlay, { audio: f.audio });
  assert.equal(f.body.scrollTop, 125);
  f.body.scrollTop = 0;
  f.advance(300);
  assert.equal(f.body.scrollTop, 125);
  controller.cancel();
});

test('an item taller than the entire body prioritizes its quantity without scrolling page ancestors', () => {
  const f = fixture([bonus]);
  f.body.clientHeight = 50;
  f.body.getBoundingClientRect = () => ({ top: 100, bottom: 150, height: 50 });
  f.entries[0].element.getBoundingClientRect = () => ({ top: 230 - f.body.scrollTop, bottom: 320 - f.body.scrollTop, height: 90 });
  f.entries[0].reserves[1].getBoundingClientRect = () => ({ bottom: 320 - f.body.scrollTop, height: 17 });
  const controller = Rewards.playReveal(f.overlay, { audio: f.audio });
  assert.equal(f.body.scrollTop, 170);
  assert.equal(f.entries[0].reserves[1].getBoundingClientRect().bottom, 150);
  controller.cancel();
});

test('finish and cancel clear all future callbacks and owned audio without affecting grants', () => {
  for (const mode of ['finish', 'cancel']) {
    const original = structuredClone(bonus);
    const f = fixture([bonus, { quantity: 8 }]);
    let completed = 0;
    const controller = Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => completed++ });
    f.advance(310);
    controller[mode]();
    const sounds = f.played.length;
    f.advance(10000);
    assert.equal(f.timers.size, 0);
    assert.equal(f.played.length, sounds);
    assert.equal(completed, mode === 'finish' ? 1 : 0);
    assert.equal(f.entries[0].quantity.textContent, '×12！');
    assert.equal(f.entries[1].quantity.textContent, '×8');
    assert.equal(f.entries[0].name.textContent, '锻造石');
    assert.equal(f.entries[0].name.getAttribute('title'), '原道具说明');
    assert.equal(f.entries[0].name.getAttribute('aria-label'), null);
    assert.equal(f.entries[0].name.style.fontSize, '');
    assert.equal(f.entries[0].reserves[0].style.minHeight, '');
    assert.equal(f.entries[0].reserves[1].style.minHeight, '');
    assert.equal(f.stopped.length, 2);
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

test('refund-only awards have no skill cue and combined refunds never add result events or cues', () => {
  for (const reward of [{ quantity: 1, refundChopping: 2 }, bonus]) {
    const f = fixture([reward]);
    Rewards.playReveal(f.overlay, { audio: f.audio });
    f.advance(10000);
    assert.equal(f.played.filter(sound => sound.name === 'skillTrigger').length, reward.buffTriggers?.length || 0);
    assert.equal(f.played.filter(sound => sound.name === 'rewardReveal').length, 1 + (reward.buffTriggers?.length || 0));
  }
});

test('reduced motion shows final quantities immediately without sounds or timers', () => {
  const f = fixture([bonus], true);
  let completed = 0;
  Rewards.playReveal(f.overlay, { audio: f.audio, onComplete: () => completed++ });
  assert.equal(completed, 1);
  assert.equal(f.entries[0].quantity.textContent, '×12！');
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
