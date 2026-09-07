# Tree Layer And Forge Timeline Correction Design

## Goal

Correct the published cultivation scene so every configured tree sits behind the cultivator and its trunk meets the axe strike area, and make forging use a deterministic 2-3 second presentation timeline that is independent from request latency.

## Cultivation Scene

The character and tree use one positioned scene coordinate system instead of relying on flex gaps and negative margins. The character wrapper is always above the tree wrapper; hit effects remain above both. All sprites share a ground baseline. Each tree appearance owns explicit width, height, horizontal anchor, and vertical anchor variables because the trunk occupies a different part of each source image.

The tree label is positioned independently from the overlapping art so it stays readable. Hover and press transforms affect the tree wrapper without changing its stacking order.

## Forge Timeline

Each forge samples one presentation duration `T` from 2000 through 3000 milliseconds. The network request begins immediately but does not control visual progress.

- From `0` through `0.6T`, `requestAnimationFrame` advances the bar smoothly from 0 to 98 percent and shortens candidate intervals from 120 ms to 38 ms.
- From `0.6T` through `T`, progress remains at 98 percent while icon and name continue at the 38 ms rate.
- At `T`, an available backend result is revealed immediately. If it is not available, the 38 ms candidate loop continues with progress fixed at 98 until it settles.
- Backend failures follow the existing failure path after the minimum presentation timeline, without showing a false result.

Reduced-motion mode keeps the same network-independent duration and progress semantics while disabling shake and candidate entrance animation.

## Verification

Regression tests verify the wrapper stacking order, positioned scene anchors for all three tree appearances, the 60/40 forge phases, smooth fractional progress writes, acceleration to the fixed high-speed interval, and continued waiting at 98 percent. The full project suite and syntax checks run before release. The published GitHub Pages build is then checked at desktop and mobile widths with screenshots.
