const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const WeaponAffixes = require('../weapon-affixes');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const mobile = fs.readFileSync(path.join(root, 'mobile-cultivation.css'), 'utf8');
const renderer = app.match(/^function renderWeaponRating\([^]*?^\}/m)?.[0];
const weapon = quality => ({ itemId: '55001', quality: 5, skillRolls: [{ description: 'Skill', buffQuality: quality }] });

test('shared rating renderer uses each saved instance and actual bitmap', () => {
  assert.ok(renderer);
  const render = vm.runInNewContext(`${renderer}; renderWeaponRating`, { WeaponAffixes });
  for (const [i, label] of ['B', 'A', 'S', 'SS', 'SSS'].entries()) {
    const html = render(weapon(i + 1));
    assert.match(html, new RegExp(`data-rating="${label}"`));
    assert.ok(html.includes(`rating-${label.toLowerCase()}.webp?v=weapon-ratings-20260909`));
    assert.ok(fs.statSync(path.join(root, `assets/runtime/weapon-ratings/rating-${label.toLowerCase()}.webp`)).size > 0);
    assert.match(html, /weapon-rating-inline/);
    assert.match(html, /role="img"/);
    assert.match(html, /weapon-rating-fallback[^>]*hidden/);
  }
  assert.match(render(null, 'slot'), /weapon-rating-slot[^]*data-rating="B"/);
  assert.match(render(weapon(4), 'invalid'), /weapon-rating-inline/);
});

test('same versioned assets are preloaded and all requested surfaces render ratings', () => {
  const preload = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)?.[0] || '';
  assert.match(preload, /const ratingFiles = \['b', 'a', 's', 'ss', 'sss'\]/);
  assert.match(preload, /assets\/runtime\/weapon-ratings\/rating-\$\{label\}\.webp\?v=weapon-ratings-20260909/);
  assert.match(preload, /AssetPreloader\.collect\(\[[^]*ratingFiles/);
  assert.match(app, /mobile-equipped-quality[^]*?renderWeaponRating\(current\)/);
  assert.match(app, /forge-result-quality[^]*?renderWeaponRating\(result\.weapon\)/);
  assert.match(app, /renderWeaponRating\(weapon, 'slot'\)/);
  assert.match(app, /renderWeaponRating\(inv, 'slot'\)/);
});

test('rating slots and top status markers have independent reserved space', () => {
  assert.match(styles, /\.weapon-rating-slot\s*\{[^}]*height:\s*18px/s);
  assert.match(styles, /\.weapon-rating \[hidden\]\s*\{\s*display:\s*none/);
  assert.match(mobile, /#mobile-weapon-grid \.item-icon\s*\{[^}]*padding:\s*5px 4px 22px/s);
  assert.match(mobile, /\.weapon-slot-status\s*\{[^}]*top:\s*4px/s);
  assert.match(mobile, /\.mobile-equipped-quality\s*\{[^}]*display:\s*flex/s);
});
