import { useEffect, useRef, useState } from "react";
import type { FaceBox, StillForensics } from "../lib/vision.ts";
import type { ForensicKind } from "../lib/forensicClass.ts";
import { cn } from "../lib/utils.ts";
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
  tone?: ForensicKind;
}

function drawContain(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  daylight: boolean,
) {
  context.fillStyle = daylight ? "#e2e8f0" : "#07111f";
  context.fillRect(0, 0, width, height);
  if (sourceWidth < 2 || sourceHeight < 2) return false;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
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

const mediaClass = "absolute inset-0 h-full w-full object-contain";

function containPlacement(sourceWidth: number, sourceHeight: number, viewWidth: number, viewHeight: number) {
  const scale = Math.min(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  return {
    offsetX: (viewWidth - drawnWidth) / 2,
    offsetY: (viewHeight - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  };
}

function projectFace(face: FaceBox, sourceWidth: number, sourceHeight: number, viewWidth: number, viewHeight: number) {
  const place = containPlacement(sourceWidth, sourceHeight, viewWidth, viewHeight);
  return {
    left: ((place.offsetX + face.x * place.drawnWidth) / viewWidth) * 100,
    top: ((place.offsetY + face.y * place.drawnHeight) / viewHeight) * 100,
    width: ((face.width * place.drawnWidth) / viewWidth) * 100,
    height: ((face.height * place.drawnHeight) / viewHeight) * 100,
  };
}

function projectPoint(x: number, y: number, sourceWidth: number, sourceHeight: number, viewWidth: number, viewHeight: number) {
  const place = containPlacement(sourceWidth, sourceHeight, viewWidth, viewHeight);
  return {
    left: ((place.offsetX + x * place.drawnWidth) / viewWidth) * 100,
    top: ((place.offsetY + y * place.drawnHeight) / viewHeight) * 100,
  };
}

function FaceFrame({ color, box }: { color: string; box: { left: number; top: number; width: number; height: number } }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute"
        style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
      >
        <span className={cn("absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2", color)} />
        <span className={cn("absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2", color)} />
        <span className={cn("absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2", color)} />
        <span className={cn("absolute right-0 bottom-0 h-6 w-6 border-r-2 border-b-2", color)} />
        <span className={cn("absolute inset-[22%] border border-dashed", color)} />
      </div>
    </div>
  );
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

export function VisionPanel({ kind, url, forensics, bands, tone = "unknown" }: VisionPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tick, setTick] = useState(0);
  const [frameReady, setFrameReady] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);
  const [laser, setLaser] = useState(false);
  const [shownMedia, setShownMedia] = useState(`${kind}:${url}`);
  const theme = useDocumentTheme();
  const scanning = kind === "image" || kind === "video";
  const mediaKey = `${kind}:${url}`;
  if (mediaKey !== shownMedia) {
    setShownMedia(mediaKey);
    setFrameReady(false);
    setFrameFailed(false);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setTick((value) => value + 1));
    observer.observe(canvas);
    if (stage) observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scanning || !url) {
      setLaser(false);
      return;
    }
    setLaser(true);
    const timer = window.setTimeout(() => setLaser(false), 2600);
    return () => window.clearTimeout(timer);
  }, [scanning, url]);

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
        drew = drawContain(context, video, video.videoWidth, video.videoHeight, width, height, daylight);
      } else if (kind === "image" && imageReady && image.naturalWidth > 0) {
        drew = drawContain(context, image, image.naturalWidth, image.naturalHeight, width, height, daylight);
      }
      if (!drew) drawMatrix(context, width, height, daylight, forensics?.grid ?? null, bands);
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
    ? laser
      ? "Üz skan edilir"
      : frameFailed || !url
        ? "Kadr oxunmadı — yer tutucu matris"
        : !frameReady
          ? "Kadr yüklənir"
          : forensics?.detail || "Skan tamamlandı"
    : kind === "audio"
      ? "Akustik rejim — video və ya şəkil gözlənilir"
      : "CV modul video və ya şəkil gözləyir";
  const stageWidth = stageRef.current?.clientWidth ?? 0;
  const stageHeight = stageRef.current?.clientHeight ?? 0;
  const canProject = Boolean(forensics && !forensics.noFace && !forensics.inconclusive && forensics.sourceWidth > 1 && forensics.sourceHeight > 1 && stageWidth > 1 && stageHeight > 1);
  const faceBoxes = canProject
    ? forensics!.faces.map((face) => projectFace(face.box, forensics!.sourceWidth, forensics!.sourceHeight, stageWidth, stageHeight))
    : [];
  const landmarkDots = canProject
    ? forensics!.faces.flatMap((face) =>
        face.landmarks.map((point) => projectPoint(point.x, point.y, forensics!.sourceWidth, forensics!.sourceHeight, stageWidth, stageHeight)),
      )
    : [];
  const risk = forensics?.noFace ? "none" : forensics?.risk ?? (tone === "synthetic" ? "generated" : tone === "real" ? "real" : "none");
  const scoreColor = risk === "generated" ? "text-red-500" : risk === "edited" ? "text-amber-400" : risk === "real" ? "text-emerald-400" : "text-slate-400";
  const frameColor = risk === "generated" ? "border-red-500" : risk === "edited" ? "border-amber-400" : "border-cyan-300";
  const laserColor = risk === "generated" ? "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.95)]" : risk === "edited" ? "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.95)]" : "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.95)]";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">KOMPÜTER GÖRMƏSİ (CV) FORENZİK ANALİZ PANELİ</div>
        <span className={cn("font-mono text-xs font-bold", scoreColor)}>
          {forensics?.inconclusive ? "qeyri-müəyyən" : forensics?.noFace ? "üz yoxdur" : forensics ? `${forensics.score}%` : "gözləyir"}
        </span>
      </div>
      <div ref={stageRef} className="relative h-[180px] overflow-hidden rounded-xl border border-slate-300 bg-slate-100 dark:border-[#1E293B] dark:bg-slate-950">
        {kind === "video" && url ? (
          <video
            ref={videoRef}
            src={url}
            className={cn(mediaClass, frameReady ? "opacity-100" : "opacity-0")}
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
        {kind === "image" && url ? (
          <img
            src={url}
            alt=""
            className={cn(mediaClass, frameReady ? "opacity-100" : "opacity-0")}
            onLoad={() => setFrameReady(true)}
            onError={() => {
              setFrameReady(false);
              setFrameFailed(true);
            }}
          />
        ) : null}
        <canvas ref={canvasRef} className={cn("h-full w-full", frameReady && "invisible")} />
        {scanning && url
          ? faceBoxes.map((box, index) => <FaceFrame key={`${box.left.toFixed(2)}-${box.top.toFixed(2)}-${index}`} color={frameColor} box={box} />)
          : null}
        {scanning && url
          ? landmarkDots.map((point, index) => (
              <span
                key={`lm-${index}`}
                className={cn("pointer-events-none absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full", risk === "generated" ? "bg-red-500" : risk === "edited" ? "bg-amber-400" : "bg-cyan-300")}
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              />
            ))
          : null}
        {laser ? <div className={cn("animate-scan pointer-events-none absolute inset-x-0 z-20 h-0.5", laserColor)} /> : null}
        <div className={cn("absolute bottom-2 left-2 z-20 max-w-[90%] rounded-lg border bg-slate-950/80 px-2 py-1 text-[10px]", risk === "generated" ? "border-red-500/50 text-red-500" : risk === "edited" || forensics?.noFace ? "border-amber-400/40 text-amber-200" : "border-emerald-400/40 text-emerald-400")}>
          {caption}
        </div>
      </div>
    </div>
  );
}
