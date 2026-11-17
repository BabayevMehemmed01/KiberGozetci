import { clamp } from "./utils.ts";
import type { ForensicKind } from "./forensicClass.ts";

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FacePoint {
  x: number;
  y: number;
}

export interface DetectedFace {
  box: FaceBox;
  landmarks: FacePoint[];
  confidence: number;
}

export type FaceCategory = "REAL ŞƏKİL" | "AI İLƏ DƏYİŞDİRİLMİŞ REAL ŞƏKİL" | "SÜNİ İNTELLEKT YARADICILIĞI" | "";

export type FaceRisk = "real" | "edited" | "generated" | "none";

export const NO_FACE_MESSAGE = "Şəkildə insan üzü aşkarlanmadı — üz forenzik analizi aparıla bilməz.";

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
  faces: DetectedFace[];
  sourceWidth: number;
  sourceHeight: number;
  noFace: boolean;
  category: FaceCategory;
  risk: FaceRisk;
  heatmap: number[];
  inconclusive?: boolean;
}

export interface PixelSignals {
  edgeRatio: number;
  grainRms: number;
  caShift: number;
  elaMean: number;
  elaCv: number;
  skinCoverage: number;
  grid: number[];
  dctSlope: number;
  dctHf: number;
  dctGrid: number;
  poissonSlope: number;
  cfaPeriod: number;
  heatmap: number[];
}

export interface MetadataSignals {
  aiLabels: string[];
  editLabels: string[];
  cameraLabels: string[];
  optical: boolean;
  generatedPng: boolean;
}

const AI_RULES: { label: string; pattern: RegExp }[] = [
  { label: "C2PA", pattern: /c2pa/ },
  { label: "JUMBF", pattern: /jumbf|jumb/ },
  { label: "OpenAI", pattern: /openai/ },
  { label: "Midjourney", pattern: /midjourney/ },
  { label: "Stable Diffusion", pattern: /stable diffusion/ },
  { label: "Flux", pattern: /flux\.1|\bflux\b/ },
  { label: "Gemini", pattern: /gemini/ },
  { label: "DALL-E", pattern: /dall[-·.\s]?e/ },
  { label: "ComfyUI", pattern: /comfyui/ },
];

const GENERATION_TEXT = /parameters|negative prompt|sampler|cfg scale|steps:|seed:|stable diffusion|comfyui|midjourney|dall[-·.\s]?e|openai|gemini|made with google ai|c2pa|jumbf/;
const EDIT_RULES: { label: string; pattern: RegExp }[] = [
  { label: "Adobe Photoshop", pattern: /adobe photoshop|\bphotoshop\b/ },
  { label: "Generative Fill", pattern: /generative fill/ },
  { label: "Firefly", pattern: /\bfirefly\b/ },
  { label: "FaceApp", pattern: /faceapp/ },
  { label: "Remini", pattern: /\bremini\b/ },
  { label: "Facetune", pattern: /facetune/ },
  { label: "InsightFace", pattern: /insightface/ },
];

const STRUCTURAL_EDIT = new Set(["Generative Fill", "Firefly", "FaceApp", "InsightFace"]);

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
  if (optical) cameraLabels.push(text.includes("isospeedratings") || text.includes("iso speed") ? "ISOSpeedRatings" : "FNumber");
  const cameraSeen = cameraLabels.length > 0 || optical;
  const googlePhrase = /made with google|google ai|google generative|\bimagen\b/.test(text);
  if ((googlePhrase || (/\bgoogle\b/.test(text) && !cameraSeen)) && !aiLabels.includes("Google")) aiLabels.push("Google");
  const editLabels: string[] = [];
  for (const rule of EDIT_RULES) {
    if (rule.pattern.test(text) && !editLabels.includes(rule.label)) editLabels.push(rule.label);
  }
  if (/xmp/.test(text) && /photoshop:history|xmpmm:|derivedfrom|generative fill|adobe photoshop/.test(text) && !editLabels.includes("XMP")) {
    editLabels.push("XMP");
  }
  const generatedPng = pngGenerationBlock(head, cameraSeen);
  if (generatedPng && !aiLabels.includes("PNG tEXt/iTXt")) aiLabels.push("PNG tEXt/iTXt");
  return { aiLabels, cameraLabels, editLabels, optical, generatedPng };
}

function isSkin(red: number, green: number, blue: number): boolean {
  if (red < 70 || green < 30 || blue < 15) return false;
  if (red <= green || red <= blue) return false;
  if (Math.max(red, green, blue) - Math.min(red, green, blue) < 12) return false;
  const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
  const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
  return cr > 133 && cr < 183 && cb > 80 && cb < 135;
}

function landmarksFromBox(box: FaceBox): FacePoint[] {
  return [
    { x: box.x + box.width * 0.33, y: box.y + box.height * 0.38 },
    { x: box.x + box.width * 0.67, y: box.y + box.height * 0.38 },
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.56 },
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.74 },
  ];
}

function overlapRatio(left: FaceBox, right: FaceBox): number {
  const x = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const y = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const intersection = x * y;
  const area = Math.min(left.width * left.height, right.width * right.height);
  return area > 0 ? intersection / area : 0;
}

function mergeFaces(faces: DetectedFace[]): DetectedFace[] {
  const pending = [...faces].sort((left, right) => right.box.width * right.box.height - left.box.width * left.box.height);
  const kept: DetectedFace[] = [];
  for (const face of pending) {
    const hit = kept.find((item) => overlapRatio(item.box, face.box) > 0.45);
    if (!hit) kept.push(face);
  }
  return kept;
}

