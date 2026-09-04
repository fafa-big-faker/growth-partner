# Resource Operation Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复同 ID 备用仙斧被误判为已装备的问题，并阻止合成及其他资源操作因重复点击而被重复执行。

**Architecture:** 新增独立的单次操作保护器，让页面内相同业务操作在前一次结束前不能再次启动；在 Supabase 中用一个原子 RPC 完成合成扣料和发放成品，并用一个领取占位 RPC 保护基于玩家状态的奖励。`app.js` 保留现有业务结构，通过薄封装接入操作锁和 RPC，合成成功后局部更新背包以减少跨境网络往返。

**Tech Stack:** 原生 JavaScript、Node.js 内置测试运行器、Supabase JavaScript Client、PostgreSQL/PL/pgSQL、GitHub Pages。

## Global Constraints

- 当前装备的仙斧不占背包格；背包中同 ID 的仙斧全部是可装备、可出售的独立备用武器。
- 当前武器没有个体属性，库存继续按 `user_role + item_id + quantity` 聚合，不新增武器实例表。
- 合成的材料校验、扣除和成品发放必须在一个数据库事务内完成。
- 所有玩家资源入口和管理员提现审核入口必须具备页面内防重复保护。
- 数据库操作失败时不得显示成功提示，也不得继续执行后续奖励步骤。
- 不修改飞书配置、游戏数值、物品 ID、合成配方或现有登录方式。
- 数据库脚本必须可重复执行；先安装数据库变更，再发布依赖新 RPC 的前端。

---

## File Structure

- Create `operation-guard.js`: 无界面的通用异步互斥器，可在浏览器和 Node 测试中复用。
- Create `upgrade_v5.sql`: 增加主题奖励领取记录、原子合成 RPC、玩家状态奖励占位 RPC。
- Create `tests/operation-guard.test.js`: 验证同键并发、不同键并发和异常释放。
- Create `tests/resource-operation-consistency.test.js`: 锁定 SQL、武器语义、合成调用和高风险入口的源码契约。
- Modify `index.html:118-120`: 在 `app.js` 前加载操作保护器。
- Modify `app.js:290-830`: 增加数据库 RPC 包装和条件状态更新。
- Modify `app.js:850-1510`: 修复合成、装备、出售及资源方法的返回值处理。
- Modify `app.js:2114-3401`: 接入按钮处理中状态，改造玩家端所有资源领取入口。
- Modify `app.js:4281-4328`: 保护管理员提现审核操作。

---

### Task 1: Add the reusable single-flight operation guard

**Files:**
- Create: `operation-guard.js`
- Create: `tests/operation-guard.test.js`
- Modify: `index.html:118-120`

**Interfaces:**
- Produces: `createOperationGuard() -> { isActive(key), run(key, task) }`.
- Produces: browser global `OperationGuard`.
- `OperationGuard.run(key, task)` returns `{ started: false, value: false }` for a duplicate call, otherwise `{ started: true, value }`; task errors are rethrown after the key is released.

- [x] **Step 1: Write failing operation guard tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOperationGuard } = require('../operation-guard');

test('a second call with the same key is skipped while the first is pending', async () => {
  const guard = createOperationGuard();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const first = guard.run('compose:10001', async () => pending);
  const second = await guard.run('compose:10001', async () => 'duplicate');
  assert.deepEqual(second, { started: false, value: false });
  release('done');
  assert.deepEqual(await first, { started: true, value: 'done' });
});

test('different operation keys can run independently', async () => {
  const guard = createOperationGuard();
  const results = await Promise.all([
    guard.run('mail:1', async () => 1),
    guard.run('mail:2', async () => 2),
  ]);
  assert.deepEqual(results.map(x => x.value), [1, 2]);
});

