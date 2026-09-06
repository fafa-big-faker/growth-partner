# Project Rules

This file is the first source of working rules for every future coding session.
Read `HANDOVER.md`, `docs/PROJECT_PLAYBOOK.md`, and `docs/ASSET_PIPELINE.md` before changing configuration, release flow, or artwork.

## Product Intent

- This is a small cultivation game that helps an introverted university student practice social skills through daily tasks.
- The player experience should feel warm, clear, fresh, and polished. Avoid noisy luxury motifs and dated gold-heavy fantasy styling.
- The user is the game designer, not the programmer. Explain outcomes and any required manual action in plain Chinese.

## Working Rules

- Make reasonable product and UI decisions without repeatedly asking for approval.
- Preserve existing user changes and keep edits scoped to the request.
- If one step produces no material progress for ten minutes, stop, diagnose, and report the exact blocker.
- Do not perform browser visual acceptance unless the user explicitly asks for it.
- Do not modify or reset player data unless the user explicitly requests it.
- Never expose or commit API keys, access tokens, passwords, or credential-bearing remote URLs.

## Configuration

- Feishu sheets are the source of truth. `game-config.js` is generated and must not be edited by hand.
- Row 1 of every configuration sheet contains stable English parameter names; row 2 contains Chinese labels.
- Add new fields to both the sheet header and `sync-config.py`, then run the sync and configuration tests.
- Use header-name lookup and required-field validation. Do not bind new readers to fixed column numbers.
- Keep Supabase schema changes in versioned `supabase-migration-v*.sql` files and make operations atomic when resources are consumed or granted.

## Interaction Safety

- Every delayed resource action must use `OperationGuard` or `UI.runLockedAction`.
- A success message may appear only after the database operation succeeds.
- Multi-resource operations need an atomic RPC or explicit compensation and refresh on failure.
- Inventory redraws must preserve `PlayerView.currentInvTab`.
- Equipped axes are stateful equipment; inventory quantities represent unequipped copies.

## Verification And Release

- Add focused regression tests for behavior changes.
- Run the full Node test suite, JavaScript syntax checks, Python compile checks, sprite validation, and `git diff --check` before release.
- Inspect the diff for secrets and unrelated files before committing.
- Release by pushing the tested commit to `origin/main`; GitHub Pages deploys from that branch.
- Roll back published mistakes with a new revert commit, never by destructive reset of shared history.
