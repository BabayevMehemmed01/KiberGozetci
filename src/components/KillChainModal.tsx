import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useSoc } from "../context/SocContext.tsx";
import { rollScenario, type AttackScenario } from "../lib/scenario.ts";
import { playStageCue, stopTones } from "../lib/tones.ts";
import { cn, fullName } from "../lib/utils.ts";
import type { Employee } from "../types.ts";

function buildStages(employee: Employee, scenario: AttackScenario) {
  const name = fullName(employee);
  const limit = employee.avgDailyDownloads;
  const files = scenario.files.toLocaleString("az-AZ");
  const opening = scenario.title.includes("səsi") ? "T1656 — Impersonation / Deepfake" : "T1566.002 — Spearphishing Link";
  return [
    {
      clock: "00:01",
      title: "Çoxkanallı hücum başlayır",
      risk: scenario.risks[0],
      mitre: opening,
      detail: `${employee.department} şöbəsinin əməkdaşı ${name} üçün tələ: ${scenario.bait}. Sistem hər iki təhlükəni qeydə alır, lakin əməkdaş tələskənliklə keçidə klikləyir.`,
      logs: [
        `QAT 1 · ${scenario.title}. Hədəf: ${name}.`,
        `${name} keçidə kliklədi. Risk: ${scenario.risks[0]}%.`,
      ],
    },
    {
      clock: "00:04",
      title: "Hesab ələ keçirilir",
      risk: scenario.risks[1],
      mitre: "T1078 — Valid Accounts",
      detail: `Haker oğurlanmış şifrə ilə saat ${scenario.clock}-da ${scenario.ip} ünvanından ${employee.email} hesabına sızır.`,
      logs: [`Xarici IP ${scenario.ip} saat ${scenario.clock}-da ${name} sessiyasını (${employee.email}) açdı. Risk: ${scenario.risks[1]}%.`],
    },
    {
      clock: "00:07",
      title: "Daxili davranış anomaliyası",
      risk: scenario.risks[2],
      mitre: scenario.mitre,
      detail: `${scenario.title}. Saat ${scenario.clock}-da ${files} fayl çıxarılır. Normal limit: ${limit} fayl/gün.`,
      logs: [`QAT 3 · ${scenario.clock}-da ${files} fayl ixrac olunur. Norma: ${limit} fayl/gün. ${scenario.mitre}. Risk: ${scenario.risks[2]}%.`],
    },
    {
      clock: "00:09",
      title: "Zəncirvari əlaqələndirmə və avtomatik bloklama",
      risk: scenario.risks[3],
      mitre: "T1078 — Valid Accounts",
      detail: `KiberGözətçi üç qatı birləşdirir. Vahid risk balı ${scenario.risks[3]}/100 (KRİTİK). Bloklama ${scenario.blockSeconds.toFixed(1)} saniyədə tamamlandı. Qarşısı alınan zərər ₼ ${scenario.damage.toLocaleString("az-AZ")}. ${name} hesabı dondurulur və məlumat sızması dayandırılır.`,
      logs: [
        `Üç qat birləşdirildi. Vahid risk balı: ${scenario.risks[3]}/100 (KRİTİK).`,
        `Bloklama sürəti ${scenario.blockSeconds.toFixed(1)} s. Qarşısı alınan zərər ₼ ${scenario.damage.toLocaleString("az-AZ")}.`,
        `${name} hesabı donduruldu. İxrac dayandı. İdarəetmə panelindəki say yeniləndi.`,
      ],
    },
  ];
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function downloadIncident(employee: Employee, stages: ReturnType<typeof buildStages>, scenario: AttackScenario) {
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
  <p>Hesab: ${escapeHtml(employee.email)} · Hücum IP: ${escapeHtml(scenario.ip)} · Gecə vaxtı: ${escapeHtml(scenario.clock)} · Sızdırılan fayl: ${scenario.files.toLocaleString("az-AZ")}</p>
  <p>Tələ: ${escapeHtml(scenario.title)} · Vahid risk: ${scenario.risks[3]}/100 (KRİTİK) · Reaksiya: ${scenario.blockSeconds.toFixed(1)} s · Qarşısı alınan zərər: ₼ ${scenario.damage.toLocaleString("az-AZ")}</p>
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
  const rolledRef = useRef<{ token: number; scenario: AttackScenario } | null>(null);
  if (!rolledRef.current || rolledRef.current.token !== killToken) {
    rolledRef.current = { token: killToken, scenario: rollScenario(target.department) };
  }
  const scenario = rolledRef.current.scenario;
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const stages = useMemo(() => buildStages(target, scenario), [target, scenario]);
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
          const current = scenarioRef.current;
          applyRef.current({
            risk: current.risks[3],
            blockSeconds: current.blockSeconds,
            damage: current.damage,
            title: current.title,
          });
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
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-3 sm:p-6 dark:bg-slate-950/80 dark:backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kill-title"
        >
          <motion.div
            className={cn(
              "relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-4 text-slate-900 shadow-2xl sm:p-6 dark:border-cyan-400/30 dark:bg-slate-900/95 dark:text-slate-100",
              active >= 2 && "border-red-300 dark:border-red-400/50",
            )}
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
          >
            <div className={cn("pointer-events-none absolute inset-0", active >= 2 ? "bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.1),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.16),transparent_55%)]" : "bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.08),transparent_50%)] dark:bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.12),transparent_50%)]")} />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.18em] text-red-300">CANLI HÜCUM ZƏNCİRİ</p>
                  <h2 id="kill-title" className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">Zəncirvari hücum simulyasiyası</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {scenario.title} · {scenario.ip} · {scenario.clock} · {scenario.files.toLocaleString("az-AZ")} fayl · yekun {scenario.risks[3]}/100 · {scenario.blockSeconds.toFixed(1)} s · ₼ {scenario.damage.toLocaleString("az-AZ")}
                  </p>
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
                    className="cursor-pointer rounded-xl border border-slate-300 p-2 text-slate-700 dark:border-[#1E293B] dark:text-slate-300"
                    aria-label={soundOn ? "Səsi bağla" : "Səsi aç"}
                  >
                    {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={closeKillChain} className="cursor-pointer rounded-xl border border-slate-300 p-2 text-slate-700 dark:border-[#1E293B] dark:text-slate-300" aria-label="Bağla">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="mt-4 flex max-w-md flex-col gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                Hədəf əməkdaş
                <select
                  value={target.id}
                  onChange={(event) => setTargetEmployeeId(event.target.value)}
                  className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none dark:border-[#1E293B] dark:bg-[#0F172A] dark:text-slate-100"
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {fullName(employee)} — {employee.position}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
                <div className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-[#1E293B] dark:bg-[#0F172A]">
                  <div className="text-[11px] text-slate-500">{simPhase === "done" ? "TAMAMLANDI" : "CANLI TAYMER"}</div>
                  <div className="mt-1 font-mono text-3xl text-cyan-800 dark:text-cyan-200">{formatElapsed(elapsed)}</div>
                  <div className="mt-2 text-xs text-slate-400">Ssenari vaxtı {current.clock}</div>
                </div>
                <div className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-[#1E293B] dark:bg-[#0F172A]">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500">VAHİD RİSK BALI</div>
                      <div className={cn("font-mono text-4xl font-semibold", active >= 3 ? "text-red-300" : "text-amber-200")}>{current.risk}/100</div>
                    </div>
                    <div className="text-sm font-extrabold text-red-300">{active >= 3 ? "KRİTİK" : "YÜKSƏLİR"}</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-[#060B14]">
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
                        state === "active" && "border-cyan-700/35 bg-cyan-50 dark:border-cyan-300/60 dark:bg-cyan-400/10",
                        state === "done" && "border-emerald-700/30 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/5",
                        state === "pending" && "border-slate-200 bg-slate-50 dark:border-[#1E293B] dark:bg-slate-900/40",
                        index === 3 && state === "active" && "border-red-300 bg-red-50 dark:border-red-400/70 dark:bg-red-500/10",
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold tracking-wide">
                        <span className="text-slate-400">MƏRHƏLƏ {index + 1}</span>
                        <span className="font-mono text-cyan-800 dark:text-cyan-200">{item.clock}</span>
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>
                      <p className="mt-1 font-mono text-[11px] text-amber-200">{item.mitre}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">{item.detail}</p>
                    </article>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-200/90 p-4 font-mono text-xs leading-6 text-slate-800 dark:border-[#1E293B] dark:bg-black/40 dark:text-cyan-100">
                {logs.map((line) => (
                  <div key={line}>{`> ${line}`}</div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={simPhase !== "done"}
                  onClick={() => downloadIncident(target, stages, scenario)}
                  className="cursor-pointer rounded-xl border border-amber-700/30 px-4 py-2.5 text-sm font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-300/40 dark:text-amber-100"
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
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-700/30 px-4 py-2.5 text-sm font-bold text-cyan-900 dark:border-cyan-300/40 dark:text-cyan-100"
                >
                  <RotateCcw className="h-4 w-4" />
                  Yenidən başlat
                </button>
                <button type="button" onClick={closeKillChain} className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-50 dark:bg-slate-100 dark:text-slate-950">
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
