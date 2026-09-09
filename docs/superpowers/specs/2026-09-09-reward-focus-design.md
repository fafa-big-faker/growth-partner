# Reward Focus Revision

This implements the user's six explicit revisions to the released reward presentation. No new artwork, audio generation, player-data reset or probability changes.

- Single-chop footer reads 收下 from its first frame; clicking cancels presentation and closes immediately. Ten-chop footer reads 显示全部 during presentation and 收下 afterward.
- Keep scrolling in reward bodies but hide their scrollbar tracks in all engines and remove the reserved scrollbar gutter.
- Keep ten regular slots as 5+5 and extra rewards centered. Tighten vertical gaps and eliminate per-cell multiline skill/refund paragraphs. Final multiplier marker is short, while the currently triggered skill uses a reserved one-line shared notice above the footer. Footer geometry remains stable.
- Every type-1 trigger receives 1300ms: notice/audio and 300ms hold, old quantity shakes for 500ms without changing, then new quantity enlarges and settles over 500ms. Next item waits until the entire event completes. No shortened later triggers. Keep actual trigger chain, cancellation, reduced-motion behavior and one-key reveal.
- BUFF configuration type 1 means reward multiplier; type 2 means chop refund. Read the English type header from Feishu and store numeric type in newly rolled skills. Existing instance values and effectType remain compatible and are not re-rolled or rewritten.
- Type-2 triggers no longer animate or produce per-item text in reward results. At each confirmed chop, display 斧技发动：返还X次 above the chop button without awaiting it. Repeated entries push older entries upward; cap active messages, preserve the chop timeline, mute controls and pointer pass-through. Clear on navigation/logout/hidden document.
- Verify full Node tests, configuration parsing and mocked browser geometry/timing. No screenshots, no real player mutations. Publish explicit files and verify deployed bytes.
