# Task Review, Reward Feedback, and Mail Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate task-review mail, show configured rewards on task cards and after claiming, and expand mail content inside the existing list.

**Architecture:** A versioned Supabase RPC owns the conditional review update and notification insert in one transaction. A small pure reward module normalizes task rewards for both text and UI rendering, while `app.js` integrates it with the existing task and mail views. Both mail surfaces share one accordion renderer and retain their own expanded-row state.

**Tech Stack:** Supabase PostgreSQL, browser JavaScript, HTML/CSS, Node test runner.

## Global Constraints

- Preserve existing mail and player data; do not delete the two duplicate test messages.
- Enforce account ownership with both `user_role` and record ID.
- Use `UI.runLockedAction` for review and reward buttons.
- Send review mail only when the submission changes from `pending`.
- Show no success state before the database operation succeeds.
- Use the existing item artwork and Shanghai-time formatter.
- Do not perform browser visual acceptance unless explicitly requested.

---

### Task 1: Atomic Task Review and Notification

**Files:**
- Create: `upgrade_v12.sql`
- Create: `tests/task-review-atomic.test.js`
- Modify: `app.js:896-908`
- Modify: `app.js:5095-5200`

**Interfaces:**
- Consumes: `DB.playerRole`, `UI.runLockedAction(key, control, busyText, action)`.
- Produces: `DB.reviewSubmissionOnce(id, status, note, rewardChopping, rewardItems, mailTitle, mailContent) -> Promise<{ok:boolean, code:string}>` and SQL RPC `review_task_submission(TEXT, UUID, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT) -> JSONB`.

- [x] **Step 1: Write the failing migration and integration tests**

Assert that `upgrade_v12.sql` performs an update constrained by `id`, `user_role`, and `status = 'pending'`, inserts mail only after a successful update, and grants the RPC to browser roles. Assert that all three review controls use `UI.runLockedAction` and call `DB.reviewSubmissionOnce` instead of separate update/mail calls.

```js
assert.match(sql, /WHERE id = p_submission_id[\s\S]*user_role = p_user_role[\s\S]*status = 'pending'/);
assert.match(sql, /IF v_submission_id IS NULL THEN[\s\S]*already_reviewed/);
assert.match(sql, /INSERT INTO public\.mails/);
assert.match(app, /DB\.reviewSubmissionOnce/);
assert.doesNotMatch(reviewUi, /await DB\.reviewSubmission\([\s\S]*await DB\.sendMail/);
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `node --test tests\task-review-atomic.test.js`

Expected: FAIL because `upgrade_v12.sql` and `DB.reviewSubmissionOnce` do not exist.

- [x] **Step 3: Add the idempotent review RPC**

Create `upgrade_v12.sql` with input validation, a conditional update, exactly one notification insert, structured error codes, grants, schema reload, and an enclosing transaction.

```sql
UPDATE public.task_submissions
SET status = p_status,
    review_note = COALESCE(p_note, ''),
    reviewed_at = NOW(),
    reward_chopping = CASE WHEN p_status = 'approved' THEN p_reward_chopping ELSE 0 END,
    reward_items = CASE WHEN p_status = 'approved' THEN p_reward_items ELSE '[]'::JSONB END
WHERE id = p_submission_id
  AND user_role = p_user_role
  AND status = 'pending'
RETURNING id INTO v_submission_id;

IF v_submission_id IS NULL THEN
  RETURN jsonb_build_object('ok', false, 'code', 'already_reviewed');
END IF;

INSERT INTO public.mails (user_role, title, content, items)
VALUES (p_user_role, p_mail_title, p_mail_content, '[]'::JSONB);
```

- [x] **Step 4: Route all approve and reject actions through the RPC**

Add `DB.reviewSubmissionOnce`, then wrap self-approval, fixed approval, and rejection controls with stable keys such as `task-review:${id}`. On `already_reviewed`, show `该任务已处理，请刷新查看`; on a network error, show `审核未完成，请重试`; close the dialog and refresh only after `ok: true`.

- [x] **Step 5: Run focused tests**

Run: `node --test tests\task-review-atomic.test.js tests\operation-guard.test.js tests\resource-operation-consistency.test.js`

Expected: all tests pass.

### Task 2: Shared Task Reward Display and Claim Bubble

**Files:**
- Create: `task-rewards.js`
- Create: `tests/task-rewards.test.js`
- Modify: `index.html:117-128`
- Modify: `app.js:3474-3549`
- Modify: `app.js:3723-3778`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `{rewardChopping:number, rewardItems:Array<{item_id:string, quantity:number}>}`, `ITEMS`, and `renderItemIcon`.
- Produces: `TaskRewards.getEntries(source, itemDefinitions) -> Array<{itemId:string, quantity:number, name:string, icon:string}>`, `TaskRewards.formatText(entries) -> string`, `renderTaskRewardChips(source, className) -> string`, and `UI.showRewardBubble(entries)`.

- [x] **Step 1: Write failing reward tests**

Cover chopping count, game currency, regular items, invalid quantities, empty rewards, and a self-submission whose approved and claimed cards both retain reward markup.

```js
assert.deepEqual(getEntries({
  rewardChopping: 3,
  rewardItems: [{ item_id: '0', quantity: 100 }, { item_id: '40001', quantity: 1 }],
}, definitions), [
  { itemId: '1', quantity: 3, name: '砍树次数', icon: 'chop' },
  { itemId: '0', quantity: 100, name: '游戏币', icon: 'coin' },
  { itemId: '40001', quantity: 1, name: '锻造石', icon: 'stone' },
]);
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `node --test tests\task-rewards.test.js`

