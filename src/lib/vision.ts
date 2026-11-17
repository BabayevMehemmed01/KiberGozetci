import { clamp } from "./utils.ts";
import type { ForensicKind } from "./forensicClass.ts";

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StillForensics {
  score: number;
  smoothness: number;
  variance: number;
  flicker: number;
  grid: number[];
  tone: ForensicKind;
  verdict: string;
  detail: string;
  reasons: string[];
  face: FaceBox | null;
  sourceWidth: number;
  sourceHeight: number;
}

export interface PixelSignals {
  edgeRatio: number;
  grainRms: number;
  caShift: number;
  elaMean: number;
  elaCv: number;
  skinCoverage: number;
  grid: number[];
}

export interface MetadataSignals {
  aiLabels: string[];
  cameraLabels: string[];
  optical: boolean;
  generatedPng: boolean;
}

const AI_RULES: { label: string; pattern: RegExp }[] = [
  { label: "C2PA", pattern: /c2pa/ },
  { label: "JUMBF", pattern: /jumbf|jumb/ },
  { label: "Made with Google AI", pattern: /made with google ai/ },
  { label: "Gemini", pattern: /gemini/ },
  { label: "OpenAI", pattern: /openai/ },
  { label: "DALL-E", pattern: /dall[-·.\s]?e/ },
  { label: "Midjourney", pattern: /midjourney/ },
  { label: "Stable Diffusion", pattern: /stable diffusion/ },
  { label: "ComfyUI", pattern: /comfyui/ },
  { label: "Flux", pattern: /flux\.1|\bflux\b/ },
];

const GENERATION_TEXT = /parameters|negative prompt|sampler|cfg scale|steps:|seed:|stable diffusion|comfyui|midjourney|dall[-·.\s]?e|openai|gemini|made with google ai|c2pa|jumbf/;
const CAMERA_MAKE = [
  { label: "Canon", pattern: /canon/ },
  { label: "Nikon", pattern: /nikon/ },
  { label: "Apple", pattern: /apple/ },
  { label: "Samsung", pattern: /samsung/ },
  { label: "Sony", pattern: /sony/ },
  { label: "Xiaomi", pattern: /xiaomi/ },
];

function latin1(bytes: Uint8Array): string {
  let text = "";
  const size = 8192;
  for (let index = 0; index < bytes.length; index += size) {
    text += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return text.toLowerCase();
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function pngGenerationBlock(bytes: Uint8Array, camera: boolean): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || signature.some((value, index) => bytes[index] !== value)) return false;
  let offset = 8;
  let generated = false;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const start = offset + 8;
    if (start > bytes.length) break;
    const end = Math.min(bytes.length, start + length);
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const chunk = latin1(bytes.subarray(start, end));
      if (GENERATION_TEXT.test(chunk)) generated = true;
    }
    const next = start + length + 4;
    if (next <= offset) break;
    offset = next;
  }
  return generated && !camera;
}

export function scanMetadata(bytes: Uint8Array): MetadataSignals {
  const head = bytes.subarray(0, Math.min(bytes.length, 65536));
  const text = latin1(head);
  const aiLabels: string[] = [];
  for (const rule of AI_RULES) {
    if (rule.pattern.test(text) && !aiLabels.includes(rule.label)) aiLabels.push(rule.label);
  }
  const cameraLabels: string[] = [];
  if (text.includes("exif")) cameraLabels.push("Exif");
  for (const rule of CAMERA_MAKE) {
    if (rule.pattern.test(text)) cameraLabels.push(rule.label);
  }
  const optical = /fnumber|isospeedratings|iso speed|photographic/.test(text);
  if (optical) cameraLabels.push(text.includes("fnumber") ? "FNumber" : "ISOSpeedRatings");
  const generatedPng = pngGenerationBlock(head, cameraLabels.length > 0 || optical);
  if (generatedPng && !aiLabels.includes("PNG tEXt/iTXt")) aiLabels.push("PNG tEXt/iTXt");
  return { aiLabels, cameraLabels, optical, generatedPng };
}

function isSkin(red: number, green: number, blue: number): boolean {
  if (red < 70 || green < 30 || blue < 15) return false;
  if (red <= green || red <= blue) return false;
  if (Math.max(red, green, blue) - Math.min(red, green, blue) < 12) return false;
  const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
  const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
  return cr > 133 && cr < 183 && cb > 80 && cb < 135;
}

