# Demo Breakthrough Hint Implementation Plan

> **For agentic workers:** Use executing-plans inline on `feat/demo-breakthrough-hint`.

**Goal:** Show a dismissible demo-only hint at the breakthrough entrance when ten-chop fails its realm gate.

**Architecture:** Add a small independent weak-hint controller to `demo-guide.js`, styled in `demo-session.css`. `PlayerView` only provides the target and current-session predicate; reuse existing teardown paths.

**Tech Stack:** Existing vanilla JavaScript/CSS, Node unit tests and isolated Playwright checks.

## Global Constraints

- Demo-only, no persisted flags/account/database/config mutations.
- Copy: `突破至中卡拉米，解锁十连砍`.
- Next click dismisses without preventDefault/stopPropagation; original click must leave the hint visible.
- No backdrop, focus capture, new art, screenshots or asset recompression.
- Preserve unrelated `supabase/`.

### Task 1: Behavior and controller

**Files:** `app.js`, `demo-guide.js`, `demo-session.css`, `tests/demo-breakthrough-hint.test.js`.

**Interfaces:** `DemoWeaponGuide.createBreakthroughHint({documentRef,windowRef})` returns `{show({getTarget,isCurrent}),cancel,isActive}`; `PlayerView.showDemoBreakthroughHint()` returns whether the hint was displayed.

- [x] Add failing Node regressions for the toggle's realm rejection, demo/formal distinction, valid realm and insufficient count. Fixture checks `assert.equal(cb.checked, false)` and `assert.equal(hints, 1)` after `toggleTenChop(true)`.
- [x] Implement `showDemoBreakthroughHint`: guard demo player/current cultivation/no modal or strong guide; create controller lazily, pass stable account identity and target `#breakthrough-btn`.
- [x] In rejected realm branch, use `if (!this.showDemoBreakthroughHint()) UI.toast(...)`; retain all existing gameplay guards.
- [x] Implement fixed-position noninteractive bubble, responsive clamping and SVG down-arrow; document capture click/pointerdown dismissal must only remove hint, never cancel user event. Resize/scroll update geometry. Invalid target or context cancels.
- [x] Reuse `cancelChopPresentation()` and cultivation redraw/login reset to cancel and detach all listeners/observers. Floating animation has reduced-motion fallback.
- [x] Run Node regressions and confirm all branches pass.

### Task 2: Browser interactions, regression and release

**Files:** new `tests/demo-breakthrough-hint.browser-check.cjs`, `tests/demo-session.browser-check.cjs`, `index.html`, version assertions, playbook.

- [x] Isolated browser checks at 320/390/1440px: checkbox/label trigger stays visible; the arrow aims at breakthrough; no overlay/horizontal overflow; one click dismisses and activates breakthrough. Test repeated attempts, Escape, scroll/resize, invalid context and teardown.
- [x] Extend full demo playthrough to attempt ten-chop before breakthrough and assert the hint does not consume materials. Confirm existing first-chop/SSS/forge tutorials still work.
- [x] Bump only changed app/demo script/style URLs to `demo-breakthrough-20260929`, update corresponding assertions; unchanged artwork remains cached.
- [x] Update `docs/PROJECT_PLAYBOOK.md`; run all Node, syntax, Python compile, image/frame alignment, boot manifest and diff checks.
- [ ] Commit scoped files, fast-forward main, push, verify Pages success and online changed files.

## Verification record

- 637 Node tests passed, including seven new demo-only gating/lifecycle/cache assertions.
- Weak-hint mouse, touch, label-forwarded click, keyboard Space/Escape, re-trigger, reduced-motion, scroll/resize, target removal and modal cleanup checks passed at 320/390/1440px.
- Full local demo path passed on all three viewports: login, forced first chop, rejected ten-chop hint, breakthrough, ten-chop, SSS equip guide, forge guide, manual forging, task claim and fresh-login reset.
- Zero live database requests and zero browser exceptions. No screenshots or artwork regeneration.
- JS syntax, Python compile, two runtime-image tests, five sprite-alignment tests, boot manifest consistency and diff whitespace checks passed.
