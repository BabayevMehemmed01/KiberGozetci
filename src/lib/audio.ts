import type { AcousticReport } from "./dsp.ts";

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
  buffer: AudioBuffer;
}

export const SHORT_SPEECH_MESSAGE = "Aktiv səs müddəti kifayət deyil — ən azı 2 saniyə aydın danışın";

export function trimAndNormalize(samples: Float32Array, sampleRate: number): { samples: Float32Array; activeSec: number } {
  const frame = Math.max(1, Math.round(sampleRate * 0.025));
  const hop = Math.max(1, Math.round(sampleRate * 0.01));
  const energies: number[] = [];
  for (let start = 0; start + frame <= samples.length; start += hop) {
    let sum = 0;
    for (let index = 0; index < frame; index += 1) sum += samples[start + index] * samples[start + index];
    energies.push(Math.sqrt(sum / frame));
  }
  if (energies.length === 0) return { samples: new Float32Array(0), activeSec: 0 };
  const sorted = [...energies].sort((left, right) => left - right);
  const noise = sorted[Math.floor(sorted.length * 0.15)] ?? 0;
  const peak = sorted[sorted.length - 1] ?? 0;
  const threshold = Math.max(0.008, noise * 2.2, peak * 0.12);
  let first = -1;
  let last = -1;
  let active = 0;
  for (let index = 0; index < energies.length; index += 1) {
    if (energies[index] < threshold) continue;
    if (first < 0) first = index;
    last = index;
    active += 1;
  }
  const activeSec = (active * hop) / sampleRate;
  if (first < 0 || last < first) return { samples: new Float32Array(0), activeSec: 0 };
  const start = first * hop;
  const end = Math.min(samples.length, last * hop + frame);
  const cut = samples.subarray(start, end);
  let sumSquares = 0;
  for (let index = 0; index < cut.length; index += 1) sumSquares += cut[index] * cut[index];
  const rms = Math.sqrt(sumSquares / Math.max(1, cut.length));
  const gain = rms > 1e-6 ? 0.12 / rms : 1;
  const normalized = new Float32Array(cut.length);
  for (let index = 0; index < cut.length; index += 1) {
    const value = cut[index] * gain;
    normalized[index] = value > 1 ? 1 : value < -1 ? -1 : value;
  }
  return { samples: normalized, activeSec };
}

export function shortSpeechReport(): AcousticReport {
  return {
    probability: 0,
    vocoder: 0,
    breathNatural: 0,
    spectrumAnomaly: 0,
    unreliable: true,
    pattern: "mixed",
    metrics: {
      pitchJitter: 0,
      breathRatio: 0,
      pauseCount: 0,
      pauseIntervalMs: 0,
      harmonicity: 0,
      spectralFlatness: 0,
      harmonicRegularity: 0,
      amplitudeVariation: 0,
      voicedRatio: 0,
      pauseNoise: 0,
      formantRatio: 0,
      shelfRatio: 0,
      zcrMean: 0,
      zcrVariation: 0,
    },
    bands: { low: 0, mid: 0, high: 0, air: 0 },
    reasons: [{ title: SHORT_SPEECH_MESSAGE, detail: "" }],
    mitre: "T1656 — Impersonation / Deepfake",
  };
}

export async function decodeToMono(context: AudioContext, data: ArrayBuffer): Promise<DecodedAudio> {
  const buffer = await context.decodeAudioData(data.slice(0));
  const samples = new Float32Array(buffer.length);
  const channels = buffer.numberOfChannels;
  for (let channel = 0; channel < channels; channel += 1) {
    const dataChannel = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1) {
      samples[index] += dataChannel[index] / channels;
    }
  }
  return { samples, sampleRate: buffer.sampleRate, buffer };
}
