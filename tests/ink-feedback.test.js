const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const modalCss = fs.readFileSync(path.join(root, 'xianlai-v4.css'), 'utf8');
const pageCss = fs.readFileSync(path.join(root, 'ink-pages.css'), 'utf8');

test('every dismiss control uses the same licensed close symbol and safe native button', () => {
  const source = app.match(/function getFeatureIconPath\([^]*?\n\}/)[0];
  const scope = {};
  vm.runInNewContext(`${source};globalThis.closePath = getFeatureIconPath('icon-close');`, scope);
  assert.equal(scope.closePath, 'assets/runtime/ui/close.svg');
  const svg = fs.readFileSync(path.join(root, scope.closePath), 'utf8');
  assert.match(svg, /lucide-static v0.468.0/);
  assert.match(svg, /stroke="#43574d"/);
  assert.ok(fs.existsSync(path.join(root, 'assets/runtime/ui/LUCIDE-LICENSE.txt')));
  assert.match(app, /type="button" class="modal-close ink-close" aria-label="关闭"/);
  const mobile = fs.readFileSync(path.join(root, 'mobile-cultivation.js'), 'utf8');
  assert.doesNotMatch(mobile, /mobile-inventory-overlay|mobile-inventory-close/);
  assert.match(mobile, /assets\/runtime\/ink-controls\/return-arrow\.webp\?v=ink-controls-20260909/);
  assert.doesNotMatch(mobile, /assets\/runtime\/ui\/undo-2\.svg/);
  assert.match(modalCss, /\.modal \.ink-close\s*\{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(modalCss, /\.ink-close:focus-visible/);
  assert.match(modalCss, /\.ink-close:active:not\(:disabled\)/);
});

test('sign-in hints stay readable and display configured milestones', () => {
  const source = app.slice(app.indexOf('  _signInTimelineHtml()'), app.indexOf('  async claimSignIn('));
  assert.match(source, /rewards\.map\(reward => reward\.requiredDays\)\.join\(' \/ '\)/);
  assert.doesNotMatch(source, /3 \/ 7 \/ 14 \/ 28/);
  assert.match(source, /class="signin-reset"/);
  assert.match(pageCss, /\.signin-hint\s*\{[^}]*background: #f1f5f2;[^}]*color: #405648;[^}]*font-size: 12px;/);
});

test('chop effects share the batch speed and use matching preloaded runtime resources', () => {
  assert.match(app, /CultivationEffects\.playHit\(\{ scene, tree: treeIcon, intensity: 1, speed: timing\.speed \}\)/);
  const preload = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)[0];
  assert.match(preload, /assets\/runtime\/effects\/leaf-ink.webp/);
  assert.match(preload, /assets\/runtime\/ui\/close.svg/);
  assert.doesNotMatch(preload, /effects\/effect-(?:hit-spark|drop-glow|leaf-gold|leaf-green)/);
});
