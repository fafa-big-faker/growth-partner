const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'upgrade_v5.sql');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('v5 migration defines atomic compose and claim reservation', () => {
  assert.equal(fs.existsSync(sqlPath), true);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.match(sql, /create or replace function compose_inventory_item/i);
  assert.match(sql, /quantity >= p_source_quantity/i);
  assert.match(sql, /create or replace function reserve_player_claim/i);
  assert.match(sql, /theme_reward_claims/i);
  assert.match(sql, /grant execute on function compose_inventory_item/i);
});

test('compose uses one guarded RPC and updates inventory locally', () => {
  assert.match(app, /dbClient\.rpc\('compose_inventory_item'/);
  assert.match(app, /PlayerView\._doCompose\('\$\{itemId\}',q,this\)/);

  const body = app.match(/async composeMulti\([\s\S]*?\n  },/)?.[0] || '';
  assert.match(body, /DB\.composeInventoryItem/);
  assert.match(body, /_setInventoryQuantity/);
  assert.doesNotMatch(body, /DB\.removeItem/);
  assert.doesNotMatch(body, /DB\.addItem/);
  assert.doesNotMatch(body, /this\.refresh\(/);

  const handler = app.match(/async _doCompose\([\s\S]*?\n  },/)?.[0] || '';
  assert.match(handler, /querySelectorAll\('\.modal-overlay'\)/);
});

test('same-id backpack axes remain equipable and sellable', () => {
  const detail = app.match(/showItemDetail\(itemId\)[\s\S]*?\n  },/)?.[0] || '';
  assert.doesNotMatch(detail, /const isEquipped = Game\.state\.axeId === itemId/);
  assert.match(detail, /PlayerView\.equipItem/);
  assert.match(detail, /PlayerView\.sellItem/);

  const sell = app.match(/async sellAxe\(itemId\)[\s\S]*?\n  },/)?.[0] || '';
  assert.doesNotMatch(sell, /装备中的斧头无法出售/);
  assert.match(sell, /if \(!removed\) return false/);
});

test('all high-risk resource entry points use stable operation keys', () => {
  const guardedKeys = [
    'cash:',
    'equip-axe',
    'sell-axe:',
    'shop:',
    'withdraw',
    'signin:',
    'achievement:',
    'task-reward:',
    'submission-reward:',
    'theme-reward:',
    'mail-reward:',
    'withdraw-review:',
    'daily-check-in',
    'task-submit:',
    'self-task-submit',
    'breakthrough',
    'tree-upgrade',
    'forge',
    'chop',
  ];

  for (const key of guardedKeys) {
    assert.equal(app.includes(key), true, `missing operation key: ${key}`);
  }
});

test('resource consumers check database results before success', () => {
  const breakthrough = app.match(/async breakThrough\(\)[\s\S]*?\n  },/)?.[0] || '';
  const treeUpgrade = app.match(/async upgradeTreeRealm\(\)[\s\S]*?\n  },/)?.[0] || '';
  const forge = app.match(/async forge\(\)[\s\S]*?\n  },/)?.[0] || '';

  assert.match(breakthrough, /const removed = await DB\.removeItem/);
  assert.match(breakthrough, /const saved = await DB\.updatePlayerState/);
  assert.match(treeUpgrade, /const removed = await DB\.removeItem/);
  assert.match(treeUpgrade, /const saved = await DB\.updatePlayerState/);
  assert.match(forge, /const removed = await DB\.removeItem/);
  assert.match(forge, /const granted = await DB\.addItem/);
});

test('stored rewards and withdrawal reviews reserve their state conditionally', () => {
  assert.match(app, /async claimSubmission\(id\)[\s\S]*?\.eq\('status', 'approved'\)/);
  assert.match(app, /async claimMail\(id\)[\s\S]*?\.eq\('is_claimed', false\)/);
  assert.match(app, /async reviewWithdrawalOnce\(id, status\)[\s\S]*?\.eq\('status', 'pending'\)/);
});
