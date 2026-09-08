# Ink Motion, Task Pages And Scrollbars

The user approved the preceding design discussion and requested implementation plus matching inventory scrollbars. No image generation or configuration changes are needed.

## Approved Behavior

- Preserve the once-only 1.5 second logo reveal. Follow it with approximately 3-4px vertical floating over 6-8 seconds, without rotating/scaling text or moving the form.
- Add visible but restrained lake strokes and no more than two occasional flattened ripple groups. Map the existing login background's water region through its actual cover crop; do not distort mountains, shore, foliage or controls. Stop animation offscreen/background; honor reduced motion and optional Canvas availability.
- Use a fine dry-ink loading track, filled only by real loading progress. Keep a subtly breathing leading edge while waiting; display status and percentage on one baseline. Show immediate feedback before account verification, recover the form on wrong passwords/errors and avoid false percentages or artificial minimum loading duration.
- Simplify task pages to aligned paper-note rows using existing art: title/status, description, rewards and actions. Collapse absent-theme promotion to a short line, remove card nesting and purple/gold gradients. Keep all rewards visible and preserve filter/scroll when refreshing data.
- Compact the reward page: distinguish game currency from RMB balance/withdrawal, use readable mobile product rows with full descriptions and stable action placement, and keep one withdrawal-records entry. Reuse existing caches and guarded operations; no gameplay or amount-rule changes.
- Style actual native scrolling for inventory, drawer, page and modals with narrow muted ink thumbs and quiet tracks. Keep mouse wheel, drag, keyboard and touch behavior native, reserve stable gutter where appropriate, and retain high-contrast/platform fallback. Do not build a fake scroll engine or change slot sizes.

## Boundaries And Acceptance

- No generated images, Supabase data/schema or Feishu configuration writes; leave unrelated untracked `supabase/` untouched.
- No screenshots/browser visual acceptance. Local headless event, geometry, image and canvas-state checks without real account/network mutation are allowed.
- Test 360x540, 390x844, 844x390 and 1440x900: controls reachable, text not overlapping, loading immediate/monotonic/recoverable, scene/controls intact, correct tab/list states, no duplicate action paths.
- Existing action guards, native login/password manager, real reward routing and mobile drawer lifecycle remain authoritative.
- Run full Node suite, image tests and syntax checks; inspect scoped diff/secrets, push main and verify deployment before reporting completion. Report any single step with no meaningful progress for ten minutes.
