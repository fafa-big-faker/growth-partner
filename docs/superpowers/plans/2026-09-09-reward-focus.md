# Reward Focus Implementation Plan

> **For agentic workers:** Use independently owned collaboration tasks and main-agent integration. The optional subagent-driven-development skill is unavailable in this workspace.

**Goal:** Compact rewards and clearly separate deliberate multiplier reveals from uninterrupted refund feedback.

**Architecture:** Feishu generates the authoritative numeric BUFF type. Frozen weapon skills retain compatibility. RewardPresentation owns result-only type-1 timing; a small separate controller owns transient type-2 button feedback.

**Tech Stack:** Vanilla JavaScript/CSS, Python configuration sync, Node tests, mocked Playwright.

## Global Constraints

- No new art/audio generation, no screenshots, no player-data changes or random rerolls.
- Root owns app.js, index.html, weapon-affixes.js and documentation. Other workers have isolated files below.
- Preserve unrelated untracked supabase directory. Generated game-config.js is only written by sync-config.py.

## Task 1: Configuration (Config Agent)

Files: sync-config.py, generated game-config.js, configuration tests.
- [x] Read current BUFF headers/values through the configured Feishu CLI; add only a missing English type parameter. K1 already contains type.
- [x] Require numeric type 1/2 with header-name lookup and invalid-field tests; sync config without editing values.
```python
assert parse_buff_table(rows)[0]['type'] == 1
```
- [x] Report distribution and configuration tests; preserve other table content. 25 multiplier rows, 25 refund rows; all other values unchanged.

## Task 2: Compact Type-1 Results (Reward Agent)

Files: reward-presentation.js/css, reward tests.
- [x] Test notice at t, shake at t+300, quantity change at t+800 and settle at t+1300 for every trigger; refunds add no result events.
```js
assert.equal(quantityEvent.at - triggerEvent.at, 800);
assert.equal(settleEvent.at - triggerEvent.at, 1300);
```
- [x] Replace per-cell paragraphs with compact multiplier marks; add a fixed shared notice using active item's quality, collapse unnecessary row minimum heights and hide only reward body scrollbar tracks.
- [x] Keep playReveal(overlay,{audio,onComplete}) and finish/cancel interfaces. Prove compact geometry, visible old/new quantities, stable footer and cleanup. Four timing and five layout viewports passed without screenshots.

## Task 3: Button Refund Feed (Feedback Agent)

Files: chop-refund-feedback.js/css, feedback tests.
- [x] Implement ChopRefundFeedback.show(button,count,{audio}) and clear(), with at most four active pointer-transparent rows above the button. New entries move older rows upward; expiry and hiding cancel listeners/timers.
```js
ChopRefundFeedback.show(button, 2, { audio: AudioManager });
ChopRefundFeedback.clear();
```
- [x] Mock repeated accelerated calls without awaiting the controller, verify non-overlap, no document overflow, button clicks unaffected and bounded nodes/audio. Seven unit tests and three browser viewports passed.

## Task 4: Integration (Root)

Files: weapon-affixes.js, app.js, index.html, tests, docs.
- [x] Prioritize explicit numeric type for new skills; add type to frozen rolls and type-1 triggers. Keep old stored effectType compatible, values and RNG calls identical.
- [x] Wire single immediate close versus ten skip/close footer. Show refunds at each confirmed chop using existing timing only; clear alongside existing chop cancellation.
- [x] Version changed imports/config only and update development rules.
- [x] Run full tests and syntax/image/config validation: 380 Node tests, 59 Python checks, 22 root JavaScript files and 16 Python files passed. Mocked reward, refund, shared mobile and forge browser checks passed; no screenshots or player-data writes.

Release the explicit task files to main, then verify Pages and deployed bytes before reporting completion. The authoritative release record is the Pages run attached to the release commit.
