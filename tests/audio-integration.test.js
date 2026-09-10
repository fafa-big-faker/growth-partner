const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function readPcmPeak(contents) {
  let offset = 12;
  while (offset + 8 <= contents.length) {
    const chunkId = contents.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = contents.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      let peak = 0;
      for (let sampleOffset = offset + 8; sampleOffset < offset + 8 + chunkSize; sampleOffset += 2) {
        peak = Math.max(peak, Math.abs(contents.readInt16LE(sampleOffset) / 32768));
      }
      return peak;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error('WAV data chunk not found');
}

test('all supplied audio files are present and remain lightweight', () => {
  const files = [
    'bgm-main.mp3', 'ui-tap.wav', 'ui-open.wav', 'chop-hit.wav',
    'item-drop.wav', 'forge-process.wav', 'forge-success.wav',
    'reward-reveal.wav', 'drop-rare.wav', 'drop-high.wav', 'skill-trigger.wav',
    'reward-arrival-rare.wav', 'reward-arrival-high.wav',
  ];
  let totalBytes = 0;
  files.forEach(file => {
    const filePath = path.join(root, 'assets', 'runtime', 'audio', file);
    const contents = fs.readFileSync(filePath);
    assert.ok(contents.length > 1000, `${file} should contain audio data`);
    if (file.endsWith('.wav')) assert.equal(contents.subarray(0, 4).toString('ascii'), 'RIFF');
    totalBytes += contents.length;
  });
  assert.equal(totalBytes, 2444128);
  assert.ok(totalBytes < 2.4 * 1024 * 1024, 'audio bundle should remain under 2.4 MiB with both complete rare arrival cues');
});

test('runtime effects use the approved peak-normalized loudness targets', () => {
  const targets = {
    'ui-tap.wav': 0.62,
    'ui-open.wav': 0.60,
    'chop-hit.wav': 0.72,
    'item-drop.wav': 0.68,
    'forge-process.wav': 0.72,
    'forge-success.wav': 0.76,
    'reward-reveal.wav': 0.62,
    'drop-rare.wav': 0.70,
    'drop-high.wav': 0.76,
    'skill-trigger.wav': 0.72,
    'reward-arrival-rare.wav': 0.86,
    'reward-arrival-high.wav': 0.94,
  };
  Object.entries(targets).forEach(([file, target]) => {
    const contents = fs.readFileSync(path.join(root, 'assets', 'runtime', 'audio', file));
    assert.ok(Math.abs(readPcmPeak(contents) - target) < 0.01, `${file} should peak near ${target}`);
  });
});

test('audio manager loads before the game and both dashboards expose mute controls', () => {
  assert.ok(html.indexOf('audio-manager.js') > -1);
  assert.ok(html.indexOf('audio-manager.js') < html.indexOf('app.js'));
  assert.equal((html.match(/class="audio-toggle"/g) || []).length, 1);
  assert.equal((app.match(/class="audio-toggle"/g) || []).length, 1);
  const playerTools = app.match(/<div class="topbar-left">([\s\S]*?)<\/div>\s*<div class="res-pill/)?.[1] || '';
  const adminTools = html.match(/<div class="header-right">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(playerTools, /audio-toggle/);
  assert.match(adminTools, /audio-toggle/);
  [...html.matchAll(/<nav class="bottom-nav">([\s\S]*?)<\/nav>/g)]
    .forEach(match => assert.doesNotMatch(match[1], /audio-toggle/));
  assert.match(app, /AudioManager\.bindControls\(\)/);
  assert.match(styles, /\.topbar-left \.audio-toggle/);
  assert.doesNotMatch(styles, /\.audio-toggle\s*\{[\s\S]*?top:\s*-48px/);
});

test('entry preparation owns full audio downloads while login owns BGM lifecycle', () => {
  assert.doesNotMatch(app, /AudioManager\.preload\(\)/);
  assert.match(app, /prepareAudio:\s*\(\) => AudioManager\.prepareEffects\(\)/);
  assert.ok(html.indexOf('src="resource-pack.js') < html.indexOf('src="login-boot.js'));
  assert.ok(html.indexOf('src="boot-assets.js') < html.indexOf('src="login-boot.js'));
  assert.match(app, /AudioManager\.playBgm\(\)/);
  assert.match(app, /AudioManager\.pauseBgm\(\)/);
});

test('navigation and modal opening use the shared opening effect', () => {
  assert.ok((app.match(/AudioManager\.playEffect\('uiOpen'\)/g) || []).length >= 3);
});

test('chopping, drops, and forging have semantic sound triggers', () => {
  assert.ok((app.match(/AudioManager\.playEffect\('chopHit'\)/g) || []).length >= 2);
  assert.ok((app.match(/this\.playDropSound\(item\)/g) || []).length >= 2);
  assert.match(app, /AudioManager\.playEffect\(sound,\s*\{\s*group:\s*'chop-drops'\s*\}\)/);
  assert.match(app, /AudioManager\.startLoop\('forgeProcess'\)/);
  assert.match(app, /AudioManager\.stopLoop\('forgeProcess'\)/);
  assert.match(app, /AudioManager\.playEffect\('forgeSuccess'\)/);
});

test('confirmed drops select cues by actual reward quality, independently of item rarity', () => {
  const body = app.match(/playDropSound\(item\) \{([\s\S]*?)\n  \},/)?.[1];
  assert.ok(body, 'Shared confirmed-drop sound helper must exist');
  const play = new Function('AudioManager', 'item', body);
  const calls = [];
  const audio = { playEffect: (name, options) => calls.push({ name, options }) };
  for (const quality of [1, 2, 3, 4, 5]) play(audio, { quality, item: { quality: 1 } });
  assert.deepEqual(calls.map(call => call.name), ['itemDrop', 'itemDrop', 'dropRare', 'dropHigh', 'dropHigh']);
  assert.ok(calls.every(call => call.options.group === 'chop-drops'));
});
