import { useEffect, useRef, useState } from "react";
import type { StillForensics } from "../lib/vision.ts";

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
}

function harmonicBars(bands: HarmonicBands | null): number[] {
  if (!bands) return Array.from({ length: 16 }, (_, index) => 12 + ((index * 17) % 9));
  const source = [bands.low, bands.mid, bands.high, bands.air];
  return Array.from({ length: 16 }, (_, index) => {
    const falloff = 1 - index / 20;
    return Math.max(8, Math.round(source[index % 4] * falloff * (0.55 + (index % 3) * 0.18)));
  });
}

export function VisionPanel({ kind, url, forensics, bands }: VisionPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setTick((value) => value + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !forensics || (kind !== "image" && kind !== "video")) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width < 2 || height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const cells = 8;
    forensics.grid.forEach((value, index) => {
      const column = index % cells;
      const row = Math.floor(index / cells);
      const x = (column * width) / cells;
      const y = (row * height) / cells;
      const cellWidth = width / cells;
      const cellHeight = height / cells;
      const smooth = value < 0.34;
      context.fillStyle = smooth ? "rgba(244, 63, 94, 0.22)" : "rgba(6, 182, 212, 0.06)";
      context.strokeStyle = smooth ? "rgba(251, 113, 133, 0.9)" : "rgba(34, 211, 238, 0.28)";
      context.lineWidth = 1;
      context.fillRect(x, y, cellWidth, cellHeight);
      context.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1);
    });
  }, [forensics, kind, tick, url]);

  const visual = kind === "image" || kind === "video";
  const bars = harmonicBars(bands);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">CV KADR VƏ ÜZ FORENZİKASI</div>
        {forensics ? (
          <span className="font-mono text-[10px] text-slate-400">Laplasian {Math.round(forensics.variance)}</span>
        ) : null}
      </div>
      {visual && url ? (
        <div className="relative h-[180px] overflow-hidden rounded-xl border border-[#1E293B] bg-[#060B14]">
          {kind === "video" ? (
            <video src={url} className="h-full w-full object-cover" muted playsInline />
          ) : (
            <img src={url} alt="Yüklənmiş kadr" className="h-full w-full object-cover" />
          )}
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute bottom-2 left-2 rounded-lg border border-[#1E293B] bg-[#060B14]/85 px-2 py-1 text-[10px] text-slate-200">
            Üz/dəri hamarlıq skeneri · GAN toru {forensics ? `${forensics.smoothness}%` : "—"}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-3">
          <p className="text-sm font-semibold text-slate-100">
            {kind === "audio" ? "Akustik Rejim Aktivdir — CV Modul Video/Şəkil Gözləyir" : "CV modul video və ya şəkil gözləyir"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tezlik harmonikləri diaqramı akustik rejimdə aktiv qalır.</p>
          <div className="mt-3 flex h-16 items-end gap-1">
            {bars.map((height, index) => (
              <span
                key={`${index}-${height}`}
                className="flex-1 rounded-sm bg-gradient-to-t from-cyan-400/80 to-amber-300/80"
                style={{ height: `${Math.max(8, Math.min(100, height))}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
