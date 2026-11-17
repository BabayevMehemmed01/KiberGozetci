import { preprocessAudio } from "./audio.ts";
import type { AcousticReason, AcousticReport, AudioClass, ClassDistribution } from "./dsp.ts";
import { clamp } from "./utils.ts";

const RATE = 16000;
const FRAME = 400;
const HOP = 160;
const FFT = 512;
const MEL_BANDS = 26;
const MFCC_COUNT = 13;

const HANN = new Float64Array(FRAME);
for (let index = 0; index < FRAME; index += 1) {
  HANN[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (FRAME - 1)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

function buildMelBank(): number[][] {
  const filters: number[][] = [];
  const low = hzToMel(80);
  const high = hzToMel(7600);
  const points = new Array<number>(MEL_BANDS + 2);
  for (let index = 0; index < points.length; index += 1) {
    const hz = melToHz(low + ((high - low) * index) / (MEL_BANDS + 1));
    points[index] = Math.floor((FFT * hz) / RATE);
  }
  for (let band = 1; band <= MEL_BANDS; band += 1) {
    const filter = new Array<number>(FFT / 2).fill(0);
    const left = points[band - 1] ?? 0;
    const center = points[band] ?? left;
    const right = points[band + 1] ?? center;
    for (let bin = left; bin < center; bin += 1) {
      if (bin > 0 && bin < filter.length && center !== left) filter[bin] = (bin - left) / (center - left);
    }
    for (let bin = center; bin < right; bin += 1) {
      if (bin > 0 && bin < filter.length && right !== center) filter[bin] = (right - bin) / (right - center);
    }
    filters.push(filter);
  }
  return filters;
}

const MEL = buildMelBank();

function bitReverse(frame: Float64Array): Float64Array {
  const real = new Float64Array(FFT);
  for (let index = 0; index < FFT; index += 1) {
    let reversed = index;
    let source = 0;
    for (let bit = FFT >> 1; bit > 0; bit >>= 1) {
      if (reversed & 1) source += bit;
      reversed >>= 1;
    }
    real[source] = frame[index] ?? 0;
  }
  return real;
}
function spectrumOf(samples: Float32Array, offset: number): Float64Array {
  const windowed = new Float64Array(FFT);
  const length = Math.min(FRAME, samples.length - offset);
  for (let index = 0; index < length; index += 1) windowed[index] = samples[offset + index] * HANN[index];
  const ordered = bitReverse(windowed);
  const imag = new Float64Array(FFT);
  for (let size = 2; size <= FFT; size *= 2) {
    const half = size / 2;
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < FFT; start += size) {
      for (let offsetBin = 0; offsetBin < half; offsetBin += 1) {
        const angle = step * offsetBin;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const even = start + offsetBin;
        const odd = even + half;
        const vr = ordered[odd] * wr - imag[odd] * wi;
        const vi = ordered[odd] * wi + imag[odd] * wr;
        ordered[odd] = ordered[even] - vr;
        imag[odd] = imag[even] - vi;
        ordered[even] += vr;
        imag[even] += vi;
      }
    }
  }
  const mags = new Float64Array(FFT / 2);
  for (let bin = 0; bin < mags.length; bin += 1) mags[bin] = Math.hypot(ordered[bin], imag[bin]);
  return mags;
}

function bandEnergy(mags: Float64Array, lowHz: number, highHz: number): number {
  const binHz = RATE / FFT;
  const start = Math.max(1, Math.floor(lowHz / binHz));
  const end = Math.min(mags.length - 1, Math.ceil(highHz / binHz));
  let energy = 0;
  for (let bin = start; bin <= end; bin += 1) energy += mags[bin] * mags[bin];
  return energy;
}

function frameRms(samples: Float32Array, offset: number): number {
  let sum = 0;
  const length = Math.min(FRAME, samples.length - offset);
  for (let index = 0; index < length; index += 1) {
    const value = samples[offset + index];
    sum += value * value;
  }
  return Math.sqrt(sum / Math.max(1, length));
}

function skewKurt(samples: Float32Array, offset: number): { skew: number; kurt: number; closure: number } {
  const length = Math.min(FRAME, samples.length - offset);
  let mean = 0;
  for (let index = 0; index < length; index += 1) mean += samples[offset + index];
  mean /= length;
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  let rise = 0;
  let fall = 0;
  for (let index = 0; index < length; index += 1) {
    const delta = samples[offset + index] - mean;
    const square = delta * delta;
    m2 += square;
    m3 += square * delta;
    m4 += square * square;
    if (index > 0) {
      const slope = samples[offset + index] - samples[offset + index - 1];
      if (slope > rise) rise = slope;
      if (-slope > fall) fall = -slope;
    }
  }
  m2 /= length;
  m3 /= length;
  m4 /= length;
  const std = Math.sqrt(m2);
  const skew = std > 1e-8 ? m3 / (std * std * std) : 0;
  const kurt = m2 > 1e-12 ? m4 / (m2 * m2) : 0;
  const closure = (fall - rise) / (fall + rise + 1e-9);
  return { skew, kurt, closure };
}

function estimateF0(samples: Float32Array, offset: number): { f0: number; harmonicity: number } {
  const length = Math.min(FRAME, samples.length - offset);
  const minLag = Math.max(16, Math.floor(RATE / 420));
  const maxLag = Math.min(length - 2, Math.floor(RATE / 70));
  let energy = 0;
  for (let index = 0; index < length; index += 1) {
    const value = samples[offset + index] * HANN[index];
    energy += value * value;
  }
  if (energy < 1e-8 || maxLag <= minLag) return { f0: 0, harmonicity: 0 };
  let bestLag = minLag;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    const limit = length - lag;
    for (let index = 0; index < limit; index += 1) {
      correlation += samples[offset + index] * HANN[index] * samples[offset + index + lag] * HANN[index + lag];
    }
    const normalized = correlation / energy;
    if (normalized > best) {
      best = normalized;
      bestLag = lag;
    }
  }
  return { f0: best > 0.25 ? RATE / bestLag : 0, harmonicity: Math.max(0, Math.min(1, best)) };
}

