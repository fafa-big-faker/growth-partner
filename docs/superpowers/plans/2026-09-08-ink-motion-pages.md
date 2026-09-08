# Ink Motion And Pages Implementation Plan

> **For agentic workers:** Use executing-plans with bounded parallel ownership. The specialized subagent-driven-development skill is not installed; main coordinates the shared app and release.

**Goal:** Extend login atmosphere and loading feedback, unify task/shop pages and native scrollbars using existing assets.

**Architecture:** Retain vanilla render/data boundaries and existing LoginArt lifecycle. Separate login artwork, page styling and shared scroll styling; root owns authentication progress and final includes. All delayed actions keep their existing guards and caches.

**Tech Stack:** Vanilla JS/CSS/HTML, Canvas 2D/Web Animations, Node tests, local Playwright checks.

## Global Constraints

- No new bitmap generation, configuration or player-data mutations.
- Do not screenshot or perform browser visual acceptance.
- Preserve existing filters/scroll, reward visibility, password manager and drawer behavior.
- Prefer native scrolling and reduced-motion/high-contrast fallbacks.

## Task 1: Login Artwork

Owner: login worker. Files: `login-art.js`, `login-art.css`, `tests/login-art.test.js`, focused new motion tests if needed. Root owns `index.html` and Auth.

- [ ] Add failing tests for post-reveal float, paused/reduced lifecycle, resize-aware lake placement and monotonic loading. Example: `assert.equal(env.frames.size, 0)` after hidden and reduced states.
- [ ] Extend `LoginArt.setLoading(loading, percent)` compatibly; style existing loading nodes, expose status as a separate DOM text node owned by Auth. Float only after reveal, skip fallback logo, and cancel every animation on destroy.
- [ ] Render perspective ripple groups clipped to the actual lake region, limiting rates and count; no whole-background movement. Test no frame work when inactive and ongoing drawing after reveal.
- [ ] Run login unit suite and share exact DOM/classes needed by root.

## Task 2: Task And Reward Surfaces

Owner: page worker. Files: new `ink-pages.css`, relevant task/reward render functions in `app.js`, new `tests/ink-pages.test.js`; no Auth or asset resolver edits.

- [ ] Add tests for compact inactive theme, persistent task filter, no duplicate withdrawal entry and preserved guarded reward/purchase callbacks.
- [ ] Refactor only markup/layout for paper-note task rows and unframed theme grouping; keep reward nodes/buttons and stable list order. Replace relevant inline old gradients with classes.
- [ ] Render compact RMB account controls and distinct game-currency shop; use one record entry and lazy/cached records as appropriate. Mobile goods use readable horizontal rows, descriptions wrap and actions stay reachable.
- [ ] Verify `UI.runLockedAction` calls and cached/in-flight route guards remain; run old task/reward/navigation tests along with new tests.

## Task 3: Native Ink Scrollbars

Owner: scrollbar worker. Files: new `ink-scrollbars.css`, new `tests/ink-scrollbars.test.js`; do not alter inventory geometry or mobile controller.

- [ ] Check actual scroll hosts; add tests for inventory/drawer/modal coverage, standard plus WebKit rules, pointer/keyboard behavior remaining native and forced-color fallback.
- [ ] Implement thin ink thumb/quiet track, hover/active distinction and `scrollbar-gutter: stable` only where safe. Do not set overflow or scrollbar-width:none; no JavaScript scroll handlers.
- [ ] Inspect compatibility with existing rules and report required stylesheet order. No screenshots.

## Task 4: Authentication Feedback And Integration

Owner: main. Files: Auth in `app.js`, `index.html`, `tests/login-credentials-integration.test.js`, integration/browser checks.

- [ ] Add immediate verification-state feedback test before the first await; wrong-password and failure must restore form and release login lock. Late preload callbacks must remain ignored.
- [ ] Keep numeric progress tied to existing actual image progress and completed stages. Use clear status for verification/assets/player data/current axe loading. Never advance percent on a clock; setLoading must not re-enable the form while verifying.
- [ ] Include new CSS after existing styles, update changed file cache versions coherently and preserve unchanged asset URLs.
- [ ] Run all Node tests, syntax/image tests and headless local geometry/events/canvas changes with mocked accounts. No real logins or account writes.
- [ ] Update project guidance, inspect staged diff for secrets/unrelated files, commit and push main; verify published files against committed content. Publication result is recorded in final response.
