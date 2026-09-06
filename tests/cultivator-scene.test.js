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
  assert.match(app, /assets\/images\/character\/axes/);
  assert.match(app, /assets\/images\/character\/idle-axes/);
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
