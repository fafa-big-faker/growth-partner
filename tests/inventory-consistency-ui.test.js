const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function method(pattern) {
  return app.match(pattern)?.[0] || '';
}

test('inventory reads defensively aggregate duplicate item rows', () => {
  const body = method(/async getInventory\(\)[\s\S]*?\n  },/);
  assert.match(body, /new Map\(\)/);
  assert.match(body, /String\(item\.item_id\)/);
  assert.match(body, /current\s*\+\s*quantity/);
  assert.doesNotMatch(body, /return data\.map/);
});

test('ordinary item additions and removals use atomic RPCs', () => {
  const add = method(/async addItem\(itemId, quantity = 1\)[\s\S]*?\n  },/);
  const remove = method(/async removeItem\(itemId, quantity = 1\)[\s\S]*?\n  },/);

  assert.match(add, /dbClient\.rpc\('add_inventory_item'/);
  assert.match(add, /p_user_role:\s*this\.playerRole/);
  assert.match(add, /p_item_id:\s*String\(itemId\)/);
  assert.doesNotMatch(add, /\.maybeSingle\(\)/);
  assert.match(remove, /dbClient\.rpc\('remove_inventory_item'/);
  assert.doesNotMatch(remove, /\.maybeSingle\(\)/);
});

test('one inventory synchronization path updates every visible consumer', () => {
  const apply = method(/\n  _applyInventoryChanges\(changes\) \{[\s\S]*?\n  },/);
  const refresh = method(/\n  refreshInventoryConsumers\(\) \{[\s\S]*?\n  },/);

  assert.match(apply, /_setInventoryQuantity/);
  assert.match(apply, /_syncInventoryNovelty/);
  assert.match(apply, /PlayerView\.refreshInventoryConsumers/);
  assert.match(apply, /UI\._updateAchBadge/);
  assert.match(refresh, /forge-btn-stone/);
  assert.match(refresh, /forge-material-cost/);
  assert.match(refresh, /forge-ok/);
  assert.match(refresh, /renderInventory\(this\.currentInvTab\)/);
});

test('compose and forge apply authoritative quantities before returning success', () => {
  for (const methodName of ['composeMulti', 'forge']) {
    const body = method(new RegExp(`async ${methodName}\\([^)]*\\)[\\s\\S]*?\\n  },`));
    assert.match(body, /_applyInventoryChanges/);
  }

  const compose = method(/async composeMulti\(itemId, qty\)[\s\S]*?\n  },/);
  assert.ok(
    compose.indexOf('_applyInventoryChanges') < compose.indexOf('合成成功'),
    'composition must synchronize inventory before the success toast',
  );
});