export function locateSkinFaces(pixels: Uint8ClampedArray, width: number, height: number): DetectedFace[] {
  const step = Math.max(2, Math.floor(Math.min(width, height) / 160));
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const mask = new Uint8Array(cols * rows);
  const luma = new Float32Array(cols * rows);
  let skin = 0;
  for (let gy = 0; gy < rows; gy += 1) {
    const y = Math.min(height - 1, gy * step);
    for (let gx = 0; gx < cols; gx += 1) {
      const x = Math.min(width - 1, gx * step);
      const index = (y * width + x) * 4;
      const cell = gy * cols + gx;
      luma[cell] = lumaOf(pixels, index);
      if (!isSkin(pixels[index], pixels[index + 1], pixels[index + 2])) continue;
      mask[cell] = 1;
      skin += 1;
    }
  }
  if (skin < 24) return [];
  const gradient = new Float32Array(cols * rows);
  for (let gy = 1; gy < rows - 1; gy += 1) {
    for (let gx = 1; gx < cols - 1; gx += 1) {
      const cell = gy * cols + gx;
      gradient[cell] = Math.hypot(luma[cell + 1] - luma[cell - 1], luma[cell + cols] - luma[cell - cols]);
    }
  }
  const seen = new Uint8Array(cols * rows);
  const faces: DetectedFace[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let count = 0;
    let minX = cols;
    let minY = rows;
    let maxX = 0;
    let maxY = 0;
    let gradientSum = 0;
    let lumaSum = 0;
    let lumaSquare = 0;
    while (stack.length > 0) {
      const cell = stack.pop() ?? 0;
      const gx = cell % cols;
      const gy = Math.floor(cell / cols);
      count += 1;
      if (gx < minX) minX = gx;
      if (gy < minY) minY = gy;
      if (gx > maxX) maxX = gx;
      if (gy > maxY) maxY = gy;
      gradientSum += gradient[cell];
      lumaSum += luma[cell];
      lumaSquare += luma[cell] * luma[cell];
      const neighbors = [cell - 1, cell + 1, cell - cols, cell + cols];
      for (const next of neighbors) {
        if (next < 0 || next >= mask.length || seen[next] || !mask[next]) continue;
        const nx = next % cols;
        if (Math.abs(nx - gx) > 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (count < 20) continue;
    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    const boxWidth = (spanX * step) / width;
    const boxHeight = (spanY * step) / height;
    const aspect = boxWidth / Math.max(boxHeight, 1e-6);
    const area = boxWidth * boxHeight;
    const fill = count / (spanX * spanY);
    const meanLuma = lumaSum / count;
    const lumaStd = Math.sqrt(Math.max(0, lumaSquare / count - meanLuma * meanLuma));
    const meanGradient = gradientSum / count;
    if (aspect < 0.48 || aspect > 1.38) continue;
    if (area < 0.015 || area > 0.92) continue;
    if (fill < 0.38) continue;
    if (meanGradient < 4 && lumaStd < 11) continue;
    const box = {
      x: clamp((minX * step) / width, 0, 0.98),
      y: clamp((minY * step) / height, 0, 0.98),
      width: clamp(boxWidth, 0.04, 1),
      height: clamp(boxHeight, 0.04, 1),
    };
    if (box.x + box.width > 1) box.width = 1 - box.x;
    if (box.y + box.height > 1) box.height = 1 - box.y;
    faces.push({
      box,
      landmarks: landmarksFromBox(box),
      confidence: clamp(fill * 0.55 + Math.min(lumaStd, 28) / 80 + Math.min(meanGradient, 24) / 90, 0, 1),
    });
  }
  return mergeFaces(faces).sort((left, right) => right.box.width * right.box.height - left.box.width * left.box.height);
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

export function elaStats(
  original: Uint8ClampedArray,
  recompressed: Uint8ClampedArray,
  width: number,
  height: number,
): { mean: number; cv: number; blocks: number[] } {
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
  return { mean, cv, blocks: errors };
}

const DCT_COS = new Float64Array(64);
for (let frequency = 0; frequency < 8; frequency += 1) {
  for (let sample = 0; sample < 8; sample += 1) {
    DCT_COS[frequency * 8 + sample] = Math.cos(((2 * sample + 1) * frequency * Math.PI) / 16);
  }
}

function dct8(values: Float64Array, into: Float64Array) {
  const temp = new Float64Array(64);
  for (let y = 0; y < 8; y += 1) {
    for (let u = 0; u < 8; u += 1) {
      let sum = 0;
      const row = y * 8;
      for (let x = 0; x < 8; x += 1) sum += values[row + x] * DCT_COS[u * 8 + x];
      temp[row + u] = sum * (u === 0 ? 0.35355339059 : 0.5);
    }
  }
  for (let u = 0; u < 8; u += 1) {
    for (let v = 0; v < 8; v += 1) {
      let sum = 0;
      for (let y = 0; y < 8; y += 1) sum += temp[y * 8 + u] * DCT_COS[v * 8 + y];
      into[v * 8 + u] = sum * (v === 0 ? 0.35355339059 : 0.5);
    }
  }
}

function regressionSlope(xs: number[], ys: number[]): number {
  const count = xs.length;
  if (count < 3) return -4;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let index = 0; index < count; index += 1) {
    sumX += xs[index];
    sumY += ys[index];
    sumXX += xs[index] * xs[index];
    sumXY += xs[index] * ys[index];
  }
  const denominator = count * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) return -4;
  return (count * sumXY - sumX * sumY) / denominator;
}

function analyzeSpectrum(
  gray: Float32Array,
  gradient: Float32Array,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  elaBlocks?: number[],
): { dctSlope: number; dctHf: number; dctGrid: number; poissonSlope: number; cfaPeriod: number; heatmap: number[] } {
  const block = 8;
  const blocksX = Math.floor(width / block);
  const blocksY = Math.floor(height / block);
  const values = new Float64Array(64);
  const coeffs = new Float64Array(64);
  const rings = new Float64Array(12);
  const ringCount = new Float64Array(12);
  const blockHf = new Float64Array(Math.max(1, blocksX * blocksY));
  let lowEnergy = 0;
  let highEnergy = 0;
  let gridEnergy = 0;
  let neighborEnergy = 0;
  let blockIndex = 0;
  for (let by = 0; by < blocksY; by += 1) {
    for (let bx = 0; bx < blocksX; bx += 1) {
      let mean = 0;
      for (let row = 0; row < block; row += 1) {
        const y = by * block + row;
        for (let column = 0; column < block; column += 1) {
          mean += gray[y * width + bx * block + column];
        }
      }
      mean /= 64;
      for (let row = 0; row < block; row += 1) {
        const y = by * block + row;
        for (let column = 0; column < block; column += 1) {
          values[row * 8 + column] = gray[y * width + bx * block + column] - mean;
        }
      }
      dct8(values, coeffs);
      let low = 0;
      let high = 0;
      for (let v = 0; v < 8; v += 1) {
        for (let u = 0; u < 8; u += 1) {
          if (u === 0 && v === 0) continue;
          const magnitude = Math.abs(coeffs[v * 8 + u]);
          const radius = Math.hypot(u, v);
          const bin = Math.min(11, Math.round(radius));
          rings[bin] += magnitude * magnitude;
          ringCount[bin] += 1;
          if (u + v <= 2) low += magnitude;
          if (u + v >= 5) high += magnitude;
        }
      }
      const grid = Math.abs(coeffs[4]) + Math.abs(coeffs[32]) + Math.abs(coeffs[36]) + Math.abs(coeffs[18]);
      const neighbor = Math.abs(coeffs[10]) + Math.abs(coeffs[17]) + Math.abs(coeffs[9]) + Math.abs(coeffs[25]);
      lowEnergy += low;
      highEnergy += high;
      gridEnergy += grid;
      neighborEnergy += neighbor;
      blockHf[blockIndex] = high / (low + 1e-6);
      blockIndex += 1;
    }
  }
  const slopeX: number[] = [];
  const slopeY: number[] = [];
  for (let bin = 1; bin <= 7; bin += 1) {
    if (ringCount[bin] < 1) continue;
    slopeX.push(Math.log(bin));
    slopeY.push(Math.log(rings[bin] / ringCount[bin] + 1e-8));
  }
  const dctSlope = regressionSlope(slopeX, slopeY);
  const dctHf = highEnergy / (lowEnergy + 1e-6);
  const dctGrid = gridEnergy / (neighborEnergy + 1e-6);

  const bins = 8;
  const residualSum = new Float64Array(bins);
  const residualSquare = new Float64Array(bins);
  const residualCount = new Float64Array(bins);
  let checker = 0;
  let checkerEnergy = 0;
  let checkerCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (gradient[index] > 28) continue;
      let blur = 0;
      let greenBlur = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const pixel = index + dy * width + dx;
          blur += gray[pixel];
          greenBlur += pixels[pixel * 4 + 1];
        }
      }
      const predicted = blur / 8;
      const residual = gray[index] - predicted;
      const greenResidual = pixels[index * 4 + 1] - greenBlur / 8;
      const bin = Math.min(bins - 1, Math.floor((predicted / 256) * bins));
      residualSum[bin] += residual;
      residualSquare[bin] += residual * residual;
      residualCount[bin] += 1;
      const sign = (x + y) % 2 === 0 ? 1 : -1;
      checker += greenResidual * sign;
      checkerEnergy += greenResidual * greenResidual;
      checkerCount += 1;
    }
  }
  const intensity: number[] = [];
  const variance: number[] = [];
  for (let bin = 0; bin < bins; bin += 1) {
    if (residualCount[bin] < 24) continue;
    const mean = residualSum[bin] / residualCount[bin];
    intensity.push((bin + 0.5) * (255 / bins));
    variance.push(Math.max(0, residualSquare[bin] / residualCount[bin] - mean * mean));
  }
  const poissonSlope = intensity.length >= 3 ? regressionSlope(intensity, variance) : 0;
  const cfaPeriod = checkerCount > 32 ? Math.abs(checker) / Math.sqrt(checkerEnergy * checkerCount + 1e-9) : 0;

  const heatSize = 32;
  const heatmap = Array.from({ length: heatSize * heatSize }, () => 0);
  if (blocksX > 0 && blocksY > 0) {
    const hfValues = Array.from(blockHf.subarray(0, blocksX * blocksY));
    const hfMedian = percentile(hfValues, 0.5);
    const hfDeviation = hfValues.map((value) => Math.abs(Math.log(value + 0.02) - Math.log(hfMedian + 0.02)));
    const hfPeak = Math.max(percentile(hfDeviation, 0.92), 1e-4);
    const elaPeak = elaBlocks && elaBlocks.length === hfValues.length ? Math.max(percentile(elaBlocks, 0.92), 0.4) : 1;
    for (let row = 0; row < heatSize; row += 1) {
      for (let column = 0; column < heatSize; column += 1) {
        const bx = Math.min(blocksX - 1, Math.floor((column / heatSize) * blocksX));
        const by = Math.min(blocksY - 1, Math.floor((row / heatSize) * blocksY));
        const cell = by * blocksX + bx;
        const spectral = clamp(hfDeviation[cell] / hfPeak, 0, 1);
        const ela = elaBlocks && elaBlocks.length === hfValues.length ? clamp((elaBlocks[cell] ?? 0) / elaPeak, 0, 1) : spectral;
        heatmap[row * heatSize + column] = clamp(ela * 0.58 + spectral * 0.42, 0, 1);
      }
    }
  }
  if (dctHf <= 0.11 && heatmap.every((value) => value < 0.08)) heatmap.fill(0.82);
  return { dctSlope, dctHf, dctGrid, poissonSlope, cfaPeriod, heatmap };
}