function mfccOf(mags: Float64Array): number[] {
  const mel = new Array<number>(MEL_BANDS);
  for (let band = 0; band < MEL_BANDS; band += 1) {
    let energy = 0;
    const filter = MEL[band];
    for (let bin = 0; bin < mags.length; bin += 1) energy += mags[bin] * mags[bin] * (filter[bin] ?? 0);
    mel[band] = Math.log(energy + 1e-10);
  }
  const coeffs = new Array<number>(MFCC_COUNT).fill(0);
  for (let k = 0; k < MFCC_COUNT; k += 1) {
    let sum = 0;
    for (let n = 0; n < MEL_BANDS; n += 1) sum += mel[n] * Math.cos((Math.PI * k * (n + 0.5)) / MEL_BANDS);
    coeffs[k] = sum;
  }
  return coeffs;
}

function deltaOf(frames: number[][]): number[][] {
  return frames.map((frame, time) => {
    const prev = frames[Math.max(0, time - 1)];
    const next = frames[Math.min(frames.length - 1, time + 1)];
    return frame.map((_, index) => ((next[index] ?? 0) - (prev[index] ?? 0)) / 2);
  });
}

function variance(frames: number[][]): number {
  if (frames.length < 3) return 0;
  const width = frames[0]?.length ?? 0;
  let total = 0;
  for (let index = 1; index < width; index += 1) {
    const column = frames.map((frame) => frame[index] ?? 0);
    const mean = average(column);
    total += average(column.map((value) => (value - mean) ** 2));
  }
  return total / Math.max(1, width - 1);
}

function tremorShare(pitches: number[]): number {
  if (pitches.length < 24) return 0;
  const mean = average(pitches);
  let low = 0;
  let band = 0;
  const step = HOP / RATE;
  for (let index = 1; index < pitches.length; index += 1) {
    const diff = pitches[index] - pitches[index - 1];
    low += diff * diff;
  }
  for (let hz = 8; hz <= 12; hz += 1) {
    let real = 0;
    let imag = 0;
    for (let index = 0; index < pitches.length; index += 1) {
      const angle = 2 * Math.PI * hz * index * step;
      const value = pitches[index] - mean;
      real += value * Math.cos(angle);
      imag += value * Math.sin(angle);
    }
    band += real * real + imag * imag;
  }
  return band / (band + low * pitches.length + 1e-9);
}

