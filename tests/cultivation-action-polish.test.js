const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('cultivation action uses the ink button and a digits-only count', () => {
  const render = app.match(/\n  async renderCultivate\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(render, /class="chop-ink-ripple"/);
  assert.match(render, /class="chop-count-badge">\$\{Game\.state\.choppingCount\}<\/span>/);
  assert.doesNotMatch(render, />余\s*\$\{Game\.state\.choppingCount\}/);
  assert.match(styles, /ui\/chop-button-bg\.webp/);
  assert.match(styles, /@keyframes chop-axe-wiggle/);
  assert.match(styles, /@keyframes chop-axe-strike/);
  assert.match(styles, /@keyframes chop-ink-ripple/);
  assert.match(app, /classList\.add\('is-striking'\)/);
  assert.match(styles, /\.chop-circle-btn:hover:not\(:disabled\):not\(\.is-striking\) \.chop-axe-img/);
  assert.match(styles, /\.chop-circle-btn\.is-striking \.chop-axe-img/);
  assert.match(styles, /\.chop-circle-btn\.is-striking \.chop-ink-ripple/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{\s*\.tree-upgrade-hint \{\s*animation: none;\s*\}\s*\}\s*$/);
  assert.match(html, /styles\.css\?v=cc7329f-motion-fix/);
  assert.match(html, /app\.js\?v=cc7329f-motion-fix/);
});

test('tree hint and forge entrance stay contextual and uncluttered', () => {
  const render = app.match(/\n  async renderCultivate\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  const refresh = app.match(/\n  refreshInventoryConsumers\(\)\s*\{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(render, /GameplayRules\.canUpgradeTreeRealm\(nextTreeRealm, Game\.inventory\)/);
  assert.match(render, /tree-upgrade-hint/);
  assert.match(render, />可升级<\/span>/);
  assert.doesNotMatch(render, /forge-btn-stone/);
  assert.match(refresh, /GameplayRules\.canUpgradeTreeRealm\(nextTreeRealm, Game\.inventory\)/);
  assert.match(refresh, /tree-upgrade-hint/);
  assert.match(styles, /@keyframes tree-upgrade-float/);
  assert.match(styles, /\.forge-btn[\s\S]*?overflow:\s*visible/);
});

test('new action artwork is included in the first-login preload', () => {
  const selector = app.match(/function getInitialGameImageAssets\([\s\S]*?\n\}/)?.[0] || '';
  assert.match(selector, /'chop-button-bg'/);
  assert.match(selector, /`ui\/\$\{name\}\.webp`/);
});
