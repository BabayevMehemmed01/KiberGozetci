import type { AcousticReport } from "./dsp.ts";
import { clamp } from "./utils.ts";
import type { VideoForensics } from "./videoSync.ts";
import { inspectCurrentVideoFrame, type DetectedFace, type FaceBox, type StillForensics } from "./vision.ts";

export interface VideoStudy {
  still: StillForensics;
  clip: VideoForensics | null;
  silent: boolean;
}

interface FrameShot {
  time: number;
  stamp: string;
  still: StillForensics | null;
  ratios: number[];
  faceLuma: number;
  bgLuma: number;
  seam: number;
  smoothness: number;
  mouth: Uint8ClampedArray | null;
  blockiness: number;
}

function stamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function correlation(left: number[], right: number[]): number {
  const count = Math.min(left.length, right.length);
  if (count < 3) return 0;
  let meanLeft = 0;
  let meanRight = 0;
  for (let index = 0; index < count; index += 1) {
    meanLeft += left[index] ?? 0;
    meanRight += right[index] ?? 0;
  }
  meanLeft /= count;
  meanRight /= count;
  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < count; index += 1) {
    const leftDelta = (left[index] ?? 0) - meanLeft;
    const rightDelta = (right[index] ?? 0) - meanRight;
    numerator += leftDelta * rightDelta;
    leftEnergy += leftDelta * leftDelta;
    rightEnergy += rightDelta * rightDelta;
  }
  if (leftEnergy < 1e-8 || rightEnergy < 1e-8) return 0;
  return numerator / Math.sqrt(leftEnergy * rightEnergy);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

function deviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function inBand(unit: number, low: number, high: number): number {
  return Math.round(clamp(low + clamp(unit, 0, 1) * (high - low), low, high));
}

function waitMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("timeout")), 4000);
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    if (video.readyState >= 1 && Number.isFinite(video.duration)) {
      finish();
      return;
    }
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(new Error("video"));
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const duration = Number.isFinite(video.duration) ? video.duration : time + 0.1;
    const target = Math.min(Math.max(0, time), Math.max(0, duration - 0.04));
    if (Math.abs(video.currentTime - target) < 0.03 && video.readyState >= 2) {
      resolve();
      return;
    }
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    timer = window.setTimeout(done, 1200);
    video.addEventListener("seeked", done);
    try {
      video.currentTime = target;
    } catch {
      done();
    }
  });
}

function lumaOf(pixels: Uint8ClampedArray, offset: number): number {
  return pixels[offset] * 0.3 + pixels[offset + 1] * 0.59 + pixels[offset + 2] * 0.11;
}

function regionStats(pixels: Uint8ClampedArray, width: number, height: number, box: FaceBox): { luma: number; seam: number } {
  const x0 = Math.max(0, Math.floor(box.x * width));
  const y0 = Math.max(0, Math.floor(box.y * height));
  const x1 = Math.min(width, Math.ceil((box.x + box.width) * width));
  const y1 = Math.min(height, Math.ceil((box.y + box.height) * height));
  let luma = 0;
  let count = 0;
  let seam = 0;
  let seamCount = 0;
  const ring = Math.max(2, Math.round(Math.min(x1 - x0, y1 - y0) * 0.14));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const tone = lumaOf(pixels, (y * width + x) * 4);
      luma += tone;
      count += 1;
      const edge = x < x0 + ring || x >= x1 - ring || y < y0 + ring || y >= y1 - ring;
      if (edge && x + 1 < width) {
        seam += Math.abs(tone - lumaOf(pixels, (y * width + x + 1) * 4));
        seamCount += 1;
      }
    }
  }
  return { luma: count ? luma / count : 0, seam: seamCount ? seam / seamCount : 0 };
}

