# Xianlai V4 Art And Mobile Cultivation

Approved by the user on 2026-09-08 after the naming, six-atlas, text-only breakthrough and mobile inventory-drawer proposal. The supplied files under the sibling `美术风格参考V4` directory are the source. No new generation is required.

## Scope

- Import 19 ordinary item icons, nine axe icons, two slot frames, one modal paper, a forge icon and a forge button (33 assets). Retain original source files and provenance; build compressed runtime WebP with explicit nine-slice geometry.
- Rename the approved items in the Feishu source table and synchronize configuration, preserving IDs, recipes, currency values and axe names. Keep the three family stones and the literal chopping-count label. Names: small currency 小钱钱; materials 月屑/月牙片/星尘/星叶/日光屑/暖阳露/云石/云玉; redemption 一弯月/一颗星/一束光/一朵云; forge 开工石; tree 菩提露.
- Prefer V4 icon assets through one item resolver, covering inventory, equipment, rewards, forge and administrative views. Existing remote/configured icons remain fallback for future IDs.
- Use restrained neutral square/portrait frames, independent quality accents and existing quantity/new/lock markers. Unify modal paper and primary forge action without changing the established repeat-forge flow.
- Replace realm emoji comparison with current realm, a prominent textual target realm, description, aligned requirements and real unlock changes. Keep config icon fields compatible.
- On mobile cultivation only, keep scene and chopping controls on screen together. Compact tools, elastic scene, realm information, inventory summary, action dock and navigation. Complete inventory opens in a bottom drawer with its existing tabs and actions. Short viewports collapse the preview before shrinking controls. Desktop, tasks and store retain their existing document layouts.

## Interaction And Safety

- Keep tree/character anchoring and timelines unchanged; scale the scene as one composition if needed.
- Drawer preserves inventory tab, scroll, new-item state, equipment actions and resource guards. Background interaction is blocked while open; Escape/backdrop/close work, focus returns to opener. Refresh must not leave duplicate inventory DOM or orphan overlays.
- Responsive changes must account for browser usable height and safe areas. Main targets are 360x640, 390x844, 844x390 and desktop 1440x900. Extremely short landscape may use safe scrolling instead of clipping controls.
- No account credentials, player data or Supabase schema changes. Preserve unrelated untracked `supabase/`. No browser screenshots or visual acceptance unless requested.
- No generic removal of dark pixels during cutout. Inspect alpha/background and real placement before selecting deterministic crop rules. Do not use generated assets with baked labels, checkerboards or clipped silhouettes without correcting them.

## Verification And Release

Verify IDs/counts/alpha/crop bounds/runtime sizes, focused Node behavior tests, Python asset tests, existing full suites and syntax checks. Headless nonvisual layout/event/asset checks are allowed without real login or remote data mutations. Inspect diff and secrets, commit scoped files and push main. Confirm Pages commit and online asset availability before declaring release complete.
