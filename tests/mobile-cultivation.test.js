const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createController } = require('../mobile-cultivation');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'mobile-cultivation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'mobile-cultivation.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('controller safely ignores a non-cultivation page and repeated cleanup', () => {
  const controller = createController({ document: { getElementById: () => null } });
  assert.doesNotThrow(() => controller.mount());
  assert.deepEqual(controller.unmount({ preserve: true }), {});
  assert.equal(controller.open(), false);
  assert.equal(controller.close(), false);
  assert.doesNotThrow(() => controller.beforeInventoryRender('weapons'));
  assert.doesNotThrow(() => controller.refreshInventory('weapons'));
  assert.doesNotThrow(() => controller.refreshEquipment({ html: '', weaponsHtml: '' }));
  assert.doesNotThrow(() => controller.setPage('tasks'));
  assert.equal(controller.isMobile(), false);
  assert.equal(controller.isEnabled(), false);
});

test('mobile media detection works before cultivation is mounted', () => {
  const queries = [];
  const controller = createController({ document: { getElementById: () => null }, matchMedia(query) { queries.push(query); return { matches: true }; } });
  assert.equal(controller.isMobile(), true);
  assert.match(queries[0], /max-width: 719px/);
  assert.match(queries[0], /max-height: 500px/);
});

test('shared layout is enabled on desktop without pretending it is a mobile viewport', () => {
  const controller = createController({ document: { getElementById: () => ({}) }, matchMedia: () => ({ matches: false }) });
  assert.equal(controller.isMobile(), false);
  assert.equal(controller.isEnabled(), true);
});

test('dual columns move the unique item grid and original actions without a modal drawer', () => {
  assert.match(source, /move\(state\.grid, state\.itemsPane\)/);
  assert.match(source, /move\(state\.chop, navigation\.nav\)/);
  assert.match(source, /move\(state\.ten, navigation\.nav\)/);
  assert.match(source, /move\(state\.forge, navigation\.nav\)/);
  assert.match(source, /marker\.replaceWith\(node\)/);
  assert.doesNotMatch(source, /id=["']inventory-grid["']/);
  assert.match(source, /id="mobile-equipment-content"/);
  assert.match(source, /id="mobile-weapon-grid"/);
  assert.doesNotMatch(source, /mobile-inventory-overlay|drawerBody|doc\.body\.style\.overflow/);
});

test('inventory redraw and full cultivate refresh preserve independent scroll and library mode', () => {
  assert.match(source, /state\.scroll\[state\.tab\] = state\.grid\.scrollTop/);
  assert.match(source, /state\.grid\.scrollTop = state\.scroll\[state\.tab\] \|\| 0/);
  assert.match(source, /state\.rightScroll\[state\.mode\] = host\.scrollTop/);
  assert.match(source, /restore\.mode === 'library'/);
  assert.match(source, /presentation\.weaponsHtml !== state\.weaponsHtml/);
  assert.match(source, /state\.weaponGrid\.scrollTop = state\.rightScroll\.library/);
  assert.match(app, /MobileCultivation\.unmount\(\{ preserve: true \}\)/);
  assert.match(app, /MobileCultivation\.mount\(mobileState \|\| \{\}, \{/);
  assert.match(app, /onModeChange:/);
  const render = app.slice(app.indexOf('  renderInventory(tab) {'), app.indexOf('  showItemDetail('));
  assert.ok(render.indexOf('beforeInventoryRender(tab)') < render.indexOf('grid.innerHTML = html'));
  assert.ok(render.indexOf('refreshInventory(tab)') > render.indexOf('grid.innerHTML = html'));
  assert.match(render, /MobileCultivation\.isEnabled\(\)\) tab = 'items'/);
});

test('keyboard details retain the library and do not duplicate native button activation', () => {
  assert.match(source, /event\.key === 'Escape' && !modal\.classList\.contains\('modal-locked'\)/);
  assert.match(source, /modal\.remove\(\);\s*state\.modeButton\.focus/);
  assert.match(source, /event\.key === 'Tab'/);
  assert.match(source, /slot\.setAttribute\('tabindex', '0'\)/);
  assert.match(source, /slot\.tagName !== 'BUTTON'/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
});

test('navigation persists across routes, switches to a return icon and fully cleans up on logout', () => {
  assert.match(app, /MobileCultivation\.setPage\(tab\)/);
  assert.match(source, /tab !== 'cultivate' && state\) unmount\(\{ preserve: true \}\)/);
  assert.match(source, /navigation\?\.dashboard\.style\.display === 'none'\) unmount\(\)/);
  assert.match(source, /for \(const cleanup of state\.cleanups\) cleanup\(\)/);
  assert.match(source, /for \(const cleanup of navigation\.cleanups\) cleanup\(\)/);
  assert.match(source, /observer\.disconnect\(\)/);
  assert.match(source, /state\.dual\.remove\(\)/);
  assert.match(source, /state\.stage\.replaceWith\(\.\.\.state\.stage\.childNodes\)/);
  assert.match(source, /assets\/runtime\/ui\/undo-2\.svg/);
  assert.match(source, /classList\.toggle\('mobile-return-button', mobile && !cultivation\)/);
  assert.match(source, /classList\.remove\('mobile-return-button'\)/);
  assert.match(source, /navigation\.centerText\.textContent = navigation\.originalText/);
  assert.match(source, /state\.onModeChange\?\.\(\)/);
  assert.doesNotMatch(source, /env\.PlayerView|env\.Router/);
});

test('short portrait keeps dual panes and actions onscreen without changing relative tree anchors', () => {
  assert.match(css, /height: 100dvh/);
  assert.match(css, /min-height: 480px\) and \(orientation: portrait\)/);
  assert.match(css, /\.mobile-scene-stage \{ transform: scale\(0\.8\)/);
  assert.doesNotMatch(css, /--tree-left:|--character-left:|--character-bottom:|--tree-width:/);
  assert.match(css, /\.chop-circle-btn \{ grid-column: 2; grid-row: 1 \/ 3/);
  assert.match(css, /\.ten-toggle \{ grid-column: 1; grid-row: 1/);
  assert.match(css, /\.forge-btn \{ grid-column: 3; grid-row: 1/);
  assert.match(css, /\.mobile-scene-stage \.cult-tree \{ pointer-events: auto/);
  assert.match(css, /grid-template-columns: minmax\(0, 3fr\) minmax\(0, 2fr\)/);
  assert.match(css, /#mobile-weapon-grid \{ grid-template-columns: repeat\(2/);
  assert.match(css, /@media \(max-width: 374px\)/);
  assert.match(css, /inventory-paper\.webp\?v=xianlai-v7-20260909/);
  assert.match(css, /scrollbar-color: #799085 transparent/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('unified paper and inventory dimensions are bounded independently from screen height', () => {
  assert.match(css, /@media screen/);
  for (const height of [180, 224, 280]) assert.ok(css.includes(`--inventory-height: ${height}px`));
  assert.match(css, /grid-template-rows: 44px minmax\(166px, 1fr\) 50px var\(--inventory-height\)/);
  assert.doesNotMatch(css, /minmax\(172px, \.92fr\)/);
  const paperRules = [...css.matchAll(/\.bottom-nav::before\s*\{([^}]+)\}/g)].map(match => match[1]);
  assert.equal(paperRules.length, 2);
  for (const rule of paperRules) {
    assert.match(rule, /max-height: (?:64|72)px/);
    assert.doesNotMatch(rule, /(?:^|;)\s*(?:min-|max-)?height:[^;]*env\(/);
  }
  assert.match(paperRules[0], /bottom: env\(safe-area-inset-bottom\)/);
});
