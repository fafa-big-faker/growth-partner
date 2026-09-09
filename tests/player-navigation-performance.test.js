const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

function slice(startText, endText) {
  const start = app.indexOf(startText);
  assert.notEqual(start, -1, `missing ${startText}`);
  const end = app.indexOf(endText, start + startText.length);
  assert.notEqual(end, -1, `missing ${endText}`);
  return app.slice(start, end);
}

test('player navigation suppresses repeats and protects async renders with a version', () => {
  const router = slice('const Router = {', 'const UI = {');
  assert.match(router, /_playerRenderVersion:\s*0/);
  assert.match(router, /if \(this\.currentPlayerTab === tab && main\?\.dataset\.renderedTab === tab && !options\.force\) return/);
  assert.match(router, /const version = \+\+this\._playerRenderVersion/);
  assert.match(router, /main\.dataset\.renderedTab = tab/);
  assert.match(router, /isCurrentPlayerRender\(tab, version\)/);
  assert.match(router, /PlayerView\.renderTasks\(version\)/);
  assert.match(router, /PlayerView\.renderReward\(version\)/);
});

test('task page paints before loading and uses one task query plus one submission query', () => {
  assert.match(app, /_taskCache:\s*PlayerDataCache\.createResourceCache/);
  assert.match(app, /Promise\.all\(\[DB\.getTasks\(\), DB\.getSubmissions\(\)\]\)/);
  assert.doesNotMatch(app, /DB\.getTasks\('daily'\)/);
  assert.doesNotMatch(app, /DB\.getTasks\('weekly'\)/);
  assert.doesNotMatch(app, /DB\.getTasks\('theme'\)/);

  const tasks = slice('async renderTasks(version', '\n  currentTaskFilter:');
  assert.ok(tasks.indexOf('main.innerHTML') < tasks.indexOf('await this._loadTaskData'), 'task shell must paint first');
  assert.match(tasks, /Router\.isCurrentPlayerRender\('tasks', version\)/);
  const list = slice('\n  _renderTaskList() {', '\n  _renderTaskCard(');
  assert.doesNotMatch(list, /DB\.getSubmissions/);
});

test('reward page paints immediately and loads withdrawal records only when opened', () => {
  assert.match(app, /_withdrawalCache:\s*PlayerDataCache\.createResourceCache/);
  const reward = slice('async renderReward(version', '\n  _withdrawAmount:');
  assert.match(reward, /main\.innerHTML/);
  assert.doesNotMatch(reward, /await this\._loadWithdrawals|id="withdraw-list"/);
  const records = slice('async showWithdrawRecords()', '\n};');
  assert.ok(records.indexOf('UI.modal') < records.indexOf('await this._loadWithdrawals'));
  assert.match(records, /if \(!overlay\.isConnected\) return/);
  assert.match(records, /this\._renderWithdrawSkeleton\(container\)/);
});

test('player caches are isolated by login and route transitions are short', () => {
  const login = slice('async doLogin()', '\n  _setLoading(');
  assert.match(login, /PlayerView\.clearDataCaches\(\)/);
  assert.match(app, /_taskCache\.invalidate\(\)/);
  assert.match(app, /_withdrawalCache\.invalidate\(\)/);
  assert.match(css, /#player-main\.player-page-enter[\s\S]*120ms/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
