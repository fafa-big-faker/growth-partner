const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TenChopTimeline = require('../ten-chop-timeline');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function method(name) {
  const source = app.match(new RegExp(`\\n  (?:async )?${name}\\([^]*?\\n  },`));
  assert.ok(source, `${name} exists`);
  return source[0].trim().replace(/,$/, '');
}

function makeButton() {
  const classes = new Set();
  const properties = new Map();
  return {
    classes, properties, offsetWidth: 140,
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    style: { setProperty: (key, value) => properties.set(key, value) },
  };
}

test('button feedback shortens strike and ripple with shared speed and cancels old cleanup', () => {
  const timers = new Map();
  let id = 0;
  const view = vm.runInNewContext(`({${method('_playChopButtonFeedback')}})`, {
    setTimeout: (callback, ms) => { timers.set(++id, { callback, ms }); return id; },
    clearTimeout: timer => timers.delete(timer),
  });
  const button = makeButton();
  view._playChopButtonFeedback(button);
  assert.equal(button.properties.get('--chop-strike-duration'), '320ms');
  assert.equal(button.properties.get('--chop-ripple-duration'), '520ms');
  view._playChopButtonFeedback(button, 3);
  assert.equal(timers.size, 1);
  assert.equal(button.properties.get('--chop-strike-duration'), '107ms');
  assert.equal(button.properties.get('--chop-ripple-duration'), '173ms');
  assert.ok(button.classes.has('is-striking'));
  [...timers.values()][0].callback();
  assert.equal(button.classes.has('is-striking'), false);
  view._playChopButtonFeedback(null, 3);
});

async function simulateTenChops(chops, started = true) {
  const events = [];
  let writes = 0;
  const button = makeButton();
  const tree = makeButton();
  const context = {
    ITEMS: { '0': { name: '小钱钱' } },
    Game: { state: { realmLevel: 99, choppingCount: 10 }, chopTen: async () => {
      writes++;
      if (chops instanceof Error) throw chops;
      return chops;
    } },
    GameplayRules: { canUseTenChop: () => true },
    document: { getElementById: id => id === 'chop-btn' ? button : tree },
    TenChopTimeline,
    AudioManager: { playEffect: () => {} },
    CultivatorAnimator: {
      playChop: async timing => events.push(['character', timing.frameMs]),
      resumeIdle: () => events.push(['idle']),
    },
    CultivationEffects: { playHit: () => {} },
    UI: {
      runLockedAction: async (_key, _button, _label, action) => ({ started, value: started ? await action() : false }),
      playScatterAnimation: (_item, _tree, _index, ms) => { events.push(['drop', ms]); return null; },
      modal: () => {},
    },
    setTimeout: callback => { callback(); return 0; },
    renderItemIcon: () => '', renderFeatureIcon: () => '',
  };
  const view = vm.runInNewContext(`({${method('doChopTen')}})`, context);
  context.PlayerView = view;
  view._playChopButtonFeedback = (_button, speed) => events.push(['button', speed]);
  view.renderCultivate = () => {};
  let error;
  try { await view.doChopTen(); } catch (caught) { error = caught; }
  return { events, writes, error };
}

test('ten chops play exactly ten synchronized accelerating button strokes after one write', async () => {
  const { events, writes, error } = await simulateTenChops(Array.from({ length: 10 }, () => ({ kind: 'coin', quantity: 1 })));
  assert.equal(error, undefined);
  assert.equal(writes, 1);
  for (let index = 0; index < 10; index++) {
    const timing = TenChopTimeline.getStep(index);
    assert.deepEqual(events.slice(index * 3, index * 3 + 3), [
      ['button', timing.speed], ['character', timing.frameMs], ['drop', timing.dropMs],
    ]);
  }
  assert.deepEqual(events[30], ['idle']);
  assert.equal(events.length, 31);
});

test('locked, failed or empty ten-chop requests never play a spurious button stroke', async () => {
  for (const [value, started] of [[[], false], [null, true], [new Error('network'), true]]) {
    const { events } = await simulateTenChops(value, started);
    assert.equal(events.filter(event => event[0] === 'button').length, 0);
  }
});
