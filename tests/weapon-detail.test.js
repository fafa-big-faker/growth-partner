const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('weapon details prioritize requirements, skills, and lore without quantity', () => {
  const detail = app.match(/showItemDetail\(itemId, instanceId = null\)[\s\S]*?\n  },/)?.[0] || '';
  const weaponBranch = detail.match(/if \(def\.type === 5\) \{[\s\S]*?title: '仙斧情报'[\s\S]*?return;/)?.[0] || '';
  assert.match(weaponBranch, /weapon-detail-identity/);
  assert.match(weaponBranch, /weapon-skill-panel/);
  assert.match(weaponBranch, /weapon-lore/);
  assert.match(weaponBranch, /getWeaponSkillLines\(weapon\)/);
  assert.doesNotMatch(weaponBranch, /数量：|拥有数量/);
  assert.match(app, /function renderAxeRealmRequirement\(quality, realmLevel/);
  assert.match(weaponBranch, /renderAxeRealmRequirement\(def\.quality, Game\.state\.realmLevel\)/);
  assert.doesNotMatch(weaponBranch, /尚未满足穿戴要求|可穿戴|（当前：/);
  assert.match(css, /\.axe-realm-requirement\s*\{/);
  assert.match(css, /\.axe-realm-requirement\.is-locked\s*\{/);
  assert.match(css, /\.weapon-skill-panel\s*\{/);
});

test('forge results use the fixed equip slot without changing inventory detail requirements', () => {
  const showForge = app.match(/\r?\n  showForge\(\) \{[\s\S]*?\r?\n  },\r?\n\r?\n  \/\/ 十连砍/)?.[0] || '';
  assert.match(showForge, /id="forge-result-action"/);
  assert.match(showForge, /getMinRealmForAxeQuality\(result\.quality\)/);
  assert.match(showForge, /resultAction\.innerHTML = canEquip \?/);
  assert.match(showForge, /forge-result-equip[\s\S]*?>立即装备<\/button>/);
  assert.match(showForge, /forge-result-locked[\s\S]*?及以上可装备/);
  assert.doesNotMatch(showForge, /renderAxeRealmRequirement|showStored|仙阶限制：需达到/);
});
