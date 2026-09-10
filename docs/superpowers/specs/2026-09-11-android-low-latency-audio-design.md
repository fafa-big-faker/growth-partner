# Android Low-Latency Audio Design

## Goal

Remove the roughly one-second, uniformly shifted short-effect playback heard in the Android app while preserving browser audio and the existing BGM behavior.

## Evidence

- Rapid taps are reproduced with the correct spacing but the complete sequence starts about one second late. This rules out per-click network fetches and points to the Android output path or its queued buffer.
- The current APK uses `SoundPool`, but the source WAV files are 40 kHz stereo while Android devices normally expose a different optimal output rate, commonly 48 kHz.
- Android's official latency guidance requires matching the device output sample rate and buffer size, checking that the stream receives a fast track, and avoiding warmup by feeding silence before the first audible sample.
- The current JavaScript bridge silently falls back to Web Audio whenever the complete `SoundPool` set is not ready, so the active backend cannot be proven on a real device.

## Design

Replace `SoundPool` for short effects with a persistent `AudioTrack` stream configured with `PERFORMANCE_MODE_LOW_LATENCY`. Read the device's preferred sample rate and frames-per-buffer from `AudioManager`, decode the bundled PCM WAV files once, convert them to the device rate and stereo format in memory, and mix active effects into one continuously running stream.

The stream writes silence while the foreground app is idle. This keeps the output pipeline warm and makes a JavaScript bridge call add sound to the next small audio buffer instead of starting a new player. The stream stops while the activity is backgrounded or destroyed. BGM remains in the existing web audio path.

Keep the existing narrow JavaScript interface: `isReady`, `play`, `stop`, and `stopAll`. Add a read-only `backend` identifier for diagnostics. If the native engine cannot initialize, `isReady` remains false and the existing browser/Web Audio fallback continues to work.

## Components

- `PcmWave`: strict RIFF/WAVE PCM16 decoder and device-rate/stereo converter.
- `PcmMixer`: bounded in-memory voice mixer with volume, playback rate, looping, stream IDs, stopping, and saturated PCM16 output.
- `NativeAudioBridge`: Android lifecycle, `AudioTrack` creation, audio-priority writer thread, asset loading, and JavaScript interface.
- `MainActivity`: foreground/background calls so silent output never continues after the app leaves the screen.

## Constraints

- Android 8.0/API 26 remains the minimum.
- No new network, microphone, storage, or audio-recording permission.
- No change to BGM, game timing, effect names, or browser behavior.
- The APK keeps the same application ID and signing identity and advances to version 1.0.4/code 5.
- Real acoustic latency still requires the user's device test; automated tests cover parsing, mixing, bridge selection, lifecycle, packaging, and fallbacks.

## Verification

Pure Java tests validate WAV parsing/resampling and exact mixer timing. Static bridge tests assert low-latency mode, device-native properties, continuous silence, foreground shutdown, and the absence of `SoundPool`. The existing web audio suite verifies native priority and fallback. The signed APK is checked for upgrade compatibility and Internet-only permission.
