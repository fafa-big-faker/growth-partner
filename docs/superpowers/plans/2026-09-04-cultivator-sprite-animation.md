# Cultivator Sprite Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cultivation scene's static character with the supplied idle and chop frame sequences, swap the character/tree positions, and enlarge artwork inside unchanged backpack slots.

**Architecture:** A deterministic Pillow script splits both source sheets into stable six-frame image sets. A small browser/Node-compatible animator owns frame timing and cancellation, while `app.js` only attaches the scene image and triggers one chop sequence per chop. CSS controls fixed scene geometry and enlarges only occupied backpack artwork.

**Tech Stack:** PNG/Pillow, native JavaScript, CSS, Node.js built-in test runner, GitHub Pages.

## Global Constraints

- Do not regenerate, repaint, mirror, or trim the supplied character art.
- Each output frame remains exactly `362x724` with its alpha channel intact.
- Idle loops at 200 ms per frame; chop plays once at 90 ms per frame and returns to idle.
- Character is on the left and tree on the right.
- Backpack slot dimensions, grid tracks, and item count badges do not change.
- Database behavior, game values, rewards, and Feishu configuration do not change.

---

### Task 1: Split and validate the character sheets

**Files:**
- Create: `scripts/split_character_sheets.py`
- Create: `assets/images/character/idle/frame-01.png` through `frame-06.png`
- Create: `assets/images/character/chop/frame-01.png` through `frame-06.png`

**Interfaces:**
- Consumes: `../修炼者待机序列帧.png` and `../修炼者砍树序列帧.png`.
- Produces: twelve RGBA PNG frames, each `362x724`.

- [x] **Step 1: Add the deterministic splitter**

Create a Pillow script that verifies `width % 6 === 0`, crops six equal horizontal regions without trimming, converts them to RGBA, and writes stable filenames under the two output directories.

- [x] **Step 2: Run the splitter**

Run the bundled Python executable against `scripts/split_character_sheets.py`.

Expected: twelve PNG files are created and the script reports `362x724` for every frame.

- [x] **Step 3: Verify dimensions and transparency**

Run the script in verification mode and assert every output is RGBA, `362x724`, and has at least one alpha value below 255.

- [x] **Step 4: Commit the asset pipeline and frames**

```bash
git add scripts/split_character_sheets.py assets/images/character
git commit -m "feat: add cultivator animation frames"
```

---

### Task 2: Add a reusable frame animator

**Files:**
- Create: `character-animator.js`
- Create: `tests/character-animator.test.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `createFrameAnimator({ idleFrames, chopFrames, idleFrameMs, chopFrameMs })`.
- Produces methods: `attach(element)`, `playChop() -> Promise<boolean>`, `stop()`.
- Produces browser global: `CharacterAnimator`.

- [x] **Step 1: Write failing animator tests**

Test that attaching renders the first idle frame, `playChop` visits all chop frames in order, resolves once, and resumes the idle sequence; test that reattaching cancels the old element's timers.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/character-animator.test.js`

Expected: FAIL because `character-animator.js` does not exist.

- [x] **Step 3: Implement the animator**

Use one owned timer and a monotonically increasing sequence token. `playChop()` cancels idle, advances six frames at `chopFrameMs`, resumes idle after the final frame, and resolves. `attach()` cancels the previous target before starting idle.

- [x] **Step 4: Load the animator before `app.js`**

Add `<script src="character-animator.js"></script>` after `operation-guard.js` and before `app.js`.

- [x] **Step 5: Run tests and commit**

Run: `node --test tests/character-animator.test.js`

Run: `node --check character-animator.js`

```bash
git add character-animator.js tests/character-animator.test.js index.html
git commit -m "feat: add cultivator frame animator"
```

---

### Task 3: Integrate the scene animation and icon scaling

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Create: `tests/cultivator-scene.test.js`

**Interfaces:**
- Consumes: `CharacterAnimator.createFrameAnimator` and the twelve generated frame paths.
- Produces: global `CultivatorAnimator` used by cultivation rendering and chop handlers.

- [ ] **Step 1: Write failing scene contract tests**

Assert that the character markup appears before the tree, uses `id="cultivator-sprite"`, the renderer attaches the animator, both chop paths call `CultivatorAnimator.playChop()`, and CSS enlarges normal item images without altering `.item-slot` sizing declarations.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/cultivator-scene.test.js`

Expected: FAIL because the scene still uses `character-paint.jpg` and has no frame animator calls.

- [ ] **Step 3: Integrate idle and single-chop animation**

Create idle/chop path arrays, instantiate the animator with `200` and `90` ms timings, render the character before the tree, attach it after `main.innerHTML`, and await the chop animation before the single-chop scene is re-rendered.

- [ ] **Step 4: Integrate ten-chop animation**

Start and await one chop sequence during every ten-chop iteration so actions never overlap. Preserve reward and tree-shake behavior.

- [ ] **Step 5: Stabilize scene geometry and enlarge backpack artwork**

Give the character wrapper fixed responsive width/height constraints, use `object-fit: contain`, and set normal occupied item imagery to approximately 70% of the slot area. Leave weapon, small, shop, and reward icon rules unchanged.

- [ ] **Step 6: Run the full automated suite**

Run: `node --test tests/*.test.js`

Run: `node --check app.js && node --check character-animator.js`

- [ ] **Step 7: Verify desktop and mobile visuals**

Start a local static server, capture desktop and mobile screenshots, confirm the character/tree baseline, verify icon/count separation, and use browser state checks to confirm idle and chop frame URLs change in the expected order without console errors.

- [ ] **Step 8: Commit and publish**

```bash
git add app.js styles.css tests/cultivator-scene.test.js docs/superpowers/plans/2026-09-04-cultivator-sprite-animation.md
git commit -m "feat: animate cultivator chopping"
git push origin main
```

Wait for GitHub Pages and verify the production site serves the new frame assets and scripts.
