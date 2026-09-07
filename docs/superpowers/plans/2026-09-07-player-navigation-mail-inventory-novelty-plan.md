# Player Navigation, Mail, and Inventory Novelty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make player navigation and mail feel immediate, prevent duplicate delete confirmations, add safe bulk deletion of read mail, and persist per-item “new” badges until viewed.

**Architecture:** Two small UMD modules own generic asynchronous caching and role-scoped inventory novelty state. `app.js` integrates them through shared player-view caches, route render tokens, one-query task loading, cached mail surfaces, and explicit inventory synchronization after successful mutations. Existing Supabase tables remain unchanged; bulk mail deletion uses the current `is_deleted` field.

**Tech Stack:** Browser JavaScript, Supabase JavaScript client, localStorage, HTML/CSS, Node test runner.

## Global Constraints

- Do not add third-party frontend dependencies.
- Do not add a Supabase table or column for novelty state.
- Persist novelty state per browser and per player role; do not synchronize it across devices.
- Track normal items by item ID and weapons by weapon instance ID.
- Clear a novelty badge when its matching detail is opened; later increases may mark it again.
- Never bulk-delete mail with an unclaimed attachment.
- Keep existing test mail and player data intact.
- Do not perform browser visual acceptance unless explicitly requested.

---

### Task 1: Reusable Async Resource Cache

**Files:**
- Create: `player-data-cache.js`
- Create: `tests/player-data-cache.test.js`
- Modify: `index.html:117-129`

**Interfaces:**
- Produces: `PlayerDataCache.createResourceCache({ ttlMs, now })`.
- Cache methods: `peek()`, `isFresh()`, `get(loader, { force })`, `set(value)`, `update(updater)`, `invalidate()`, and `clear()`.

- [ ] **Step 1: Write failing cache tests**

Cover a fresh cache hit, TTL expiry, forced refresh, in-flight request coalescing, invalidation, update, and a rejected refresh preserving the last successful value.

```js
const cache = createResourceCache({ ttlMs: 1000, now: () => now });
assert.deepEqual(await cache.get(async () => ['first']), ['first']);
assert.deepEqual(await cache.get(async () => ['unused']), ['first']);
cache.invalidate();
assert.deepEqual(await cache.get(async () => ['second']), ['second']);

const pendingA = cache.get(loader, { force: true });
const pendingB = cache.get(loader, { force: true });
assert.equal(pendingA, pendingB);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests\player-data-cache.test.js`

Expected: FAIL because `player-data-cache.js` does not exist.

- [ ] **Step 3: Implement the cache module**

Use one pending Promise per resource and only replace the stored value after a successful load.

```js
function get(loader, options = {}) {
  const force = options.force === true;
  if (!force && isFresh()) return Promise.resolve(value);
  if (pending) return pending;
  pending = Promise.resolve()
    .then(loader)
    .then(next => set(next))
    .finally(() => { pending = null; });
  return pending;
}
```

- [ ] **Step 4: Load the module before `app.js` and rerun tests**

Add `<script src="player-data-cache.js"></script>` before `app.js`, then run:

```bat
node --test tests\player-data-cache.test.js
node --check player-data-cache.js
```

Expected: all checks pass.

- [ ] **Step 5: Commit the cache module**

```bat
git add player-data-cache.js tests\player-data-cache.test.js index.html
git commit -m=feat-player-data-cache
```

### Task 2: Role-Scoped Inventory Novelty State

**Files:**
- Create: `inventory-novelty.js`
- Create: `tests/inventory-novelty.test.js`
- Create: `tests/inventory-novelty-integration.test.js`
- Modify: `index.html:117-130`
- Modify: `app.js:1154-1283,1448-1528,1620-1660,1918-2052,2796-2952,3060-3170`
- Modify: `styles.css` inventory slot section

**Interfaces:**
- Produces: `InventoryNovelty.create({ storage, keyPrefix })`.
- Tracker methods: `setRole(role)`, `sync(inventory, weapons)`, `isItemNew(itemId)`, `isWeaponNew(instanceId)`, `clearItem(itemId)`, `clearWeapon(instanceId)`, and `resetMemory()`.
- Consumes: `DB.playerRole`, `Game.inventory`, and `Game.weapons`.

- [ ] **Step 1: Write failing novelty unit tests**

Cover first-use baselining, a later quantity increase, quantity decrease followed by another increase, independent weapon instances, role isolation, reload persistence, and an unavailable-storage fallback.

```js
tracker.setRole('player');
tracker.sync([{ itemId: '40001', quantity: 2 }], []);
assert.equal(tracker.isItemNew('40001'), false);
tracker.sync([{ itemId: '40001', quantity: 3 }], []);
assert.equal(tracker.isItemNew('40001'), true);
tracker.clearItem('40001');
assert.equal(tracker.isItemNew('40001'), false);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests\inventory-novelty.test.js`

Expected: FAIL because `inventory-novelty.js` does not exist.

- [ ] **Step 3: Implement persistent snapshots and pending sets**

