# Random Weapon Affixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship independent axe instances with permanent, weighted random skill values generated during forging.

**Architecture:** Feishu remains the static source of skill and BUFF definitions. A focused `weapon-affixes.js` module validates ranges, rolls BUFF rows, formats instance descriptions, and evaluates effects; Supabase persists individual instances and performs forge/equip/sell mutations atomically through versioned RPCs.

**Tech Stack:** Feishu Sheets CLI, browser JavaScript, PostgreSQL/Supabase RPCs, Node test runner, CSS.

## Global Constraints

- Do not edit generated `game-config.js` by hand.
- Keep stackable materials in `inventory`; never aggregate weapon instances.
- Generate skill strength only once, when the weapon instance is created.
- Preserve existing player data during migration.
- Do not perform browser visual acceptance unless explicitly requested.

---

### Task 1: Synchronize The New BUFF Configuration

**Files:**
- Modify: `sync-config.py`
- Generated: `game-config.js`
- Test: `tests/reward-config-consistency.test.js`

**Interfaces:**
- Consumes: BUFF headers `id`, `buff_id`, `buff_quality`, `buff_description`, `params_type_desc`, `effect_desc`, `value1_range`, `value2_range`, `value3_range`, `weight`.
- Produces: `GAME_CONFIG.buffTable` rows with camelCase equivalents and `getSkillById(skillId).buffs`.

- [ ] **Step 1: Add failing configuration assertions**

Assert header-based skill and BUFF reads, all ten required BUFF fields, and grouped BUFF lookup.

- [ ] **Step 2: Add the missing English headers in Feishu**

Write the ten stable names to `BUFF表!A1:J1`, preserving all row 2 labels and data.

- [ ] **Step 3: Update and run the sync**

Replace fixed columns and obsolete `buffParams` with header lookup, then regenerate `game-config.js`.

- [ ] **Step 4: Run focused tests**

Run `node --test tests/reward-config-consistency.test.js` and confirm it passes.

### Task 2: Add Deterministic Affix Domain Logic

**Files:**
- Create: `weapon-affixes.js`
- Modify: `index.html`
- Test: `tests/weapon-affixes.test.js`

**Interfaces:**
- Produces: `WeaponAffixes.rollSkills(skillIds, random)`, `WeaponAffixes.formatSkill(skillRoll, qualityTable)`, `WeaponAffixes.applyRewardMultipliers(drop, rolls, random)`, and `WeaponAffixes.rollRefund(rolls, random)`.

- [ ] **Step 1: Write tests for weighted groups and ranges**

Cover the five weight boundaries, fixed values, inclusive integer ranges, two-decimal probability ranges, and independent two-skill rolls.

- [ ] **Step 2: Implement the module**

Validate every selected group, store BUFF row ID/quality and frozen values, format safe tokenized text, and evaluate the two current effect families.

- [ ] **Step 3: Run domain tests**

Run `node --test tests/weapon-affixes.test.js` and confirm all cases pass.

### Task 3: Persist Independent Weapon Instances

**Files:**
- Create: `upgrade_v10.sql`
- Modify: `app.js`
- Test: `tests/weapon-instance-migration.test.js`

**Interfaces:**
- Produces: table `weapon_instances`; column `player_state.axe_instance_id`; RPCs `forge_weapon_instance`, `equip_weapon_instance`, and `sell_weapon_instance`.
- Client DB methods return `{ id, itemId, skillRolls, createdAt }` weapon objects.

- [ ] **Step 1: Write migration contract tests**

Assert idempotent schema creation, ownership checks, row locking, atomic material consumption, instance insert, equip swap, and sale credit.

- [ ] **Step 2: Write the migration**

Create the instance table and RPCs, migrate aggregate axes into one row per quantity, and preserve the equipped item ID compatibility field.

- [ ] **Step 3: Add DB instance methods**

Read instances separately and call the three RPCs without client-side compensation chains.

- [ ] **Step 4: Run migration tests**

Run `node --test tests/weapon-instance-migration.test.js` and confirm it passes.

### Task 4: Convert Forge, Equip, Sell, And Inventory To Instances

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/weapon-detail.test.js`
- Test: `tests/forge-reveal.test.js`
- Test: `tests/resource-operation-consistency.test.js`

**Interfaces:**
- Consumes: `WeaponAffixes` domain APIs and DB weapon instance methods.
- Produces: `Game.weapons`, `Game.equippedWeapon`, and instance-ID UI actions.

- [ ] **Step 1: Update failing UI and behavior tests**

Assert duplicate item IDs render independently, actions pass instance IDs, and forge result data comes from the created instance.

- [ ] **Step 2: Convert game state and forge flow**

Roll skills before the atomic forge RPC, refresh instances after success, and return the created instance to the existing reveal UI.

- [ ] **Step 3: Convert equipment and sale flows**

Pass instance IDs through detail, forge-result equip, equip, and sell actions while preserving `OperationGuard` behavior.

- [ ] **Step 4: Render instance skill values**

Wrap substituted values with BUFF-quality classes and keep surrounding text neutral.

- [ ] **Step 5: Run focused tests**

Run the three affected test files and confirm they pass.

### Task 5: Use Frozen Affixes During Chopping

**Files:**
- Modify: `app.js`
- Test: `tests/weapon-affixes.test.js`
- Test: `tests/gameplay-rules.test.js`

**Interfaces:**
- Consumes: `Game.equippedWeapon.skillRolls` and `WeaponAffixes` evaluators.
- Produces: single-chop and ten-chop results using frozen strength values.

- [ ] **Step 1: Add runtime regression assertions**

Assert chopping reads instance rolls, never generates new ranges, and applies multiple skills independently.

- [ ] **Step 2: Replace static item BUFF evaluation**

Use the equipped instance for multiplier and refund checks in both chop paths.

- [ ] **Step 3: Run gameplay tests**

Run the affix and gameplay suites and confirm they pass.

### Task 6: Verify, Migrate, And Release

**Files:**
- Modify: `docs/PROJECT_PLAYBOOK.md`

**Interfaces:**
- Produces: deployed configuration, database schema, and GitHub Pages release.

- [ ] **Step 1: Run all static and automated checks**

Run the full Node suite, JavaScript syntax checks, Python compile checks, sprite validation, and `git diff --check`.

- [ ] **Step 2: Inspect the release diff**

Confirm no credentials, temporary Supabase files, or unrelated changes are staged.

- [ ] **Step 3: Apply `upgrade_v10.sql`**

Apply the idempotent migration to the linked Supabase project and verify the new RPCs are visible.

- [ ] **Step 4: Commit and push**

Commit only the feature files and push `main`; GitHub Pages deploys from that branch.