export function measureSignals(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  ela?: { mean: number; cv: number; blocks?: number[] },
): PixelSignals {
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
  const flat: { x: number; y: number }[] = [];

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
        if (sobel < 14) flat.push({ x, y });
      }
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

  const spectrum = analyzeSpectrum(gray, gradient, pixels, width, height, ela?.blocks);
  const heatmap = spectrum.heatmap;
  const grid = Array.from({ length: 64 }, (_, index) => {
    const column = index % 8;
    const row = Math.floor(index / 8);
    const x = Math.min(31, Math.floor((column / 8) * 32));
    const y = Math.min(31, Math.floor((row / 8) * 32));
    return heatmap[y * 32 + x] ?? 0;
  });

  return {
    edgeRatio,
    grainRms,
    caShift,
    elaMean: ela?.mean ?? -1,
    elaCv: ela?.cv ?? -1,
    skinCoverage,
    grid,
    dctSlope: spectrum.dctSlope,
    dctHf: spectrum.dctHf,
    dctGrid: spectrum.dctGrid,
    poissonSlope: spectrum.poissonSlope,
    cfaPeriod: spectrum.cfaPeriod,
    heatmap,
  };
}

function bandScore(unit: number, low: number, high: number): number {
  const span = high - low;
  return clamp(Math.round(low + clamp(unit, 0, 1) * span), low, high);
}

const INNER = 1;
const SEAM = 2;
const OUTER = 3;

export interface ZoneForensics {
  faceNoise: number;
  bgNoise: number;
  seamNoise: number;
  faceEla: number;
  bgEla: number;
  seamEla: number;
  faceCa: number;
  bgCa: number;
  featureHf: number;
  skinHf: number;
  bgHf: number;
  dctSlope: number;
  dctHf: number;
  dctGrid: number;
  lightResidual: number;
  bgKnown: boolean;
  seamKnown: boolean;
  cellNoise: number[];
  cellZone: number[];
  cellFeature: boolean[];
}

function zoneAt(x: number, y: number, box: FaceBox, width: number, height: number, ring: number): number {
  const left = box.x * width;
  const top = box.y * height;
  const right = left + box.width * width;
  const bottom = top + box.height * height;
  const dx = x < left ? left - x : x > right ? x - right : 0;
  const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy) <= ring ? SEAM : OUTER;
  const inside = Math.min(x - left, right - x, y - top, bottom - y);
  return inside <= ring ? SEAM : INNER;
}

