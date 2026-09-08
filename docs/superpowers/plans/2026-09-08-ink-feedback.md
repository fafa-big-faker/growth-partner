# Ink Feedback Implementation Plan

> **For agentic workers:** Use executing-plans with bounded parallel ownership; unavailable subagent-driven-development/finishing skills are replaced by project release rules.

**Goal:** Make subtle feedback visible and consistent with the approved ink-pixel style.

**Architecture:** Keep existing LoginArt and CultivationEffects lifecycle APIs. Main owns modal/contrast integration, while independent workers own login animation and tree effects. All resource actions and player data remain unchanged.

**Tech Stack:** Vanilla JS, CSS, Canvas, vendored Lucide SVG, deterministic Pillow sprite extraction, Node tests and mocked local browser checks.

## Global Constraints

- No visual screenshots, paid generation, Supabase/Feishu changes, or edits to user-owned `supabase/`.
- Preserve password support, ten-chop transaction/timeline, scene anchors and locked modal guards.
- Keep particles and frame work bounded; honor reduced motion and hidden state.

## 1. Login Visibility (Login Worker)

Files: `login-art.js`, `tests/login-art.test.js`. Do not edit Auth/index or shared browser check.

- [ ] Assert the infinite float keyframe is `translateY(-10px)` and duration 6400.
- [ ] Compute ripple placement from visible lake segments minus form/Logo exclusions. Keep existing cover mapping and choose at most two clear centers; use darker 1.5px+ paired water strokes, not tiny low-alpha remnants.
- [ ] Preserve `setLoading(loading, percent)` and lifecycle cancellation; run `node --test tests/login-art.test.js`.

## 2. Tree Hits (Effects Worker)

Files: `cultivation-effects.js`, effect block in `styles.css`, `tests/cultivation-effects.test.js`, a deterministic leaf-extraction script and new small runtime effect asset. Main wires the call-site speed/preload/version.

- [ ] Test `playHit({scene,tree,intensity:1,speed:3})` creates fewer than seven restrained elements, with shorter durations than speed1, and `clear()` removes nodes and timers.
- [ ] Extract the central leaf from existing effect art, preserving leaf details and removing surrounding orbit/magenta edge contamination. Keep originals untouched and save source trace/script plus transparent runtime WebP. Reuse existing pixel artwork; no AI call.
- [ ] Replace legacy spark/glow with short ink slash and 3-5 leaves; use actual scene scale for position and distinct crown/strike origins. Add `speed` option (default1), reduced-motion fallback, live-node cap and cleanup. No new chop timers.
- [ ] Replace old effect CSS block, ensuring delay is included in the animation declaration and speed affects the complete lifetime. Run effect and timeline tests.

## 3. Controls And Contrast (Main)

Files: `app.js` shared modal and sign-in markup/preloader, `xianlai-v4.css`, `ink-pages.css`, `mobile-cultivation.js`, new licensed `assets/runtime/ui/close.svg`, tests and release includes.

- [ ] Vendor Lucide X with its license, use 44x44 dismiss targets and 22px icon. Keep `aria-label`, focus-visible, hover/press, disabled and Escape behavior. Route both modal and drawer to the shared visual.
- [ ] Replace fixed sign-in hint numbers with `rewards.map(r => r.requiredDays).join(' / ')`, split reset into a span, and set explicit foreground/background contrast >=4.5:1.
- [ ] Pass `timing.speed` only in the existing ten-chop hit callback; preload the new leaf/close instead of unused hit sprites, version all changed runtime dependencies.
- [ ] Extend `tests/ink-polish.browser-check.cjs` to require meaningfully visible stroke alpha/coverage and logo motion, plus close target/hover/locked/dismiss behavior and sign-in contrast. No screenshots or real database calls.
- [ ] Run all Node/image/syntax and mobile browser tests, update maintenance notes, inspect scoped staged changes, push main and verify Pages assets against the committed files.
