# Inventory Consistency And Achievement Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge and prevent duplicate stackable inventory rows, update every visible inventory consumer immediately after successful mutations, and keep the achievement red dot aligned with all unclaimed claimable rewards.

**Architecture:** A versioned Supabase migration owns inventory uniqueness and atomic add/remove/compose/forge behavior. The browser defensively aggregates inventory reads and routes successful mutations through one local synchronization method. Achievement IDs are normalized at the model boundary and their computed badge state survives DOM replacement.

**Tech Stack:** Vanilla JavaScript, Supabase Postgres/PLpgSQL RPCs, Node.js built-in test runner, Python asset validation scripts, GitHub Pages.

## Global Constraints

- Existing duplicate stackable rows are merged by `(user_role, item_id)` and quantities are summed; no other player data is reset.
- Independent weapon instances are not merged or changed.
- A success message appears only after the database mutation and local UI synchronization succeed.
- Feishu configuration and generated `game-config.js` are not changed.
- Do not run browser visual acceptance unless explicitly requested.
- Do not commit the local `supabase/` CLI cache.

---

### Task 1: Inventory Migration And Atomic RPC Contract

**Files:**
- Create: `supabase-migration-v13.sql`
- Create: `tests/inventory-consistency-migration.test.js`

**Interfaces:**
- Produces: `add_inventory_item(p_user_role TEXT, p_item_id TEXT, p_quantity INTEGER) -> JSONB`
- Produces: `remove_inventory_item(p_user_role TEXT, p_item_id TEXT, p_quantity INTEGER) -> JSONB`
- Updates: `compose_inventory_item(...)` and `forge_weapon_instance(...)` to return authoritative remaining/target quantities.

- [ ] **Step 1: Write the failing migration contract tests**

Assert that `supabase-migration-v13.sql` merges duplicates using `SUM(quantity)`, deletes surplus rows, creates a unique `(user_role, item_id)` index, uses `ON CONFLICT` for atomic additions, validates positive integer quantities, and updates compose/forge functions without `ORDER BY id LIMIT 1` inventory selection.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/inventory-consistency-migration.test.js`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the idempotent migration**

Within one transaction:

```sql
WITH grouped AS (
  SELECT user_role,
         item_id,
         (ARRAY_AGG(id ORDER BY updated_at NULLS LAST, id))[1] AS keep_id,
         SUM(quantity)::INTEGER AS total
  FROM public.inventory
  GROUP BY user_role, item_id
)
UPDATE public.inventory i
SET quantity = grouped.total, updated_at = NOW()
FROM grouped
WHERE i.id = grouped.keep_id;

DELETE FROM public.inventory i
USING (
  SELECT user_role,
         item_id,
         (ARRAY_AGG(id ORDER BY updated_at NULLS LAST, id))[1] AS keep_id
  FROM public.inventory
  GROUP BY user_role, item_id
) keepers
WHERE i.user_role = keepers.user_role
  AND i.item_id = keepers.item_id
  AND i.id <> keepers.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_user_item_unique_idx
  ON public.inventory (user_role, item_id);
```

Create atomic `add_inventory_item` and `remove_inventory_item` functions and replace compose, daily check-in, and forge inventory access with the unique-row contract. Return exact post-mutation quantities in JSONB.

- [ ] **Step 4: Run focused migration tests**

Run: `node --test tests/inventory-consistency-migration.test.js tests/compose-rpc-migration.test.js tests/signin-consistency.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the database contract**

```bash
git add supabase-migration-v13.sql tests/inventory-consistency-migration.test.js
git commit -m "fix-atomic-inventory-storage"
```

### Task 2: Defensive Inventory Aggregation And Immediate Synchronization

**Files:**
- Modify: `app.js`
- Create: `tests/inventory-consistency-ui.test.js`
- Modify: `tests/resource-operation-consistency.test.js`
- Modify: `tests/inventory-novelty-integration.test.js`

**Interfaces:**
- Consumes: `add_inventory_item` and `remove_inventory_item` RPCs from Task 1.
- Produces: `Game._applyInventoryChanges(changes)` for authoritative local quantity changes and visible UI synchronization.
- Produces: `PlayerView.refreshInventoryConsumers()` for safe DOM-local updates.

- [ ] **Step 1: Write failing browser-model contract tests**

