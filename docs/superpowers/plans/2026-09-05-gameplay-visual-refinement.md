# Gameplay And Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix periodic rewards and monthly sign-in while delivering a coherent celadon ink-wash player interface with visible equipment and readable inventory quantities.

**Architecture:** Pure reward rules live in a small reusable module, Supabase owns atomic daily sign-in, and the existing player view consumes structured chop results. Character animation publishes frame state to a separate equipment layer. Existing responsive HTML remains, while the V2 style layer is consolidated and new atlases provide only the visual elements CSS cannot provide well.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js test runner, Supabase PostgreSQL RPC, generated raster atlases, GitHub Pages.

## Global Constraints

- Work on the existing `main` checkout as explicitly authorized by the user.
- Preserve the existing item IDs and Feishu-derived configuration.
- Generate same-type visual assets together in one atlas wherever practical.
- Use the supplied `美术风格参考` images as style references, not as assets to redistribute.
- Do not expose API keys or place secrets in committed files.

---

### Task 1: Deterministic Chop Bonus Rules

**Files:**
- Create: `gameplay-rules.js`
- Modify: `index.html`
- Modify: `app.js`
- Test: `tests/gameplay-rules.test.js`

**Interfaces:**
- Produces: `GameplayRules.isBonusChop(totalChops, interval)` and `GameplayRules.rollPackItem(pack, random)`.
- Produces: `Game.chop()` result with `extraDrop` when the persisted count reaches a ten-chop boundary.

- [ ] **Step 1:** Add tests asserting boundaries `9=false`, `10=true`, `20=true` and deterministic selection from pack `1003`.
- [ ] **Step 2:** Run `node --test tests/gameplay-rules.test.js` and confirm it fails before the module exists.
- [ ] **Step 3:** Implement the UMD rules module, load it before `app.js`, and add `_rollPackDrop(packId)` using `GAME_CONFIG.packTable`.
- [ ] **Step 4:** Move bonus creation into `Game.chop()`, update single/ten presentation to include `extraDrop`, and remove the separate UI-only pool roll.
- [ ] **Step 5:** Run `node --test tests/gameplay-rules.test.js tests/resource-operation-consistency.test.js tests/operation-guard.test.js`.

### Task 2: Atomic Monthly Sign-In

**Files:**
- Create: `upgrade_v6.sql`
- Modify: `app.js`
- Test: `tests/signin-consistency.test.js`

**Interfaces:**
- Produces: `daily_checkins(user_role, checkin_date)` with a unique daily key.
- Produces: `daily_check_in()` RPC returning `{ok, code, date, month, days, choppingCount, claims}`.
- Consumes: existing `player_state` sign-in and chopping fields.

- [ ] **Step 1:** Add source tests requiring the dated table, unique constraint, row lock, China-local date, and RPC call from `DB.dailyCheckIn()`.
- [ ] **Step 2:** Run the focused test and confirm failure.
- [ ] **Step 3:** Write an idempotent migration that backfills `last_daily_date`, inserts exactly one row per day, locks `player_state`, updates monthly counters, and returns the canonical state.
- [ ] **Step 4:** Replace client-side sign-in arithmetic with the RPC response and refresh the monthly timeline from canonical state.
- [ ] **Step 5:** Run focused and full tests, then execute the migration in Supabase and verify September records with a read-only query.

### Task 3: Character Equipment Layer And Calm Idle

**Files:**
- Modify: `character-animator.js`
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/character-animator.test.js`
- Test: `tests/cultivator-scene.test.js`

**Interfaces:**
- Produces: animator option `onFrame({src, state, index})` and `idlePauseMs`.
- Produces: `CultivatorWeaponLayer.attach(element, axeId)` and frame-specific transforms.

- [ ] **Step 1:** Add failing tests for the frame callback, idle pause, and a rendered `cultivator-weapon` image using the equipped item ID.
- [ ] **Step 2:** Implement callback-aware animation and a pause after each idle sequence.
- [ ] **Step 3:** Render the weapon as a sibling of the character frame and tune six chop anchors plus the idle resting pose.
- [ ] **Step 4:** Verify all nine axe IDs resolve to transparent images and switching equipment changes the scene layer.
- [ ] **Step 5:** Run the focused animator and scene tests.

### Task 4: Regenerate Minimal Art Atlases

**Files:**
- Create: `output/imagegen/refinement/background-atlas.png`
- Create: `output/imagegen/refinement/idle-atlas.png`
- Modify: `assets/images/v2/backgrounds/tasks.webp`
- Modify: `assets/images/v2/backgrounds/reward.webp`
- Modify: `assets/images/character/idle/frame-01.png` through `frame-06.png`
- Modify: `scripts/process_visual_atlases.py`
- Modify: `scripts/split_character_sheets.py`

**Interfaces:**
- Consumes: supplied style references and current cultivator frame 1.
- Produces: two consistent 16:9 celadon environments and six aligned transparent idle frames.

- [ ] **Step 1:** Generate one two-panel background atlas with no text, UI, characters, treasure piles, or dominant gold.
- [ ] **Step 2:** Inspect the atlas and retry only if panel boundaries, style, or focal-space requirements fail.
- [ ] **Step 3:** Generate one six-frame idle atlas using the current frame 1 as the locked character reference.
- [ ] **Step 4:** Crop outputs deterministically, preserve alpha for character frames, and verify dimensions.
- [ ] **Step 5:** Run `node --test tests/visual-assets.test.js tests/character-animator.test.js`.

### Task 5: Inventory And Player UI Refinement

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `index.html`
- Test: `tests/visual-assets.test.js`
- Test: `tests/player-ui-art.test.js`

**Interfaces:**
- Consumes: existing V2 functional icons and UI ornaments.
- Produces: consistent image-based functional icons, `xN` quantity badges, localized surfaces, and a wider desktop shell.

- [ ] **Step 1:** Add tests for the forging-stone image, image-based lock/shop/wallet/tree-info/close controls, quantity badge markup, and removal of obsolete `scene-bg.jpg` usage.
- [ ] **Step 2:** Replace player-facing emoji controls where an asset exists and wire unused V2 resources into headers, modal chrome, toggles, and dividers.
- [ ] **Step 3:** Restyle quantity badges as stable dark-jade pills, enlarge normal item artwork, and remove `image-rendering: pixelated` from polished assets.
- [ ] **Step 4:** Remove the global white wash, localize readable surfaces, replace purple activity styling with celadon/ink, reduce gold, and expand desktop layout responsively.
- [ ] **Step 5:** Run the full test suite.

### Task 6: Browser QA, Database Verification, And Release

**Files:**
- Modify: `README.md` or `HANDOVER.md` only if operational behavior changed.

**Interfaces:**
- Consumes: completed gameplay, database, animation, and visual tasks.
- Produces: deployed GitHub Pages release and verified Supabase schema.

- [ ] **Step 1:** Start a local server and capture desktop and mobile screenshots for login, cultivation, tasks, reward/shop, backpack, weapon equipment, and modal states.
- [ ] **Step 2:** Inspect for blank assets, overlap, unreadable text, incorrect cropping, visual inconsistency, and animation/weapon misalignment; fix and repeat screenshots.
- [ ] **Step 3:** Run all Node tests and syntax checks.
- [ ] **Step 4:** Commit the completed release, push `main`, and wait for GitHub Pages deployment.
- [ ] **Step 5:** Open the production URL, verify the deployed commit behavior, and report the final assets, SQL migration, tests, and URLs.
