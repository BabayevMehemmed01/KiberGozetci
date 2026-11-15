import { Radio } from "lucide-react";
import type { FeedEvent } from "../types.ts";
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

export function LiveFeed({ events }: { events: FeedEvent[] }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Canlı təhlükəsizlik axını</h3>
          <p className="text-xs text-slate-500">Son 24 saat və real vaxt hadisələri</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-2 py-1 text-[11px] font-semibold text-cyan-300">
          <Radio className="h-3.5 w-3.5" />
          CANLI
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {events.map((event, index) => (
          <article key={event.id} className={cn("rounded-xl border border-[#1E293B] bg-[#060B14]/80 p-3", index === 0 && "border-cyan-400/30")}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={cn("text-[11px] font-bold tracking-wide", CATEGORY[event.category])}>{event.category}</span>
              <time className="font-mono text-[11px] text-slate-500">{event.time}</time>
            </div>
            <div className="flex items-start gap-2">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE[event.severity])} />
              <div>
                <h4 className="text-sm font-semibold text-slate-100">{event.title}</h4>
                <p className="mt-0.5 text-xs leading-5 text-slate-400">{event.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
