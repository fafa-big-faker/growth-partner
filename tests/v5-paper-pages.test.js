const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'ink-pages.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/runtime/v5/manifest.json'), 'utf8'));

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('task and shop nine-slice values match measured runtime paper artwork', () => {
  for (const name of ['task-paper', 'shop-paper']) {
    const spec = manifest.ui[name];
    const reference = `--item-paper: url('${spec.path}');`;
    const start = css.indexOf(reference);
    assert.ok(start >= 0, `${name} is used by the page`);
    const declarations = css.slice(start, css.indexOf('}', start));
    assert.ok(declarations.includes(`--item-paper-slice: ${spec.slice.join(' ')};`));
    assert.ok(spec.slice[0] + spec.slice[2] < spec.size[1]);
    assert.ok(spec.slice[1] + spec.slice[3] < spec.size[0]);
    assert.equal(fs.statSync(path.join(root, spec.path)).size, spec.bytes);
  }
  assert.match(css, /border-image-slice:\s*var\(--item-paper-slice\) fill/);
  assert.match(css, /border-image-repeat:\s*stretch/);
});

test('paper and fallback decoration cannot intercept task or purchase controls', () => {
  for (const pseudo of ['before', 'after']) {
    const selector = `#player-dashboard .ink-reward-page .shop-item::${pseudo}`;
    const start = css.indexOf(selector);
    assert.ok(start >= 0);
    const block = css.slice(start, css.indexOf('}', start));
    assert.match(block, /position:\s*absolute/);
    assert.match(block, /pointer-events:\s*none/);
    assert.match(block, /z-index:\s*-[12]/);
  }
  assert.match(css, /\.task-card::after,[\s\S]*?background:\s*var\(--page-paper\)/);
  assert.doesNotMatch(css, /backdrop-filter:\s*blur/);
  const pageRoot = css.slice(css.indexOf('.ink-task-page,'), css.indexOf('}'));
  assert.doesNotMatch(pageRoot, /background|border-radius|box-shadow/);
});

test('neutral hierarchy meets readable contrast on its explicit paper backing', () => {
  const token = name => css.match(new RegExp(`--${name}:\\s*(#[a-f\\d]{6})`, 'i'))?.[1];
  const paper = token('page-paper');
  assert.equal(token('page-ink'), '#252b29');
  assert.equal(token('page-body'), '#464c49');
  assert.equal(token('page-muted'), '#626762');
  assert.ok(contrast(token('page-ink'), paper) >= 7);
  assert.ok(contrast(token('page-body'), paper) >= 4.5);
  assert.ok(contrast(token('page-muted'), paper) >= 4.5);
  for (const selector of [
    '#player-dashboard .ink-task-page .page-title',
    '#player-dashboard .ink-task-page .theme-name',
    '#player-dashboard .ink-task-page .signin-title',
    '#player-dashboard .ink-reward-page .balance-value',
    '#player-dashboard .ink-reward-page .withdraw-amount',
    '#player-dashboard .ink-reward-page .shop-item .shop-name',
  ]) assert.ok(css.includes(selector), `${selector} overrides legacy specificity`);
});

test('long task and product descriptions remain readable and grow in document flow', () => {
  for (const selector of ['.ink-task-page .task-desc', '.ink-reward-page .shop-description']) {
    const start = css.indexOf(`${selector} {`);
    const block = css.slice(start, css.indexOf('}', start));
    assert.match(block, /font-size:\s*14px/);
    assert.match(block, /white-space:\s*pre-line/);
    assert.match(block, /overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(block, /(?:^|[;\n])\s*(?:height|max-height):/);
  }
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.match(css, /\.shop-action\s*\{\s*min-height:\s*40px/);
});
