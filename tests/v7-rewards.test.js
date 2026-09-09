const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const modulePath = path.join(root, 'reward-presentation.js');
const items = {
  0: { name: '灵钱', icon: 'coin' },
  1: { name: '砍树次数', icon: 'axe' },
  40001: { name: '锻造石', icon: 'stone' },
  55001: { name: '盘古开天劈歪斧', icon: 'axe' },
};
const quality = { 1: { name: '凡品' }, 5: { name: '仙品' } };

function renderer() {
  return require(modulePath).createRenderer({
    items,
    quality,
    renderItemIcon: (id, fallback, cls) => `<img class="${cls}" data-icon="${id}" alt="">`,
  });
}

test('ten rewards group by isExtra, preserve order and never duplicate nested extras', () => {
  const { groupResults } = require(modulePath);
  const extraA = { itemId: '0', quantity: 9, isExtra: true };
  const extraB = { itemId: '40001', quantity: 2, isExtra: true };
  const regular = Array.from({ length: 10 }, (_, index) => ({ itemId: '40001', quantity: index + 1 }));
  regular[2].extraDrop = extraA;
  const input = [extraA, ...regular.slice(0, 4), extraB, ...regular.slice(4)];
  const groups = groupResults(input);
  assert.deepEqual(groups.regular, regular);
  assert.deepEqual(groups.extra, [extraA, extraB]);
  assert.equal(groups.regular[2], regular[2]);
  const html = renderer().renderResults(input);
  assert.equal((html.match(/data-reward-item=/g) || []).length, 12);
  assert.ok(html.indexOf('reward-results-regular') < html.indexOf('reward-results-extra'));
});

test('missing, empty and multiple extra results render without empty headings', () => {
  assert.equal(renderer().renderResults(null), '');
  assert.equal(renderer().renderResults([]), '');
  const regular = renderer().renderResults([{ itemId: '40001', quantity: 1 }]);
  assert.doesNotMatch(regular, /reward-results-extra|额外奖励/);
  const extra = renderer().renderResults([{ itemId: '0', quantity: 2, isExtra: true }]);
  assert.match(extra, /reward-results-extra/);
  assert.doesNotMatch(extra, /reward-results-regular/);
  assert.deepEqual(require(modulePath).groupResults([null, false, undefined]), { regular: [], extra: [] });
});

test('shared items preserve granted quantities but keep refunds and old prose out of reward cards', () => {
  const html = renderer().renderItem({
    itemId: '55001', quantity: 3, quality: 5,
    buffText: '掉落量×2倍！', refundChopping: 2,
  }, { size: 'large' });
  assert.match(html, /reward-item--large/);
  assert.match(html, /quality-5\.webp\?v=xianlai-v7-20260909/);
  assert.match(html, /quality-item-name quality-5/);
  assert.match(html, /盘古开天劈歪斧/);
  assert.match(html, /×3/);
  assert.match(html, /仙品/);
  assert.doesNotMatch(html, /斧技触发|掉落量|返还|reward-item-feedback/);
  const ten = renderer().renderResults([{ itemId: '0', quantity: 25, refundChopping: 3 }]);
  assert.match(ten, /×25/);
  assert.doesNotMatch(ten, /返还|reward-refund/);
});

test('server-rendered enhanced quantity uses the last actual trigger quality rather than item or highest skill quality', () => {
  const reward = {
    itemId: '40001', quality: 4, quantity: 12, baseQuantity: 2,
    buffTriggers: [
      { beforeQuantity: 2, afterQuantity: 6, multiplier: 3, buffQuality: 5 },
      { beforeQuantity: 6, afterQuantity: 12, multiplier: 2, buffQuality: 2 },
      { beforeQuantity: 12, afterQuantity: 12, multiplier: 1, buffQuality: 5 },
    ],
  };
  const original = structuredClone(reward);
  const html = renderer().renderItem(reward);
  const quantities = [...html.matchAll(/<span class="(reward-item-quantity-value[^"]*)">([^<]*)<\/span>/g)];
  assert.equal(quantities.length, 1);
  assert.equal(quantities[0][1], 'reward-item-quantity-value buff-quality-2');
  assert.equal(quantities[0][2], '×12！');
  assert.match(html, /class="reward-item-name quality-item-name quality-4">锻造石</);
  assert.doesNotMatch(html, /reward-item-buff|reward-skill-notice/);
  assert.deepEqual(reward, original);
});

