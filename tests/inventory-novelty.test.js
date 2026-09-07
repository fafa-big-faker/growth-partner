const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { create } = require(path.join(__dirname, '..', 'inventory-novelty.js'));

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('first sync creates a baseline and later quantity increases become new', () => {
  const tracker = create({ storage: createStorage() });
  tracker.setRole('player');
  tracker.sync([{ itemId: '40001', quantity: 2 }], []);
  assert.equal(tracker.isItemNew('40001'), false);

  tracker.sync([{ itemId: '40001', quantity: 3 }], []);
  assert.equal(tracker.isItemNew('40001'), true);
  tracker.clearItem('40001');
  assert.equal(tracker.isItemNew('40001'), false);

  tracker.sync([{ itemId: '40001', quantity: 1 }], []);
  tracker.sync([{ itemId: '40001', quantity: 2 }], []);
  assert.equal(tracker.isItemNew('40001'), true);
});

test('weapon novelty is tracked by instance rather than item id', () => {
  const tracker = create({ storage: createStorage() });
  tracker.setRole('player');
  tracker.sync([], [{ id: 'axe-a', itemId: '51001' }]);
  assert.equal(tracker.isWeaponNew('axe-a'), false);

  tracker.sync([], [
    { id: 'axe-a', itemId: '51001' },
    { id: 'axe-b', itemId: '51001' },
  ]);
  assert.equal(tracker.isWeaponNew('axe-a'), false);
  assert.equal(tracker.isWeaponNew('axe-b'), true);
  tracker.clearWeapon('axe-b');
  assert.equal(tracker.isWeaponNew('axe-b'), false);
});

test('roles are isolated and pending novelty survives tracker recreation', () => {
  const storage = createStorage();
  const tracker = create({ storage });
  tracker.setRole('player');
  tracker.sync([{ itemId: '10001', quantity: 1 }], []);
  tracker.sync([{ itemId: '10001', quantity: 2 }], []);
  assert.equal(tracker.isItemNew('10001'), true);

  tracker.setRole('player_live');
  tracker.sync([{ itemId: '10001', quantity: 7 }], []);
  assert.equal(tracker.isItemNew('10001'), false);

  const reloaded = create({ storage });
  reloaded.setRole('player');
  assert.equal(reloaded.isItemNew('10001'), true);
  reloaded.setRole('player_live');
  assert.equal(reloaded.isItemNew('10001'), false);
});

test('storage failures fall back to role-scoped in-memory state', () => {
  const brokenStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const tracker = create({ storage: brokenStorage });
  tracker.setRole('player');
  tracker.sync([{ itemId: '20001', quantity: 1 }], []);
  tracker.sync([{ itemId: '20001', quantity: 2 }], []);
  assert.equal(tracker.isItemNew('20001'), true);
  tracker.clearItem('20001');
  assert.equal(tracker.isItemNew('20001'), false);
});
