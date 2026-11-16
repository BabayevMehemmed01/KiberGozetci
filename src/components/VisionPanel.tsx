import { useEffect, useRef, useState } from "react";
import type { StillForensics } from "../lib/vision.ts";
import { clamp } from "../lib/utils.ts";
import { useDocumentTheme } from "../lib/useDocumentTheme.ts";

interface HarmonicBands {
  low: number;
  mid: number;
  high: number;
  air: number;
}

interface VisionPanelProps {
  kind: "idle" | "audio" | "image" | "video";
  url: string;
  forensics: StillForensics | null;
  bands: HarmonicBands | null;
  baseScore?: number | null;
  onLiveScore?: (value: number) => void;
}

const WOBBLE = [0, 3, -4, 2, -7, 5, -1, 4];

function drawWire(context: CanvasRenderingContext2D, width: number, height: number) {
  context.strokeStyle = "rgba(52, 211, 153, 0.55)";
  context.lineWidth = 1;
  const cells = 8;
  for (let index = 1; index < cells; index += 1) {
    const x = (index * width) / cells;
    const y = (index * height) / cells;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawCover(context: CanvasRenderingContext2D, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  if (sourceWidth < 2 || sourceHeight < 2) return false;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  context.drawImage(source, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
  return true;
}

function drawCells(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  daylight: boolean,
  grid: number[] | null,
  bands: HarmonicBands | null,
) {
  const cells = 8;
  const energy = bands ? [bands.low, bands.mid, bands.high, bands.air] : null;
  for (let index = 0; index < cells * cells; index += 1) {
    const column = index % cells;
    const row = Math.floor(index / cells);
    const measured = grid?.[index];
    const fallback = energy ? energy[index % 4] / 100 : ((index * 17) % 10) / 10;
    const value = measured ?? fallback;
    context.fillStyle = daylight
      ? value < 0.34
        ? "rgba(190, 18, 60, 0.28)"
        : "rgba(14, 116, 144, 0.16)"
      : value < 0.34
        ? "rgba(244, 63, 94, 0.34)"
        : "rgba(16, 185, 129, 0.16)";
    context.fillRect((column * width) / cells + 1, (row * height) / cells + 1, width / cells - 2, height / cells - 2);
  }
}

function drawMatrix(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  daylight: boolean,
  grid: number[] | null,
  bands: HarmonicBands | null,
) {
  context.fillStyle = daylight ? "#e2e8f0" : "#07111f";
  context.fillRect(0, 0, width, height);
  drawCells(context, width, height, daylight, grid, bands);
}

export function VisionPanel({ kind, url, forensics, bands, baseScore = null, onLiveScore }: VisionPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onLiveRef = useRef(onLiveScore);
  const [tick, setTick] = useState(0);
  const [readout, setReadout] = useState<number | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);
  const theme = useDocumentTheme();
  onLiveRef.current = onLiveScore;
  const scanning = kind === "image" || kind === "video";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setTick((value) => value + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setFrameReady(false);
    setFrameFailed(false);
    setReadout(null);
  }, [kind, url]);

  useEffect(() => {
    if (!scanning) return;
    const base = baseScore ?? 18;
    let step = 0;
    const emit = () => {
      const next = clamp(Math.round(base + WOBBLE[step % WOBBLE.length]));
      step += 1;
      setReadout(next);
      onLiveRef.current?.(next);
    };
    emit();
    const timer = window.setInterval(emit, 200);
    return () => window.clearInterval(timer);
  }, [scanning, baseScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let stopped = false;
    let imageReady = false;
    const daylight = theme === "daylight";
    const image = new Image();

    const paint = () => {
      if (stopped) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width < 2 || height < 2) {
        if (kind === "video") frame = requestAnimationFrame(paint);
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.floor(width * dpr);
      const nextHeight = Math.floor(height * dpr);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const video = videoRef.current;
      let drew = false;
      if (kind === "video" && video && video.readyState >= 2 && video.videoWidth > 0) {
        drew = drawCover(context, video, video.videoWidth, video.videoHeight, width, height);
      } else if (kind === "image" && imageReady && image.naturalWidth > 0) {
        drew = drawCover(context, image, image.naturalWidth, image.naturalHeight, width, height);
      }
      if (!drew) drawMatrix(context, width, height, daylight, forensics?.grid ?? null, bands);
      else drawWire(context, width, height);
      if (kind === "video") frame = requestAnimationFrame(paint);
    };

    if (kind === "image" && url) {
      image.onload = () => {
        imageReady = true;
        setFrameReady(true);
        paint();
      };
      image.onerror = () => {
        imageReady = false;
        setFrameReady(false);
        setFrameFailed(true);
        paint();
      };
      image.src = url;
    }

    paint();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [bands, forensics, kind, theme, tick, url]);

  const caption = scanning
    ? frameReady
      ? "Kadr skan edilir"
      : frameFailed || !url
        ? "Kadr oxunmadı — yer tutucu matris"
        : "Kadr yüklənir"
    : kind === "audio"
      ? "Akustik rejim — video və ya şəkil gözlənilir"
      : "CV modul video və ya şəkil gözləyir";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">KOMPÜTER GÖRMƏSİ (CV) FORENZİK ANALİZ PANELİ</div>
        <span className="font-mono text-[10px] text-slate-400">{readout === null ? "gözləyir" : `${readout}%`}</span>
      </div>
      <div className="relative h-[180px] overflow-hidden rounded-xl border border-slate-300 bg-slate-100 dark:border-[#1E293B] dark:bg-slate-950">
        {kind === "video" && url ? (
          <video
            ref={videoRef}
            src={url}
            className="hidden"
            muted
            playsInline
            autoPlay
            loop
            onLoadedData={() => {
              setFrameReady(true);
              setTick((value) => value + 1);
            }}
            onError={() => {
              setFrameReady(false);
              setFrameFailed(true);
            }}
          />
        ) : null}
        <canvas ref={canvasRef} className="h-full w-full" />
        <div className="animate-scan pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.95)]" />
        <div className="absolute bottom-2 left-2 rounded-lg border border-emerald-400/40 bg-slate-950/80 px-2 py-1 text-[10px] text-emerald-400">
          {caption}
          {forensics ? ` · GAN ${forensics.smoothness}%` : ""}
        </div>
      </div>
    </div>
  );
}
