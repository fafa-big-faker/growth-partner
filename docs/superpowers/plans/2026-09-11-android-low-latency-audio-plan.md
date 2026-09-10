# Android Low-Latency Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace queued Android short-effect playback with a device-rate, continuously warm low-latency PCM output stream.

**Architecture:** Decode bundled PCM16 WAV cues into device-rate stereo buffers, mix active voices in memory, and continuously feed an Android `AudioTrack` configured for low latency while the activity is foregrounded. Preserve the existing JavaScript contract and Web Audio fallback.

**Tech Stack:** Java 8, Android API 26 `AudioTrack`, static JavaScript bridge, Node test runner, standalone JVM tests, existing zero-download APK builder.

## Global Constraints

- Preserve every public audio-manager call site and all browser behavior.
- BGM remains web-managed; only the 12 short effects use native PCM mixing.
- Keep application ID `cn.xianlai.game`, Android 8+, existing signing identity, and Internet-only permission.
- Release as versionName 1.0.4/versionCode 5.
- Do not claim success until the user tests acoustic latency on the affected phone.

---

### Task 1: Add deterministic PCM decoding and mixing

**Files:**
- Create: `android-app/app/src/main/java/cn/xianlai/game/PcmWave.java`
- Create: `android-app/app/src/main/java/cn/xianlai/game/PcmMixer.java`
- Create: `android-app/tests/PcmAudioTest.java`
- Modify: `android-app/build-android.cjs`

**Interfaces:**
- Consumes: PCM16 RIFF/WAVE input streams and a target sample rate.
- Produces: `PcmWave.read(InputStream,int)` stereo samples and `PcmMixer.play/stop/stopAll/mix`.

- [x] Write a JVM test fixture that constructs mono/stereo WAV data and asserts parsing, sample-rate conversion, mixing order, looping, playback rate, stopping, and clipping.
- [x] Run the focused JVM test and confirm it fails because the new classes do not exist.
- [x] Implement strict chunk parsing, linear sample conversion, bounded voices, and saturated stereo output.
- [x] Run the JVM test and existing native source tests until they pass.
- [x] Commit the pure PCM layer.

### Task 2: Replace SoundPool with a warm AudioTrack bridge

**Files:**
- Modify: `android-app/app/src/main/java/cn/xianlai/game/NativeAudioBridge.java`
- Modify: `android-app/app/src/main/java/cn/xianlai/game/MainActivity.java`
- Modify: `tests/native-audio-bridge.test.js`
- Modify: `tests/audio-web.test.js`

**Interfaces:**
- Consumes: the existing 12 effect keys and `PcmMixer`.
- Produces: `XianlaiNativeAudio.isReady/play/stop/stopAll/backend` and activity `setForeground(boolean)`.

- [x] Extend tests to require device output properties, `PERFORMANCE_MODE_LOW_LATENCY`, `THREAD_PRIORITY_AUDIO`, bounded buffers, continuous silence, lifecycle suspension, and no `SoundPool` dependency.
- [x] Run the focused tests and confirm they fail against the existing bridge.
- [x] Build the native stream, preload assets, start the writer in foreground, and stop it on pause/destroy.
- [x] Keep `audio-manager.js` native-first with Web Audio fallback and expose the backend only for diagnosis.
- [x] Run native, audio-web, app-shell, and Java compilation tests.
- [x] Commit the low-latency bridge.

### Task 3: Build and verify Android 1.0.4

**Files:**
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/build.gradle`
- Modify: `android-app/README.md`
- Modify: `docs/PROJECT_PLAYBOOK.md`
- Output: `../安卓安装包/xianlai-1.0.4.apk`

**Interfaces:**
- Consumes: tested PCM engine and existing signing backup.
- Produces: signed upgrade APK 1.0.4/code 5.

- [x] Update both version declarations and user-facing Android documentation.
- [x] Run the full Node, Python, JVM, syntax, asset, and diff checks.
- [x] Build the APK and verify package ID, ZIP alignment, v2/v3 signature continuity, bundled effects, and Internet-only permission.
- [x] Record the APK size and SHA-256 and leave real-device latency as the explicit acceptance check.
- [x] Commit and push the Android release changes.
