import { useEffect, useRef, useState } from "react";
import { Download, Mic, Pause, Play, Upload } from "lucide-react";
import { voiceSamples } from "../data/mockData.ts";
import type { VoiceSample } from "../types.ts";
import { decodeToMono } from "../lib/audio.ts";
import { analyzePcm, verdictFor, type AcousticReport } from "../lib/dsp.ts";
import { estimateLipSync, type VideoForensics } from "../lib/videoSync.ts";
import { inspectImageFile, inspectVideoFrame, type StillForensics } from "../lib/vision.ts";
import { useSoc } from "../context/SocContext.tsx";
import { SignalCanvas } from "./SignalCanvas.tsx";
import { SpectrogramCanvas } from "./SpectrogramCanvas.tsx";
import { VisionPanel } from "./VisionPanel.tsx";
import { DefenseInsight } from "./DefenseInsight.tsx";
import { Meter, Panel } from "./ui.tsx";
import { cn } from "../lib/utils.ts";

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
  const [video, setVideo] = useState<VideoForensics | null>(null);
  const [still, setStill] = useState<StillForensics | null>(null);
  const [mediaKind, setMediaKind] = useState<"idle" | "audio" | "image" | "video">("idle");
  const [mediaUrl, setMediaUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loggedLabel, setLoggedLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  async function inspect(data: ArrayBuffer, nextLabel: string, file?: File) {
    setLoading(true);
    setError("");
    setReport(null);
    setVideo(null);
    setStill(null);
    const videoFile = Boolean(file && (file.type.startsWith("video/") || /\.(mp4|webm)$/i.test(file.name)));
    try {
      const context = ensureGraph();
      const decoded = await decodeToMono(context, data);
      const limit = Math.min(decoded.samples.length, decoded.sampleRate * 12);
      const slice = decoded.samples.subarray(0, limit);
      const nextReport = analyzePcm(slice, decoded.sampleRate);
      const lip = videoFile && file ? await estimateLipSync(file, slice, decoded.sampleRate) : null;
      const frame = videoFile && file ? await inspectVideoFrame(file) : null;
      if (videoFile && file) {
        rememberPreview(URL.createObjectURL(file));
        setMediaKind("video");
      } else {
        rememberPreview(null);
        setMediaKind("audio");
      }
      setSamples(slice);
      setSampleRate(decoded.sampleRate);
      setBuffer(decoded.buffer);
      setReport(nextReport);
      setVideo(lip);
      setStill(frame);
      setLabel(nextLabel);
      try {
        play(decoded.buffer);
      } catch {
        setPlaying(false);
      }
    } catch {
      if (videoFile && file) {
        const lip = await estimateLipSync(file, null, 0);
        const frame = await inspectVideoFrame(file);
        rememberPreview(URL.createObjectURL(file));
        setMediaKind("video");
        setVideo(lip);
        setStill(frame);
        setLabel(nextLabel);
        setError("Video kadrları oxundu, amma səs izi açılmadı. Tam spektr üçün WAV, MP3 və ya OGG seçin.");
      } else {
        setError("Bu faylın səs izi oxunmadı. WAV, MP3, OGG, MP4, JPG və ya PNG formatında yenidən cəhd edin.");
      }
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
      await inspect(await response.arrayBuffer(), sample.title);
    } catch {
      setError("Nümunə səs faylı tapılmadı.");
      setLoading(false);
    }
  }

  async function loadStill(file: File) {
    stopPlayback();
    setPlaying(false);
    setLoading(true);
    setError("");
    setReport(null);
    setVideo(null);
    setSamples(null);
    setBuffer(null);
    try {
      const result = await inspectImageFile(file);
      rememberPreview(result.url);
      setMediaKind("image");
      setStill(result.forensics);
      setLabel(file.name);
    } catch {
      setError("Şəkil kadrı oxunmadı. JPG, PNG və ya WEBP seçin.");
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
    const allowed = /\.(wav|mp3|ogg|mp4|webm)$/i.test(file.name) || file.type.startsWith("audio/") || file.type.startsWith("video/");
    if (!allowed) {
      setError("Yalnız WAV, MP3, OGG, MP4, WEBM, JPG, PNG və WEBP faylları qəbul edilir.");
      return;
    }
    ensureGraph();
    await inspect(await file.arrayBuffer(), file.name, file);
  }

  async function toggleMic() {
    if (recording) {
      setRecording(false);
      recorderRef.current?.stop();
      return;
    }
    const context = ensureGraph();
    stopPlayback();
    setPlaying(false);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const source = context.createMediaStreamSource(stream);
      const node = context.createAnalyser();
      node.fftSize = 2048;
      node.smoothingTimeConstant = 0.72;
      source.connect(node);
      setMicAnalyser(node);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        void blob.arrayBuffer().then((data) => inspect(data, "Canlı mikrofon yazısı"));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setError("Mikrofona giriş icazəsi verilmədi və ya cihaz tapılmadı.");
    }
  }

  const verdict = report ? verdictFor(report) : null;
  const cvScore = video && still ? Math.round(video.lipSync * 0.7 + still.score * 0.3) : video ? video.lipSync : still ? still.score : null;
  const cvHint = still
    ? `Laplasian dispersiya ${Math.round(still.variance)} · GAN hamarlığı ${still.smoothness}% · piksel uyğunluğu ${still.score}%`
    : video
      ? `Kadr sinxronu ${video.lipSync}% · hamarlıq ${video.smoothness}% · titrəmə ${video.flicker}%`
      : "Video və ya şəkil yoxdur — CV göstəricisi gözləyir";
  const verdictClass =
    verdict?.tone === "critical"
      ? "border-red-400/40 bg-red-500/10 text-red-100"
      : verdict?.tone === "warning"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
        : verdict?.tone === "safe"
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
          : "border-[#1E293B] bg-[#060B14] text-slate-300";

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
              <p className="mt-1 text-xs text-slate-500">WAV, MP3, OGG, MP4, WEBM, JPG, PNG və ya WEBP. Hazır nümunələri də yükləyib ata bilərsiniz.</p>
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
          {label ? <p className="mt-3 text-xs text-slate-400">Aktiv fayl: {label}</p> : null}
          <div className="mt-4">
            <SignalCanvas samples={samples} analyser={recording ? micAnalyser : analyser} live={playing || recording} />
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
            <SpectrogramCanvas samples={samples} sampleRate={sampleRate} analyser={recording ? micAnalyser : analyser} live={playing || recording} />
          </div>
          <div className="mt-4">
            <VisionPanel kind={mediaKind} url={mediaUrl} forensics={still} bands={report?.bands ?? null} />
          </div>
        </Panel>

        <Panel>
          {!report && still ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-cyan-50">
                <div className="text-[11px] font-bold tracking-[0.16em]">CV PİKSEL ANALİZİ</div>
                <div className="mt-1 font-mono text-4xl font-semibold">{still.score}%</div>
                <div className="mt-1 text-sm font-bold">Üz və dəri hamarlığı ölçüldü</div>
              </div>
              <Meter label="Dodaq/səs və CV piksel uyğunluğu" value={still.score} intent="safe" hint={cvHint} />
              <p className="text-xs leading-5 text-slate-400">
                Laplasian dispersiya {Math.round(still.variance)} və {still.smoothness}% hamar hüceyrə GAN artefakt torunda işarələnib. Səs izi üçün eyni kadra video əlavə edin.
              </p>
            </div>
          ) : !report || !verdict ? (
            <div className="grid min-h-[320px] place-items-center text-center text-sm text-slate-400">
              Nümunə seçin və ya səs, video, şəkil faylı yükləyin. Analiz zamanı spektr və dalğa canlanır.
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn("rounded-2xl border px-4 py-3", verdictClass)}>
                <div className="text-[11px] font-bold tracking-[0.16em]">DİPFEYK EHTİMALI</div>
                <div className="mt-1 font-mono text-4xl font-semibold">
                  {report.unreliable ? "—" : `${report.probability.toFixed(1)}%`}
                </div>
                <div className="mt-1 text-sm font-bold">{verdict.label}</div>
              </div>
              <Meter label="Səs sintez izləri (Vocoder)" value={report.vocoder} intent="risk" hint="Təmiz harmonik sıra və robotik sabitlik" />
              <Meter label="Təbii nəfəs fasilələri" value={report.breathNatural} intent="safe" hint="Danışıq arasındakı səssizlik və nəfəs" />
              <Meter label="Tezlik spektri anomaliyası" value={report.spectrumAnomaly} intent="risk" hint="Ton və ucalığın süni sabitliyi" />
              <Meter label="Dodaq/səs və CV piksel uyğunluğu" value={cvScore} intent="safe" hint={cvHint} />
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
                  {describe(report, video).map((line) => (
                    <li key={line} className="rounded-lg border border-[#1E293B] bg-[#060B14] px-3 py-2 text-xs leading-5">
                      {line}
                    </li>
                  ))}
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
                  `Spektral düzlük ${report.metrics.spectralFlatness.toFixed(3)} və formant nisbəti ${report.metrics.formantRatio.toFixed(3)} yekun faizi ${report.probability.toFixed(1)}% edir.`,
                ]}
              />
              <button
                type="button"
                disabled={report.probability < 40 || report.unreliable || loggedLabel === label}
                onClick={() => {
                  registerDeepfakeCatch(`Dipfeyk bloklandı: ${label || "səs faylı"}`);
                  setLoggedLabel(label);
                }}
                className="w-full rounded-xl border border-red-400/40 bg-red-500/15 py-2.5 text-sm font-bold text-red-100 disabled:opacity-40"
              >
                {loggedLabel === label && label ? "Blok siyahısına salındı" : "Təhlükəni blokla"}
              </button>
            </div>
          )}
        </Panel>
      </div>
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
