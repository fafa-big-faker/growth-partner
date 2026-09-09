const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AssetPreloader = require('../asset-preloader');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const treeSource = app.slice(app.indexOf('const TREE_APPEARANCES ='), app.indexOf('function getTreeAppearance('));
const mobile = fs.readFileSync(path.join(root, 'mobile-cultivation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'mobile-cultivation.css'), 'utf8');
const helperSource = app.match(/function getExperiencePercent\([^]*?\n\}/)?.[0];
assert.ok(helperSource, 'experience percentage is shared by both rendering paths');
const percentage = vm.runInNewContext(`${helperSource};getExperiencePercent`);
const urls = ['return-arrow', 'exp-track', 'exp-fill'].map(name => `assets/runtime/ink-controls/${name}.webp?v=ink-controls-20260909`);
const cases = [
  [0, 100, 0], [25, 100, 25], [99, 100, 99], [100, 100, 100], [125, 100, 100],
  [-1, 100, 0], ['25', '100', 25], [1, 8, 12.5], [0.125, 1, 12.5],
  [NaN, 100, 0], [Infinity, 100, 0], [-Infinity, 100, 0], ['bad', 100, 0],
  [1, NaN, 0], [1, Infinity, 0], [1, -Infinity, 0], [1, 'bad', 0],
  [1, 0, 0], [0, 0, 0], [1, -10, 0], [undefined, 100, 0], [1, undefined, 0],
  [Number.MAX_VALUE, Number.MIN_VALUE, 100],
];

test('experience percentage clamps invalid values and remains in the 0 to 100 range', () => {
  for (const [exp, maximum, expected] of cases) {
    assert.equal(percentage(exp, maximum), expected, `${String(exp)} / ${String(maximum)}`);
  }
});

test('initial experience markup uses the shared clipped percentage and complete accessible range', () => {
  const markup = app.match(/<div class="status-exp-bar"[^]*?<\/span>/)?.[0];
  assert.ok(markup, 'initial experience bar and adjacent numeric label exist');
  assert.match(markup, /getExperiencePercent\(Game\.state\.exp, expMax\)/);
  assert.match(markup, /role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"/);
  assert.match(markup, /class="status-exp-fill" aria-hidden="true"/);
  assert.doesNotMatch(markup, /style="width:|Math\.min\(100/);
  for (const [exp, expMax, expected] of cases) {
    const html = vm.runInNewContext(`${helperSource};\`${markup}\``, { Game: { state: { exp } }, expMax });
    assert.ok(html.includes(`aria-valuenow="${expected}"`));
    assert.ok(html.includes(`--exp-progress:${expected}%`));
    assert.ok(html.includes(`aria-valuetext="${exp}/${expMax}"`));
    assert.ok(html.includes(`--exp-text-width:${String(expMax).length * 2 + 1}ch`));
  }
});

function refresh(exp, expMax) {
  const attributes = new Map();
  const barProperties = new Map();
  const textProperties = new Map();
  const makeStyle = properties => ({
    setProperty: (name, value) => properties.set(name, value),
    set width(value) { assert.fail(`legacy width animation used: ${value}`); },
  });
  const bar = { style: makeStyle(barProperties), setAttribute: (name, value) => attributes.set(name, value) };
  const text = { style: makeStyle(textProperties), textContent: '' };
  const updateSource = app.match(/  _updateCultivateStats\(\) \{[^]*?\n  \},/)?.[0].trim().replace(/,$/, '');
  assert.ok(updateSource);
  const context = {
    Game: { state: { exp, level: 1, realmLevel: 1, choppingCount: 1 } },
    getExpForLevel: () => expMax, REALMS: [{ level: 1, name: '小修士' }],
    document: { querySelector: selector => ({ '.status-exp-bar': bar, '.status-exp-text': text }[selector] || null), getElementById: () => null },
  };
  const ui = vm.runInNewContext(`${helperSource};({${updateSource}, _updateAchBadge() {}})`, context);
  ui._updateCultivateStats();
  return { attributes, barProperties, textProperties, text: text.textContent, updateSource };
}

test('live experience updates write the same percentage to clip progress and accessibility', () => {
  for (const [exp, expMax, expected] of cases) {
    const result = refresh(exp, expMax);
    assert.equal(result.barProperties.get('--exp-progress'), `${expected}%`);
    assert.equal(result.attributes.get('aria-valuenow'), String(expected));
    assert.equal(result.attributes.get('aria-valuetext'), `${exp}/${expMax}`);
    assert.equal(result.text, `${exp}/${expMax}`);
    assert.doesNotMatch(result.updateSource, /\.style\.width|querySelector\('\.status-exp-fill'\)/);
  }
});

test('experience numeric width depends on the target digits rather than current experience', () => {
  for (const expMax of [9, 99, 999, 9999]) {
    for (const exp of [0, 1, 9, 10, expMax]) {
      assert.equal(refresh(exp, expMax).textProperties.get('--exp-text-width'), `${String(expMax).length * 2 + 1}ch`);
    }
  }
  assert.match(css, /\.status-exp-text\s*\{[^}]*width:\s*var\(--exp-text-width,\s*7ch\)/);
  assert.match(css, /\.status-exp-text\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
});

test('experience artwork remains full width and reveals progress using a clip mask', () => {
  assert.match(css, /\.status-exp-bar::before,\s*#player-dashboard \.status-exp-fill\s*\{[^}]*width:\s*100%;[^}]*pointer-events:\s*none/s);
  assert.ok(css.includes(urls[1]));
  assert.ok(css.includes(urls[2]));
  assert.match(css, /\.status-exp-fill\s*\{[^}]*clip-path:\s*inset\(0 calc\(100% - var\(--exp-progress, 0%\)\) 0 0\);[^}]*transition:\s*clip-path 300ms ease/s);
  assert.doesNotMatch(css, /\.status-exp-fill\s*\{[^}]*transition:\s*width/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce[^]*?\.status-exp-fill\s*\{\s*transition:\s*none/);
});

test('return artwork uses the versioned bitmap at 60px and retains the existing circular ground', () => {
  assert.ok(mobile.includes(urls[0]));
  assert.doesNotMatch(mobile, /assets\/runtime\/ui\/undo-2\.svg/);
  assert.match(css, /\.mobile-return-button \.nav-icon-img\s*\{[^}]*width:\s*60px;[^}]*height:\s*60px;[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.nav-item\.mobile-return-button\s*\{[^}]*chop-button-bg\.webp/s);
});

test('preload includes each actual versioned ink control URL once and excludes the old return SVG', () => {
  const preload = app.match(/function getInitialGameImageAssets\([^]*?\n\}/)[0];
  const context = {
    AssetPreloader, GAME_CONFIG: { itemTable: [{ id: 'duplicate', iconImage: urls[0] }] },
    ITEM_IMAGES: { duplicate: urls[1] }, V2_IMAGE_ROOT: 'assets/runtime/v2', V3_IMAGE_ROOT: 'assets/runtime/v3',
    getItemIconPath: (id, configured) => configured || urls[1],
  };
  const actual = vm.runInNewContext(`${treeSource}\n${preload};getInitialGameImageAssets()`, context);
  for (const url of urls) assert.equal(actual.filter(candidate => candidate === url).length, 1, url);
  assert.equal(actual.filter(url => url.includes('/ink-controls/')).length, 3);
  assert.doesNotMatch(preload, /undo-2\.svg/);
});
