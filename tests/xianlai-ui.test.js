const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'xianlai-ui.css'), 'utf8');

test('ink frame assets resolve to local runtime files', () => {
  const assets = [...css.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);
  assert.equal(new Set(assets).size, 6);
  for (const asset of assets) {
    assert.ok(asset.startsWith('assets/runtime/v3/ui/'));
    assert.ok(fs.statSync(path.join(root, asset)).size > 0, asset);
  }
});

test('frame layer does not take layout space or intercept underlying controls', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
  const decoration = rules.filter(([, selector]) => selector.includes('::before'));
  assert.ok(decoration.length > 0);
  for (const [, , body] of decoration) {
    if (!body.includes('content:')) continue;
    assert.match(body, /position:\s*absolute/);
    assert.match(body, /pointer-events:\s*none/);
    assert.match(body, /z-index:\s*-1/);
  }
  for (const [, selector, body] of rules) {
    const changesFrameContainer = selector.split(',').some(part =>
      /^#player-dashboard\s+\.(?:cult-topbar|cult-status|cult-inventory|equip-info-bar|bottom-nav)\s*$/.test(part.trim()));
    if (!changesFrameContainer) continue;
    assert.doesNotMatch(body, /(?:^|[;\n])\s*(?:width|height|min-height|max-height|padding|margin|gap|display|grid-template-columns|flex)\s*:/);
  }
  assert.doesNotMatch(css, /#player-dashboard\s+\.(?:cult-char|cult-tree|cult-scene|chop-circle-btn|item-slot)\b/);
});

test('navigation retains a motion-free selected state under reduced motion', () => {
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.nav-item\.active \.nav-icon-img/);
  assert.match(reduced, /\.nav-item:hover \.nav-icon-img/);
  assert.match(reduced, /\.nav-item:active \.nav-icon-img/);
  assert.match(reduced, /transform:\s*none/);
  assert.match(reduced, /transition:\s*none/);
  assert.match(css, /\.nav-item\.active \.nav-text\s*\{\s*color:/);
});
