const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const modulePath = path.join(__dirname, '..', 'task-rewards.js');

test('task rewards normalize chopping, currency, and configured items', () => {
  assert.equal(fs.existsSync(modulePath), true, 'task-rewards.js should exist');
  const { getEntries, formatText } = require(modulePath);
  const definitions = {
    0: { name: '游戏币', icon: 'coin' },
    1: { name: '砍树次数', icon: 'chop' },
    40001: { name: '锻造石', icon: 'stone' },
  };

  const entries = getEntries({
    rewardChopping: 3,
    rewardItems: [
      { item_id: '0', quantity: 100 },
      { item_id: '40001', quantity: 1 },
      { item_id: 'missing', quantity: 8 },
      { item_id: '40001', quantity: 0 },
    ],
  }, definitions);

  assert.deepEqual(entries, [
    { itemId: '1', quantity: 3, name: '砍树次数', icon: 'chop' },
    { itemId: '0', quantity: 100, name: '游戏币', icon: 'coin' },
    { itemId: '40001', quantity: 1, name: '锻造石', icon: 'stone' },
  ]);
  assert.equal(formatText(entries), '砍树次数 ×3、游戏币 ×100、锻造石 ×1');
});

test('invalid or empty task rewards produce no entries', () => {
  const { getEntries, formatText } = require(modulePath);
  assert.deepEqual(getEntries(null, {}), []);
  assert.deepEqual(getEntries({ rewardChopping: -1, rewardItems: [] }, { 1: { name: '砍树次数' } }), []);
  assert.equal(formatText([]), '无额外奖励');
});

test('fixed and self-submitted cards share reward rendering', () => {
  assert.match(html, /<script src="task-rewards\.js"><\/script>[\s\S]*<script src="app\.js"><\/script>/);
  assert.match(app, /function renderTaskRewardChips\(/);
  assert.match(app, /_renderTaskCard[\s\S]*renderTaskRewardChips\(rewardSource/);
  assert.match(app, /_renderSelfSubCard[\s\S]*renderTaskRewardChips\(sub/);
  assert.match(app, /sub\.status === 'claimed'[\s\S]*已领取/);
});

test('successful submission claims show the detailed reward bubble', () => {
  const claim = app.match(/async _claimStoredSubmissionReward[\s\S]*?\n  },/)?.[0] || '';
  assert.match(app, /showRewardBubble\(entries\)/);
  assert.match(claim, /TaskRewards\.getEntries\(sub, ITEMS\)/);
  assert.match(claim, /await Game\.refresh\(\)[\s\S]*UI\.showRewardBubble\(entries\)/);
  assert.doesNotMatch(claim, /UI\.toast\('奖励已领取！'/);
});
