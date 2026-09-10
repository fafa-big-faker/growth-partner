const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { REWARD_SOURCES, ARRIVAL_SOURCES, TARGET_PEAKS, inspectPcm16, normalizePcm16, selectAudioFiles } = require('../scripts/normalize_audio');
const { AUDIO_PATHS, AUDIO_VOLUMES } = require('../audio-manager');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, '..', '\u97f3\u9891\u8d44\u6e90');
const runtimeDir = path.join(root, 'assets', 'runtime', 'audio');
const hash = contents => crypto.createHash('sha256').update(contents).digest('hex');
const expected = {
  'reward-reveal.wav': { name: '\u5956\u52b1-\u9010\u9879\u51fa\u73b0.wav', seconds: 0.2, peak: 0.62, cue: 'rewardReveal' },
  'drop-rare.wav': { name: '\u6389\u843d-\u73cd\u54c1.wav', seconds: 0.5, peak: 0.70, cue: 'dropRare' },
  'drop-high.wav': { name: '\u6389\u843d-\u795e\u4ed9\u54c1.wav', seconds: 0.8, peak: 0.76, cue: 'dropHigh' },
  'skill-trigger.wav': { name: '\u65a7\u6280-\u53d1\u52a8V2.wav', seconds: 0.68, peak: 0.72, cue: 'skillTrigger', version: 'skill-v2-20260909' },
};
const arrivalExpected = {
  'reward-arrival-rare.wav': { name: '掉落出场-珍品-加强版.wav', seconds: 0.88, peak: 0.86, cue: 'rewardRare' },
  'reward-arrival-high.wav': { name: '掉落出场-神仙品-加强版.wav', seconds: 1.28, peak: 0.94, cue: 'rewardHigh' },
};
const allExpected = { ...expected, ...arrivalExpected };
const allSources = { ...REWARD_SOURCES, ...ARRIVAL_SOURCES };

test('reward audio imports exactly the four supplied source mappings', () => {
  assert.deepEqual(Object.keys(REWARD_SOURCES).sort(), Object.keys(expected).sort());
  for (const [name, spec] of Object.entries(expected)) {
    assert.equal(REWARD_SOURCES[name].file, spec.name);
    assert.equal(TARGET_PEAKS[name], spec.peak);
    assert.equal(AUDIO_PATHS[spec.cue], `assets/runtime/audio/${name}${spec.version ? `?v=${spec.version}` : ''}`);
  }
});

test('rare arrival sounds are distinct from physical drop sounds', () => {
  assert.deepEqual(Object.keys(ARRIVAL_SOURCES).sort(), Object.keys(arrivalExpected).sort());
  for (const [name, spec] of Object.entries(arrivalExpected)) {
    assert.equal(ARRIVAL_SOURCES[name].file, spec.name);
    assert.equal(TARGET_PEAKS[name], spec.peak);
    assert.equal(AUDIO_PATHS[spec.cue], `assets/runtime/audio/${name}?v=reward-burst-20260910`);
  }
  assert.notEqual(AUDIO_PATHS.rewardRare, AUDIO_PATHS.dropRare);
  assert.notEqual(AUDIO_PATHS.rewardHigh, AUDIO_PATHS.dropHigh);
});

test('reward cues preserve PCM format, complete duration and bounded peaks', () => {
  let total = 0;
  for (const [name, spec] of Object.entries(allExpected)) {
    const contents = fs.readFileSync(path.join(runtimeDir, name));
    const metrics = inspectPcm16(contents);
    assert.equal(metrics.bitsPerSample, 16);
    assert.equal(metrics.sampleRate, 40000);
    assert.equal(metrics.channels, 2);
    assert.equal(metrics.durationSeconds, spec.seconds);
    assert.equal(metrics.frames, Math.round(40000 * spec.seconds));
    const measured = normalizePcm16(contents, spec.peak);
    assert.ok(Math.abs(measured.sourcePeak - spec.peak) < 0.001, name);
    assert.ok(measured.sourceRms > 0.06 && measured.sourceRms < 0.16, name);
    total += contents.length;
  }
  assert.equal(total, 695852);
  assert.ok(total < 700 * 1024);
});

test('reward normalization is deterministic and changes sample amplitudes only', {
  skip: !Object.values(allExpected).every(spec => fs.existsSync(path.join(sourceDir, spec.name))),
}, () => {
  for (const [name, spec] of Object.entries(allExpected)) {
    const sourcePath = path.join(sourceDir, spec.name);
    const original = fs.readFileSync(sourcePath);
    assert.equal(hash(original), allSources[name].sha256, 'Original source must not change');
    const result = normalizePcm16(original, spec.peak);
    const runtime = fs.readFileSync(path.join(runtimeDir, name));
    assert.deepEqual(runtime, result.output);
    assert.equal(runtime.length, original.length);
    const info = inspectPcm16(original);
    assert.deepEqual(runtime.subarray(0, info.dataOffset), original.subarray(0, info.dataOffset));
    assert.deepEqual(runtime.subarray(info.dataOffset + info.dataBytes), original.subarray(info.dataOffset + info.dataBytes));
    assert.deepEqual(inspectPcm16(runtime), info);
    assert.equal(hash(fs.readFileSync(sourcePath)), allSources[name].sha256);
  }
});