Expected: FAIL because `task-rewards.js` is missing.

- [x] **Step 3: Implement the pure reward normalizer**

Normalize positive integer quantities, prepend chopping-count rewards as item ID `1`, preserve configured order, and omit unknown item IDs.

```js
function getEntries(source, itemDefinitions) {
  const entries = [];
  append(entries, '1', source?.rewardChopping, itemDefinitions);
  for (const reward of source?.rewardItems || []) {
    append(entries, String(reward.item_id), reward.quantity, itemDefinitions);
  }
  return entries;
}
```

- [x] **Step 4: Use one renderer on fixed and self-submission cards**

Load `task-rewards.js` before `app.js`. Render labeled reward chips for fixed tasks and for approved/claimed self-submissions. Keep claimed rewards visible and render a disabled `已领取` button.

- [x] **Step 5: Add detailed post-claim feedback**

Add `UI.showRewardBubble(entries)` that creates one accessible, auto-dismissed bubble in `#toast-container`, with item art, name, and quantity. Call it only after every grant succeeds and `Game.refresh()` completes.

```js
const entries = TaskRewards.getEntries(sub, ITEMS);
await Game.refresh();
UI.showRewardBubble(entries);
this._renderTaskList();
```

- [x] **Step 6: Run focused tests**

Run: `node --test tests\task-rewards.test.js tests\coin-icon-rendering.test.js tests\resource-operation-consistency.test.js`

Expected: all tests pass.

### Task 3: Reusable Inline Mail Accordion

**Files:**
- Create: `tests/mail-accordion.test.js`
- Modify: `app.js:4047-4088`
- Modify: `app.js:4190-4323`
- Modify: `styles.css:1118-1158`

**Interfaces:**
- Consumes: `DB.getMails()`, `DB.markMailRead(id)`, `DB.claimMail(id)`, `DB.deleteMail(id)`, `GameDateTime.formatShanghaiDate(value)`.
- Produces: `PlayerView._mailSurfaces`, `PlayerView._renderMailAccordion(surface)`, `PlayerView.toggleMail(mailId, surface)`, and `PlayerView._refreshMailSurface(surface, expandedId)`.

- [x] **Step 1: Write failing accordion tests**

Assert that both mail entry points call the shared renderer, row clicks call `toggleMail`, full content is rendered in an inline `.mail-expanded` region, only one expanded ID exists per surface, all dates use `GameDateTime`, and the removed `openMail` path no longer creates a detail modal.

```js
assert.match(app, /_renderMailAccordion\('modal'\)/);
assert.match(app, /_renderMailAccordion\('page'\)/);
assert.match(app, /class="mail-expanded"/);
assert.doesNotMatch(app, /async openMail\(mailId\)/);
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `node --test tests\mail-accordion.test.js`

Expected: FAIL because the mail list still opens a second modal.

- [x] **Step 3: Add shared surface state and rendering**

Store each surface as `{ container, mails, expandedId }`. Render a button-like summary row and conditionally render the full body, attachments, status, claim action, and delete action beneath it. Use `aria-expanded` and keep the disclosure indicator decorative.

- [x] **Step 4: Toggle and mark read in place**

On row click, close the previously expanded row, expand the selected row, mark it read once, update the local model, rerender the same container, and refresh the unread badge without fetching a second detail view.

- [x] **Step 5: Keep claim and delete inside the accordion**

Pass the surface name through claim/delete handlers, stop event propagation on action buttons, check database results before success, and refresh the same surface with the current row expanded. Do not close every modal or call `showMailModal()` as a navigation mechanism.

- [x] **Step 6: Add polished accordion styles**

Use stable spacing and dimensions, a subtle expanded background and border, multi-line content with `white-space: pre-wrap`, clear focus-visible states, and responsive attachment wrapping. Avoid nesting decorative cards inside each mail row.

- [x] **Step 7: Run focused tests**

Run: `node --test tests\mail-accordion.test.js tests\date-time.test.js tests\operation-guard.test.js`

Expected: all tests pass.

### Task 4: Database Apply, Full Verification, and Release

**Files:**
- Modify: `docs/superpowers/plans/2026-09-07-task-review-mail-experience-plan.md` (mark completed steps)

**Interfaces:**
- Consumes: tested `upgrade_v12.sql` and the linked Supabase CLI session.
- Produces: deployed database RPC and GitHub Pages release.

- [x] **Step 1: Apply and verify the migration**

Run: `npx --yes supabase db query --linked --file upgrade_v12.sql`

Then use read-only REST/CLI queries to confirm the RPC is exposed and existing task submissions and mail counts remain intact.

- [x] **Step 2: Run the complete verification suite**

Run:

```bat
node --test tests\*.test.js
node --check app.js
node --check task-rewards.js
node --check date-time.js
python -m py_compile sync-config.py scripts\split_axe_sheets.py scripts\split_idle_axe_sheets.py scripts\split_character_sheets.py scripts\build_runtime_images.py
python tests\runtime-image-assets.test.py
python tests\character-frame-alignment.test.py
git diff --check
```

Expected: all tests and syntax checks pass with no diff errors.

- [x] **Step 3: Inspect and commit only scoped files**

Exclude the untracked `supabase/` CLI directory. Inspect for credentials and unrelated changes, then commit the implementation and completed plan.

- [x] **Step 4: Push and verify deployment**

Push `main`, confirm `origin/main` matches local `HEAD`, and verify the GitHub Pages workflow completes successfully. Do not perform browser visual acceptance.
