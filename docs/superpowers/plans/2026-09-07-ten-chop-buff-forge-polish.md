# Ten Chop, BUFF Color, And Forge Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate ten-chop at the Middle Kalami realm, color multiplier target quality correctly, and keep the simplified forge reveal moving smoothly until its real result arrives.

**Architecture:** Player and game entry points share one realm unlock predicate. Weapon skill formatting selects a CSS quality class per value token. The forge controller tracks the result promise concurrently with a minimum acceleration sequence, then loops at maximum speed until resolution and completes progress without a static gap.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js built-in test runner, GitHub Pages.

## Global Constraints

- Keep the current ten-chop control visible and visually unchanged.
- Unlock at `realmLevel >= 2`; rejected attempts consume nothing and show `突破至中卡拉米后解锁`.
- Only reward-multiplier `value1` uses its target reward quality; all other values use `buffQuality`.
- Remove the forge heading logo while retaining its title and supporting copy.
- Never reveal a forged item before the database result resolves.
- Do not perform browser visual acceptance unless explicitly requested.

---

### Task 1: Ten-Chop Realm Gate

**Files:**
- Modify: `app.js`
- Modify: `tests/ten-chop-timeline.test.js`
- Modify: `tests/gameplay-rules.test.js`

**Interfaces:**
- Produces: `Game.isTenChopUnlocked(): boolean`
- Consumes: `Game.state.realmLevel`

- [ ] **Step 1: Add failing contract tests**

Assert that the unlock threshold is `2`, `toggleTenChop(true)` rejects before the chopping-count check with the exact toast, restores the checkbox to false, and both `PlayerView.doChopTen()` and `Game.chopTen()` guard before any persistence or animation.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/ten-chop-timeline.test.js tests/gameplay-rules.test.js`

Expected: FAIL because no realm gate exists.

- [ ] **Step 3: Implement the shared predicate and entry guards**

```js
const TEN_CHOP_UNLOCK_REALM_ID = 2;

isTenChopUnlocked() {
  return Number(this.state?.realmLevel) >= TEN_CHOP_UNLOCK_REALM_ID;
}
```

Use it when enabling the toggle, at the start of `PlayerView.doChopTen()`, and at the start of `Game.chopTen()`. UI rejection resets `_tenChopMode` and the checkbox without rerendering the page.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/ten-chop-timeline.test.js tests/gameplay-rules.test.js`

Expected: PASS.

### Task 2: Reward Quality Token Color

**Files:**
- Modify: `weapon-affixes.js`
- Modify: `tests/weapon-affixes.test.js`

**Interfaces:**
- Consumes: frozen `skillRoll.values.value1` and `skillRoll.buffQuality`.
- Produces: one `buff-quality-N` class per formatted dynamic value.

- [ ] **Step 1: Change the formatter test to the desired color split**

For a quality-5 BUFF targeting quality 1, assert:

```html
<span class="buff-value buff-quality-1">凡品</span>
<span class="buff-value buff-quality-5">3.15%</span>
<span class="buff-value buff-quality-5">2</span>
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/weapon-affixes.test.js`

Expected: FAIL because all values currently use `buffQuality`.

- [ ] **Step 3: Select the quality class per token**

Inside `formatSkill`, calculate `valueQuality` as the numeric `value1` only when the key is `value1` and `effectType` is `reward_multiplier`; otherwise use the normalized BUFF quality. Keep value formatting and calculations unchanged.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/weapon-affixes.test.js`

Expected: PASS.

### Task 3: Continuous Forge Reveal And Compact Heading

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `tests/forge-reveal.test.js`

**Interfaces:**
- Produces: `ForgeReveal.trackResult(resultPromise)` or equivalent local tracked state with `settled`, `value`, and `error`.
- Produces: a maximum-speed candidate loop that ends only when tracked result state settles.

- [ ] **Step 1: Add failing slow-result and markup tests**

Assert that the controller observes the result promise before the acceleration loop, continues calling `showCandidate` while the result is unsettled, advances progress toward `98`, awaits the tracked result, and then transitions to `100`. Assert the forge modal markup does not contain `forge-modal-icon` and retains its title/copy.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/forge-reveal.test.js`

Expected: FAIL on the missing continuous loop and remaining heading logo.

- [ ] **Step 3: Implement concurrent result tracking**

Resolve or reject the supplied promise into tracked state immediately. Run the existing acceleration delays as the minimum reveal duration. If unresolved afterward, continue cycling candidate images and names using the last delay, while a non-resetting CSS transition advances the bar toward `98%`.

- [ ] **Step 4: Complete the reveal without a static gap**

When the result settles, stop after the current short candidate interval, propagate errors through the existing guarded action, reveal only the returned item, and set a short linear/ease-out transition from the current computed width to `100%`. Reduced-motion keeps its short finite sequence and simply awaits the result.

- [ ] **Step 5: Remove the logo and tighten spacing**

Delete the `renderFeatureIcon('icon-forge', ..., 'forge-modal-icon')` markup and its unused size rule. Reduce heading/stage separation without changing the modal width, result card, probability details, material count, or primary action.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/forge-reveal.test.js tests/resource-operation-consistency.test.js`

Expected: PASS.

### Task 4: Verification And Release

**Files:**
- Modify only scoped files above if verification finds a regression.

**Interfaces:**
- Produces: tested `main` commit deployed by GitHub Pages.

- [ ] **Step 1: Run full verification**

```bash
node --test tests/*.test.js
node --check app.js
node --check weapon-affixes.js
python -m compileall -q sync-config.py scripts tests
python tests/character-frame-alignment.test.py
python tests/runtime-image-assets.test.py
git diff --check
```

- [ ] **Step 2: Inspect the diff and commit**

Confirm only the design, plan, `app.js`, `weapon-affixes.js`, `styles.css`, and focused tests changed. Keep `supabase/` untracked.

```bash
git add app.js weapon-affixes.js styles.css tests/ten-chop-timeline.test.js tests/gameplay-rules.test.js tests/weapon-affixes.test.js tests/forge-reveal.test.js docs/superpowers/plans/2026-09-07-ten-chop-buff-forge-polish.md
git commit -m "feat-polish-ten-chop-and-forge-flow"
```

- [ ] **Step 3: Push and verify deployment**

Push `main`, then verify the GitHub Pages workflow for the exact pushed SHA reaches `completed/success`. Do not run browser visual acceptance.
