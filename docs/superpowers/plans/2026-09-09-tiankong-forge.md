# 天工开物 Implementation Plan

> **For agentic workers:** Follow approved design with isolated file ownership. Optional superpowers:subagent-driven-development is unavailable; use the available collaboration tools without repeating approval.

**Goal:** Deliver compact forging with real scene art, centered axes and small overlaid equipment controls.

**Architecture:** Keep the existing forge controller and public DOM IDs. Import this atlas independently, replace old forge CSS in place, and update markup/state rendering without changing reward or animation logic.

**Tech Stack:** Vanilla JavaScript/CSS, Pillow, Node tests and mocked Playwright.

## Global Constraints

- Publish tested main to GitHub Pages, verifying run success and live bytes.
- No player/config/audio/old art changes, no screenshots, preserve unrelated `supabase/`.
- Source art untouched; preserve alpha/ink edges with measured bounds and deterministic rebuild.
- One title 天工开物; stable main action in idle/running/no-skill/skill/locked/equipped states.
- Keep 2–3s forge timeline, 60%/40% rhythm and action locks intact.

## Task 1: Atlas Import (Asset Worker)

Files: `scripts/import_forge_art.py`, `assets/images/forge-workshop/*`, `assets/runtime/forge-workshop/*`, `tests/forge-art-assets.test.py`, `docs/ASSET_PIPELINE.md`.

- [x] Inspect actual RGBA/size and two connected regions; follow existing import_ink_controls.py pattern, preserving source and all old assets.
- [x] Implement deterministic import plus `--check`, alpha cleanup below5 only, measured crop with transparent safety margins, proportional runtime WebP.
- [x] Produce exact public paths `assets/runtime/forge-workshop/stage.webp` and `equip-slip.webp`; manifest includes sizes, SHA, bounds and byte budget. Scene target about384px high, button about288px wide; preserve actual source proportions.
- [x] Verify count2, transparency, no cross-contamination, source fingerprint, rebuild equality and compact bytes. Record command and actual measured data in ASSET_PIPELINE.

## Task 2: Compact CSS (Layout Worker)

Files: `styles.css` forge section only; `xianlai-v4.css` only if specificity requires a scoped fix.

- [x] Replace old400px shell/160px information slot/44px frame grid with compact fixed-session shell and scene that absorbs remaining room. Limit short screens; ordinary mobile target500–540px.
- [x] Preserve DOM IDs; new structure has `.forge-scene-background` decorative img inside frame before art and action, `.forge-result-summary` after name, `.forge-reveal-information` for running/result detail. Probability details are in `.forge-modal-content`, outside the stage and before footer.
- [x] Scene artwork fills frame without stretching. Art fills full frame with centered axe; float `.forge-result-action` bottom center, no grid row. `.forge-result-equip` uses new equip-slip background, compact visual96x32 inside44px target. Remove120px minimum. `.forge-result-locked` and `.forge-result-equipped` share anchor.
- [x] Keep name, summary, progress/detail closely grouped. No-skill copy compact; one detail scroll layer, probability expansion overlays/uses content region without moving footer. Hover/focus/pressed and reduced-motion support.
- [x] Communicate final geometry to browser worker and root; do not modify app.js or tests.

## Task 3: Markup and State (Root)

Files: `app.js`, `index.html`, relevant Node regression tests, `docs/PROJECT_PLAYBOOK.md`.

- [x] Render one modal title `天工开物`, remove `.forge-heading` duplicate and placeholder question mark; use decorative scene img.
- [x] Keep result quality/rating in `#forge-result-summary`; no-skill small inline label. Keep skills/copy in `#forge-result-detail`; reset summary/detail/action on every new attempt/failure.
- [x] Equip action remains `_equipFromForge` and successful state becomes small overlaid 已装备; locks and cleanup unchanged. Use `${forgeCostItem?.name || '锻造材料'}不足` for insufficient material.
- [x] Add both new image URLs to initial assets with `?v=forge-workshop-20260909`; update only changed app/styles cache keys.
- [x] Update old layout-specific tests to new contract; preserve existing timing/data tests. Record latest rules replacing stale44px/160px descriptions.

## Task 4: Browser Regression (Browser Worker)

Files: `tests/forge-layout.browser-check.cjs`, related forge assertions in `tests/weapon-rating.browser-check.cjs` only if needed.

- [x] Use existing local mocks, no screenshots or real account. Inspect320/360/390 portrait, short landscape and1440 desktop.
- [x] Check one title, scene/slip image decode, no horizontal overflow, footer stays visible/centered through idle/running/none/single/double skill/locked/equipped states. Validate centered full-stage axe and44px equip hit target.
- [x] Verify long names/requirements, long double skills scroll, probability open/close leaves main button fixed, repeated forge/equip locks, no page errors/network mutations.
- [x] Wait for source readiness then run bounded execution sessions and report results.

## Task 5: Release (Root)

- [x] Full Node tests, root JS syntax, Python compile and all image/config suites. Inspect scoped diff, no credential/ unrelated files.
- [x] Prepare only explicit task paths for release. After committing, push origin main and verify matching Pages success plus exact committed index/app/styles/new-art live content before reporting completion.

Validation: 397 Node checks, 65 Python checks in 11 suites, 22 root JS and 17 Python syntax checks passed. Forge layout passed 5 viewports, weapon-rating browser passed 4; no screenshots, writes, or page errors. New runtime art totals 53,326 bytes.
