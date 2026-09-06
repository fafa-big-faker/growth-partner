# Game Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the supplied BGM and six sound effects to the static game with resilient playback and a remembered mute control.

**Architecture:** A standalone `audio-manager.js` owns paths, media instances, volumes, persistence, and playback error handling. `app.js` calls its small public API at semantic game events, while one delegated click listener covers ordinary controls without editing every button.

**Tech Stack:** Browser `HTMLAudioElement`, vanilla JavaScript, CSS, Node.js built-in test runner.

## Global Constraints

- Audio playback failure must never block login or a game operation.
- The player dashboard starts looping BGM after a successful login; the admin dashboard does not.
- Muted state is persisted in `localStorage`.
- Do not perform browser visual acceptance unless explicitly requested.

---

### Task 1: Audio manager and assets

**Files:**
- Create: `audio-manager.js`
- Create: `assets/runtime/audio/bgm-main.mp3`
- Create: `assets/runtime/audio/ui-tap.wav`
- Create: `assets/runtime/audio/ui-open.wav`
- Create: `assets/runtime/audio/chop-hit.wav`
- Create: `assets/runtime/audio/item-drop.wav`
- Create: `assets/runtime/audio/forge-process.wav`
- Create: `assets/runtime/audio/forge-success.wav`
- Test: `tests/audio-manager.test.js`

**Interfaces:**
- Produces: `AudioManager.playEffect(name)`, `playBgm()`, `pauseBgm()`, `startLoop(name)`, `stopLoop(name)`, `setMuted(value)`, `toggleMuted()`, `isMuted()`, `preload()`, and `bindControls()`.

- [x] Write tests with fake `Audio` and storage implementations for path mapping, mute persistence, concurrent effects, BGM looping, loop cleanup, and rejected-play resilience.
- [x] Run `node --test tests\audio-manager.test.js` and confirm it fails because the module is absent.
- [x] Implement the standalone manager and copy the seven supplied files without transcoding.
- [x] Run the focused test and confirm it passes.

### Task 2: Game event integration and mute UI

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/audio-integration.test.js`

**Interfaces:**
- Consumes: the `AudioManager` public API from Task 1.
- Produces: semantic audio at login, routing, modal, chop, drop, and forge events plus `.audio-toggle` buttons in both dashboards.

- [x] Write a static integration test that asserts script order, both mute controls, and every semantic trigger.
- [x] Run `node --test tests\audio-integration.test.js` and confirm the assertions fail.
- [x] Load `audio-manager.js` before `app.js`, add accessible icon-only mute buttons, start/pause BGM with authentication, play semantic effects, and bind ordinary control clicks.
- [x] Add stable responsive CSS for the fixed audio control and its muted state.
- [x] Run the focused integration test and confirm it passes.

### Task 3: Regression verification and release

**Files:**
- Modify: `docs/superpowers/plans/2026-09-06-game-audio.md`

**Interfaces:**
- Consumes: completed audio manager and integrations.
- Produces: tested commit pushed to `origin/main`.

- [x] Run `node --test` and require all tests to pass.
- [x] Run `node --check audio-manager.js`, `node --check app.js`, and `git diff --check`.
- [x] Inspect `git status --short` and `git diff` for unrelated files or secrets; leave `supabase/` untracked.
- [x] Mark all plan checkboxes complete, commit only audio-related files, and push `main` to GitHub Pages.
