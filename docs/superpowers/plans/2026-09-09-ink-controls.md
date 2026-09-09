# Ink Controls Implementation Plan

> Execute the already approved return-arrow and experience-bar design with executing-plans. The user supplied the two requested source images; no new approval or image generation is needed.

**Goal:** Integrate the user's transparent ink arrow and aligned empty/full experience bars without changing the layout or progression rules.

**Architecture:** A deterministic image importer produces three small runtime WebP files. Existing navigation selects the new arrow; existing cultivation rendering and stat refresh update a shared progress percentage. Full-width aligned bar images are revealed with a clip, never squeezed to the current percentage.

**Tech Stack:** Pillow, vanilla JavaScript/CSS, Node tests, mocked Playwright.

## Constraints

- Source files remain untouched in the sibling V7 directory. Do not rebuild or overwrite the previous V7 atlas.
- Keep the existing ink circle, all viewport dimensions, bottom safe-area separation, weapon layout, reward algorithms and player state untouched.
- Remove only the generated bar's peripheral glow; preserve the actual slot and ink edges.
- Do not generate images, access real accounts, or perform browser screenshot acceptance.

## Tasks

- [x] Inspect the two source images, approved prompt, progress rendering and lightweight refresh path.
- [x] Import return-arrow, exp-track and exp-fill into assets/images/ink-controls and assets/runtime/ink-controls. Record measured bounds/caps/source hashes and test deterministic reconstruction and transparent margins. Three WebP files total 17,604 bytes.
- [x] Replace navigation/preload URLs with the ink-controls-20260909 versions; preserve circle and use a 60px contain arrow.
- [x] Add getExperiencePercent(exp, expMax) with finite non-negative 0..100 clamping. Both renderCultivate and UI._updateCultivateStats set --exp-progress and progressbar ARIA from the same calculation. Reserve stable space for the experience counter.
- [x] Use identical full-size empty/full bar geometry with cap-preserving image borders and percentage clip-path, including reduced-motion behavior.
- [x] Test true rendered/update progress at 0/25/50/100, level rollover, highest configured level, decoded images and stable geometry. All 291 Node tests, 45 Pillow tests, 19 JS/15 Python syntax checks, importer --check and six mocked browser suites passed without screenshots.
- [x] Prepare reviewed cache contracts, asset handbook and explicit release file list; preserve the untracked supabase directory. Push/deployment and published-byte verification are reported in the task's final status.