export function locateSkinFace(pixels: Uint8ClampedArray, width: number, height: number): { box: FaceBox; coverage: number } {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 180));
  const yLimit = Math.max(1, Math.floor(height * 0.78));
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  let samples = 0;
  for (let y = 0; y < yLimit; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      samples += 1;
      if (!isSkin(pixels[index], pixels[index + 1], pixels[index + 2])) continue;
      sumX += x;
      sumY += y;
      count += 1;
    }
  }
  const coverage = samples ? count / samples : 0;
  if (coverage < 0.045 || count < 12) {
    return {
      coverage,
      box: { x: 0.27, y: 0.05, width: 0.46, height: 0.58 },
    };
  }
  const centerX = sumX / count / width;
  const centerY = sumY / count / height;
  const boxWidth = 0.46;
  const boxHeight = 0.56;
  const x = clamp(centerX - boxWidth * 0.5, 0, 1 - boxWidth);
  const y = clamp(centerY - boxHeight * 0.46, 0, 1 - boxHeight);
  return { coverage, box: { x, y, width: boxWidth, height: boxHeight } };
}

function lumaOf(pixels: Uint8ClampedArray, index: number): number {
  return pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

function meanOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdOf(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function elaStats(original: Uint8ClampedArray, recompressed: Uint8ClampedArray, width: number, height: number): { mean: number; cv: number } {
  const block = 8;
  const errors: number[] = [];
  for (let y = 0; y + block <= height; y += block) {
    for (let x = 0; x + block <= width; x += block) {
      let error = 0;
      for (let row = 0; row < block; row += 1) {
        for (let column = 0; column < block; column += 1) {
          const index = ((y + row) * width + (x + column)) * 4;
          error += Math.abs(lumaOf(original, index) - lumaOf(recompressed, index));
        }
      }
      errors.push(error / (block * block));
    }
  }
  const mean = meanOf(errors);
  const cv = stdOf(errors, mean) / (mean + 0.2);
  return { mean, cv };
}

export function measureSignals(pixels: Uint8ClampedArray, width: number, height: number, ela?: { mean: number; cv: number }): PixelSignals {
  const gray = new Float32Array(width * height);
  let skinCount = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const index = pixel * 4;
    gray[pixel] = lumaOf(pixels, index);
    if (isSkin(pixels[index], pixels[index + 1], pixels[index + 2])) skinCount += 1;
  }
  const skinCoverage = skinCount / Math.max(1, width * height);
  const gradient = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -gray[index - width - 1] +
        gray[index - width + 1] -
        2 * gray[index - 1] +
        2 * gray[index + 1] -
        gray[index + width - 1] +
        gray[index + width + 1];
      const gy =
        -gray[index - width - 1] -
        2 * gray[index - width] -
        gray[index - width + 1] +
        gray[index + width - 1] +
        2 * gray[index + width] +
        gray[index + width + 1];
      gradient[index] = Math.hypot(gx, gy);
    }
  }

  const block = 8;
  const stds: number[] = [];
  const edges: number[] = [];
  const skinStds: number[] = [];
  const skinEdges: number[] = [];
  const flat: { x: number; y: number }[] = [];
  const cells = 8;
  const heat = Array.from({ length: cells * cells }, () => 0);
  const heatCount = Array.from({ length: cells * cells }, () => 0);

  for (let y = 0; y + block <= height; y += block) {
    for (let x = 0; x + block <= width; x += block) {
      let sum = 0;
      let sumSquares = 0;
      let edge = 0;
      let skin = 0;
      const total = block * block;
      for (let row = 0; row < block; row += 1) {
        for (let column = 0; column < block; column += 1) {
          const pixel = (y + row) * width + (x + column);
          const value = gray[pixel];
          sum += value;
          sumSquares += value * value;
          edge += gradient[pixel];
          const index = pixel * 4;
          if (isSkin(pixels[index], pixels[index + 1], pixels[index + 2])) skin += 1;
        }
      }
      const mean = sum / total;
      const std = Math.sqrt(Math.max(0, sumSquares / total - mean * mean));
      const sobel = edge / total;
      stds.push(std);
      edges.push(sobel);
      if (skin / total > 0.45) {
        skinStds.push(std);
        skinEdges.push(sobel);
        if (sobel < 14) flat.push({ x, y });
      }
      const cellX = Math.min(cells - 1, Math.floor((x / width) * cells));
      const cellY = Math.min(cells - 1, Math.floor((y / height) * cells));
      const cell = cellY * cells + cellX;
      heat[cell] += sobel;
      heatCount[cell] += 1;
    }
  }

  const smoothStd = percentile(skinStds.length ? skinStds : stds, 0.3);
  const sharpest = [...edges].sort((left, right) => right - left);
  const edgeCount = Math.max(1, Math.round(sharpest.length * 0.08));
  const edgeMag = meanOf(sharpest.slice(0, edgeCount));
  const edgeRatio = edgeMag / (smoothStd + 0.8);

  let residualEnergy = 0;
  let residualCount = 0;
  for (const region of flat) {
    for (let row = 1; row < block - 1; row += 1) {
      for (let column = 1; column < block - 1; column += 1) {
        const x = region.x + column;
        const y = region.y + row;
        let blur = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) blur += gray[(y + dy) * width + (x + dx)];
        }
        const residual = gray[y * width + x] - blur / 9;
        residualEnergy += residual * residual;
        residualCount += 1;
      }
    }
  }
  const grainRms = residualCount ? Math.sqrt(residualEnergy / residualCount) : smoothStd * 0.35;

  let shiftSum = 0;
  let shiftCount = 0;
  const edgeFloor = Math.max(18, percentile(edges, 0.8));
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      const index = y * width + x;
      if (gradient[index] < edgeFloor) continue;
      const horizontal = Math.abs(gray[index + 1] - gray[index - 1]) >= Math.abs(gray[index + width] - gray[index - width]);
      let redPeak = 0;
      let bluePeak = 0;
      let redEnergy = -1;
      let blueEnergy = -1;
      for (let offset = -2; offset <= 2; offset += 1) {
        const sx = horizontal ? x + offset : x;
        const sy = horizontal ? y : y + offset;
        const px = horizontal ? sx - 1 : x;
        const py = horizontal ? y : sy - 1;
        const current = (sy * width + sx) * 4;
        const previous = (py * width + px) * 4;
        const red = Math.abs(pixels[current] - pixels[previous]);
        const blue = Math.abs(pixels[current + 2] - pixels[previous + 2]);
        if (red > redEnergy) {
          redEnergy = red;
          redPeak = offset;
        }
        if (blue > blueEnergy) {
          blueEnergy = blue;
          bluePeak = offset;
        }
      }
      if (redEnergy < 10 || blueEnergy < 10) continue;
      shiftSum += Math.abs(redPeak - bluePeak);
      shiftCount += 1;
      if (shiftCount > 2500) break;
    }
    if (shiftCount > 2500) break;
  }
  const caShift = shiftCount > 12 ? shiftSum / shiftCount : 0.5;

  const peak = Math.max(...heat.map((value, index) => (heatCount[index] ? value / heatCount[index] : 0)), 1);
  const grid = heat.map((value, index) => (heatCount[index] ? value / heatCount[index] / peak : 0));

  return {
    edgeRatio,
    grainRms,
    caShift,
    elaMean: ela?.mean ?? -1,
    elaCv: ela?.cv ?? -1,
    skinCoverage,
    grid,
  };
}