Assert that `DB.getInventory()` groups rows by string item ID; `DB.addItem()` and `DB.removeItem()` call the atomic RPCs; composition and forge route returned quantities through one synchronization method; and the method refreshes the backpack, forge entrance, open forge material counter, button state, novelty snapshot, and achievement badge without a remote reload.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/inventory-consistency-ui.test.js tests/resource-operation-consistency.test.js tests/inventory-novelty-integration.test.js`

Expected: FAIL on missing aggregation/RPC/synchronization contracts.

- [ ] **Step 3: Implement defensive aggregation and atomic DB adapters**

Change `DB.getInventory()` to normalize `item_id` with `String()`, sum positive numeric quantities into a `Map`, and return one object per item. Change `DB.addItem()`/`DB.removeItem()` to call the new RPCs and return authoritative results while keeping their existing truthy/falsy compatibility at callers.

- [ ] **Step 4: Implement one inventory synchronization path**

Add a method shaped as:

```js
_applyInventoryChanges(changes) {
  for (const change of changes) this._setInventoryQuantity(change.itemId, change.quantity);
  this._syncInventoryNovelty();
  PlayerView.refreshInventoryConsumers();
  UI._updateAchBadge();
}
```

`refreshInventoryConsumers()` must check whether each target exists before updating it, preserve `currentInvTab`, refresh the forge entrance stone count, update an open forge modal's count and button state, and redraw the inventory only when its container is connected.

- [ ] **Step 5: Route successful operations through synchronization**

Use authoritative RPC quantities in `grantItem`, `composeMulti`, `forge`, and direct remove-item consumers. Show composition success only after `_applyInventoryChanges()` returns. Ensure the forge reveal animation reads the already-updated local amount and the cultivation-page entry changes even while its modal remains open.

- [ ] **Step 6: Run focused UI tests**

Run: `node --test tests/inventory-consistency-ui.test.js tests/resource-operation-consistency.test.js tests/inventory-novelty-integration.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the immediate synchronization behavior**

```bash
git add app.js tests/inventory-consistency-ui.test.js tests/resource-operation-consistency.test.js tests/inventory-novelty-integration.test.js
git commit -m "fix-immediate-inventory-synchronization"
```

### Task 3: Achievement Claim Identity And Persistent Badge State

**Files:**
- Modify: `app.js`
- Create: `tests/achievement-badge-consistency.test.js`

**Interfaces:**
- Produces: normalized string achievement IDs in progress and claim comparisons.
- Produces: `UI._achievementBadgeVisible` as the last computed state applied whenever the header controls render.

- [ ] **Step 1: Write failing achievement consistency tests**

Cover numeric configuration IDs against string claim records, string configuration IDs against numeric records, one of multiple claimable rewards being claimed, progress mutations while the achievement button is absent, and badge application after the button is rendered again.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/achievement-badge-consistency.test.js`

Expected: FAIL on strict mixed-type ID comparison and missing persistent badge state.

- [ ] **Step 3: Normalize claim identity and centralize badge updates**

Build a `Set` from `achievementClaims.map(String)`, compare with `String(a.achievementId)`, pass the normalized ID to claim reservation, and store claims without mixed types. `_updateAchBadge()` always calculates and stores visibility even when `#ach-dot` is absent; page/header rendering reapplies the stored value.

- [ ] **Step 4: Refresh after every relevant successful mutation**

Call the centralized badge update after chop, ten-chop persistence, level/realm/tree progress changes, item inventory synchronization, and achievement claim completion. Preserve the red dot if any other achievement remains claimable.

- [ ] **Step 5: Run focused achievement tests**

Run: `node --test tests/achievement-badge-consistency.test.js tests/gameplay-rules.test.js tests/resource-operation-consistency.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the achievement fix**

```bash
git add app.js tests/achievement-badge-consistency.test.js
git commit -m "fix-achievement-badge-consistency"
```

### Task 4: Live Migration, Full Verification, And Release

**Files:**
- Modify only if verification reveals a scoped defect in files from Tasks 1-3.

**Interfaces:**
- Consumes: linked Supabase project and GitHub `origin/main`.
- Produces: migrated live schema and deployed GitHub Pages build.

- [ ] **Step 1: Run the complete local verification suite**

```bash
node --test tests/*.test.js
node --check app.js
node --check inventory-novelty.js
python -m py_compile sync-config.py scripts/*.py tests/*.py
python tests/character-frame-alignment.test.py
python tests/runtime-image-assets.test.py
git diff --check
```

Expected: all checks pass.

- [ ] **Step 2: Inspect release diff and secret boundaries**

Confirm only planned files and the design/plan commits are present, `supabase/` remains untracked, and no token, password, API key, or credential-bearing URL appears in the diff.

- [ ] **Step 3: Apply the migration to the linked Supabase project**

Use the already-authorized Supabase CLI to execute `supabase-migration-v13.sql`. Query duplicate groups afterward and require zero rows:

```sql
SELECT user_role, item_id, COUNT(*)
FROM public.inventory
GROUP BY user_role, item_id
HAVING COUNT(*) > 1;
```

- [ ] **Step 4: Run a post-migration smoke query**

Verify the unique index and RPC signatures exist and that both player roles retain their summed positive inventory quantities. Do not reset or manually alter unrelated player state.

- [ ] **Step 5: Commit any final scoped fixes and push**

```bash
git push origin main
```

- [ ] **Step 6: Verify GitHub Pages deployment**

Check the workflow for the pushed commit until it succeeds. Do not perform browser visual acceptance.
