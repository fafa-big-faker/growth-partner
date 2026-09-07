# Tree Layer And Forge Timeline Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix tree stacking/alignment and make the forge reveal follow the approved latency-independent 60/40 timeline.

**Architecture:** The cultivation scene will use explicit shared scene coordinates and per-tree CSS anchors. `ForgeReveal` will expose a deterministic timeline-state calculation and drive progress/candidate updates from `requestAnimationFrame` while tracking the backend Promise separately.

**Tech Stack:** Native JavaScript, CSS, Node.js built-in test runner, GitHub Pages.

## Global Constraints

- Do not modify player data or Supabase schema.
- Do not edit generated `game-config.js`.
- Total forge presentation time is 2000-3000 ms; progress reaches 98 percent at 60 percent of that time.
- Network speed never changes the visual timeline.
- Do not commit the untracked `supabase/` directory.

---

### Task 1: Lock The Forge Presentation Timeline

**Files:**
- Modify: `tests/forge-reveal.test.js`
- Modify: `app.js`

**Interfaces:**
- Consumes: `ForgeReveal.showCandidate(elements, item, shaking, transitionMs)` and the existing result Promise.
- Produces: `ForgeReveal.getTimelineState(elapsedMs, durationMs)` returning `{ progress, candidateDelay, isHolding }`, plus `ForgeReveal.nextFrame()`.

- [x] **Step 1: Write failing timeline tests**

Assert that `getTimelineState(0, 3000)` is 0 percent/120 ms, `getTimelineState(1800, 3000)` is 98 percent/38 ms and holding, later states remain at 98 percent, and `run()` awaits animation frames while the request is tracked independently.

- [x] **Step 2: Run the focused test and verify failure**

```bat
node --test tests\forge-reveal.test.js
```

Expected: failure because `getTimelineState` and the explicit frame loop do not exist.

- [x] **Step 3: Implement the deterministic frame loop**

Replace CSS-transition progress control with direct fractional width updates per animation frame. Calculate the first 60 percent and final 40 percent from the sampled duration, change candidates only when their calculated interval has elapsed, and keep the loop alive after the deadline only while the result Promise is unsettled.

- [x] **Step 4: Run the focused test and verify success**

```bat
node --test tests\forge-reveal.test.js
```

Expected: all forge reveal tests pass.

### Task 2: Anchor And Layer The Cultivation Sprites

**Files:**
- Modify: `tests/cultivator-scene.test.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `.cult-scene`, `.cult-char`, `.cult-tree`, and `.tree-appearance-{sprout,spirit,divine}`.
- Produces: shared ground positioning, character wrapper `z-index: 3`, tree wrapper `z-index: 1`, effects `z-index: 4`, and per-tree `--tree-x`/`--tree-y` anchors.

- [x] **Step 1: Write failing scene-contract tests**

Require absolute positioning for the character and tree wrappers, verify the character wrapper itself has the higher layer, and require distinct explicit anchors for sprout, spirit, and divine.

- [x] **Step 2: Run the focused test and verify failure**

```bat
node --test tests\cultivator-scene.test.js
```

Expected: failure because the scene still relies on flex spacing and the character wrapper remains on layer 1.

- [x] **Step 3: Implement shared scene coordinates**

Position the character and tree from the scene center and bottom baseline. Keep responsive dimensions, define appearance-specific tree anchor variables, and remove flex gap/negative-margin positioning from the active rules.

- [x] **Step 4: Run the focused test and verify success**

```bat
node --test tests\cultivator-scene.test.js
```

Expected: all cultivation scene tests pass.

### Task 3: Verify And Release

**Files:**
- Modify: `docs/superpowers/plans/2026-09-07-tree-layer-forge-timeline-correction.md`

**Interfaces:**
- Consumes: completed changes from Tasks 1 and 2.
- Produces: a tested commit on `origin/main` and a verified GitHub Pages build.

- [x] **Step 1: Run full automated verification**

```bat
node --test tests\*.test.js
node --check app.js
node --check game-config.js
python -m unittest tests\runtime-image-assets.test.py tests\character-frame-alignment.test.py
git diff --check
```

- [x] **Step 2: Inspect scope and secrets**

```bat
git status --short
git diff -- app.js styles.css tests\forge-reveal.test.js tests\cultivator-scene.test.js docs\superpowers
```

Confirm `supabase/` remains untracked and unstaged and no credentials appear in the diff.

- [ ] **Step 3: Commit and publish**

```bat
git add app.js styles.css tests\forge-reveal.test.js tests\cultivator-scene.test.js docs\superpowers\specs\2026-09-07-tree-layer-forge-timeline-correction-design.md docs\superpowers\plans\2026-09-07-tree-layer-forge-timeline-correction.md
git commit -m "fix-tree-layer-and-forge-timeline"
git push origin main
```

- [ ] **Step 4: Verify the published UI**

Open the new build query on GitHub Pages, log into the test player, capture desktop and mobile cultivation scene screenshots, and observe one forge run to confirm the bar reaches 98 percent over 60 percent of the sampled duration and candidates continue until reveal.
