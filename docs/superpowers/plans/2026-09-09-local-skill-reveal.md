# Local Skill Reveal Implementation Plan

> **For agentic workers:** Use isolated collaboration ownership below. The optional subagent-driven-development skill is unavailable; execute the approved plan without another user confirmation.

**Goal:** Keep multiplier feedback beside the affected reward and use the user's new skill sound.

**Architecture:** RewardPresentation owns local text swapping and existing deterministic timings. AudioManager and the normalization script own the new runtime sound. App removes shared-notice calls and changes only affected import cache keys.

**Tech Stack:** Vanilla JavaScript/CSS, PCM WAV normalization, Node tests, mocked Playwright.

## Constraints

- No database/config changes or random calls; preserve unrelated supabase directory and original media.
- No screenshots. Preserve 1300ms triggers, one-click single close, ten-chop skip and original chopping cadence.

## Task 1: Local Reward Presentation

Owner: reward agent. Files: reward-presentation.js/css and reward-reveal/v7-rewards unit and browser tests.

- [ ] Assert one actual quantity, no reward-item-buff/shared notice; name becomes skill label only during its own trigger and is restored on settle/finish/cancel.
- [ ] Swap name content in its existing measured area, fit 320px five-column layouts, preserve quantity stages at +800ms and settle +1300ms. Scroll only the modal body when the active item is clipped.
- [ ] Before skillTrigger, stop only this reveal group's previous cue. Keep API playReveal({audio,onComplete}); remove renderNotice from the renderer and renderResults notice option.
- [ ] Run targeted Node and mocked browser checks for single, ten, long names/multipliers, short screens, scrolling and cleanup.

```js
assert.equal(finalName, originalName);
assert.equal(quantityEvent.at - triggerEvent.at, 800);
assert.equal(settleEvent.at - triggerEvent.at, 1300);
```

## Task 2: New Skill Sound

Owner: audio agent. Files: scripts/normalize_audio.js, audio-manager.js, skill-trigger runtime WAV, audio tests, docs/ASSET_PIPELINE.md audio notes.

- [ ] Inspect source PCM header, duration, peak/RMS and fingerprint. Add a skill-only import option to avoid rewriting other audio.
- [ ] Use the supplied V2 original as normalization input, update source fingerprint and only the changed sound's URL cache key. Preserve independent refund group and mute handling.
- [ ] Run deterministic --check and all audio tests; compare other runtime files byte-for-byte to HEAD.

## Task 3: Integration And Release

Owner: root. Files: app.js, index.html, integration tests, docs/PROJECT_PLAYBOOK.md.

- [ ] Remove renderNotice calls in single and extra result assembly. Update corresponding fixtures. Bump only changed JS/CSS imports, not config/images.
- [ ] Update rules to forbid ambiguous adjacent quantity/multiplier and persistent empty skill slots.
- [ ] Run full Node, Python/image and syntax checks; review independent agents' browser findings and final diff.

Release explicit task files to main, verify Pages success and deployed bytes before reporting completion.