function solve3(matrix: number[], vector: number[]): [number, number, number] | null {
  const m = matrix.slice();
  const v = vector.slice();
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(m[row * 3 + col]) > Math.abs(m[pivot * 3 + col])) pivot = row;
    }
    if (Math.abs(m[pivot * 3 + col]) < 1e-8) return null;
    if (pivot !== col) {
      for (let k = 0; k < 3; k += 1) {
        const swap = m[col * 3 + k];
        m[col * 3 + k] = m[pivot * 3 + k];
        m[pivot * 3 + k] = swap;
      }
      const swapV = v[col];
      v[col] = v[pivot];
      v[pivot] = swapV;
    }
    const scale = m[col * 3 + col];
    for (let k = col; k < 3; k += 1) m[col * 3 + k] /= scale;
    v[col] /= scale;
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = m[row * 3 + col];
      for (let k = col; k < 3; k += 1) m[row * 3 + k] -= factor * m[col * 3 + k];
      v[row] -= factor * v[col];
    }
  }
  return [v[0], v[1], v[2]];
}

export function compareZones(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  face: DetectedFace,
  elaBlocks?: number[],
): ZoneForensics {
  const gray = new Float32Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) gray[pixel] = lumaOf(pixels, pixel * 4);
  const facePx = Math.min(face.box.width * width, face.box.height * height);
  const ring = facePx > 56 ? 12 : Math.max(4, Math.round(facePx * 0.18));
  const residual = new Float32Array(width * height);
  const gradient = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      let blur = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          blur += gray[index + dy * width + dx];
        }
      }
      residual[index] = gray[index] - blur / 8;
      gradient[index] = Math.abs(gray[index + 1] - gray[index - 1]) + Math.abs(gray[index + width] - gray[index - width]);
    }
  }

  const noiseEnergy = [0, 0, 0, 0];
  const noiseCount = [0, 0, 0, 0];
  const allEnergy = [0, 0, 0, 0];
  const allCount = [0, 0, 0, 0];
  const elaSum = [0, 0, 0, 0];
  const elaCount = [0, 0, 0, 0];
  const blocksX = Math.max(1, Math.floor(width / 8));
  const blocksY = Math.max(1, Math.floor(height / 8));
  const elaReady = Boolean(elaBlocks && elaBlocks.length >= blocksX * blocksY);
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const index = y * width + x;
      const zone = zoneAt(x, y, face.box, width, height, ring);
      allEnergy[zone] += residual[index] * residual[index];
      allCount[zone] += 1;
      if (gradient[index] <= 42) {
        noiseEnergy[zone] += residual[index] * residual[index];
        noiseCount[zone] += 1;
      }
      if (elaReady && elaBlocks) {
        const block = Math.min(blocksY - 1, Math.floor(y / 8)) * blocksX + Math.min(blocksX - 1, Math.floor(x / 8));
        elaSum[zone] += elaBlocks[block] ?? 0;
        elaCount[zone] += 1;
      }
    }
  }
  const rms = (zone: number) => {
    if (noiseCount[zone] >= 12) return Math.sqrt(noiseEnergy[zone] / noiseCount[zone]);
    return allCount[zone] >= 12 ? Math.sqrt(allEnergy[zone] / allCount[zone]) : 0;
  };
  const faceNoise = rms(INNER);
  const bgKnown = allCount[OUTER] >= 24;
  const seamKnown = allCount[SEAM] >= 12;
  const bgNoise = bgKnown ? rms(OUTER) : faceNoise;
  const seamNoise = seamKnown ? rms(SEAM) : (faceNoise + bgNoise) / 2;
  const elaOf = (zone: number) => (elaCount[zone] > 8 ? elaSum[zone] / elaCount[zone] : -1);

  const block = 8;
  const values = new Float64Array(64);
  const coeffs = new Float64Array(64);
  const rings = new Float64Array(12);
  const ringCount = new Float64Array(12);
  const hfBlocks = new Float32Array(blocksX * blocksY);
  let lowEnergy = 0;
  let highEnergy = 0;
  let gridEnergy = 0;
  let neighborEnergy = 0;
  for (let by = 0; by < blocksY; by += 1) {
    for (let bx = 0; bx < blocksX; bx += 1) {
      let mean = 0;
      for (let row = 0; row < block; row += 1) {
        const y = by * block + row;
        if (y >= height) continue;
        for (let column = 0; column < block; column += 1) {
          const x = bx * block + column;
          if (x < width) mean += gray[y * width + x];
        }
      }
      mean /= 64;
      for (let row = 0; row < block; row += 1) {
        const y = Math.min(height - 1, by * block + row);
        for (let column = 0; column < block; column += 1) {
          const x = Math.min(width - 1, bx * block + column);
          values[row * 8 + column] = gray[y * width + x] - mean;
        }
      }
      dct8(values, coeffs);
      let low = 0;
      let high = 0;
      for (let v = 0; v < 8; v += 1) {
        for (let u = 0; u < 8; u += 1) {
          if (u === 0 && v === 0) continue;
          const magnitude = Math.abs(coeffs[v * 8 + u]);
          const bin = Math.min(11, Math.round(Math.hypot(u, v)));
          rings[bin] += magnitude * magnitude;
          ringCount[bin] += 1;
          if (u + v <= 2) low += magnitude;
          if (u + v >= 5) high += magnitude;
        }
      }
      lowEnergy += low;
      highEnergy += high;
      gridEnergy += Math.abs(coeffs[4]) + Math.abs(coeffs[32]) + Math.abs(coeffs[36]) + Math.abs(coeffs[18]);
      neighborEnergy += Math.abs(coeffs[10]) + Math.abs(coeffs[17]) + Math.abs(coeffs[9]) + Math.abs(coeffs[25]);
      hfBlocks[by * blocksX + bx] = high / (low + 1e-6);
    }
  }
  const slopeX: number[] = [];
  const slopeY: number[] = [];
  for (let bin = 1; bin <= 7; bin += 1) {
    if (ringCount[bin] < 1) continue;
    slopeX.push(Math.log(bin));
    slopeY.push(Math.log(rings[bin] / ringCount[bin] + 1e-8));
  }

  const marks = face.landmarks.length >= 4 ? face.landmarks : landmarksFromBox(face.box);
  const eyeA = marks[0];
  const eyeB = marks[1];
  const nose = marks[2];
  const mouth = marks[3];
  const featureRx = Math.max(6, face.box.width * width * 0.16);
  const featureRy = Math.max(6, face.box.height * height * 0.12);
  const near = (x: number, y: number, point: FacePoint) => {
    const dx = (x - point.x * width) / featureRx;
    const dy = (y - point.y * height) / featureRy;
    return dx * dx + dy * dy <= 1;
  };
  let featureSum = 0;
  let featureCount = 0;
  let skinSum = 0;
  let skinCount = 0;
  let bgHfSum = 0;
  let bgHfCount = 0;
  for (let by = 0; by < blocksY; by += 1) {
    for (let bx = 0; bx < blocksX; bx += 1) {
      const x = bx * 8 + 4;
      const y = by * 8 + 4;
      const energy = hfBlocks[by * blocksX + bx];
      const zone = zoneAt(x, y, face.box, width, height, ring);
      if (zone === OUTER) {
        bgHfSum += energy;
        bgHfCount += 1;
        continue;
      }
      if (zone !== INNER) continue;
      if (near(x, y, eyeA) || near(x, y, eyeB) || near(x, y, mouth)) {
        featureSum += energy;
        featureCount += 1;
      } else if (y < nose.y * height || Math.abs(x - nose.x * width) > featureRx * 0.45) {
        skinSum += energy;
        skinCount += 1;
      }
    }
  }

  let shiftSum = [0, 0, 0, 0];
  let shiftCount = [0, 0, 0, 0];
  for (let y = 2; y < height - 2 && shiftCount[INNER] + shiftCount[OUTER] < 1800; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const index = y * width + x;
      if (gradient[index] < 28) continue;
      const zone = zoneAt(x, y, face.box, width, height, ring);
      if (zone === SEAM) continue;
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
        if (sx < 0 || sy < 0 || px < 0 || py < 0 || sx >= width || sy >= height || px >= width || py >= height) continue;
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
      shiftSum[zone] += Math.abs(redPeak - bluePeak);
      shiftCount[zone] += 1;
    }
  }
  const caOf = (zone: number) => (shiftCount[zone] > 10 ? shiftSum[zone] / shiftCount[zone] : 0);

  const left = face.box.x * width;
  const top = face.box.y * height;
  const faceW = Math.max(1, face.box.width * width);
  const faceH = Math.max(1, face.box.height * height);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sxz = 0;
  let syz = 0;
  let samples = 0;
  const planeX: number[] = [];
  const planeY: number[] = [];
  const planeZ: number[] = [];
  for (let y = Math.max(1, Math.floor(top)); y < Math.min(height - 1, top + faceH); y += 3) {
    for (let x = Math.max(1, Math.floor(left)); x < Math.min(width - 1, left + faceW); x += 3) {
      if (zoneAt(x, y, face.box, width, height, ring) !== INNER) continue;
      const nx = (x - left) / faceW;
      const ny = (y - top) / faceH;
      const z = gray[y * width + x];
      sxx += nx * nx;
      syy += ny * ny;
      sxy += nx * ny;
      sx += nx;
      sy += ny;
      sz += z;
      sxz += nx * z;
      syz += ny * z;
      samples += 1;
      planeX.push(nx);
      planeY.push(ny);
      planeZ.push(z);
    }
  }
  const plane = samples > 12 ? solve3([sxx, sxy, sx, sxy, syy, sy, sx, sy, samples], [sxz, syz, sz]) : null;
  let lightResidual = 0;
  if (plane && planeZ.length > 8) {
    let error = 0;
    let deviation = 0;
    const mean = sz / samples;
    for (let index = 0; index < planeZ.length; index += 1) {
      const fit = plane[0] * planeX[index] + plane[1] * planeY[index] + plane[2];
      error += (planeZ[index] - fit) ** 2;
      deviation += (planeZ[index] - mean) ** 2;
    }
    lightResidual = Math.sqrt(error / planeZ.length) / (Math.sqrt(deviation / planeZ.length) + 1);
  }

  const cells = 32;
  const cellNoise = Array.from({ length: cells * cells }, () => 0);
  const cellZone = Array.from({ length: cells * cells }, () => OUTER);
  const cellFeature = Array.from({ length: cells * cells }, () => false);
  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const x = Math.min(width - 2, Math.max(1, Math.round(((column + 0.5) / cells) * (width - 1))));
      const y = Math.min(height - 2, Math.max(1, Math.round(((row + 0.5) / cells) * (height - 1))));
      const cell = row * cells + column;
      cellZone[cell] = zoneAt(x, y, face.box, width, height, ring);
      cellFeature[cell] = near(x, y, eyeA) || near(x, y, eyeB) || near(x, y, mouth);
      let energy = 0;
      let count = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const sx = Math.min(width - 2, Math.max(1, x + dx));
          const sy = Math.min(height - 2, Math.max(1, y + dy));
          const index = sy * width + sx;
          if (gradient[index] > 48) continue;
          energy += residual[index] * residual[index];
          count += 1;
        }
      }
      cellNoise[cell] = count ? Math.sqrt(energy / count) : 0;
    }
  }

  return {
    faceNoise,
    bgNoise,
    seamNoise,
    faceEla: elaOf(INNER),
    bgEla: elaOf(OUTER),
    seamEla: elaOf(SEAM),
    faceCa: caOf(INNER),
    bgCa: caOf(OUTER),
    featureHf: featureCount ? featureSum / featureCount : 0,
    skinHf: skinCount ? skinSum / skinCount : 0,
    bgHf: bgHfCount ? bgHfSum / bgHfCount : 0,
    dctSlope: regressionSlope(slopeX, slopeY),
    dctHf: highEnergy / (lowEnergy + 1e-6),
    dctGrid: gridEnergy / (neighborEnergy + 1e-6),
    lightResidual,
    bgKnown,
    seamKnown,
    cellNoise,
    cellZone,
    cellFeature,
  };
}

