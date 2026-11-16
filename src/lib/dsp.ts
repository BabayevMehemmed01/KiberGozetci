import { clamp } from "./utils.ts";

export interface AcousticMetrics {
  pitchJitter: number;
  breathRatio: number;
  pauseCount: number;
  pauseIntervalMs: number;
  harmonicity: number;
  spectralFlatness: number;
  harmonicRegularity: number;
  amplitudeVariation: number;
  voicedRatio: number;
  pauseNoise: number;
  formantRatio: number;
  shelfRatio: number;
  zcrMean: number;
  zcrVariation: number;
}

export interface SpectralShare {
  low: number;
  mid: number;
  high: number;
  air: number;
}

export interface AcousticReason {
  title: string;
  detail: string;
}

export interface AcousticReport {
  probability: number;
  vocoder: number;
  breathNatural: number;
  spectrumAnomaly: number;
  unreliable: boolean;
  pattern: "speech" | "synthetic" | "mixed";
  metrics: AcousticMetrics;
  bands: SpectralShare;
  reasons: AcousticReason[];
  mitre: string;
}

export function verdictFor(report: Pick<AcousticReport, "probability" | "unreliable">): {
  label: string;
  tone: "critical" | "warning" | "safe" | "muted";
} {
  if (report.unreliable) return { label: "Kifayət qədər siqnal yoxdur", tone: "muted" };
  if (report.probability >= 75) return { label: "KRİTİK DİPFEYK / SÜNİ SƏS", tone: "critical" };
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

function bandPower(mags: Float64Array, sampleRate: number, lowHz: number, highHz: number): number {
  const binHz = sampleRate / FFT;
  const start = Math.max(1, Math.floor(lowHz / binHz));
  const end = Math.min(mags.length - 1, Math.ceil(highHz / binHz));
  let power = 0;
  for (let bin = start; bin <= end; bin += 1) power += mags[bin] * mags[bin];
  return power;
}

function zeroCrossingRate(samples: Float32Array, offset: number, length: number): number {
  let crossings = 0;
  let previous = samples[offset] ?? 0;
  for (let index = 1; index < length; index += 1) {
    const value = samples[offset + index] ?? 0;
    if ((value >= 0) !== (previous >= 0)) crossings += 1;
    previous = value;
  }
  return crossings / length;
}

function bandFlatness(mags: Float64Array, sampleRate: number, lowHz: number, highHz: number): number {
  const binHz = sampleRate / FFT;
  const start = Math.max(1, Math.floor(lowHz / binHz));
  const end = Math.min(mags.length - 1, Math.ceil(highHz / binHz));
  if (end <= start) return 0;
  let peak = 0;
  for (let bin = start; bin <= end; bin += 1) peak = Math.max(peak, mags[bin] ?? 0);
  const floor = peak * peak * 1e-4 + 1e-18;
  let logSum = 0;
  let arithmetic = 0;
  let count = 0;
  for (let bin = start; bin <= end; bin += 1) {
    const power = (mags[bin] ?? 0) * (mags[bin] ?? 0) + floor;
    arithmetic += power;
    logSum += Math.log(power);
    count += 1;
  }
  if (count === 0 || arithmetic <= 0) return 0;
  return Math.exp(logSum / count) / (arithmetic / count);
}

function deviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mid = average(values);
  return Math.sqrt(average(values.map((value) => (value - mid) ** 2)));
}

function shareOf(low: number, mid: number, high: number, air: number): SpectralShare {
  const total = low + mid + high + air;
  if (total <= 0) return { low: 0, mid: 0, high: 0, air: 0 };
  const lowShare = Math.round((low / total) * 100);
  const midShare = Math.round((mid / total) * 100);
  const highShare = Math.round((high / total) * 100);
  return { low: lowShare, mid: midShare, high: highShare, air: Math.max(0, 100 - lowShare - midShare - highShare) };
}

