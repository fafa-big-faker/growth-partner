# Coin Icon Display Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two remaining hard-coded coin emoji displays with the configured image for item ID `0`.

**Architecture:** Reuse the existing `renderItemIcon(itemId, fallbackEmoji, cls)` helper in the two affected HTML templates. Add a Node built-in test that reads the source and locks the expected template calls in place without adding dependencies.

**Tech Stack:** Vanilla JavaScript, HTML template strings, CSS, Node.js built-in test runner.

## Global Constraints

- Do not modify Feishu configuration or Supabase data.
- Do not change prices, selling behavior, or shop purchasing behavior.
- Reuse the existing item ID `0` image and icon rendering helper.
- Verify both normal and realm-locked weapon detail branches.

---

### Task 1: Render the configured coin image in both affected interfaces

**Files:**
- Create: `tests/coin-icon-rendering.test.js`
- Modify: `app.js:2151`
- Modify: `app.js:2156`
- Modify: `app.js:3006`

**Interfaces:**
- Consumes: `renderItemIcon(itemId, fallbackEmoji, cls) -> string` from `app.js`.
- Produces: shop balance and weapon sell-button templates containing item ID `0` image markup.

- [x] **Step 1: Write the failing source regression test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('shop balance uses the configured coin image', () => {
  assert.match(source, /res-icon">\$\{renderItemIcon\('0', '🪙', 'res-coin-img'\)\}/);
  assert.doesNotMatch(source, /res-icon">🪙<\/span><span class="res-val" id="shop-coin-balance"/);
});

test('both weapon sell button branches use the configured coin image', () => {
  const matches = source.match(/出售 \+\$\{renderItemIcon\('0', '🪙', 'item-icon-xs'\)\} \$\{def\.sellPrice\}/g) || [];
  assert.equal(matches.length, 2);
  assert.doesNotMatch(source, /出售 \+\$\{def\.sellPrice\}🪙/);
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `node --test tests/coin-icon-rendering.test.js`

Expected: both tests fail because the affected templates still contain `🪙` directly.

- [x] **Step 3: Replace the hard-coded emoji in `app.js`**

Use this markup for the shop balance icon:

```js
<span class="res-icon">${renderItemIcon('0', '🪙', 'res-coin-img')}</span>
```

Use this content in both weapon sell button branches:

```js
出售 +${renderItemIcon('0', '🪙', 'item-icon-xs')} ${def.sellPrice}
```

- [x] **Step 4: Run automated checks**

Run: `node --test tests/coin-icon-rendering.test.js`

Expected: 2 tests pass.

Run: `node --check app.js`

Expected: exit code 0 with no syntax errors.

- [x] **Step 5: Verify the rendered page**

Start a local static server from the repository root, open the game locally, and inspect the shop balance and a weapon detail dialog at a mobile-sized viewport. Confirm the ID `0` image loads, the price remains correct, button content does not overflow, and there are no related browser console errors.

- [x] **Step 6: Commit the implementation**

```bash
git add app.js tests/coin-icon-rendering.test.js docs/superpowers/plans/2026-09-04-coin-icon-display-fix.md
git commit -m "fix: render coin image in balance and sell price"
```
