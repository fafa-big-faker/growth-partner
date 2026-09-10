# Android Startup Isolation Design

## Problem

Android 1.0.4 creates, decodes, resamples, and starts the low-latency PCM output on the UI thread before the WebView begins loading. On devices whose audio stack initializes slowly or behaves unexpectedly, the game entry request can be delayed or starved until the native 30-second deadline reports a connection failure. The live GitHub Pages entry currently returns HTTP 200 and the APK declares the Internet permission, so startup must be isolated from optional audio work.

## Design

- Constructing `NativeAudioBridge` must do no file decoding and must not create or start an `AudioTrack`.
- The WebView remains the first startup priority. After a trusted page becomes visible, `MainActivity` asks the bridge to initialize once.
- PCM decoding, resampling, and `AudioTrack` creation run on a background thread.
- Foreground state is remembered independently from readiness. Once initialization finishes, the writer starts only when the Activity is foregrounded.
- Every audio initialization failure remains contained inside the bridge and reports the existing Web Audio fallback; it cannot stop, hide, or recreate the WebView.
- The release path must remain safe when initialization is still running.

## Release And Verification

Release as Android `1.0.5` / versionCode `6` with the existing application id and signing identity so it installs over 1.0.4. Compile Java, run the navigation and PCM tests, build and verify the signed APK, and run the full web test suite. A physical-device install remains the final confirmation because no Android device is connected to the build machine.
