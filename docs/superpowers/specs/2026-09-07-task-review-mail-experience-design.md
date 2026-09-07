# Task Review, Reward Feedback, and Mail Accordion Design

## Goal

Make task review idempotent, make configured task rewards visible before and after claiming, and let players read mail without leaving the mail list.

## Scope

- Fixed and self-submitted task approval and rejection.
- Task-card reward presentation and post-claim feedback.
- Mail displayed from the header modal and the mail page.
- Existing duplicate test mail remains unchanged.

## Review Architecture

Add one versioned Supabase migration with an atomic task-review RPC. The RPC accepts the selected player role, submission ID, target status, review note, reward configuration, and notification copy. In one transaction it:

1. Updates the matching submission only when its current status is `pending`.
2. Stores the final reward configuration for approved submissions, or clears rewards for rejected submissions.
3. Inserts exactly one notification mail only when the conditional update succeeds.
4. Returns a structured result such as `ok`, `already_reviewed`, or `not_found`.

The browser uses `UI.runLockedAction` for immediate click feedback, then calls the RPC. The database condition is the final concurrency guard, so repeated clicks, delayed responses, or separate browser tabs cannot create duplicate review mail.

## Reward Presentation

Introduce one shared task-reward renderer that understands chopping-count rewards and configured item rewards. Both fixed-task cards and self-submission cards use it.

- Pending or rejected self-submissions do not show a reward block.
- Approved and claimed submissions show every configured reward with icon, name, and quantity.
- Approved submissions show `领取奖励`.
- Claimed submissions retain the reward block and show a disabled `已领取` action.

The existing shared claim path remains the single entry point for fixed and self-submitted tasks. After all configured rewards are granted and player state is refreshed, it displays a compact non-blocking reward bubble containing the same icon/name/quantity list. A generic success message is not shown in place of the reward details.

If reservation or reward delivery fails, no success bubble appears. The existing failure path remains visible and the latest server state is refreshed where applicable.

## Mail Interaction

Replace the current list-to-detail modal transition with a reusable accordion renderer used by both mail surfaces.

- A collapsed row shows unread state, title, date, one-line preview, and attachment status.
- Clicking the row expands the full content in place and marks it read.
- Only one mail is expanded at a time within a surface.
- The expanded area shows full text, item attachments, `领取奖励` when available, `已领取` after claiming, and the existing delete action.
- Buttons stop click propagation so claiming or deleting does not accidentally collapse the row.
- Claiming refreshes the same accordion instead of closing and reopening a separate detail window.
- All mail dates use the shared Shanghai-time formatter.

The accordion styling uses restrained borders, spacing, and a small disclosure indicator. It does not add nested cards or a second modal.

## Data Flow

```text
Admin review click
  -> lock control
  -> atomic review RPC
       -> pending submission becomes approved/rejected
       -> exactly one mail is inserted
  -> refresh review list

Player task list
  -> reads stored submission rewards
  -> displays reward block
  -> guarded claim
  -> grants rewards and refreshes state
  -> displays reward-detail bubble

Player mail list
  -> expand row in place
  -> mark read
  -> optional guarded attachment claim
  -> refresh accordion in place
```

## Error Handling

- A repeated review returns `already_reviewed`, shows a warning, and sends no mail.
- RPC or network failure keeps the review UI available and shows an explicit error.
- Mail read, claim, and delete failures do not optimistically report success.
- Empty or unknown reward items are omitted from the visual list, while valid rewards continue to render.
- Account ownership is enforced with both `user_role` and submission ID in review and mail operations.

## Verification

- Migration tests cover the conditional `pending` update, role ownership, transactional mail insert, and public RPC grant.
- UI tests cover reward visibility for approved/claimed self-submissions and the detailed reward bubble.
- Review tests cover both approve and reject paths using locked controls and the atomic RPC.
- Mail tests cover inline expansion, one-open-at-a-time behavior, no detail modal, in-place refresh, and Shanghai dates.
- Run the full Node suite, JavaScript and Python syntax checks, image validation, and `git diff --check` before release.
