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
  assert.match(body, /_applyInventoryChanges/);
  assert.doesNotMatch(body, /DB\.removeItem/);
  assert.doesNotMatch(body, /DB\.addItem/);
  assert.doesNotMatch(body, /this\.refresh\(/);

  const handler = app.match(/async _doCompose\([\s\S]*?\n  },/)?.[0] || '';
  assert.match(handler, /querySelectorAll\('\.modal-overlay'\)/);
});

test('compose preserves the Supabase error code for diagnosis', () => {
  const rpc = app.match(/async composeInventoryItem\([\s\S]*?\n  },/)?.[0] || '';
  assert.match(rpc, /code:\s*error\.code\s*\|\|\s*'network_error'/);
  assert.match(rpc, /message:\s*error\.message\s*\|\|\s*''/);
});

test('same-id backpack axes remain equipable and sellable', () => {
  const detail = app.match(/showItemDetail\(itemId, instanceId = null\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(app, /Game\.weapons\.filter\(weapon => weapon\.id !== Game\.state\.axeInstanceId\)/);
  assert.match(detail, /PlayerView\.equipItem/);
  assert.match(detail, /PlayerView\.sellItem/);

  const sell = app.match(/async sellAxe\(instanceId\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(sell, /DB\.sellWeaponInstance\(instanceId/);
  assert.match(sell, /entry\.id !== instanceId/);
});

test('cultivate redraw preserves the selected inventory tab', () => {
  const render = app.match(/async renderCultivate\(\)[\s\S]*?\n  },/)?.[0] || '';
  assert.match(render, /currentInvTab === 'items'/);
  assert.match(render, /currentInvTab === 'weapons'/);
  assert.match(render, /renderInventory\(this\.currentInvTab\)/);
  assert.doesNotMatch(render, /renderInventory\('items'\)/);
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
  assert.match(forge, /WeaponAffixes\.rollSkills/);
  assert.match(forge, /DB\.forgeWeaponInstance/);
  assert.doesNotMatch(forge, /DB\.removeItem|DB\.addItem/);
});

test('stored rewards and withdrawal reviews reserve their state conditionally', () => {
  assert.match(app, /async claimSubmission\(id\)[\s\S]*?\.eq\('status', 'approved'\)/);
  assert.match(app, /async claimMail\(id\)[\s\S]*?\.eq\('is_claimed', false\)/);
  assert.match(app, /async reviewWithdrawalOnce\(id, status\)[\s\S]*?\.eq\('status', 'pending'\)/);
});
