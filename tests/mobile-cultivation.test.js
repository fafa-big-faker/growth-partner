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
});

test('mobile drawer moves the existing inventory and does not create a second grid', () => {
  assert.match(source, /move\(state\.inventory, state\.drawerBody\)/);
  assert.match(source, /move\(state\.equipment, state\.drawerBody\)/);
  assert.match(source, /move\(state\.forge, state\.actions\)/);
  assert.match(source, /marker\.replaceWith\(node\)/);
  assert.doesNotMatch(source, /id=["']inventory-grid["']/);
  assert.match(source, /overlay\.className = 'mobile-inventory-overlay'/);
  assert.doesNotMatch(source, /overlay\.className = 'modal-overlay'/);
});

test('inventory redraw and full cultivate refresh preserve drawer state and each tab scroll', () => {
  assert.match(source, /state\.scroll\[state\.tab\] = state\.grid\.scrollTop/);
  assert.match(source, /state\.grid\.scrollTop = state\.scroll\[state\.tab\] \|\| 0/);
  assert.match(source, /snapshot\.open && state\.mobile/);
  assert.match(app, /MobileCultivation\.unmount\(\{ preserve: true \}\)/);
  assert.match(app, /MobileCultivation\.mount\(mobileState \|\| \{\}\)/);
  const render = app.slice(app.indexOf('  renderInventory(tab) {'), app.indexOf('  showItemDetail('));
  assert.ok(render.indexOf('beforeInventoryRender(tab)') < render.indexOf('grid.innerHTML = html'));
  assert.ok(render.indexOf('refreshInventory(tab)') > render.indexOf('grid.innerHTML = html'));
});

test('drawer isolates background controls and gives nested details first Escape handling', () => {
  assert.match(source, /state\.dashboard\.inert = true/);
  assert.match(source, /state\.dashboard\.inert = state\.oldInert/);
  assert.match(source, /doc\.body\.style\.overflow = state\.oldOverflow/);
  assert.match(source, /if \(hasNestedModal\(\)\) \{[\s\S]*topModal\.classList\.contains\('modal-locked'\)/);
  assert.match(source, /event\.target === overlay && !hasNestedModal\(\)/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /event\.key === 'Tab'/);
  assert.match(source, /state\.returnFocus\?\.isConnected/);
  assert.match(source, /slot\.setAttribute\('tabindex', '0'\)/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
});

test('route, logout and responsive mode changes release moved DOM, observers and body lock', () => {
  assert.match(app, /tab !== 'cultivate'[\s\S]*MobileCultivation\.unmount\(\)/);
  assert.match(source, /state\.dashboard\.style\.display === 'none'\) unmount\(\)/);
  assert.match(source, /for \(const cleanup of state\.cleanups\) cleanup\(\)/);
  assert.match(source, /observer\.disconnect\(\)/);
  assert.match(source, /state\.overlay\.remove\(\)/);
  assert.match(source, /state\.stage\.replaceWith\(\.\.\.state\.stage\.childNodes\)/);
});

test('short portrait keeps actions and nav onscreen without independently changing tree anchors', () => {
  assert.match(css, /height: 100dvh/);
  assert.match(css, /min-height: 480px\) and \(orientation: portrait\)/);
  assert.match(css, /\.mobile-scene-stage \{ transform: scale\(0\.8\)/);
  assert.doesNotMatch(css, /--tree-left:|--character-left:|--character-bottom:|--tree-width:/);
  assert.match(css, /\.chop-circle-btn \{ grid-column: 2; grid-row: 1/);
  assert.match(css, /\.ten-toggle \{ grid-column: 1; grid-row: 1/);
  assert.match(css, /\.forge-btn \{ grid-column: 3; grid-row: 1/);
  assert.match(css, /\.mobile-scene-stage \.cult-tree \{ pointer-events: auto/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
