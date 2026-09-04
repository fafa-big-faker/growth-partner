# Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary player-facing artwork with a cohesive pixel-xianxia visual system while keeping paid image generation to four atlases and fixing ten-chop animation continuity.

**Architecture:** Generate four regular atlases with the bundled `gpt-image-2` CLI, then use one deterministic Pillow script to crop and post-process them into project assets. Keep layout, text, and animation behavior in HTML/CSS/JavaScript; generated files provide backgrounds, tree art, UI surfaces, icons, and small effect sprites only.

**Tech Stack:** Static HTML/CSS/JavaScript, Node test runner, Python 3 + Pillow, bundled OpenAI image generation CLI, GitHub Pages.

## Global Constraints

- Use at most four paid `gpt-image-2` calls.
- Use existing refined item and axe icons as the style anchor; do not regenerate them.
- Do not change gameplay values, Supabase schema, Feishu configuration, backpack slot dimensions, or page information architecture.
- Do not bake Chinese text into generated images.
- Test at 375x812 and 1440x900.
- Ten-chop must hold the final chop frame during network delay and return to idle only after the sequence.

---

### Task 1: Deterministic atlas pipeline

**Files:**
- Create: `scripts/process_visual_atlases.py`
- Create: `tests/visual-assets.test.js`
- Create: `tmp/imagegen/visual-overhaul-prompts.jsonl`
- Create: `output/imagegen/visual-overhaul/`

**Interfaces:**
- Consumes: four source atlases named `scene-atlas.png`, `tree-atlas.png`, `ui-atlas.png`, and `feature-effects-atlas.png`.
- Produces: web-ready files under `assets/images/v2/` and a JSON manifest at `assets/images/v2/manifest.json`.

- [x] **Step 1: Write the failing asset contract test**

