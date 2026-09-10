# Admin Task Authoring Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore reusable current/upcoming themes and reliable draft editing inside each isolated account environment.

**Architecture:** Derive reusable themes from the already environment-scoped task list, include both draft and published non-expired theme rows, and preserve strict environment-scoped mutation. Keep editing limited to fresh `draft` rows and make the action visible in every filter that displays one.

**Tech Stack:** Static JavaScript, Supabase/PostgreSQL queries already present in `DB`, Node test runner.

## Global Constraints

- Never combine `player` and `player_live` tasks.
- Include ongoing and upcoming themes; exclude ended themes.
- Include themes represented only by a draft task.
- Only draft tasks are editable; published tasks must first be withdrawn.
- Preserve task UUID, environment, status, order, and existing submissions.

---

### Task 1: Reproduce and fix theme reuse

**Files:**
- Modify: `app.js`
- Modify: `tests/admin-task-edit.test.js`

**Interfaces:**
- Consumes: `DB.getAllTasks()` results already scoped by `DB.playerRole`.
- Produces: reusable theme entries with `name`, `start`, `end`, `periods`, and `state` (`ongoing` or `upcoming`).

- [x] Add failing tests for upcoming published themes, draft-only themes, expired exclusion, grouping, selector labels, and save-time non-expired validation.
- [x] Run `node --test tests/admin-task-edit.test.js` and confirm the new assertions fail.
- [x] Broaden the theme collector and update selector copy and validation without adding a cross-environment query.
- [x] Run admin edit and task environment tests.
- [x] Commit the theme reuse fix.

### Task 2: Lock in publishing-pool editing and release

**Files:**
- Modify: `tests/admin-task-edit.test.js`
- Modify: `index.html`
- Modify: `docs/PROJECT_PLAYBOOK.md`

**Interfaces:**
- Consumes: task rows with exact `status` and the existing `showEditTask` strict reload.
- Produces: one visible edit action for every displayed draft and cache-busted web delivery.

- [x] Extend the list test across all/draft/theme/daily/weekly filters and assert every displayed draft has an edit action while published tasks do not.
- [x] Verify fresh reads and updates retain `.eq('audience_role', this.playerRole)` and `.eq('status', 'draft')`.
- [x] Bump the `app.js` delivery version so installed and browser clients cannot retain the pre-fix authoring UI.
- [x] Run the full Node suite, syntax checks, and `git diff --check`.
- [x] Commit, push `main`, wait for the exact Pages SHA, and compare changed online files byte-for-byte.
