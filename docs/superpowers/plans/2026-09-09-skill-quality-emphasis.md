# Skill Quality Emphasis Implementation Plan

> **For agentic workers:** Use the approved design and isolated collaboration ownership. Optional subagent-driven-development is unavailable; no repeat approval is required.

**Goal:** Make skill rarity visible both during the trigger and in the final reward quantity.

**Architecture:** The reward renderer and reveal controller share final quantity styling. Each quantity event references its real trigger; temporary name styling is restored independently of retained quantity styling.

**Tech Stack:** Vanilla JavaScript/CSS, Node tests, mocked Playwright.

## Constraints

- No changes to grants, RNG, BUFF config, audio or images. Preserve unrelated supabase directory.
- Preserve 300/500/500ms stages, single collect, ten skip, hidden scrollbar and local-only body scrolling.

## Task 1: Renderer And Controller (Root)

- [ ] Add triggerIndex to quantity events. Use buff-quality classes for the transient name and enhanced number; preserve item-name classes when restoring.
- [ ] Render final enriched quantities from the last real trigger, reset to plain base quantity when playback begins, and reuse final styling for finish/cancel/reduced motion.
- [ ] Append two exclamations to skill text and one to enhanced quantity. Keep readable fit in narrow columns and stable dimensions.

```js
assert.equal(activeName, '斧技·3倍！！');
assert.equal(finalQuantity, '×12！');
```

## Task 2: Regression (Independent Workers)

- [ ] Unit worker: update reward-reveal/v7-rewards/lifecycle tests for base style, sequential mixed rarities, last-trigger precedence and all completion paths; no duplicate marks or changed amounts.
- [ ] Browser worker: update both reward browser checks, verify five viewports, actual computed BUFF colors, restored item names, full punctuation, 1300ms timing, font fit and footer stability. No screenshots or database writes.

## Task 3: Release (Root)

- [ ] Update only changed reward JS/CSS cache keys and integration assertions. Record the final-number rule in PROJECT_PLAYBOOK.
- [ ] Full Node, Python image/config and syntax checks; review scoped diff and worker results.

Publish explicit task files to main and verify Pages plus live bytes before declaring completion.
