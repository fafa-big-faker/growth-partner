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
