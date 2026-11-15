import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "public", "samples");
const SAMPLE_RATE = 22050;
const SECONDS = 4;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(samples, peak = 0.9) {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  if (max < 1e-6) return samples;
  const gain = peak / max;
  for (let index = 0; index < samples.length; index += 1) samples[index] *= gain;
  return samples;
}

function makeBandpass(sampleRate, frequency, q) {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x0) => {
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    return y0;
  };
}

function synthNatural(sampleRate, seconds) {
  const total = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(total);
  const random = mulberry32(20261116);
  let cursor = 0;
  let syllableIndex = 0;

  while (cursor < total) {
    const syllable = Math.floor(sampleRate * (0.12 + random() * 0.16));
    const gap = Math.floor(sampleRate * (0.1 + random() * 0.14 + (syllableIndex % 4 === 3 ? 0.12 : 0)));
    const baseFrequency = 96 + random() * 78;
    const formant = makeBandpass(sampleRate, 620 + random() * 280, 2.4);
    const upper = makeBandpass(sampleRate, 1350 + random() * 420, 3.2);
    let phase = random() * Math.PI * 2;

    for (let index = 0; index < syllable && cursor + index < total; index += 1) {
      const progress = index / syllable;
      const envelope = Math.sin(Math.PI * progress) ** 0.85;
      const frequency = baseFrequency * (1 + 0.045 * Math.sin(2 * Math.PI * progress));
      phase += (2 * Math.PI * frequency) / sampleRate;
      const pulse = Math.sin(phase) + 0.42 * Math.sin(2 * phase + 0.4) + 0.18 * Math.sin(3 * phase);
      const noise = random() * 2 - 1;
      const shaped = formant(pulse) * 1.7 + upper(pulse) * 0.9;
      const aspiration = progress < 0.16 ? 0.32 : 0.07;
      samples[cursor + index] = (shaped * 0.92 + noise * aspiration) * envelope;
    }

    const breathAt = cursor + syllable;
    for (let index = 0; index < gap && breathAt + index < total; index += 1) {
      const progress = index / Math.max(1, gap);
      const envelope = Math.sin(Math.PI * progress) * 0.045;
      samples[breathAt + index] = (random() * 2 - 1) * envelope;
    }

    cursor += syllable + gap;
    syllableIndex += 1;
  }

  return normalize(samples, 0.88);
}

function synthVocoder(sampleRate, seconds, fundamental, oddBoost, seed) {
  const total = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(total);
  const random = mulberry32(seed);
  const fade = Math.floor(sampleRate * 0.012);

  for (let index = 0; index < total; index += 1) {
    const time = index / sampleRate;
    let mixed = 0;
    for (let partial = 1; partial <= 14; partial += 1) {
      const weight = (partial % 2 === 1 ? oddBoost : 1) / partial;
      mixed += weight * Math.sin(2 * Math.PI * fundamental * partial * time);
    }
    mixed = Math.tanh(mixed * 0.42) + (random() * 2 - 1) * 0.012;
    let edge = 1;
    if (index < fade) edge = index / fade;
    else if (index > total - fade) edge = (total - index) / fade;
    samples[index] = mixed * edge;
  }

  return normalize(samples, 0.9);
}

function encodeWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  }
  return buffer;
}

mkdirSync(outputDir, { recursive: true });

const files = [
  ["rehber_tecili_kocurme_deepfake.wav", synthVocoder(SAMPLE_RATE, SECONDS, 124, 1, 124000)],
  ["maliyye_hesabat_heqiqi.wav", synthNatural(SAMPLE_RATE, SECONDS)],
  ["namelum_otp_telebi_deepfake.wav", synthVocoder(SAMPLE_RATE, SECONDS, 186, 2.6, 186000)],
];

for (const [name, samples] of files) {
  if (!String(name).endsWith(".wav")) continue;
  const target = join(outputDir, name);
  writeFileSync(target, encodeWav(samples, SAMPLE_RATE));
  console.log(`${name}: ${(samples.length / SAMPLE_RATE).toFixed(2)}s`);
}
