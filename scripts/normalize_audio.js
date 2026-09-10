const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SOURCE_DIR = path.resolve(__dirname, '..', '..', '音频资源');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'assets', 'runtime', 'audio');

const REWARD_SOURCES = Object.freeze({
  'reward-reveal.wav': {
    file: '奖励-逐项出现.wav',
    sha256: 'c22283b16b3fa1a1912389c4cd4ad9c18b167701d654618d0c5e206ce400dbd2',
  },
  'drop-rare.wav': {
    file: '掉落-珍品.wav',
    sha256: 'ad6ef928ae34eca4efe0b35727af5abc44911f7609ae26a76d05e89b912551c6',
  },
  'drop-high.wav': {
    file: '掉落-神仙品.wav',
    sha256: '953d0739be3dcb5598a4e778bb7e01ee677477402b5ea7d59a1c62fae7826baf',
  },
  'skill-trigger.wav': {
    file: '斧技-发动V2.wav',
    sha256: '810722dfcf26011473c2989e38fed3c8fd83953d44efb594dfcc7dab3e06395b',
  },
});

const ARRIVAL_SOURCES = Object.freeze({
  'reward-arrival-rare.wav': {
    file: '掉落出场-珍品.wav',
    sha256: '4e78a81a2109967bda601a592bbeeecd71d5a6408b204f469d54b5e8cae9e599',
  },
  'reward-arrival-high.wav': {
    file: '掉落出场-神仙品.wav',
    sha256: '4a74b282fddc4ec2a652fe2619c1a028f060361a8adc5b59c1901ad65ab7d0ec',
  },
});

const TARGET_PEAKS = Object.freeze({
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
  'reward-arrival-rare.wav': 0.70,
  'reward-arrival-high.wav': 0.76,
});

function findChunk(buffer, expectedId) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF'
      || buffer.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new Error('Expected a RIFF/WAVE file');
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + size > buffer.length) throw new Error(`Invalid ${id} chunk size`);
    if (id === expectedId) return { dataOffset, size };
    offset = dataOffset + size + (size % 2);
  }
  throw new Error(`Missing ${expectedId} chunk`);
}

function inspectPcm16(buffer) {
  const format = findChunk(buffer, 'fmt ');
  if (format.size < 16) throw new Error('Incomplete PCM format header');
  const audioFormat = buffer.readUInt16LE(format.dataOffset);
  const bitsPerSample = buffer.readUInt16LE(format.dataOffset + 14);
  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new Error(`Expected 16-bit PCM, received format ${audioFormat} / ${bitsPerSample}-bit`);
  }
  const channels = buffer.readUInt16LE(format.dataOffset + 2);
  const sampleRate = buffer.readUInt32LE(format.dataOffset + 4);
  const byteRate = buffer.readUInt32LE(format.dataOffset + 8);
  const blockAlign = buffer.readUInt16LE(format.dataOffset + 12);
  if (channels < 1 || sampleRate < 1 || blockAlign !== channels * 2 || byteRate !== sampleRate * blockAlign) {
    throw new Error('Invalid PCM frame format');
  }
  const data = findChunk(buffer, 'data');
  if (data.size % blockAlign !== 0) throw new Error('PCM data must contain complete sample frames');
  return {
    channels, sampleRate, bitsPerSample, frames: data.size / blockAlign,
    durationSeconds: data.size / byteRate, dataOffset: data.dataOffset, dataBytes: data.size,
  };
}

function normalizePcm16(buffer, targetPeak) {
  if (!Number.isFinite(targetPeak) || targetPeak <= 0 || targetPeak > 1) {
    throw new Error('Expected a target peak greater than zero and no higher than one');
  }
  const info = inspectPcm16(buffer);
  let sourcePeak = 0;
  let sourceSquares = 0;
  for (let offset = info.dataOffset; offset < info.dataOffset + info.dataBytes; offset += 2) {
    const sample = buffer.readInt16LE(offset) / 32768;
    sourcePeak = Math.max(sourcePeak, Math.abs(sample));
    sourceSquares += sample * sample;
  }
  if (sourcePeak === 0) throw new Error('Cannot normalize silent audio');

  const output = Buffer.from(buffer);
  const gain = targetPeak / sourcePeak;
  let outputPeak = 0;
  let squareSum = 0;
  let sampleCount = 0;
  for (let offset = info.dataOffset; offset < info.dataOffset + info.dataBytes; offset += 2) {
    const scaled = Math.round(buffer.readInt16LE(offset) * gain);
    const sample = Math.max(-32768, Math.min(32767, scaled));
    output.writeInt16LE(sample, offset);
    const normalized = sample / 32768;
    outputPeak = Math.max(outputPeak, Math.abs(normalized));
    squareSum += normalized * normalized;
    sampleCount += 1;
  }

  return {
    ...info,
    output,
    sourcePeak,
    sourceRms: Math.sqrt(sourceSquares / sampleCount),
    outputPeak,
    rms: Math.sqrt(squareSum / sampleCount),
    gain,
  };
}

function selectAudioFiles(args = []) {
  const modes = ['--rewards-only', '--skill-only', '--arrivals-only'];
  if (args.some(arg => ![...modes, '--check'].includes(arg))
      || modes.filter(mode => args.includes(mode)).length > 1) {
    throw new Error('Usage: normalize_audio.js [--rewards-only | --skill-only | --arrivals-only] [--check]');
  }
  if (args.includes('--skill-only')) return ['skill-trigger.wav'];
  if (args.includes('--arrivals-only')) return Object.keys(ARRIVAL_SOURCES);
  return args.includes('--rewards-only') ? Object.keys(REWARD_SOURCES) : Object.keys(TARGET_PEAKS);
}

function main(args = process.argv.slice(2)) {
  const check = args.includes('--check');
  const names = selectAudioFiles(args);
  if (!check) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  names.forEach(fileName => {
    const targetPeak = TARGET_PEAKS[fileName];
    const mapping = REWARD_SOURCES[fileName] || ARRIVAL_SOURCES[fileName];
    const sourcePath = path.join(SOURCE_DIR, mapping?.file || fileName);
    const outputPath = path.join(OUTPUT_DIR, fileName);
    const source = fs.readFileSync(sourcePath);
    if (mapping && crypto.createHash('sha256').update(source).digest('hex') !== mapping.sha256) {
      throw new Error(`Source changed; remeasure the replacement before importing ${fileName}`);
    }
    const result = normalizePcm16(source, targetPeak);
    if (check) {
      if (!fs.existsSync(outputPath) || !fs.readFileSync(outputPath).equals(result.output)) {
        throw new Error(`Output differs: ${fileName}`);
      }
    } else {
      fs.writeFileSync(outputPath, result.output);
    }
    console.log(
      `${fileName}: ${result.durationSeconds.toFixed(3)}s, ${result.sampleRate}Hz, ${result.channels}ch; `
      + `peak ${result.sourcePeak.toFixed(3)} -> ${result.outputPeak.toFixed(3)}, `
      + `gain ${result.gain.toFixed(2)}x, rms ${result.sourceRms.toFixed(4)} -> ${result.rms.toFixed(4)}`
      + (check ? ' (verified)' : ''),
    );
  });
}

if (require.main === module) main();

module.exports = { REWARD_SOURCES, ARRIVAL_SOURCES, TARGET_PEAKS, findChunk, inspectPcm16, normalizePcm16, selectAudioFiles };