function backgroundLuma(pixels: Uint8ClampedArray, width: number, height: number, box: FaceBox): number {
  let luma = 0;
  let count = 0;
  const step = 3;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const nx = x / width;
      const ny = y / height;
      const inside = nx >= box.x && nx <= box.x + box.width && ny >= box.y && ny <= box.y + box.height;
      if (inside) continue;
      luma += lumaOf(pixels, (y * width + x) * 4);
      count += 1;
    }
  }
  return count ? luma / count : 0;
}

function blockiness(pixels: Uint8ClampedArray, width: number, height: number): number {
  let boundary = 0;
  let interior = 0;
  let boundaryCount = 0;
  let interiorCount = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 1; x < width; x += 1) {
      const diff = Math.abs(lumaOf(pixels, (y * width + x) * 4) - lumaOf(pixels, (y * width + x - 1) * 4));
      if (x % 8 === 0) {
        boundary += diff;
        boundaryCount += 1;
      } else if (x % 8 === 4) {
        interior += diff;
        interiorCount += 1;
      }
    }
  }
  const edge = boundary / Math.max(1, boundaryCount);
  const inner = interior / Math.max(1, interiorCount);
  return inner < 0.4 ? 1 : edge / inner;
}

function shapeRatios(face: DetectedFace): number[] {
  const box = face.box;
  if (box.width < 0.02 || box.height < 0.02 || face.landmarks.length < 3) return [];
  const xs = face.landmarks.map((point) => (point.x - box.x) / box.width);
  const ys = face.landmarks.map((point) => (point.y - box.y) / box.height);
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  const nose = face.landmarks[Math.min(2, face.landmarks.length - 1)];
  const mouth = face.landmarks[face.landmarks.length - 1];
  return [xSpan, ySpan, nose && mouth ? (mouth.y - nose.y) / box.height : ySpan, box.width / Math.max(0.02, box.height)];
}

function ratioDelta(left: number[], right: number[]): number {
  const count = Math.min(left.length, right.length);
  if (count === 0) return 0;
  let sum = 0;
  for (let index = 0; index < count; index += 1) sum += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
  return sum / count;
}

function mouthPatch(pixels: Uint8ClampedArray, width: number, height: number, box: FaceBox): Uint8ClampedArray {
  const x0 = Math.max(0, Math.floor(box.x * width));
  const x1 = Math.min(width, Math.ceil((box.x + box.width) * width));
  const y0 = Math.max(0, Math.floor((box.y + box.height * 0.62) * height));
  const y1 = Math.min(height, Math.ceil((box.y + box.height) * height));
  const patch = new Uint8ClampedArray(Math.max(1, (x1 - x0) * (y1 - y0)));
  let cursor = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      patch[cursor] = lumaOf(pixels, (y * width + x) * 4);
      cursor += 1;
    }
  }
  return patch;
}

function mouthMotion(left: Uint8ClampedArray | null, right: Uint8ClampedArray | null): number {
  if (!left || !right) return 0;
  const count = Math.min(left.length, right.length);
  const longest = Math.max(left.length, right.length);
  if (count < 8 || longest - count > longest * 0.25) return 0;
  let diff = 0;
  for (let index = 0; index < count; index += 1) diff += Math.abs(left[index] - right[index]);
  return diff / count;
}

function audioRms(samples: Float32Array | null, sampleRate: number, start: number, end: number): number {
  if (!samples || sampleRate <= 0 || end <= start) return 0;
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(samples.length, Math.ceil(end * sampleRate));
  if (to - from < 8) return 0;
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / (to - from));
}

function blankStill(width: number, height: number, detail: string): StillForensics {
  return {
    score: 0,
    smoothness: 0,
    variance: 0,
    flicker: 0,
    grid: Array.from({ length: 64 }, () => 0),
    tone: "unknown",
    verdict: "INCONCLUSIVE",
    detail,
    reasons: [detail],
    face: null,
    faces: [],
    sourceWidth: width,
    sourceHeight: height,
    noFace: true,
    category: "",
    risk: "none",
    heatmap: [],
    inconclusive: true,
  };
}

