import { useEffect, useRef, useState } from "react";
import { Download, Mic, Pause, Play, Upload } from "lucide-react";
import { voiceSamples } from "../data/mockData.ts";
import type { VoiceSample } from "../types.ts";
import { decodeToMono } from "../lib/audio.ts";
import { analyzePcm, verdictFor, type AcousticReport } from "../lib/dsp.ts";
import { estimateLipSync, type VideoForensics } from "../lib/videoSync.ts";
import { useSoc } from "../context/SocContext.tsx";
import { SignalCanvas } from "./SignalCanvas.tsx";
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
  const [report, setReport] = useState<AcousticReport | null>(null);
  const [video, setVideo] = useState<VideoForensics | null>(null);
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
    },
    [],
  );

  async function inspect(data: ArrayBuffer, nextLabel: string, file?: File) {
    setLoading(true);
    setError("");
    setReport(null);
    setVideo(null);
    const videoFile = Boolean(file && (file.type.startsWith("video/") || /\.(mp4|webm)$/i.test(file.name)));
    try {
      const context = ensureGraph();
      const decoded = await decodeToMono(context, data);
      const limit = Math.min(decoded.samples.length, decoded.sampleRate * 12);
      const slice = decoded.samples.subarray(0, limit);
      const nextReport = analyzePcm(slice, decoded.sampleRate);
      const lip = videoFile && file ? await estimateLipSync(file, slice, decoded.sampleRate) : null;
      setSamples(slice);
      setBuffer(decoded.buffer);
      setReport(nextReport);
      setVideo(lip);
      setLabel(nextLabel);
      play(decoded.buffer);
    } catch {
      if (videoFile && file) {
        const lip = await estimateLipSync(file, null, 0);
        setVideo(lip);
        setLabel(nextLabel);
        setError("Video kadrları oxundu, amma səs izi açılmadı. Tam spektr üçün WAV, MP3 və ya OGG seçin.");
      } else {
        setError("Bu faylın səs izi oxunmadı. WAV, MP3, OGG və ya MP4 formatında yenidən cəhd edin.");
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

  async function loadFile(file: File) {
    const allowed = /\.(wav|mp3|ogg|mp4|webm)$/i.test(file.name) || file.type.startsWith("audio/") || file.type.startsWith("video/");
    if (!allowed) {
      setError("Yalnız WAV, MP3, OGG, MP4 və WEBM faylları qəbul edilir.");
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
              <p className="mt-1 text-xs text-slate-500">WAV, MP3, OGG və ya MP4. WEBM də qəbul edilir. Hazır nümunələri də yükləyib ata bilərsiniz.</p>
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
            accept=".ogg,.mp3,.wav,.mp4,.webm,audio/*,video/*"
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
        </Panel>

        <Panel>
          {!report || !verdict ? (
            <div className="grid min-h-[320px] place-items-center text-center text-sm text-slate-400">
              Nümunə seçin və ya səs faylı yükləyin. Analiz zamanı spektr və dalğa canlanır.
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
              <Meter
                label="Dodaq/səs uyğunluğu"
                value={video ? video.lipSync : null}
                intent="safe"
                hint={video ? `Kadr sinxronu ${video.lipSync}% · hamarlıq ${video.smoothness}% · titrəmə ${video.flicker}%` : "Video kadrı yoxdur — göstərici hesablanmayıb"}
              />
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <Metric label="Ton titrəməsi" value={report.metrics.pitchJitter.toFixed(3)} />
                <Metric label="Nəfəs nisbəti" value={report.metrics.breathRatio.toFixed(2)} />
                <Metric label="Harmonik təmizlik" value={report.metrics.harmonicity.toFixed(2)} />
                <Metric label="Amplituda dəyişkənliyi" value={report.metrics.amplitudeVariation.toFixed(2)} />
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {describe(report, video).map((line) => (
                  <li key={line} className="rounded-lg border border-[#1E293B] bg-[#060B14] px-3 py-2">
                    {line}
                  </li>
                ))}
              </ul>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1E293B] px-2 py-1.5">
      <div>{label}</div>
      <div className="font-mono text-slate-200">{value}</div>
    </div>
  );
}

function describe(report: AcousticReport, clip: VideoForensics | null): string[] {
  if (report.unreliable) return ["Faylda analiz üçün kifayət qədər səs enerjisi yoxdur."];
  const lines = [
    report.vocoder >= 70
      ? "Harmoniklər süni dərəcədə təmiz və sabitdir — sintez izi güclüdür."
      : "Harmonik quruluş insan danışığındakı təbii dağınıqlığa daha yaxındır.",
    report.breathNatural >= 60
      ? "Danışıq arasında təbii nəfəs fasilələri və mikro-titrəmə ölçülüb."
      : "Təbii nəfəs fasilələri demək olar ki, yoxdur.",
    report.spectrumAnomaly >= 70
      ? "Tezlik spektrində kəskin kəsilmə və həddindən artıq sabit harmoniklər var."
      : "Ton hündürlüyü və ucalıq yazı boyu təbii dəyişir.",
  ];
  if (!clip) {
    lines.push("Video kadrı yoxdur — dodaq və səs uyğunluğu hesablanmayıb.");
    return lines;
  }
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