export function classifyZones(
  zones: ZoneForensics,
  metadata: MetadataSignals,
  faces: DetectedFace[],
  sourceWidth: number,
  sourceHeight: number,
): StillForensics {
  const camera = metadata.optical || metadata.cameraLabels.some((label) => label !== "Exif");
  const genMeta = metadata.aiLabels.length > 0;
  const structuralMeta = metadata.editLabels.some((label) => STRUCTURAL_EDIT.has(label));
  const lightMeta = metadata.editLabels.some((label) => !STRUCTURAL_EDIT.has(label));
  const relGap = Math.abs(zones.faceNoise - zones.bgNoise) / (Math.max(zones.faceNoise, zones.bgNoise) + 0.05);
  const faceSmoother = zones.bgKnown && zones.bgNoise >= Math.max(0.08, zones.faceNoise * 1.9) && zones.faceNoise <= zones.bgNoise * 0.62;
  const bgSmoother = zones.bgKnown && zones.faceNoise >= Math.max(0.08, zones.bgNoise * 1.9) && zones.bgNoise <= zones.faceNoise * 0.62;
  const elaKnown = zones.faceEla >= 0 && zones.bgEla >= 0 && zones.seamEla >= 0;
  const seamHot =
    zones.seamKnown &&
    elaKnown &&
    zones.seamEla > Math.max(zones.faceEla, zones.bgEla) * 1.45 &&
    zones.seamEla - Math.max(zones.faceEla, zones.bgEla) > 1.8;
  const caMismatch = zones.bgKnown && zones.bgCa >= 0.34 && zones.faceCa <= 0.22;
  const deadSkin = zones.skinHf < 0.09 && zones.featureHf > 0.22 && zones.bgHf > 0.2;
  const flatFace = zones.featureHf < 0.1 && zones.skinHf < 0.1 && zones.bgHf > 0.22;
  const partsMismatch = deadSkin || flatFace;
  const agreeNoise = !zones.bgKnown || relGap < 0.45;
  const agreeEla = !elaKnown || zones.seamEla < Math.max(zones.faceEla, zones.bgEla) * 1.35 + 1.2;
  const spectralNatural = zones.dctSlope <= -0.95 && zones.dctSlope >= -2.9 && zones.dctHf >= 0.12 && zones.dctGrid < 1.7;
  const flatSpectrum = zones.dctSlope > -0.75 && zones.dctHf > 0.3;
  const bothQuiet = zones.faceNoise < 0.08 && (!zones.bgKnown || zones.bgNoise < 0.08);
  const naturalPair = agreeNoise && agreeEla && !caMismatch && !partsMismatch && !faceSmoother && !bgSmoother && !bothQuiet && (spectralNatural || camera);
  const wholeGenerated = (bothQuiet && !camera) || (bothQuiet && !spectralNatural) || (flatSpectrum && !camera && bothQuiet) || (zones.dctGrid >= 1.85 && bothQuiet);

  let risk: FaceRisk = "real";
  if (faceSmoother || bgSmoother || seamHot || caMismatch || partsMismatch || structuralMeta || lightMeta) {
    risk = bothQuiet ? "generated" : "edited";
  } else if (wholeGenerated || (genMeta && !naturalPair)) risk = "generated";
  else if (genMeta && naturalPair) risk = "edited";
  else risk = "real";

  const structural =
    risk === "edited" &&
    (seamHot || structuralMeta || (faceSmoother && (deadSkin || caMismatch || relGap > 0.55)) || (bgSmoother && relGap > 0.5) || (partsMismatch && relGap > 0.48));

  const category: FaceCategory = risk === "generated" ? "SÜNİ İNTELLEKT YARADICILIĞI" : risk === "edited" ? "AI İLƏ DƏYİŞDİRİLMİŞ REAL ŞƏKİL" : "REAL ŞƏKİL";
  const reasons: string[] = [`Kateqoriya: ${category}`];
  if (risk === "real") {
    reasons.push(
      camera
        ? `Orijinal kamera sensoru təsdiqləndi${metadata.cameraLabels.length ? `: ${metadata.cameraLabels.join(", ")}` : ""}. Üz və fonun PRNU küyü, ELA və xromatik aberrasiyası uyğundur.`
        : "Üz və fon sensor küyü, ELA və xromatik aberrasiya bir-birinə uyğundur. Lokal AI müdaxiləsi aşkarlanmadı.",
    );
  } else if (risk === "edited") {
    if (camera && faceSmoother && seamHot) {
      reasons.push("Orijinal kamera sensoru təsdiqləndi, lakin üz sahəsində PRNU küyü itkisi və çənə sərhədində ELA uyğunsuzluğu (AI üz manipulyasiyası) aşkarlandı");
    } else if (camera && faceSmoother) {
      reasons.push("Orijinal kamera sensoru təsdiqləndi, lakin üz sahəsində PRNU küyü itkisi (AI retuş və ya üz manipulyasiyası) aşkarlandı");
    } else if (bgSmoother) {
      reasons.push("Üz sahəsində real sensor küyü qalıb, lakin arxa fonda PRNU küyü itib — generativ fon müdaxiləsi");
    }
    if (seamHot && !(camera && faceSmoother)) reasons.push("Çənə, yanaq və saç sərhədində ELA qalığı daxili və xarici sahədən kəskin fərqlənir");
    if (caMismatch) reasons.push("Fonda optik xromatik aberrasiya var, üz kənarlarında isə RGB sürüşməsi sıfıra enir");
    if (partsMismatch) reasons.push("Göz və ağız ətrafının DCT enerjisi yanaq və alın dərisi ilə uyğun gəlmir");
    if (zones.lightResidual > 0.9 && (faceSmoother || seamHot)) reasons.push("Üz işıqlandırma vektoru tək mənbəli kölgə sahəsinə oturmur");
    if (metadata.editLabels.length > 0) reasons.push(`Redaktə başlığı: ${metadata.editLabels.join(", ")}`);
    if (genMeta) reasons.push(`Süni generasiya metadata izi: ${metadata.aiLabels.join(", ")}`);
    if (reasons.length === 1) reasons.push("Üz və fon forenzik izləri bir-birinə uyğun gəlmir");
  } else {
    if (genMeta) reasons.push(`Süni generasiya metadata izi: ${metadata.aiLabels.join(", ")}`);
    reasons.push("Kadrın həm üzü, həm fonu eyni süni spektri daşıyır; real kamera sensor izi yoxdur");
    if (flatSpectrum) reasons.push("Yüksək tezlikli küy bərabər paylanır, 1/f² sensor enişi yoxdur");
    if (zones.dctGrid >= 1.85) reasons.push("Periodik upsampling şəbəkə izi (2D DCT)");
  }

  const strength = clamp(relGap * 0.7 + (seamHot ? 0.25 : 0) + (caMismatch ? 0.15 : 0) + (partsMismatch ? 0.15 : 0), 0, 1);
  const score =
    risk === "generated"
      ? bandScore(clamp(0.42 + (genMeta ? 0.28 : 0) + (flatSpectrum ? 0.12 : 0) + strength * 0.2, 0, 1), 84, 97)
      : risk === "edited"
        ? structural
          ? bandScore(clamp(0.28 + strength * 0.72, 0, 1), 65, 79)
          : bandScore(clamp(0.18 + strength * 0.7 + (lightMeta || genMeta ? 0.15 : 0), 0, 1), 48, 58)
        : bandScore(camera && spectralNatural ? 0.2 : camera ? 0.34 : 0.55, 3, 18);

  const heatmap = zones.cellNoise.map((noise, index) => {
    const zone = zones.cellZone[index];
    if (risk === "real") return clamp(0.08 + Math.min(noise, 4) / 28, 0.06, 0.28);
    if (risk === "generated") return clamp(0.7 + (noise < 1 ? 0.16 : 0), 0.66, 0.94);
    const hot =
      (faceSmoother && zone !== OUTER) ||
      (bgSmoother && zone === OUTER) ||
      (seamHot && zone === SEAM) ||
      (partsMismatch && zone === INNER && zones.cellFeature[index]) ||
      (structuralMeta && zone !== OUTER);
    return hot ? clamp(0.78 + (seamHot && zone === SEAM ? 0.14 : 0), 0.74, 1) : 0.12;
  });
  const grid = Array.from({ length: 64 }, (_, index) => {
    const column = index % 8;
    const row = Math.floor(index / 8);
    const x = Math.min(31, Math.floor((column / 8) * 32));
    const y = Math.min(31, Math.floor((row / 8) * 32));
    return heatmap[y * 32 + x] ?? 0;
  });
  const primary = faces[0] ?? null;

  return {
    score,
    smoothness: clamp(Math.round(100 - Math.min(100, zones.faceNoise * 24))),
    variance: clamp(Math.round(relGap * 100)),
    flicker: clamp(Math.round(Math.abs(zones.bgCa - zones.faceCa) * 40)),
    grid,
    tone: risk === "generated" ? "synthetic" : risk === "real" ? "real" : "unknown",
    verdict: category,
    detail: reasons[1] ?? reasons[0],
    reasons,
    face: primary?.box ?? null,
    faces,
    sourceWidth,
    sourceHeight,
    noFace: false,
    category,
    risk,
    heatmap,
  };
}

