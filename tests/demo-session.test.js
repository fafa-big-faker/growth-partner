const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Demo = require('../demo-session');
const affixes = require('../weapon-affixes');
const tasks = require('../demo-tasks');
const config = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../game-config.js'), 'utf8') + '\nGAME_CONFIG');
const deps = { config, affixes, tasks, now: () => new Date('2026-09-29T12:00:00+08:00') };

test('demo entry and public password never authenticate real/admin identities', () => {
  assert.equal(Demo.isEntry('?demo=1'), true);
  for (const search of ['', '?demo=0', '?demo=true']) assert.equal(Demo.isEntry(search), false);
  assert.deepEqual(Demo.verify('player', '888'), { role: 'player', playerRole: 'demo', environment: 'demo' });
  assert.equal(Demo.verify('admin', '888'), null);
  assert.equal(Demo.verify('player', 'wrong'), null);
});

test('seed matches approved progression and contains a real, unequipped SSS instance', () => {
  const store = Demo.createStore(deps), state = store.getPlayerState();
  assert.deepEqual([state.level, state.exp, state.realmLevel, state.treeLevel, state.treeRealm, state.choppingCount, state.totalChops], [10, 0, 1, 14, 14, 999, 0]);
  assert.deepEqual(store.getInventory(), [
    { itemId: '30001', quantity: 1 }, { itemId: '30101', quantity: 1 },
    { itemId: '30201', quantity: 1 }, { itemId: '40001', quantity: 999 },
  ]);
  const weapons = store.getWeaponInstances();
  assert.equal(weapons.length, 2);
  assert.equal(weapons[0].itemId, '51001');
  assert.equal(state.axeInstanceId, weapons[0].id);
  assert.equal(weapons[1].itemId, '51002');
  assert.equal(affixes.getWeaponRating(weapons[1]).label, 'SSS');
  const roll = weapons[1].skillRolls[0];
  const row = config.buffTable.find(row => row.id === roll.buffRowId);
  assert.equal(row.buffQuality, 5);
  assert.ok(roll.values.value2 <= Number(row.value2Range.split(',').at(-1)));
  assert.equal(affixes.applyRewardMultipliers({ quality: 1, quantity: 1 }, [roll], () => 0).quantity, roll.values.value3);
});

test('sessions and returned snapshots have no shared mutable data', () => {
  const a = Demo.createStore(deps), b = Demo.createStore(deps);
  a.updatePlayerState({ choppingCount: 3 }); a.addItem('40001', 5);
  const leaked = a.getWeaponInstances(); leaked[1].skillRolls[0].values.value2 = 0;
  assert.equal(b.getPlayerState().choppingCount, 999);
  assert.equal(b.getInventory().find(row => row.itemId === '40001').quantity, 999);
  assert.ok(a.getWeaponInstances()[1].skillRolls[0].values.value2 > 0);
});

test('inventory, forge, equip, sell and compose use atomic validated local operations', () => {
  const s = Demo.createStore(deps);
  assert.equal(s.removeItem('30001', 2), null);
  assert.equal(s.addItem('30001', -2), null);
  assert.equal(s.getInventory()[0].quantity, 1);
  const result = s.forgeWeaponInstance('40001', 1, '51002', []);
  assert.equal(result.ok, true); assert.equal(result.costQuantity, 998);
  assert.equal(s.equipWeaponInstance(result.weapon.id).ok, true);
  assert.equal(s.sellWeaponInstance(result.weapon.id, 10).code, 'equipped');
  assert.equal(s.equipWeaponInstance('missing').ok, false);
  s.equipWeaponInstance(s.getWeaponInstances()[0].id);
  assert.equal(s.sellWeaponInstance(result.weapon.id, 10).coin, 10);
  assert.equal(s.sellWeaponInstance(result.weapon.id, 10).ok, false);
  s.addItem('10001', 10);
  assert.equal(s.composeInventoryItem('10001', 11, '10002', 1).ok, false);
  assert.deepEqual(s.composeInventoryItem('10001', 10, '10002', 1), { ok: true, sourceQuantity: 0, targetQuantity: 1 });
  assert.equal(s.forgeWeaponInstance('40001', 9999, '51002', []).ok, false);
});

test('one-time tasks start fresh; explicit local review/claim works once and date stays playable', () => {
  const s = Demo.createStore(deps);
  assert.equal(s.getTasks().length, 9);
  assert.deepEqual(s.getSubmissions(), []);
  assert.equal(s.getTasks('theme').every(t => t.themeStart <= '2026-09-29' && t.themeEnd >= '2026-09-29'), true);
  const task = s.getTasks('weekly')[0];
  const sub = s.submitTask({ taskId: task.id, taskType: task.taskType, description: '演示完成', rewardChopping: 99999 });
  assert.equal(sub.status, 'pending');
  assert.equal(s.submitTask({ taskId: task.id, description: 'duplicate' }), null);
  assert.equal(s.claimSubmission(sub.id), false);
  assert.equal(s.simulateReview(sub.id), true);
  assert.equal(s.getSubmissions()[0].rewardChopping, task.rewardChopping);
  assert.equal(s.claimSubmission(sub.id), true);
  assert.equal(s.claimSubmission(sub.id), false);
  assert.deepEqual(Demo.createStore(deps).getSubmissions(), []);
});

test('daily check-in and claims cannot be repeated; mail/withdrawals remain local', () => {
  const s = Demo.createStore(deps);
  const reward = [{ itemId: '1', count: 10 }, { itemId: '40002', count: 1 }];
  assert.equal(s.dailyCheckIn(reward).ok, true);
  assert.equal(s.dailyCheckIn(reward).code, 'already_checked');
  assert.equal(s.getPlayerState().choppingCount, 1009);
  assert.equal(s.reservePlayerClaim('achievement', '1').ok, true);
  assert.equal(s.reservePlayerClaim('achievement', '1').code, 'already_claimed');
  s.sendMail('演示', '本地', []);
  const mail = s.getMails()[0]; s.markMailRead(mail.id); s.deleteMails([mail.id]);
  assert.deepEqual(s.getMails(), []);
  assert.ok(s.requestWithdrawal(100).id);
  assert.equal(s.getWithdrawals()[0].status, 'pending');
});

test('facade fails closed, preserves real methods outside demo, and resets on each login', async () => {
  let remoteCalls = 0;
  const db = { playerRole: 'player', setPlayerRole(role) { this.playerRole = role; },
    async getPlayerState() { remoteCalls++; return { level: 1 }; },
    async dangerousFutureMethod() { remoteCalls++; },
  };
  const session = Demo.install(db, { ...deps, entry: true });
  assert.throws(() => db.getPlayerState(), /演示/);
  session.reset(); db.setPlayerRole('demo');
  assert.equal((await db.getPlayerState()).level, 10);
  assert.throws(() => db.dangerousFutureMethod(), /演示/);
  assert.throws(() => db.setPlayerRole('player_live'), /演示/);
  session.store.updatePlayerState({ level: 99 });
  session.reset();
  assert.equal((await db.getPlayerState()).level, 10);
  assert.equal(session.afterTenClosed('anything'), true);
  assert.equal(session.afterTenClosed('anything'), false);
  session.reset();
  assert.equal(session.afterTenClosed(session.giftId), false);
  session.end();
  assert.throws(() => db.getPlayerState(), /演示/);
  assert.equal(remoteCalls, 0);
  const real = { playerRole: 'player', async getPlayerState() { remoteCalls++; return 42; } };
  Demo.install(real, { ...deps, entry: false });
  assert.equal(await real.getPlayerState(), 42);
  assert.equal(remoteCalls, 1);
});
