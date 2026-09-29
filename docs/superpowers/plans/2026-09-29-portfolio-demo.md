# Portfolio Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an isolated, reset-on-login portfolio demo with password 888 and a printable QR code.

**Architecture:** A separate in-memory DB adapter handles every DB method on the demo entry. Existing game rules/UI remain shared. A reusable spotlight controller drives both tutorials; a one-time sanitized task snapshot supplies demo content.

**Tech Stack:** Existing vanilla JS/CSS/HTML, Node test runner, local browser functional tests, Python QR generation.

## Global Constraints

- No writes to real player data; no database migrations.
- Do not edit generated game-config.js or rebuild unrelated artwork.
- Demo initial state: level10/realm1/tree14, 999 chops, stone40001×999, 30001/30101/30201×1.
- Default axe51001 equipped; gifted axe51002 has real quality5 frozen affixes.
- Trigger gift tutorial only after first successful ten-chop results are closed.
- Public password888 only on ?demo=1. Never save user passwords.
- No visual acceptance or screenshots. Preserve untracked supabase directory.

### Task 1: Isolated data adapter and fixed task template

**Files:** create demo-session.js, demo-tasks.js, tests/demo-session.test.js, scripts/export_demo_tasks.cjs.

**Interfaces:** `DemoSession.isEntry(search)`, `verify(role,password)`, `createStore({config,affixes,tasks,now})`, `install(DB,{config,affixes,tasks})`, `reset()`, `end()`, `giftId`, `afterTenClosed(equippedId)`.

- [x] Export published live tasks via read-only REST with explicitly selected fields; inspect content and commit only sanitized snapshot.
- [x] Write and run failing tests:
  ```js
  const a = DemoSession.createStore(deps), b = DemoSession.createStore(deps);
  assert.equal(a.getPlayerState().choppingCount, 999);
  a.updatePlayerState({choppingCount: 3});
  assert.equal(b.getPlayerState().choppingCount, 999);
  assert.equal(affixes.getWeaponRating(a.getWeaponInstances()[1]).label, 'SSS');
  ```
- [x] Implement state/inventory/weapons/tasks/submissions/mails/withdrawals/claims with deep-copy reads and positive-quantity validation.
- [x] Implement DB facade wrappers with a hard demo boundary:
  ```js
  if (entry || db.playerRole === 'demo') {
    if (!store || typeof store[name] !== 'function') throw new Error('演示模式不支持该操作');
    return store[name](...args);
  }
  return original.apply(db, args);
  ```
- [x] Test forge/compose/equip/sell/claims, two sessions and unsupported method rejection.

### Task 2: Entry, reset and tutorial integration

**Files:** modify app.js, index.html, first-chop-guide.js; create demo-session.css, demo-guide.js; extend guide tests.

**Interfaces:** custom `FirstChopGuide.start({getTarget,isCurrent,onChop,title,description})`; `DemoGuide.afterTenClosed()` uses adapter's once-per-session gate.

- [x] Add tests for demo eligibility and custom spotlight text, preserving all existing tests.
- [x] Load demo entry detection before the initial loading screen, provide notices and password hint, hide admin controls.
- [x] Login uses demo verifier only on demo URL, resets adapter before Game.init; logout clears store and timers without falling back to real DB.
- [x] Extend spotlight options without changing default titles or geometry; highlight actual weapon cells and equip controls, not cloned elements.
- [x] Attach one-time `_afterClose` callback to first ten results. Schedule after modal removal, check account/version, and chain armory→gift→equip.
- [x] Add explicit local simulation UI for task approvals and annotate simulated withdrawal; keep formal behavior unchanged.
- [x] Verify all affected scripts with node --check and targeted tests.

### Task 3: Functional test, QR and release

**Files:** create tests/demo-session.browser-check.cjs, scripts/build_demo_qr.py, docs/portfolio/仙来-演示二维码.png/svg, docs/portfolio/演示说明.md; update PROJECT_PLAYBOOK.md and script version assertions.

- [x] Run real demo login and progression in mobile/PC local browser, assert no Supabase requests and all initial states reset.
- [x] Verify task reward claim changes inventory once and re-login restores published/unsubmitted state.
- [x] Generate fixed-url QR with local qrcode package; decode generated image with local QR reader to verify exact URL.
- [x] Run full node tests, syntax checks, Python compilation, existing sprite/runtime validators, boot manifest --check and git diff --check.
- [ ] Review diff for unrelated files and credentials; merge tested feature branch into main and push.
- [ ] Confirm Pages deployment matches pushed commit and online files; deliver QR, link, password and reset semantics.

## Verification evidence

- 618 Node tests passed. Runtime asset tests 2/2, character alignment tests 5/5, boot manifest 226 unchanged assets passed.
- Browser checks 320×568, 390×844 and 1440×900: full tutorial chain, forging, explicit simulated review/claim, relogin, reload, two concurrent visitors; zero database requests and zero runtime errors.
- Original live/test first-chop guide regression passed including failures/retries, backgrounding, reduced motion and Android Back.
- QR PNG980×980 verified at native, 256px and160px; printable SVG generated. No source art or configuration edited.