interface FeatureSet {
  skew: number;
  kurt: number;
  closure: number;
  jitter: number;
  shimmer: number;
  tremor: number;
  deltaDelta: number;
  hfCliff: number;
  checker: number;
  breath: number;
  pauseCount: number;
  harmonicity: number;
  voicedRatio: number;
  bands: { low: number; mid: number; high: number; air: number };
}

function measure(samples: Float32Array): FeatureSet {
  const offsets: number[] = [];
  for (let offset = 0; offset + FRAME <= samples.length; offset += HOP) offsets.push(offset);
  const levels = offsets.map((offset) => frameRms(samples, offset));
  const levelMedian = median(levels) || 1e-6;
  const voiceCut = Math.max(0.02, levelMedian * 0.72);
  const pauseCut = Math.max(0.008, levelMedian * 0.28);
  const skews: number[] = [];
  const kurts: number[] = [];
  const closures: number[] = [];
  const pitches: number[] = [];
  const amplitudes: number[] = [];
  const harmonicities: number[] = [];
  const mfccs: number[][] = [];
  const spectra: Float64Array[] = [];
  let low = 0;
  let mid = 0;
  let high = 0;
  let air = 0;
  let voiced = 0;
  let pauses = 0;
  let pauseSoft = 0;
  let pauseHard = 0;
  let cliffSum = 0;
  let cliffCount = 0;

  for (let index = 0; index < offsets.length; index += 1) {
    const offset = offsets[index];
    const level = levels[index] ?? 0;
    const shape = skewKurt(samples, offset);
    const pitch = estimateF0(samples, offset);
    const voicedFrame = level >= voiceCut && pitch.harmonicity >= 0.32 && pitch.f0 > 0;
    if (voicedFrame) {
      voiced += 1;
      skews.push(Math.abs(shape.skew));
      kurts.push(shape.kurt);
      closures.push(Math.abs(shape.closure));
      pitches.push(pitch.f0);
      amplitudes.push(level);
      harmonicities.push(pitch.harmonicity);
      const mags = spectrumOf(samples, offset);
      spectra.push(mags);
      mfccs.push(mfccOf(mags));
      const upper = bandEnergy(mags, 4000, 6000);
      const top = bandEnergy(mags, 6000, 7900);
      cliffSum += upper / (top + upper * 0.15 + 1e-9);
      cliffCount += 1;
      low += bandEnergy(mags, 80, 500);
      mid += bandEnergy(mags, 500, 2000);
      high += bandEnergy(mags, 2000, 5000);
      air += bandEnergy(mags, 5000, 7900);
    } else if (level < pauseCut) {
      pauses += 1;
      if (level < 0.004) pauseHard += 1;
      else {
        const mags = spectrumOf(samples, offset);
        const soft = bandEnergy(mags, 200, 1200);
        const total = bandEnergy(mags, 80, 7900) + 1e-9;
        if (soft / total >= 0.18) pauseSoft += 1;
      }
    }
  }

  let jitter = 0;
  let shimmer = 0;
  if (pitches.length > 2) {
    let step = 0;
    let ampStep = 0;
    for (let index = 1; index < pitches.length; index += 1) {
      step += Math.abs(pitches[index] - pitches[index - 1]);
      ampStep += Math.abs((amplitudes[index] ?? 0) - (amplitudes[index - 1] ?? 0));
    }
    jitter = (step / (pitches.length - 1) / (average(pitches) || 1)) * 100;
    shimmer = (ampStep / (amplitudes.length - 1) / (average(amplitudes) || 1)) * 100;
  }
  const deltaDelta = variance(deltaOf(deltaOf(mfccs)));
  let checker = 0;
  if (spectra.length > 2) {
    const fluxes: number[] = [];
    for (let index = 1; index < spectra.length; index += 1) {
      let flux = 0;
      let base = 0;
      const current = spectra[index];
      const previous = spectra[index - 1];
      for (let bin = 8; bin < current.length; bin += 4) {
        const diff = current[bin] - previous[bin];
        flux += diff * diff;
        base += current[bin] * current[bin];
      }
      fluxes.push(flux / (base + 1e-9));
    }
    const meanFlux = average(fluxes);
    let periodic = 0;
    for (let index = 2; index < fluxes.length; index += 1) {
      const local = Math.abs(fluxes[index] - fluxes[index - 1]);
      if (local < meanFlux * 0.35 && meanFlux > 0.002) periodic += 1;
    }
    checker = meanFlux * 12 + periodic / fluxes.length;
  }
  const total = low + mid + high + air + 1e-9;
  const breath = pauses === 0 ? 0 : (pauseSoft / Math.max(1, pauses)) * Math.min(1, pauses / 8) * (1 - pauseHard / Math.max(1, pauses));
  return {
    skew: average(skews),
    kurt: average(kurts),
    closure: average(closures),
    jitter,
    shimmer,
    tremor: tremorShare(pitches),
    deltaDelta,
    hfCliff: cliffCount === 0 ? 0 : cliffSum / cliffCount,
    checker,
    breath,
    pauseCount: pauses,
    harmonicity: average(harmonicities),
    voicedRatio: offsets.length === 0 ? 0 : voiced / offsets.length,
    bands: {
      low: Math.round((low / total) * 1000) / 10,
      mid: Math.round((mid / total) * 1000) / 10,
      high: Math.round((high / total) * 1000) / 10,
      air: Math.round((air / total) * 1000) / 10,
    },
  };
}

