import { useEffect, useRef, useState } from "react";
import { Download, Mic, Pause, Play, Upload } from "lucide-react";
import { voiceSamples } from "../data/mockData.ts";
import type { VoiceSample } from "../types.ts";
import { decodeToMono, shortSpeechReport } from "../lib/audio.ts";
import { analyzePcm, verdictFor, type AcousticReport } from "../lib/dsp.ts";
import { analyzeVideo } from "../lib/videoForensics.ts";
import type { VideoForensics } from "../lib/videoSync.ts";
import { inspectImageFile, type StillForensics } from "../lib/vision.ts";
import { useSoc } from "../context/SocContext.tsx";
import { SignalCanvas } from "./SignalCanvas.tsx";
import { SpectrogramCanvas } from "./SpectrogramCanvas.tsx";
import { VisionPanel } from "./VisionPanel.tsx";
import { DefenseInsight } from "./DefenseInsight.tsx";
import { Meter, Panel, ScanSweep } from "./ui.tsx";
import { cn } from "../lib/utils.ts";

function concatPcm(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function tailPcm(chunks: Float32Array[], samplesNeeded: number): Float32Array {
  let total = 0;
  let start = chunks.length;
  while (start > 0 && total < samplesNeeded) {
    start -= 1;
    total += chunks[start]?.length ?? 0;
  }
  const merged = concatPcm(chunks.slice(start));
  if (merged.length <= samplesNeeded) return merged;
  return merged.subarray(merged.length - samplesNeeded);
}

function medianNumber(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function DeepfakeDetector() {
  const { registerDeepfakeCatch } = useSoc();
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [sampleRate, setSampleRate] = useState(48000);
  const [report, setReport] = useState<AcousticReport | null>(null);
  const [scanToken, setScanToken] = useState(0);
  const [video, setVideo] = useState<VideoForensics | null>(null);
  const [still, setStill] = useState<StillForensics | null>(null);
  const [mediaKind, setMediaKind] = useState<"idle" | "audio" | "image" | "video">("idle");
  const [mediaUrl, setMediaUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioLabel, setAudioLabel] = useState("");
  const [visionLabel, setVisionLabel] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loggedLabel, setLoggedLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const consensusRef = useRef<AcousticReport[]>([]);
  const liveBusyRef = useRef(false);
  const liveStampRef = useRef(0);
  const micGraphRef = useRef<{ source: MediaStreamAudioSourceNode; processor: ScriptProcessorNode; mute: GainNode } | null>(null);
  const previewRef = useRef<string | null>(null);

  function rememberPreview(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setMediaUrl(url ?? "");
  }

  function ensureGraph() {
    if (!contextRef.current) contextRef.current = new AudioContext();
    void contextRef.current.resume();
    if (!analyserRef.current) {
      const node = contextRef.current.createAnalyser();
      node.fftSize = 2048;
      node.smoothingTimeConstant = 0.82;
      node.connect(contextRef.current.destination);
      analyserRef.current = node;
      setAnalyser(node);
    }
    return contextRef.current;
  }

  function stopPlayback() {
    const source = sourceRef.current;
    sourceRef.current = null;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
    source.disconnect();
  }

  function play(nextBuffer: AudioBuffer) {
    const context = ensureGraph();
    const node = analyserRef.current;
    if (!node) return;
    stopPlayback();
    const source = context.createBufferSource();
    source.buffer = nextBuffer;
    source.connect(node);
    source.onended = () => {
      if (sourceRef.current === source) {
        sourceRef.current = null;
        setPlaying(false);
      }
    };
    source.start();
    sourceRef.current = source;
    setPlaying(true);
  }

  useEffect(
    () => () => {
      stopPlayback();
      micGraphRef.current?.processor.disconnect();
      micGraphRef.current?.source.disconnect();
      micGraphRef.current?.mute.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function resetConsensus() {
    consensusRef.current = [];
    liveBusyRef.current = false;
    liveStampRef.current = 0;
  }

  function clearAcoustic() {
    stopPlayback();
    resetConsensus();
    setPlaying(false);
    setReport(null);
    setSamples(null);
    setBuffer(null);
    setError("");
    setAudioLabel("");
  }

  function settleLiveWindow(next: AcousticReport) {
    const history = consensusRef.current;
    history.push(next);
    if (history.length > 5) history.shift();
    const reliable = history.filter((item) => !item.unreliable && item.audioClass !== "uncertain");
    if (reliable.length === 0) {
      setReport(next);
      setAudioLabel("Canlı mikrofon yazısı");
      return;
    }
    const counts = new Map<AcousticReport["audioClass"], number>();
    for (const item of reliable) counts.set(item.audioClass, (counts.get(item.audioClass) ?? 0) + 1);
    let winner: AcousticReport["audioClass"] = reliable[reliable.length - 1]?.audioClass ?? "uncertain";
    let winnerCount = 0;
    for (const [kind, count] of counts) {
      if (count > winnerCount) {
        winner = kind;
        winnerCount = count;
      }
    }
    if (reliable.length >= 2 && winnerCount / reliable.length < 0.6) return;
    const chosen = reliable.filter((item) => item.audioClass === winner);
    const template = chosen[chosen.length - 1];
    if (!template) return;
    setReport({ ...template, probability: Math.round(medianNumber(chosen.map((item) => item.probability))) });
    setAudioLabel("Canlı mikrofon yazısı");
  }

  function releaseMic() {
    const graph = micGraphRef.current;
    micGraphRef.current = null;
    if (graph) {
      graph.processor.onaudioprocess = null;
      graph.processor.disconnect();
      graph.source.disconnect();
      graph.mute.disconnect();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMicAnalyser(null);
  }

  async function finishLivePcm(raw: Float32Array, rate: number) {
    setLoading(true);
    setError("");
    setReport(null);
    setSamples(null);
    setBuffer(null);
    resetConsensus();
    try {
      const limit = Math.min(raw.length, Math.max(1, Math.round(rate * 12)));
      const slice = raw.subarray(0, limit);
      const nextReport = analyzePcm(slice, rate);
      consensusRef.current = [nextReport];
      const context = ensureGraph();
      const audioBuffer = context.createBuffer(1, Math.max(1, slice.length), rate);
      if (slice.length > 0) audioBuffer.getChannelData(0).set(slice);
      setSamples(slice.length > 0 ? slice : null);
      setSampleRate(rate);
      setBuffer(audioBuffer);
      setReport(nextReport);
      setAudioLabel("Canlı mikrofon yazısı");
      setScanToken((token) => token + 1);
      try {
        play(audioBuffer);
      } catch {
        setPlaying(false);
      }
    } catch {
      setReport(shortSpeechReport());
      setAudioLabel("Canlı mikrofon yazısı");
    } finally {
      setLoading(false);
    }
  }

  async function inspect(
    data: ArrayBuffer,
    nextLabel: string,
    file?: File,
    options?: { liveMic?: boolean; preserveVision?: boolean; sourceName?: string },
  ) {
    stopPlayback();
    setPlaying(false);
    setLoading(true);
    setError("");
    setReport(null);
    setSamples(null);
    setBuffer(null);
    const videoFile = Boolean(file && (file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name)));
    if (videoFile) {
      setVideo(null);
      setStill(null);
    }
    resetConsensus();
    try {
      const context = ensureGraph();
      let decoded: Awaited<ReturnType<typeof decodeToMono>> | null = null;
      try {
        decoded = await decodeToMono(context, data);
      } catch {
        decoded = null;
      }
      if (videoFile && file) {
        const slice = decoded ? decoded.samples.subarray(0, Math.min(decoded.samples.length, decoded.sampleRate * 12)) : null;
        const acoustic = slice && decoded ? analyzePcm(slice, decoded.sampleRate) : null;
        if (acoustic) consensusRef.current = [acoustic];
        try {
          const study = await analyzeVideo(file, slice, decoded?.sampleRate ?? 0, acoustic);
          rememberPreview(URL.createObjectURL(file));
          setMediaKind("video");
          setVideo(study.clip);
          setStill(study.still);
          setVisionLabel(file.name);
          if (decoded && slice && acoustic) {
            setSamples(slice);
            setSampleRate(decoded.sampleRate);
            setBuffer(decoded.buffer);
            setReport(acoustic);
            try {
              play(decoded.buffer);
            } catch {
              setPlaying(false);
            }
          }
          setScanToken((token) => token + 1);
          setAudioLabel(nextLabel);
        } catch {
          rememberPreview(URL.createObjectURL(file));
          setMediaKind("video");
          setStill(null);
          setVisionLabel(file.name);
          setError("Video kadrı oxunmadı. CV skaner yer tutucu matris üzərində davam edir.");
        }
        return;
      }
      if (!decoded) {
        setError("Bu faylın səs izi oxunmadı. WAV, MP3, OGG, MP4, JPG və ya PNG formatında yenidən cəhd edin.");
        return;
      }
      const limit = Math.min(decoded.samples.length, decoded.sampleRate * 12);
      const slice = decoded.samples.subarray(0, limit);
      const nextReport = analyzePcm(slice, decoded.sampleRate);
      consensusRef.current = [nextReport];
      if (!options?.preserveVision) {
        rememberPreview(null);
        setMediaKind("audio");
        setVideo(null);
        setStill(null);
        setVisionLabel("");
      } else {
        setMediaKind((kind) => (kind === "image" || kind === "video" ? kind : "audio"));
      }
      setSamples(slice);
      setSampleRate(decoded.sampleRate);
      setBuffer(decoded.buffer);
      setReport(nextReport);
      setScanToken((token) => token + 1);
      setAudioLabel(nextLabel);
      try {
        play(decoded.buffer);
      } catch {
        setPlaying(false);
      }
    } catch {
      setError("Bu faylın səs izi oxunmadı. WAV, MP3, OGG, MP4, JPG və ya PNG formatında yenidən cəhd edin.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSample(sample: VoiceSample) {
    ensureGraph();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/samples/${sample.fileName}`);
      if (!response.ok) throw new Error("missing");
      await inspect(await response.arrayBuffer(), sample.title, undefined, {
        preserveVision: true,
        sourceName: sample.fileName,
      });
    } catch {
      setError("Nümunə səs faylı tapılmadı.");
      setLoading(false);
    }
  }

  async function loadStill(file: File) {
    setLoading(true);
    setError("");
    setVideo(null);
    setStill(null);
    try {
      const result = await inspectImageFile(file);
      rememberPreview(result.url);
      setMediaKind("image");
      setStill(result.forensics);
      setVisionLabel(file.name);
      setScanToken((token) => token + 1);
    } catch {
      rememberPreview(URL.createObjectURL(file));
      setMediaKind("image");
      setVisionLabel(file.name);
      setStill(null);
      setScanToken((token) => token + 1);
      setError("Şəkil kadrı oxunmadı. CV skaner yer tutucu matris üzərində davam edir.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFile(file: File) {
    const image = /\.(jpe?g|png|webp)$/i.test(file.name) || file.type.startsWith("image/");
    if (image) {
      await loadStill(file);
      return;
    }
    const allowed = /\.(wav|mp3|ogg|mp4|webm|mov)$/i.test(file.name) || file.type.startsWith("audio/") || file.type.startsWith("video/");
    if (!allowed) {
      setError("Yalnız WAV, MP3, OGG, MP4, WEBM, MOV, JPG, PNG və WEBP faylları qəbul edilir.");
      return;
    }
    clearAcoustic();
    setStill(null);
    setVideo(null);
    setVisionLabel("");
    rememberPreview(null);
    setMediaKind("audio");
    ensureGraph();
    await inspect(await file.arrayBuffer(), file.name, file, { preserveVision: false, sourceName: file.name });
  }

  async function toggleMic() {
    if (recording) {
      setRecording(false);
      const rate = contextRef.current?.sampleRate ?? sampleRate;
      const chunks = pcmChunksRef.current;
      pcmChunksRef.current = [];
      releaseMic();
      const merged = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      await finishLivePcm(merged, rate);
      return;
    }
    const context = ensureGraph();
    clearAcoustic();
    setScanToken((token) => token + 1);
    pcmChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      streamRef.current = stream;
      const source = context.createMediaStreamSource(stream);
      const node = context.createAnalyser();
      node.fftSize = 2048;
      node.smoothingTimeConstant = 0.72;
      source.connect(node);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      const rateNow = context.sampleRate;
      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(channel));
        const now = performance.now();
        if (liveBusyRef.current || now - liveStampRef.current < 500) return;
        const collected = pcmChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
        if (collected < rateNow * 1.5) return;
        liveStampRef.current = now;
        liveBusyRef.current = true;
        try {
          const tail = tailPcm(pcmChunksRef.current, Math.round(rateNow * 2.5));
          settleLiveWindow(analyzePcm(tail, rateNow));
        } finally {
          liveBusyRef.current = false;
        }
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      micGraphRef.current = { source, processor, mute };
      setMicAnalyser(node);
      setRecording(true);
    } catch {
      releaseMic();
      setRecording(false);
      setError("Mikrofona giriş icazəsi verilmədi və ya cihaz tapılmadı.");
    }
  }

  const verdict = report ? verdictFor(report) : null;
  const audioReady = Boolean(report && verdict && !report.unreliable);
  const waveTone = !report || report.unreliable ? "idle" : report.pattern === "synthetic" || report.probability >= 75 ? "synthetic" : report.probability < 40 ? "real" : "idle";
  const cvTone = still?.risk === "edited" ? "warning" : still?.risk === "generated" || still?.tone === "synthetic" ? "critical" : still?.risk === "real" || still?.tone === "real" ? "safe" : "muted";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-cyan-300">2-Cİ MÜDAFİƏ XƏTTİ</p>
        <h2 className="mt-1 text-xl font-bold text-white">Dipfeyk səs və video detektoru</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Səs brauzerin Web Audio mühərrikində oxunur. Tezlik spektri, nəfəs fasilələri və harmonik sabitlik yerli olaraq hesablanır.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {voiceSamples.map((sample) => (
          <article key={sample.id} className="rounded-2xl border border-[#1E293B] bg-[#0F172A]/90 p-4">
            <div className="text-[11px] font-bold tracking-wide text-cyan-300">{sample.scene}</div>
            <h3 className="mt-1 text-sm font-semibold text-white">{sample.title}</h3>
            <p className="mt-1 text-xs text-slate-400">{sample.description}</p>
            <p className="mt-2 truncate font-mono text-[11px] text-slate-500">{sample.fileName}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void loadSample(sample)}
                className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950"
              >
                Dinlə və analiz et
              </button>
              <a
                href={`/samples/${sample.fileName}`}
                download={sample.fileName}
                className="inline-flex items-center gap-1 rounded-lg border border-[#1E293B] px-3 py-2 text-xs font-semibold text-slate-300"
              >
                <Download className="h-3.5 w-3.5" />
                Yüklə
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files[0];
              if (file) void loadFile(file);
            }}
            className={cn(
              "grid min-h-44 w-full place-items-center rounded-2xl border border-dashed px-4 py-8 text-center",
              dragOver ? "border-cyan-300 bg-cyan-400/10" : "border-[#1E293B] bg-[#060B14]",
            )}
          >
            <div>
              <Upload className="mx-auto mb-3 h-7 w-7 text-cyan-300" />
              <div className="text-sm font-semibold text-slate-100">Faylı buraya sürükləyin</div>
              <p className="mt-1 text-xs text-slate-500">WAV, MP3, OGG, MP4, WEBM, MOV, JPG, PNG və ya WEBP. Hazır nümunələri də yükləyib ata bilərsiniz.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => void toggleMic()}
            className={cn(
              "grid min-h-44 place-items-center rounded-2xl border px-4 py-6 text-center sm:w-56",
              recording ? "border-red-400/60 bg-red-500/10" : "border-[#1E293B] bg-[#060B14]",
            )}
          >
            <div>
              <Mic className={cn("mx-auto mb-3 h-7 w-7", recording ? "text-red-300" : "text-cyan-300")} />
              <div className="text-sm font-semibold text-slate-100">{recording ? "Dayandır və Analiz Et" : "Canlı Mikrofonla Yoxla"}</div>
              <p className="mt-1 text-xs text-slate-500">{recording ? "Yazı gedir, dalğa canlıdır" : "Brauzer mikrofonundan real səs"}</p>
            </div>
          </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".ogg,.mp3,.wav,.mp4,.webm,.jpg,.jpeg,.png,.webp,audio/*,video/*,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
              event.target.value = "";
            }}
          />
          {loading ? <p className="mt-3 text-sm text-cyan-200">Tezlik spektri oxunur...</p> : null}
          {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
          {audioLabel ? <p className="mt-3 text-xs text-slate-400">Səs: {audioLabel}</p> : null}
          {visionLabel ? <p className="mt-1 text-xs text-slate-400">Görüntü: {visionLabel}</p> : null}
          <div className="mt-4">
            <SignalCanvas samples={samples} analyser={recording ? micAnalyser : analyser} live={playing || recording} tone={waveTone} />
          </div>
          <button
            type="button"
            disabled={!buffer}
            onClick={() => {
              if (!buffer) return;
              if (playing) {
                stopPlayback();
                setPlaying(false);
                return;
              }
              play(buffer);
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#1E293B] px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Dayandır" : "Yenidən dinlə"}
          </button>
          <div className="mt-4">
            <SpectrogramCanvas
              key={scanToken}
              samples={samples}
              sampleRate={sampleRate}
              analyser={recording ? micAnalyser : analyser}
              live={playing || recording}
              heatmap={still && !still.noFace ? still.heatmap : null}
            />
          </div>
          <div className="mt-4">
            <VisionPanel kind={mediaKind} url={mediaUrl} forensics={still} bands={report?.bands ?? null} tone={still?.tone ?? "unknown"} />
          </div>
        </Panel>

        <Panel className="scan-host">
          {report || still ? <ScanSweep token={scanToken} /> : null}
          {!audioReady && !still && !report?.unreliable ? (
            <div className="grid min-h-[320px] place-items-center text-center text-sm text-slate-400">
              Nümunə seçin və ya səs, video, şəkil faylı yükləyin. Analiz zamanı spektr və dalğa canlanır.
            </div>
          ) : (
            <div className="space-y-4">
              {report?.unreliable ? (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 text-amber-100">
                  <div className="text-lg font-bold">{report.reasons[0]?.title || "Kifayət qədər siqnal yoxdur"}</div>
                  {report.reasons[0]?.detail ? <p className="mt-1 text-sm">{report.reasons[0].detail}</p> : null}
                </div>
              ) : null}
              {audioReady && report && verdict ? (
                <ScoreReadout
                  kicker="DİPFEYK EHTİMALI"
                  value={report.probability}
                  verdict={verdict.label}
                  detail={report.reasons[0]?.title ?? ""}
                  tone={verdict.tone}
                />
              ) : null}
              {still?.noFace || still?.inconclusive ? (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 text-amber-100">
                  <div className="text-base font-bold">{still.verdict}</div>
                  {still.detail && still.detail !== still.verdict ? <p className="mt-1 text-sm">{still.detail}</p> : null}
                </div>
              ) : still ? (
                <ScoreReadout
                  kicker={audioReady ? "CV NƏTİCƏSİ" : "DİPFEYK EHTİMALI"}
                  value={still.score}
                  verdict={still.verdict}
                  detail={still.detail}
                  tone={cvTone}
                />
              ) : null}
              {audioReady && report && verdict ? (
                <>
                  <Meter
                    label="Səs sintez izləri (Vocoder)"
                    value={report.vocoder}
                    intent="risk"
                    hint={report.pattern === "synthetic" ? "Süni sintez (Vocoder) izləri və robotik sabitlik aşkarlandı" : "Təbii nəfəs fasilələri və təmiz harmonik sıra"}
                  />
                  <Meter label="Təbii nəfəs fasilələri" value={report.breathNatural} intent="safe" hint="Danışıq arasındakı səssizlik və nəfəs" />
                  <Meter label="Tezlik spektri anomaliyası" value={report.spectrumAnomaly} intent="risk" hint="Ton və ucalığın süni sabitliyi" />
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <Metric label="RMS variasiyası" value={report.metrics.amplitudeVariation.toFixed(2)} />
                    <Metric label="ZCR dəyişkənliyi" value={report.metrics.zcrVariation.toFixed(3)} />
                    <Metric label="Mikro-pauza" value={`${report.metrics.pauseCount} · ${report.metrics.pauseIntervalMs} ms`} />
                    <Metric label="Spektral düzlük" value={report.metrics.spectralFlatness.toFixed(3)} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">SPEKTRAL ENERJİ PAYLANMASI</div>
                    <div className="mt-2 space-y-2">
                      <Band label="80–500 Hs" value={report.bands.low} />
                      <Band label="0.5–2 kHs" value={report.bands.mid} />
                      <Band label="2–5 kHs" value={report.bands.high} />
                      <Band label="5–8 kHs" value={report.bands.air} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">SÜNİ İNTELLEKT İZAHI</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {report.reasons.map((reason) => (
                        <li key={reason.title} className="rounded-lg border border-[#1E293B] bg-[#060B14] px-3 py-2">
                          <div className="font-semibold text-slate-100">{reason.title}</div>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{reason.detail}</p>
                        </li>
                      ))}
                      {still?.reasons.map((line) => (
                        <li key={line} className="rounded-lg border border-[#1E293B] bg-[#060B14] px-3 py-2 text-xs leading-5">
                          {line}
                        </li>
                      ))}
                      {!still ? describe(report, video).map((line) => (
                        <li key={line} className="rounded-lg border border-[#1E293B] bg-[#060B14] px-3 py-2 text-xs leading-5">
                          {line}
                        </li>
                      )) : null}
                    </ul>
                  </div>
                  <DefenseInsight
                    stacked
                    techniques={[
                      { code: "T1656", name: report.pattern === "synthetic" ? "Impersonation / Deepfake" : "Əlamət təsdiqlənmədi" },
                    ]}
                    steps={[
                      `RMS variasiyası ${report.metrics.amplitudeVariation.toFixed(2)} və ZCR dəyişkənliyi ${report.metrics.zcrVariation.toFixed(3)} birinci qərar budağıdır.`,
                      `${report.metrics.pauseCount} mikro-pauza və sakit kadr əmsalı ${report.metrics.pauseNoise.toFixed(3)} nəfəs budağını seçir.`,
                      `Spektral düzlük ${report.metrics.spectralFlatness.toFixed(3)} və formant nisbəti ${report.metrics.formantRatio.toFixed(3)} yekun faizi ${Math.round(report.probability)}% edir.`,
                    ]}
                  />
                  <button
                    type="button"
                    disabled={report.probability < 40 || loggedLabel === audioLabel}
                    onClick={() => {
                      registerDeepfakeCatch(`Dipfeyk bloklandı: ${audioLabel || "səs faylı"}`);
                      setLoggedLabel(audioLabel);
                    }}
                    className="w-full rounded-xl border border-red-400/40 bg-red-500/15 py-2.5 text-sm font-bold text-red-100 disabled:opacity-40"
                  >
                    {loggedLabel === audioLabel && audioLabel ? "Blok siyahısına salındı" : "Təhlükəni blokla"}
                  </button>
                </>
              ) : null}
              {still && !still.noFace && !still.inconclusive && !audioReady ? (
                <>
                  <Meter label="CV piksel uyğunluğu" value={still.score} intent="risk" hint={still.detail} />
                  <div>
                    <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">SÜNİ İNTELLEKT İZAHI</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {still.reasons.map((line) => (
                        <li key={line} className="rounded-lg border border-[#1E293B] bg-[#060B14] px-3 py-2 text-xs leading-5">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ScoreReadout({
  kicker,
  value,
  verdict,
  detail,
  tone,
}: {
  kicker: string;
  value: number;
  verdict: string;
  detail: string;
  tone: "critical" | "warning" | "safe" | "muted";
}) {
  const color = tone === "critical" ? "text-red-500" : tone === "safe" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : "text-slate-300";
  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#060B14] px-4 py-4">
      <div className="text-[11px] font-bold tracking-[0.16em] text-slate-400">{kicker}</div>
      <div className={cn("mt-2 font-mono text-6xl font-black leading-none tracking-tight", color)}>{Math.round(value)}%</div>
      <div className={cn("mt-3 text-base font-bold", color)}>{verdict}</div>
      {detail ? <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p> : null}
    </div>
  );
}

function Band({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-[11px] text-slate-400">
      <span>{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[#060B14]">
        <span className="block h-full rounded-full bg-cyan-300" style={{ width: `${value}%` }} />
      </span>
      <span className="font-mono text-slate-200">{value}%</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1E293B] px-2 py-1.5">
      <div>{label}</div>
      <div className="font-mono text-slate-200">{value}</div>
    </div>
  );
}

function describe(_report: AcousticReport, clip: VideoForensics | null): string[] {
  if (!clip) return ["Video və ya şəkil yoxdur — CV piksel uyğunluğu gözləyir."];
  const lines: string[] = [];
  lines.push(
    clip.lipSync >= 65
      ? "Kadr hərəkəti səs enerjisi ilə uyğun gedir."
      : "Kadr hərəkəti ilə səs enerjisi arasında zəif uyğunluq var.",
  );
  lines.push(
    clip.smoothness >= 68
      ? "Üz bölgəsində piksel hamarlığı süni vizuala yaxındır."
      : "Kadr piksellərində təbii detal və kənar dəyişkənliyi var.",
  );
  lines.push(
    clip.flicker >= 45
      ? "Kadrlar arasında rəng titrəməsi yüksəkdir."
      : "Kadrlararası rəng titrəməsi mülayimdir.",
  );
  return lines;
}
