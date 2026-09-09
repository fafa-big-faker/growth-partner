# Unified Cultivation Layout

The user requested the current phone layout on desktop too, fixed-size navigation and equipment surfaces when entering fullscreen, art prompts, and centered reward confirmation labels. Continue the approved direct implementation workflow without another approval gate.

## Decision

Use the existing dual-column controller on all browser widths. Keep its file and CSS class names for compatibility rather than duplicating a desktop layout. The physical `isMobile()` media query remains available; new `isEnabled()` identifies the shared layout.

Keep the centered game area at most 620px wide. Item inventory occupies three fifths, current equipment or the weapon library two fifths. The same cultivation, task, shop, and center-return controls are used everywhere. Additional screen height belongs to the scene, not to paper artwork or equipment.

Phone inventory height is 224px; short portrait uses 180px, and desktop uses 280px. Slot proportions and weapon artwork stay bounded. Short windows scroll the main area above the persistent controls. The navigation interaction area is 124px (112px short portrait); its paper is exactly 72px (64px short portrait). Device safe-area padding sits below the paper, never stretches the image.

The existing return icon remains until the user's new art is supplied. Provide one transparent 1:1 arrow prompt and one aligned empty/full experience-bar atlas prompt, with actual runtime dimensions and filenames. Do not generate or bill for images.

Center reward footer text inside its existing button without changing reward quantities, timelines, or footer availability. Do not touch accounts, data, configuration, or credentials.

## Acceptance

- Desktop uses the same dual inventory, library mode and center navigation as mobile.
- Height-only resize and actual fullscreen entry/exit keep the dock paper, weapon pane, character and weapon dimensions unchanged.
- Both scroll positions, weapon UUID identity, action guards, and accessible keyboard controls remain intact.
- Text Range center matches confirmation button center, including short-screen ten-reward results.
- Run mock browser geometry/events without screenshots or real logins. Verify the deployed commit and actual published code.
