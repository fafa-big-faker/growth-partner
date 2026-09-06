# Login Accounts and Axe Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship weapon-specific character animation, accelerated ten-chop feedback, isolated live accounts, and an art-directed loading login screen.

**Architecture:** Static assets are preprocessed once and selected by item ID at runtime. Small pure helpers own timing and account mapping while `app.js` integrates them with the current DOM and Supabase layer. A versioned SQL migration makes existing atomic RPCs role-aware.

**Tech Stack:** HTML, CSS, browser JavaScript, Node test runner, Python Pillow, Supabase PostgreSQL.

## Global Constraints

- Preserve the current `player` and `admin` credentials as test accounts.
- Keep current test data under `user_role = 'player'`; live data uses `user_role = 'player_live'`.
- Every axe atlas contains exactly six horizontal `362x724` frames.
- Ten-chop speed increases linearly from 1x to 3x and drop animation follows the same multiplier.
- Enter a dashboard only after image preloading and data initialization settle successfully.

---

### Task 1: Process Weapon Animation Atlases

**Files:**
- Create: `scripts/split_axe_sheets.py`
- Create: `assets/images/character/axes/{itemId}/frame-01.png` through `frame-06.png`

**Interfaces:**
- Produces: `getAxeChopFrames(itemId)` compatible asset paths.

- [ ] Add a Pillow script that discovers atlases by leading five-digit item ID, validates dimensions, splits six frames, preserves RGBA transparency, and verifies outputs.
- [ ] Run `F:\py\python.exe scripts\split_axe_sheets.py` and verify 54 frames.

### Task 2: Make Animation and Ten-Chop Timing Dynamic

**Files:**
- Modify: `character-animator.js`
- Create: `ten-chop-timeline.js`
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/character-animator.test.js`
- Create: `tests/ten-chop-timeline.test.js`

**Interfaces:**
- Produces: `animator.setFrames({ idleFrames, chopFrames })`.
- Produces: `animator.playChop({ frameMs, resumeIdle })`.
- Produces: `TenChopTimeline.getStep(index, count, minSpeed, maxSpeed)` returning `{ speed, frameMs, dropMs }`.

- [ ] Write failing tests for runtime frame replacement, speed override, and the 1x/3x endpoints.
- [ ] Implement the helpers and replace the separate weapon overlay with item-ID frame selection.
- [ ] Drive character and scatter transitions from each ten-chop step and run focused tests.

### Task 3: Redesign Weapon Details

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Create: `tests/weapon-detail.test.js`

**Interfaces:**
- Consumes: existing `ITEMS`, `QUALITY`, realm helpers, and modal actions.

- [ ] Add a test asserting weapon details omit quantity and emphasize skill content.
- [ ] Render the dedicated equipment layout while preserving non-weapon detail behavior.
- [ ] Run the focused test.

### Task 4: Add Live Account Isolation

**Files:**
- Create: `account-session.js`
- Modify: `index.html`
- Modify: `app.js`
- Create: `upgrade_v8.sql`
- Create: `tests/account-session.test.js`

**Interfaces:**
- Produces: `AccountSession.verify(role, password)` returning `{ role, playerRole, environment }` or null.
- Produces: `DB.setPlayerRole(playerRole)`.

- [ ] Test legacy and live credential mapping without storing live plaintext secrets.
- [ ] Make all player-owned queries and writes use `DB.playerRole`, including submissions, mail, withdrawals, GM reset, and RPC calls.
- [ ] Add role-aware replacements for compose, claim reservation, and daily sign-in SQL functions.
- [ ] Apply the migration and smoke-test both role keys.

### Task 5: Rebuild Login and Preload Assets

**Files:**
- Create: `assets/images/v2/backgrounds/login-main.png`
- Create: `asset-preloader.js`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Create: `tests/asset-preloader.test.js`

**Interfaces:**
- Produces: `AssetPreloader.collect(...)` and `AssetPreloader.preload(urls, onProgress)`.

- [ ] Copy the supplied background into the project and build the new responsive login DOM/CSS.
- [ ] Collect static manifest, item, tree, login, and all axe frame URLs; preload with progress and error settlement.
- [ ] Lock duplicate login submissions, initialize data, and recover cleanly on failure.
- [ ] Run focused tests and inspect desktop/mobile screenshots.

### Task 6: Full Verification and Release

**Files:**
- Modify as required by verification findings only.

- [ ] Run all Node tests, JavaScript syntax checks, Python compile checks, image validation, and `git diff --check`.
- [ ] Commit, push `main`, wait for GitHub Pages, and verify the public site.
