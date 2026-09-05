# Gameplay And Visual Refinement Design

## Goal

Correct the ten-chop bonus and monthly sign-in systems, make equipped axes visible on the cultivator, improve idle animation and inventory quantity readability, and unify the player-facing art direction around restrained celadon ink-wash aesthetics.

## Gameplay Rules

- Every successful chop increments the persisted lifetime chop count. A bonus is due whenever the new count is divisible by 10, regardless of whether chops were started individually or through the ten-chop control.
- The bonus is selected uniformly from reward pack `1003`, not from drop pool `1003`. The current pack contains items `10202`, `10301`, and `20101`.
- A chop result may contain a primary drop and an optional bonus drop. Both single- and ten-chop presentation paths consume this same result shape.
- Daily sign-in is represented by one database row per China-local calendar day. A database RPC inserts the day once, grants one chopping attempt, refreshes the month counter, and resets monthly reward claims when the month changes.
- Existing `last_daily_date` is backfilled as a sign-in record during migration. Monthly progress is derived from dated records rather than trusted as an independently edited counter.

## Character And Equipment

- The cultivator remains a transparent frame sequence. The equipped axe is a separate transparent DOM layer so adding an axe never requires regenerating the character.
- Animation frame changes publish a frame index and state. A weapon layer applies per-frame position, rotation, scale, and visibility.
- During idle, the axe rests at the character's side. During chopping it follows the hands. A hand-cover layer may be added later only if the overlap remains visibly wrong after anchor tuning.
- Replace the current six unrelated idle poses with a regenerated sheet based on frame 1. The animator supports a calm sequence with a pause between cycles instead of constant motion.

## Visual Direction

- Reference direction: Chinese ink-wash and celadon landscape, generous mist and negative space, paper and jade materials, dark ink typography, small amounts of warm orange-gold for emphasis.
- Avoid treasure piles, dominant gold, glossy purple panels, dense ornamental frames, and thick white blur over full-screen backgrounds.
- Background art remains fully visible. Readability comes from localized translucent surfaces, not a page-wide wash.
- Responsive panels, buttons, tags, and progress bars stay CSS-based. Generated art supplies backgrounds, focal controls, ornaments, and icons.
- The desktop shell expands beyond the current phone-width column while mobile keeps the compact single-column layout.

## Asset Strategy

- Generate one background atlas for the task and reward/shop environments, then crop it deterministically.
- Generate one idle-animation atlas from the existing first frame, then crop it with the existing character-sheet pipeline.
- Reuse the existing nine transparent axe files for the held-weapon layer.
- Reuse the already-generated V2 icon and UI atlases before generating another sheet. Only genuinely missing player-facing symbols are added to one supplemental icon atlas.

## Verification

- Unit tests cover bonus cadence, reward-pack membership, animation timing, frame callbacks, and sign-in RPC wiring.
- Static tests ensure player-facing emoji fallbacks are removed where image assets exist.
- Browser screenshots at desktop and mobile sizes verify background readability, quantity badges, equipped axes, animation framing, navigation, tasks, shop, and modals.
- The database migration is executed against Supabase and checked with read-only queries before deployment.
