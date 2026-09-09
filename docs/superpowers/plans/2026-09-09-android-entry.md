# Android Entry Implementation Plan

> **For agentic workers:** Execute the already approved approach using bounded independent subtasks. No duplicate approval. Optional superpowers subagent implementation package is not installed; use available collaboration tools.

**Goal:** Polish web touch interaction, deliver an icon generation brief and prepare a reproducible Android shell without changing player data.

**Architecture:** A small delegated-event module and stylesheet own browser-native selection/drag exceptions. A separate native Android project loads the current HTTPS game and owns only app lifecycle/navigation. Existing Supabase and release flow remain unchanged.

**Tech Stack:** Vanilla JS/CSS, Node tests, Android Java/WebView and available Android build tools.

## Global Constraints

- Preserve user files and unrelated untracked supabase/; no player writes or screenshots.
- Keep text input, clipboard, scrolling, keyboard focus and browser pinch zoom usable.
- No paid image generation; provide one square icon prompt and reuse the current icon until replacement.
- Application updates preserve applicationId/signing identity; secrets remain outside the repository.
- Pause/report any step with no material progress for ten minutes.

## Task 1: Web interaction (root)

Files: web-interactions.js, web-interactions.css, index.html, tests/web-interactions.test.js.

- [x] Implement createController({document}) with init/destroy; contextmenu, dragstart and selectstart event delegation scoped to game roots. Editable controls and data-native-interaction bypass the guards.
- [x] CSS applies user-select:none and touch-callout:none to game surfaces, text/default exceptions to editable controls, user-drag:none to images and touch-action:manipulation to actual controls. Do not register pointermove/touchmove handlers or change viewport zoom.
- [x] Load both modules via index.html with android-entry-20260909 cache keys; JS initializes after body markup and before game app. Dynamic nodes work without mutation observers.
- [x] Tests dispatch cancelable events on nested game images/text, form children and explicit native exceptions; assert prevention only for game surfaces and zero listeners after destroy. Reinitialization remains idempotent. Inspect scroll/pointer behavior with local mocked browser checks if needed.

## Task 2: Icon brief (root)

Files: docs/art-prompts/仙来-应用图标.md.

- [x] Provide Chinese1024x1024 1:1 prompt with jade-white opaque background, strong central calligraphic仙, a small cinnabar accent and adaptive-icon-safe central area. Avoid baked rounded corners, tiny UI ornament, metallic bevels, excess gold or a collage.
- [x] State exact replacement input/output and reuse current artwork for preparation; no new logo generation cost.

## Task 3: Android preparation (android_prepare)

Files: android-app/ and an independent build/release guide; no root game-file edits.

- [x] Inventory JDK, SDK and Gradle with bounded read-only checks; report available approach before downloading tools.
- [x] Build a small native WebView entry for https://fafa-big-faker.github.io/growth-partner/, name仙来, fixed applicationId, existing icon. Configure HTTPS-only game navigation, external link handling, startup/retry/offline screen, and back/pause/resume behavior without a native JS bridge.
- [x] Document deterministic build commands and prerequisite versions. Keep signing material out of git, preserve the identity for future upgrades. Compile and create an APK when local tools allow, otherwise report exact missing component with buildable source.
- [x] Verify package metadata, application entry and installed/build tooling behavior proportionally; no claims of device validation without actual device/emulator evidence.

## Task 4: Release (root)

- [x] Review exception guards, Android code and secrets; full Node tests, Python suites, JS/Python syntax and diff-check.
- [ ] Explicitly stage task files only; publish web update, verify matching Pages and changed source bytes. Deliver icon prompt, Android output/preparation state and explain account data persists with same backend/account.
