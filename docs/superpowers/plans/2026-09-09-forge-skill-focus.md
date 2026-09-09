# Forge Skill Focus Implementation Plan

> Execute task-by-task in the existing authorized checkout. Preserve unrelated files and the shared main release flow.

**Goal:** Compact the forge result and establish the confirmed per-instance skill rating.

**Architecture:** Keep ForgeReveal and Game transactions unchanged. A fixed presentation region swaps progress for existing skill rendering; a pure WeaponAffixes helper computes the rating. Final rating art is a separately identified dependency.

**Tech Stack:** Vanilla JavaScript/CSS, Node tests, mocked Playwright, Pillow asset checks.

## Global Constraints

- No real player/configuration changes and no browser screenshots.
- Do not change the 2-3 second / 60%-40% forge timeline or action locks.
- Rating artwork is not available. Deliver its prompt; do not ship substitute art or make paid image calls.

## Task 1: Rating Logic

Files: `weapon-affixes.js`, `tests/weapon-rating.test.js`.

- [x] Add failing assertions for `getWeaponRating({skillRolls:[{description:'skill',buffQuality:5}]})` returning `{quality:5,label:'SSS'}`, no skills returning B, and mixed skills returning the maximum.
- [x] Implement the pure helper on existing WeaponAffixes exports. Accept saved nonblank descriptions and integer qualities1-5; ignore invalid entries. Do not mutate or reread configuration.
- [x] Run the new tests and existing affix tests; include nulls, malformed arrays, numeric strings, order and instance independence.

## Task 2: Compact Result Presentation

Files: `app.js`, `styles.css`, `tests/forge-reveal.test.js`, `tests/forge-layout.browser-check.cjs`.

- [x] Change the structure test to require `forge-result-detail` before `forge-ok`; verify progress disappears on result and restores on another forge.
- [x] Wrap heading/stage in `forge-modal-content`. Add `forge-reveal-information` with `forge-reveal-running` and the existing result detail. Use `stage.dataset.state` for visibility without changing ForgeReveal.
- [x] Set frame144x174/short128x154, keep44px action, fixed160px information region. Make modal a bounded flex column with independently scrollable content and stable bottom controls.
- [x] Render result quality, skill or “暂无斧技”, and escaped lore inside that information region. Reset scroll position and content on subsequent operations.
- [x] Exercise real UI with local mocked results: no skill, one skill, two long skills, equip eligibility, repeat, failure, material exhaustion, four viewports. Existing timeline tests cover fast/delayed results. Assert geometry/visibility and zero page errors, no screenshots.

## Task 3: Documentation And Release

Files: `docs/art-prompts/仙来-仙斧评级字标.md`, `docs/PROJECT_PLAYBOOK.md`, `index.html`.

- [x] Deliver one-atlas prompt with exact B/A/S/SS/SSS text, transparency, sizing and palette. Keep art-dependent inventory display explicitly pending.
- [x] Update the playbook's former “details after button” rule to the confirmed new structure and record rating policy.
- [x] Update only changed runtime script/style cache keys and their test assertions.
- [x] Run all Node tests, JS syntax, Python compile/Pillow tests, six browser regression suites and `git diff --check`. Passed302 Node tests,19 JS checks,15 Python compiles,45 image checks. The old reward test's strict44px check rounded hover geometry to43.99994px on HEAD too; use0.01px tolerance and verify again without changing product CSS.
- [ ] Stage named files only, commit and push; verify deployment and exact published bytes. Report forge completion separately from missing rating artwork.
