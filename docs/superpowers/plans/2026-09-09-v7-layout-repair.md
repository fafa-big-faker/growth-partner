# V7 Layout Repair

User authorized direct implementation and release. Reuse approved artwork; no new image generation, account changes, or browser screenshots.

## Design

- Small ink-red novelty text and dark quantity text leave item artwork legible.
- Equipment uses the existing backed quality tag; library/return uses existing button artwork.
- Weapon cells keep independent 3:4 dimensions and bounded images in a scrolling grid.
- The navigation paper stays a 72px bottom strip. Upper controls remain outside it; cultivation return reuses the chop circle with an official Lucide undo icon.
- Single rewards are compact. Ten-reward content may scroll, but its confirmation footer must remain visible even with every BUFF active.
- Preserve weapon identities, inventory scroll/mode, grant logic, and animation timelines.

## Checklist

- [x] Inspect screenshot concerns, inherited sizing, artwork, and controller lifecycle.
- [x] Add geometry regression for weapon rows, navigation paper, return icon, badges, and modal footer.
- [x] Implement mobile layout and reward presentation fixes in scoped modules.
- [x] Run full Node/Pillow/syntax suites and mocked browser checks without screenshots: 282 Node tests, 38 Pillow tests, 19 JS and 14 Python syntax checks, all five browser suites.
- [x] Prepare reviewed release files with explicit staging; preserve untracked supabase directory. Actual push, deployment, and published-byte verification are reported in the task's final status.

The mobile suite now covers seven viewports, including 360x480 and 390x680. It checks every row of 13 weapon instances before and after scrolling. The reward suite checks five viewports with all ten BUFFs, refunds, long names, and extra rewards; confirmation is clickable before scrolling, and the header/footer stay stationary when the body scrolls.
