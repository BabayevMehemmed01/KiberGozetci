import { clamp } from "./utils.ts";

export interface AcousticMetrics {
  pitchJitter: number;
  breathRatio: number;
  pauseCount: number;
  harmonicity: number;
  spectralFlatness: number;
  harmonicRegularity: number;
  amplitudeVariation: number;
  voicedRatio: number;
}

export interface AcousticReport {
  probability: number;
  vocoder: number;
  breathNatural: number;
  spectrumAnomaly: number;
  unreliable: boolean;
  pattern: "speech" | "synthetic" | "mixed";
  metrics: AcousticMetrics;
}

export function verdictFor(report: Pick<AcousticReport, "probability" | "unreliable">): {
  label: string;
  tone: "critical" | "warning" | "safe" | "muted";
} {
  if (report.unreliable) return { label: "KİFAYƏT QƏDƏR SİQNAL YOXDUR", tone: "muted" };
  if (report.probability >= 75) return { label: "SÜNI SİNTEZ AŞKARLANDI", tone: "critical" };
  if (report.probability >= 40) return { label: "ŞÜBHƏLİ SƏS İZİ", tone: "warning" };
  return { label: "HƏQİQİ İNSAN SƏSİ", tone: "safe" };
}

const FRAME = 1024;
const HOP = 512;
const FFT = 512;
const HANN_FRAME = new Float64Array(FRAME);
const HANN_FFT = new Float64Array(FFT);

for (let index = 0; index < FRAME; index += 1) {
  HANN_FRAME[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (FRAME - 1)));
}
for (let index = 0; index < FFT; index += 1) {
  HANN_FFT[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (FFT - 1)));
}

function ramp(value: number, low: number, high: number): number {
  if (value <= low) return 0;
  if (value >= high) return 100;
  return ((value - low) / (high - low)) * 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function takeEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const picked: T[] = [];
  for (let index = 0; index < max; index += 1) {
    picked.push(items[Math.floor((index * items.length) / max)]);
  }
  return picked;
}

function rmsOf(samples: Float32Array, offset: number, length: number): number {
  let energy = 0;
  for (let index = 0; index < length; index += 1) {
    const value = samples[offset + index];
    energy += value * value;
  }
  return Math.sqrt(energy / length);
}

function pitchAndHarmonicity(
  samples: Float32Array,
  offset: number,
  sampleRate: number,
): { f0: number; harmonicity: number } {
  const minLag = Math.max(8, Math.floor(sampleRate / 420));
  const maxLag = Math.min(FRAME - 2, Math.floor(sampleRate / 70));
  const windowed = new Float64Array(FRAME);
  let energy = 0;
  for (let index = 0; index < FRAME; index += 1) {
    windowed[index] = samples[offset + index] * HANN_FRAME[index];
    energy += windowed[index] * windowed[index];
  }
  if (energy < 1e-8) return { f0: 0, harmonicity: 0 };

  let bestLag = minLag;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    const limit = FRAME - lag;
    for (let index = 0; index < limit; index += 1) {
      correlation += windowed[index] * windowed[index + lag];
    }
    const normalized = correlation / energy;
    if (normalized > best) {
      best = normalized;
      bestLag = lag;
    }
  }
  return { f0: sampleRate / bestLag, harmonicity: Math.max(0, Math.min(1, best)) };
}

function magnitudeSpectrum(samples: Float32Array, offset: number): Float64Array {
  const mags = new Float64Array(FFT / 2);
  for (let bin = 1; bin < FFT / 2; bin += 1) {
    let real = 0;
    let imag = 0;
    const base = (-2 * Math.PI * bin) / FFT;
    for (let index = 0; index < FFT; index += 1) {
      const value = samples[offset + index] * HANN_FFT[index];
      const angle = base * index;
      real += value * Math.cos(angle);
      imag += value * Math.sin(angle);
    }
    mags[bin] = Math.hypot(real, imag);
  }
  return mags;
}

function spectralFlatness(mags: Float64Array): number {
  let logSum = 0;
  let arithmetic = 0;
  let count = 0;
  for (let bin = 1; bin < mags.length; bin += 1) {
    const power = mags[bin] * mags[bin] + 1e-12;
    arithmetic += power;
    logSum += Math.log(power);
    count += 1;
  }
  const geometric = Math.exp(logSum / count);
  return geometric / (arithmetic / count);
}

function harmonicRegularity(mags: Float64Array, sampleRate: number): number {
  const binHz = sampleRate / FFT;
  const start = Math.max(1, Math.floor(75 / binHz));
  const end = Math.min(mags.length - 2, Math.floor(340 / binHz));
  let peakBin = start;
  let peak = 0;
  for (let bin = start; bin <= end; bin += 1) {
    if (mags[bin] > peak) {
      peak = mags[bin];
      peakBin = bin;
    }
  }
  if (peak <= 0) return 0;

  let harmonic = 0;
  let valley = 0;
  for (let partial = 1; partial <= 8; partial += 1) {
    const center = peakBin * partial;
    if (center + 1 >= mags.length) break;
    harmonic += mags[center - 1] + mags[center] + mags[center + 1];
    const between = Math.min(mags.length - 1, Math.round(peakBin * (partial + 0.5)));
    valley += mags[between];
  }
  return harmonic / (harmonic + valley * 3 + 1e-9);
}

function emptyReport(): AcousticReport {
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
      harmonicity: 0,
      spectralFlatness: 0,
      harmonicRegularity: 0,
      amplitudeVariation: 0,
      voicedRatio: 0,
    },
  };
}

