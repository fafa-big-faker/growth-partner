# Cultivate Background and Forge Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the cultivation artwork without tiling and add a data-safe, accelerating forge reveal animation.

**Architecture:** CSS owns responsive background cropping. A small `ForgeReveal` controller owns only presentation timing and DOM updates, while `Game.forge()` remains the sole source of the actual reward and inventory mutations. `PlayerView.showForge()` starts both concurrently and reveals success only after both the minimum animation and the business operation complete.

**Tech Stack:** Browser JavaScript, CSS animations, Node test runner.

## Global Constraints

- Do not create or generate new artwork.
- Do not change forge probabilities, material costs, or reward persistence.
- Never show success before `Game.forge()` returns a real result.
- Keep the existing `OperationGuard` key `forge`.
- Honor `prefers-reduced-motion`.
- Do not perform visual acceptance unless explicitly requested.

---

### Task 1: Lock the Background and Timing Contracts

**Files:**
- Create: `tests/forge-reveal.test.js`
- Modify: `tests/visual-assets.test.js`

**Interfaces:**
- Consumes: `styles.css`, `app.js`.
- Produces: assertions for non-repeating background coverage and the `ForgeReveal` timing contract.

- [ ] **Step 1: Add failing background assertions**

Assert that the cultivation dashboard uses the runtime background instead of `--player-scene: none`, and that `.cult-scene` declares `background-size: cover`, `background-repeat: no-repeat`, and a stable position.

- [ ] **Step 2: Add failing reveal-controller assertions**

Assert that `ForgeReveal` exposes decreasing delays, a `94%` waiting state, a `100%` result state, and reduced-motion handling.

- [ ] **Step 3: Run the focused tests and confirm failure**

Run `node --test tests/visual-assets.test.js tests/forge-reveal.test.js`. The new assertions must fail before implementation.

### Task 2: Repair Cultivation Background Rendering

**Files:**
- Modify: `styles.css`
- Test: `tests/visual-assets.test.js`

**Interfaces:**
- Consumes: `assets/runtime/v2/backgrounds/cultivate.webp`.
- Produces: one full-page cover background and one non-repeating stage crop.

- [ ] **Step 1: Restore the page artwork**

Replace the cultivate-specific `--player-scene: none` override with the runtime image and make the common dashboard background explicitly `no-repeat`.

- [ ] **Step 2: Bound the stage crop**

Set the stage to `background-position: center 42%`, `background-size: cover`, and `background-repeat: no-repeat` while preserving its current overlay and dimensions.

- [ ] **Step 3: Run the background test**

Run `node --test tests/visual-assets.test.js` and require all assertions to pass.

### Task 3: Add the Forge Reveal Controller

**Files:**
- Modify: `app.js`
- Test: `tests/forge-reveal.test.js`

**Interfaces:**
- Produces: `ForgeReveal.getCandidateItems()`, `ForgeReveal.run(elements, resultPromise)`, and `ForgeReveal.reveal(elements, result)`.
- Consumes: `FORGE_POOL`, `ITEMS`, `QUALITY`, `renderItemIcon()`, and a `Promise<ForgeResult|null>`.

- [ ] **Step 1: Implement candidate selection and timing**

Flatten configured forge-pool item IDs, remove duplicates, and cycle them with delays `[320, 300, 270, 240, 215, 190, 165, 145, 125, 110, 95, 82, 76]`.

- [ ] **Step 2: Implement waiting and reveal states**

Progress from `0` through `88`, wait at `94`, then reveal only the resolved `result.itemId` at `100`; return `null` without success UI on failure.

- [ ] **Step 3: Handle reduced motion**

When `prefers-reduced-motion: reduce` matches, show three candidate steps without shake and retain the same real-result gate.

- [ ] **Step 4: Run the controller tests**

Run `node --test tests/forge-reveal.test.js` and require all assertions to pass.

### Task 4: Integrate the Forge Modal and Styling

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/forge-reveal.test.js`
- Test: `tests/resource-operation-consistency.test.js`

**Interfaces:**
- Consumes: `ForgeReveal.run()` and existing `Game.forge()`.
- Produces: an in-place forge animation followed by the existing result actions.

- [ ] **Step 1: Add stable forge-stage markup**

Render the animation icon, colored name, status text, accessible progress bar, flash layer, and result-action container in the existing forge modal.

- [ ] **Step 2: Run animation and business logic concurrently**

Inside `UI.runLockedAction('forge', ...)`, start `Game.forge()` and pass its promise to `ForgeReveal.run()`. Keep the modal open and locked until the result is known.

- [ ] **Step 3: Render final actions in place**

After a real result, show description, skill, realm restriction, “继续锻造”, and conditional “立即装备” actions without creating another modal overlay.

- [ ] **Step 4: Add restrained motion styles**

Add scoped shake, one-shot flash, reveal scale, quality aura, and progress styles plus reduced-motion overrides.

- [ ] **Step 5: Run focused and full verification**

Run `node --test`, `node --check app.js`, and `git diff --check`. Require all tests and syntax checks to pass before publishing.

