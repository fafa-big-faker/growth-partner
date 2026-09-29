const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const method = name => app.match(new RegExp(`  (?:async )?${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  },`))?.[0];

function fixture(environment = 'demo') {
  const cb = { checked: true };
  let hints = 0, options = null, blocked = false, strong = false;
  const toasts = [];
  const context = {
    Auth: { session: { role: 'player', environment } },
    Game: { state: { realmLevel: 1, choppingCount: 999 } },
    Router: { currentPlayerTab: 'cultivate' },
    GameplayRules: require('../gameplay-rules'),
    FirstChopGuide: { isActive: () => strong },
    UI: { toast: text => toasts.push(text) },
    document: { getElementById: id => id === 'ten-chop-toggle' ? cb : { isConnected: true },
      querySelector: () => blocked ? {} : null },
    DemoWeaponGuide: { createBreakthroughHint: () => ({
      show(value) { options = value; hints++; return true; },
    }) },
  };
  const source = method('showDemoBreakthroughHint');
  assert.ok(source, 'demo weak-hint hook exists');
  const view = vm.runInNewContext(`({ _tenChopMode: false, ${source} ${method('toggleTenChop')} })`, context);
  return { view, context, cb, toasts, get hints() { return hints; }, get options() { return options; },
    block() { blocked = true; }, strong() { strong = true; } };
}

test('demo rejected ten-chop resets checkbox and replaces toast with a repeatable hint', () => {
  const f = fixture();
  f.view.toggleTenChop(true);
  assert.equal(f.cb.checked, false);
  assert.equal(f.view._tenChopMode, false);
  assert.equal(f.hints, 1);
  assert.deepEqual(f.toasts, []);
  assert.equal(f.options.isCurrent(), true);
  f.view.toggleTenChop(true);
  assert.equal(f.hints, 2);
  assert.equal(f.context.Game.state.choppingCount, 999);
});

test('formal account retains existing realm warning without a tutorial', () => {
  const f = fixture('production');
  f.view.toggleTenChop(true);
  assert.equal(f.hints, 0);
  assert.deepEqual(f.toasts, ['突破至中卡拉米后解锁']);
  assert.equal(f.cb.checked, false);
});

test('turning off, unlocked and insufficient-count attempts never show the hint', () => {
  const f = fixture();
  f.view.toggleTenChop(false);
  assert.equal(f.hints, 0);
  f.context.Game.state.realmLevel = 2;
  f.view.toggleTenChop(true);
  assert.equal(f.view._tenChopMode, true);
  f.context.Game.state.choppingCount = 9;
  f.view.toggleTenChop(true);
  assert.equal(f.view._tenChopMode, false);
  assert.equal(f.hints, 0);
  assert.deepEqual(f.toasts, ['砍树次数不足10次，无法开启十连砍']);
});

test('modal/strong-guide or unavailable target fallback leaves no silent rejection', () => {
  for (const block of ['block', 'strong']) {
    const f = fixture(); f[block](); f.view.toggleTenChop(true);
    assert.equal(f.hints, 0);
    assert.deepEqual(f.toasts, ['突破至中卡拉米后解锁']);
  }
  const f = fixture();
  f.context.DemoWeaponGuide.createBreakthroughHint = () => ({ show: () => false });
  f.view.toggleTenChop(true);
  assert.deepEqual(f.toasts, ['突破至中卡拉米后解锁']);
});

test('weak hint captures session identity, current page and current realm', () => {
  for (const invalidate of [
    c => { c.Auth.session = { ...c.Auth.session }; },
    c => { c.Router.currentPlayerTab = 'tasks'; },
    c => { c.Game.state = null; },
    c => { c.Game.state.realmLevel = 2; },
  ]) {
    const f = fixture(); f.view.toggleTenChop(true);
    invalidate(f.context);
    assert.equal(f.options.isCurrent(), false);
  }
});

test('weak hint is torn down on redraw and the shared route/logout cancellation path', () => {
  assert.match(method('renderCultivate'), /this\._demoBreakthroughHint\?\.cancel\(\)/);
  assert.match(method('cancelChopPresentation'), /this\._demoBreakthroughHint\?\.cancel\(\)/);
});

test('changed demo code and CSS use a coherent cache key without changing gameplay gate', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const file of ['demo-guide.js', 'demo-session.css', 'app.js']) {
    assert.ok(html.includes(`${file}?v=demo-breakthrough-20260929`));
  }
  assert.match(method('toggleTenChop'), /GameplayRules\.canUseTenChop\(Game\.state\.realmLevel\)/);
  assert.match(method('renderCultivate'), /id="breakthrough-btn"/);
});
