# Runtime Image Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce first-login image transfer and request count while preserving crisp artwork at its actual display size.

**Architecture:** Keep existing PNG artwork as editable source assets and generate a deterministic WebP runtime tree. Load only shared first-screen art plus the currently equipped weapon animation during login; preload another weapon's frames before rendering after equipment changes.

**Tech Stack:** Python Pillow, WebP, browser JavaScript, CSS, Node test runner.

## Global Constraints

- Preserve source PNG assets and transparent edges.
- Runtime animation frames use the same aspect ratio and frame count as source sprites.
- Do not preload animations for unequipped weapons at login.
- Use at least two display pixels per CSS pixel for player-facing art where practical.
- Do not use WPS or manual compression.

---

### Task 1: Define Runtime Asset Budgets

**Files:**
- Create: `tests/runtime-image-assets.test.py`
- Modify: `tests/asset-preloader.test.js`
- Modify: `tests/cultivator-scene.test.js`

**Interfaces:**
- Consumes: runtime images and initial asset selection helpers.
- Produces: size, dimension, transparency, and current-weapon-only preload assertions.

- [x] Add failing tests for WebP animation outputs and initial preload selection.
- [x] Record the current first-login transfer baseline.

### Task 2: Build Optimized Runtime Images

**Files:**
- Create: `scripts/build_runtime_images.py`
- Create generated: `assets/runtime/character/idle-axes/{itemId}/frame-01.webp` through `frame-04.webp`
- Create generated: `assets/runtime/character/axes/{itemId}/frame-01.webp` through `frame-06.webp`
- Create generated: `assets/runtime/v2/...`
- Modify: `docs/ASSET_PIPELINE.md`

**Interfaces:**
- Consumes: `assets/images/character` and `assets/images/v2` source art.
- Produces: deterministic, transparent WebP files sized for browser display.

- [x] Convert character frames to `256x512` transparent WebP at quality 90.
- [x] Downscale oversized UI, icon, effect, and tree art according to their maximum rendered size.
- [x] Convert the login background to WebP without changing its crop or composition.
- [x] Validate every generated file and report source/runtime byte totals.

### Task 3: Load Only What the Current Screen Needs

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `assets/images/v2/manifest.json`
- Test: `tests/asset-preloader.test.js`
- Test: `tests/cultivator-scene.test.js`

**Interfaces:**
- Produces: `getInitialGameImageAssets(role, state)` and `preloadAxeAnimation(itemId)`.
- Consumes: current `Game.state.axeId`, tree level, and generated runtime paths.

- [x] Point animation, player UI, and login background references to runtime images.
- [x] Split login preloading into shared first-screen assets and current player state assets.
- [x] Preload newly equipped weapon frames before rerendering cultivation.
- [x] Run focused and full tests plus image validation and `git diff --check`.
