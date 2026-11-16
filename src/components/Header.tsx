import { useState } from "react";
import { AudioWaveform, Mail, Radar, Settings, Siren, SquareActivity } from "lucide-react";
import type { AppTab } from "../types.ts";
import { useSoc } from "../context/SocContext.tsx";
import { cn } from "../lib/utils.ts";
import { SettingsDialog } from "./SettingsDialog.tsx";

const TABS: { id: AppTab; label: string; caption: string; icon: typeof Mail }[] = [
  { id: "overview", label: "Ümumi baxış", caption: "Vahid panel", icon: SquareActivity },
  { id: "phishing", label: "Fişinq analizi", caption: "1-ci müdafiə xətti", icon: Mail },
  { id: "deepfake", label: "Dipfeyk detektoru", caption: "2-ci müdafiə xətti", icon: AudioWaveform },
  { id: "insider", label: "Daxili izləyici", caption: "3-cü müdafiə xətti", icon: Radar },
];

export function Header() {
  const { tab, setTab, openKillChain } = useSoc();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#1E293B]/80 bg-[#060B14]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <span
                aria-hidden
                className="radar-ring pointer-events-none absolute -inset-[3px] animate-[spin_12s_linear_infinite] rounded-full border border-dashed border-cyan-400/50"
              />
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-cyan-400/60 shadow-[0_0_18px_rgba(6,182,212,0.45)]">
                <img
                  src="/logo.jpg"
                  alt="Neyron Baxış"
                  className="h-full w-full rounded-full object-cover object-[50%_34%] scale-[1.28]"
                />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">KiberGözətçi</h1>
              <p className="text-[11px] text-slate-400">İnsan faktoru · Dipfeyk · Daxili təhdid</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            Sistem Aktivdir • 3 Qatlı AI Qoruma
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1E293B] bg-[#0F172A]/80 px-3 py-2.5 text-[11px] font-bold tracking-wide text-slate-200 sm:text-xs"
          >
            <Settings className="h-4 w-4 shrink-0 text-cyan-300" />
            Ayarlar
          </button>
          <button
            type="button"
            onClick={openKillChain}
            className="kill-btn inline-flex items-center gap-2 rounded-xl border border-red-300/40 bg-gradient-to-r from-red-600 via-rose-500 to-red-500 px-3 py-2.5 text-left text-[11px] font-extrabold tracking-wide text-white sm:text-xs"
          >
            <Siren className="h-4 w-4 shrink-0" />
            ZƏNCİRVARİ HÜCUM SİMULYASİYASI
          </button>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <div className="mx-auto max-w-[1480px] px-4 pb-3 md:px-6">
        <div role="tablist" aria-label="Əsas bölmələr" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  active
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100 shadow-[0_0_24px_rgba(6,182,212,0.12)]"
                    : "border-[#1E293B] bg-[#0F172A]/70 text-slate-300 hover:border-cyan-400/30",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-cyan-300" : "text-slate-500")} />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-[11px] text-slate-500">{item.caption}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
