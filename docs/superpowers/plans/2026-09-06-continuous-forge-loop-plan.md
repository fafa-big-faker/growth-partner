# Continuous Forge Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the forge result into a repeatable draw loop with a fixed primary action and a secondary in-result equip action.

**Architecture:** `PlayerView.showForge()` owns the modal state transitions and delegates persistence to the existing `Game.forge()` and `PlayerView._equipFromForge()` methods. The DOM is updated in place after each operation; CSS controls the visual hierarchy without introducing another overlay.

**Tech Stack:** Browser JavaScript, CSS, Node test runner.

## Global Constraints

- Do not change forge probabilities, costs, or persistence.
- Keep the existing `OperationGuard` key `forge`.
- Keep one modal overlay throughout the forge loop.
- Do not perform visual acceptance unless explicitly requested.

---

### Task 1: Lock the Continuous Loop Contract

**Files:**
- Modify: `tests/forge-reveal.test.js`

**Interfaces:**
- Consumes: source for `PlayerView.showForge()` and `PlayerView._equipFromForge()`.
- Produces: regression assertions for the fixed primary action, compact cost display, and in-result equip action.

- [x] **Step 1: Add failing assertions**

Assert that the modal contains `forge-material-cost`, uses `锻造` initially, changes to `再锻造一次`, and does not render a result `返回` action.

- [x] **Step 2: Run the focused test**

Run `node --test tests/forge-reveal.test.js` and confirm the new assertions fail.

### Task 2: Implement the Repeatable Forge State

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/forge-reveal.test.js`

**Interfaces:**
- Consumes: `ForgeReveal.run(elements, resultPromise)`, `Game.forge()`, and `Game.inventory`.
- Produces: an in-place reset path that can start another forge without recreating the modal.

- [x] **Step 1: Move the material cost above the primary action**

Render the configured cost item icon and `current/cost` in `forge-material-cost`; keep the button label as `锻造`.

- [x] **Step 2: Reuse the primary action after success**

Reset the reveal stage in place on every click, update the button to `再锻造一次` after success, and disable it when materials are insufficient.

- [x] **Step 3: Move equip into the result detail**

Render `立即装备` beside the result information. After a successful equip, keep the modal open, update it to `已装备`, and preserve the repeat forge button.

- [x] **Step 4: Style the hierarchy**

Keep the compact cost centered above the fixed primary button and make the equip control visually secondary.

- [x] **Step 5: Verify**

Run `node --test`, `node --check app.js`, and `git diff --check` before publishing.
