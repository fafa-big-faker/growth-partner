# V5 Ink And Paper Design

Approved in conversation: replace procedural login water with the supplied ink textures; use supplied task/shop paper frames; strengthen neutral text hierarchy; unify the mobile inventory without generating more art. The user supplied both approved atlases in `../美术风格参考V５` and requested implementation and the established release workflow.

## Artwork

- Preserve both source PNGs. Import deterministically into `assets/images/v5` and compressed delivery files into `assets/runtime/v5`.
- Both atlases are 1536x1024. The paper atlas is RGBA with a transparent exterior (opaque-looking hidden RGB is not visible background). Measure alpha gutters rather than assuming frame bounds.
- Ink is a 3x2 RGB atlas on nearly white. Convert luminance to coverage, remove near-white background noise while preserving graded translucent ink, and assign a consistent charcoal RGB. Output six 512x512 RGBA tiles; use compact runtime WebP.
- Produce `ui/task-paper.webp`, `ui/shop-paper.webp`, and `effects/ink-01.webp` through `ink-06.webp`. Record source hashes, measured content bounds, dimensions, nine-slice data and runtime sizes in manifests.

## Login Motion

- Remove lake-mask, ellipse and procedural water-line drawing. Keep the approved Logo entrance, 10px/6400ms float, actual loading progress and native password behavior.
- Draw real ink textures around the Logo with composed curved motion, gradual stretch/rotation and fades, plus sparse small fragments. No full-screen dark wash, uniformly rotating stickers, or substitute CSS illustration.
- Exclude the form/loading panel and keep the Logo legible. Desktop uses at most three large traces, mobile at most two, plus bounded fragments. Preserve bitmap aspect and responsive framing.
- Lazy decoration loading never blocks authentication. Missing effects fail silently. Canvas is pointer-transparent, bounded to existing pixel/DPR limits, stops hidden/offscreen/destroyed, and is cleared for reduced motion. Preserve the existing lifecycle API.

## Task And Shop

- Replace the repeated task and shop item CSS boxes with the two genuine paper artworks using measured nine-slice borders. Keep content in document flow and adapt height to long copy; never stretch decorative corners.
- Titles/values use charcoal #252b29, body #464c49, secondary text #626762. Normal descriptions are at least 14px and small auxiliary copy at least 12px. Keep quality colors for quality, green for useful state, muted red for unavailable/rejected state.
- Apply neutral hierarchy to page titles, themes, sign-in, tabs, account balances and withdrawal copy, not only item interiors. Target at least 4.5:1 ordinary text on its real surface; aim for 7:1 for primary text. Preserve readable explicit backing where scenery interferes, without adding a full-page white blur layer.
- Keep reward, purchase, task filter, scroll preservation and locking behavior unchanged.

## Mobile Inventory

- The 58px/42px summary trigger reuses V3 `frame-topbar.webp` and keeps its fixed layout tracks, preview icons and new markers.
- The drawer continues using V4 `modal-paper.webp` and V4 item/weapon slots. Clear leftover legacy background/blur on the moved inventory and equipment, without adding an inner decorative frame.
- Preserve existing body-mounted drawer, focus/inert handling, details layering, tabs/scroll state, scene anchors and ten-chop sequence. Use neutral text and restrained existing paper/button assets.

## Verification And Release

- No browser screenshots or visual acceptance unless requested; use local mocked geometry, pixel-state, loading and interaction assertions. No real accounts or database requests.
- Test asset count, alpha, source preservation, bounds, nine-slice sizes and delivery budgets. Check moving nonblank texture pixels plus Logo/form exclusions and lifecycle cleanup.
- Check task/shop wrapping and interactions across four viewports, mobile inventory across five, all Node/image tests, syntax and scoped secret/diff checks.
- No Supabase/Feishu/config/player-data changes; leave user-owned `supabase/` untouched. Push tested main commit and confirm successful Pages deployment and byte-identical runtime files.
