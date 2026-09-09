# Inventory, Reward Feedback, and Login Implementation Plan

> **For agentic workers:** Execute the independently owned tasks below with the available collaboration tools. The optional subagent-driven-development skill is not installed; use explicit file ownership and main-agent integration/review.

**Goal:** Deliver the approved inventory organization, reward feedback and complete login presentation.

**Architecture:** Keep storage and gameplay ownership in app.js; pure ordering and reward metadata are independently testable. Login preparation and reward animation are separate cancellable presentation controllers. Audio assets use the existing normalization pipeline.

**Tech Stack:** Vanilla JavaScript/CSS, Node test runner, mocked Playwright, Python asset validation.

## Global Constraints

- No screenshots or real-player writes. Preserve source audio and unrelated supabase content.
- Preserve weapon identity, inventory amounts, rarity probabilities and original chop/forge timings.
- Do not hand-edit game-config.js. Version only changed scripts/assets.
- Root owns app.js, index.html, inventory layout, documentation and publishing.

## Task 1: Inventory Ordering (Root)

Files: inventory-order.js; app.js; mobile-cultivation.js/css; tests/inventory-order.test.js; local Lucide icons.

- [x] Add tests for numeric type/ID ordering, stable remembered order, unseen append, account isolation and invalid storage.
```js
assert.deepEqual(sortItems([{itemId:'10'},{itemId:'2'}], {'10':{type:2},'2':{type:1}}).map(x=>x.itemId), ['2','10']);
```
- [x] Add createStore({storage,accountId}) with arrange(items, definitions) and order(items); copy arrays and persist only IDs.
- [x] Wire the fixed left control to arrange, render and reset left scroll only. Use licensed lock/arrow-up-down symbols.
- [x] Run focused tests and add mocked sort interaction checks preserving right mode/scroll and new markers.

## Task 2: Reward Metadata and Reveal (Reward Agent)

Files: weapon-affixes.js; reward-presentation.js/css; reward tests. Root integrates app.js.

- [x] Test applyRewardMultipliers output baseQuantity and buffTriggers with real before/after values and unchanged RNG count.
```js
assert.equal(result.baseQuantity, 2);
assert.equal(result.quantity, 6);
assert.equal(result.buffTriggers[0].beforeQuantity, 2);
assert.equal(result.buffTriggers[0].afterQuantity, 6);
```
- [x] Expose RewardPresentation.playReveal(overlay, {audio, onComplete}) returning {finish, cancel}; existing renderer provides data attributes and final values.
- [x] Reserve trigger/refund areas. Sequence ordinary reveals and per-trigger transitions, skip to final values, honor reduced motion and cleanup detached/hidden modals.
- [x] Add deterministic tests for true multipliers, refunds, extras and cancellation plus mocked geometry checks.

## Task 3: Audio Import and Mixing (Audio Agent)

Files: scripts/normalize_audio.js; audio-manager.js; assets/runtime/audio; audio tests.

- [x] Test four named source mappings and PCM properties; preserve original WAV files.
- [x] Add dropRare/dropHigh/rewardReveal/skillTrigger paths, normalize bounded peaks and report measured durations/RMS. Keep old assets unchanged.
- [x] Extend playEffect(name, {group, volumeScale, playbackRate}) and stopEffects(group); limit group polyphony and clear references on ended/error/mute.
```js
await manager.playEffect('rewardReveal', {group:'reward-dialog'});
manager.stopEffects('reward-dialog');
```
- [x] Verify mute, denied playback, cancellation and overlapping sounds with mocked Audio.

## Task 4: Login Readiness (Login Agent)

Files: asset-preloader.js; login-art.js/css; new login-boot.js/css; login tests. Root integrates index.html/app.js.

- [x] Test deduplicated image loading, bounded concurrency, decode, timeout, failure retry and cancellation.
- [x] Expose LoginBoot.start() and whenReady(), gate visible composition until critical art succeeds, support retry and decorative simplified mode. Provide exact required HTML/root integration to main agent.
- [x] Keep the existing logo entrance after readiness; implement brief touch lettering glow without delaying form submit.
- [x] Run mocked cold/warm/failure/mobile checks, no screenshots.

## Task 5: Integration and Publication (Root)

- [x] Wire reward cues at confirmed scene drops; capture multipliers without re-rolling; unify single/ten result reveal and cancel delayed stale single modals.
- [x] Add account-aware ordering and initial game warmup after LoginBoot readiness; optional audio cannot block game entry.
- [x] Add versioned imports and exact image URL preload matching. Update project docs with interfaces and source mappings.
- [x] Run `node --test tests/*.test.js`, all focused mocked browser suites, root JS syntax and Python compile/image tests, then `git diff --check`.
- [ ] Commit explicit task files, push main, verify Pages job and deployed entry/scripts/assets bytes.
