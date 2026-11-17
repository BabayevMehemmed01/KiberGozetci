import { analyzeForensic } from "./audioForensics.ts";

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

export type AudioClass = "real" | "generated" | "cloned" | "uncertain";

export interface ClassDistribution {
  real: number;
  generated: number;
  cloned: number;
  confidence: number;
}

export interface AcousticReport {
  probability: number;
  vocoder: number;
  breathNatural: number;
  spectrumAnomaly: number;
  unreliable: boolean;
  pattern: "speech" | "synthetic" | "mixed";
  audioClass: AudioClass;
  distribution: ClassDistribution;
  metrics: AcousticMetrics;
  bands: SpectralShare;
  reasons: AcousticReason[];
  mitre: string;
}

export function verdictFor(report: Pick<AcousticReport, "probability" | "unreliable" | "audioClass">): {
  label: string;
  tone: "critical" | "warning" | "safe" | "muted";
} {
  if (report.unreliable || report.audioClass === "uncertain") {
    return { label: "UNCERTAIN / INCONCLUSIVE", tone: "muted" };
  }
  if (report.audioClass === "cloned") return { label: "AI-CLONED / AI-MANIPULATED AUDIO", tone: "warning" };
  if (report.audioClass === "generated") return { label: "AI-GENERATED AUDIO", tone: "critical" };
  if (report.audioClass === "real") return { label: "REAL HUMAN AUDIO", tone: "safe" };
  if (report.probability >= 85) return { label: "AI-GENERATED AUDIO", tone: "critical" };
  if (report.probability >= 72) return { label: "AI-CLONED / AI-MANIPULATED AUDIO", tone: "warning" };
  return { label: "REAL HUMAN AUDIO", tone: "safe" };
}

export function analyzePcm(samples: Float32Array, sampleRate: number): AcousticReport {
  return analyzeForensic(samples, sampleRate);
}
