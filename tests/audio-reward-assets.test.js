const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { REWARD_SOURCES, TARGET_PEAKS, inspectPcm16, normalizePcm16 } = require('../scripts/normalize_audio');
const { AUDIO_PATHS } = require('../audio-manager');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, '..', '\u97f3\u9891\u8d44\u6e90');
const runtimeDir = path.join(root, 'assets', 'runtime', 'audio');
const hash = contents => crypto.createHash('sha256').update(contents).digest('hex');
const expected = {
  'reward-reveal.wav': { name: '\u5956\u52b1-\u9010\u9879\u51fa\u73b0.wav', seconds: 0.2, peak: 0.62, cue: 'rewardReveal' },
  'drop-rare.wav': { name: '\u6389\u843d-\u73cd\u54c1.wav', seconds: 0.5, peak: 0.70, cue: 'dropRare' },
  'drop-high.wav': { name: '\u6389\u843d-\u795e\u4ed9\u54c1.wav', seconds: 0.8, peak: 0.76, cue: 'dropHigh' },
  'skill-trigger.wav': { name: '\u65a7\u6280-\u53d1\u52a8.wav', seconds: 0.4, peak: 0.72, cue: 'skillTrigger' },
};

test('reward audio imports exactly the four supplied source mappings', () => {
  assert.deepEqual(Object.keys(REWARD_SOURCES).sort(), Object.keys(expected).sort());
  for (const [name, spec] of Object.entries(expected)) {
    assert.equal(REWARD_SOURCES[name].file, spec.name);
    assert.equal(TARGET_PEAKS[name], spec.peak);
    assert.equal(AUDIO_PATHS[spec.cue], `assets/runtime/audio/${name}`);
  }
});

test('reward cues preserve PCM format, complete duration and bounded peaks', () => {
  let total = 0;
  for (const [name, spec] of Object.entries(expected)) {
    const contents = fs.readFileSync(path.join(runtimeDir, name));
    const metrics = inspectPcm16(contents);
    assert.equal(metrics.bitsPerSample, 16);
    assert.equal(metrics.sampleRate, 40000);
    assert.equal(metrics.channels, 2);
    assert.equal(metrics.durationSeconds, spec.seconds);
    assert.equal(metrics.frames, 40000 * spec.seconds);
    const measured = normalizePcm16(contents, spec.peak);
    assert.ok(Math.abs(measured.sourcePeak - spec.peak) < 0.001, name);
    assert.ok(measured.sourceRms > 0.06 && measured.sourceRms < 0.16, name);
    total += contents.length;
  }
  assert.ok(total < 320 * 1024);
});

test('reward normalization is deterministic and changes sample amplitudes only', {
  skip: !Object.values(expected).every(spec => fs.existsSync(path.join(sourceDir, spec.name))),
}, () => {
  for (const [name, spec] of Object.entries(expected)) {
    const sourcePath = path.join(sourceDir, spec.name);
    const original = fs.readFileSync(sourcePath);
    assert.equal(hash(original), REWARD_SOURCES[name].sha256, 'Original source must not change');
    const result = normalizePcm16(original, spec.peak);
    const runtime = fs.readFileSync(path.join(runtimeDir, name));
    assert.deepEqual(runtime, result.output);
    assert.equal(runtime.length, original.length);
    const info = inspectPcm16(original);
    assert.deepEqual(runtime.subarray(0, info.dataOffset), original.subarray(0, info.dataOffset));
    assert.deepEqual(runtime.subarray(info.dataOffset + info.dataBytes), original.subarray(info.dataOffset + info.dataBytes));
    assert.deepEqual(inspectPcm16(runtime), info);
    assert.equal(hash(fs.readFileSync(sourcePath)), REWARD_SOURCES[name].sha256);
  }
});

test('the seven existing audio files remain byte-for-byte unchanged', () => {
  const previous = {
    'bgm-main.mp3': 'fcc89ed8b241fd48ce5e817dbd042f8598592b4abaa3d76ad1edd70ca478a55c',
    'chop-hit.wav': '1b981c8f57ba8c66bba48836c96b9ed2eaa508eb4c1327a4bcdd1788876694ca',
    'forge-process.wav': '432d957937cee0707f8f9091070eaee8dcf3e15ba2029368be1db4d6b6fd5938',
    'forge-success.wav': '08d74708d55f17b41752807dfc78a60fee4fcf0c622dc30a219e69d4b958fa0b',
    'item-drop.wav': '2c19bdfdf5f53be6ab0f49e6396726495c903b805937b8d29254f4c1eec6256f',
    'ui-open.wav': '9167bac0424fcbda4a383faafae72053059c74a1411e118799503549b6b7132b',
    'ui-tap.wav': '5b44fa42c0add1585c906f5390bdcc6d9b779c92143d6bfedb02c7d6122b0a71',
  };
  for (const [name, sha256] of Object.entries(previous)) {
    assert.equal(hash(fs.readFileSync(path.join(runtimeDir, name))), sha256, name);
  }
});

test('normalization refuses unsupported formats and incomplete sample frames', () => {
  const contents = fs.readFileSync(path.join(runtimeDir, 'reward-reveal.wav'));
  const invalid = Buffer.from(contents);
  const fmtOffset = invalid.indexOf('fmt ') + 8;
  invalid.writeUInt16LE(3, fmtOffset);
  assert.throws(() => inspectPcm16(invalid), /16-bit PCM/);
  assert.throws(() => normalizePcm16(contents, 2), /target peak/);
  const incomplete = Buffer.from(contents);
  const dataOffset = incomplete.indexOf('data');
  incomplete.writeUInt32LE(incomplete.readUInt32LE(dataOffset + 4) - 1, dataOffset + 4);
  assert.throws(() => inspectPcm16(incomplete), /complete.*frames/);
});