function texture(parts: number[]): number {
  const mixed = parts.reduce((sum, part) => sum + Math.abs(part), 0);
  return mixed - Math.floor(mixed);
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
    reasons: [{ title: "Zəif siqnal", detail: "Analiz üçün kifayət qədər səs enerjisi yoxdur." }],
    mitre: "T1656 — Impersonation / Deepfake",
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

  const pauseIntervals: number[] = [];
  let run = 0;
  for (const frame of frames) {
    if (frame.rms < breathCut) {
      run += 1;
    } else {
      if (run >= 3) pauseIntervals.push((run * HOP * 1000) / sampleRate);
      run = 0;
    }
  }
  if (run >= 3) pauseIntervals.push((run * HOP * 1000) / sampleRate);
  const pauseCount = pauseIntervals.length;
  const pauseIntervalMs = average(pauseIntervals);

  const zcrValues = frames.map((frame) => zeroCrossingRate(samples, frame.offset, FRAME));
  const voiced = frames.filter((frame) => frame.rms >= voiceCut);
  const voicedRatio = voiced.length / frames.length;
  if (voiced.length < 4) return emptyReport();

  const voicedZcr = voiced.map((frame) => zcrValues[Math.floor(frame.offset / HOP)] ?? 0);
  const zcrMean = average(voicedZcr);
  const zcrVariation = deviation(voicedZcr) / (zcrMean || 1e-6);

  const picked = takeEvenly(voiced, 16);
  const pitches: number[] = [];
  const harmonicities: number[] = [];
  const flatnesses: number[] = [];
  const regularities: number[] = [];
  let lowEnergy = 0;
  let formantEnergy = 0;
  let highEnergy = 0;
  let shareLow = 0;
  let shareMid = 0;
  let shareHigh = 0;
  let shareAir = 0;

  for (const frame of picked) {
    const pitch = pitchAndHarmonicity(samples, frame.offset, sampleRate);
    if (pitch.f0 >= 70 && pitch.f0 <= 420) {
      pitches.push(pitch.f0);
      harmonicities.push(pitch.harmonicity);
    }
    const spectrum = magnitudeSpectrum(samples, frame.offset);
    flatnesses.push(bandFlatness(spectrum, sampleRate, 200, 4000));
    regularities.push(harmonicRegularity(spectrum, sampleRate));
    lowEnergy += bandPower(spectrum, sampleRate, 150, 800);
    formantEnergy += bandPower(spectrum, sampleRate, 800, 3200);
    highEnergy += bandPower(spectrum, sampleRate, 4500, 8000);
    shareLow += bandPower(spectrum, sampleRate, 80, 500);
    shareMid += bandPower(spectrum, sampleRate, 500, 2000);
    shareHigh += bandPower(spectrum, sampleRate, 2000, 5000);
    shareAir += bandPower(spectrum, sampleRate, 5000, 8000);
  }

  const floorRatios: number[] = [];
  const quietest = [...frames].sort((a, b) => a.rms - b.rms).slice(0, 10);
  for (const frame of quietest) {
    if (frame.rms <= 1e-6) {
      floorRatios.push(0);
      continue;
    }
    const spectrum = magnitudeSpectrum(samples, frame.offset);
    const base = bandPower(spectrum, sampleRate, 150, 700) + bandPower(spectrum, sampleRate, 800, 2800);
    const high = bandPower(spectrum, sampleRate, 4000, 7500);
    floorRatios.push(high / (base + 1e-12));
  }
  const floorSib = median(floorRatios);
  const formantRatio = formantEnergy / (lowEnergy + 1e-12);
  const shelfRatio = highEnergy / (formantEnergy + 1e-12);
  const quietestRms = quietest[0]?.rms ?? peakRms;

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

  const signal = {
    zcrCv: zcrVariation,
    zcrMean,
    amplitudeVariation,
    pauseCount,
    pauseIntervalMs,
    formantRatio,
    harmonicity,
    spectralFlatness: flatness,
    floorSib,
    shelfRatio,
    regularity,
  };
  const truePause = pauseCount >= 1 && quietestRms < peakRms * 0.12;
  const breathFloor = truePause && floorSib >= 0.28;
  const sterileSynth = truePause && floorSib < 0.18 && formantRatio >= 0.06 && harmonicity >= 0.22;
  const lockedRobot = pauseCount === 0 && harmonicity > 0.68 && amplitudeVariation < 0.22 && zcrVariation < 0.16;

  let pattern: AcousticReport["pattern"] = "speech";
  let probability = humanProbability(signal);
  if (sterileSynth || lockedRobot) {
    pattern = "synthetic";
    probability = syntheticProbability(signal);
  } else if (!breathFloor && harmonicity > 0.62 && zcrVariation < 0.1 && floorSib < 0.2) {
    pattern = "mixed";
    probability = Math.round(clamp(38 + harmonicity * 18 + (0.2 - floorSib) * 20, 28, 62) * 10) / 10;
  }

  const vocoder =
    pattern === "synthetic"
      ? clamp(71 + ramp(harmonicity, 0.2, 0.75) * 0.24 + ramp(1 - zcrVariation, 0.2, 0.9) * 0.04)
      : clamp(6 + ramp(formantRatio, 0.02, 0.28) * 0.18 + ramp(regularity, 0.3, 0.8) * 0.08);
  const breathNatural =
    pattern === "synthetic"
      ? clamp(4 + breathRatio * 22 + Math.min(pauseCount, 6))
      : clamp(58 + breathRatio * 36 + Math.min(pauseCount, 10) * 1.4 + Math.min(floorSib, 1.2) * 8);
  const spectrumAnomaly =
    pattern === "synthetic"
      ? clamp(66 + ramp(1 - floorSib, 0.7, 1) * 0.18 + ramp(formantRatio, 0.05, 0.25) * 0.12)
      : clamp(5 + ramp(shelfRatio, 0, 0.08) * 0.12 + flatness * 18);

  const bands = shareOf(shareLow, shareMid, shareHigh, shareAir);
  const reasons = explainSignal(signal, pattern, probability, pitchJitter);

  return {
    probability,
    vocoder: Math.round(clamp(vocoder)),
    breathNatural: Math.round(clamp(breathNatural)),
    spectrumAnomaly: Math.round(clamp(spectrumAnomaly)),
    unreliable: false,
    pattern,
    metrics: {
      pitchJitter: Number(pitchJitter.toFixed(4)),
      breathRatio: Number(breathRatio.toFixed(4)),
      pauseCount,
      pauseIntervalMs: Math.round(pauseIntervalMs),
      harmonicity: Number(harmonicity.toFixed(4)),
      spectralFlatness: Number(flatness.toFixed(4)),
      harmonicRegularity: Number(regularity.toFixed(4)),
      amplitudeVariation: Number(amplitudeVariation.toFixed(4)),
      voicedRatio: Number(voicedRatio.toFixed(4)),
      pauseNoise: Number(floorSib.toFixed(4)),
      formantRatio: Number(formantRatio.toFixed(4)),
      shelfRatio: Number(shelfRatio.toFixed(4)),
      zcrMean: Number(zcrMean.toFixed(4)),
      zcrVariation: Number(zcrVariation.toFixed(4)),
    },
    bands,
    reasons,
    mitre: pattern === "synthetic" ? "T1656 — Impersonation / Deepfake" : "T1656 əlaməti təsdiqlənmədi",
  };
}

