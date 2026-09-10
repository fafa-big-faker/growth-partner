# 天道道具选择与图标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 天道任务奖励按名称选择道具和数量，全部道具展示使用现行共享美术。

**Architecture:** 在现有 AdminView 内共用奖励行渲染、读取与验证方法，应用于新建任务和自主任务审核。选择项读取 ITEMS，图片统一调用 renderItemIcon，GM 同时复用选择项和图片预览。

**Tech Stack:** 原生 JavaScript、HTML select、CSS、Node test + VM 本地夹具。

## Global Constraints

- 仅修改 AdminView 区域、局部样式与专项测试，不修改配置、资源解析、Auth 或真实数据库。
- 用户已授权继续实施，主任务负责最终审查与发布，本子任务不提交。
- 保留主题继承、草稿状态、奖励砍树单独字段、防重提交、失败时表单内容。
- 道具数量必须为安全正整数；重复行合并后仍须安全整数；砍树次数为安全非负整数。
- 选择列表排除砍树次数道具，使用单独砍树字段；GM 保留全部可发放道具。

### Task 1: 奖励选择与现行美术

**Files:** Modify `app.js` AdminView and existing stylesheet; test `tests/admin-reward-picker.test.js`.

**Interfaces:** `_renderRewardEditor(id)` renders an empty list and add button; `_addRewardRow(editor, reward)` appends one independently removable select/quantity row; `_readRewardItems(editor)` returns `{items,error}` with merged `{item_id,quantity}` rewards; `_renderAdminItemOptions(selectedId, includeChopping)` renders escaped type groups with quality labels; `_updateAdminItemPreview(select)` renders the selected item using `renderItemIcon`.

- [x] Add regression cases for empty optional rewards, unknown items, fractional/zero/negative/unsafe quantities, duplicate sums and row deletion.
- [x] Implement row DOM using `data-reward-row`, `.admin-reward-item`, `.admin-reward-quantity`, and local preview span. Use `Number.isSafeInteger(Number(value))` and reject blank required fields.
- [x] Replace new-task and self-review ID text parsers with `_readRewardItems`, preserve local overlay field reads and guarded writes.
- [x] Replace GM emoji inventory cells with `renderItemIcon` and make select text name/quality only. Resolve legacy aliases to the item's canonical ID before rendering all Admin reward/equipment/inventory icons.

### Task 2: Existing workflow regression

**Files:** Modify `tests/theme-task-publishing.test.js`; retain `tests/task-review-atomic.test.js`.

- [x] Update the local form fixture to provide reward rows instead of the removed ID input.
- [x] Assert valid publication merges duplicate rewards once, invalid rows perform zero writes, failed writes retain rows, pending duplicate clicks perform one write, and ongoing theme identity/dates remain inherited.
- [x] Run `node --test tests/admin-reward-picker.test.js tests/theme-task-publishing.test.js tests/task-review-atomic.test.js tests/resource-operation-consistency.test.js tests/coin-icon-rendering.test.js` and `node --check app.js`, then inspect scoped diff. These 39 tests passed; including V5/V6/V7 integration regressions, 46 passed.

## Independent browser validation

`tests/admin-reward-picker.browser-check.cjs` passed at 390×844 and 1440×900. Actual DOM checks covered multiple item types, merged duplicates, removal, no item reward, invalid item/quantity/chopping values, theme inheritance and draft restoration, one write during repeated clicks, null/thrown failure preservation and retry, and decoded GM previews/inventory images including legacy `stone_forge` data. Editors measured 278/368px with no horizontal overflow. No screenshots, external requests, or real database requests were made.
