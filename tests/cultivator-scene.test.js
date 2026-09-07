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
  assert.doesNotMatch(render, /id="cultivator-weapon"/);
  assert.doesNotMatch(css, /\.cultivator-weapon\s*\{/);
  assert.match(app, /getAxeChopFrames\(Game\.state\.axeId\)/);
  assert.match(app, /getAxeIdleFrames\(Game\.state\.axeId\)/);
  assert.match(app, /assets\/runtime\/character\/axes/);
  assert.match(app, /assets\/runtime\/character\/idle-axes/);
  assert.match(render, /idleFrames:\s*idleFrames/);
  assert.match(render, /chopFrames:\s*axeFrames/);
  assert.match(render, /CultivatorAnimator\.attach/);
  assert.doesNotMatch(render, /character-paint\.jpg/);
});

test('every equipped axe has four idle frames and six V2 chop frames', () => {
  const axeIds = ['51001', '51002', '52001', '52002', '53001', '53002', '54001', '54002', '55001'];
  for (const axeId of axeIds) {
    for (let frame = 1; frame <= 4; frame++) {
      const file = path.join(__dirname, '..', 'assets', 'images', 'character', 'idle-axes', axeId, `frame-${String(frame).padStart(2, '0')}.png`);
      assert.ok(fs.existsSync(file), `missing idle frame ${axeId}/${frame}`);
    }
    for (let frame = 1; frame <= 6; frame++) {
      const file = path.join(__dirname, '..', 'assets', 'images', 'character', 'axes', axeId, `frame-${String(frame).padStart(2, '0')}.png`);
      assert.ok(fs.existsSync(file), `missing chop frame ${axeId}/${frame}`);
    }
  }
});

test('cultivation scene keeps the character and tree within striking distance', () => {
  assert.match(
    css,
    /#player-dashboard \.cult-scene \{[^}]*gap:\s*24px;/,
    'desktop scene should keep the axe close to the tree',
  );
  assert.match(
    css,
    /@media \(max-width:\s*380px\)[\s\S]*?\.cult-scene \{[^}]*gap:\s*6px;/,
    'narrow scene should use a compact gap',
  );
  for (const appearance of ['sprout', 'spirit', 'divine']) {
    assert.match(css, new RegExp(`\\.tree-appearance-${appearance}\\s*\\{[\\s\\S]*?--tree-overlap:`));
  }
  assert.match(css, /\.cult-tree \{[\s\S]*?z-index:\s*1/);
  assert.match(css, /\.cult-char \{[\s\S]*?z-index:\s*2/);
  assert.match(css, /\.cult-tree \.tree-img \{[\s\S]*?object-position:\s*center bottom/);
  assert.match(css, /\.cult-char \.char-img \{[\s\S]*?transform:\s*scale\(1\.2\)/);
});

test('tree appearance is configuration-driven with a safe fallback', () => {
  const render = app.match(/async renderCultivate\(\)[\s\S]*?\n  },/)?.[0] || '';
  const detail = app.match(/\n  showTreeDetail\(\) \{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(app, /const TREE_APPEARANCES = Object\.freeze/);
  assert.match(app, /TREE_APPEARANCES\[requestedKey\] \? requestedKey : 'sprout'/);
  assert.ok((app.match(/appearance:\s*tree\.appearance/g) || []).length >= 2);
  assert.match(app, /const treeAppearance = getTreeAppearance\(treeRealm\)/);
  assert.match(render, /tree-appearance-\$\{treeAppearance\.key\}/);
  assert.match(detail, /const treeAppearance = getTreeAppearance\(treeRealm\)/);
  assert.doesNotMatch(app, /treeLevel >= 13|treeLevel >= 6/);
});


test('single and ten chop paths play the cultivator action', () => {
  const single = app.match(/async doChop\(\)[\s\S]*?\n  },/)?.[0] || '';
  const ten = app.match(/async doChopTen\(\)[\s\S]*?\n  },/)?.[0] || '';

  assert.match(single, /CultivatorAnimator\.playChop\(\)/);
  assert.match(single, /await characterAnimation/);
  assert.match(ten, /TenChopTimeline\.getStep\(i\)/);
  assert.match(ten, /frameMs:\s*timing\.frameMs/);
  assert.match(ten, /await characterAnimation/);
  assert.match(ten, /timing\.gapMs/);
  assert.match(ten, /Game\.chopTen\(\)/);
  assert.match(ten, /CultivatorAnimator\.resumeIdle\(\)/);
});


test('backpack artwork grows inside unchanged slots and keeps a readable count badge', () => {
  assert.match(
    css,
    /\.cult-inventory \.inventory-grid:not\(\.weapons-grid\)[\s\S]*?\.item-icon-img[\s\S]*?width:\s*78%[\s\S]*?height:\s*78%/,
  );
  assert.match(css, /\.item-slot \.item-count[\s\S]*?background:\s*rgba\(18,\s*45,\s*43/);
  const slotRule = css.match(/\.item-slot\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(slotRule, /aspect-ratio:\s*1/);
});