function bandScore(unit: number, low: number, high: number): number {
  const span = high - low;
  return clamp(Math.round(low + clamp(unit, 0, 1) * span), low, high);
}

export function judgeStill(
  signals: PixelSignals,
  metadata: MetadataSignals,
  face: FaceBox | null,
  sourceWidth: number,
  sourceHeight: number,
): StillForensics {
  const faceSeen = signals.skinCoverage >= 0.08;
  const edgeSynthetic = signals.edgeRatio >= 16;
  const grainSynthetic = signals.grainRms <= 1.15;
  const grainReal = signals.grainRms >= 2.05;
  const caSynthetic = signals.caShift <= 0.28;
  const caReal = signals.caShift >= 0.42;
  const elaKnown = signals.elaCv >= 0 && signals.elaMean >= 0;
  const elaSynthetic = elaKnown && signals.elaCv <= 0.38;
  const elaReal = elaKnown && signals.elaCv >= 0.62;
  const syntheticVotes = [edgeSynthetic, grainSynthetic, caSynthetic, elaSynthetic].filter(Boolean).length;
  const aiMeta = metadata.aiLabels.length > 0;
  const camera = metadata.optical || metadata.cameraLabels.some((label) => label !== "Exif");

  const pixelSynthetic = faceSeen && grainSynthetic && caSynthetic && edgeSynthetic;
  const pixelConsensus = faceSeen && syntheticVotes >= 3 && grainSynthetic && !grainReal;
  const bareFile = !camera && !metadata.cameraLabels.includes("Exif");
  const strongSmooth = faceSeen && bareFile && signals.grainRms <= 1.55 && caSynthetic && edgeSynthetic;
  const naturalOptics = grainReal && (caReal || elaReal || !caSynthetic);
  let synthetic = false;
  if (aiMeta) synthetic = true;
  else if (camera && naturalOptics) synthetic = false;
  else if (pixelSynthetic || pixelConsensus || strongSmooth) synthetic = true;
  else if (naturalOptics || (camera && !grainSynthetic)) synthetic = false;
  else synthetic = false;

  const reasons: string[] = [];
  if (synthetic) {
    if (aiMeta) reasons.push(`Süni generasiya metadata izi${metadata.aiLabels.length ? `: ${metadata.aiLabels.join(", ")}` : ""}`);
    if (grainSynthetic && faceSeen) reasons.push("Həddindən artıq hamar dəri teksturası (aşağı sensor küyü)");
    if (caSynthetic && faceSeen) reasons.push("Optik xromatik aberrasiya yoxluğu");
    if (edgeSynthetic && faceSeen) reasons.push("Kənarlar həddindən artıq kəskin, dəri məsamələri isə görünmür");
    if (elaSynthetic) reasons.push("ELA sıxılma qalığı vahiddir");
    if (reasons.length === 0) reasons.push("Süni generasiya metadata izi");
  } else {
    if (grainReal || caReal) reasons.push("Təbii sensor dənəvərliyi və optik aberrasiya");
    if (camera || metadata.cameraLabels.includes("Exif")) {
      reasons.push(`Real kamera EXIF izi${metadata.cameraLabels.length ? `: ${metadata.cameraLabels.join(", ")}` : ""}`);
    }
    if (reasons.length === 0) reasons.push("Piksel forenzikası süni generasiya həddinə çatmadı");
  }

  const agreement = syntheticVotes / 4;
  const score = synthetic
    ? bandScore(aiMeta ? 0.55 + agreement * 0.45 : 0.35 + agreement * 0.65, 84, 96)
    : bandScore(camera && grainReal ? agreement * 0.35 : agreement, 4, 16);

  return {
    score,
    smoothness: clamp(Math.round(100 - Math.min(100, signals.grainRms * 28))),
    variance: clamp(Math.round(signals.edgeRatio * 4)),
    flicker: clamp(Math.round(signals.caShift * 40)),
    grid: signals.grid,
    tone: synthetic ? "synthetic" : "real",
    verdict: synthetic ? "KRİTİK DİPFEYK / SÜNİ GENERASİYA" : "HƏQİQİ İNSAN TƏSVİRİ",
    detail: reasons[0] ?? "",
    reasons,
    face,
    sourceWidth,
    sourceHeight,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

function waitMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("timeout")), 2500);
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(new Error("video"));
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 900);
    video.onseeked = () => {
      window.clearTimeout(timer);
      video.onseeked = null;
      resolve();
    };
    video.currentTime = time;
  });
}

