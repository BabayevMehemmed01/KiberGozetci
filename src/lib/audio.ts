import type { AcousticReport, AudioClass, ClassDistribution } from "./dsp.ts";

export const FORENSIC_RATE = 16000;

export interface PreprocessedAudio {
  samples: Float32Array;
  sampleRate: number;
  activeSec: number;
  rms: number;
  status: "ok" | "short" | "weak";
}

function mixChannels(channels: ArrayLike<number>[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  const mono = new Float32Array(length);
  if (channels.length === 0) return mono;
  const scale = 1 / channels.length;
  for (const channel of channels) {
    for (let index = 0; index < length; index += 1) mono[index] += (channel[index] ?? 0) * scale;
  }
  return mono;
}

function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;
  const length = Math.max(1, Math.round((samples.length * toRate) / fromRate));
  const output = new Float32Array(length);
  const scale = fromRate / toRate;
  const last = samples.length - 1;
  for (let index = 0; index < length; index += 1) {
    const position = index * scale;
    const left = Math.min(last, Math.floor(position));
    const right = Math.min(last, left + 1);
    const frac = position - left;
    const a = samples[left] ?? 0;
    const b = samples[right] ?? a;
    output[index] = a + (b - a) * frac;
  }
  return output;
}

function signalRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / samples.length);
}

function finishPreprocess(mono: Float32Array, rate: number): PreprocessedAudio {
  const resampled = resampleLinear(mono, rate, FORENSIC_RATE);
  const frame = Math.round(FORENSIC_RATE * 0.025);
  const hop = Math.round(FORENSIC_RATE * 0.01);
  const energies: number[] = [];
  for (let start = 0; start + frame <= resampled.length; start += hop) {
    let sum = 0;
    for (let index = 0; index < frame; index += 1) {
      const value = resampled[start + index];
      sum += value * value;
    }
    energies.push(Math.sqrt(sum / frame));
  }
  const empty = { samples: new Float32Array(0), sampleRate: FORENSIC_RATE, activeSec: 0, rms: signalRms(resampled), status: "short" as const };
  if (energies.length === 0) return empty;
  const sorted = [...energies].sort((left, right) => left - right);
  const noise = sorted[Math.floor(sorted.length * 0.15)] ?? 0;
  const peak = sorted[sorted.length - 1] ?? 0;
  const threshold = Math.min(peak * 0.45, Math.max(0.006, noise * 2.1, peak * 0.08));
  let first = -1;
  let last = -1;
  let active = 0;
  for (let index = 0; index < energies.length; index += 1) {
    if (energies[index] < threshold) continue;
    if (first < 0) first = index;
    last = index;
    active += 1;
  }
  const activeSec = (active * hop) / FORENSIC_RATE;
  const wholeRms = signalRms(resampled);
  if (first < 0) return { ...empty, rms: wholeRms, status: wholeRms < 0.008 ? "weak" : "short" };
  const start = first * hop;
  const end = Math.min(resampled.length, last * hop + frame);
  const cut = resampled.subarray(start, end);
  const cutRms = signalRms(cut);
  if (activeSec < 1.5 || cutRms < 0.008) {
    return {
      samples: new Float32Array(cut),
      sampleRate: FORENSIC_RATE,
      activeSec,
      rms: cutRms,
      status: cutRms < 0.008 ? "weak" : "short",
    };
  }
  let peakAbs = 0;
  for (let index = 0; index < cut.length; index += 1) peakAbs = Math.max(peakAbs, Math.abs(cut[index]));
  const peakGain = peakAbs > 1e-8 ? 0.98 / peakAbs : 1;
  const peaked = new Float32Array(cut.length);
  for (let index = 0; index < cut.length; index += 1) peaked[index] = cut[index] * peakGain;
  const peakedRms = signalRms(peaked);
  const rmsGain = peakedRms > 1e-8 ? Math.min(4, 0.12 / peakedRms) : 1;
  const normalized = new Float32Array(peaked.length);
  for (let index = 0; index < peaked.length; index += 1) {
    const value = peaked[index] * rmsGain;
    normalized[index] = value > 1 ? 1 : value < -1 ? -1 : value;
  }
  return { samples: normalized, sampleRate: FORENSIC_RATE, activeSec, rms: cutRms, status: "ok" };
}

export function preprocessAudio(source: AudioBuffer | Float32Array, sampleRate?: number): PreprocessedAudio {
  if (source instanceof Float32Array) return finishPreprocess(source, sampleRate ?? FORENSIC_RATE);
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) channels.push(source.getChannelData(channel));
  return finishPreprocess(mixChannels(channels), source.sampleRate);
}

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
  buffer: AudioBuffer;
}

export const SHORT_SPEECH_MESSAGE = "UNCERTAIN / INCONCLUSIVE";

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

export function emptyDistribution(): ClassDistribution {
  return { real: 0, generated: 0, cloned: 0, confidence: 0 };
}

export function shortSpeechReport(kind: AudioClass = "uncertain"): AcousticReport {
  return {
    probability: 0,
    vocoder: 0,
    breathNatural: 0,
    spectrumAnomaly: 0,
    unreliable: true,
    pattern: "mixed",
    audioClass: kind,
    distribution: emptyDistribution(),
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
    reasons: [
      {
        title: SHORT_SPEECH_MESSAGE,
        detail:
          "QEYRİ-MÜƏYYƏN / KİFAYƏT QƏDƏR SİQNAL YOXDUR. Real İnsan Ehtimalı: 0% | AI-Generated Ehtimalı: 0% | AI-Cloned Ehtimalı: 0% | Əminlik Səviyyəsi: 0% | Vəziyyət: UNCERTAIN / INCONCLUSIVE",
      },
    ],
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