function heatmapHotspot(heatmap: number[]): boolean {
  if (heatmap.length < 16) return false;
  const mean = meanOf(heatmap);
  const top = percentile(heatmap, 0.9);
  return top >= 0.72 && top > mean * 2.15 && mean > 0.05 && mean < 0.62;
}

export function judgeStill(
  signals: PixelSignals,
  metadata: MetadataSignals,
  faces: DetectedFace[],
  sourceWidth: number,
  sourceHeight: number,
): StillForensics {
  const faceSeen = faces.length > 0 || signals.skinCoverage >= 0.08;
  const edgeSynthetic = signals.edgeRatio >= 16;
  const grainSynthetic = signals.grainRms <= 1.15;
  const grainReal = signals.grainRms >= 2.05;
  const caSynthetic = signals.caShift <= 0.28;
  const caReal = signals.caShift >= 0.42;
  const elaKnown = signals.elaCv >= 0 && signals.elaMean >= 0;
  const elaSynthetic = elaKnown && signals.elaCv <= 0.38;
  const elaReal = elaKnown && signals.elaCv >= 0.62;
  const dctSmooth = signals.dctHf <= 0.11 || signals.dctSlope <= -3.05;
  const dctFlat = signals.dctSlope > -0.7 && signals.dctHf > 0.25;
  const dctPeriodic = signals.dctGrid >= 1.85;
  const dctNatural = signals.dctSlope <= -1.05 && signals.dctSlope >= -2.75 && signals.dctHf >= 0.12 && signals.dctGrid < 1.6;
  const sensorDead = signals.poissonSlope < 0.02 && signals.cfaPeriod < 0.055 && signals.grainRms <= 1.45;
  const sensorLive = signals.poissonSlope >= 0.028 || (signals.grainRms >= 2.05 && signals.cfaPeriod >= 0.05);
  const aiMeta = metadata.aiLabels.length > 0;
  const camera = metadata.optical || metadata.cameraLabels.some((label) => label !== "Exif");
  const uniformNoise = faceSeen && dctFlat && signals.poissonSlope < 0.02 && signals.cfaPeriod < 0.055 && !camera;
  const oversmooth = faceSeen && grainSynthetic && dctSmooth;
  const periodic = faceSeen && dctPeriodic;
  const classicFake = faceSeen && grainSynthetic && caSynthetic && edgeSynthetic;
  const sensorFake = faceSeen && sensorDead && (caSynthetic || dctSmooth);
  const faceSwap =
    faceSeen &&
    !aiMeta &&
    elaKnown &&
    signals.elaCv >= 1.05 &&
    signals.elaMean >= 5.5 &&
    heatmapHotspot(signals.heatmap) &&
    signals.grainRms > 1.15 &&
    !dctSmooth;

  let synthetic = aiMeta || oversmooth || periodic || classicFake || sensorFake || faceSwap || uniformNoise;
  if (synthetic && !aiMeta && !faceSwap && camera && !periodic && !classicFake && (sensorLive || grainReal || caReal || dctNatural || elaReal)) synthetic = false;
  if (synthetic && !aiMeta && !faceSwap && (grainReal || sensorLive) && dctNatural && !classicFake && !periodic) synthetic = false;

  let category: FaceCategory = "REAL ŞƏKİL";
  if (synthetic) category = faceSwap ? "AI İLƏ DƏYİŞDİRİLMİŞ REAL ŞƏKİL" : "SÜNİ İNTELLEKT YARADICILIĞI";

  const reasons: string[] = [];
  if (synthetic) {
    if (aiMeta) reasons.push(`Süni generasiya metadata izi: ${metadata.aiLabels.join(", ")}`);
    if (oversmooth || (grainSynthetic && faceSeen)) reasons.push("Dəri məsamələri süni hamarlanıb — DCT yüksək tezliyi 1/f² enişindən zəifdir");
    if (periodic) reasons.push("Periodik upsampling şəbəkə izi (2D DCT)");
    if (uniformNoise) reasons.push("Sensor küyü bərabər paylanır — Poisson σ²∝I və Bayer CFA izi yoxdur");
    if (sensorFake || (sensorDead && faceSeen)) reasons.push("Bayer CFA və Poisson-Gaussian sensor küyü izi yoxdur");
    if (caSynthetic && faceSeen) reasons.push("Optik xromatik aberrasiya yoxluğu");
    if (edgeSynthetic && faceSeen && !oversmooth) reasons.push("Kənarlar həddindən artıq kəskin, dəri məsamələri isə görünmür");
    if (elaSynthetic) reasons.push("ELA sıxılma qalığı vahiddir");
    if (faceSwap) reasons.push("ELA qalığı üz nahiyəsində lokal manipulyasiya ocağı göstərir");
    if (reasons.length === 0) reasons.push("Üz pikselləri süni generasiya həddinə çatıb");
  } else {
    if (grainReal || sensorLive || dctNatural) reasons.push("Təbii sensor dənəvərliyi, Bayer/PRNU və 1/f² tezlik enişi");
    if (caReal) reasons.push("Linza xromatik aberrasiyası qorunub");
    if (camera || metadata.cameraLabels.includes("Exif")) {
      reasons.push(`Real kamera EXIF izi: ${metadata.cameraLabels.join(", ") || "Exif"}`);
    }
    if (reasons.length === 0) reasons.push("Üz pikselləri süni generasiya həddinə çatmadı");
  }
  reasons.unshift(`Kateqoriya: ${category}`);

  const votes = [oversmooth, periodic, classicFake, sensorFake, uniformNoise, caSynthetic && faceSeen, elaSynthetic, faceSwap].filter(Boolean).length;
  const score = synthetic
    ? bandScore(clamp(0.42 + votes * 0.09 + (aiMeta ? 0.12 : 0), 0, 1), 84, 96)
    : bandScore(camera && (grainReal || sensorLive || dctNatural) ? 0.18 : 0.42, 4, 16);
  const primary = faces[0] ?? null;

  return {
    score,
    smoothness: clamp(Math.round(100 - Math.min(100, signals.grainRms * 28))),
    variance: clamp(Math.round(signals.edgeRatio * 4)),
    flicker: clamp(Math.round(signals.caShift * 40)),
    grid: signals.grid,
    tone: synthetic ? "synthetic" : "real",
    verdict: synthetic ? "SÜNİ GENERASİYA / DİPFEYK" : "HƏQİQİ İNSAN ÜZÜ",
    detail: `${category}. ${reasons[1] ?? reasons[0]}`,
    reasons,
    face: primary?.box ?? null,
    faces,
    sourceWidth,
    sourceHeight,
    noFace: false,
    category,
    risk: synthetic ? (faceSwap ? "edited" : "generated") : "real",
    heatmap: signals.heatmap,
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

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

type MediaPipeDetector = {
  detect: (image: CanvasImageSource) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number }; keypoints?: { x: number; y: number; label?: string }[]; categories?: { score: number }[] }[] };
};