test('all eleven previous audio files remain byte-for-byte unchanged', () => {
  const previous = {
    'bgm-main.mp3': 'fcc89ed8b241fd48ce5e817dbd042f8598592b4abaa3d76ad1edd70ca478a55c',
    'chop-hit.wav': '1b981c8f57ba8c66bba48836c96b9ed2eaa508eb4c1327a4bcdd1788876694ca',
    'forge-process.wav': '432d957937cee0707f8f9091070eaee8dcf3e15ba2029368be1db4d6b6fd5938',
    'forge-success.wav': '08d74708d55f17b41752807dfc78a60fee4fcf0c622dc30a219e69d4b958fa0b',
    'item-drop.wav': '2c19bdfdf5f53be6ab0f49e6396726495c903b805937b8d29254f4c1eec6256f',
    'ui-open.wav': '9167bac0424fcbda4a383faafae72053059c74a1411e118799503549b6b7132b',
    'ui-tap.wav': '5b44fa42c0add1585c906f5390bdcc6d9b779c92143d6bfedb02c7d6122b0a71',
    'reward-reveal.wav': '43a90d3544b9811a030f33f0b856dbbdcb10fe56ea84e8ac13ee645bd7a835cb',
    'drop-rare.wav': '055133aec460f47d4fdd90a1273061d8663a8edfa82df805d6c2804266dbba3a',
    'drop-high.wav': '341fa77a2c640eb0b298fc9b8d8d184a13b12cf856bd315e83ed685ed3f2ba26',
    'skill-trigger.wav': '176fb1daefc3207fe61f6556b6d9348bc4db31f1657cbe6cae98e97e94666c43',
  };
  for (const [name, sha256] of Object.entries(previous)) {
    assert.equal(hash(fs.readFileSync(path.join(runtimeDir, name))), sha256, name);
  }
});

test('scoped selections cannot regenerate other files and reject conflicting modes', () => {
  assert.deepEqual(selectAudioFiles(['--skill-only']), ['skill-trigger.wav']);
  assert.deepEqual(selectAudioFiles(['--check', '--skill-only']), ['skill-trigger.wav']);
  assert.deepEqual(selectAudioFiles(['--rewards-only']), Object.keys(REWARD_SOURCES));
  assert.deepEqual(selectAudioFiles(['--arrivals-only']), Object.keys(ARRIVAL_SOURCES));
  assert.deepEqual(selectAudioFiles(['--check', '--arrivals-only']), Object.keys(ARRIVAL_SOURCES));
  assert.deepEqual(selectAudioFiles(['--check']), Object.keys(TARGET_PEAKS));
  assert.throws(() => selectAudioFiles(['--skill-only', '--rewards-only']), /Usage/);
  assert.throws(() => selectAudioFiles(['--arrivals-only', '--rewards-only']), /Usage/);
  assert.throws(() => selectAudioFiles(['--skill-only', '--arrivals-only']), /Usage/);
  assert.throws(() => selectAudioFiles(['--unknown']), /Usage/);
});

test('arrival-only verification preserves original sources and all runtime files', {
  skip: !Object.values(arrivalExpected).every(spec => fs.existsSync(path.join(sourceDir, spec.name))),
}, () => {
  const files = fs.readdirSync(runtimeDir);
  const before = Object.fromEntries(files.map(name => [name, {
    hash: hash(fs.readFileSync(path.join(runtimeDir, name))), modified: fs.statSync(path.join(runtimeDir, name)).mtimeMs,
  }]));
  const output = execFileSync(process.execPath, [path.join(root, 'scripts', 'normalize_audio.js'), '--arrivals-only', '--check'], { encoding: 'utf8' });
  assert.equal(output.trim().split(/\r?\n/).length, 2);
  assert.match(output, /reward-arrival-rare\.wav: 0\.880s, 40000Hz, 2ch;.*\(verified\)/);
  assert.match(output, /reward-arrival-high\.wav: 1\.280s, 40000Hz, 2ch;.*\(verified\)/);
  for (const name of files) {
    assert.equal(hash(fs.readFileSync(path.join(runtimeDir, name))), before[name].hash, name);
    assert.equal(fs.statSync(path.join(runtimeDir, name)).mtimeMs, before[name].modified, name);
  }
  for (const [name, spec] of Object.entries(arrivalExpected)) {
    assert.equal(hash(fs.readFileSync(path.join(sourceDir, spec.name))), ARRIVAL_SOURCES[name].sha256);
  }
});

