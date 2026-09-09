# Weapon Rating Art Implementation Plan

> Execute the approved three-location design in the existing authorized checkout, using bounded asset and browser-test subtasks.

**Goal:** Display the user's generated ratings consistently in weapon cells, equipped weapon metadata, and forge results.

**Architecture:** Existing `WeaponAffixes.getWeaponRating(weapon)` remains the only rating policy. `renderWeaponRating(weapon, context)` shares versioned assets and fallback markup. Scoped CSS reserves space without changing inventory or forge dimensions.

**Tech Stack:** Vanilla JS/CSS, Pillow import script, Node tests and mocked Playwright.

## Global Constraints

- Preserve source images, UUID identity, stored affixes, action locks and scroll state.
- No generation costs, real account writes, browser screenshots or unrelated resource rebuilds.
- Images: five192x96 transparentWebP assets with a shared visible height/baseline. Runtime prefix `assets/runtime/weapon-ratings/`, cache version `weapon-ratings-20260909`.

## Task 1: Assets

Files: `scripts/import_weapon_ratings.py`, `tests/weapon-rating-assets.test.py`, new `assets/images/weapon-ratings/` and `assets/runtime/weapon-ratings/`.

- [x] Inspect real alpha bounds; crop B/A/S/SS/SSS separately, never stretch a single letter to triple width.
- [x] Write deterministic PNG/WebP output and manifests with source hash, crop bounds, dimensions and bytes. Add non-writing `--check`.
- [x] Test exactly five images, transparent margins, shared visible height/baseline, source reconstruction and size budget. Runtime total18,736 bytes.

## Task 2: Shared UI

Files: `app.js`, `styles.css`, `mobile-cultivation.css`, `index.html`, affected Node tests.

- [x] Add tests requiring three locations to render independent instance ratings and all five assets in preload.
- [x] Implement `renderWeaponRating(weapon, context = 'inline')` returning `.weapon-rating[data-rating][data-rating-quality]` with actual bitmap and same-size error text. Add its five URLs to `getInitialGameImageAssets()`.
- [x] Add slot rating markup to both weapon inventory renderers, place top statuses away from the bottom rating, and reserve icon bottom padding.
- [x] Append the helper beside `UI.qualityTag` in current equipment and beside result quality in forge. Ensure the old result clears on repeat and no ordinary item gets a rating.
- [x] Adjust narrow metadata placement, update only changed resource cache keys and associated assertions.

## Task 3: Verification And Release

Files: `tests/weapon-rating.browser-check.cjs`, project/asset playbooks.

- [x] Verify320/360/390/1440 widths with five same-item UUIDs, current/locked/new coexistence, equip/redraw, mode/scroll preservation, forge result/repeat, decode failure fallback and non-overlap.
- [x] Run complete Node/Python/image/syntax checks and the six existing browser suites. Passed305 Node tests,53 image checks,19 JS syntax and16 Python compiles; seven browser suites including the new rating check. No screenshots. Updated the old mobile icon threshold from35px to32px wide/40px high after the approved bottom rating reservation (actual narrow icon34.328x45.781px).
- [x] Update documentation from art-pending to actual dimensions and usage; stage named files only, excluding existing `supabase/`.
- [ ] Push tested commit, confirm Pages success, and compare deployed code/assets against committed bytes. Report release evidence in the final response.
