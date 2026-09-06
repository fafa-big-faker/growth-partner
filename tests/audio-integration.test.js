const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('all supplied audio files are present and remain lightweight', () => {
  const files = [
    'bgm-main.mp3', 'ui-tap.wav', 'ui-open.wav', 'chop-hit.wav',
    'item-drop.wav', 'forge-process.wav', 'forge-success.wav',
  ];
  let totalBytes = 0;
  files.forEach(file => {
    const filePath = path.join(root, 'assets', 'runtime', 'audio', file);
    const contents = fs.readFileSync(filePath);
    assert.ok(contents.length > 1000, `${file} should contain audio data`);
    if (file.endsWith('.wav')) assert.equal(contents.subarray(0, 4).toString('ascii'), 'RIFF');
    totalBytes += contents.length;
  });
  assert.ok(totalBytes < 2 * 1024 * 1024, 'audio bundle should remain under 2 MiB');
});

test('audio manager loads before the game and both dashboards expose mute controls', () => {
  assert.ok(html.indexOf('audio-manager.js') > -1);
  assert.ok(html.indexOf('audio-manager.js') < html.indexOf('app.js'));
  assert.equal((html.match(/class="audio-toggle"/g) || []).length, 2);
  assert.match(app, /AudioManager\.bindControls\(\)/);
  assert.match(styles, /\.audio-toggle\s*\{/);
});

test('login preloads audio and owns BGM lifecycle', () => {
  assert.match(app, /AudioManager\.preload\(\)/);
  assert.match(app, /AudioManager\.playBgm\(\)/);
  assert.match(app, /AudioManager\.pauseBgm\(\)/);
});

test('navigation and modal opening use the shared opening effect', () => {
  assert.ok((app.match(/AudioManager\.playEffect\('uiOpen'\)/g) || []).length >= 3);
});

test('chopping, drops, and forging have semantic sound triggers', () => {
  assert.ok((app.match(/AudioManager\.playEffect\('chopHit'\)/g) || []).length >= 2);
  assert.ok((app.match(/AudioManager\.playEffect\('itemDrop'\)/g) || []).length >= 2);
  assert.match(app, /AudioManager\.startLoop\('forgeProcess'\)/);
  assert.match(app, /AudioManager\.stopLoop\('forgeProcess'\)/);
  assert.match(app, /AudioManager\.playEffect\('forgeSuccess'\)/);
});
