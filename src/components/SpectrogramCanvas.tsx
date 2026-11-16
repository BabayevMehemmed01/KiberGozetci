import { useEffect, useRef, useState } from "react";

interface SpectrogramCanvasProps {
  samples: Float32Array | null;
  sampleRate: number;
  analyser: AnalyserNode | null;
  live: boolean;
}

const BINS = 42;

function heat(level: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, level));
  if (t < 0.34) {
    const blend = t / 0.34;
    return [6 + blend * 8, 16 + blend * 90, 36 + blend * 110];
  }
  if (t < 0.68) {
    const blend = (t - 0.34) / 0.34;
    return [14 + blend * 230, 110 + blend * 70, 150 - blend * 90];
  }
  const blend = (t - 0.68) / 0.32;
  return [245, 180 - blend * 130, 48 - blend * 30];
}

function frameMagnitude(samples: Float32Array, start: number, bin: number): number {
  const size = 72;
  let real = 0;
  let imaginary = 0;
  const omega = (2 * Math.PI * (bin + 1)) / size;
  for (let index = 0; index < size; index += 2) {
    const value = samples[start + index] ?? 0;
    const angle = omega * index;
    real += value * Math.cos(angle);
    imaginary -= value * Math.sin(angle);
  }
  return Math.hypot(real, imaginary);
}

export function SpectrogramCanvas({ samples, sampleRate, analyser, live }: SpectrogramCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef(samples);
  const analyserRef = useRef(analyser);
  const liveRef = useRef(live);
  const columnsRef = useRef<Uint8Array[]>([]);
  const [tick, setTick] = useState(0);
  samplesRef.current = samples;
  analyserRef.current = analyser;
  liveRef.current = live;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setTick((value) => value + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let step = 0;

    const paintColumn = (image: ImageData, column: Uint8Array, x: number, width: number, height: number) => {
      const cell = Math.max(1, width / 96);
      const left = Math.floor(x * cell);
      const right = Math.floor((x + 1) * cell);
      for (let bin = 0; bin < BINS; bin += 1) {
        const [red, green, blue] = heat(column[bin] / 255);
        const top = Math.floor(((BINS - 1 - bin) * height) / BINS);
        const bottom = Math.floor(((BINS - bin) * height) / BINS);
        for (let y = top; y < bottom; y += 1) {
          for (let px = left; px < right; px += 1) {
            const offset = (y * image.width + px) * 4;
            image.data[offset] = red;
            image.data[offset + 1] = green;
            image.data[offset + 2] = blue;
            image.data[offset + 3] = 255;
          }
        }
      }
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width < 2 || height < 2) {
        if (liveRef.current) frame = requestAnimationFrame(draw);
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const image = context.createImageData(pixelWidth, pixelHeight);
      const active = liveRef.current && analyserRef.current;
      const source = samplesRef.current;

      if (active && analyserRef.current) {
        step += 1;
        if (step % 3 === 0) {
          const freq = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(freq);
          const column = new Uint8Array(BINS);
          for (let bin = 0; bin < BINS; bin += 1) {
            const index = Math.floor((bin / BINS) * freq.length * 0.42);
            column[bin] = freq[index] ?? 0;
          }
          columnsRef.current.push(column);
          if (columnsRef.current.length > 96) columnsRef.current.shift();
        }
        const columns = columnsRef.current;
        for (let index = 0; index < columns.length; index += 1) {
          paintColumn(image, columns[index], index, pixelWidth, pixelHeight);
        }
      } else if (source && source.length > 80) {
        const columns = 96;
        const hop = Math.max(1, Math.floor((source.length - 72) / columns));
        let peak = 0.0001;
        const table: number[][] = [];
        for (let column = 0; column < columns; column += 1) {
          const row: number[] = [];
          for (let bin = 0; bin < BINS; bin += 1) {
            const magnitude = frameMagnitude(source, column * hop, bin);
            row.push(magnitude);
            if (magnitude > peak) peak = magnitude;
          }
          table.push(row);
        }
        for (let column = 0; column < columns; column += 1) {
          const packed = new Uint8Array(BINS);
          for (let bin = 0; bin < BINS; bin += 1) packed[bin] = Math.round((table[column][bin] / peak) * 255);
          paintColumn(image, packed, column, pixelWidth, pixelHeight);
        }
      }

      context.putImageData(image, 0, 0);
      if (!active && !(source && source.length > 80)) {
        context.fillStyle = "#64748B";
        context.font = "13px Manrope, sans-serif";
        context.textAlign = "center";
        context.fillText("Tezlik xəritəsi gözlənilir", width / 2, height / 2);
      } else {
        context.fillStyle = "rgba(148, 163, 184, 0.9)";
        context.font = "10px JetBrains Mono, monospace";
        context.textAlign = "left";
        context.fillText(source ? `${Math.round(sampleRate / 1000)} kHs` : "canlı", 8, 14);
      }
      if (active) frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [tick, live, samples, analyser, sampleRate]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">CANLI AKUSTİK SPEKTROQRAM</div>
        <span className="font-mono text-[10px] text-slate-500">zaman → tezlik</span>
      </div>
      <canvas ref={ref} className="h-[150px] w-full rounded-xl border border-[#1E293B] bg-[#060B14]" />
    </div>
  );
}