export function analyzePcm(samples: Float32Array, sampleRate: number): AcousticReport {
  if (samples.length < FRAME || sampleRate < 8000) return emptyReport();

  const frames: { offset: number; rms: number }[] = [];
  for (let offset = 0; offset + FRAME <= samples.length; offset += HOP) {
    frames.push({ offset, rms: rmsOf(samples, offset, FRAME) });
  }
  if (frames.length < 6) return emptyReport();

  const rmsValues = frames.map((frame) => frame.rms);
  const meanRms = average(rmsValues);
  const amplitudeVariation = Math.sqrt(average(rmsValues.map((value) => (value - meanRms) ** 2))) / (meanRms || 1);
  const peakRms = Math.max(...rmsValues);
  const breathCut = Math.max(0.012, peakRms * 0.18);
  const voiceCut = Math.max(breathCut + 0.015, peakRms * 0.42);
  const breathFrames = frames.filter((frame) => frame.rms < breathCut).length;
  const breathRatio = breathFrames / frames.length;

  let pauseCount = 0;
  let run = 0;
  for (const frame of frames) {
    if (frame.rms < breathCut) {
      run += 1;
    } else {
      if (run >= 3) pauseCount += 1;
      run = 0;
    }
  }
  if (run >= 3) pauseCount += 1;

  const voiced = frames.filter((frame) => frame.rms >= voiceCut);
  const voicedRatio = voiced.length / frames.length;
  if (voiced.length < 4) return emptyReport();

  const picked = takeEvenly(voiced, 16);
  const pitches: number[] = [];
  const harmonicities: number[] = [];
  const flatnesses: number[] = [];
  const regularities: number[] = [];

  for (const frame of picked) {
    const pitch = pitchAndHarmonicity(samples, frame.offset, sampleRate);
    if (pitch.f0 >= 70 && pitch.f0 <= 420) {
      pitches.push(pitch.f0);
      harmonicities.push(pitch.harmonicity);
    }
    const spectrum = magnitudeSpectrum(samples, frame.offset);
    flatnesses.push(spectralFlatness(spectrum));
    regularities.push(harmonicRegularity(spectrum, sampleRate));
  }

  const pitchCenter = median(pitches);
  const stablePitches =
    pitchCenter > 0 ? pitches.filter((pitch) => Math.abs(pitch - pitchCenter) / pitchCenter < 0.45) : [];
  const pitchMedian = median(stablePitches);
  let step = 0;
  for (let index = 1; index < stablePitches.length; index += 1) {
    step += Math.abs(stablePitches[index] - stablePitches[index - 1]);
  }
  const relStep = stablePitches.length > 1 ? step / (stablePitches.length - 1) / (pitchMedian || 1) : 0;
  const pitchCv =
    pitchMedian > 0
      ? Math.sqrt(average(stablePitches.map((pitch) => (pitch - pitchMedian) ** 2))) / pitchMedian
      : 0;
  const pitchJitter = Math.max(pitchCv, relStep);
  const harmonicity = average(harmonicities);
  const flatness = average(flatnesses);
  const regularity = average(regularities);

  const clean = average([
    ramp(harmonicity, 0.5, 0.9),
    ramp(regularity, 0.42, 0.84),
    ramp(0.36 - flatness, 0, 0.3),
  ]);
  const locked = average([
    100 - ramp(pitchJitter, 0.012, 0.07),
    100 - ramp(amplitudeVariation, 0.08, 0.48),
    100 - ramp(breathRatio, 0.03, 0.16),
  ]);
  let vocoder = clamp(clean * 0.4 + locked * 0.6);
  let breathNatural = clamp(ramp(breathRatio, 0.02, 0.16) * 0.7 + ramp(pauseCount, 0, 3) * 0.3);
  let spectrumAnomaly = clamp(
    (100 - ramp(pitchJitter, 0.012, 0.08)) * 0.55 + (100 - ramp(amplitudeVariation, 0.08, 0.5)) * 0.45,
  );

  const speechLike = pauseCount >= 2 && pitchJitter >= 0.04 && amplitudeVariation >= 0.25;
  const robotLike =
    pauseCount === 0 && breathRatio < 0.045 && pitchJitter < 0.02 && amplitudeVariation < 0.14 && harmonicity > 0.72;

  let probability = vocoder * 0.38 + (100 - breathNatural) * 0.34 + spectrumAnomaly * 0.28;
  let pattern: AcousticReport["pattern"] = "mixed";
  if (speechLike && !robotLike) {
    pattern = "speech";
    probability *= 0.72;
    vocoder = Math.min(vocoder, 36);
    breathNatural = Math.max(breathNatural, 74);
    spectrumAnomaly = Math.min(spectrumAnomaly, 28);
  } else if (robotLike && !speechLike) {
    pattern = "synthetic";
    probability = Math.max(probability, 91);
    vocoder = Math.max(vocoder, 84);
    breathNatural = Math.min(breathNatural, 16);
    spectrumAnomaly = Math.max(spectrumAnomaly, 82);
  }

  return {
    probability: Math.round(clamp(probability) * 10) / 10,
    vocoder: Math.round(clamp(vocoder)),
    breathNatural: Math.round(clamp(breathNatural)),
    spectrumAnomaly: Math.round(clamp(spectrumAnomaly)),
    unreliable: false,
    pattern,
    metrics: {
      pitchJitter: Number(pitchJitter.toFixed(4)),
      breathRatio: Number(breathRatio.toFixed(4)),
      pauseCount,
      harmonicity: Number(harmonicity.toFixed(4)),
      spectralFlatness: Number(flatness.toFixed(4)),
      harmonicRegularity: Number(regularity.toFixed(4)),
      amplitudeVariation: Number(amplitudeVariation.toFixed(4)),
      voicedRatio: Number(voicedRatio.toFixed(4)),
    },
  };
}
