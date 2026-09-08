const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const sourceMethod = name => app.match(new RegExp(`  ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  },`))?.[0];

function fixture() {
  const context = {
    Game: { state: { axeId: '51001', axeInstanceId: 'equipped', realmLevel: 1 },
      weapons: [{ id: 'spare', itemId: '51001' }, { id: 'equipped', itemId: '51001' }],
      equippedWeapon: { id: 'equipped', itemId: '51001' } },
    ITEMS: { 51001: { name: 'Test Axe', type: 5, quality: 1, icon: '', sellPrice: 2 } },
    QUALITY: { 1: { name: 'Common', color: '#999' } },
    InventoryNewState: { isWeaponNew: id => id === 'spare' },
    canEquipAxeQuality: () => true,
    renderItemIcon: id => `<img data-item="${id}" alt="">`,
    renderFeatureIcon: () => '<img alt="">',
    renderWeaponSkills: () => '<strong>Skill value</strong>',
    escapeHtml: text => String(text),
  };
  return context;
}

test('mobile library includes current UUID first without merging duplicate axes', () => {
  const source = sourceMethod('getMobileEquipmentPresentation');
  assert.ok(source, 'mobile presentation method exists');
  const ctx = fixture();
  const presentation = vm.runInNewContext(`({${source}}).getMobileEquipmentPresentation()`, ctx);
  assert.ok(presentation.weaponsHtml.indexOf("'equipped'") < presentation.weaponsHtml.indexOf("'spare'"));
  assert.equal((presentation.weaponsHtml.match(/class="item-slot/g) || []).length, 2);
  assert.equal((presentation.weaponsHtml.match(/mobile-current-badge/g) || []).length, 1);
  assert.match(presentation.weaponsHtml, /当前/);
  assert.match(presentation.html, /Skill value/);
  assert.match(presentation.html, /quality-item-name quality-1/);
});

test('equipped weapon cannot enter the sale confirmation', () => {
  let confirms = 0;
  const ctx = { ...fixture(), UI: { toast() {}, confirm() { confirms++; } } };
  vm.runInNewContext(`({${sourceMethod('sellItem')}}).sellItem('equipped')`, ctx);
  assert.equal(confirms, 0);
});

test('details protect current weapon and color ordinary item names by quality', () => {
  const source = sourceMethod('showItemDetail');
  assert.match(source, /isEquipped/);
  assert.match(source, /当前装备/);
  assert.match(source, /class="item-detail-name quality-item-name quality-\$\{def.quality\}"/);
});

test('actual current-weapon detail never offers equipment or sale actions', () => {
  let content = '';
  const ctx = fixture();
  ctx.Game._getItemQty = () => 1;
  ctx.InventoryNewState.clearWeapon = () => {};
  ctx.InventoryNewState.clearItem = () => {};
  ctx.renderAxeRealmRequirement = () => '<p>Realm</p>';
  ctx.getWeaponSkillLines = () => ['Skill'];
  ctx.UI = { modal(html) { content = html; } };
  vm.runInNewContext(`({renderInventory(){},currentInvTab:'weapons',${sourceMethod('showItemDetail')}}).showItemDetail('51001','equipped')`, ctx);
  assert.match(content, /weapon-current-label">当前装备/);
  assert.doesNotMatch(content, /onclick="PlayerView\.(sellItem|equipItem)/);
  vm.runInNewContext(`({renderInventory(){},currentInvTab:'weapons',${sourceMethod('showItemDetail')}}).showItemDetail('51001','spare')`, ctx);
  assert.match(content, /equipItem\('spare'/);
  assert.match(content, /sellItem\('spare'/);
});

test('mobile inventory is always items without resetting desktop tab preference', () => {
  const source = sourceMethod('renderInventory');
  assert.match(source, /MobileCultivation\.isMobile\(\)/);
  assert.match(source, /tab = 'items'/);
  assert.doesNotMatch(source, /this\.currentInvTab\s*=/);
});
