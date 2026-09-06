# Compose RPC Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore atomic item composition so valid materials consistently produce the configured target item.

**Architecture:** Treat Supabase as the transactional authority. Add an idempotent migration that removes obsolete overloads and recreates the role-aware five-argument RPC, expose actionable client error codes, then verify the deployed function signature before testing one controlled composition.

**Tech Stack:** PostgreSQL, Supabase PostgREST RPC, browser JavaScript, Node test runner.

## Global Constraints

- Composition must consume and grant inventory in one database transaction.
- Support both `player` and `player_live` data roles.
- Never log or commit Supabase credentials.
- Do not report success until the online RPC is deployed and returns success.
- Test data may be used, but do not modify live-player inventory.

---

### Task 1: Capture the Failure Contract

**Files:**
- Modify: `tests/resource-operation-consistency.test.js`
- Create: `tests/compose-rpc-migration.test.js`

**Interfaces:**
- Consumes: `DB.composeInventoryItem()` and the SQL RPC declaration.
- Produces: assertions for five RPC parameters, stale-overload removal, role routing, and useful error propagation.

- [x] Add failing tests for an idempotent five-parameter migration and client error codes.
- [x] Run the focused tests and confirm the missing migration behavior.

### Task 2: Add the Repair Migration

**Files:**
- Create: `upgrade_v9.sql`
- Modify: `app.js`

**Interfaces:**
- Produces: `public.compose_inventory_item(p_user_role text, p_source_item_id text, p_source_quantity integer, p_target_item_id text, p_target_quantity integer) returns jsonb`.

- [x] Drop obsolete four- and five-parameter overloads before recreation.
- [x] Recreate the atomic role-aware implementation and grant execution to `anon` and `authenticated`.
- [x] Preserve PostgREST error details in the client result without exposing credentials.

### Task 3: Deploy and Verify

**Files:**
- Modify only files required by verification findings.

**Interfaces:**
- Consumes: authenticated Supabase project access.
- Produces: the deployed v9 RPC and one successful test-account composition.

- [x] Apply `upgrade_v9.sql` to the configured Supabase project.
- [x] Refresh the PostgREST schema cache and verify the five-argument signature.
- [x] Perform one controlled test-account composition and confirm inventory quantities remain consistent.
- [x] Run focused and full regression tests.
