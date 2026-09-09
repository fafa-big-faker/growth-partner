# Skill Quality Emphasis Implementation Plan

> **For agentic workers:** Use the approved design and isolated collaboration ownership. Optional subagent-driven-development is unavailable; no repeat approval is required.

**Goal:** Make skill rarity visible both during the trigger and in the final reward quantity.

**Architecture:** The reward renderer and reveal controller share final quantity styling. Each quantity event references its real trigger; temporary name styling is restored independently of retained quantity styling.

**Tech Stack:** Vanilla JavaScript/CSS, Node tests, mocked Playwright.

## Constraints

- No changes to grants, RNG, BUFF config, audio or images. Preserve unrelated supabase directory.
- Preserve 300/500/500ms stages, single collect, ten skip, hidden scrollbar and local-only body scrolling.

## Task 1: Renderer And Controller (Root)

- [x] Add triggerIndex to quantity events. Use buff-quality classes for the transient name and enhanced number; preserve item-name classes when restoring.
- [x] Render final enriched quantities from the last real trigger, reset to plain base quantity when playback begins, and reuse final styling for finish/cancel/reduced motion.
- [x] Append two exclamations to skill text and one to enhanced quantity. Keep readable fit in narrow columns and stable dimensions; compact forms retain two ASCII exclamation marks.
- [x] User addition: in `getRevealPlan`, use `cursor += hasMultiplier ? 300 : 120` after each reveal. `hasMultiplier` checks for type 1 or legacy unspecified type, matching the existing trigger loop. The original name stays visible until 300ms for triggered items; ordinary items and 1300ms trigger stages keep their existing pace.

```js
assert.equal(activeName, '斧技·3倍！！');
assert.equal(finalQuantity, '×12！');
```

## Task 2: Regression (Independent Workers)

- [x] Unit worker: update reward-reveal/v7-rewards/lifecycle tests for base style, sequential mixed rarities, last-trigger precedence and all completion paths; no duplicate marks or changed amounts. All 47 focused checks pass.
- [x] Browser worker: update both reward browser checks, verify five viewports, actual computed BUFF colors, restored item names, full punctuation, 1300ms timing, font fit and footer stability. Both suites pass; no screenshots or database writes.
- [x] Verify the added lead-in: original name and plain quantity at 299ms, skill name at 300ms, shake at 600ms, quantity/color at 1100ms, settle/next trigger at 1600ms. Two triggers settle at 2900ms; ordinary items remain 120ms apart.

## Task 3: Release (Root)

- [x] Update only changed reward JS cache key and integration assertions. CSS is unchanged and retains its cache. Record the final-number rule in PROJECT_PLAYBOOK.
- [x] Full Node (396 checks), Python image/config (59 checks in 10 suites), JavaScript (22 root files) and Python (16 files) syntax checks pass. Scoped review and both browser suites pass.

Publish explicit task files to main and verify Pages plus live bytes before declaring completion.