test('a failed task releases its key', async () => {
  const guard = createOperationGuard();
  await assert.rejects(() => guard.run('shop:1', async () => { throw new Error('offline'); }));
  assert.equal(guard.isActive('shop:1'), false);
  assert.deepEqual(await guard.run('shop:1', async () => true), { started: true, value: true });
});
```

- [x] **Step 2: Run the test and verify the module is missing**

Run: `node --test tests/operation-guard.test.js`

Expected: FAIL with `Cannot find module '../operation-guard'`.

- [x] **Step 3: Implement `operation-guard.js`**

```js
(function initOperationGuard(root) {
  function createOperationGuard() {
    const activeKeys = new Set();
    return {
      isActive(key) {
        return activeKeys.has(String(key));
      },
      async run(key, task) {
        const normalizedKey = String(key);
        if (activeKeys.has(normalizedKey)) return { started: false, value: false };
        activeKeys.add(normalizedKey);
        try {
          return { started: true, value: await task() };
        } finally {
          activeKeys.delete(normalizedKey);
        }
      },
    };
  }

  root.OperationGuard = createOperationGuard();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createOperationGuard };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
```

- [x] **Step 4: Load the guard before the application**

Keep `game-config.js` first, then add:

```html
<script src="operation-guard.js"></script>
<script src="app.js"></script>
```

- [x] **Step 5: Run tests and syntax checks**

Run: `node --test tests/operation-guard.test.js`

Expected: 3 tests pass.

Run: `node --check operation-guard.js`

Expected: exit code 0.

- [x] **Step 6: Commit the guard**

```bash
git add operation-guard.js index.html tests/operation-guard.test.js
git commit -m "feat: add resource operation guard"
```

---

### Task 2: Add atomic Supabase operations

**Files:**
- Create: `upgrade_v5.sql`
- Create: `tests/resource-operation-consistency.test.js`

**Interfaces:**
- Produces RPC: `compose_inventory_item(p_source_item_id text, p_source_quantity int, p_target_item_id text, p_target_quantity int) -> jsonb`.
- Produces RPC: `reserve_player_claim(p_claim_type text, p_claim_key text) -> jsonb`.
- Produces column: `player_state.theme_reward_claims jsonb NOT NULL DEFAULT '[]'`.
- Both RPCs operate only on `user_role = 'player'`, return `{ ok: boolean, code: text, ... }`, and serialize through a lock on the player row.

- [x] **Step 1: Write failing SQL contract tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'upgrade_v5.sql');

test('v5 migration defines atomic compose and claim reservation', () => {
  assert.equal(fs.existsSync(sqlPath), true);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert.match(sql, /create or replace function compose_inventory_item/i);
  assert.match(sql, /quantity >= p_source_quantity/i);
  assert.match(sql, /create or replace function reserve_player_claim/i);
  assert.match(sql, /theme_reward_claims/i);
  assert.match(sql, /grant execute on function compose_inventory_item/i);
});
```

- [x] **Step 2: Run the contract test and verify it fails**

Run: `node --test tests/resource-operation-consistency.test.js`

Expected: FAIL because `upgrade_v5.sql` does not exist.

- [x] **Step 3: Create the idempotent v5 migration**

Write this complete migration:

```sql
-- 寻道大千数据库升级脚本 v5：资源操作一致性
alter table player_state
  add column if not exists theme_reward_claims jsonb default '[]'::jsonb;

update player_state
set theme_reward_claims = '[]'::jsonb
where theme_reward_claims is null;

alter table player_state
  alter column theme_reward_claims set default '[]'::jsonb,
  alter column theme_reward_claims set not null;

create or replace function compose_inventory_item(
  p_source_item_id text,
  p_source_quantity integer,
  p_target_item_id text,
  p_target_quantity integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source_remaining integer;
  v_target_quantity integer;
begin
  if p_source_item_id is null or p_target_item_id is null
     or p_source_item_id = p_target_item_id
     or p_source_quantity is null or p_target_quantity is null
     or p_source_quantity <= 0 or p_target_quantity <= 0
     or p_source_quantity > 9999 or p_target_quantity > 9999 then
    return jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  end if;

  perform 1 from player_state where user_role = 'player' for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  update inventory
  set quantity = quantity - p_source_quantity,
      updated_at = now()
  where user_role = 'player'
    and item_id = p_source_item_id
    and quantity >= p_source_quantity
  returning quantity into v_source_remaining;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  end if;

  if v_source_remaining = 0 then
    delete from inventory
    where user_role = 'player'
      and item_id = p_source_item_id
      and quantity = 0;
  end if;

  update inventory
  set quantity = quantity + p_target_quantity,
      updated_at = now()
  where user_role = 'player'
    and item_id = p_target_item_id
  returning quantity into v_target_quantity;

  if not found then
    insert into inventory (user_role, item_id, quantity)
    values ('player', p_target_item_id, p_target_quantity)
    returning quantity into v_target_quantity;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'sourceQuantity', v_source_remaining,
    'targetQuantity', v_target_quantity
  );
end;
$$;

create or replace function reserve_player_claim(
  p_claim_type text,
  p_claim_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_claims jsonb;
  v_claim_value jsonb;
begin
  if p_claim_type not in ('signin', 'achievement', 'theme')
     or p_claim_key is null or btrim(p_claim_key) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  end if;

  if p_claim_type in ('signin', 'achievement') then
    begin
      v_claim_value := to_jsonb(p_claim_key::integer);
    exception when invalid_text_representation then
      return jsonb_build_object('ok', false, 'code', 'invalid_claim_key');
    end;
  else
    v_claim_value := to_jsonb(p_claim_key);
  end if;

  select case p_claim_type
    when 'signin' then coalesce(signin_claims, '[]'::jsonb)
    when 'achievement' then coalesce(achievement_claims, '[]'::jsonb)
    when 'theme' then coalesce(theme_reward_claims, '[]'::jsonb)
  end
  into v_claims
  from player_state
  where user_role = 'player'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  if v_claims @> jsonb_build_array(v_claim_value) then
    return jsonb_build_object('ok', false, 'code', 'already_claimed');
  end if;

  if p_claim_type = 'signin' then
    update player_state
    set signin_claims = v_claims || jsonb_build_array(v_claim_value)
    where user_role = 'player';
  elsif p_claim_type = 'achievement' then
    update player_state
    set achievement_claims = v_claims || jsonb_build_array(v_claim_value)
    where user_role = 'player';
  else
    update player_state
    set theme_reward_claims = v_claims || jsonb_build_array(v_claim_value)
    where user_role = 'player';
  end if;

  return jsonb_build_object('ok', true, 'code', 'ok');
end;
$$;

grant execute on function compose_inventory_item(text, integer, text, integer) to anon, authenticated;
grant execute on function reserve_player_claim(text, text) to anon, authenticated;
```

- [x] **Step 4: Check the migration contract**

Run: `node --test tests/resource-operation-consistency.test.js`

Expected: the SQL contract passes.

- [x] **Step 5: Commit the migration and contract test**

```bash
git add upgrade_v5.sql tests/resource-operation-consistency.test.js
git commit -m "feat: add atomic resource database operations"
```

---

### Task 3: Use the atomic compose path and remove avoidable latency

**Files:**
- Modify: `app.js:470-545`
- Modify: `app.js:880-905`
- Modify: `app.js:1168-1207`
- Modify: `app.js:2180-2225`
- Modify: `tests/resource-operation-consistency.test.js`

**Interfaces:**
- Produces: `DB.composeInventoryItem(sourceItemId, sourceQuantity, targetItemId, targetQuantity) -> { ok, code, sourceQuantity?, targetQuantity? }`.
- Produces: `Game._setInventoryQuantity(itemId, quantity) -> void`.
- Consumes: `OperationGuard.run(key, task)` from Task 1.

- [x] **Step 1: Extend the failing tests for button state and local refresh**

Add assertions that the compose button passes itself to `_doCompose`, contains a stable `data-id`, and that `composeMulti` calls `DB.composeInventoryItem` without calling `Game.refresh()`.

```js
test('compose uses one guarded RPC and updates inventory locally', () => {
  assert.match(app, /dbClient\.rpc\('compose_inventory_item'/);
  assert.match(app, /PlayerView\._doCompose\('\$\{itemId\}',q,this\)/);
  const body = app.match(/async composeMulti\([\s\S]*?\n  },/)?.[0] || '';
  assert.match(body, /DB\.composeInventoryItem/);
  assert.match(body, /_setInventoryQuantity/);
  assert.doesNotMatch(body, /this\.refresh\(/);
});
```

- [x] **Step 2: Add the DB wrapper**

```js
async composeInventoryItem(sourceItemId, sourceQuantity, targetItemId, targetQuantity) {
  const { data, error } = await dbClient.rpc('compose_inventory_item', {
    p_source_item_id: String(sourceItemId),
    p_source_quantity: sourceQuantity,
    p_target_item_id: String(targetItemId),
    p_target_quantity: targetQuantity,
  });
  if (error) {
    console.error('DB composeInventoryItem error:', error);
    return { ok: false, code: 'network_error' };
  }
  return data || { ok: false, code: 'empty_response' };
},
```

- [x] **Step 3: Add local inventory quantity replacement**

`Game._setInventoryQuantity` must remove an entry when the returned quantity is zero, replace the existing quantity when present, and append an entry when a positive quantity is returned for a missing item.

- [x] **Step 4: Replace `composeMulti` with one RPC**

Validate `qty` as an integer in `1..99`, calculate `totalNeed`, call `DB.composeInventoryItem`, map `insufficient_materials` to the existing material warning, and only on `ok: true` apply both returned quantities locally and show the success toast. Do not call `refresh()` on the success path.

- [x] **Step 5: Guard the compose button**

Change the inline handler to `PlayerView._doCompose('${itemId}', q, this)`. `_doCompose(itemId, qty, button)` must synchronously disable the button, display `合成中...`, run through `OperationGuard` using `compose:<itemId>`, close the modal only on success, and restore the original button state in `finally` when the modal remains open.

- [x] **Step 6: Run automated checks**

Run: `node --test tests/operation-guard.test.js tests/resource-operation-consistency.test.js tests/coin-icon-rendering.test.js`

Expected: all tests pass.

Run: `node --check app.js`

Expected: exit code 0.

- [x] **Step 7: Commit atomic compose**

```bash
git add app.js tests/resource-operation-consistency.test.js
git commit -m "fix: make item composition atomic"
```

---

### Task 4: Treat every backpack axe as a separate spare

**Files:**
- Modify: `app.js:1210-1253`
- Modify: `app.js:2114-2177`
- Modify: `app.js:2270-2299`
- Modify: `tests/resource-operation-consistency.test.js`

**Interfaces:**
- Consumes: aggregate inventory convention where equipped axe is absent from `Game.inventory`.
- Produces: same-ID spare axes with normal equip and sell actions.

- [x] **Step 1: Write failing source regression tests**

```js
test('same-id backpack axes remain equipable and sellable', () => {
  const detail = app.match(/showItemDetail\(itemId\)[\s\S]*?\n  },/)?.[0] || '';
  assert.doesNotMatch(detail, /const isEquipped = Game\.state\.axeId === itemId/);
  assert.match(detail, /PlayerView\.equipItem/);
  assert.match(detail, /PlayerView\.sellItem/);

  const sell = app.match(/async sellAxe\(itemId\)[\s\S]*?\n  },/)?.[0] || '';
  assert.doesNotMatch(sell, /装备中的斧头无法出售/);
  assert.match(sell, /if \(!removed\) return false/);
});
```

- [x] **Step 2: Update weapon detail semantics**

Remove the `isEquipped` branch from `showItemDetail`. For every type-5 item in the backpack, render sell; render equip unless the realm requirement blocks it. Calculate `axeLocked` from realm eligibility only, not current equipped ID.

- [x] **Step 3: Allow selling a same-ID spare safely**

Remove the current-axe-ID rejection from `sellAxe`. Store `const removed = await DB.removeItem(itemId, 1)` and stop with an inventory resync and error toast when it is false. Only then add coins. If the player-state write fails, attempt to restore the removed axe and restore the previous local coin totals before returning false.

- [x] **Step 4: Allow equipping a same-ID spare**

For `state.axeId === itemId`, first confirm `_getItemQty(itemId) >= 1`, then treat the swap as a successful no-op because both aggregate items are identical: keep inventory quantity and equipped ID unchanged, show `装备了 <name>`, and return true. For different IDs, check every add/remove/update result and compensate the earlier inventory change if a later step fails.

- [x] **Step 5: Guard equip and sell UI entry points**

Run `equipItem`, `_equipFromForge`, and the confirmed `sellItem` callback through `OperationGuard` with keys `equip-axe` and `sell-axe:<itemId>`. Disable the initiating button where it remains mounted and prevent duplicate success toasts.

- [x] **Step 6: Run tests and commit**

Run: `node --test tests/resource-operation-consistency.test.js tests/coin-icon-rendering.test.js`

Expected: all tests pass.

Run: `node --check app.js`

Expected: exit code 0.

```bash
git add app.js tests/resource-operation-consistency.test.js
git commit -m "fix: treat backpack axes as independent spares"
```

---

### Task 5: Guard the remaining high-risk click operations

**Files:**
- Modify: `app.js:760-830`
- Modify: `app.js:1085-1165`
- Modify: `app.js:1256-1332`
- Modify: `app.js:2230-2268`
- Modify: `app.js:2740-2976`
- Modify: `app.js:3039-3120`
- Modify: `app.js:3276-3401`
- Modify: `app.js:4281-4328`
- Modify: `tests/resource-operation-consistency.test.js`

**Interfaces:**
- Produces: `DB.reservePlayerClaim(claimType, claimKey) -> { ok, code }`.
- Produces: conditional `DB.claimMail(id)`, `DB.claimSubmission(id)`, and `DB.reviewWithdrawalOnce(id, status)` that return false when the prior status no longer permits the operation.
- Consumes: `OperationGuard.run(key, task)`.

- [x] **Step 1: Add source regression coverage for every guarded entry point**

Create a table-driven assertion for these stable keys:

```js
const guardedKeys = [
  'cash:', 'equip-axe', 'sell-axe:', 'shop:', 'withdraw',
  'signin:', 'achievement:', 'task-reward:', 'submission-reward:',
  'theme-reward:', 'mail-reward:', 'withdraw-review:',
];
for (const key of guardedKeys) {
  assert.equal(app.includes(key), true, `missing operation key: ${key}`);
}
```

Also assert that `claimMail` filters `is_claimed = false`, submission claiming filters `status = approved`, and withdrawal review filters `status = pending` before returning success.

- [x] **Step 2: Add claim reservation and conditional DB wrappers**

```js
async reservePlayerClaim(claimType, claimKey) {
  const { data, error } = await dbClient.rpc('reserve_player_claim', {
    p_claim_type: claimType,
    p_claim_key: String(claimKey),
  });
  if (error) {
    console.error('DB reservePlayerClaim error:', error);
    return { ok: false, code: 'network_error' };
  }
  return data || { ok: false, code: 'empty_response' };
},
```

Change mail, task submission, and withdrawal status methods to use conditional updates plus `.select('id').maybeSingle()`. Return true only when a row was actually changed.

- [x] **Step 3: Reserve player-state claims before granting**

In sign-in milestone, achievement, and theme-extra handlers:

1. Keep the existing eligibility check.
2. Call `reservePlayerClaim` with `signin`, `achievement`, or `theme`.
3. If it returns `already_claimed`, refresh the player state and show “已领取”.
4. If it returns any other failure, show “操作未完成，请重试” and grant nothing.
5. Grant the configured reward only after a successful reservation.
6. Persist `themeRewardClaims` through `getPlayerState`, `updatePlayerState`, initial state, and refresh; remove `_claimedThemeRewards` memory-only tracking.

- [x] **Step 4: Claim stored-status rewards before granting**

For task rewards, self-submission rewards, and mail rewards, conditionally change the source row from `approved -> claimed` or `is_claimed false -> true` before granting. If no row changes, refresh and show “已领取”. Check every `grantItem` result; on failure, log the business ID, refresh state, and show “奖励状态已同步，请联系天道检查”，without retrying automatically.

- [x] **Step 5: Guard resource conversion and purchase**

Pass the initiating button or shop card into `_doCash`, `buyShopItem`, and `doWithdraw`. Run them through keys `cash:<itemId>`, `shop:<shopId>`, and `withdraw`. Disable the control and show `处理中...` while pending. Ensure `DB.removeItem`, `DB.updatePlayerState`, `DB.requestWithdrawal`, and `Game.grantItem` return values are checked before a success toast.

- [x] **Step 6: Guard task actions and existing resource consumers**

Apply the same helper to daily check-in, normal task submission, self-task submission, forge, breakthrough, single chop, and ten-chop using stable keys. Preserve their existing animations and current button text. Existing local booleans may remain, but `OperationGuard` becomes the shared last line of page-level duplicate protection.

- [x] **Step 7: Make withdrawal review conditional and guarded**

For both approval and rejection, first call `reviewWithdrawalOnce(id, targetStatus)` under key `withdraw-review:<id>`. Continue with cumulative total, refund, or mail only when the conditional `pending` update succeeds. This prevents repeated administrator actions from duplicating side effects.

- [x] **Step 8: Run all automated checks**

Run: `node --test tests/operation-guard.test.js tests/resource-operation-consistency.test.js tests/coin-icon-rendering.test.js`

Expected: all tests pass.

Run: `node --check app.js && node --check operation-guard.js`

Expected: both checks exit 0.

- [x] **Step 9: Commit the remaining guards**

```bash
git add app.js tests/resource-operation-consistency.test.js
git commit -m "fix: prevent duplicate resource actions"
```

---

### Task 6: Install, verify, and publish

**Files:**
- Modify: `docs/superpowers/plans/2026-09-04-resource-operation-consistency.md` (mark completed steps)

**Interfaces:**
- Consumes: `upgrade_v5.sql`, the new browser guard, and all updated app handlers.
- Produces: verified Supabase functions and published GitHub Pages build.

- [x] **Step 1: Install the v5 migration in Supabase**

Open the connected Supabase project SQL editor, execute the complete `upgrade_v5.sql`, and confirm both RPCs and `theme_reward_claims` exist. Execute the script a second time to verify it is idempotent.

- [x] **Step 2: Verify atomic compose directly**

Record a disposable test material and target quantity, call `compose_inventory_item` twice concurrently with stock sufficient for only one call, and verify exactly one result has `ok: true`, the other has `code: insufficient_materials`, source quantity never goes negative, and the target increases once. Restore the disposable test quantities afterward using explicit values recorded before the test.

- [x] **Step 3: Run the full local automated suite**

Run: `node --test tests/operation-guard.test.js tests/resource-operation-consistency.test.js tests/coin-icon-rendering.test.js`

Expected: all tests pass with no failures.

Run: `node --check app.js && node --check operation-guard.js`

Expected: exit code 0.

- [x] **Step 4: Verify in a local browser**

Start a local static server and test desktop plus mobile widths. Verify:

- repeated rapid clicks on compose create one result and show one success message;
- a same-ID spare axe shows both equip and sell actions;
- equipping it leaves backpack quantity unchanged;
- selling it reduces quantity once and does not change the equipped axe;
- cash, shop, withdrawal, sign-in, achievement, task, theme, mail, forge, breakthrough, chop, and admin review controls ignore repeated clicks while pending;
- button labels restore after simulated network failure;
- the browser console contains no uncaught errors.

Capture screenshots of the same-ID axe detail and the compose pending/success state.

- [x] **Step 5: Commit completed plan tracking**

```bash
git add docs/superpowers/plans/2026-09-04-resource-operation-consistency.md
git commit -m "docs: complete resource consistency plan"
```

- [x] **Step 6: Push and verify production**

Push `main` to `origin`, wait for GitHub Pages to publish, then repeat the core compose and same-ID axe checks on the public site. Confirm the deployed commit matches local HEAD and report the production URL and test result.