function frameCount(duration: number): number {
  if (duration < 4) return 8;
  if (duration < 12) return 10;
  return 12;
}

export async function analyzeVideo(
  file: File,
  samples: Float32Array | null,
  sampleRate: number,
  audio: AcousticReport | null,
): Promise<VideoStudy> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await waitMetadata(video);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth || 320;
    const height = video.videoHeight || 180;
    if (duration < 1) {
      return { still: blankStill(width, height, "Video 1 saniyədən qısadır. Saxta risk faizi göstərilmədi."), clip: null, silent: !samples };
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 240 / Math.max(width, height));
    canvas.width = Math.max(32, Math.round(width * scale));
    canvas.height = Math.max(32, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas");
    const count = frameCount(duration);
    const shots: FrameShot[] = [];
    for (let index = 0; index < count; index += 1) {
      const time = Math.min(duration - 0.05, Math.max(0.05, (duration * (index + 0.5)) / count));
      await seek(video, time);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const still = await inspectCurrentVideoFrame(video);
      const face = still?.faces[0] ?? null;
      const region = face ? regionStats(pixels, canvas.width, canvas.height, face.box) : { luma: 0, seam: 0 };
      shots.push({
        time,
        stamp: stamp(time),
        still,
        ratios: face ? shapeRatios(face) : [],
        faceLuma: region.luma,
        bgLuma: face ? backgroundLuma(pixels, canvas.width, canvas.height, face.box) : 0,
        seam: region.seam,
        smoothness: still?.smoothness ?? 0,
    mouth: face ? mouthPatch(pixels, canvas.width, canvas.height, face.box) : null,
    blockiness: blockiness(pixels, canvas.width, canvas.height),
      });
    }
    return fuse(shots, samples, sampleRate, audio, width, height);
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function fuse(
  shots: FrameShot[],
  samples: Float32Array | null,
  sampleRate: number,
  audio: AcousticReport | null,
  width: number,
  height: number,
): VideoStudy {
  const faced = shots.filter((shot) => shot.still && !shot.still.noFace && shot.still.risk !== "none");
  const audioMissing = !samples || samples.length < 16;
  if (faced.length < 2) {
    const detail = "Üz görünmür və analiz üçün etibarlı siqnal yoxdur. Saxta risk faizi göstərilmədi.";
    return { still: blankStill(width, height, audioMissing ? `${detail} Səs cığırı yoxdur (Səssiz video).` : detail), clip: null, silent: audioMissing };
  }

  const deltas: number[] = [];
  const lightJumps: boolean[] = [];
  const seamJumps: boolean[] = [];
  const geometryJumps: boolean[] = [];
  for (let index = 1; index < faced.length; index += 1) {
    const previous = faced[index - 1];
    const current = faced[index];
    if (!previous || !current) continue;
    deltas.push(ratioDelta(previous.ratios, current.ratios));
    const faceDelta = current.faceLuma - previous.faceLuma;
    const bgDelta = current.bgLuma - previous.bgLuma;
    lightJumps.push(Math.abs(faceDelta - bgDelta) > 22 && Math.abs(bgDelta) < 14);
    const seamBase = Math.max(4, previous.seam);
    seamJumps.push(Math.abs(current.seam - previous.seam) > seamBase * 0.85 && Math.abs(current.smoothness - previous.smoothness) < 18);
  }
  const deltaMedian = median(deltas);
  for (const delta of deltas) geometryJumps.push(delta > 0.14 && delta > deltaMedian * 2.4 + 0.04);
  const spikes = geometryJumps.filter(Boolean).length;
  const lights = lightJumps.filter(Boolean).length;
  const seams = seamJumps.filter(Boolean).length;
  const generatedCount = faced.filter((shot) => shot.still?.risk === "generated").length;
  const editedCount = faced.filter((shot) => shot.still?.risk === "edited").length;
  const generatedFrac = generatedCount / faced.length;
  const blocky = median(faced.map((shot) => shot.blockiness)) >= 1.28;
  const textureStable = deviation(faced.map((shot) => shot.smoothness)) < 16;
  const temporalAnomaly = spikes >= 2 || lights >= 2 || seams >= 2;
  const compressionGuard = !temporalAnomaly && (blocky || textureStable) && generatedFrac < 0.4;

  let visual: "real" | "manipulated" | "generated" = "real";
  if (generatedFrac >= 0.6) visual = "generated";
  else if (compressionGuard) visual = "real";
  else if (temporalAnomaly || (editedCount / faced.length >= 0.5 && !blocky)) visual = "manipulated";

  const motions: number[] = [];
  const audioAt = [0, 0.15, 0.2, 0.25].map(() => [] as number[]);
  for (let index = 1; index < faced.length; index += 1) {
    const previous = faced[index - 1];
    const current = faced[index];
    if (!previous || !current) continue;
    motions.push(mouthMotion(previous.mouth, current.mouth));
    audioAt.forEach((series, lagIndex) => {
      const lag = [0, 0.15, 0.2, 0.25][lagIndex] ?? 0;
      series.push(audioRms(samples, sampleRate, previous.time - lag, current.time - lag));
    });
  }
  let bestSync = 0;
  if (!audioMissing && motions.length >= 3) {
    for (const series of audioAt) bestSync = Math.max(bestSync, correlation(motions, series));
  }
  const meanMotion = motions.length ? motions.reduce((sum, value) => sum + value, 0) / motions.length : 0;
  const meanAudio = audioAt[0]?.length ? audioAt[0].reduce((sum, value) => sum + value, 0) / audioAt[0].length : 0;
  const audioUsable = !audioMissing && Boolean(audio && !audio.unreliable && audio.audioClass !== "uncertain");
  const aligned = bestSync >= 0.35;
  const frozenMouth = audioUsable && meanMotion < 1.15 && meanAudio > 0.02 && bestSync < 0.18;
  const puppetMouth = audioUsable && meanMotion > 7 && meanAudio < 0.006 && bestSync < 0.18;
  const sharpLip = audioUsable && !aligned && (frozenMouth || puppetMouth);
  const lipPercent = audioMissing ? null : Math.round(clamp(bestSync * 100, 0, 100));

  const audioClass = !audio || audio.unreliable || audio.audioClass === "uncertain" ? "none" : audio.audioClass;
  const audioConflict = visual !== "generated" && (audioClass === "generated" || audioClass === "cloned");
  let videoClass: "real" | "manipulated" | "generated" = visual;
  if (videoClass === "real" && (audioConflict || sharpLip)) videoClass = "manipulated";

  const clean = clamp(1 - spikes / 4 - lights / 4 - seams / 5, 0, 1);
  const manipulatedStrength = clamp(0.2 + editedCount / faced.length * 0.3 + (temporalAnomaly ? 0.25 : 0) + (sharpLip ? 0.2 : 0) + (audioConflict ? 0.28 : 0), 0, 1);
  const generatedStrength = clamp(0.35 + generatedFrac * 0.55 + (audioClass === "generated" ? 0.1 : 0), 0, 1);
  const risk =
    videoClass === "generated"
      ? inBand(generatedStrength, 87, 98)
      : videoClass === "manipulated"
        ? inBand(manipulatedStrength, 55, 86)
        : inBand(1 - clean, 3, 18);
  const visualAuthenticity = Math.round(clamp(100 - risk, 2, 97));
  const audioAuthenticity =
    audioClass === "real" || audioClass === "generated" || audioClass === "cloned" ? Math.round(clamp(100 - (audio?.probability ?? 0), 2, 97)) : null;
  const agreement = Math.max(generatedFrac, editedCount / faced.length, 1 - generatedFrac - editedCount / faced.length);
  const confidence = Math.round(clamp(42 + agreement * 46 - (audioConflict ? 0 : spikes * 2), 38, 96));

  const notes: string[] = [];
  const suspect = new Set<string>();
  faced.forEach((shot, index) => {
    const geometry = index > 0 && geometryJumps[index - 1];
    const light = index > 0 && lightJumps[index - 1];
    const seam = index > 0 && seamJumps[index - 1];
    const keptEdit = shot.still?.risk === "edited" && !compressionGuard;
    const generated = shot.still?.risk === "generated" && videoClass === "generated";
    if (geometry || light || seam || keptEdit || generated) suspect.add(shot.stamp);
  });
  if (spikes >= 2) notes.push("üz həndəsəsində kadrlararası mikro-deformasiya");
  if (seams >= 2 || (editedCount >= 2 && !compressionGuard)) notes.push("çənə sərhədində ELA/temporal uyğunsuzluq");
  if (lights >= 2) notes.push("üz işıqlandırma vektorunda qəfil sıçrayış");
  if (sharpLip) notes.push("dodaq hərəkəti ilə nitq enerjisi kəskin uyğunsuzdur");
  if (visual === "real" && (audioClass === "generated" || audioClass === "cloned")) notes.push("görüntü realdır, səs isə süni və ya klonlanmışdır");
  if (videoClass === "generated") notes.push("kadrlar sintetik tekstura daşıyır");
  const stampList = [...suspect].slice(0, 6).join(", ");
  const cause = notes.slice(0, 2).join("; ") || "temporal uyğunsuzluq";
  const suspicion =
    suspect.size > 0
      ? `Şübhəli kadr intervalları: ${stampList} — ${cause}`
      : "Şübhəli kadr intervalı aşkarlanmadı.";

  const label = videoClass === "generated" ? "AI-GENERATED VIDEO" : videoClass === "manipulated" ? "AI-MANIPULATED VIDEO" : "REAL VIDEO";
  const lines = [
    `Vizual Orijinallıq (Visual Authenticity): ${visualAuthenticity}%`,
    audioMissing
      ? "Audio Orijinallıq: Səs cığırı yoxdur (Səssiz video)"
      : audioAuthenticity === null
        ? "Audio Orijinallıq: qeyri-müəyyən — səs qərarı məcburi verilmədi"
        : `Audio Orijinallıq (Audio Authenticity): ${audioAuthenticity}%`,
    lipPercent === null ? "Audio-Vizual / Lip-Sync Uyğunluğu: səs cığırı yoxdur" : `Audio-Vizual / Lip-Sync Uyğunluğu: ${lipPercent}%`,
    `Ümumi Deepfake Risk Balı: ${risk}%`,
    `Əminlik Səviyyəsi (Confidence): ${confidence}%`,
    suspicion,
  ];
  const ranked = [...faced].sort((left, right) => (left.still?.score ?? 0) - (right.still?.score ?? 0));
  const base = ranked[Math.floor(ranked.length / 2)]?.still ?? faced[0]?.still;
  if (!base) return { still: blankStill(width, height, "Üz görünmür və analiz üçün etibarlı siqnal yoxdur."), clip: null, silent: audioMissing };
  const still: StillForensics = {
    ...base,
    score: risk,
    verdict: label,
    detail: suspicion,
    reasons: [...lines, ...base.reasons],
    risk: videoClass === "generated" ? "generated" : videoClass === "manipulated" ? "edited" : "real",
    tone: videoClass === "generated" ? "synthetic" : videoClass === "real" ? "real" : "unknown",
    inconclusive: false,
  };
  const clip: VideoForensics = {
    lipSync: lipPercent ?? 0,
    smoothness: Math.round(median(faced.map((shot) => shot.smoothness))),
    flicker: Math.round(clamp((lights + seams) * 12, 0, 100)),
  };
  return { still, clip, silent: audioMissing };
}
