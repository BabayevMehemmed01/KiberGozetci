import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import type { FeedCategory, FeedEvent } from "../types.ts";
import { cn } from "../lib/utils.ts";

const TONE: Record<FeedEvent["severity"], string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  success: "bg-emerald-400",
  info: "bg-cyan-400",
};

const CATEGORY: Record<FeedEvent["category"], string> = {
  Fişinq: "text-red-300",
  Dipfeyk: "text-amber-300",
  "Daxili anomaliya": "text-cyan-300",
  Sistem: "text-emerald-300",
};

const FALLBACK: Record<FeedCategory, { mitre: string; sourceIp: string }> = {
  Fişinq: { mitre: "T1566.002 — Spearphishing Link", sourceIp: "185.203.44.12" },
  Dipfeyk: { mitre: "T1656 — Impersonation / Deepfake", sourceIp: "185.203.44.19" },
  "Daxili anomaliya": { mitre: "T1048 — Exfiltration Over Alternative Protocol", sourceIp: "185.203.15.88" },
  Sistem: { mitre: "T1078 — Valid Accounts", sourceIp: "daxili sensor" },
};

const FILTERS = ["Hamısı", "Fişinq", "Dipfeyk", "Anomaliya"] as const;
type FeedFilter = (typeof FILTERS)[number];

function matches(filter: FeedFilter, category: FeedCategory): boolean {
  if (filter === "Hamısı") return true;
  if (filter === "Anomaliya") return category === "Daxili anomaliya";
  return category === filter;
}

export function LiveFeed({ events }: { events: FeedEvent[] }) {
  const [filter, setFilter] = useState<FeedFilter>("Hamısı");
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = useMemo(() => events.filter((event) => matches(filter, event.category)), [events, filter]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Canlı təhlükəsizlik axını</h3>
          <p className="text-xs text-slate-500">Başlığa klikləyin — təfərrüat, IP və MITRE açılır</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-2 py-1 text-[11px] font-semibold text-cyan-300">
          <Radio className="h-3.5 w-3.5" />
          CANLI
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              filter === item ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-[#1E293B] text-slate-400",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {visible.length === 0 ? <p className="text-sm text-slate-500">Bu kateqoriyada hadisə yoxdur.</p> : null}
        {visible.map((event, index) => {
          const open = openId === event.id;
          const extra = FALLBACK[event.category];
          return (
            <article key={event.id} className={cn("rounded-xl border bg-[#060B14]/80", open || index === 0 ? "border-cyan-400/30" : "border-[#1E293B]")}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : event.id)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                aria-expanded={open}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE[event.severity])} />
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className={cn("text-[11px] font-bold tracking-wide", CATEGORY[event.category])}>{event.category}</span>
                    <time className="font-mono text-[11px] text-slate-500">{event.time}</time>
                  </span>
                  <span className="block text-sm font-semibold text-slate-100">{event.title}</span>
                </span>
              </button>
              {open ? (
                <div className="space-y-2 border-t border-[#1E293B] px-3 py-3 text-xs leading-5 text-slate-300">
                  <p>{event.technical || event.detail}</p>
                  <p>
                    <span className="text-slate-500">Mənbə IP: </span>
                    <span className="font-mono text-cyan-200">{event.sourceIp || extra.sourceIp}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">MITRE ATT&CK: </span>
                    <span className="font-mono text-amber-200">{event.mitre || extra.mitre}</span>
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
