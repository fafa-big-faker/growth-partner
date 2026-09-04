# Cultivator Sprite Animation Design

## Goal

Replace the static cultivator artwork with the provided six-frame idle and chopping sequences, make chopping visibly animate, swap the cultivator and tree positions so the right-facing action points toward the tree, and enlarge item artwork inside existing backpack slots.

## Asset Processing

- Source sheets are `2172x724` PNG files containing six frames in one horizontal row.
- Split each sheet into six `362x724` PNG files.
- Preserve the complete frame canvas and alpha channel. Do not trim frames independently, because different trim bounds would make the character jump during playback.
- Store final assets under `assets/images/character/idle/` and `assets/images/character/chop/`, named `frame-01.png` through `frame-06.png`.
- Do not regenerate, repaint, mirror, or otherwise alter the supplied artwork.

## Scene Layout

- Render the cultivator on the left and the tree on the right.
- Keep both grounded on the same baseline and retain the current responsive scene height.
- Use a stable character viewport so frame changes never resize or shift the scene.
- The login artwork remains unchanged; this change applies to the cultivation scene only.

## Animation Behavior

- Preload all twelve frame files after the player enters the cultivation screen.
- Idle animation loops continuously at 200 ms per frame, approximately 1.2 seconds per cycle.
- A chop immediately interrupts idle, plays the six chop frames once at about 90 ms per frame, then resumes idle.
- Single chop triggers one action cycle.
- Ten-chop triggers one action cycle for each chop and spaces iterations so cycles do not overlap.
- Re-rendering or leaving the cultivation view cancels old timers, preventing detached images from continuing to update.
- Database work and reward logic remain unchanged.

## Backpack Icon Scale

- Keep all backpack grid tracks, aspect ratios, spacing, and slot sizes unchanged.
- Increase only the normal item image within each occupied item slot to roughly 70% of the available slot area, with a maximum size that preserves padding and the quantity badge.
- Preserve the existing weapon-specific sizing and small icons used in buttons, counters, rewards, and shop rows.

## Verification

- Verify every generated frame is exactly `362x724` and retains transparency.
- Verify idle motion loops without visible layout movement.
- Verify single and ten-chop actions play the chop sequence and return to idle.
- Verify the character faces the tree after the scene order is swapped.
- Verify item icons are visibly larger while slot dimensions and count badges stay unchanged.
- Run syntax checks and the existing regression suite, then inspect desktop and mobile screenshots before publishing.