let detectorTask: Promise<MediaPipeDetector | null> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function mediaPipeDetector(): Promise<MediaPipeDetector | null> {
  if (typeof window === "undefined") return null;
  if (!detectorTask) {
    detectorTask = withTimeout(
      (async () => {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        const created = await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.5,
        });
        return created as MediaPipeDetector;
      })(),
      8000,
    ).catch(() => null);
  }
  return detectorTask;
}

function pointOf(x: number, y: number, width: number, height: number): FacePoint {
  const pixel = x > 1.5 || y > 1.5;
  return {
    x: clamp(pixel ? x / width : x, 0, 1),
    y: clamp(pixel ? y / height : y, 0, 1),
  };
}

async function detectMediaPipe(canvas: HTMLCanvasElement): Promise<DetectedFace[] | null> {
  try {
    const detector = await mediaPipeDetector();
    if (!detector) return null;
    const found = detector.detect(canvas).detections ?? [];
    const faces: DetectedFace[] = [];
    for (const detection of found) {
      const bounds = detection.boundingBox;
      if (!bounds || bounds.width < 8 || bounds.height < 8) continue;
      const box = {
        x: clamp(bounds.originX / canvas.width, 0, 0.98),
        y: clamp(bounds.originY / canvas.height, 0, 0.98),
        width: clamp(bounds.width / canvas.width, 0.03, 1),
        height: clamp(bounds.height / canvas.height, 0.03, 1),
      };
      if (box.x + box.width > 1) box.width = 1 - box.x;
      if (box.y + box.height > 1) box.height = 1 - box.y;
      const keypoints = detection.keypoints ?? [];
      const named = keypoints.filter((point) => /eye|nose|mouth/i.test(point.label ?? ""));
      const chosen = named.length >= 3 ? named : keypoints.slice(0, 4);
      faces.push({
        box,
        landmarks: chosen.length >= 3 ? chosen.map((point) => pointOf(point.x, point.y, canvas.width, canvas.height)) : landmarksFromBox(box),
        confidence: detection.categories?.[0]?.score ?? 0.7,
      });
    }
    return mergeFaces(faces).sort((left, right) => right.box.width * right.box.height - left.box.width * left.box.height);
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

async function jpegResidual(canvas: HTMLCanvasElement, original: Uint8ClampedArray): Promise<{ mean: number; cv: number; blocks: number[] } | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/jpeg", 0.9));
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

function noFaceStill(sourceWidth: number, sourceHeight: number): StillForensics {
  return {
    score: 0,
    smoothness: 0,
    variance: 0,
    flicker: 0,
    grid: Array.from({ length: 64 }, () => 0),
    tone: "unknown",
    verdict: NO_FACE_MESSAGE,
    detail: NO_FACE_MESSAGE,
    reasons: [NO_FACE_MESSAGE],
    face: null,
    faces: [],
    sourceWidth,
    sourceHeight,
    noFace: true,
    category: "",
    risk: "none",
    heatmap: [],
  };
}

async function inspectSource(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, metadata: MetadataSignals): Promise<StillForensics | null> {
  const drawn = drawSource(source, sourceWidth, sourceHeight);
  if (!drawn) return null;
  const context = drawn.canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const frame = context.getImageData(0, 0, drawn.width, drawn.height);
  const detected = await detectMediaPipe(drawn.canvas);
  const faces = detected && detected.length > 0 ? detected : locateSkinFaces(frame.data, drawn.width, drawn.height);
  if (faces.length === 0) return noFaceStill(sourceWidth, sourceHeight);
  const ela = await jpegResidual(drawn.canvas, frame.data);
  const zones = compareZones(frame.data, drawn.width, drawn.height, faces[0], ela?.blocks);
  return classifyZones(zones, metadata, faces, sourceWidth, sourceHeight);
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

const EMPTY_VIDEO_META: MetadataSignals = {
  aiLabels: [],
  editLabels: [],
  cameraLabels: [],
  optical: false,
  generatedPng: false,
};

export async function inspectCurrentVideoFrame(video: HTMLVideoElement): Promise<StillForensics | null> {
  const width = video.videoWidth || 320;
  const height = video.videoHeight || 180;
  return inspectSource(video, width, height, EMPTY_VIDEO_META);
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
