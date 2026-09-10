const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => {
  const file = path.join(root, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
};
const bridge = read('android-app/app/src/main/java/cn/xianlai/game/NativeAudioBridge.java');
const wave = read('android-app/app/src/main/java/cn/xianlai/game/PcmWave.java');
const mixer = read('android-app/app/src/main/java/cn/xianlai/game/PcmMixer.java');
const activity = read('android-app/app/src/main/java/cn/xianlai/game/MainActivity.java');
const manager = read('audio-manager.js');

const cues = ['uiTap', 'uiOpen', 'chopHit', 'itemDrop', 'forgeProcess', 'forgeSuccess',
  'dropRare', 'dropHigh', 'rewardReveal', 'rewardRare', 'rewardHigh', 'skillTrigger'];

test('native bridge uses one warm low-latency AudioTrack and an exact short-cue whitelist', () => {
  assert.match(bridge, /new AudioAttributes\.Builder\(\)[\s\S]*USAGE_GAME[\s\S]*CONTENT_TYPE_SONIFICATION/);
  assert.match(bridge, /new AudioTrack\.Builder\(\)[\s\S]*PERFORMANCE_MODE_LOW_LATENCY/);
  assert.match(bridge, /PROPERTY_OUTPUT_SAMPLE_RATE/);
  assert.match(bridge, /PROPERTY_OUTPUT_FRAMES_PER_BUFFER/);
  assert.match(bridge, /Process\.THREAD_PRIORITY_AUDIO/);
  assert.match(bridge, /mixer\.mix\([\s\S]*AudioTrack\.WRITE_BLOCKING/);
  for (const cue of cues) assert.match(bridge, new RegExp(`put\\("${cue}",`), cue);
  assert.doesNotMatch(bridge, /SoundPool|bgmMain|MediaPlayer|loadUrl|HttpURLConnection|openConnection/);
});

test('PCM decoder matches bundled cues to the device output and mixer keeps independent bounded voices', () => {
  assert.match(wave, /class PcmWave/);
  assert.match(wave, /RIFF/);
  assert.match(wave, /targetSampleRate/);
  assert.match(mixer, /class PcmMixer/);
  assert.match(mixer, /synchronized int play/);
  assert.match(mixer, /synchronized void mix/);
  assert.match(mixer, /Short\.MAX_VALUE/);
});

test('only bounded playback, diagnosis and stopping are exposed to trusted page script', () => {
  assert.match(bridge, /@JavascriptInterface\s+public boolean isReady\(\)/);
  assert.match(bridge, /@JavascriptInterface\s+public int play\(String name, double volume, double rate, boolean loop\)/);
  assert.match(bridge, /Math\.max\(0\.0f, Math\.min\(1\.0f/);
  assert.match(bridge, /Math\.max\(0\.5f, Math\.min\(2\.0f/);
  assert.match(bridge, /@JavascriptInterface\s+public void stop\(int streamId\)/);
  assert.match(bridge, /@JavascriptInterface\s+public void stopAll\(\)/);
  assert.match(bridge, /@JavascriptInterface\s+public String backend\(\)/);
  const exposed = [...bridge.matchAll(/@JavascriptInterface\s+public\s+\w+\s+(\w+)\s*\(/g)]
    .map(match => match[1])
    .sort();
  assert.deepEqual(exposed, ['backend', 'isReady', 'play', 'stop', 'stopAll']);
});

test('Activity keeps the bridge warm only in foreground while existing lifecycle still suspends the page', () => {
  assert.match(activity, /nativeAudio = new NativeAudioBridge\(this\)/);
  assert.match(activity, /addJavascriptInterface\(nativeAudio, "XianlaiNativeAudio"\)/);
  assert.match(activity, /nativeAudio\.release\(\)/);
  assert.match(activity, /nativeAudio\.setForeground\(false\)/);
  assert.match(activity, /nativeAudio\.setForeground\(true\)/);
  assert.match(activity, /setPageBackgrounded\(true\)/);
});

test('browser manager has explicit native preference and Web Audio fallback', () => {
  assert.match(manager, /options\.NativeAudio \|\| root\.XianlaiNativeAudio/);
  assert.match(manager, /function usesNativeEffects\(\)/);
  assert.match(manager, /const nativeAudio = createNativeAudio\(name\)/);
  assert.match(manager, /if \(nativeAudio\) return nativeAudio/);
  assert.match(manager, /prepareEffects/);
});
