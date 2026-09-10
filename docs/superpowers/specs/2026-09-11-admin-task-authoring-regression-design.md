# Admin Task Authoring Regression Design

## Goal

Restore convenient theme reuse and make every unpublished task in the publishing pool visibly editable without weakening the new formal/test environment boundary.

## Cause

The edit implementation is still present. The theme selector, however, only includes published themes whose date range contains today. On 2026-09-11 the formal theme `开学季·开工咯` starts on 2026-09-12, while the test copy is still a draft. Both are therefore excluded even though each is a valid theme for additional tasks in its own environment.

## Design

Build reusable themes from both draft and published theme tasks in the current account environment. Include themes that are currently active or start in the future, exclude themes whose end date has passed, group same-name rows into one choice, and label choices as `进行中` or `即将开始`.

Selecting an existing theme copies and locks its name and date range. Saving validates that the selected theme still exists and has not ended. It never reads or writes a theme from the other environment.

Every task whose current status is `draft` shows an `编辑` action in all task-management filters. Editing performs a fresh strict read in the active environment, preserves the UUID and publishing-pool status, and updates the same row. Published tasks remain non-editable until withdrawn to the publishing pool.

## Verification

Regression tests cover upcoming published themes, upcoming draft themes, exclusion of expired themes, environment-scoped reads, selector labels, selected-theme validation, and edit actions for every draft while excluding published rows.
