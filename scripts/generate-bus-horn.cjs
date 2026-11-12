// Original two-tone electric horn. Generates PCM only; never opens audio output.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const dir = path.join(__dirname, '../public/audio'), file = 'bus-horn.wav';
const rate = 44100, frames = Math.round(rate * .72), data = Buffer.alloc(44 + frames * 2);
data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(frames * 2, 40);
let peak = 0, square = 0;
for (let i = 0; i < frames; i++) {
  const t = i / rate, envelope = Math.min(1, t / .025, (.72 - t) / .065);
  let wave = 0;
  for (const fundamental of [185, 233]) for (let h = 1; h <= 12; h++)
    wave += Math.sin(2 * Math.PI * fundamental * h * t) / Math.pow(h, 1.15);
  const value = Math.tanh(wave * .6) * .79 * envelope;
  const sample = Math.round(value * 32767); data.writeInt16LE(sample, 44 + i * 2);
  peak = Math.max(peak, Math.abs(sample / 32768)); square += (sample / 32768) ** 2;
}
fs.writeFileSync(path.join(dir, file), data);
const entry = { file, original: file, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'),
  seconds: frames / rate, format: 'wav', pack: 'project-original',
  source: 'scripts/generate-bus-horn.cjs; original additive two-tone electric horn, no third-party samples',
  license: 'Project-original waveform; no third-party sample license required', adopted_cycle: 124 };
const manifestPath = path.join(dir, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
fs.writeFileSync(manifestPath, JSON.stringify([...manifest.filter(x => x.file !== file), entry], null, 2) + '\n');
console.log(JSON.stringify({ ...entry, peak, rms: Math.sqrt(square / frames), playback: false }));
