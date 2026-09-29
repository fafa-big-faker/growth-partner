const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const source = app.match(/\n  _bindDemoRewardGuide\([^]*?\n  },/)[0].trim().replace(/,$/, '');
function fixture({ tenNeedsEquip = false } = {}) {
  const account = { environment: 'demo' }, calls = [];
  const context = {
    Auth: { session: account }, Game: { state: { axeInstanceId: 'gift' } },
    Router: { currentPlayerTab: 'cultivate' },
    DemoSession: { afterTenClosed(id) { calls.push(['ten', id]); return tenNeedsEquip; } },
  };
  const view = vm.runInNewContext(`({${source}})`, context);
  view._chopPresentationVersion = 3;
  view.startDemoWeaponGuide = () => calls.push(['equip']);
  view.startDemoForgeGuide = ({ weaponId }) => calls.push(['forge', weaponId]);
  const overlay = {};
  const settings = { account, version: 3, weaponId: 'gift' };
  return { view, context, overlay, settings, calls,
    bind() { view._bindDemoRewardGuide(overlay, settings); } };
}
test('single reward must close before forge guide is considered, using its captured weapon instance', () => {
  const f = fixture();
  f.bind(); assert.deepEqual(f.calls, []);
  f.context.Game.state.axeInstanceId = 'other-axe';
  f.overlay._afterClose();
  assert.deepEqual(f.calls, [['forge', 'gift']]);
});
test('ten reward keeps equip guide precedence, but a gifted-axe ten reward can guide forging', () => {
  const f = fixture({ tenNeedsEquip: true }); f.settings.ten = true;
  f.bind(); f.overlay._afterClose();
  assert.deepEqual(f.calls.map(row => row[0]), ['ten', 'equip']);
  const g = fixture(); g.settings.ten = true;
  g.bind(); g.overlay._afterClose();
  assert.deepEqual(g.calls, [['ten', 'gift'], ['forge', 'gift']]);
});
test('normal accounts do not attach any demo tutorial', () => {
  const f = fixture(); f.settings.account = { environment: 'live' };
  f.bind();
  assert.equal(f.overlay._afterClose, undefined);
});
test('logout, new session, route changes, cancelled presentation and missing state ignore old dialog callbacks', () => {
  for (const invalidate of [
    f => { f.context.Auth.session = null; },
    f => { f.context.Auth.session = { environment: 'demo' }; },
    f => { f.context.Router.currentPlayerTab = 'tasks'; },
    f => { f.view._chopPresentationVersion++; },
    f => { f.context.Game.state = null; },
  ]) {
    const f = fixture(); f.bind(); invalidate(f);
    f.overlay._afterClose();
    assert.deepEqual(f.calls, []);
  }
});
