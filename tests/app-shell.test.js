const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createController } = require('../app-shell');
const { createAudioManager, MUTE_STORAGE_KEY } = require('../audio-manager');
const { createOperationGuard } = require('../operation-guard');

function node(properties = {}) {
  const attributes = properties.attributes || {};
  return {
    style: {}, hidden: false, isConnected: true,
    classList: { contains: () => false },
    getAttribute: name => attributes[name] ?? null,
    ...properties,
  };
}

function setup({ player = true, admin = false, audio, operations, guide } = {}) {
  const elements = new Map([
    ['player-dashboard', node({ style: { display: player ? 'flex' : 'none' } })],
    ['admin-dashboard', node({ style: { display: admin ? 'flex' : 'none' } })],
  ]);
  const modals = [];
  const busy = [];
  const routes = [];
  const document = {
    getElementById: id => elements.get(id),
    querySelectorAll: selector => selector === '.modal-overlay' ? modals : busy,
  };
  const navigation = {
    currentPlayerTab: 'cultivate', currentAdminTab: 'task-manage',
    playerTab(tab) { assert.equal(this, navigation); routes.push(tab); this.currentPlayerTab = tab; },
    adminTab(tab) { assert.equal(this, navigation); routes.push(tab); this.currentAdminTab = tab; },
  };
  const controller = createController({ document, navigation, audio, operations, guide });
  return { controller, document, elements, navigation, routes, modals, busy };
}

test('Back closes only the top visible modal through its existing close button', () => {
  const state = setup();
  const clicks = [];
  for (const id of ['lower', 'upper', 'hidden']) {
    state.modals.push(node({
      hidden: id === 'hidden',
      querySelector: () => node({ click: () => clicks.push(id) }),
      remove() { assert.fail('The shell must not bypass the existing close handler'); },
    }));
  }
  assert.equal(state.controller.handleBack(), true);
  assert.deepEqual(clicks, ['upper']);
  assert.deepEqual(state.routes, []);
});

test('an active first-chop guide blocks Android Back before dialogs, library and navigation', () => {
  let active = true;
  const state = setup({ guide: { isActive: () => active } });
  state.modals.push(node({ querySelector: () => node({ click: () => assert.fail('guide must own Back') }) }));
  state.elements.set('mobile-weapon-toggle', node({
    attributes: { 'aria-expanded': 'true' }, click: () => assert.fail('guide must own Back'),
  }));
  assert.equal(state.controller.handleBack(), true);
  assert.deepEqual(state.routes, []);
  active = false;
  state.modals.length = 0;
  state.elements.delete('mobile-weapon-toggle');
  assert.equal(state.controller.handleBack(), false);
});

test('native background transitions pause and resume guide motion without duplicate notifications', () => {
  const calls = [];
  const state = setup({ guide: { setBackgrounded: value => calls.push(value) } });
  state.controller.setBackgrounded(true);
  state.controller.setBackgrounded(true);
  state.controller.setBackgrounded(false);
  state.controller.setBackgrounded(false);
  assert.deepEqual(calls, [true, false]);
});

test('locked, disabled-close and nonclosable top modals swallow Back', () => {
  for (const kind of ['locked', 'disabled', 'missing']) {
    const state = setup();
    state.modals.push(node({
      classList: { contains: value => value === 'modal-locked' && kind === 'locked' },
      querySelector: () => kind === 'missing' ? null : node({
        disabled: kind === 'disabled', click: () => assert.fail('An unavailable close must not run'),
      }),
    }));
    state.navigation.currentPlayerTab = 'tasks';
    assert.equal(state.controller.handleBack(), true);
    assert.deepEqual(state.routes, []);
  }
});

test('player and admin subpages use their existing home routes; home and login defer exit to native', () => {
  for (const role of ['player', 'admin']) {
    const state = setup({ player: role === 'player', admin: role === 'admin' });
    if (role === 'player') state.navigation.currentPlayerTab = 'tasks';
    else state.navigation.currentAdminTab = 'review';
    assert.equal(state.controller.handleBack(), true);
    assert.deepEqual(state.routes, [role === 'player' ? 'cultivate' : 'task-manage']);
    assert.equal(state.controller.handleBack(), false);
  }
  assert.equal(setup({ player: false }).controller.handleBack(), false);
});

test('weapon library Back clicks the existing return control before requesting exit', () => {
  const state = setup();
  let clicked = 0;
  state.elements.set('mobile-weapon-toggle', node({
    attributes: { 'aria-expanded': 'true' }, click: () => clicked++,
  }));
  assert.equal(state.controller.handleBack(), true);
  assert.equal(clicked, 1);
  assert.deepEqual(state.routes, []);
});

test('busy controls and preexisting resource guards block navigation and exit', () => {
  const guard = { isBusy: () => true };
  const guarded = setup({ operations: guard });
  assert.equal(guarded.controller.handleBack(), true);
  const state = setup();
  state.navigation.currentPlayerTab = 'mail';
  state.busy.push(node());
  assert.equal(state.controller.handleBack(), true);
  assert.deepEqual(state.routes, []);
  state.busy[0].hidden = true;
  assert.equal(state.controller.handleBack(), true);
  assert.deepEqual(state.routes, ['cultivate']);
});