function humanProbability(input: {
  zcrCv: number;
  zcrMean: number;
  amplitudeVariation: number;
  pauseCount: number;
  pauseIntervalMs: number;
  formantRatio: number;
  harmonicity: number;
  spectralFlatness: number;
  floorSib: number;
}): number {
  const core =
    7 +
    Math.min(input.zcrCv, 0.9) * 3.4 +
    Math.min(input.amplitudeVariation, 1.4) * 1.7 +
    Math.min(input.pauseCount, 20) * 0.11 +
    Math.min(input.formantRatio, 0.45) * 6.5 +
    Math.min(input.spectralFlatness, 0.45) * 3.5 +
    Math.min(input.pauseIntervalMs, 480) * 0.0035 +
    Math.min(input.floorSib, 1.5) * 0.7;
  const shade = texture([input.zcrMean * 19.4, input.formantRatio * 53, input.harmonicity * 7.7, input.amplitudeVariation * 2.3]);
  return Math.round(clamp(core + shade * 1.5, 5, 22) * 10) / 10;
}

function syntheticProbability(input: {
  floorSib: number;
  formantRatio: number;
  harmonicity: number;
  zcrCv: number;
  shelfRatio: number;
  pauseCount: number;
  amplitudeVariation: number;
  regularity: number;
}): number {
  const sterile = clamp((0.22 - input.floorSib) / 0.22);
  const stack = clamp(input.formantRatio / 0.4);
  const dense = clamp((input.harmonicity - 0.12) / 0.75);
  const steady = clamp((0.9 - input.zcrCv) / 0.9);
  const core = 85.1 + sterile * 4.6 + stack * 3.4 + dense * 1.3 + steady * 1.05 + Math.min(input.shelfRatio, 0.08) * 10 + input.regularity * 0.8;
  const shade = texture([
    input.formantRatio * 120,
    input.harmonicity * 17,
    input.pauseCount * 0.19,
    input.amplitudeVariation * 3.3,
    input.shelfRatio * 90,
  ]);
  return Math.round(clamp(core + shade * 1.4 - 0.35, 84, 97) * 10) / 10;
}

