const fs = require('node:fs');
const path = require('node:path');

const SOURCE_DIR = path.resolve(__dirname, '..', '..', '音频资源');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'assets', 'runtime', 'audio');

const TARGET_PEAKS = Object.freeze({
  'ui-tap.wav': 0.62,
  'ui-open.wav': 0.60,
  'chop-hit.wav': 0.72,
  'item-drop.wav': 0.68,
  'forge-process.wav': 0.72,
  'forge-success.wav': 0.76,
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

function normalizePcm16(buffer, targetPeak) {
  const format = findChunk(buffer, 'fmt ');
  const audioFormat = buffer.readUInt16LE(format.dataOffset);
  const bitsPerSample = buffer.readUInt16LE(format.dataOffset + 14);
  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new Error(`Expected 16-bit PCM, received format ${audioFormat} / ${bitsPerSample}-bit`);
  }

  const data = findChunk(buffer, 'data');
  if (data.size % 2 !== 0) throw new Error('PCM data size must contain complete 16-bit samples');

  let sourcePeak = 0;
  for (let offset = data.dataOffset; offset < data.dataOffset + data.size; offset += 2) {
    sourcePeak = Math.max(sourcePeak, Math.abs(buffer.readInt16LE(offset) / 32768));
  }
  if (sourcePeak === 0) throw new Error('Cannot normalize silent audio');

  const output = Buffer.from(buffer);
  const gain = targetPeak / sourcePeak;
  let outputPeak = 0;
  let squareSum = 0;
  let sampleCount = 0;
  for (let offset = data.dataOffset; offset < data.dataOffset + data.size; offset += 2) {
    const scaled = Math.round(buffer.readInt16LE(offset) * gain);
    const sample = Math.max(-32768, Math.min(32767, scaled));
    output.writeInt16LE(sample, offset);
    const normalized = sample / 32768;
    outputPeak = Math.max(outputPeak, Math.abs(normalized));
    squareSum += normalized * normalized;
    sampleCount += 1;
  }

  return {
    output,
    sourcePeak,
    outputPeak,
    rms: Math.sqrt(squareSum / sampleCount),
    gain,
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  Object.entries(TARGET_PEAKS).forEach(([fileName, targetPeak]) => {
    const sourcePath = path.join(SOURCE_DIR, fileName);
    const outputPath = path.join(OUTPUT_DIR, fileName);
    const source = fs.readFileSync(sourcePath);
    const result = normalizePcm16(source, targetPeak);
    fs.writeFileSync(outputPath, result.output);
    console.log(
      `${fileName}: peak ${result.sourcePeak.toFixed(3)} -> ${result.outputPeak.toFixed(3)}, `
      + `gain ${result.gain.toFixed(2)}x, rms ${result.rms.toFixed(3)}`,
    );
  });
}

if (require.main === module) main();

module.exports = { TARGET_PEAKS, findChunk, normalizePcm16 };
