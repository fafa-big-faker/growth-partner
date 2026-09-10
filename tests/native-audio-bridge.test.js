const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bridgeFile = path.join(root, 'android-app/app/src/main/java/cn/xianlai/game/NativeAudioBridge.java');
const bridge = fs.existsSync(bridgeFile) ? fs.readFileSync(bridgeFile, 'utf8') : '';
const activity = fs.readFileSync(path.join(root, 'android-app/app/src/main/java/cn/xianlai/game/MainActivity.java'), 'utf8');
const manager = fs.readFileSync(path.join(root, 'audio-manager.js'), 'utf8');

const cues = ['uiTap', 'uiOpen', 'chopHit', 'itemDrop', 'forgeProcess', 'forgeSuccess',
  'dropRare', 'dropHigh', 'rewardReveal', 'rewardRare', 'rewardHigh', 'skillTrigger'];

test('native bridge uses a game SoundPool and an exact short-cue whitelist', () => {
  assert.match(bridge, /new AudioAttributes\.Builder\(\)[\s\S]*USAGE_GAME[\s\S]*CONTENT_TYPE_SONIFICATION/);
  assert.match(bridge, /new SoundPool\.Builder\(\)/);
  for (const cue of cues) assert.match(bridge, new RegExp(`put\\("${cue}",`), cue);
  assert.doesNotMatch(bridge, /bgmMain|MediaPlayer|loadUrl|HttpURLConnection|openConnection/);
});

test('only bounded playback and stopping are exposed to trusted page script', () => {
  assert.match(bridge, /@JavascriptInterface\s+public boolean isReady\(\)/);
  assert.match(bridge, /@JavascriptInterface\s+public int play\(String name, double volume, double rate, boolean loop\)/);
  assert.match(bridge, /Math\.max\(0\.0f, Math\.min\(1\.0f/);
  assert.match(bridge, /Math\.max\(0\.5f, Math\.min\(2\.0f/);
  assert.match(bridge, /@JavascriptInterface\s+public void stop\(int streamId\)/);
  assert.match(bridge, /@JavascriptInterface\s+public void stopAll\(\)/);
  const exposed = [...bridge.matchAll(/@JavascriptInterface\s+public\s+\w+\s+(\w+)\s*\(/g)]
    .map(match => match[1])
    .sort();
  assert.deepEqual(exposed, ['isReady', 'play', 'stop', 'stopAll']);
});

test('Activity installs and releases the narrow bridge while existing lifecycle still suspends the page', () => {
  assert.match(activity, /nativeAudio = new NativeAudioBridge\(this\)/);
  assert.match(activity, /addJavascriptInterface\(nativeAudio, "XianlaiNativeAudio"\)/);
  assert.match(activity, /nativeAudio\.release\(\)/);
  assert.match(activity, /setPageBackgrounded\(true\)/);
});

test('browser manager has explicit native preference and Web Audio fallback', () => {
  assert.match(manager, /options\.NativeAudio \|\| root\.XianlaiNativeAudio/);
  assert.match(manager, /function usesNativeEffects\(\)/);
  assert.match(manager, /const nativeAudio = createNativeAudio\(name\)/);
  assert.match(manager, /if \(nativeAudio\) return nativeAudio/);
  assert.match(manager, /prepareEffects/);
});