test('only replaced skill and arrival audio use versioned cache URLs', () => {
  const versioned = Object.entries(AUDIO_PATHS).filter(([, url]) => url.includes('?'));
  assert.deepEqual(versioned, [
    ['rewardRare', 'assets/runtime/audio/reward-arrival-rare.wav?v=reward-burst-20260910'],
    ['rewardHigh', 'assets/runtime/audio/reward-arrival-high.wav?v=reward-burst-20260910'],
    ['skillTrigger', 'assets/runtime/audio/skill-trigger.wav?v=skill-v2-20260909'],
  ]);
});

test('enhanced arrivals keep their attack timing, contrast and audible unclipped mix', () => {
  const specs = [
    { file: 'reward-arrival-rare.wav', cue: 'rewardRare', rms: .1568892, oldMixedRms: .076173 * .72, minimumGainDb: 7, peakMs: 394.35 },
    { file: 'reward-arrival-high.wav', cue: 'rewardHigh', rms: .1504808, oldMixedRms: .104360 * .76, minimumGainDb: 4, peakMs: 428.675 },
  ];
  for (const spec of specs) {
    const contents = fs.readFileSync(path.join(runtimeDir, spec.file));
    const measured = normalizePcm16(contents, TARGET_PEAKS[spec.file]);
    assert.ok(Math.abs(measured.sourceRms - spec.rms) < .00001, spec.file);
    const mixedRms = measured.sourceRms * AUDIO_VOLUMES[spec.cue];
    assert.ok(20 * Math.log10(mixedRms / spec.oldMixedRms) > spec.minimumGainDb);
    assert.ok(measured.sourcePeak * AUDIO_VOLUMES[spec.cue] < .84, 'leave room for the existing BGM');
    let peak = 0;
    let peakFrame = 0;
    for (let frame = 0; frame < measured.frames; frame++) {
      for (let channel = 0; channel < measured.channels; channel++) {
        const sample = Math.abs(contents.readInt16LE(measured.dataOffset + (frame * measured.channels + channel) * 2));
        assert.ok(sample < 32767, 'the source dynamics must not clip');
        if (sample > peak) { peak = sample; peakFrame = frame; }
      }
    }
    assert.ok(Math.abs(peakFrame / measured.sampleRate * 1000 - spec.peakMs) < 1, 'keep the supplied accent aligned');
  }
});

test('V2 skill measurements retain full duration and useful headroom', () => {
  const runtime = fs.readFileSync(path.join(runtimeDir, 'skill-trigger.wav'));
  const measured = normalizePcm16(runtime, .72);
  assert.equal(runtime.length, 109042);
  assert.equal(measured.frames, 27200);
  assert.equal(measured.durationSeconds, .68);
  assert.ok(Math.abs(measured.sourceRms - .1333742) < .00001);
  assert.ok(Math.abs(measured.sourcePeak - .72) < .0001);
  assert.ok(measured.sourcePeak * .74 < .54, 'default mixed peak retains headroom');
});

test('skill-only check is deterministic, does not write, and preserves both original versions', {
  skip: !fs.existsSync(path.join(sourceDir, expected['skill-trigger.wav'].name)),
}, () => {
  const files = fs.readdirSync(runtimeDir);
  const before = Object.fromEntries(files.map(name => [name, { hash: hash(fs.readFileSync(path.join(runtimeDir, name))),
    modified: fs.statSync(path.join(runtimeDir, name)).mtimeMs }]));
  const output = execFileSync(process.execPath, [path.join(root, 'scripts', 'normalize_audio.js'), '--skill-only', '--check'], { encoding: 'utf8' });
  assert.equal(output.trim().split(/\r?\n/).length, 1);
  assert.match(output, /^skill-trigger\.wav: 0\.680s, 40000Hz, 2ch;.*\(verified\)/);
  for (const name of files) {
    assert.equal(hash(fs.readFileSync(path.join(runtimeDir, name))), before[name].hash, name);
    assert.equal(fs.statSync(path.join(runtimeDir, name)).mtimeMs, before[name].modified, name);
  }
  assert.equal(hash(fs.readFileSync(path.join(sourceDir, expected['skill-trigger.wav'].name))), REWARD_SOURCES['skill-trigger.wav'].sha256);
  const old = path.join(sourceDir, '\u65a7\u6280-\u53d1\u52a8.wav');
  if (fs.existsSync(old)) assert.equal(hash(fs.readFileSync(old)), '7f12427514a8b386092d21949964f67a34ff0db28bf3521a5d2736e02ee4b0ec');
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
