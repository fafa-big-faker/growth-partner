const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');


test('cultivation scene places the animated cultivator before the tree', () => {
  const render = app.match(/async renderCultivate\(\)[\s\S]*?\n  },/)?.[0] || '';
  const characterIndex = render.indexOf('id="cultivator-sprite"');
  const treeIndex = render.indexOf('id="tree-icon"');

  assert.ok(characterIndex >= 0, 'missing cultivator sprite image');
  assert.ok(treeIndex > characterIndex, 'tree must render to the character\'s right');
  assert.match(render, /CultivatorAnimator\.attach/);
  assert.doesNotMatch(render, /character-paint\.jpg/);
});


test('single and ten chop paths play the cultivator action', () => {
  const single = app.match(/async doChop\(\)[\s\S]*?\n  },/)?.[0] || '';
  const ten = app.match(/async doChopTen\(\)[\s\S]*?\n  },/)?.[0] || '';

  assert.match(single, /CultivatorAnimator\.playChop\(\)/);
  assert.match(single, /await characterAnimation/);
  assert.match(ten, /CultivatorAnimator\.playChop\(\{\s*resumeIdle:\s*false\s*\}\)/);
  assert.match(ten, /await characterAnimation/);
  assert.match(ten, /CultivatorAnimator\.resumeIdle\(\)/);
});


test('backpack artwork grows inside unchanged slots', () => {
  assert.match(
    css,
    /\.cult-inventory \.inventory-grid:not\(\.weapons-grid\)[\s\S]*?\.item-icon-img[\s\S]*?width:\s*70%[\s\S]*?height:\s*70%/,
  );
  const slotRule = css.match(/\.item-slot\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(slotRule, /aspect-ratio:\s*1/);
});
