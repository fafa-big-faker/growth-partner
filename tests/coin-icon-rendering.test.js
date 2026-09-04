const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('shop balance uses the configured coin image', () => {
  assert.match(source, /res-icon">\$\{renderItemIcon\('0', '🪙', 'res-coin-img'\)\}/);
  assert.doesNotMatch(source, /res-icon">🪙<\/span><span class="res-val" id="shop-coin-balance"/);
});

test('both weapon sell button branches use the configured coin image', () => {
  const matches = source.match(/出售 \+\$\{renderItemIcon\('0', '🪙', 'item-icon-xs'\)\} \$\{def\.sellPrice\}/g) || [];
  assert.equal(matches.length, 2);
  assert.doesNotMatch(source, /出售 \+\$\{def\.sellPrice\}🪙/);
});
