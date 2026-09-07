const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('novelty module loads before app and game syncs successful inventory changes', () => {
  assert.match(html, /<script src="inventory-novelty\.js"><\/script>[\s\S]*<script src="app\.js"><\/script>/);
  assert.match(app, /const InventoryNewState = InventoryNovelty\.create/);
  assert.match(app, /_syncInventoryNovelty\(\)/);

  const grant = app.match(/async grantItem\(itemId, quantity = 1\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(
    grant,
    /(?:_syncInventoryNovelty|_applyInventoryChanges)[\s\S]*?kind: 'weapon'|kind: 'weapon'[\s\S]*?(?:_syncInventoryNovelty|_applyInventoryChanges)/,
  );
  assert.match(
    grant,
    /kind: 'item'[\s\S]*?(?:_syncInventoryNovelty|_applyInventoryChanges)|(?:_syncInventoryNovelty|_applyInventoryChanges)[\s\S]*?kind: 'item'/,
  );

  for (const method of ['composeMulti', 'forge', 'chopTen']) {
    const block = app.match(new RegExp(`async ${method}\\([^)]*\\)[\\s\\S]*?\\n  },`))?.[0] || '';
    assert.match(
      block,
      /_syncInventoryNovelty\(\)|_applyInventoryChanges\(/,
      `${method} must synchronize novelty after success`,
    );
  }
});

test('item and weapon slots render separate novelty keys and details clear them', () => {
  const inventory = app.match(/\n  renderInventory\(tab\)[\s\S]*?\n  },/)?.[0] || '';
  const detail = app.match(/showItemDetail\(itemId, instanceId = null\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(inventory, /isWeaponNew\(inv\.id\)[\s\S]*item-new-badge/);
  assert.match(inventory, /isItemNew\(inv\.itemId\)[\s\S]*item-new-badge/);
  assert.match(detail, /instanceId[\s\S]*clearWeapon\(instanceId\)/);
  assert.match(detail, /clearItem\(itemId\)/);
  assert.match(detail, /renderInventory\(this\.currentInvTab\)/);
  assert.match(css, /\.item-new-badge[\s\S]*top:[\s\S]*right:/);
});
