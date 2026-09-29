const test = require('node:test');
const assert = require('node:assert/strict');
const { createController } = require('../demo-guide');
function fixture() {
  let entry = null, current = true, open = false, completed = 0;
  const actions = [], queue = new Map(), targets = ['armory', 'gift', 'equip'].map(name => ({
    name, isConnected: true, disabled: false, scrollIntoView() {},
  }));
  let serial = 0;
  const controller = createController({
    guide: { start(options) { entry = options; return true; }, destroy() { entry = null; } },
    schedule(callback) { queue.set(++serial, callback); return serial; },
    cancelSchedule(key) { queue.delete(key); },
  });
  const settings = {
    isCurrent: () => current, isArmoryOpen: () => open,
    getArmoryButton: () => targets[0], getGiftButton: () => targets[1], getEquipButton: () => targets[2],
    openArmory() { actions.push('armory'); open = true; },
    openGift() { actions.push('gift'); },
    equipGift() { actions.push('equip'); return true; },
    onComplete() { completed++; },
  };
  const flush = () => { const jobs = [...queue.values()]; queue.clear(); jobs.forEach(job => job()); };
  const click = async () => { const old = entry; if (await old.onChop()) old.onComplete(); flush(); };
  return { controller, settings, flush, click, actions, targets,
    get entry() { return entry; }, get completed() { return completed; },
    invalidate() { current = false; }, open() { open = true; } };
}
test('SSS tutorial drives actual armory, instance detail and equip in order', async () => {
  const f = fixture(); f.controller.start(f.settings); f.flush();
  assert.match(f.entry.title, /SSS/); assert.equal(f.entry.shape, 'rounded');
  assert.equal(f.entry.getTarget().name, 'armory');
  await f.click(); assert.equal(f.entry.getTarget().name, 'gift');
  await f.click(); assert.equal(f.entry.getTarget().name, 'equip');
  await f.click();
  assert.deepEqual(f.actions, ['armory', 'gift', 'equip']);
  assert.equal(f.completed, 1);
});
test('already-open armory skips first spotlight, cancellation and missing targets do not trap input', async () => {
  const f = fixture(); f.open(); f.controller.start(f.settings); f.flush();
  assert.equal(f.entry.getTarget().name, 'gift');
  f.controller.cancel(); assert.equal(f.entry, null);
  f.controller.start(f.settings); f.invalidate(); f.flush();
  assert.equal(f.entry, null);
  const g = fixture(); g.targets[0].isConnected = false;
  g.controller.start(g.settings); g.flush();
  assert.equal(g.entry, null);
});
test('failed equipment action cannot advance to completion', async () => {
  const f = fixture(); f.settings.equipGift = () => false;
  f.controller.start(f.settings); f.flush(); await f.click(); await f.click();
  assert.equal(await f.entry.onChop(), false);
  assert.equal(f.completed, 0);
});

function forgeFixture() {
  let entry = null, current = true, opened = 0, completed = 0, delay;
  const queue = new Map();
  let serial = 0;
  const target = { isConnected: true, disabled: false, scrollIntoView() {} };
  const controller = createController({
    guide: { start(options) { entry = options; return true; }, destroy() { entry = null; } },
    schedule(callback, ms) { delay = ms; queue.set(++serial, callback); return serial; },
    cancelSchedule(key) { queue.delete(key); },
  });
  const settings = {
    isCurrent: () => current, getForgeButton: () => target,
    openForge: () => { opened++; return true; }, onComplete: () => { completed++; },
  };
  return { controller, settings, target,
    flush() { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(callback => callback()); },
    invalidate() { current = false; },
    get entry() { return entry; }, get delay() { return delay; },
    get opened() { return opened; }, get completed() { return completed; } };
}
test('forge spotlight waits 300ms, opens the real entrance and never forces a draw', async () => {
  const f = forgeFixture();
  f.controller.startForge(f.settings);
  assert.equal(f.entry, null); assert.equal(f.delay, 300);
  f.flush();
  assert.equal(f.entry.title, '去天工开物，试试手气！');
  assert.equal(f.entry.description, '用开工石锻造仙斧，寻找更强的斧技。');
  assert.equal(f.entry.shape, 'rounded');
  assert.equal(await f.entry.onChop(), true);
  f.entry.onComplete();
  assert.equal(f.opened, 1); assert.equal(f.completed, 1);
});
test('forge spotlight cancels pending or active state and ignores stale callbacks', async () => {
  const f = forgeFixture();
  f.controller.startForge(f.settings); f.controller.cancel(); f.flush();
  assert.equal(f.entry, null);
  f.controller.startForge(f.settings); f.invalidate(); f.flush();
  assert.equal(f.entry, null);
  const g = forgeFixture();
  g.controller.startForge(g.settings); g.flush();
  const previous = g.entry;
  g.controller.cancel();
  assert.equal(g.entry, null);
  assert.equal(await previous.onChop(), false);
  previous.onComplete();
  assert.equal(g.completed, 0);
});
test('missing entrance and failed forge opening do not mark tutorial complete', async () => {
  const f = forgeFixture();
  f.target.isConnected = false; f.controller.startForge(f.settings); f.flush();
  assert.equal(f.entry, null);
  f.target.isConnected = true; f.settings.openForge = () => false;
  f.controller.startForge(f.settings); f.flush();
  assert.equal(await f.entry.onChop(), false);
  assert.equal(f.completed, 0);
});
