# Unified Layout Implementation Plan

> Use executing-plans for the implementation; independent bounded checks are delegated within the current workspace. The user has authorized continued implementation and release.

**Goal:** Unify desktop/mobile cultivation, eliminate fullscreen stretching, fix reward text centering, and deliver art prompts.

**Architecture:** Extend the existing controller's availability, not its data responsibilities. Use bounded grid tracks and separate safe-area space from artwork height. Preserve existing modules and guards.

**Tech Stack:** Vanilla JavaScript/CSS, Node tests, mocked Playwright, existing WebP assets.

## Global Constraints

- No new generated images, accounts, database writes, or configuration changes.
- No screenshots or browser visual acceptance; perform geometry and event regression.
- Stage explicit files only and preserve the untracked supabase directory.

## Tasks

- [x] Read project rules and inspect layout/controller/viewport inheritance.
- [x] Add regression: desktop has one item grid plus two-column weapon library; 390x680 -> 390x950 -> 390x1200 and 1440x900 -> 1440x1200 preserve paper/pane heights. Both real fullscreen entry/exit probes succeeded.
- [x] In mobile-cultivation.js expose `isEnabled()` for all player viewports; use it for layout lifecycle. In app.js force left inventory items and refresh right equipment based on `isEnabled()`.
- [x] Apply shared CSS on all widths; set inventory tracks to 224px/180px/280px and bounded 3:4 weapon cells. Set dock flex-basis/min/max height, with fixed paper height above the safe-area inset.
- [x] In reward-presentation.css set footer button `justify-content: center`, verify actual text Range center within 1px and persistent 44px controls. Old label was offset 29px; new horizontal and vertical offsets are zero.
- [x] Write two generation prompts in docs/art-prompts with dimensions, transparent margins, layer arrangement, names and negative constraints.
- [x] Update cache markers and affected integration contracts. All 284 Node tests, 38 Pillow tests, 19 JS/14 Python syntax checks, five browser suites, and git diff --check passed.
- [x] Review and prepare explicit release files; preserve the untracked supabase directory. The actual push/deployment and published-commit verification are reported in the task final status.
