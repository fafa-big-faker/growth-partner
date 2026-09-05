# Config Sync And Reward Quantity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync the six updated Feishu configuration groups, make reward quantities and daily sign-in rewards configurable, and change the ten-chop bonus pack to 1001.

**Architecture:** `sync-config.py` remains the single source-to-code adapter and emits backward-compatible reward pack data into `game-config.js`. Pure reward selection stays in `gameplay-rules.js`; `app.js` consumes its result without hard-coded quantities. A new idempotent Supabase migration makes configured daily rewards and the daily check-in record one atomic transaction.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-in test runner, Python Feishu sync script, Supabase PostgreSQL RPC, GitHub Pages.

## Global Constraints

- Preserve existing user work and never read or commit the root `apikey` file.
- Treat item ID `1` as chopping chances and all other IDs as inventory items.
- Missing or invalid configured reward quantities default to `1`.
- Repeated daily sign-in calls must never grant rewards twice.
- The extra reward on every tenth persisted chop uses reward pack `1001`.
- Do not spend further time attempting to paste images into Feishu; the complete illustrated catalog remains in the local Word artifact.

---

### Task 1: Reward Quantity Contract

**Files:**
- Modify: `tests/gameplay-rules.test.js`
- Modify: `gameplay-rules.js`
- Modify: `sync-config.py`
- Regenerate: `game-config.js`

**Interfaces:**
- Consumes: reward packs from Feishu with parallel item ID and item count columns.
- Produces: `rollPackItem(pack, random) -> { itemId, quantity, quality }`, accepting new `rewards` entries and old `items` entries.

- [ ] **Step 1: Write failing selection tests**

Add assertions for per-item quantities and the legacy default of `1`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/gameplay-rules.test.js`

- [ ] **Step 3: Implement the compatibility adapter**

Parse the new count column, emit `rewards`, preserve `items`, and make `rollPackItem` return the selected quantity.

- [ ] **Step 4: Regenerate configuration and rerun the focused test**

Run: `python sync-config.py` and `node --test tests/gameplay-rules.test.js`.

### Task 2: Game Drop Consumption And Ten-Chop Pack

**Files:**
- Modify: `app.js`
- Create: `tests/reward-config-consistency.test.js`

**Interfaces:**
- Consumes: `{ itemId, quantity, quality }` from pack selection.
- Produces: all ordinary and bonus drops with the selected configured quantity; bonus pack ID `1001`.

- [ ] **Step 1: Write source-level regression tests**

Assert that `_rollDrop` and `_rollPackDrop` propagate configured quantity and that the ten-chop branch calls `_rollPackDrop(1001)`.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/reward-config-consistency.test.js`.

- [ ] **Step 3: Update both drop paths and the ten-chop constant**

Replace `quantity: 1` with validated configured quantities and use pack `1001`.

- [ ] **Step 4: Rerun focused tests**

Run: `node --test tests/reward-config-consistency.test.js tests/gameplay-rules.test.js`.

### Task 3: Configurable Atomic Daily Sign-In

**Files:**
- Modify: `sync-config.py`
- Regenerate: `game-config.js`
- Modify: `app.js`
- Create: `upgrade_v7.sql`
- Modify: `tests/signin-consistency.test.js`

**Interfaces:**
- Consumes: `GAME_CONFIG.dailySignInRewards` as `{ itemId, count }[]`.
- Produces: `daily_check_in(p_rewards JSONB)` RPC response with updated days, chopping count, claims, and inventory; repeat calls return `already_checked` without rewards.

- [ ] **Step 1: Extend sign-in consistency tests**

Assert v7 accepts JSON rewards, handles item `1`, updates inventory atomically, and the client passes configured rewards without hard-coded copy.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/signin-consistency.test.js`.

- [ ] **Step 3: Parse the daily reward worksheet and add a generated getter**

Read parallel ID/count cells into `{ itemId, count }[]`, defaulting invalid counts to `1`.

- [ ] **Step 4: Implement migration and client integration**

Create the v7 RPC, pass the generated reward list from `app.js`, and format the success message from item definitions.

- [ ] **Step 5: Regenerate and rerun focused tests**

Run: `python sync-config.py` and `node --test tests/signin-consistency.test.js`.

### Task 4: Feishu Headers And Full Configuration Sync

**Files:**
- Modify externally: Feishu configuration worksheets.
- Regenerate: `game-config.js`

**Interfaces:**
- Consumes: current Chinese-column order in each worksheet.
- Produces: English parameter names in row 1 and current role, tree, pool, sign-in, achievement, and shop values in `game-config.js`.

- [ ] **Step 1: Read the first two rows of each affected worksheet**

Verify column order before editing any header.

- [ ] **Step 2: Fill only missing English parameter headers**

Use `pool_id`, `pack_id`, `weight`, `item_ids`, `item_counts`, `quality_id`, `quality_note`, `reward_item_ids`, and `reward_counts` in the actual matching columns.

- [ ] **Step 3: Run the sync and inspect generated counts and representative rows**

Run: `python sync-config.py` and confirm all six groups changed as expected.

### Task 5: End-To-End Verification And Release

**Files:**
- Modify externally: Supabase database function.
- Commit: all scoped source, test, migration, and catalog files.

**Interfaces:**
- Consumes: passing repository tests and v7 SQL.
- Produces: deployed GitHub Pages build and upgraded Supabase RPC.

- [ ] **Step 1: Run the complete test suite**

Run: `node --test tests/*.test.js`.

- [ ] **Step 2: Apply `upgrade_v7.sql` in Supabase and smoke-test check-in behavior**

Verify the function signature and atomic response without granting duplicate rewards.

- [ ] **Step 3: Commit and push `main`**

Commit only scoped files; confirm GitHub receives the commit.

- [ ] **Step 4: Verify GitHub Pages**

Open the production URL, confirm updated assets/config load, and check the browser console for errors.
