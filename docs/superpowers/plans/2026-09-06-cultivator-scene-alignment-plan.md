# Cultivator Scene Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make idle-to-chop transitions spatially stable and place the axe strike close to the tree without changing the authored animation.

**Architecture:** Add a deterministic Pillow post-process that aligns each weapon's complete chop sequence to its matching idle reference with one shared transform. Keep animation timing and frame order untouched, remove separator residue, then refine the responsive scene spacing in CSS. Regression tests verify the processing contract and layout bounds.

**Tech Stack:** Python Pillow, PNG sprites, CSS, browser JavaScript, Node test runner.

## Global Constraints

- Preserve all 4 idle frames and all 6 chop frames for each of the 9 axes.
- Apply one scale and translation per weapon to the full chop sequence; never normalize individual action frames independently.
- Keep the character's feet on a stable visual baseline when switching between idle and chop.
- Do not compress or convert the full image library in this task.
- Do not publish this tuning pass unless the user explicitly asks.

---

### Task 1: Lock the Scene Alignment Contract

**Files:**
- Modify: `tests/cultivator-scene.test.js`
- Create: `tests/character-frame-alignment.test.py`

**Interfaces:**
- Consumes: generated character PNG frames and cultivation-scene CSS.
- Produces: regression limits for idle/chop reference alignment and responsive scene spacing.

- [x] **Step 1: Add a failing image-alignment test**

  Measure alpha bounds for each weapon's idle and chop reference frames and require their foot baseline and visual center to remain within the chosen tolerances.

- [x] **Step 2: Add a failing layout assertion**

  Require the desktop scene gap to be substantially smaller than the current `64px` and keep a compact mobile gap.

- [x] **Step 3: Run the focused tests and confirm failure**

  Run `F:\py\python.exe tests\character-frame-alignment.test.py` and `node --test tests\cultivator-scene.test.js`.

### Task 2: Align the Complete Chop Sequences

**Files:**
- Create: `scripts/align_character_frames.py`
- Modify generated assets: `assets/images/character/axes/{itemId}/frame-01.png` through `frame-06.png`

**Interfaces:**
- Consumes: `idle-axes/{itemId}/frame-01.png` and the six existing chop frames.
- Produces: the same six `362x724` RGBA files transformed by one per-weapon scale and offset.

- [x] **Step 1: Implement alpha-bound measurement and a shared transform**

  Remove residual magenta separators, derive the offset from each weapon's idle/chop reference pair, align the foot baseline, and bring the horizontal visual center toward the idle reference. Use one uniform group scale only when the authored content cannot otherwise fit safely.

- [x] **Step 2: Protect canvas bounds**

  Clamp the group translation so no non-transparent pixels from any of the six chop frames are clipped.

- [x] **Step 3: Process and validate all 54 frames**

  Require `362x724 RGBA`, non-empty alpha, no clipped alpha at canvas edges, and a passing reference-alignment test.

### Task 3: Refine Character-to-Tree Spacing

**Files:**
- Modify: `styles.css`
- Test: `tests/cultivator-scene.test.js`

**Interfaces:**
- Consumes: the existing `.cult-scene`, `.cult-char`, and `.cult-tree` structure.
- Produces: compact desktop and mobile spacing without changing inventory or scene dimensions.

- [x] **Step 1: Reduce the desktop and mobile scene gaps**

  Keep the existing character and tree sizes while moving their visual silhouettes closer together.

- [x] **Step 2: Run focused and full regression tests**

  Run the alignment test, scene test, all Node tests, JavaScript syntax checks, and `git diff --check`.

- [x] **Step 3: Review the generated comparison**

  Compare idle and chop reference silhouettes on one canvas and report the local result without publishing.
