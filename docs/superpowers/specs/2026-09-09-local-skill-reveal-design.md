# Local Skill Reveal Design

Approved by the user after discussion. This supersedes the shared notice and permanent multiplier mark from reward-focus.

- Remove the duplicate permanent multiplier and the entire shared notice, including its empty space/background.
- During each type-1 trigger, replace the current item's name with the brief skill multiplier text. Keep its icon and quantity visible; restore its exact name when the trigger settles or the reveal finishes/cancels.
- Preserve 300ms cue, 500ms old-quantity shake, 500ms new-quantity settling for every trigger. Do not reroll, change quantities, or animate type-2 refunds in this modal.
- Name and skill occupy the same existing layout area. Fit narrow five-column results without clipping, new rows, or moving the footer. Only the active item receives an ink pulse. Short-screen reveal scrolling is confined to the reward body.
- Import the supplied audio source 音频资源/斧技-发动V2.wav using the existing normalization pipeline. Preserve all other media. Give the skill cue priority over that modal's preceding item-reveal tail, without stopping unrelated sounds or BGM.
- Single reward remains one-click 收下; ten rewards retain 显示全部 then 收下. Finish, cancel, hidden and removal restore names and actual quantities and release all effects.
- No screenshots or account writes; verify deterministic behavior, mocked browser geometry/timing and runtime sound bytes before publishing.
