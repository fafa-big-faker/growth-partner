const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const treeManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets/runtime/wish-trees/manifest.json'), 'utf8'));

function treeAppearanceRuntime() {
  const start = app.indexOf('const TREE_APPEARANCES =');
  const end = app.indexOf('const V3_IMAGE_ROOT =', start);
  assert.ok(start >= 0 && end > start, 'tree appearance resolver must remain independently evaluable');
  return vm.runInNewContext(`${app.slice(start, end)}; ({ appearances: TREE_APPEARANCES, getTreeAppearance });`);
}


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
    /\.cult-scene \{[^}]*position:\s*relative[^}]*overflow:\s*hidden/,
    'the scene should provide one positioned coordinate system',
  );
  const treeRule = css.match(/\.cult-tree\s*\{[\s\S]*?\}/)?.[0] || '';
  const characterRule = css.match(/\.cult-char\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(treeRule, /position:\s*absolute/);
  assert.match(treeRule, /z-index:\s*1/);
  assert.match(treeRule, /left:\s*calc\(50% \+ var\(--tree-left\)\)/);
  assert.match(treeRule, /--tree-size:\s*216px/);
  assert.match(treeRule, /width:\s*var\(--tree-size\)/);
  assert.match(treeRule, /height:\s*var\(--tree-size\)/);
  assert.match(treeRule, /--tree-left:\s*-103px/);
  assert.match(characterRule, /position:\s*absolute/);
  assert.match(characterRule, /z-index:\s*3/);
  assert.match(characterRule, /pointer-events:\s*none/, 'decorative character must not intercept tree clicks');
  assert.match(characterRule, /left:\s*calc\(50% \+ var\(--character-left\)\)/);
  assert.match(css, /\.cult-effect \{[\s\S]*?z-index:\s*4/);
  assert.match(css, /\.cult-tree \.tree-img,\s*\.cult-tree \.tree-light\s*\{[^}]*object-fit:\s*contain/);
  assert.match(css, /\.cult-char \.char-img \{[\s\S]*?transform:\s*scale\(1\.2\)/);
  const spriteRule = css.match(/\.cult-char \.char-img\s*\{[^}]*\}/)?.[0] || '';
  assert.match(spriteRule, /pointer-events:\s*none/, 'scaled transparent sprite must be click-through');
});

test('tree appearance is configuration-driven with a safe fallback', () => {
  const render = app.match(/async renderCultivate\(\)[\s\S]*?\n  },/)?.[0] || '';
  const detail = app.match(/\n  showTreeDetail\(\) \{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(app, /const TREE_APPEARANCES = Object\.freeze/);
  const { appearances, getTreeAppearance } = treeAppearanceRuntime();
  assert.deepEqual(Object.keys(appearances), ['tree_01', 'tree_02', 'tree_03', 'tree_04', 'tree_05']);
  const sources = new Set();
  const lights = new Set();
  for (const key of Object.keys(appearances)) {
    const skin = getTreeAppearance({ appearance: key });
    assert.equal(skin.key, key);
    assert.equal(skin.src, `${treeManifest[key].path}?v=wish-trees-20260909`);
    assert.equal(skin.light, `${treeManifest[`light-${key.slice(-2)}`].path}?v=wish-trees-20260909`);
    skin.strike.forEach((coordinate, index) => assert.ok(Math.abs(coordinate - treeManifest[key].anchors.strike[index]) < 1e-8));
    skin.crown.forEach((coordinate, index) => assert.ok(Math.abs(coordinate - treeManifest[key].anchors.crown[index]) < 1e-8));
    sources.add(skin.src);
    lights.add(skin.light);
  }
  assert.equal(sources.size, 5);
  assert.equal(lights.size, 5);
  for (const [legacy, expected] of [['sprout', 'tree_01'], ['spirit', 'tree_03'], ['divine', 'tree_05']]) {
    assert.equal(getTreeAppearance({ appearance: legacy }).key, expected);
  }
  assert.equal(getTreeAppearance({ appearance: ' TREE_04 ' }).key, 'tree_04');
  for (const config of [undefined, {}, { appearance: '' }, { appearance: 'unknown' }, { appearance: 'constructor' }, { appearance: '__proto__' }]) {
    assert.equal(getTreeAppearance(config).key, 'tree_01');
  }
  assert.ok((app.match(/appearance:\s*tree\.appearance/g) || []).length >= 2);
  assert.match(app, /const treeAppearance = getTreeAppearance\(treeRealm\)/);
  assert.match(render, /tree-appearance-\$\{treeAppearance\.key\}/);
  assert.match(render, /data-strike-x="\$\{treeAppearance\.strike\[0\]\}"/);
  assert.match(render, /data-strike-y="\$\{treeAppearance\.strike\[1\]\}"/);
  assert.match(render, /data-crown-x="\$\{treeAppearance\.crown\[0\]\}"/);
  assert.match(render, /data-crown-y="\$\{treeAppearance\.crown\[1\]\}"/);
  assert.match(render, /src="\$\{treeAppearance\.light\}" class="tree-light"[^>]*aria-hidden="true"/);
  assert.match(detail, /const treeAppearance = getTreeAppearance\(treeRealm\)/);
  assert.match(detail, /src="\$\{treeAppearance\.src\}"/);
  assert.match(app, /Object\.values\(TREE_APPEARANCES\)\.flatMap\(tree => \[tree\.src, tree\.light\]\)/);
  assert.doesNotMatch(app, /treeLevel >= 13|treeLevel >= 6/);
});

test('tree light observation follows scene mounting and route cleanup', () => {
  const render = app.match(/async renderCultivate\(\)[\s\S]*?\n  },/)?.[0] || '';
  const cancel = app.match(/\n  cancelChopPresentation\(\) \{[\s\S]*?\n  },/)?.[0] || '';
  assert.match(render, /CultivationEffects\.observeTree\(document\.getElementById\('tree-icon'\)\)/);
  assert.match(cancel, /CultivationEffects\.observeTree\(null\)/);
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
