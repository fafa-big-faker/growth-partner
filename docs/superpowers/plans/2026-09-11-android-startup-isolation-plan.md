# Android Startup Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent optional native audio initialization from causing the Android game entry to report a network failure.

**Architecture:** Keep the JavaScript bridge available from WebView creation, but make its constructor inert. Trigger one asynchronous PCM initialization after the trusted entry page is visible and start or stop its writer according to Activity foreground state.

**Tech Stack:** Android Java, WebView JavaScript bridge, AudioTrack, existing zero-download APK builder.

## Global Constraints

- Preserve package `cn.xianlai.game`, local WebView storage, and the existing signing identity.
- Audio failure must fall back to Web Audio and must never change WebView loading state.
- Release as versionName `1.0.5`, versionCode `6`.

---

### Task 1: Make Native Audio Lazy And Isolated

**Files:**
- Modify: `android-app/app/src/main/java/cn/xianlai/game/NativeAudioBridge.java`
- Modify: `android-app/app/src/main/java/cn/xianlai/game/MainActivity.java`

**Interfaces:**
- Consumes: `NativeAudioBridge(Context)`, Activity foreground callbacks, trusted WebView page callbacks.
- Produces: `initializeAsync()` as an idempotent non-blocking start request.

- [ ] Change the bridge constructor to retain only application context and output properties.
- [ ] Add idempotent background initialization with release-race cleanup.
- [ ] Remember requested foreground state and start the writer only after initialization succeeds.
- [ ] Call `initializeAsync()` from trusted page reveal, never before `loadUrl()`.
- [ ] Compile the Android Java sources through the release builder.

### Task 2: Build And Verify The Repair Release

**Files:**
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/build.gradle`
- Modify: `android-app/README.md`

**Interfaces:**
- Consumes: the unchanged signing configuration and APK output directory.
- Produces: `安卓安装包/xianlai-1.0.5.apk` installable over 1.0.4.

- [ ] Raise versionName to `1.0.5` and versionCode to `6` in both metadata files.
- [ ] Update the Android release notes to describe page-first startup.
- [ ] Run the complete web tests.
- [ ] Build the signed APK and verify navigation tests, PCM tests, DEX, ZIP alignment, package id, permissions, and v2/v3 signing.
- [ ] Record APK size, SHA-256, and certificate SHA-256 for handoff.