test('plain, extra and refund-only rendered quantities stay uncolored and punctuation-free', () => {
  const enhanced = { quantity: 6, baseQuantity: 2,
    buffTriggers: [{ beforeQuantity: 2, afterQuantity: 6, multiplier: 3, buffQuality: 5 }] };
  for (const reward of [{ quantity: 3 }, { quantity: 4, refundChopping: 2 }, { ...enhanced, isExtra: true }]) {
    const html = renderer().renderItem({ itemId: '40001', quality: 5, ...reward });
    const quantity = html.match(/<span class="(reward-item-quantity-value[^"]*)">([^<]*)<\/span>/);
    assert.equal(quantity[1], 'reward-item-quantity-value');
    assert.equal(quantity[2], `×${reward.quantity}`);
  }
  const fallback = renderer().renderItem({ ...enhanced, buffTriggers: enhanced.buffTriggers.map(({ buffQuality, ...trigger }) => trigger) });
  assert.match(fallback, /class="reward-item-quantity-value buff-quality-1">×6！</);
});

test('coin and chopping use their real item IDs and configured names', () => {
  const coin = renderer().renderItem({ kind: 'coin', itemId: 'wrong', quantity: 300 });
  const chop = renderer().renderItem({ kind: 'chopping', quantity: 8 });
  assert.match(coin, /data-icon="0"/);
  assert.match(coin, /灵钱/);
  assert.match(chop, /data-icon="1"/);
  assert.match(chop, /砍树次数/);
});

test('missing and invalid qualities use the first quality ink', () => {
  for (const value of [undefined, null, 0, 6, -1, 'bad', 1.5]) {
    const html = renderer().renderItem({ itemId: '40001', quantity: 1, quality: value });
    assert.match(html, /quality-1\.webp/);
    assert.match(html, /quality-item-name quality-1/);
  }
  assert.match(renderer().renderItem({ itemId: '40001', quality: '5' }), /quality-5\.webp/);
});

test('item definitions supply quality when reward data omits it', () => {
  const rewards = require(modulePath).createRenderer({ items: { 55001: { name: '仙斧', quality: 5 } } });
  assert.match(rewards.renderItem({ itemId: '55001', quantity: 1 }), /quality-5\.webp/);
  assert.match(rewards.renderItem({ itemId: 'unknown', quantity: 1 }), /quality-1\.webp/);
});

test('reward copy is escaped and markup never trusts arbitrary size or quality values', () => {
  const html = renderer().renderItem({
    itemId: 'unknown', item: { name: '<script>bad</script>' },
    buffText: '<img onerror="bad">', quality: '" onload="bad', quantity: 2,
  }, { size: '" onclick="bad' });
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img onerror|&lt;img onerror/);
  assert.doesNotMatch(html, /<script>|onclick=|onload=/);
  assert.match(html, /reward-item--regular/);
});

test('browser module uses explicit renderer dependencies without app window globals', () => {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context);
  assert.equal(typeof context.globalThis.RewardPresentation.createRenderer, 'function');
  assert.equal(typeof context.globalThis.RewardPresentation.renderItem, 'function');
  assert.equal(typeof context.globalThis.RewardPresentation.renderResults, 'function');
  assert.doesNotMatch(fs.readFileSync(modulePath, 'utf8'), /root\.(?:ITEMS|Game|QUALITY)/);
  assert.deepEqual(require(modulePath).getAssetUrls().length, 5);
});

