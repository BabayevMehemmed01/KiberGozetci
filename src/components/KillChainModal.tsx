import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { RASHAD_ID } from "../data/mockData.ts";
import { getBreach } from "../lib/behavior.ts";
import { useSoc } from "../context/SocContext.tsx";
import { playStageCue, stopTones } from "../lib/tones.ts";
import { cn, fullName } from "../lib/utils.ts";
import type { Employee } from "../types.ts";

function attackIp(employee: Employee): string {
  if (employee.id === RASHAD_ID) return "185.203.44.19";
  let hash = 0;
  for (const char of employee.id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return `185.203.${(hash % 40) + 10}.${(hash % 200) + 20}`;
}

function buildStages(employee: Employee) {
  const name = fullName(employee);
  const ip = attackIp(employee);
  const limit = employee.avgDailyDownloads;
  const story = getBreach(employee.id);
  const clock = `${String(story.hour).padStart(2, "0")}:${String(story.minute).padStart(2, "0")}`;
  const files = story.files.toLocaleString("az-AZ");
  return [
    {
      clock: "00:01",
      title: "Çoxkanallı hücum başlayır",
      risk: 89,
      mitre: "T1566.002 — Spearphishing Link",
      detail: `${employee.department} şöbəsinin əməkdaşı ${name} üçün saxta bildiriş və klonlanmış səs mesajı gəlir. Sistem hər iki təhlükəni qeydə alır, lakin əməkdaş tələskənliklə linkə klikləyir.`,
      logs: [
        `QAT 1 · Fişinq mühərriki ${name} üçün saxta bildirişi qeydə aldı. T1566.002.`,
        "QAT 2 · Dipfeyk detektoru klonlanmış səsi aşkarladı. T1656.",
        `${name} keçidə kliklədi. Risk: 89%.`,
      ],
    },
    {
      clock: "00:04",
      title: "Hesab ələ keçirilir",
      risk: 93,
      mitre: "T1078 — Valid Accounts",
      detail: `Haker oğurlanmış şifrə ilə saat ${clock}-da ${ip} ünvanından ${employee.email} hesabına sızır.`,
      logs: [`Xarici IP ${ip} saat ${clock}-da ${name} sessiyasını (${employee.email}) açdı.`],
    },
    {
      clock: "00:07",
      title: "Daxili davranış anomaliyası",
      risk: 97,
      mitre: story.mitre,
      detail: `${story.title}. ${files} fayl çıxarılır. Normal limit: ${limit} fayl/gün.`,
      logs: [`QAT 3 · ${clock}-da ${files} fayl ixrac olunur. Norma: ${limit} fayl/gün. ${story.mitre}.`],
    },
    {
      clock: "00:09",
      title: "Zəncirvari əlaqələndirmə və avtomatik bloklama",
      risk: 99,
      mitre: "T1078 — Valid Accounts",
      detail: `KiberGözətçi üç qatı birləşdirir. Vahid risk balı 99/100 (KRİTİK). ${name} hesabı saniyələr içində dondurulur və məlumat sızması dayandırılır.`,
      logs: [
        "Üç qat birləşdirildi. Vahid risk balı: 99/100 (KRİTİK).",
        `${name} hesabı donduruldu. İxrac dayandı. İdarəetmə panelindəki say yeniləndi.`,
      ],
    },
  ];
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function downloadIncident(employee: Employee, stages: ReturnType<typeof buildStages>, ip: string) {
  const name = fullName(employee);
  const rows = stages
    .map(
      (stage) =>
        `<tr><td>${stage.clock}</td><td>${escapeHtml(stage.title)}</td><td>${escapeHtml(stage.mitre)}</td><td>${stage.risk}</td><td>${escapeHtml(stage.detail)}</td></tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="utf-8" />
  <title>KiberGözətçi insident hesabatı — ${escapeHtml(name)}</title>
  <style>
    body { font-family: "Segoe UI", sans-serif; color: #0f172a; margin: 32px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    p { color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #0f172a; color: white; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>KiberGözətçi — kiber-insident hesabatı</h1>
  <p>Hədəf: ${escapeHtml(name)} · ${escapeHtml(employee.position)} · ${escapeHtml(employee.department)}</p>
  <p>Hesab: ${escapeHtml(employee.email)} · Hücum IP: ${escapeHtml(ip)} · Vahid risk: 99/100 (KRİTİK)</p>
  <p>Tədbir: hesab donduruldu, ixrac dayandırıldı, sessiya bağlandı.</p>
  <table>
    <thead><tr><th>Vaxt</th><th>Mərhələ</th><th>MITRE ATT&CK</th><th>Risk</th><th>Təfərrüat</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kibergozetci-insident-${employee.id}.html`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatElapsed(ms: number): string {
  const safe = Math.max(0, Math.min(ms, 10000));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor(safe / 1000) % 60;
  const tenths = Math.floor((safe % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function KillChainModal() {
  const { killOpen, closeKillChain, killToken, simPhase, replayKillChain, applySimulationLock, updatePhase, employees, targetEmployeeId, setTargetEmployeeId } = useSoc();
  const target = employees.find((employee) => employee.id === targetEmployeeId) ?? employees[0];
  const stages = useMemo(() => buildStages(target), [target]);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState(-1);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(soundOn);
  const applyRef = useRef(applySimulationLock);
  const phaseRef = useRef(updatePhase);
  soundRef.current = soundOn;
  applyRef.current = applySimulationLock;
  phaseRef.current = updatePhase;

  useEffect(() => {
    if (!killOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeKillChain();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [killOpen, closeKillChain]);

  useEffect(() => {
    if (killToken === 0) return;
    setElapsed(0);
    setStage(0);
    playStageCue(0, soundRef.current);
    const started = performance.now();
    let previousStage = 0;
    let locked = false;
    const timer = window.setInterval(() => {
      const time = performance.now() - started;
      setElapsed(time);
      const next = time >= 7500 ? 3 : time >= 5000 ? 2 : time >= 2500 ? 1 : 0;
      if (next !== previousStage) {
        previousStage = next;
        setStage(next);
        playStageCue(next, soundRef.current);
        if (next === 3 && !locked) {
          locked = true;
          applyRef.current();
        }
      }
      if (time >= 10000) {
        setElapsed(10000);
        phaseRef.current("done");
        window.clearInterval(timer);
      }
    }, 40);
    return () => {
      window.clearInterval(timer);
      stopTones();
    };
  }, [killToken]);

  const active = stage < 0 ? 0 : stage;
  const current = stages[active];
  const logs = stages.slice(0, active + 1).flatMap((item) => item.logs);
  const progress = Math.min(100, (Math.min(elapsed, 10000) / 10000) * 100);

  return (
    <AnimatePresence>
      {killOpen ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#02060d]/80 p-3 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kill-title"
        >
          <motion.div
            className={cn("scanlines relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border bg-[#060B14] p-4 shadow-2xl sm:p-6", active >= 2 ? "border-red-400/50" : "border-cyan-400/30")}
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
          >
            <div className={cn("pointer-events-none absolute inset-0", active >= 2 ? "bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_55%)]" : "bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.12),transparent_50%)]")} />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.18em] text-red-300">CANLI HÜCUM ZƏNCİRİ</p>
                  <h2 id="kill-title" className="mt-1 text-2xl font-extrabold text-white">Zəncirvari hücum simulyasiyası</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSoundOn((value) => {
                        if (value) stopTones();
                        return !value;
                      });
                    }}
                    className="rounded-xl border border-[#1E293B] p-2 text-slate-300"
                    aria-label={soundOn ? "Səsi bağla" : "Səsi aç"}
                  >
                    {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={closeKillChain} className="rounded-xl border border-[#1E293B] p-2 text-slate-300" aria-label="Bağla">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="mt-4 flex max-w-md flex-col gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                Hədəf əməkdaş
                <select
                  value={target.id}
                  onChange={(event) => setTargetEmployeeId(event.target.value)}
                  className="rounded-xl border border-[#1E293B] bg-[#0F172A] px-3 py-2.5 text-sm font-medium text-slate-100 outline-none"
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {fullName(employee)} — {employee.position}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
                <div className="rounded-2xl border border-[#1E293B] bg-[#0F172A] p-4">
                  <div className="text-[11px] text-slate-500">{simPhase === "done" ? "TAMAMLANDI" : "CANLI TAYMER"}</div>
                  <div className="mt-1 font-mono text-3xl text-cyan-200">{formatElapsed(elapsed)}</div>
                  <div className="mt-2 text-xs text-slate-400">Ssenari vaxtı {current.clock}</div>
                </div>
                <div className="rounded-2xl border border-[#1E293B] bg-[#0F172A] p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500">VAHİD RİSK BALI</div>
                      <div className={cn("font-mono text-4xl font-semibold", current.risk >= 99 ? "text-red-300" : "text-amber-200")}>{current.risk}/100</div>
                    </div>
                    <div className="text-sm font-extrabold text-red-300">{current.risk >= 99 ? "KRİTİK" : "YÜKSƏLİR"}</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#060B14]">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {stages.map((item, index) => {
                  const state = index < active ? "done" : index === active ? "active" : "pending";
                  return (
                    <article
                      key={item.clock}
                      className={cn(
                        "rounded-2xl border p-4 transition",
                        state === "active" && "border-cyan-300/60 bg-cyan-400/10",
                        state === "done" && "border-emerald-400/30 bg-emerald-400/5",
                        state === "pending" && "border-[#1E293B] opacity-45",
                        index === 3 && state === "active" && "border-red-400/70 bg-red-500/10",
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold tracking-wide">
                        <span className="text-slate-400">MƏRHƏLƏ {index + 1}</span>
                        <span className="font-mono text-cyan-200">{item.clock}</span>
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-white">{item.title}</h3>
                      <p className="mt-1 font-mono text-[11px] text-amber-200">{item.mitre}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">{item.detail}</p>
                    </article>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-[#1E293B] bg-black/40 p-4 font-mono text-xs leading-6 text-cyan-100">
                {logs.map((line) => (
                  <div key={line}>{`> ${line}`}</div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={simPhase !== "done"}
                  onClick={() => downloadIncident(target, stages, attackIp(target))}
                  className="rounded-xl border border-amber-300/40 px-4 py-2.5 text-sm font-bold text-amber-100 disabled:opacity-40"
                >
                  Kiber-İnsident Hesabatını Yüklə
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStage(0);
                    setElapsed(0);
                    replayKillChain();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-2.5 text-sm font-bold text-cyan-100"
                >
                  <RotateCcw className="h-4 w-4" />
                  Yenidən başlat
                </button>
                <button type="button" onClick={closeKillChain} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-950">
                  Paneldə göstər
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