Store one JSON object per role:

```js
{
  initialized: true,
  pendingItems: ['40001'],
  pendingWeapons: ['weapon-uuid'],
  itemQuantities: { '40001': 3 },
  weaponIds: ['weapon-uuid']
}
```

On first sync, establish the snapshot without marking existing inventory. On later syncs, mark quantities that increased and weapon IDs that did not exist in the previous snapshot. Always replace the snapshot after comparing.

- [ ] **Step 4: Integrate successful inventory mutations**

Create one tracker instance and call `setRole(DB.playerRole)` during `Game.init()`. Call `sync()` after `Game.init()` and `Game.refresh()`, after successful normal-item and weapon branches of `Game.grantItem()`, and after successful compose, forge, ten-chop, cash-out, equip, and sell updates. Failed or rolled-back operations must not sync a new state.

```js
const InventoryNewState = InventoryNovelty.create({ storage: window.localStorage });

InventoryNewState.setRole(DB.playerRole);
InventoryNewState.sync(this.inventory, this.weapons);
```

- [ ] **Step 5: Render and clear badges**

Render `<span class="item-new-badge">新</span>` at the top right of matching item and weapon slots. At the beginning of `showItemDetail(itemId, instanceId)`, clear the matching entry and rerender only the current inventory grid before opening the modal. Clear a weapon on direct equip or sell as well.

- [ ] **Step 6: Add integration assertions and styles**

Assert that every bypass path calls the shared sync helper and that badge markup uses item IDs versus instance IDs correctly. Style a compact coral badge that does not overlap the existing bottom-right quantity.

- [ ] **Step 7: Run focused tests and commit**

Run:

```bat
node --test tests\inventory-novelty.test.js tests\inventory-novelty-integration.test.js tests\resource-operation-consistency.test.js
node --check inventory-novelty.js
node --check app.js
```

Expected: all checks pass.

```bat
git add inventory-novelty.js tests\inventory-novelty.test.js tests\inventory-novelty-integration.test.js index.html app.js styles.css
git commit -m=feat-persistent-inventory-new-badges
```

### Task 3: Cached Mail and Safe Bulk Deletion

**Files:**
- Create: `tests/mail-performance-actions.test.js`
- Modify: `app.js:962-1066,2247-2259,2360-2374,2547-2555,4135-4394,4782-4802`
- Modify: `styles.css` mail section

**Interfaces:**
- Consumes: `PlayerDataCache.createResourceCache`, `UI.runLockedAction`, and current `_mailSurfaces`.
- Produces: `DB.deleteMails(ids)`, `PlayerView._mailCache`, `PlayerView._loadMails({ force })`, `PlayerView.deleteReadMails(surface, button)`, and `UI.confirm(message, onConfirm, { key })`.

- [ ] **Step 1: Write failing mail performance and action tests**

Assert that the mail modal is created before the awaited fetch, badge and surfaces share `_mailCache`, equal confirm keys return one overlay, bulk candidates exclude unclaimed attachments, and `DB.deleteMails` performs one role-scoped update with `.in('id', ids)` and `.eq('is_read', true)`.

```js
assert.match(showModal, /UI\.modal\([\s\S]*?await this\._loadMails/);
assert.match(app, /mail\.isRead && \(!hasItems \|\| mail\.isClaimed\)/);
assert.match(deleteMany, /\.in\('id', ids\)[\s\S]*\.eq\('user_role', this\.playerRole\)/);
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test tests\mail-performance-actions.test.js`

Expected: FAIL because cached loading and bulk deletion are absent.

- [ ] **Step 3: Add shared mail cache and immediate surfaces**

Create `_mailCache` with a 10-second TTL. `showMailModal()` and `renderMail()` must create their container immediately, render cached data when available, otherwise render a stable mail skeleton, then await the shared loader. `_updateMailBadge()` uses the same loader instead of calling `DB.getMails()` directly.

- [ ] **Step 4: Update mail cache locally for read state**

After `markMailRead` succeeds, update the matching cached mail and compute the badge from cached data. Do not issue a second mail-list query merely to refresh the badge.

- [ ] **Step 5: Add deduplicated confirmations**

Extend `UI.confirm` with `{ key }`. Before creating an overlay, return the connected overlay whose `dataset.confirmKey` matches. Assign the key to the new overlay and keep existing call sites compatible when options are omitted.

```js
const existing = Array.from(document.querySelectorAll('.modal-overlay'))
  .find(entry => entry.dataset.confirmKey === options.key);
if (existing) return existing;
```

- [ ] **Step 6: Add one-request bulk deletion**

Render a compact mail toolbar above the accordion. Compute eligible mail as read and either attachment-free or already claimed. On confirmation, force-refresh mail once, recompute eligible IDs, call `DB.deleteMails(ids)` once, invalidate the mail cache, and refresh only the active mail surface. Disable the toolbar button when the eligible count is zero.

- [ ] **Step 7: Guard individual deletion and rerun tests**

