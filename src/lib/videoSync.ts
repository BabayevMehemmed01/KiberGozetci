import { clamp } from "./utils.ts";

function correlation(left: number[], right: number[]): number {
  const count = Math.min(left.length, right.length);
  if (count < 3) return 0;
  const meanLeft = left.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
  const meanRight = right.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < count; index += 1) {
    const leftDelta = left[index] - meanLeft;
    const rightDelta = right[index] - meanRight;
    numerator += leftDelta * rightDelta;
    leftEnergy += leftDelta * leftDelta;
    rightEnergy += rightDelta * rightDelta;
  }
  if (leftEnergy < 1e-8 || rightEnergy < 1e-8) return 0;
  return numerator / Math.sqrt(leftEnergy * rightEnergy);
}

function windowEnergy(samples: Float32Array, sampleRate: number, time: number): number {
  const center = Math.floor(time * sampleRate);
  const radius = Math.floor(sampleRate * 0.08);
  let energy = 0;
  let count = 0;
  for (let index = center - radius; index <= center + radius; index += 1) {
    if (index < 0 || index >= samples.length) continue;
    energy += samples[index] * samples[index];
    count += 1;
  }
  return count ? Math.sqrt(energy / count) : 0;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("timeout")), 1000);
    const onSeeked = () => finish();
    const onError = () => finish(new Error("seek"));
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    const duration = Number.isFinite(video.duration) ? video.duration : time + 0.1;
    video.currentTime = Math.min(Math.max(0, time), Math.max(0, duration - 0.05));
  });
}

export interface VideoForensics {
  lipSync: number;
  smoothness: number;
  flicker: number;
}

export async function estimateLipSync(
  file: File,
  samples: Float32Array | null,
  sampleRate: number,
): Promise<VideoForensics | null> {
  const videoFile = file.type.startsWith("video/") || /\.(mp4|webm)$/i.test(file.name);
  if (!videoFile) return null;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("metadata")), 2500);
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("video"));
      };
    });
    if (!Number.isFinite(video.duration) || video.duration < 0.4) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 72;
    canvas.height = 40;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    const frames = 8;
    const motions: number[] = [];
    const energies: number[] = [];
    const lumas: number[] = [];
    const gradients: number[] = [];
    let previous: Uint8ClampedArray | null = null;

    for (let index = 0; index < frames; index += 1) {
      const time = (video.duration * (index + 0.5)) / frames;
      await seek(video, time);
      const cropX = video.videoWidth * 0.3;
      const cropY = video.videoHeight * 0.52;
      const cropW = Math.max(1, video.videoWidth * 0.4);
      const cropH = Math.max(1, video.videoHeight * 0.28);
      context.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let luma = 0;
      let gradient = 0;
      let gradientCount = 0;
      const width = canvas.width;
      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        const tone = pixels[pixel] * 0.3 + pixels[pixel + 1] * 0.59 + pixels[pixel + 2] * 0.11;
        luma += tone;
        const column = (pixel / 4) % width;
        if (column < width - 1) {
          const right = pixels[pixel + 4] * 0.3 + pixels[pixel + 5] * 0.59 + pixels[pixel + 6] * 0.11;
          gradient += Math.abs(tone - right);
          gradientCount += 1;
        }
      }
      lumas.push(luma / (pixels.length / 4));
      gradients.push(gradientCount ? gradient / gradientCount : 0);
      if (previous) {
        let diff = 0;
        for (let pixel = 0; pixel < pixels.length; pixel += 4) {
          diff += Math.abs(pixels[pixel] - previous[pixel]);
        }
        motions.push(diff / (pixels.length / 4));
        energies.push(samples && sampleRate > 0 ? windowEnergy(samples, sampleRate, time) : diff / (pixels.length / 4));
      }
      previous = pixels;
    }

    const sync = samples && sampleRate > 0 ? correlation(motions, energies) : correlation(motions, energies.map((_, index) => lumas[index + 1] ?? 0));
    const lipSync = sync <= 0 ? Math.round(clamp((sync + 0.35) * 70)) : Math.round(clamp(18 + sync * 82));
    const meanGradient = gradients.reduce((sum, value) => sum + value, 0) / (gradients.length || 1);
    const smoothness = Math.round(clamp(((22 - meanGradient) / 22) * 100));
    let flickerRaw = 0;
    for (let index = 2; index < lumas.length; index += 1) {
      flickerRaw += Math.abs(lumas[index] - 2 * lumas[index - 1] + lumas[index - 2]);
    }
    const flicker = Math.round(clamp((flickerRaw / Math.max(1, lumas.length - 2)) * 8));
    return { lipSync, smoothness, flicker };
  } catch {
    return null;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
