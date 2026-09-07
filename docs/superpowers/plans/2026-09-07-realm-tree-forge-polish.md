# Realm, Tree, And Forge Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the latest realm and tree appearance configuration, simplify axe requirements, align all tree artwork to one strike point, and enforce a two-to-three-second forge reveal.

**Architecture:** `sync-config.py` remains the only writer of `game-config.js` and reads the two affected sheets by stable English headers. `app.js` uses one axe-requirement renderer and one allowlisted tree appearance registry with per-appearance layout classes. `ForgeReveal` tracks both the server result and a randomized minimum presentation deadline before revealing.

**Tech Stack:** Python 3 and lark-cli for Feishu synchronization; vanilla JavaScript and CSS; Node test runner; Pillow resource validation; GitHub Pages.

## Global Constraints

- Feishu configuration is the source of truth; never hand-edit `game-config.js`.
- Exact requirement copy: `适配仙阶：{仙阶}及以上`.
- Forge minimum duration is an inclusive 2000-3000 millisecond range.
- Tree mapping comes from `tree_appearance`; unknown values fall back to `sprout`.
- Tree is behind the cultivator; hit effects remain above both.
- Do not modify or reset player data.
- Do not perform browser visual acceptance unless explicitly requested.

---

### Task 1: Synchronize Realm And Tree Configuration

**Files:**
- Modify: `sync-config.py:206-229,338-353`
- Regenerate: `game-config.js`
- Test: `tests/reward-config-consistency.test.js`

**Interfaces:**
- Consumes: Feishu headers `level`, `realm_id`, `realm_name`, `max_axe_quality`, `character_image`, `reqItems`, `req_item_count`, `icon`, `tree_id`, `tree_name`, `tree_appearance`, `pool_id`, `req_items`, and `note`.
- Produces: `GAME_CONFIG.realmTable[].maxAxeQuality` and `GAME_CONFIG.treeTable[].appearance`.

- [ ] **Step 1: Add failing configuration assertions**

Assert that `sync-config.py` uses `header_indexes()` for both sheets, and that generated configuration contains the latest realm thresholds and appearance ranges.

- [ ] **Step 2: Run the focused test and require failure**

Run `node --test tests\reward-config-consistency.test.js` and confirm the old positional readers or stale generated values fail.

- [ ] **Step 3: Replace positional reads with header-name reads**

Build `realm_headers` and `tree_headers`, use `row_value()` for every field, and preserve parallel role breakthrough item/count parsing.

- [ ] **Step 4: Run the authorized configuration sync**

Set `PYTHONUTF8=1` and `LARK_CLI` to the authorized executable, then run `python sync-config.py`. Confirm the generated table contains 16 role realms and 16 tree states.

- [ ] **Step 5: Run configuration tests**

Run `node --test tests\reward-config-consistency.test.js` and `node --check game-config.js`.

### Task 2: Simplify Axe Realm Requirements

**Files:**
- Modify: `app.js:333-349,3006-3085,4855-4876`
- Modify: `styles.css:2029-2115,3279-3294`
- Test: `tests/weapon-detail.test.js`

**Interfaces:**
- Consumes: `getMinRealmForAxeQuality(quality)` and `canEquipAxeQuality(quality, realmLevel)`.
- Produces: `renderAxeRealmRequirement(quality, realmLevel, options)` returning consistent requirement HTML.

- [ ] **Step 1: Add failing UI assertions**

Require one exact `适配仙阶` line, forbid `尚未满足穿戴要求`, `可穿戴`, and `（当前：`, and require the forge result to use the same helper.

- [ ] **Step 2: Run the focused test and require failure**

Run `node --test tests\weapon-detail.test.js`.

- [ ] **Step 3: Implement the shared renderer and restrained states**

Render a compact success or error requirement row. Keep the quality tag, remove the duplicated meta status, and show “已放入背包” separately for locked forge results.

- [ ] **Step 4: Run the focused test**

Run `node --test tests\weapon-detail.test.js tests\forge-reveal.test.js`.

### Task 3: Drive Tree Artwork From Configuration And Align The Scene

**Files:**
- Modify: `app.js:225-260,311-319,2684-2727,2811-2816`
- Modify: `styles.css:2159-2224,2878-2896,3458-3474`
- Test: `tests/cultivator-scene.test.js`
- Test: `tests/visual-assets.test.js`

**Interfaces:**
- Consumes: `TREE_REALMS[].appearance` and the allowlisted `sprout`, `spirit`, `divine` runtime assets.
- Produces: `getTreeAppearance(treeRealmLevel)` returning `{ key, src }` and an appearance class `tree-appearance-{key}`.

- [ ] **Step 1: Add failing scene assertions**

Require configuration-based appearance selection, fallback behavior, appearance classes, and CSS where cultivator stacking is greater than tree stacking.

- [ ] **Step 2: Run focused tests and require failure**

Run `node --test tests\cultivator-scene.test.js tests\visual-assets.test.js`.

- [ ] **Step 3: Implement the appearance registry and render path**

Carry `tree.appearance` into `TREE_REALMS`, replace threshold logic with an allowlisted lookup, and use the same resolved appearance in the scene and tree detail modal.

- [ ] **Step 4: Add per-appearance anchor variables**

Use a common ground baseline and separate `sprout`, `spirit`, and `divine` dimensions/offsets. Set tree below cultivator and leave effects at their existing highest layer.

- [ ] **Step 5: Run focused scene and resource tests**

Run the two Node tests plus `python tests\runtime-image-assets.test.py`.

### Task 4: Enforce A Randomized Forge Presentation Floor

**Files:**
- Modify: `app.js:2529-2635`
- Test: `tests/forge-reveal.test.js`

**Interfaces:**
- Produces: `ForgeReveal.getMinimumDuration(random = Math.random)` returning an integer from 2000 through 3000.
- Consumes: the existing tracked `resultPromise` and candidate renderer.

- [ ] **Step 1: Add failing forge timing assertions**

Test both random boundaries, require a presentation deadline independent of the result promise, and require reveal only after both conditions are satisfied.

- [ ] **Step 2: Run the focused test and require failure**

Run `node --test tests\forge-reveal.test.js`.

- [ ] **Step 3: Implement the minimum deadline**

Start the timer and result tracking together. Continue candidate cycling until both the sampled deadline and result settle, animate toward 98%, then reveal and fill 100%.

- [ ] **Step 4: Preserve reduced motion and rejection behavior**

Reduced motion waits without rapid candidate swapping. Promise rejection remains captured and is thrown only after the presentation loop exits.

- [ ] **Step 5: Run the focused test**

Run `node --test tests\forge-reveal.test.js`.

### Task 5: Verify And Release

**Files:**
- Modify only files required by verification findings.

**Interfaces:**
- Produces: a tested commit on `origin/main` and a successful GitHub Pages deployment.

- [ ] **Step 1: Run complete verification**

Run `node --test tests\*.test.js`, JavaScript syntax checks, Python compilation, `python tests\character-frame-alignment.test.py`, `python tests\runtime-image-assets.test.py`, and `git diff --check`.

- [ ] **Step 2: Inspect the scoped diff**

Confirm no credentials, player data, Supabase cache, temporary files, or unrelated user changes are included.

- [ ] **Step 3: Commit and push**

Stage only the design, plan, configuration, code, styles, and tests from this feature. Push `main` to `origin`.

- [ ] **Step 4: Verify deployment**

Use the GitHub deployment API to confirm the exact pushed SHA reaches `success`. Do not run browser visual acceptance.