function share(real: number, generated: number, cloned: number): ClassDistribution {
  const safeReal = Math.max(0, real);
  const safeGenerated = Math.max(0, generated);
  const safeCloned = Math.max(0, cloned);
  const total = safeReal + safeGenerated + safeCloned;
  if (total <= 0) return { real: 0, generated: 0, cloned: 0, confidence: 0 };
  const realPct = Math.round((safeReal / total) * 100);
  const generatedPct = Math.round((safeGenerated / total) * 100);
  const clonedPct = Math.max(0, 100 - realPct - generatedPct);
  return { real: realPct, generated: generatedPct, cloned: clonedPct, confidence: 0 };
}

function finishClass(
  audioClass: AudioClass,
  real: number,
  generated: number,
  cloned: number,
  probability: number,
): { audioClass: AudioClass; probability: number; distribution: ClassDistribution; conflict: boolean } {
  const distribution = share(real, generated, cloned);
  const total = Math.max(0, real) + Math.max(0, generated) + Math.max(0, cloned) || 1;
  const ranked = [real, generated, cloned].sort((left, right) => right - left);
  distribution.confidence = Math.round((((ranked[0] ?? 0) - (ranked[1] ?? 0)) / total) * 100);
  return { audioClass, probability: Math.round(probability), distribution, conflict: false };
}

