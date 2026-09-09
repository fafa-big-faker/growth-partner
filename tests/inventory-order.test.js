const test = require('node:test');
const assert = require('node:assert/strict');
const { sortItems, createStore } = require('../inventory-order.js');
const ids = items => items.map(item => String(item.itemId));
const definitions = { 2: { type: 2 }, 10: { type: 1 }, 3: { type: 1 }, 4: { type: 3 } };
const items = [{ itemId: '2', quantity: 7 }, { itemId: '10', quantity: 1 }, { itemId: '3', quantity: 4 }];
function memory() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}

test('material sorting compares type and item IDs numerically without changing quantities', () => {
  const before = JSON.stringify(items);
  assert.deepEqual(ids(sortItems(items, definitions)), ['3', '10', '2']);
  assert.equal(JSON.stringify(items), before);
  assert.equal(sortItems(items, definitions)[2], items[0]);
});

test('manual order persists per account, unseen kinds append, quantity updates keep position', () => {
  const storage = memory();
  const store = createStore({ storage, accountId: 'player' });
  assert.deepEqual(ids(store.order(items)), ['2', '10', '3']);
  store.arrange(items, definitions);
  const reopened = createStore({ storage, accountId: 'player' });
  assert.deepEqual(ids(reopened.order([{ itemId: '4', quantity: 3 }, ...items].reverse())), ['3', '10', '2', '4']);
  assert.deepEqual(ids(reopened.order([{ itemId: '2', quantity: 88 }, { itemId: '3', quantity: 1 }])), ['3', '2']);
  assert.deepEqual(ids(createStore({ storage, accountId: 'player_live' }).order(items)), ['2', '10', '3']);
});

test('missing or malformed storage does not prevent inventory use', () => {
  for (const raw of ['{', '{}', '[null,{},"2","2","bad"]']) {
    const store = createStore({ storage: { getItem: () => raw, setItem: () => { throw Error('blocked'); } } });
    assert.equal(store.order(items).length, 3);
    assert.deepEqual(ids(store.arrange(items, definitions)), ['3', '10', '2']);
  }
  assert.deepEqual(ids(createStore().arrange(items, definitions)), ['3', '10', '2']);
});

test('consumed kinds do not leave invisible ordering gaps', () => {
  const store = createStore();
  store.arrange(items, definitions);
  store.order(items.filter(item => item.itemId !== '3'));
  assert.deepEqual(ids(store.order(items)), ['10', '2', '3']);
});
