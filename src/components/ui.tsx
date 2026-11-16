import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { AccountStatus, ToastMessage } from "../types.ts";
import { useSoc } from "../context/SocContext.tsx";
import { clamp, cn } from "../lib/utils.ts";

export function ScanSweep({ token }: { token: number }) {
  if (token <= 0) return null;
  return <span key={token} className="scan-laser" aria-hidden />;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-[#1E293B] bg-[#0F172A]/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] md:p-5", className)}>
      {children}
    </section>
  );
}

export function Meter({
  label,
  value,
  hint,
  intent,
}: {
  label: string;
  value: number | null;
  hint?: string;
  intent: "risk" | "safe";
}) {
  const color =
    value === null
      ? "#64748B"
      : intent === "safe"
        ? value >= 70
          ? "#10B981"
          : value >= 40
            ? "#F59E0B"
            : "#EF4444"
        : value >= 70
          ? "#EF4444"
          : value >= 40
            ? "#F59E0B"
            : "#10B981";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-xs" style={{ color }}>
          {value === null ? "—" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#060B14] ring-1 ring-[#1E293B]">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: value === null ? 0 : `${clamp(value)}%` }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{ background: color, boxShadow: `0 0 16px ${color}66` }}
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const STATUS_STYLE: Record<AccountStatus, string> = {
  Aktiv: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Nəzarətdə: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Dondurulub: "border-red-400/30 bg-red-400/10 text-red-300",
};

export function StatusPill({ status }: { status: AccountStatus }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[status])}>
      {status}
    </span>
  );
}

const TOAST_STYLE: Record<ToastMessage["tone"], string> = {
  info: "border-cyan-400/30",
  success: "border-emerald-400/40",
  warning: "border-amber-400/40",
  critical: "border-red-400/50",
};

export function ToastViewport() {
  const { toasts, dismissToast } = useSoc();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(100%-2rem,22rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cn(
            "pointer-events-auto rounded-xl border bg-[#0F172A]/95 p-3 text-left shadow-2xl backdrop-blur",
            TOAST_STYLE[toast.tone],
          )}
        >
          <span className="block text-sm font-semibold text-slate-100">{toast.title}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-400">{toast.message}</span>
        </button>
      ))}
    </div>
  );
}
