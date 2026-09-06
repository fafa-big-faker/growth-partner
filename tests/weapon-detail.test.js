const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('weapon details prioritize requirements, skills, and lore without quantity', () => {
  const detail = app.match(/showItemDetail\(itemId\)[\s\S]*?\n  },/)?.[0] || '';
  const weaponBranch = detail.match(/if \(def\.type === 5\) \{[\s\S]*?title: '仙斧情报'[\s\S]*?return;/)?.[0] || '';
  assert.match(weaponBranch, /weapon-detail-identity/);
  assert.match(weaponBranch, /weapon-skill-panel/);
  assert.match(weaponBranch, /weapon-lore/);
  assert.doesNotMatch(weaponBranch, /数量：|拥有数量/);
  assert.match(css, /\.weapon-skill-panel\s*\{/);
});
