const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createOperationGuard } = require('../operation-guard');
const TaskRewards = require('../task-rewards');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const adminSource = app.slice(app.indexOf('const AdminView = {'), app.indexOf('\n// 初始化（登录时调用'));
const iconSource = app.slice(app.indexOf('const ITEM_IMAGES = {'), app.indexOf('function renderTaskRewardChips'));
const guardSource = app.slice(app.indexOf('  async runLockedAction('), app.indexOf('\n  modal(', app.indexOf('  async runLockedAction(')));
const plain = value => JSON.parse(JSON.stringify(value));
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function field(value = '') {
  return { value, listeners: {}, style: {}, disabled: false, isConnected: true, innerHTML: '', rows: [],
    addEventListener(event, callback) { this.listeners[event] = callback; },
    setAttribute() {}, removeAttribute() {}, querySelectorAll() { return this.rows; } };
}
function rewardRows(entries) {
  return entries.map(([id, qty]) => ({ querySelector(selector) {
    return field(selector === '.admin-reward-item' ? id : String(qty));
  } }));
}
function harness(overrides = {}) {
  const item = { id: '40001', name: '锻造石', type: 4, quality: 2, icon: 'OLD-EMOJI', iconImage: 'assets/images/old.png' };
  const ITEMS = { '0': { id: '0', name: '游戏币', type: 0 }, '1': { id: '1', name: '砍树次数', type: 6 },
    '40001': item, old_forge: item, '20001': { id: '20001', name: '铜珠', type: 2, quality: 1 },
    future: { id: 'future', name: '<新道具> & "名字"', type: 4, quality: 2, iconImage: 'assets/runtime/future.webp' } };
  const state = { modals: [], toasts: [], reviews: [], refreshes: 0 };
  const context = vm.createContext({ ITEMS, ITEM_EMOJI: {}, QUALITY: { 1: { name: '凡品' }, 2: { name: '精品' } },
    TaskRewards, OperationGuard: createOperationGuard(), escapeHtml, console: { error() {} },
    DB: { async reviewSubmissionOnce(...args) { state.reviews.push(args); return overrides.review ? overrides.review(...args) : { ok: true }; } },
    UI: {
      toast(message, type) { state.toasts.push({ message, type }); },
      modal(content, options) {
        const fields = new Map([...(`${content}${options.footer}`).matchAll(/id="([^"]+)"/g)].map(match => [match[1], field()]));
        fields.get('approve-chopping').value = '3';
        const overlay = { isConnected: true, content, fields, querySelector: selector => fields.get(selector.slice(1)) };
        state.modals.push(overlay); return overlay;
      },
      closeModal(overlay) { overlay.isConnected = false; },
    },
    document: { getElementById() { throw new Error('Read from the owning overlay'); } },
  });
  vm.runInContext(`${iconSource}\nUI.runLockedAction = ({${guardSource}}).runLockedAction;\n${adminSource}\nglobalThis.AdminView = AdminView;`, context);
  context.AdminView.renderReview = async () => { state.refreshes++; };
  return { admin: context.AdminView, state, ITEMS };
}

test('selection names are grouped and escaped, omit legacy aliases and separate chopping rewards', () => {
  const { admin } = harness();
  const options = admin._renderAdminItemOptions('40001');
  assert.match(options, /optgroup label="锻造道具"/);
  assert.match(options, /value="40001" selected>锻造石 · 精品/);
  assert.match(options, /&lt;新道具&gt; &amp; &quot;名字&quot;/);
  assert.equal((options.match(/value="40001"/g) || []).length, 1);
  assert.doesNotMatch(options, /OLD-EMOJI|old_forge|\[40001\]|value="1"/);
  assert.match(admin._renderAdminItemOptions('', true), /value="1">砍树次数/);
});

test('selection previews resolve approved item art and retain configured art for future items', () => {
  const { admin } = harness(), preview = { innerHTML: '' };
  const select = { value: '40001', closest: () => ({ querySelector: () => preview }) };
  admin._updateAdminItemPreview(select);
  assert.match(preview.innerHTML, /assets\/runtime\/v4\/items\/40001.webp/);
  assert.doesNotMatch(preview.innerHTML, /assets\/images\/old|OLD-EMOJI/);
  select.value = 'old_forge'; admin._updateAdminItemPreview(select);
  assert.match(preview.innerHTML, /assets\/runtime\/v4\/items\/40001.webp/);
  select.value = 'future'; admin._updateAdminItemPreview(select);
  assert.match(preview.innerHTML, /assets\/runtime\/future.webp/);
  select.value = ''; admin._updateAdminItemPreview(select);
  assert.equal(preview.innerHTML, '');
});

test('duplicate canonical and legacy selections merge and unsafe or unknown values cannot become rewards', () => {
  const { admin } = harness();
  const read = entries => admin._readRewardItems({ querySelectorAll: () => rewardRows(entries) });
  assert.deepEqual(plain(read([['40001', 2], ['20001', 1], ['old_forge', 3]]).items), [
    { item_id: '40001', quantity: 5 }, { item_id: '20001', quantity: 1 },
  ]);
  for (const entries of [[['__proto__', 1]], [['1', 1]], [['40001', '1e2']], [['40001', 'NaN']], [['40001', '9007199254740992']]]) {
    assert.ok(read(entries).error, JSON.stringify(entries));
  }
});

test('deleting reward rows removes their payload and restores the empty state after the last row', () => {
  const { admin } = harness(), empty = { hidden: true };
  const rows = rewardRows([['40001', 2], ['20001', 3]]);
  const editor = { querySelector: () => empty, querySelectorAll: () => rows };
  const button = { closest: selector => selector === '.admin-reward-editor' ? editor : { remove: () => rows.shift() } };
  admin._removeRewardRow(button);
  assert.deepEqual(plain(admin._readRewardItems(editor).items), [{ item_id: '20001', quantity: 3 }]);
  assert.equal(empty.hidden, true);
  admin._removeRewardRow(button);
  assert.deepEqual(plain(admin._readRewardItems(editor).items), []);
  assert.equal(empty.hidden, false);
});

test('self-task approval uses the same selected rewards and atomic guarded write', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { admin, state } = harness({ review: () => pending });
  admin._submissions = [{ id: 'self', isSelfTask: true, status: 'pending' }];
  admin.approveSub('self', true);
  const overlay = state.modals[0];
  assert.doesNotMatch(overlay.content, /道具ID|40001:2/);
  overlay.fields.get('approve-items').rows = rewardRows([['40001', 2], ['40001', 3], ['20001', 1]]);
  overlay.fields.get('approve-note').value = '继续加油';
  const button = overlay.fields.get('approve-ok');
  const first = button.listeners.click();
  await button.listeners.click();
  assert.equal(state.reviews.length, 1);
  assert.equal(button.disabled, true);
  assert.deepEqual(plain(state.reviews[0].slice(0, 5)), ['self', 'approved', '继续加油', 3,
    [{ item_id: '40001', quantity: 5 }, { item_id: '20001', quantity: 1 }]]);
  release({ ok: true }); await first;
  assert.equal(overlay.isConnected, false);
  assert.equal(state.toasts.filter(toast => toast.type === 'success').length, 1);
});