```js
test('visual manifest exposes backgrounds, trees, UI, icons, and effects', () => {
  const manifest = JSON.parse(fs.readFileSync('assets/images/v2/manifest.json', 'utf8'));
  assert.equal(Object.keys(manifest.backgrounds).length, 4);
  assert.equal(Object.keys(manifest.trees).length, 3);
  assert.ok(Object.keys(manifest.ui).length >= 8);
  assert.ok(Object.keys(manifest.icons).length >= 8);
  assert.ok(Object.keys(manifest.effects).length >= 4);
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `node --test tests/visual-assets.test.js`
Expected: FAIL because `assets/images/v2/manifest.json` does not exist.

- [x] **Step 3: Implement the cropper**

Implement `crop_grid(image, rows, columns, gutter, names)` and `remove_chroma(image, key_color, tolerance)` with Pillow. Preserve source PNGs, save backgrounds as quality-88 WebP, and save keyed sprites as RGBA PNG.

- [x] **Step 4: Write the four production prompts**

Use strict equal-cell grids, visible gutters, no text, no watermark, no overlap, consistent scale, and the existing item atlas as the style reference. Request medium quality only; do not create separate draft jobs.

- [x] **Step 5: Validate the four image jobs and cost boundary**

Run the bundled CLI with `generate-batch --dry-run` or one `generate --dry-run` per prompt.
Expected: exactly four jobs, all using `gpt-image-2`, with sizes 2048x1152, 1536x1024, 1024x1024, and 1024x1024.

- [x] **Step 6: Commit the deterministic pipeline**

```bash
git add scripts/process_visual_atlases.py tests/visual-assets.test.js
git commit -m "test-add-visual-asset-pipeline"
```

### Task 2: Generate and process the four atlases

**Files:**
- Create: `output/imagegen/visual-overhaul/*.png`
- Create: `assets/images/v2/backgrounds/*`
- Create: `assets/images/v2/trees/*`
- Create: `assets/images/v2/ui/*`
- Create: `assets/images/v2/icons/*`
- Create: `assets/images/v2/effects/*`
- Create: `assets/images/v2/manifest.json`

**Interfaces:**
- Consumes: prompts and crop geometry from Task 1.
- Produces: stable asset URLs consumed by CSS and JavaScript.

- [x] **Step 1: Generate four atlases through the approved ChatGPT Plus fallback**

The API credential and proxy were validated first, but the API account had no image credit. With the user's approval, the same four-atlas budget was completed in the logged-in ChatGPT Plus browser session; each atlas was exported once into the project output directory.

- [x] **Step 2: Inspect all four atlases**

Verify cell separation, style consistency, subject count, lack of text, and absence of cross-cell overlap. Do not automatically regenerate a merely imperfect cell.

- [x] **Step 3: Crop and post-process**

Run: `python scripts/process_visual_atlases.py --input output/imagegen/visual-overhaul --output assets/images/v2`
Expected: manifest and all named assets are created with no source overwrite.

- [x] **Step 4: Inspect representative crops and alpha edges**

Check all three trees, one inventory slot, four navigation icons, one leaf, and one hit spark at original resolution.

- [x] **Step 5: Run the asset contract test**

Run: `node --test tests/visual-assets.test.js`
Expected: PASS.

- [x] **Step 6: Commit generated assets**

```bash
git add assets/images/v2 scripts/process_visual_atlases.py tests/visual-assets.test.js
git commit -m "feat-add-v2-visual-assets"
```

### Task 3: Continuous chop animation

**Files:**
- Modify: `character-animator.js`
- Modify: `app.js`
- Modify: `tests/character-animator.test.js`
- Modify: `tests/cultivator-scene.test.js`

**Interfaces:**
- Produces: `playChop({ resumeIdle?: boolean }): Promise<boolean>` and `resumeIdle(): boolean`.

- [x] **Step 1: Add a failing hold-frame test**

```js
const result = await animator.playChop({ resumeIdle: false });
assert.equal(result, true);
assert.equal(image.dataset.animationState, 'chop-hold');
assert.equal(image.src, chopFrames.at(-1));
animator.resumeIdle();
assert.equal(image.dataset.animationState, 'idle');
```

- [x] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/character-animator.test.js tests/cultivator-scene.test.js`
Expected: FAIL because hold mode and `resumeIdle()` do not exist.

- [x] **Step 3: Implement hold mode**

When `resumeIdle` is false, retain the last chop frame with state `chop-hold`; expose `resumeIdle()` to restart the idle loop. In ten-chop, use hold mode for every chop and call `resumeIdle()` after the loop. Single chop keeps default behavior.

- [x] **Step 4: Run the focused tests**

Run: `node --test tests/character-animator.test.js tests/cultivator-scene.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add character-animator.js app.js tests/character-animator.test.js tests/cultivator-scene.test.js
git commit -m "fix-keep-ten-chop-animation-continuous"
```

### Task 4: Tree feedback effects

**Files:**
- Create: `cultivation-effects.js`
- Create: `tests/cultivation-effects.test.js`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- Produces: `CultivationEffects.playHit({ scene, tree, intensity }): void` and `CultivationEffects.clear(): void`.

- [x] **Step 1: Write a failing module test**

Assert that `playHit` creates bounded leaf and spark particles, applies deterministic class names, and scheduled cleanup removes them.

- [x] **Step 2: Verify failure**

Run: `node --test tests/cultivation-effects.test.js`
Expected: FAIL because the module is missing.

- [x] **Step 3: Implement the effect controller**

Create 5 leaves and 2 sparks for a normal chop, with randomized CSS custom properties for direction, rotation, scale, and delay. Ten-chop uses the same bounded count per hit so DOM growth remains controlled.

- [x] **Step 4: Wire effects into both chop paths**

Load `cultivation-effects.js` before `app.js`; call `playHit` at the impact frame for single and ten chop. Keep tree shake and reward drops.

- [x] **Step 5: Run tests and commit**

```bash
node --test tests/cultivation-effects.test.js tests/cultivator-scene.test.js
git add cultivation-effects.js tests/cultivation-effects.test.js index.html app.js styles.css
git commit -m "feat-add-cultivation-hit-effects"
```

### Task 5: Apply the visual system

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `tests/visual-assets.test.js`

**Interfaces:**
- Consumes: stable URLs from `assets/images/v2/manifest.json` mirrored as constants in `app.js` and CSS custom properties in `styles.css`.

- [x] **Step 1: Extend tests with page mappings**

Assert that player navigation uses image icons, the three tree tiers use v2 transparent assets, each player tab exposes its background class, and inventory slot dimensions remain unchanged.

- [x] **Step 2: Verify the new tests fail**

Run: `node --test tests/visual-assets.test.js`
Expected: FAIL on missing v2 mappings.

- [x] **Step 3: Replace tree and main functional artwork**

Map tree levels 1-5, 6-12, and 13+ to the three v2 tree PNGs. Replace player navigation and topbar emoji with v2 icon images while keeping accessible labels.

- [x] **Step 4: Apply backgrounds and UI surfaces**

Use full-width background layers with overlays for legibility. Apply generated slot frames and ornaments without changing grid columns, gaps, or `.item-slot { aspect-ratio: 1; }`.

- [x] **Step 5: Make responsive adjustments**

Keep artwork within stable containers, preserve bottom navigation safe-area padding, and prevent any horizontal scroll at 375px.

- [x] **Step 6: Run tests and commit**

```bash
node --test tests/visual-assets.test.js tests/coin-icon-rendering.test.js tests/cultivator-scene.test.js
git add app.js styles.css index.html tests/visual-assets.test.js
git commit -m "feat-apply-v2-player-visual-system"
```

### Task 6: Full verification and release

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-visual-overhaul.md`

**Interfaces:**
- Consumes: completed visual system.
- Produces: verified GitHub Pages release.

- [x] **Step 1: Run the complete regression suite**

```bash
node --test tests/*.test.js
node --check app.js
node --check character-animator.js
node --check cultivation-effects.js
git diff --check
```

Expected: all tests pass and all syntax checks exit successfully.

- [x] **Step 2: Perform browser QA at 1440x900**

Verify all four player tabs, idle animation, one chop, ten-chop continuity, backgrounds, trees, slot frames, navigation icons, leaf effects, modal layering, and console errors.

- [x] **Step 3: Perform browser QA at 375x812**

Verify no horizontal overflow, clipped text, overlapping controls, undersized tap targets, hidden quantity badges, or cropped tree/character art.

- [x] **Step 4: Mark every completed checkbox in this plan**

Update each executed step from `[ ]` to `[x]`; leave no completed work unmarked.

- [x] **Step 5: Commit verification state**

```bash
git add docs/superpowers/plans/2026-09-05-visual-overhaul.md
git commit -m "docs-complete-visual-overhaul-plan"
```

- [ ] **Step 6: Push and verify production**

Run: `git push origin main`
Verify the GitHub Pages deployment serves the new scripts and representative v2 assets with HTTP 200, then inspect the production page at desktop and mobile sizes.
