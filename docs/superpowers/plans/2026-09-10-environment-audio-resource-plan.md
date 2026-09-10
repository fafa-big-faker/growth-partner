# Environment, Native Audio And Resource Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate task publishing by account environment, eliminate Android short-sound latency, and remove the current full resource download from first App launch while reducing browser startup work.

**Architecture:** Add one database audience boundary used by every task CRUD path. Keep browser Web Audio but route Android effects through a constrained native SoundPool bridge. Generate an exact APK asset manifest from the web boot manifest, serve matching assets locally, and let mismatches fall through to the existing verified network cache; split boot assets so unused axe animations are deferred.

**Tech Stack:** Static JavaScript, Supabase/PostgreSQL, Android Java/SoundPool/WebView, Node test runner, JVM assertions, existing zero-download Android builder.

## Global Constraints

- Preserve player data and all current audio/art files.
- Current 4 tasks become `player_live` and are copied once to `player`; historical submissions remain untouched.
- APK remains `cn.xianlai.game`, Android 8+, same release signature; version becomes 1.0.3/code 4.
- Old APK and all browsers retain functional fallbacks.
- GitHub push is not release completion until Pages succeeds and online bytes match.

---

### Task 1: Isolate published tasks by environment

**Files:**
- Create: `supabase-migration-v14.sql`
- Modify: `app.js`
- Create: `tests/task-environment.test.js`

**Interfaces:**
- Consumes: `DB.playerRole` (`player` or `player_live`).
- Produces: every `xiu_tasks` query filtered by `audience_role`; idempotent v14 migration.

- [x] Add failing tests asserting the v14 constraint/backfill/one-time clone and role predicates on all task CRUD methods.
- [x] Run `node --test tests/task-environment.test.js` and confirm failure.
- [x] Implement the SQL migration and exact `.eq('audience_role', this.playerRole)`/insert field boundaries.
- [x] Run focused task/admin tests; the full suite remains in the release gate.
- [x] Apply v14 to the linked Supabase project and perform read-only counts: migration-time data produced 5 live and 5 test tasks with distinct UUIDs.
- [x] Commit the isolated database/web change.

### Task 2: Route Android short effects through SoundPool

**Files:**
- Create: `android-app/app/src/main/java/cn/xianlai/game/NativeAudioBridge.java`
- Modify: `android-app/app/src/main/java/cn/xianlai/game/MainActivity.java`
- Modify: `audio-manager.js`
- Modify: `tests/audio-web.test.js`
- Create: `tests/native-audio-bridge.test.js`

**Interfaces:**
- Consumes: the existing 12 non-BGM keys in `AUDIO_PATHS`.
- Produces: `window.XianlaiNativeAudio.isReady/play/stop/stopAll`; `AudioManager.usesNativeEffects()`.

- [ ] Add failing web contract tests for native priority, safe argument bounds, group cancellation, loops, mute/background and Web Audio fallback.
- [ ] Add static/native source tests for the exact whitelist and absence of URL/file/network bridge methods.
- [ ] Run the focused tests and confirm failure.
- [ ] Implement `NativeAudioBridge` with `SoundPool.Builder`, `USAGE_GAME`, a fixed key-to-bundled-asset map and lifecycle release.
- [ ] Register the bridge only on the trusted WebView and release it on Activity destruction.
- [ ] Implement the AudioManager native proxy without changing BGM, mix values or public call sites.
- [ ] Run web audio, app shell, Java compilation and Android build tests.
- [ ] Commit native low-latency audio.

### Task 3: Bundle exact web assets and defer unused animations

**Files:**
- Modify: `scripts/build_boot_assets.cjs`
- Modify: `boot-assets.js` (generated)
- Modify: `resource-pack.js`
- Create: `android-app/app/src/main/java/cn/xianlai/game/BundledAssetStore.java`
- Modify: `android-app/app/src/main/java/cn/xianlai/game/MainActivity.java`
- Modify: `android-app/build-android.cjs`
- Modify: `app.js`
- Modify: `login-boot.js`
- Modify: `tests/resource-pack.test.js`
- Modify: `tests/entry-preparation.browser-check.cjs`
- Create: `tests/android-bundled-assets.test.js`

**Interfaces:**
- Consumes: boot entries `{url,bytes,sha256,kind,density,phase}`.
- Produces: native `hasAsset(url,bytes,sha256)` and exact local request responses; public boot excludes deferred axe frames.

- [ ] Add failing manifest tests for public/deferred phase metadata and no 90-frame public boot requirement.
- [ ] Add failing resource-pack tests proving native-exact entries complete locally while changed entries use the existing fetch/verify/cache path.
- [ ] Add failing Android packaging tests for one manifest entry per bundled payload, exact hashes and trusted-path-only interception.
- [ ] Implement generated phase metadata and keep current hash/size verification.
- [ ] Implement native asset staging and exact mapping generation in the Android builder.
- [ ] Implement `BundledAssetStore` and `shouldInterceptRequest` local responses with network fallthrough.
- [ ] Update login/resource preparation to skip deferred entries and load only the authenticated current scene/axe before reveal.
- [ ] Run cold/warm browser checks, ensuring no real accounts or database writes.
- [ ] Commit resource delivery changes.

### Task 4: Build, migrate, release and verify

**Files:**
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/build.gradle`
- Modify: `android-app/README.md`
- Modify: `docs/PROJECT_PLAYBOOK.md`
- Output outside repository: `../安卓安装包/xianlai-1.0.3.apk`, checksum and build record.

**Interfaces:**
- Consumes: Tasks 1-3 tested commits and the existing signing identity.
- Produces: published Pages commit and signed upgrade APK.

- [ ] Set versionName 1.0.3/versionCode 4 in both Android declarations.
- [ ] Run all Node tests, Python tests, JS/Python syntax, asset/sprite verification and `git diff --check`.
- [ ] Build with `node android-app/build-android.cjs`; verify signature continuity, v2/v3 signing, ZIP alignment, package ID and Internet-only permission.
- [ ] Inspect staged diff for credentials and unrelated files; preserve untracked `supabase/`.
- [ ] Commit documentation/version outputs, push `main`, wait for the exact Pages SHA and compare online changed files byte-for-byte.
- [ ] Report APK path/size/checksum, web URL, migration counts, browser measured request reduction, and the two remaining real-device checks.
