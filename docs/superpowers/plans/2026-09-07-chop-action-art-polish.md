# Chop Action Art Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cultivation action controls with the approved ink-wash chop button, icon-only forge entrance, and accurate tree-upgrade hint.

**Architecture:** Keep gameplay behavior in the current vanilla JavaScript view, add one pure upgrade-eligibility rule to `gameplay-rules.js`, and drive the new presentation through semantic DOM classes in `app.js` plus CSS animations. Import source PNGs into the existing v2 image pipeline and serve bounded WebP runtime assets.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node test runner, Python Pillow asset builder, GitHub Pages.

## Global Constraints

- The chop count displays digits only.
- Do not modify Feishu configuration, Supabase schema, or player data.
- Do not edit `game-config.js` manually.
- Do not perform browser visual acceptance unless requested.
- Do not add or commit `supabase/`.

---

### Task 1: Upgrade Eligibility Rule

**Files:**
- Modify: `gameplay-rules.js`
- Modify: `tests/gameplay-rules.test.js`

**Interfaces:**
- Produces: `canUpgradeTreeRealm(nextRealm, inventory): boolean`

- [ ] **Step 1: Write failing tests** for missing next realm, missing requirements, insufficient quantities, and all requirements satisfied.
- [ ] **Step 2: Run the focused test** with `node --test tests/gameplay-rules.test.js` and verify failure.
- [ ] **Step 3: Implement the pure rule** using normalized string item IDs and numeric quantities.
- [ ] **Step 4: Re-run the focused test** and verify all cases pass.

### Task 2: Artwork Pipeline

**Files:**
- Create: `assets/images/v2/ui/chop-button-bg.png`
- Modify: `assets/images/v2/icons/icon-forge.png`
- Create: `assets/runtime/v2/ui/chop-button-bg.webp`
- Modify: `assets/runtime/v2/icons/icon-forge.webp`
- Modify: `assets/runtime/v2/manifest.json`
- Modify: `tests/runtime-image-assets.test.py`

**Interfaces:**
- Produces: bounded runtime paths consumed by CSS and the initial asset preloader.

- [ ] **Step 1: Add manifest expectation** for `chop-button-bg` and run the focused image test to verify failure.
- [ ] **Step 2: Import the approved source PNG files** under stable ASCII filenames.
- [ ] **Step 3: Run `scripts/build_runtime_images.py`** to produce bounded WebP files and update the manifest.
- [ ] **Step 4: Run the focused image tests** and verify size, format, and manifest constraints.

### Task 3: Cultivation Action Markup And Interaction

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Create: `tests/cultivation-action-polish.test.js`

**Interfaces:**
- Consumes: `GameplayRules.canUpgradeTreeRealm`, v2 WebP assets, existing `renderItemIcon` and `renderFeatureIcon`.
- Produces: `.chop-circle-btn`, `.chop-ink-ripple`, `.chop-count-badge`, `.tree-upgrade-hint`, and `.forge-btn` visual contracts.

- [ ] **Step 1: Write failing structural tests** for pure-digit count markup, ink background and animations, icon-only forge entrance, and conditional upgrade hint.
- [ ] **Step 2: Run the focused test** and verify failure.
- [ ] **Step 3: Update `renderCultivate()`** to compute eligibility once, render the hint conditionally, add ink feedback markup, and remove forge material markup.
- [ ] **Step 4: Update CSS** with stable responsive dimensions, overflow behavior, hover/press keyframes, reduced-motion fallbacks, and accessible focus treatment.
- [ ] **Step 5: Add the chop background to initial preload** and remove the obsolete forge entrance inventory-refresh selector.
- [ ] **Step 6: Run focused tests** and verify all cases pass.

### Task 4: Full Verification And Release

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-chop-action-art-polish-design.md`
- Modify: `docs/superpowers/plans/2026-09-07-chop-action-art-polish.md`

- [ ] **Step 1: Run all Node tests.**
- [ ] **Step 2: Run JavaScript syntax checks, Python compile checks, image tests, and `git diff --check`.**
- [ ] **Step 3: Inspect the diff and status** for secrets, unrelated files, and accidental `supabase/` inclusion.
- [ ] **Step 4: Commit only scoped files** with a player-facing message.
- [ ] **Step 5: Push `main` to `origin`** and confirm the remote branch contains the commit.