test('dynamic resource operations remain protected even after their control disappears', async () => {
  const operations = createOperationGuard();
  const original = operations.run;
  const state = setup({ operations });
  state.navigation.currentPlayerTab = 'tasks';
  let finish;
  const pending = operations.run('submission-reward:fixture', () => new Promise(resolve => { finish = resolve; }));
  assert.equal(state.controller.handleBack(), true);
  assert.deepEqual(state.routes, []);
  finish('fixture-result');
  assert.deepEqual(await pending, { started: true, value: 'fixture-result' });
  assert.equal(state.controller.handleBack(), true);
  assert.deepEqual(state.routes, ['cultivate']);
  state.controller.destroy();
  assert.equal(operations.run, original);
});

test('operation errors release Back protection without replacing guard methods', async () => {
  const failure = new Error('fixture failure');
  const operations = createOperationGuard();
  const original = operations.run;
  const state = setup({ operations });
  await assert.rejects(operations.run('fixture', () => { throw failure; }), error => error === failure);
  assert.equal(operations.run, original);
  assert.equal(state.controller.handleBack(), false);
  state.controller.destroy();
});

function audioFixture(muted = false) {
  const sounds = [];
  const writes = [];
  class Audio {
    constructor(src) { this.src = src; this.plays = 0; this.pauses = 0; sounds.push(this); }
    play() { this.plays++; return Promise.resolve(); }
    pause() { this.pauses++; }
  }
  const audio = createAudioManager({
    AudioCtor: Audio,
    storage: { getItem: () => String(muted), setItem: (...args) => writes.push(args) },
    documentRef: { querySelectorAll: () => [] },
  });
  return { audio, sounds, writes };
}

test('background pauses BGM/effects/loops and rejects late sounds without replaying them on resume', async () => {
  const fixture = audioFixture();
  const state = setup({ audio: fixture.audio });
  await fixture.audio.playBgm();
  await fixture.audio.playEffect('itemDrop');
  await fixture.audio.startLoop('forgeProcess');
  const existing = fixture.sounds.length;
  state.controller.setBackgrounded(true);
  assert.ok(fixture.sounds.every(sound => sound.pauses > 0));
  assert.equal(await fixture.audio.playEffect('forgeSuccess'), false);
  assert.equal(await fixture.audio.startLoop('forgeProcess'), false);
  assert.equal(await fixture.audio.playBgm(), false);
  assert.equal(fixture.sounds.length, existing);
  state.controller.setBackgrounded(false);
  assert.equal(fixture.sounds[0].plays, 2);
  assert.ok(fixture.sounds.slice(1).every(sound => sound.plays === 1));
  assert.deepEqual(fixture.writes, []);
  state.controller.destroy();
});

test('mute preference survives pause/resume and later unmuting restores BGM intent', async () => {
  const fixture = audioFixture(true);
  const state = setup({ audio: fixture.audio });
  await fixture.audio.playBgm();
  state.controller.setBackgrounded(true);
  state.controller.setBackgrounded(false);
  assert.equal(fixture.audio.isMuted(), true);
  assert.equal(fixture.sounds[0].plays, 0);
  assert.deepEqual(fixture.writes, []);
  fixture.audio.setMuted(false);
  assert.equal(fixture.sounds[0].plays, 1);
  assert.deepEqual(fixture.writes, [[MUTE_STORAGE_KEY, 'false']]);
  state.controller.destroy();
});

test('repeated lifecycle notifications do not duplicate playback or replace methods and preserve this binding', async () => {
  const calls = [];
  const audio = {};
  for (const name of ['playBgm', 'setSuspended', 'playEffect']) {
    audio[name] = function (...args) { assert.equal(this, audio); calls.push([name, ...args]); return Promise.resolve(true); };
  }
  const originals = { ...audio };
  const state = setup({ audio });
  state.controller.setBackgrounded(false);
  state.controller.setBackgrounded(true);
  state.controller.setBackgrounded(true);
  state.controller.setBackgrounded(false);
  state.controller.setBackgrounded(false);
  assert.equal(audio.playBgm, originals.playBgm);
  assert.equal(calls.filter(([name]) => name === 'playBgm').length, 1);
  assert.deepEqual(calls.filter(([name]) => name === 'setSuspended'), [['setSuspended', true], ['setSuspended', false]]);
  state.controller.destroy();
  state.controller.destroy();
  for (const name of Object.keys(originals)) assert.equal(audio[name], originals[name]);
  assert.equal(await audio.playEffect('uiTap'), true);
  assert.equal(state.controller.handleBack(), false);
});

test('returning to a logged-out or hidden dashboard does not restart BGM', () => {
  const fixture = audioFixture();
  const state = setup({ audio: fixture.audio });
  state.controller.setBackgrounded(true);
  state.elements.get('player-dashboard').style.display = 'none';
  state.controller.setBackgrounded(false);
  assert.equal(fixture.sounds.length, 0);
  state.controller.destroy();
});

test('browser API resolves lexical Router lazily without a native bridge or history navigation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app-shell.js'), 'utf8');
  const state = setup();
  const sandbox = { document: state.document };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  vm.runInNewContext("const Router = { currentPlayerTab: 'tasks', playerTab(tab) { this.currentPlayerTab = tab; } };", sandbox);
  assert.equal(sandbox.Router, undefined);
  assert.equal(sandbox.XianlaiShell.handleBack(), true);
  assert.equal(sandbox.XianlaiShell.handleBack(), false);
  assert.doesNotMatch(source, /addJavascriptInterface|history\.(?:back|go)|location\s*=/);
});
