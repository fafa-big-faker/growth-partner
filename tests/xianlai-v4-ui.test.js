const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'xianlai-v4.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/runtime/v4/manifest.json'), 'utf8'));
const breakthrough = app.match(/  showBreakThrough\(\) \{[\s\S]*?\n  },/)?.[0];
const escapeHtml = app.match(/function escapeHtml\(value\) \{[\s\S]*?\n\}/)?.[0];

function renderBreakthrough({ level = 8, quantity = 4, realm = 1 } = {}) {
  const result = { calls: 0, removed: 0, refreshed: 0 };
  const btn = { addEventListener(type, callback) { result[type] = callback; } };
  const context = {
    REALMS: [
      { level: 1, name: '小<卡拉米>', icon: 'OLD_REALM_EMOJI', maxAxeQuality: 1 },
      { level: 2, name: '中<卡拉米>', icon: 'NEXT_REALM_EMOJI', desc: '<script>no</script>', reqLevel: 8,
        reqItems: [{ itemId: '30001', count: 4 }], maxAxeQuality: 3 },
    ],
    ITEMS: { '30001': { name: '期<石>', icon: 'ITEM_ICON' } },
    QUALITY: { 2: { name: '良<品>' }, 3: { name: '上品' } },
    Game: {
      state: { level, realmLevel: realm },
      inventory: [{ itemId: '30001', quantity }],
      async breakThrough() { result.calls++; return true; },
    },
    PlayerView: { renderCultivate() { result.refreshed++; } },
    document: {
      getElementById(id) { assert.equal(id, 'breakthrough-ok'); return btn; },
      querySelector() { return { remove() { result.removed++; } }; },
    },
    UI: {
      modal(body, options) { result.body = body; result.options = options; },
      async runLockedAction(key, button, label, action) {
        result.lock = { key, button, label };
        return { started: true, value: await action() };
      },
    },
    renderItemIcon: (id, fallback, cls) => `<img class="${cls}" data-item-id="${id}">`,
  };
  vm.runInNewContext(`${escapeHtml}\n({${breakthrough}}).showBreakThrough();`, context);
  return result;
}

test('breakthrough uses escaped realm text without configured emoji', () => {
  const result = renderBreakthrough();
  assert.match(result.body, /当前 · 小&lt;卡拉米&gt;/);
  assert.match(result.body, /class="breakthrough-target">中&lt;卡拉米&gt;/);
  assert.match(result.body, /&lt;script&gt;no&lt;\/script&gt;/);
  assert.match(result.body, /期&lt;石&gt;/);
  assert.match(result.body, /良&lt;品&gt;仙斧/);
  assert.doesNotMatch(result.body, /OLD_REALM_EMOJI|NEXT_REALM_EMOJI|<script>/);
  assert.match(css, /\.breakthrough-target\s*\{[^}]*font-family:[^;]*SimSun[^}]*font-size:\s*30px/s);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test('breakthrough retains level and material gates with actual quantities and textual status', () => {
  const satisfied = renderBreakthrough();
  assert.match(satisfied.body, /<b>8\/8<\/b><small>已满足/);
  assert.match(satisfied.body, /<b>4\/4<\/b><small>已满足/);
  assert.doesNotMatch(satisfied.options.footer, /disabled/);
  const lowLevel = renderBreakthrough({ level: 7 });
  assert.match(lowLevel.body, /<b>7\/8<\/b><small>等级不足/);
  assert.match(lowLevel.options.footer, /disabled/);
  const lowMaterials = renderBreakthrough({ quantity: 2 });
  assert.match(lowMaterials.body, /<b>2\/4<\/b><small>材料不足/);
  assert.match(lowMaterials.options.footer, /disabled/);
  assert.match(css, /\.breakthrough-requirement\.is-unmet \.breakthrough-requirement-value\s*\{\s*color:\s*#b3433a/);
});

test('breakthrough preserves quality unlocks and locked action flow', async () => {
  const result = renderBreakthrough();
  assert.match(result.body, /breakthrough-unlock buff-quality-2/);
  assert.match(result.body, /breakthrough-unlock buff-quality-3/);
  assert.equal((result.options.footer.match(/id="breakthrough-ok"/g) || []).length, 1);
  await result.click();
  assert.equal(result.lock.key, 'breakthrough');
  assert.equal(result.calls, 1);
  assert.equal(result.removed, 1);
  assert.equal(result.refreshed, 1);
  assert.equal(renderBreakthrough({ realm: 2 }).body, undefined);
});

test('V4 modal and forge surfaces use measured nine-slice values and local assets', () => {
  const assets = [...css.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]).filter(asset => asset.startsWith('assets/runtime/v4/'));
  assert.equal(new Set(assets).size, 4);
  for (const asset of assets) {
    assert.ok(asset.startsWith('assets/runtime/v4/ui/'));
    assert.ok(fs.statSync(path.join(root, asset)).size > 0, asset);
  }
  for (const name of ['modal-paper', 'button-forge']) {
    assert.ok(css.includes(`border-image-slice: ${manifest.ui[name].slice.join(' ')} fill;`));
  }
  assert.match(css, /\.modal\s*\{[^}]*background:\s*transparent[^}]*border-image-source:[^}]*modal-paper\.webp/s);
  assert.match(css, /\.forge-primary-actions #forge-ok:disabled\s*\{/);
  assert.match(css, /\.forge-primary-actions #forge-ok:focus-visible\s*\{/);
  assert.match(css, /\.forge-primary-actions #forge-ok\s*\{[^}]*color:\s*#f4f6ee/s);
  assert.doesNotMatch(css, /text-shadow:\s*0 1px rgb\(255 255 255/);
  assert.doesNotMatch(css, /modal-crest|slot-gold|slot-purple|slot-blue|slot-rose/);
});

test('inventory surfaces keep badges readable inside both dashboard and drawer', () => {
  assert.match(css, /:is\(#player-dashboard, \.mobile-inventory-panel\) \.item-slot::before\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.item-slot::before\s*\{[^}]*border-image-slice:\s*33 fill/s);
  assert.match(css, /\.item-slot:not\(\.empty\)::after\s*\{[^}]*width:\s*12px[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.item-slot\.item-locked\s*\{[^}]*opacity:\s*1[^}]*filter:\s*none/s);
  assert.match(css, /\.item-slot\.item-locked \.item-icon\s*\{[^}]*opacity:\s*0\.62/s);
  assert.match(css, /\.item-count\s*\{[^}]*z-index:\s*3[^}]*color:\s*#fff/s);
  assert.match(css, /\.item-new-badge\s*\{[^}]*z-index:\s*4[^}]*color:\s*#fff/s);
  assert.match(css, /\.item-lock-badge\s*\{[^}]*z-index:\s*4/s);
  assert.doesNotMatch(css, /\.item-slot[^{}]*\{[^}]*aspect-ratio:/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
