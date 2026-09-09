# Inventory, Reward Feedback, and Login Readiness

Approved by the user on 2026-09-09. Implement the previously presented design without another approval gate.

## Inventory

Only material inventory is sorted, numerically by definition type then item ID. A compact icon-and-label paper control sits at the left bottom edge, outside the scrolling items. Sort resets only the left scroll to zero. Preserve quantities, new badges, weapon UUIDs, weapon-library mode and right scroll. Remember the explicit order locally per account; unseen kinds append until the next sort. Replace tiny textured weapon locks with the licensed local Lucide lock icon, keeping status badges separated.

## Rewards and Audio

Import the four supplied WAV files from the sibling audio directory, preserving originals. Rare quality 3 and high qualities 4/5 have distinct confirmed-drop cues; qualities 1/2 retain existing audio. Physical chop sound remains unchanged. Modal reveal uses one short common cue. Skill activation has its own cue; number changes reuse the common cue. Limit concurrent feedback sounds and support cancellation and global mute.

Keep actual reward calculations and persistence unchanged. Capture base quantity and ordered multiplier triggers during the existing random calculation, never re-roll during presentation. Refund totals are already computed; include them in the feedback. Extra rewards retain their real isExtra grouping and do not gain artificial skill triggers.

Keep fixed 5+5 slots plus centered extras. Reveal each item with restrained opacity/scale/ink movement, ordinary stagger 100-140ms. Pause for a triggered item's quantity transition (first about 450ms, later about 300ms), then continue. Render actual multiplier values and cumulative quantities. Refunds show an explicit icon and count plus a persistent batch total. Reserve space so labels do not move the footer. During reveal the fixed footer command reveals all; afterward it closes. Reduced motion shows final quantities immediately. Closing, skipping, logout, or removing the modal must cancel pending animation/audio without changing grants.

## Login

Initial lightweight background preview and a 48px loading ring precede the login composition. Wait for background, logo and button images to load and decode; include ink decorations with a recoverable simplified mode. Retry failed resources and never claim success for failed images. After readiness, preserve the logo entrance and settle delay. Touch press triggers the same lettering glow as hover for about 250ms, without delaying submission. Bound image concurrency, deduplicate same-URL in-flight and successful requests, apply per-image timeouts. Prewarm game assets only after login art is ready; do not block entry on all weapon animation sets or optional audio.

## Verification and Release

No screenshots or real-player writes. Add deterministic logic tests and mocked browser interaction/geometry checks. Run full Node tests, existing image suites, syntax/compile checks and diff checks. Preserve unrelated untracked supabase content. Publish explicit task files only and verify deployed bytes.