function classify(features: FeatureSet): {
  audioClass: AudioClass;
  probability: number;
  distribution: ClassDistribution;
  conflict: boolean;
} {
  let real = 0;
  let generated = 0;
  let cloned = 0;
  const symmetric = features.skew < 0.22;
  const mechanical = features.jitter < 0.45;
  const flatPitch = features.jitter < 0.35;
  const humanPitch = features.jitter >= 0.8 && features.jitter <= 8;
  const staticMouth = features.deltaDelta < 0.15;
  const livelyMouth = features.deltaDelta >= 0.4;
  const vocoderHf = features.hfCliff >= 1.6;
  const naturalBreath = features.breath >= 0.08;
  const deadBreath = features.breath < 0.04;
  const prosody = humanPitch || naturalBreath || (features.jitter >= 0.35 && features.jitter <= 8);

  if (features.voicedRatio < 0.12 && features.pauseCount < 2) {
    return { audioClass: "uncertain", probability: 0, distribution: { real: 0, generated: 0, cloned: 0, confidence: 0 }, conflict: true };
  }

  if (flatPitch && deadBreath) {
    const strength = clamp(
      0.55 + ((0.35 - Math.max(0, features.jitter)) / 0.35) * 0.25 + (vocoderHf ? 0.15 : 0) + (staticMouth ? 0.1 : 0),
      0,
      1,
    );
    return finishClass(
      "generated",
      1,
      11 + (vocoderHf ? 2 : 0) + (staticMouth ? 1 : 0),
      symmetric ? 2 : 1,
      clamp(85 + strength * 12, 85, 97),
    );
  }

  if (features.hfCliff >= 2 && features.jitter > 8 && !humanPitch) {
    const strength = clamp(0.6 + Math.min(features.hfCliff, 3) / 10, 0, 1);
    return finishClass(
      "generated",
      2,
      11 + (features.hfCliff >= 2.5 ? 2 : 0),
      3,
      clamp(85 + strength * 12, 85, 97),
    );
  }

  if (!symmetric && humanPitch && (livelyMouth || naturalBreath)) {
    const strength = clamp(0.35 + (livelyMouth ? 0.15 : 0) + (naturalBreath ? 0.15 : 0) + (features.skew >= 0.55 ? 0.35 : 0.2), 0, 1);
    return finishClass(
      "real",
      8 + (livelyMouth ? 2 : 0) + (naturalBreath ? 2 : 0),
      1,
      1,
      clamp(18 - strength * 13, 5, 18),
    );
  }

  if (symmetric && !flatPitch && prosody) {
    const strength = clamp(0.5 + (naturalBreath ? 0.2 : 0) + (!livelyMouth ? 0.15 : 0) + (vocoderHf ? 0.15 : 0), 0, 1);
    return finishClass(
      "cloned",
      humanPitch ? 3 : 2,
      vocoderHf ? 3 : 2,
      8 + (naturalBreath ? 2 : 0) + (!livelyMouth ? 2 : 0) + (vocoderHf ? 1 : 0),
      clamp(72 + strength * 17, 72, 89),
    );
  }

  if (symmetric) {
    generated += 2;
    cloned += 2;
  } else real += 3;

  if (mechanical) generated += 3;
  else if (humanPitch) {
    real += 2;
    cloned += 1;
  } else {
    real += 1;
    cloned += 1;
  }

  if (staticMouth) {
    generated += 1;
    cloned += 2;
  } else if (livelyMouth) real += 2;
  else {
    real += 1;
    cloned += 1;
  }

  if (vocoderHf) {
    generated += 1;
    cloned += 2;
  } else real += 1;

  if (naturalBreath) {
    real += 2;
    cloned += 1;
  } else if (deadBreath) generated += 2;

  if (features.tremor >= 0.02 && features.tremor <= 0.25 && !mechanical) real += 1;

  const distribution = share(real, generated, cloned);
  const ranked = [
    { audioClass: "real" as const, score: real },
    { audioClass: "generated" as const, score: generated },
    { audioClass: "cloned" as const, score: cloned },
  ].sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  const total = real + generated + cloned || 1;
  const confidence = Math.round((((best?.score ?? 0) - (second?.score ?? 0)) / total) * 100);
  distribution.confidence = confidence;
  const conflict = !best || best.score <= 0 || confidence < 8 || (features.voicedRatio < 0.12 && features.pauseCount < 2);
  if (conflict || !best) {
    return { audioClass: "uncertain", probability: 0, distribution, conflict: true };
  }
  const span = best.score / (best.score + (second?.score ?? 0) || 1);
  if (best.audioClass === "generated") {
    return { audioClass: "generated", probability: Math.round(clamp(85 + span * 12, 85, 97)), distribution, conflict: false };
  }
  if (best.audioClass === "cloned") {
    return { audioClass: "cloned", probability: Math.round(clamp(72 + span * 17, 72, 89)), distribution, conflict: false };
  }
  return { audioClass: "real", probability: Math.round(clamp(18 - span * 13, 5, 18)), distribution, conflict: false };
}

function blankMetrics(): AcousticReport["metrics"] {
  return {
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
  };
}