async function readHead(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 65536).arrayBuffer());
}

interface FaceDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ boundingBox: { x: number; y: number; width: number; height: number } }[]>;
}

function createFaceDetector(): FaceDetectorLike | null {
  const host = window as Window & {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  };
  if (!host.FaceDetector) return null;
  try {
    return new host.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
  } catch {
    return null;
  }
}

function drawSource(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): { canvas: HTMLCanvasElement; width: number; height: number } | null {
  const maxEdge = 720;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(32, Math.round(sourceWidth * scale));
  const height = Math.max(32, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  return { canvas, width, height };
}

function cropFace(source: HTMLCanvasElement, box: FaceBox): { canvas: HTMLCanvasElement; pixels: ImageData } | null {
  const width = source.width;
  const height = source.height;
  const padX = box.width * 0.08;
  const padY = box.height * 0.08;
  const x = clamp(Math.floor((box.x - padX) * width), 0, width - 2);
  const y = clamp(Math.floor((box.y - padY) * height), 0, height - 2);
  const cropWidth = clamp(Math.floor((box.width + padX * 2) * width), 2, width - x);
  const cropHeight = clamp(Math.floor((box.height + padY * 2) * height), 2, height - y);
  const longest = Math.max(cropWidth, cropHeight);
  const scale = Math.min(1, 192 / longest);
  const outWidth = Math.max(32, Math.round(cropWidth * scale));
  const outHeight = Math.max(32, Math.round(cropHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, x, y, cropWidth, cropHeight, 0, 0, outWidth, outHeight);
  return { canvas, pixels: context.getImageData(0, 0, outWidth, outHeight) };
}

async function jpegResidual(canvas: HTMLCanvasElement, original: Uint8ClampedArray): Promise<{ mean: number; cv: number } | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92));
  if (!blob || typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(blob);
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const context = copy.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, copy.width, copy.height);
  if ("close" in bitmap) bitmap.close();
  const recompressed = context.getImageData(0, 0, copy.width, copy.height).data;
  return elaStats(original, recompressed, copy.width, copy.height);
}

