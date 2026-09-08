# Ink Feedback Correction

User requests continued polish of modal close controls, perceptibility of login motion, tree-hit effects and sign-in contrast. Existing standing authorization delegates final design decisions and implementation; do not repeat the approval prompt. No screenshots, account changes or paid image generation.

## Design

- Close controls: replace the old red/gold bitmap with the licensed Lucide X, dark ink on a quiet transparent 44px touch target. Share treatment with mobile backpack dismissal, preserve labels, focus, Escape and locked-modal behavior. No new generated bitmap is necessary.
- Login: preserve entrance and still form. Float amplitude becomes 10px over 6.4 seconds. Water uses stronger blue-gray paired strokes and flattened ripple groups chosen from visible lake space outside the form, rather than mostly offscreen fixed source anchors. Start visibly moving on entry; no long empty interval. At most two ripple groups and the existing frame/resolution bounds. No whole-background warp, rings over mountains, or forced motion under reduced-motion preferences.
- Tree hit: remove gold explosions and blue/gold circles; extract a clean leaf from existing art with a deterministic script and use tiny transparent WebP sprites, plus a short directional ink cut. Leaves originate at the crown, cut at the existing shared strike point. Preserve tree/character geometry and ten-chop timeline; speed must scale effect duration, and live particles/cleanup must be bounded.
- Sign-in: use opaque deep ink text on a small pale backing strip, 12px and 1.6 line-height, with reset information separate from reward milestones. Keep reward thresholds configuration-driven and unchanged; do not hardcode another set of numbers.

## Alternatives

Generating a full new effect atlas would require more art iteration and is unnecessary for small particles. Raising opacity of the existing circles would make the wrong style more prominent. Prefer the existing pixel leaf plus code-native motion and a familiar library close symbol.

## Verification

Test loaded and perceptible canvas output (not merely nonzero pixels), logo travel, reduced/hidden lifecycle, control hit sizes and interactions, sign-in contrast >=4.5:1, tree-effect speed/cleanup/maximum count and all existing regressions. Test local mocked pages without screenshots. Update runtime URL versions, push tested main and verify deployed content.