test('self-task invalid quantities do not write and failed review keeps the selected rewards for retry', async () => {
  let fail = true;
  const { admin, state } = harness({ review: () => ({ ok: !fail, code: 'failed' }) });
  admin._submissions = [{ id: 'self', isSelfTask: true, status: 'pending' }];
  admin.approveSub('self', true);
  const overlay = state.modals[0], editor = overlay.fields.get('approve-items'), button = overlay.fields.get('approve-ok');
  editor.rows = rewardRows([['40001', 0]]);
  await button.listeners.click(); assert.equal(state.reviews.length, 0);
  editor.rows = rewardRows([['40001', 2]]);
  await button.listeners.click();
  assert.equal(overlay.isConnected, true); assert.equal(button.disabled, false);
  assert.deepEqual(plain(admin._readRewardItems(editor).items), [{ item_id: '40001', quantity: 2 }]);
  fail = false; await button.listeners.click();
  assert.equal(state.reviews.length, 2); assert.equal(overlay.isConnected, false);
});

test('all Admin visual item surfaces use shared art and GM options no longer show old emojis', () => {
  assert.doesNotMatch(adminSource, /itemEmoji\(/);
  assert.match(adminSource, /admin-inventory-item/);
  assert.match(adminSource, /renderItemIcon\(def.id \|\| inv.itemId, escapeHtml\(def.name\), 'item-icon-sm'\)/);
  assert.doesNotMatch(adminSource, /renderItemIcon\((?:inv.itemId|ri.item_id|state.axeId),/);
  assert.doesNotMatch(adminSource, /assets\/images\/icons|道具ID:数量|itemsStr\.split/);
});