function reasonsFor(features: FeatureSet, audioClass: AudioClass, distribution: ClassDistribution, status: string): AcousticReason[] {
  const statusLine =
    audioClass === "uncertain"
      ? "QEYRİ-MÜƏYYƏN / KİFAYƏT QƏDƏR SİQNAL YOXDUR"
      : status;
  return [
    {
      title: "Ehtimal paylanması",
      detail: `Real İnsan Ehtimalı: ${distribution.real}% | AI-Generated Ehtimalı: ${distribution.generated}% | AI-Cloned Ehtimalı: ${distribution.cloned}% | Əminlik Səviyyəsi: ${distribution.confidence}% | Vəziyyət: ${statusLine}`,
    },
    {
      title: "Qlottal faza asimmetriyası",
      detail: `Dalğa əyriliyi ${features.skew.toFixed(3)}, qapanma asimmetriyası ${features.closure.toFixed(3)}, kurtosis ${features.kurt.toFixed(2)}. ${
        features.skew >= 0.22
          ? "Səs tellərinin açılıb-bağlanması asimmetrikdir — həqiqi qlottal nəbzə uyğundur."
          : "Faza simmetrikdir: neyron vokoder riyazi dalğanı bərpa edib, dinamik səsləndirmədə də bu iz qalır."
      }`,
    },
    {
      title: "Yüksək tezlik və vokoder izi",
      detail: `4–6 kHz ilə 6–8 kHz enerji nisbəti ${features.hfCliff.toFixed(2)}, kadr sərhədi pozuntusu ${features.checker.toFixed(3)}. ${
        features.hfCliff >= 1.6
          ? "4–6 kHz zolağı 6–8 kHz-ə nisbətən kəsilir və vokoder spektral kəsimi görünür."
          : features.checker >= 0.2 && features.deltaDelta < 0.15
            ? "10–20 ms kadr sərhədlərində periodik harmonik pozuntu (vokoder checkerboard) ölçülür."
            : "4–8 kHz zolağında kəskin vokoder kəsimi və ya dama-dama iz yoxdur."
      }`,
    },
    {
      title: "F0 jitter, shimmer və tremor",
      detail: `Jitter ${features.jitter.toFixed(2)}%, shimmer ${features.shimmer.toFixed(2)}%, 8–12 Hz tremor payı ${features.tremor.toFixed(3)}. ${
        features.jitter >= 0.8 && features.jitter <= 8
          ? "Əsas tezlikdə fizioloji mikro-titrəyiş (1.2%–4.5% zolağına yaxın) var."
          : features.jitter < 0.8
            ? "F0 törəməsi həddindən artıq hamar və sabitdir — TTS və ya klonlanmış səs izi."
            : "F0 konturu qeyri-sabitdir və fizioloji tremor kimi qəbul edilmir."
      }`,
    },
    {
      title: "MFCC delta-delta və nəfəs",
      detail: `ΔΔMFCC dispersiyası ${features.deltaDelta.toFixed(3)}, nəfəs pauzası əmsalı ${features.breath.toFixed(3)}, pauza sayı ${features.pauseCount}. ${
        features.deltaDelta >= 0.4 && features.breath >= 0.08
          ? "Fonem keçidlərində mikro-artikulyasiya və 200–1200 Hz nəfəs axını təbii insana uyğundur."
          : features.deltaDelta < 0.15
            ? "Statik tembr qalsa da ΔΔMFCC dəyişkənliyi real insandan aşağıdır."
            : features.breath >= 0.08
              ? "Nəfəs izi var, amma artikulyasiya dinamikası zəifdir."
              : "Pauza ya yoxdur, ya da kəskin rəqəmsal kəsilmədir."
      }`,
    },
  ];
}

function uncertainReport(kind: "short" | "weak"): AcousticReport {
  const detail =
    kind === "weak"
      ? "Siqnalın RMS səviyyəsi 0.008-dən aşağıdır. Məcburi REAL və ya AI qərarı verilmədi."
      : "Aktiv nitq 1.5 saniyədən qısadır. Məcburi REAL və ya AI qərarı verilmədi.";
  return {
    probability: 0,
    vocoder: 0,
    breathNatural: 0,
    spectrumAnomaly: 0,
    unreliable: true,
    pattern: "mixed",
    audioClass: "uncertain",
    distribution: { real: 0, generated: 0, cloned: 0, confidence: 0 },
    metrics: blankMetrics(),
    bands: { low: 0, mid: 0, high: 0, air: 0 },
    reasons: [
      {
        title: "UNCERTAIN / INCONCLUSIVE",
        detail: `QEYRİ-MÜƏYYƏN / KİFAYƏT QƏDƏR SİQNAL YOXDUR. ${detail} Real İnsan Ehtimalı: 0% | AI-Generated Ehtimalı: 0% | AI-Cloned Ehtimalı: 0% | Əminlik Səviyyəsi: 0% | Vəziyyət: UNCERTAIN / INCONCLUSIVE`,
      },
    ],
    mitre: "T1656 — Impersonation / Deepfake",
  };
}

