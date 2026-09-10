/* Real AdminView/modal DOM with local-only DB fixtures. No screenshots or real accounts. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

async function localServer() {
  const writes = [];
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (!['GET', 'HEAD'].includes(request.method)) {
        writes.push({ method: request.method, path: url.pathname });
        response.writeHead(405); response.end(); return;
      }
      if (url.pathname === '/_admin-fonts.css') {
        response.writeHead(200, { 'content-type': MIME['.css'] }); response.end(); return;
      }
      if (url.pathname === '/_admin-sdk.js') {
        response.writeHead(200, { 'content-type': MIME['.js'] });
        response.end('globalThis.supabase={createClient(){return {from(name){adminUnexpectedDatabase.push("from:"+name);throw new Error("Real database calls are forbidden in this local fixture");},rpc(name){adminUnexpectedDatabase.push("rpc:"+name);throw new Error("Real database calls are forbidden in this local fixture");}};}};');
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(ROOT, relative);
      if (!file.startsWith(ROOT + path.sep)) { response.writeHead(403); response.end(); return; }
      let body = await fs.readFile(file);
      if (relative === 'index.html') body = Buffer.from(body.toString('utf8')
        .replaceAll('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', '/_admin-sdk.js')
        .replace(/https:\/\/fonts\.googleapis\.com[^"']*/g, '/_admin-fonts.css'));
      response.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream',
        'content-length': body.length, 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`, writes,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}

async function fixture(page, origin) {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof AdminView !== 'undefined' && LoginBoot.getState().phase === 'ready');
  await page.evaluate(async () => {
    const today = localDateStr();
    window.adminFixture = {
      today, writes: [], mode: 'success', finish: null, toasts: [], taskReads: 0,
      tasks: ['one', 'two'].map(id => ({ id: `local-${id}`, taskType: 'theme', status: 'published',
        title: '本地已有主题任务', description: '', rewardChopping: 0, rewardItems: [], difficulty: 'C',
        themeName: '本地进行中主题', themeStart: today, themeEnd: today })),
    };
    AudioManager.playEffect = async () => false;
    AudioManager.playBgm = async () => false;
    LoginArt.setVisible(false);
    Auth.session = { role: 'admin', environment: 'test', playerRole: 'player' };
    DB.setPlayerRole('player');
    DB.getAllTasks = async () => { adminFixture.taskReads++; return [...adminFixture.tasks]; };
    DB.createTask = async payload => {
      const task = JSON.parse(JSON.stringify(payload));
      adminFixture.writes.push(task);
      const complete = success => {
        if (!success) return null;
        const created = { id: `local-created-${adminFixture.writes.length}`, ...task };
        adminFixture.tasks.push(created);
        return created;
      };
      if (adminFixture.mode === 'throw') throw new Error('Local simulated database failure');
      if (adminFixture.mode === 'null') return null;
      if (adminFixture.mode === 'pending') return new Promise(resolve => {
        adminFixture.finish = success => { adminFixture.finish = null; resolve(complete(success)); };
      });
      return complete(true);
    };
    DB.getPlayerState = async () => ({ level: 3, realmLevel: 1, treeLevel: 1, treeRealm: 1,
      choppingCount: 50, axeId: '51001', coin: 1234, totalChops: 5 });
    DB.getInventory = async () => [{ itemId: '40001', quantity: 2 }, { itemId: '20001', quantity: 3 },
      { itemId: 'stone_forge', quantity: 1 }];
    const originalToast = UI.toast;
    UI.toast = function (message, type) {
      adminFixture.toasts.push({ message, type });
      originalToast.call(this, message, type);
    };
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('player-dashboard').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'flex';
    await AdminView.renderTaskManage();
  });
}

async function openCreate(page, title) {
  await page.locator('#admin-main button').filter({ hasText: '新建任务' }).click();
  const modal = page.locator('.modal-overlay').filter({ has: page.locator('#create-task-ok') });
  await modal.waitFor({ state: 'visible' });
  await modal.locator('#new-task-title').fill(title);
  return modal;
}

async function addReward(modal, itemId, quantity) {
  const editor = modal.locator('#new-task-items');
  await editor.getByRole('button', { name: '添加道具', exact: true }).click();
  const row = editor.locator('[data-reward-row]').last();
  if (itemId) await row.locator('.admin-reward-item').selectOption(itemId);
  if (quantity !== undefined) await row.locator('.admin-reward-quantity').fill(String(quantity));
  return row;
}

async function readRows(modal) {
  return modal.locator('[data-reward-row]').evaluateAll(rows => rows.map(row => ({
    itemId: row.querySelector('.admin-reward-item').value,
    quantity: row.querySelector('.admin-reward-quantity').value,
  })));
}

async function checkRewardGeometry(modal, viewport) {
  await modal.locator('#new-task-items').scrollIntoViewIfNeeded();
  const result = await modal.evaluate(overlay => {
    const box = element => {
      const { x, right, width, height } = element.getBoundingClientRect();
      return { x, right, width, height };
    };
    const editor = overlay.querySelector('#new-task-items');
    return { modal: box(overlay.querySelector('.modal')), editor: box(editor),
      horizontalOverflow: editor.scrollWidth > editor.clientWidth,
      controls: [...editor.querySelectorAll('select, input, button, .admin-item-preview')].map(box),
      rows: [...editor.querySelectorAll('[data-reward-row]')].map(box) };
  });
  assert.equal(result.horizontalOverflow, false, `${viewport.width}: reward editor does not scroll sideways`);
  for (const box of [result.modal, result.editor, ...result.rows, ...result.controls]) {
    assert.ok(box.x >= -1 && box.right <= viewport.width + 1 && box.width > 0 && box.height > 0,
      `${viewport.width}: reward controls fit the visible modal width: ${JSON.stringify(box)}`);
  }
  return { editorWidth: result.editor.width, rowCount: result.rows.length };
}

async function rewardAndThemeScenario(page, viewport) {
  const modal = await openCreate(page, '本地主题追加任务');
  assert.equal(await modal.locator('#new-task-items [data-reward-row]').count(), 0);
  await modal.locator('#new-task-type').selectOption('theme');
  await modal.locator('#new-task-theme').fill('尚未发布的新主题');
  const themes = await modal.locator('#new-task-theme-source option').evaluateAll(options => options.map(option => ({ value: option.value, text: option.textContent })));
  const ongoing = themes.filter(option => option.text.includes('本地进行中主题'));
  assert.equal(ongoing.length, 1, 'duplicate existing theme tasks produce one choice');
  await modal.locator('#new-task-theme-source').selectOption(ongoing[0].value);
  const inherited = await modal.evaluate(overlay => ['new-task-theme', 'new-task-theme-start', 'new-task-theme-end']
    .map(id => ({ value: overlay.querySelector(`#${id}`).value, readOnly: overlay.querySelector(`#${id}`).readOnly })));
  const today = await page.evaluate(() => adminFixture.today);
  assert.deepEqual(inherited, [{ value: '本地进行中主题', readOnly: true }, { value: today, readOnly: true }, { value: today, readOnly: true }]);
  await modal.locator('#new-task-theme-source').selectOption('');
  assert.equal(await modal.locator('#new-task-theme').inputValue(), '尚未发布的新主题');
  assert.equal(await modal.locator('#new-task-theme').isEditable(), true);
  await modal.locator('#new-task-theme-source').selectOption(ongoing[0].value);
  await modal.locator('#new-task-status').selectOption('published');
  await modal.locator('#new-task-chopping').fill('7');
  await addReward(modal, '40001', 2);
  await addReward(modal, '20001', 3);
  await addReward(modal, '40001', 4);
  const removable = await addReward(modal, '30001', 9);
  await removable.getByRole('button', { name: '删除这项奖励' }).click();
  const rows = [{ itemId: '40001', quantity: '2' }, { itemId: '20001', quantity: '3' }, { itemId: '40001', quantity: '4' }];
  assert.deepEqual(await readRows(modal), rows);
  const previews = await modal.locator('.admin-item-preview img').evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => ({ path: new URL(image.src).pathname, decoded: image.naturalWidth > 0 }));
  });
  assert.deepEqual(previews, ['40001', '20001', '40001'].map(id => ({ path: `/assets/runtime/v4/items/${id}.webp`, decoded: true })));
  const optionText = await modal.locator('.admin-reward-item').first().locator('option[value="40001"]').textContent();
  assert.doesNotMatch(optionText, /40001|\p{Extended_Pictographic}/u, 'choices use names and qualities without raw IDs or emoji');
  assert.equal(await modal.locator('.admin-reward-item').first().locator('option[value="1"]').count(), 0, 'chopping remains a separate field');
  const geometry = await checkRewardGeometry(modal, viewport);

  await page.evaluate(() => { adminFixture.mode = 'pending'; });
  await modal.locator('#create-task-ok').click();
  await page.waitForFunction(() => typeof adminFixture.finish === 'function');
  assert.equal(await modal.locator('#create-task-ok').isDisabled(), true);
  assert.equal(await modal.locator('#create-task-ok').getAttribute('aria-busy'), 'true');
  await modal.locator('#create-task-ok').evaluate(button => {
    for (let index = 0; index < 4; index++) button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  assert.equal(await page.evaluate(() => adminFixture.writes.length), 1, 'fast repeated clicks submit one database operation');
  assert.equal(await page.evaluate(() => adminFixture.toasts.some(toast => toast.type === 'success')), false);
  const payload = await page.evaluate(() => adminFixture.writes[0]);
  assert.equal(payload.title, '本地主题追加任务');
  assert.equal(payload.status, 'published');
  assert.equal(payload.rewardChopping, 7);
  assert.deepEqual(payload.rewardItems, [{ item_id: '40001', quantity: 6 }, { item_id: '20001', quantity: 3 }]);
  assert.deepEqual([payload.themeName, payload.themeStart, payload.themeEnd], ['本地进行中主题', today, today]);
  await page.evaluate(() => adminFixture.finish(false));
  await page.waitForFunction(() => !OperationGuard.isBusy());
  assert.equal(await modal.isVisible(), true, 'failed database result retains the real modal');
  assert.equal(await modal.locator('#create-task-ok').isDisabled(), false);
  assert.deepEqual(await readRows(modal), rows, 'all selections and edited quantities survive failure');
  assert.equal(await modal.locator('#new-task-title').inputValue(), '本地主题追加任务');
  await page.evaluate(() => { adminFixture.mode = 'success'; });
  await modal.locator('#create-task-ok').click();
  await modal.waitFor({ state: 'detached' });
  await page.waitForFunction(() => !OperationGuard.isBusy());
  assert.equal(await page.evaluate(() => adminFixture.writes.length), 2);
  assert.equal(await page.evaluate(() => adminFixture.toasts.filter(toast => toast.type === 'success').length), 1);
  return { geometry, twoItems: true, duplicateQuantitiesMerged: true, removedItemExcluded: true,
    themeInherited: true, repeatedSubmitBlocked: true, failedFormPreserved: true };
}

async function emptyAndInvalidScenario(page) {
  let modal = await openCreate(page, '本地无奖励任务');
  await modal.locator('#new-task-chopping').fill('0');
  let row = await addReward(modal, '40001', 2);
  await row.getByRole('button', { name: '删除这项奖励' }).click();
  assert.equal(await modal.locator('.admin-reward-empty').isVisible(), true);
  await modal.locator('#create-task-ok').click();
  await modal.waitFor({ state: 'detached' });
  await page.waitForFunction(() => !OperationGuard.isBusy());
  const empty = await page.evaluate(() => adminFixture.writes.at(-1));
  assert.equal(empty.rewardChopping, 0);
  assert.deepEqual(empty.rewardItems, []);
  assert.equal(empty.themeName, null);

  modal = await openCreate(page, '本地数量校验任务');
  row = await addReward(modal, '40001', 1);
  const initialWrites = await page.evaluate(() => adminFixture.writes.length);
  for (const invalid of ['0', '-1', '1.5', '']) {
    await row.locator('.admin-reward-quantity').fill(invalid);
    await modal.locator('#create-task-ok').click();
    await page.waitForFunction(() => !OperationGuard.isBusy());
    assert.equal(await page.evaluate(() => adminFixture.writes.length), initialWrites, `invalid quantity ${JSON.stringify(invalid)} never saves`);
    assert.equal(await modal.isVisible(), true);
    assert.match(await page.evaluate(() => adminFixture.toasts.at(-1).message), /正整数/);
  }
  await row.locator('.admin-reward-quantity').fill('1');
  await row.locator('.admin-reward-item').selectOption('');
  await modal.locator('#create-task-ok').click();
  await page.waitForFunction(() => !OperationGuard.isBusy());
  assert.equal(await page.evaluate(() => adminFixture.writes.length), initialWrites);
  assert.match(await page.evaluate(() => adminFixture.toasts.at(-1).message), /选择道具/);
  await row.locator('.admin-reward-item').selectOption('40001');
  await modal.locator('#new-task-chopping').fill('-1');
  await modal.locator('#create-task-ok').click();
  await page.waitForFunction(() => !OperationGuard.isBusy());
  assert.equal(await page.evaluate(() => adminFixture.writes.length), initialWrites);
  assert.match(await page.evaluate(() => adminFixture.toasts.at(-1).message), /非负整数/);
  await modal.locator('#new-task-chopping').fill('0');
  await page.evaluate(() => { adminFixture.mode = 'throw'; });
  await modal.locator('#create-task-ok').click();
  await page.waitForFunction(() => !OperationGuard.isBusy());
  assert.equal(await modal.isVisible(), true, 'thrown database failure also retains selections');
  assert.deepEqual(await readRows(modal), [{ itemId: '40001', quantity: '1' }]);
  assert.equal(await modal.locator('#create-task-ok').isDisabled(), false);
  await modal.getByRole('button', { name: '取消', exact: true }).click();
  return { noRewardsAllowed: true, zeroNegativeFractionEmptyRejected: true, unselectedItemRejected: true,
    invalidChoppingRejected: true, thrownFailurePreserved: true };
}

async function draftEditScenario(page, viewport) {
  const setup = await page.evaluate(async () => {
    const draft = { id: 'local-draft-to-edit', status: 'draft', taskType: 'theme',
      title: '本地待发布主题任务', description: '和同学聊聊社团活动', difficulty: 'B',
      rewardChopping: 6, rewardItems: [{ item_id: 'stone_forge', quantity: 2 }, { item_id: '20001', quantity: 3 }],
      themeName: '本地未来主题', themeStart: '2030-09-01', themeEnd: '2030-09-30', sortOrder: 17 };
    adminFixture.tasks.push(draft);
    adminFixture.updates = [];
    adminFixture.editMode = 'success';
    adminFixture.readPending = false;
    DB.getAllTasks = async () => {
      adminFixture.taskReads++;
      if (adminFixture.readPending) return new Promise(resolve => {
        adminFixture.finishRead = () => {
          adminFixture.readPending = false;
          adminFixture.finishRead = null;
          resolve([...adminFixture.tasks]);
        };
      });
      return [...adminFixture.tasks];
    };
    DB.updateDraftTask = async (id, payload) => {
      const task = JSON.parse(JSON.stringify(payload));
      adminFixture.updates.push({ id, payload: task });
      const complete = success => {
        if (!success) return { ok: false, code: 'save_failed' };
        const existing = adminFixture.tasks.find(entry => entry.id === id && entry.status === 'draft');
        if (!existing) return { ok: false, code: 'state_changed' };
        Object.assign(existing, task);
        return { ok: true };
      };
      if (adminFixture.editMode === 'pending') return new Promise(resolve => {
        adminFixture.finishEdit = success => { adminFixture.finishEdit = null; resolve(complete(success)); };
      });
      return complete(true);
    };
    await AdminView.renderTaskManage();
    return { created: adminFixture.writes.length, total: adminFixture.tasks.length };
  });
  const published = page.locator('#admin-task-list .task-card').filter({ hasText: '本地已有主题任务' }).first();
  assert.equal(await published.getByRole('button', { name: '编辑', exact: true }).count(), 0,
    'published tasks do not expose the draft-edit action');
  await page.locator('#admin-main .filter-chip[data-filter="draft"]').click();
  const card = page.locator('#admin-task-list .task-card').filter({ hasText: '本地待发布主题任务' });
  const button = card.locator('button[onclick*="showEditTask"]');
  assert.equal(await button.isVisible(), true, 'a draft has an actual Edit button in its card');
  const beforeReads = await page.evaluate(() => { adminFixture.readPending = true; return adminFixture.taskReads; });
  await button.dblclick();
  await page.waitForFunction(() => typeof adminFixture.finishRead === 'function');
  assert.equal(await button.isDisabled(), true);
  assert.equal(await page.evaluate(() => adminFixture.taskReads), beforeReads + 1,
    'a real double-click opens only one read of the current draft');
  await page.evaluate(() => adminFixture.finishRead());
  const modal = page.locator('.modal-overlay').filter({ has: page.locator('#create-task-ok') });
  await modal.waitFor({ state: 'visible' });
  assert.equal(await page.locator('.modal-overlay').count(), 1, 'double-click never stacks two editors');
  assert.match(await modal.innerText(), /编辑待发布任务/);
  const values = await modal.evaluate(overlay => Object.fromEntries([
    'new-task-type', 'new-task-title', 'new-task-desc', 'new-task-diff', 'new-task-chopping',
    'new-task-status', 'new-task-theme', 'new-task-theme-start', 'new-task-theme-end', 'new-task-theme-source',
  ].map(id => [id, overlay.querySelector(`#${id}`).value])));
  assert.deepEqual(values, { 'new-task-type': 'theme', 'new-task-title': '本地待发布主题任务',
    'new-task-desc': '和同学聊聊社团活动', 'new-task-diff': 'B', 'new-task-chopping': '6',
    'new-task-status': 'draft', 'new-task-theme': '本地未来主题', 'new-task-theme-start': '2030-09-01',
    'new-task-theme-end': '2030-09-30', 'new-task-theme-source': '' }, 'all saved fields are prefilled, including a theme that is not currently active');
  assert.equal(await modal.locator('#new-task-status').isDisabled(), true);
  assert.equal(await modal.locator('#new-task-status option[value="published"]').count(), 0);
  assert.deepEqual(await readRows(modal), [{ itemId: '40001', quantity: '2' }, { itemId: '20001', quantity: '3' }],
    'saved rewards prefill named rows, resolving old item aliases');
  await modal.locator('#new-task-title').fill('本地修改后的待发布任务');
  await modal.locator('#new-task-desc').fill('先说一句你好，再问问感兴趣的社团');
  await modal.locator('#new-task-chopping').fill('8');
  await modal.locator('[data-reward-row] .admin-reward-quantity').first().fill('7');
  const geometry = await checkRewardGeometry(modal, viewport);
  await page.evaluate(() => { adminFixture.editMode = 'pending'; });
  await modal.locator('#create-task-ok').dblclick();
  await page.waitForFunction(() => typeof adminFixture.finishEdit === 'function');
  assert.equal(await modal.locator('#create-task-ok').isDisabled(), true);
  assert.equal(await page.evaluate(() => adminFixture.updates.length), 1, 'real double-click starts only one save');
  assert.equal(await modal.locator('#new-task-title').isEditable(), false, 'pending saves cannot silently discard later edits');
  assert.equal(await modal.getByRole('button', { name: '取消', exact: true }).isDisabled(), true);
  assert.equal(await modal.locator('.modal-close').isDisabled(), true);
  assert.equal(await modal.evaluate(node => node.classList.contains('modal-locked')), true);
  assert.equal(await page.evaluate(() => adminFixture.writes.length), setup.created, 'editing does not create a new task');
  const saved = await page.evaluate(() => adminFixture.updates[0]);
  assert.deepEqual(saved, { id: 'local-draft-to-edit', payload: { taskType: 'theme',
    title: '本地修改后的待发布任务', description: '先说一句你好，再问问感兴趣的社团', difficulty: 'B', rewardChopping: 8,
    rewardItems: [{ item_id: '40001', quantity: 7 }, { item_id: '20001', quantity: 3 }],
    status: 'draft', themeName: '本地未来主题', themeStart: '2030-09-01', themeEnd: '2030-09-30' } });
  await page.evaluate(() => adminFixture.finishEdit(false));
  await page.waitForFunction(() => !OperationGuard.isBusy());
  assert.equal(await modal.isVisible(), true, 'failed update retains the editor');
  assert.equal(await modal.locator('#create-task-ok').isEnabled(), true);
  assert.equal(await modal.locator('#new-task-title').isEditable(), true);
  assert.equal(await modal.locator('#new-task-status').isDisabled(), true, 'the original draft status lock is preserved');
  assert.equal(await modal.locator('#new-task-title').inputValue(), saved.payload.title);
  assert.deepEqual(await readRows(modal), [{ itemId: '40001', quantity: '7' }, { itemId: '20001', quantity: '3' }]);
  assert.equal(await modal.locator('#new-task-theme').inputValue(), '本地未来主题');
  await page.evaluate(() => { adminFixture.editMode = 'success'; });
  await modal.locator('#create-task-ok').click();
  await modal.waitFor({ state: 'detached' });
  await page.waitForFunction(() => !OperationGuard.isBusy());
  const result = await page.evaluate(() => ({ task: adminFixture.tasks.find(task => task.id === 'local-draft-to-edit'),
    total: adminFixture.tasks.length, created: adminFixture.writes.length, updates: adminFixture.updates.length,
    filter: AdminView._adminTaskFilter, selectedFilter: document.querySelector('#admin-main .filter-chip.active')?.dataset.filter,
    taskTitles: [...document.querySelectorAll('#admin-task-list .task-title')].map(node => node.textContent),
    toast: adminFixture.toasts.at(-1) }));
  assert.deepEqual(result.task, { id: saved.id, ...saved.payload, sortOrder: 17 },
    'save retains the original task identity, draft status and ordering');
  assert.equal(result.total, setup.total); assert.equal(result.created, setup.created); assert.equal(result.updates, 2);
  assert.equal(result.filter, 'draft'); assert.equal(result.selectedFilter, 'draft');
  assert.ok(result.taskTitles.includes(saved.payload.title));
  assert.ok(!result.taskTitles.includes('本地已有主题任务'), 'saved form returns to the same draft-only filter');
  assert.deepEqual(result.toast, { message: '修改已保存，任务仍在发布池', type: 'success' });
  return { geometry, draftOnlyEntry: true, allFieldsPrefilled: true, themePreserved: true,
    sameTaskUpdated: true, remainsDraft: true, realDoubleClicksBlocked: true,
    failedFormPreserved: true, draftFilterPreserved: true };
}

async function gmIconsScenario(page) {
  await page.locator('#admin-dashboard .nav-item[data-tab="gm"]').click();
  await page.locator('#gm-item-id').waitFor({ state: 'visible' });
  await page.locator('#gm-item-id').selectOption('40001');
  const preview = await page.locator('.admin-gm-item-preview img').evaluate(async image => {
    await image.decode(); return { path: new URL(image.src).pathname, decoded: image.naturalWidth > 0 };
  });
  assert.deepEqual(preview, { path: '/assets/runtime/v4/items/40001.webp', decoded: true });
  const inventory = await page.locator('.admin-inventory-item img').evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => ({ path: new URL(image.src).pathname, decoded: image.naturalWidth > 0 }));
  });
  assert.deepEqual(inventory, ['40001', '20001', '40001'].map(id => ({ path: `/assets/runtime/v4/items/${id}.webp`, decoded: true })),
    'legacy saved item aliases also resolve to the current V4 icon');
  assert.doesNotMatch(await page.locator('#gm-item-id option[value="40001"]').textContent(), /40001|\p{Extended_Pictographic}/u);
  assert.doesNotMatch(await page.locator('.admin-inventory-item').allTextContents().then(texts => texts.join(' ')), /\p{Extended_Pictographic}/u);
  return { selectedPreview: preview.path, inventoryImages: inventory.map(image => image.path), oldEmojiRemoved: true, legacyAliasResolved: true };
}

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const server = await localServer();
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true,
      executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] });
    const context = await browser.newContext({ viewport: VIEWPORTS[0], hasTouch: true });
    await context.addInitScript(() => { window.adminUnexpectedDatabase = []; });
    const page = await context.newPage();
    const errors = [], external = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== server.origin) external.push(`${request.method()} ${url.origin}`);
    });
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await fixture(page, server.origin);
      const rewards = await rewardAndThemeScenario(page, viewport);
      const validation = await emptyAndInvalidScenario(page);
      const edit = await draftEditScenario(page, viewport);
      const gm = await gmIconsScenario(page);
      assert.deepEqual(await page.evaluate(() => adminUnexpectedDatabase), []);
      checks.push({ viewport, rewards, validation, edit, gm });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    assert.deepEqual(server.writes, []);
    console.log(JSON.stringify({ ok: true, screenshots: 0, externalRequests: 0, realDatabaseRequests: 0, checks }, null, 2));
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