async function detectFaceBox(canvas: HTMLCanvasElement, pixels: Uint8ClampedArray, width: number, height: number): Promise<{ box: FaceBox; coverage: number }> {
  const skin = locateSkinFace(pixels, width, height);
  const detector = createFaceDetector();
  if (!detector) return skin;
  try {
    const faces = await detector.detect(canvas);
    const found = faces[0]?.boundingBox;
    if (!found || found.width < 8 || found.height < 8) return skin;
    const box = {
      x: clamp(found.x / width, 0, 1),
      y: clamp(found.y / height, 0, 1),
      width: clamp(found.width / width, 0.05, 1),
      height: clamp(found.height / height, 0.05, 1),
    };
    if (box.x + box.width > 1) box.width = 1 - box.x;
    if (box.y + box.height > 1) box.height = 1 - box.y;
    return { box, coverage: Math.max(skin.coverage, 0.2) };
  } catch {
    return skin;
  }
}

async function inspectSource(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, metadata: MetadataSignals): Promise<StillForensics | null> {
  const drawn = drawSource(source, sourceWidth, sourceHeight);
  if (!drawn) return null;
  const context = drawn.canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const frame = context.getImageData(0, 0, drawn.width, drawn.height);
  const located = await detectFaceBox(drawn.canvas, frame.data, drawn.width, drawn.height);
  const faceCanvas = cropFace(drawn.canvas, located.box);
  if (!faceCanvas) return null;
  const ela = await jpegResidual(faceCanvas.canvas, faceCanvas.pixels.data);
  const signals = measureSignals(faceCanvas.pixels.data, faceCanvas.pixels.width, faceCanvas.pixels.height, ela ?? undefined);
  signals.skinCoverage = Math.max(signals.skinCoverage, located.coverage);
  return judgeStill(signals, metadata, located.box, sourceWidth, sourceHeight);
}

export async function inspectImageFile(file: File): Promise<{ url: string; forensics: StillForensics }> {
  const url = URL.createObjectURL(file);
  try {
    const [image, head] = await Promise.all([loadImage(url), readHead(file)]);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const forensics = await inspectSource(image, width, height, scanMetadata(head));
    if (!forensics) throw new Error("canvas");
    return { url, forensics };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function inspectVideoFrame(file: File): Promise<StillForensics | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    const head = await readHead(file);
    await waitMetadata(video);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration > 0.2) await seekTo(video, Math.min(duration * 0.5, Math.max(0, duration - 0.05)));
    const width = video.videoWidth || 320;
    const height = video.videoHeight || 180;
    return await inspectSource(video, width, height, scanMetadata(head));
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
