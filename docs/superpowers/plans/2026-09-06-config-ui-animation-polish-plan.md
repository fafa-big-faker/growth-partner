# Config UI Animation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship reliable config-field mapping, polished sign-in/shop/inventory interactions, weapon-specific idle/chop animation, and a genuinely accelerating ten-chop sequence.

**Architecture:** Keep the static application structure and isolate deterministic behavior in small helpers and image-processing scripts. `app.js` remains the integration layer, while tests verify rendered markup, state preservation, timing curves, and generated assets. Feishu is the source of configuration truth and `game-config.js` remains generated output.

**Tech Stack:** HTML, CSS, browser JavaScript, Node test runner, Python Pillow, Feishu CLI/API, Supabase, GitHub Pages.

## Global Constraints

- Do not modify test player data unless a test explicitly requires it.
- Preserve the selected inventory tab after every local redraw.
- Idle atlases contain four frames per weapon; chop V2 atlases contain six frames per weapon.
- Ten-chop presentation accelerates linearly from 1x to 3x, including intervals and drops.
- Do not perform browser visual acceptance unless the user explicitly requests it.
- Report immediately if one step has no material progress for ten minutes.
- Never commit API keys, access tokens, or credential-bearing remote URLs.

---

### Task 1: Stabilize Feishu Field Mapping

**Files:**
- Modify: `sync-config.py`
- Modify generated: `game-config.js`
- Test: `tests/reward-config-consistency.test.js`

**Interfaces:**
- Consumes: English parameter row from Feishu sheets.
- Produces: `GAME_CONFIG.rewardPacks`, `dailySignInRewards`, and `shopTable[].description`.

- [x] Add tests for reward quantities, daily sign-in rewards, and shop descriptions.
- [x] Add header-index helpers and required-header validation to the sync script.
- [x] Update the Feishu English parameter cells and run the sync script.
- [x] Run focused configuration tests.

### Task 2: Refine Sign-in and Shop Rendering

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/signin-consistency.test.js`
- Test: `tests/visual-assets.test.js`

**Interfaces:**
- Consumes: `getDailySignInRewards()`, `getSignInRewards()`, and `getShopItems()`.
- Produces: a single-icon cumulative sign-in timeline and description-led shop cards.

- [x] Add failing markup tests for dynamic daily rewards, non-duplicated milestone icons, and shop description text.
- [x] Implement the dedicated daily sign-in reward renderer and refined cumulative milestone markup.
- [x] Add shop description and a distinct action footer without changing purchase rules.
- [x] Run focused UI-rendering tests.

### Task 3: Preserve Inventory Interaction State

**Files:**
- Modify: `app.js`
- Test: `tests/resource-operation-consistency.test.js`

**Interfaces:**
- Produces: all inventory redraws call `renderInventory(this.currentInvTab)`.

- [x] Add a regression assertion covering weapon sale success.
- [x] Remove any hard-coded redraw to the item tab.
- [x] Run the focused consistency test.

### Task 4: Rebuild Weapon Animation Assets

**Files:**
- Modify: `scripts/split_axe_sheets.py`
- Create: `scripts/split_idle_axe_sheets.py`
- Replace: `assets/images/character/axes/{itemId}/frame-01.png` through `frame-06.png`
- Create: `assets/images/character/idle-axes/{itemId}/frame-01.png` through `frame-04.png`
- Modify: `character-animator.js`
- Modify: `app.js`
- Test: `tests/character-animator.test.js`
- Test: `tests/cultivator-scene.test.js`

**Interfaces:**
- Produces: `getAxeChopFrames(itemId)` and `getAxeIdleFrames(itemId)`.
- Consumes: magenta-separated V2 chop sheets and four-frame idle sheets.

- [x] Add tests for four-frame idle selection and immediate equipment switching.
- [x] Implement separator-aware V2 chop cutting and content-aware idle cutting.
- [x] Generate and validate 54 chop frames and 36 idle frames.
- [x] Wire both frame sets to the equipped weapon and run focused tests.

### Task 5: Synchronize Ten-Chop Pace

**Files:**
- Modify: `ten-chop-timeline.js`
- Modify: `app.js`
- Test: `tests/ten-chop-timeline.test.js`
- Test: `tests/cultivator-scene.test.js`

**Interfaces:**
- Produces: `TenChopTimeline.getStep(index)` with `speed`, `frameMs`, `dropMs`, and `gapMs`.

- [x] Add tests for first, middle, and final interval values.
- [x] Extend timing steps so the inter-chop gap follows the same 1x-to-3x curve.
- [x] Play one continuous ten-chop sequence without idle frames between hits.
- [x] Run focused timeline and scene tests.

### Task 6: Polish Login Button States

**Files:**
- Modify: `styles.css`
- Test: `tests/visual-assets.test.js`

**Interfaces:**
- Consumes: existing `Auth._setLoading()` disabled state.
- Produces: hover, active, focus-visible, and disabled feedback for `.login-submit`.

- [x] Add a CSS regression assertion for all interaction states.
- [x] Implement restrained motion, elevation, press feedback, focus ring, and disabled styling.
- [x] Run the focused test.

### Task 7: Add Project Operating Standards

**Files:**
- Create: `AGENTS.md`
- Create: `docs/PROJECT_PLAYBOOK.md`
- Create: `docs/ASSET_PIPELINE.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: durable instructions read by future project sessions and reusable asset-processing commands.

- [x] Record project-specific working rules and the ten-minute blocker policy.
- [x] Document config sync, testing, release, rollback, and credential handling.
- [x] Document sprite-sheet production, cutting, validation, and preview workflow.
- [x] Ensure common secret filenames are ignored.

### Task 8: Verify and Release

**Files:**
- Modify only files required by verification findings.

**Interfaces:**
- Produces: a tested commit pushed to `origin/main` and deployed by GitHub Pages.

- [x] Run all Node tests and JavaScript syntax checks.
- [x] Run Python compile checks and image validation.
- [x] Run `git diff --check` and inspect the scoped diff.
- [x] Commit and push `main`; do not perform browser visual acceptance unless requested.
