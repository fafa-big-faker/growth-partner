# Compact Rewards and Equipped Label Implementation Plan

> **For agentic workers:** Use executing-plans to implement inline on `feat/compact-rewards-equipment-label`. No delegation needed.

**Goal:** Reduce mobile single-reward scale and make the equipped weapon immediately identifiable.

**Architecture:** Scope CSS to the existing single-result dialog and mobile media query. Keep the existing UUID equipment renderer, changing only badge content and visibility of the novelty marker.

**Tech Stack:** Browser JavaScript, CSS, Node tests, local Playwright fixtures.

## Global Constraints

- No database/account/config changes, new artwork, screenshots or asset recompression.
- Maximum single modal width 280px, art 78px, name 15px below 720px; button minimum height 44px.
- Desktop single and all ten-result layouts unchanged.
- Equipped instance gets text `已装备`; preserve quality, rating, lock and underlying novelty state.
- Preserve unrelated untracked `supabase/`.

### Task 1: Equipped instance identity

**Files:** `app.js`, `mobile-cultivation.css`, `tests/v7-inventory-integration.test.js`, `tests/weapon-rating.browser-check.cjs`.

**Interface:** `PlayerView.getMobileEquipmentPresentation()` returns `{ html, weaponsHtml }`, reading `Game.state.axeInstanceId`.

- [x] Add regression checking `mobile-current-badge` contains `已装备`, no image; force all instances new and confirm current lacks `item-new-badge` while spare retains it; swap UUID and confirm marker moves.
- [x] Run `node --test tests/v7-inventory-integration.test.js`, confirm new assertion fails.
- [x] Change current badge to `<span class="mobile-current-badge" title="当前装备">已装备</span>` and new branch to `isNew && !isCurrent`.
- [x] Style tag compactly: 10px type, 14px height, 32px width; right inset 1px for equipped status leaves the 8px quality mark clear even on 46px cells. Stack any lock on the next row. Outline 2px ink-green inset.
- [x] Update geometry tests to assert text (not check image), no new marker on equipped; run both tests with 320px included, preserving rating/quality separation and scroll.

### Task 2: Compact single-reward dialog

**Files:** `reward-presentation.css`, new `tests/compact-rewards.browser-check.cjs`.

**Interface:** `PlayerView._showRewardModal(item)` and its `_rewardReveal` controller remain unchanged.

- [x] Add isolated full-app fixtures with external traffic blocked. Assert `modal.width <= 280`, art width 78, name 15, button height >= 44 for 320/390/430px, in both demo and normal UI modes. Assert desktop art 104 and name 17.
- [x] Run new test before CSS change and confirm size assertion fails.
- [x] Add `@media (max-width:719px)` rules scoped to `.reward-dialog--single`: max width 280px, large art 78px, name 15px/min-height 22px, quantity minimum height 18px; reduce ordinary padding while keeping existing burst gutters.
- [x] Exercise rare skill, tenth bonus and short viewport; assert footer reachable and no horizontal overflow. Run existing `tests/reward-bursts.browser-check.cjs` for atlas alpha clipping and reveal lifecycle.

### Task 3: Regression and release

**Files:** `index.html`, existing version assertions in `tests/*integration.test.js`, `docs/PROJECT_PLAYBOOK.md`.

- [x] Version only changed `app.js`, `mobile-cultivation.css`, `reward-presentation.css` as `compact-rewards-20260929`; keep all unchanged scripts/assets versioned as before.
- [x] Update playbook equipment-marker convention and mobile single-reward dimensions.
- [x] Run full Node suite, JS syntax, Python compile, runtime-image/frame-alignment checks, boot manifest check and `git diff --check`.
- [ ] Review scoped diff, commit task files only, fast-forward main and push. Verify corresponding Pages run succeeds and online changed files match; report completion only then.

## Verification record

- 630 Node tests passed; syntax, Python compile, 2 runtime-image and 5 frame-alignment checks passed; boot manifest unchanged.
- 40 isolated full-app cases passed across production/demo display contexts and five viewports (including 390x400 short screen).
- Mobile ordinary/rare single heights: 253.19/279.19px, width 280px; desktop retained 320px width and 104px art.
- All 12 rare/high atlas alpha bounds fit the compact dialog; natural, skip, cancellation, removed and reduced-motion lifecycles passed.
- Four weapon-library viewports passed with 20 same-definition instances, tag/quality/rating separation and both scroll offsets retained after equip.
- No account requests, screenshots, image regeneration or data changes.