export function analyzeForensic(samples: Float32Array, sampleRate: number): AcousticReport {
  const prepared = preprocessAudio(samples, sampleRate);
  if (prepared.status !== "ok") return uncertainReport(prepared.status);
  const features = measure(prepared.samples);
  const decision = classify(features);
  if (decision.conflict || decision.audioClass === "uncertain") {
    const report = uncertainReport("short");
    report.reasons[0] = {
      title: "UNCERTAIN / INCONCLUSIVE",
      detail: `Akustik göstəricilər ziddiyyətlidir və ya səsli kadr azdır. Real İnsan Ehtimalı: ${decision.distribution.real}% | AI-Generated Ehtimalı: ${decision.distribution.generated}% | AI-Cloned Ehtimalı: ${decision.distribution.cloned}% | Əminlik Səviyyəsi: ${decision.distribution.confidence}% | Vəziyyət: UNCERTAIN / INCONCLUSIVE`,
    };
    report.distribution = decision.distribution;
    report.metrics = {
      ...blankMetrics(),
      pitchJitter: Number(features.jitter.toFixed(4)),
      breathRatio: Number(features.breath.toFixed(4)),
      pauseCount: features.pauseCount,
      harmonicity: Number(features.harmonicity.toFixed(4)),
      voicedRatio: Number(features.voicedRatio.toFixed(4)),
    };
    return report;
  }
  const status =
    decision.audioClass === "generated"
      ? "AI-GENERATED AUDIO"
      : decision.audioClass === "cloned"
        ? "AI-CLONED / AI-MANIPULATED AUDIO"
        : "REAL HUMAN AUDIO";
  return {
    probability: decision.probability,
    vocoder: Math.round(
      decision.audioClass === "real"
        ? clamp(4 + Math.max(0, 0.22 - features.skew) * 40, 4, 18)
        : decision.audioClass === "cloned"
          ? clamp(72 + (features.hfCliff >= 1.6 ? 10 : 0) + (features.skew < 0.22 ? 6 : 0), 72, 89)
          : clamp(86 + (features.jitter < 0.45 ? 8 : 0), 85, 97),
    ),
    breathNatural: Math.round(clamp(features.breath * 240 + (features.pauseCount > 0 ? 8 : 0), 0, 100)),
    spectrumAnomaly: Math.round(
      decision.audioClass === "real"
        ? clamp(6 + features.hfCliff * 4, 4, 22)
        : clamp(48 + Math.min(features.hfCliff, 4) * 12 + (features.deltaDelta < 0.15 ? 18 : 0), 40, 100),
    ),
    unreliable: false,
    pattern: decision.audioClass === "real" ? "speech" : "synthetic",
    audioClass: decision.audioClass,
    distribution: decision.distribution,
    metrics: {
      pitchJitter: Number(features.jitter.toFixed(4)),
      breathRatio: Number(features.breath.toFixed(4)),
      pauseCount: features.pauseCount,
      pauseIntervalMs: Math.round(features.pauseCount === 0 ? 0 : (1000 * HOP) / RATE),
      harmonicity: Number(features.harmonicity.toFixed(4)),
      spectralFlatness: Number(features.skew.toFixed(4)),
      harmonicRegularity: Number(features.closure.toFixed(4)),
      amplitudeVariation: Number(features.shimmer.toFixed(4)),
      voicedRatio: Number(features.voicedRatio.toFixed(4)),
      pauseNoise: Number(features.breath.toFixed(4)),
      formantRatio: Number(features.tremor.toFixed(4)),
      shelfRatio: Number(features.hfCliff.toFixed(4)),
      zcrMean: Number(features.deltaDelta.toFixed(4)),
      zcrVariation: Number(features.checker.toFixed(4)),
    },
    bands: features.bands,
    reasons: reasonsFor(features, decision.audioClass, decision.distribution, status),
    mitre: decision.audioClass === "real" ? "T1656 əlaməti təsdiqlənmədi" : "T1656 — Impersonation / Deepfake",
  };
}
