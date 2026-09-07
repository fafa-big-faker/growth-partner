const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function methodBlock(signature, nextSignature) {
  const start = app.indexOf(signature);
  assert.notEqual(start, -1, `missing ${signature}`);
  const end = nextSignature ? app.indexOf(nextSignature, start + signature.length) : app.length;
  assert.notEqual(end, -1, `missing boundary ${nextSignature}`);
  return app.slice(start, end);
}

test('mail surfaces render immediately and share a ten-second cache', () => {
  assert.match(app, /_mailCache:\s*PlayerDataCache\.createResourceCache\(\{\s*ttlMs:\s*10000/);
  assert.match(app, /_loadMails\(options = \{\}\)[\s\S]*?_mailCache\.get\(\(\) => DB\.getMails\(\), options\)/);

  const modal = methodBlock('async showMailModal()', '// --- 成就 ---');
  assert.ok(modal.indexOf('UI.modal(') < modal.indexOf('await this._loadMails'), 'modal must open before mail fetch');
  assert.match(modal, /_renderMailSkeleton\('modal'\)/);

  const page = methodBlock('async renderMail(', '\n  _renderMailAccordion(surface)');
  assert.ok(page.indexOf('main.innerHTML') < page.indexOf('await this._loadMails'), 'page shell must render before mail fetch');
  assert.match(page, /_renderMailSkeleton\('page'\)/);

  const badge = methodBlock('async _updateMailBadge()', 'toast(');
  assert.match(badge, /PlayerView\._loadMails\(\)/);
  assert.doesNotMatch(badge, /DB\.getMails\(\)/);
});

test('confirm dialogs deduplicate by key and individual mail deletion uses it', () => {
  const confirm = methodBlock('confirm(message, onConfirm', '// 品质标签');
  assert.match(confirm, /options = \{\}/);
  assert.match(confirm, /dataset\.confirmKey === options\.key/);
  assert.match(confirm, /overlay\.dataset\.confirmKey = options\.key/);
  assert.match(confirm, /return existing/);

  const deletion = methodBlock('async deleteMail(mailId, surface, button)', '// 提现记录');
  assert.match(deletion, /\{ key: `mail-delete:\$\{mailId\}` \}/);
});

test('bulk deletion revalidates safe read mail and uses one account-scoped update', () => {
  const dbDelete = methodBlock('async deleteMails(ids)', '// --- 提现 ---');
  assert.match(dbDelete, /\.in\('id', ids\)/);
  assert.match(dbDelete, /\.eq\('is_read', true\)/);
  assert.match(dbDelete, /\.eq\('user_role', this\.playerRole\)/);

  const candidates = methodBlock('_getDeletableReadMails(mails)', 'deleteReadMails(');
  assert.match(candidates, /mail\.isRead && \(!hasItems \|\| mail\.isClaimed\)/);

  const bulk = methodBlock('async deleteReadMails(surface, button)', '// 提现记录');
  assert.match(bulk, /_loadMails\(\{ force: true \}\)/);
  assert.match(bulk, /DB\.deleteMails\(ids\)/);
  assert.match(bulk, /mail-delete-read/);
  assert.match(app, /删除已读/);
});