test('ten layout stays five columns, extras center, and art has no framed cards or glow', () => {
  const css = fs.readFileSync(path.join(root, 'reward-presentation.css'), 'utf8');
  assert.match(css, /\.reward-results-regular\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.reward-results-extra-items\s*\{[^}]*justify-content:\s*center/s);
  assert.match(css, /\.reward-results-extra-items\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.reward-item\.is-skill-active \.reward-item-name\s*\{[^}]*white-space:\s*nowrap/s);
  assert.doesNotMatch(css, /reward-skill-notice|reward-item-buff/);
  assert.match(css, /\.reward-dialog > \.modal-body\s*\{[^}]*scrollbar-gutter:\s*auto;[^}]*scrollbar-width:\s*none/s);
  assert.match(css, /\.reward-dialog > \.modal-body::-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(css, /reward-item-(?:feedback|refund)|reward-refund-total/);
  assert.doesNotMatch(css, /drop-shadow\(/);
  for (const match of css.matchAll(/box-shadow:\s*([^;]+);/g)) assert.equal(match[1], 'none');
  for (let index = 1; index <= 5; index++) assert.match(css, new RegExp(`\\.quality-item-name\\.quality-${index}`));
});

test('quality name colors retain at least 4.5 to 1 contrast against the paper base', () => {
  const css = fs.readFileSync(path.join(root, 'reward-presentation.css'), 'utf8');
  function luminance(hex) {
    const channels = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  for (let index = 1; index <= 5; index++) {
    const color = css.match(new RegExp(`\\.quality-item-name\\.quality-${index} \\{ color: (#[0-9a-f]+)`))[1];
    const contrast = (luminance('#ece4d4') + 0.05) / (luminance(color) + 0.05);
    assert.ok(contrast >= 4.5, `quality ${index} contrast is ${contrast}`);
  }
});

test('both chop result surfaces share the renderer and keep close callbacks', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const single = app.slice(app.indexOf('  _showRewardModal(item)'), app.indexOf('  // --- 任务页 ---'));
  const ten = app.slice(app.indexOf('  async doChopTen('), app.indexOf('  // 删除邮件'));
  const controller = app.slice(app.indexOf('  _startRewardReveal('), app.indexOf('  async doChop()'));
  assert.match(single, /RewardPresentation\.createRenderer\(\{\s*items:\s*ITEMS,\s*quality:\s*QUALITY,\s*renderItemIcon,\s*escapeHtml\s*\}\)/);
  assert.match(single, /\.renderItem\(item,\s*\{\s*size:\s*'large'/);
  assert.match(single, /item\.extraDrop/);
  assert.match(single, /reward-reveal-confirm">收下/);
  assert.doesNotMatch(single, /显示全部|全部显示|renderRefundTotal/);
  assert.match(single, /this\._startRewardReveal\(overlay,\s*\{\s*single:\s*true\s*\}\)/);
  assert.doesNotMatch(single, /renderNotice|notice:\s*false/);
  assert.match(controller, /onComplete:[\s\S]*收下/);
  assert.match(controller, /if\s*\(!single && !complete\) reveal\.finish\(\)/);
  assert.match(controller, /UI\.closeModal\(overlay\)/);
  assert.match(ten, /RewardPresentation\.createRenderer/);
  assert.match(ten, /reward-reveal-confirm">显示全部/);
  assert.match(ten, /\.renderResults\(results\)/);
  assert.match(ten, /this\._startRewardReveal\(overlay\)/);
  assert.doesNotMatch(ten, /const itemsHtml = results\.map/);
});

test('reward dialogs keep a compact single result and a fixed footer outside the scroll body', () => {
  const css = fs.readFileSync(path.join(root, 'reward-presentation.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const single = app.slice(app.indexOf('  _showRewardModal(item)'), app.indexOf('  // --- 任务页 ---'));
  assert.match(css, /\.modal\.reward-dialog\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.reward-dialog > \.modal-body\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.reward-dialog > \.modal-footer\s*\{[^}]*flex-shrink:\s*0/s);
  assert.match(css, /\.reward-dialog > \.modal-footer > \.btn\s*\{[^}]*min-height:\s*44px;[^}]*justify-content:\s*center;[^}]*align-items:\s*center;[^}]*text-align:\s*center/s);
  assert.match(css, /\.reward-item--large \.reward-art\s*\{\s*max-width:\s*104px;/);
  assert.match(single, /footer:\s*`<div class="modal-footer">/);
  assert.doesNotMatch(single, /\$\{extraHtml\}\s*<button/);
});