Pass `{ key: `mail-delete:${mailId}` }` to the single-delete confirmation. Keep `UI.runLockedAction` around the actual mutation.

Run:

```bat
node --test tests\mail-performance-actions.test.js tests\mail-accordion.test.js tests\operation-guard.test.js
node --check app.js
```

Expected: all checks pass.

- [ ] **Step 8: Commit mail performance changes**

```bat
git add app.js styles.css tests\mail-performance-actions.test.js
git commit -m=feat-fast-mail-and-bulk-delete
```

### Task 4: Immediate and Race-Safe Player Navigation

**Files:**
- Create: `tests/player-navigation-performance.test.js`
- Modify: `app.js:2169-2207,2547-2676,3273-3317,3950-3996`
- Modify: `styles.css` player main and skeleton sections

**Interfaces:**
- Produces: `Router._playerRenderVersion`, `Router.isCurrentPlayerRender(tab, version)`, `PlayerView._taskCache`, `PlayerView._withdrawalCache`, and immediate skeleton renderers.
- Consumes: `PlayerDataCache.createResourceCache`, `DB.getTasks(null)`, and `DB.getSubmissions()`.

- [ ] **Step 1: Write failing navigation tests**

Assert that repeated active-tab clicks do not rerender, every navigation increments a token, async task/reward writes check that token, task loading calls `DB.getTasks()` once plus `DB.getSubmissions()` once, and page shells are written before the first await.

```js
assert.match(router, /if \(this\.currentPlayerTab === tab && main\?\.dataset\.renderedTab === tab\) return/);
assert.match(tasks, /Promise\.all\(\[DB\.getTasks\(\), DB\.getSubmissions\(\)\]\)/);
assert.doesNotMatch(tasks, /DB\.getTasks\('daily'\)/);
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `node --test tests\player-navigation-performance.test.js`

Expected: FAIL because the router has no render token or view cache.

- [ ] **Step 3: Add navigation tokens and repeat-click suppression**

Update the bottom-nav active state immediately, set `main.dataset.renderedTab`, increment `_playerRenderVersion`, and pass the version into the renderer. Before any asynchronous DOM write, require both current tab and version to match.

- [ ] **Step 4: Reduce task requests and render stale-while-revalidate**

Use one published-task query and one submission query:

```js
const [tasks, submissions] = await Promise.all([DB.getTasks(), DB.getSubmissions()]);
const data = {
  dailyTasks: tasks.filter(task => task.taskType === 'daily'),
  weeklyTasks: tasks.filter(task => task.taskType === 'weekly'),
  themeTasks: tasks.filter(task => task.taskType === 'theme'),
  submissions,
};
```

Render cached task data immediately. When no cache exists, insert the task shell and skeleton before awaiting the loader. Apply refreshed data only if `Router.isCurrentPlayerRender('tasks', version)` remains true.

- [ ] **Step 5: Decouple withdrawal loading from reward-page first paint**

Render the balance and shop synchronously from `Game.state`, with cached withdrawals or a list skeleton. Fetch withdrawals through `_withdrawalCache` and update only `#withdraw-list` if the reward route token remains current.

- [ ] **Step 6: Add short transition and reduced-motion support**

Use a 120ms opacity transition on newly rendered player page content and fixed skeleton dimensions. Do not animate layout properties or block input.

- [ ] **Step 7: Invalidate caches after writes**

Invalidate task cache after task submission or reward claims and withdrawal cache after a withdrawal request. Clear all player-view caches when the selected player role changes at login so test and live accounts never share cached records.

- [ ] **Step 8: Run focused tests and commit**

Run:

```bat
node --test tests\player-navigation-performance.test.js tests\account-isolation.test.js tests\resource-operation-consistency.test.js
node --check app.js
```

Expected: all checks pass.

```bat
git add app.js styles.css tests\player-navigation-performance.test.js
git commit -m=perf-immediate-player-navigation
```

### Task 5: Full Verification and Release

**Files:**
- Modify: `docs/superpowers/plans/2026-09-07-player-navigation-mail-inventory-novelty-plan.md`

**Interfaces:**
- Produces: verified GitHub Pages release with no database migration.

- [ ] **Step 1: Run the complete verification suite**

```bat
node --test tests\*.test.js
node --check app.js
node --check player-data-cache.js
node --check inventory-novelty.js
python -m py_compile sync-config.py scripts\split_axe_sheets.py scripts\split_idle_axe_sheets.py scripts\split_character_sheets.py scripts\build_runtime_images.py
python tests\runtime-image-assets.test.py
python tests\character-frame-alignment.test.py
git diff --check
```

Expected: every test and syntax check passes.

- [ ] **Step 2: Inspect and commit only scoped files**

Exclude the untracked `supabase/` CLI cache. Scan changed files for credentials and unrelated modifications, then commit the completed plan.

- [ ] **Step 3: Push and verify deployment**

Push `main`, confirm local `HEAD` equals `origin/main`, and verify the GitHub Pages workflow for that SHA completes with `conclusion: success`. Perform only a nonvisual HTTP availability check.