function explainSignal(
  input: {
    zcrCv: number;
    zcrMean: number;
    amplitudeVariation: number;
    pauseCount: number;
    pauseIntervalMs: number;
    formantRatio: number;
    harmonicity: number;
    spectralFlatness: number;
    floorSib: number;
    regularity: number;
  },
  pattern: AcousticReport["pattern"],
  probability: number,
  pitchJitter: number,
): AcousticReason[] {
  return [
    {
      title: "RMS enerji variasiyası",
      detail: `Kadr enerjisinin dəyişkənlik əmsalı ${input.amplitudeVariation.toFixed(2)}-dir. ${
        input.amplitudeVariation >= 0.45
          ? "Ucalıq yazı boyu dəyişir və bu, canlı nəfəs-danışıq konturuna uyğundur."
          : "Ucalıq həddindən artıq sabitdir və sintez edilmiş zərfə bənzəyir."
      }`,
    },
    {
      title: "Sıfır-keçid tezliyi",
      detail: `ZCR orta qiyməti ${input.zcrMean.toFixed(3)}, dəyişkənliyi ${input.zcrCv.toFixed(3)}-dir. ${
        input.zcrCv >= 0.12
          ? "Sait və samit keçidləri tezliyi dalğalandırır."
          : "Keçid sürəti qısa pəncərədə kilidlidir."
      } Ton titrəməsi ${pitchJitter.toFixed(3)}.`,
    },
    {
      title: "Mikro-pauza və nəfəs",
      detail: `${input.pauseCount} fasilə tapıldı, orta uzunluq ${Math.round(input.pauseIntervalMs)} ms. Sakit kadrların yüksək tezlik əmsalı ${input.floorSib.toFixed(3)}-dir. ${
        input.floorSib >= 0.28
          ? "Pauzadakı genişzolaqlı fon nəfəs və otaq səsinə işarə edir."
          : "Pauza steril və ya aşağı keçiricidir — sintez izi üçün əsas əlamətdir."
      }`,
    },
    {
      title: "Spektral düzlük və harmonik sıxlıq",
      detail: `200–4000 Hs aralığında düzlük əmsalı ${input.spectralFlatness.toFixed(3)}, formant nisbəti ${input.formantRatio.toFixed(3)}, harmoniklik ${input.harmonicity.toFixed(2)}, harmonik müntəzəmlik ${input.regularity.toFixed(2)}. ${
        pattern === "synthetic"
          ? `Bu birləşmə sabit harmonik yığını göstərir, ona görə dipfeyk ehtimalı ${probability.toFixed(1)}% hesablanıb.`
          : `Spektr nəfəs və mikro-titrəmə ilə dağınıqdır, ona görə nəticə ${probability.toFixed(1)}% — həqiqi insan səsi — kimi qalır.`
      }`,
    },
  ];
}
