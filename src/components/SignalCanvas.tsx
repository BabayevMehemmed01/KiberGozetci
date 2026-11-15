import { useEffect, useRef, useState } from "react";

interface SignalCanvasProps {
  samples: Float32Array | null;
  analyser: AnalyserNode | null;
  live: boolean;
}

export function SignalCanvas({ samples, analyser, live }: SignalCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef(samples);
  const analyserRef = useRef(analyser);
  const liveRef = useRef(live);
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

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const active = liveRef.current && analyserRef.current;
      if (width >= 2 && height >= 2) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const nextWidth = Math.floor(width * dpr);
        const nextHeight = Math.floor(height * dpr);
        if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
          canvas.width = nextWidth;
          canvas.height = nextHeight;
        }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = "#060B14";
        context.fillRect(0, 0, width, height);
        context.strokeStyle = "#1E293B";
        context.beginPath();
        for (let y = 0; y < height; y += 28) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }
        context.stroke();

        if (active && analyserRef.current) {
          paintLive(context, analyserRef.current, width, height);
        } else if (samplesRef.current) {
          paintStatic(context, samplesRef.current, width, height);
        } else {
          context.fillStyle = "#64748B";
          context.font = "13px Manrope, sans-serif";
          context.textAlign = "center";
          context.fillText("Siqnal gözlənilir", width / 2, height / 2);
        }
      }
      if (active) frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [tick, live, samples, analyser]);

  return <canvas ref={ref} className="h-[230px] w-full rounded-xl border border-[#1E293B]" />;
}

function paintLive(context: CanvasRenderingContext2D, analyser: AnalyserNode, width: number, height: number) {
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const wave = new Uint8Array(analyser.fftSize);
  analyser.getByteFrequencyData(freq);
  analyser.getByteTimeDomainData(wave);
  const barCount = 52;
  const gap = 3;
  const barWidth = (width - gap * (barCount - 1)) / barCount;
  for (let index = 0; index < barCount; index += 1) {
    const value = freq[Math.floor((index / barCount) * freq.length * 0.7)] / 255;
    const barHeight = Math.max(2, value * height * 0.56);
    context.fillStyle = value > 0.75 ? "#F59E0B" : "#06B6D4";
    context.globalAlpha = 0.35 + value * 0.65;
    context.fillRect(index * (barWidth + gap), height * 0.62 - barHeight, barWidth, barHeight);
  }
  context.globalAlpha = 1;
  context.beginPath();
  context.strokeStyle = "#A5F3FC";
  context.lineWidth = 1.6;
  for (let x = 0; x < width; x += 1) {
    const sample = wave[Math.floor((x / width) * wave.length)] / 128 - 1;
    const y = height * 0.8 + sample * height * 0.14;
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
}

function paintStatic(context: CanvasRenderingContext2D, samples: Float32Array, width: number, height: number) {
  const step = Math.max(1, Math.floor(samples.length / width));
  context.beginPath();
  context.strokeStyle = "#22D3EE";
  context.lineWidth = 1.4;
  for (let x = 0; x < width; x += 1) {
    let min = 1;
    let max = -1;
    const start = x * step;
    for (let index = 0; index < step && start + index < samples.length; index += 1) {
      const value = samples[start + index];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const y1 = (1 - max) * 0.5 * height;
    const y2 = (1 - min) * 0.5 * height;
    context.moveTo(x + 0.5, y1);
    context.lineTo(x + 0.5, y2);
  }
  context.stroke();
}
