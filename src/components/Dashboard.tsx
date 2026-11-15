import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, AudioLines, Gauge, Lock, Mail, ShieldCheck } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildAttackTrend } from "../data/mockData.ts";
import { useSoc } from "../context/SocContext.tsx";
import { EmployeeTable } from "./EmployeeTable.tsx";
import { LiveFeed } from "./LiveFeed.tsx";
import { Panel } from "./ui.tsx";
import { cn } from "../lib/utils.ts";
import type { AppTab } from "../types.ts";

const LAYERS: { tab: AppTab; index: string; title: string; text: string }[] = [
  { tab: "phishing", index: "01", title: "Fişinq və sosial mühəndislik", text: "Tələskənlik, saxta domen və oğurluq dili" },
  { tab: "deepfake", index: "02", title: "Dipfeyk səs və video", text: "Vocoder izi, nəfəs fasiləsi və spektr" },
  { tab: "insider", index: "03", title: "Daxili davranış", text: "Sapma, hesabın dondurulması və təlim" },
];

export function Dashboard() {
  const { phishingBlocked, deepfakeCaught, frozenCount, averageScore, feed, setTab, simulationLocked } = useSoc();
  const trend = useMemo(() => buildAttackTrend(), []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Vahid idarəetmə paneli</h2>
        <p className="mt-1 text-sm text-slate-400">İnsan faktoru, dipfeyk və daxili təhdidlər bir əməliyyat mərkəzində izlənir.</p>
      </div>

      {simulationLocked ? (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Son müdaxilə: Rəşad Əliyevin hesabı avtomatik donduruldu. Vahid risk balı <span className="font-bold">99/100 (KRİTİK)</span>. Məlumat sızması dayandırıldı.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Bloklanan fişinq mesajları" value={String(phishingBlocked)} note="+18% bu həftə" icon="mail" tone="bad" />
        <KpiCard label="Aşkarlanan dipfeyk cəhdləri" value={String(deepfakeCaught)} note="99.2% dəqiqlik" icon="audio" tone="warn" />
        <KpiCard label="Dondurulmuş şübhəli hesablar" value={String(frozenCount)} note="Avtomatik müdaxilə" icon="lock" tone="bad" />
        <KpiCard label="Orta kiber-sayıqlıq balı" value={`${averageScore} / 100`} note="12 əməkdaş üzrə" icon="gauge" tone="good" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Son 7 günün hücum dinamikası</h3>
              <p className="text-xs text-slate-500">Fişinq, dipfeyk və daxili anomaliya</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 300 }}>
              <AreaChart data={trend} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="phishFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fakeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="insiderFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E293B" vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12 }}
                  labelStyle={{ color: "#E2E8F0" }}
                />
                <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                <Area type="monotone" dataKey="Fişinq" stroke="#EF4444" fill="url(#phishFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="Dipfeyk" stroke="#F59E0B" fill="url(#fakeFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="Daxili anomaliya" stroke="#06B6D4" fill="url(#insiderFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="xl:col-span-2">
          <LiveFeed events={feed} />
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {LAYERS.map((layer) => (
          <button
            key={layer.tab}
            type="button"
            onClick={() => setTab(layer.tab)}
            className="rounded-2xl border border-[#1E293B] bg-[#0F172A]/80 p-4 text-left transition hover:border-cyan-400/40"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-cyan-300">{layer.index}</span>
              <ArrowUpRight className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-sm font-semibold text-white">{layer.title}</div>
            <p className="mt-1 text-xs text-slate-400">{layer.text}</p>
          </button>
        ))}
      </div>

      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-semibold text-white">Əməkdaşların risk cədvəli</h3>
        </div>
        <EmployeeTable />
      </Panel>
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: "mail" | "audio" | "lock" | "gauge";
  tone: "bad" | "warn" | "good";
}) {
  const [flash, setFlash] = useState(false);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const timeout = window.setTimeout(() => setFlash(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [value]);

  const Icon = icon === "mail" ? Mail : icon === "audio" ? AudioLines : icon === "lock" ? Lock : Gauge;
  const accent = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-red-300";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-[#0F172A]/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] transition",
        flash ? "border-cyan-300/70" : "border-[#1E293B]",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div className="font-mono text-3xl font-semibold tracking-tight text-white">{value}</div>
      <p className={cn("mt-2 text-xs font-semibold", accent)}>{note}</p>
    </article>
  );
}
