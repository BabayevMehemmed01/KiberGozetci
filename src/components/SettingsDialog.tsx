import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Settings, X } from "lucide-react";
import { useSoc, type SocTheme } from "../context/SocContext.tsx";
import { cn } from "../lib/utils.ts";

const THEMES: { id: SocTheme; title: string; caption: string; swatch: string }[] = [
  { id: "cyber", title: "Kiber Firuzəyi", caption: "Cyber Cyan — standart tünd rejim", swatch: "bg-[#06141c] border-cyan-400" },
  { id: "emerald", title: "Zümrüd Matriks", caption: "Emerald Matrix — dərin qara-yaşıl kiber tonlar", swatch: "bg-[#04140e] border-emerald-400" },
  { id: "violet", title: "Kvant Bənövşəyi", caption: "Quantum Violet — neon bənövşəyi və tünd göy", swatch: "bg-[#140a24] border-violet-400" },
  { id: "daylight", title: "Gündüz SOC", caption: "Daylight Slate — yüksək kontrastlı aydın rejim", swatch: "bg-slate-100 border-slate-500" },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme, quarantineThreshold, setQuarantineThreshold } = useSoc();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-[#02060d]/70 p-4 pt-24 backdrop-blur-sm sm:justify-end sm:pt-20 sm:pr-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="w-full max-w-md rounded-3xl border border-[#1E293B] bg-[#0F172A] p-5 shadow-2xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">SOC PARAMETRLƏRİ</p>
                <h2 id="settings-title" className="mt-1 flex items-center gap-2 text-lg font-extrabold text-white">
                  <Settings className="h-4 w-4 text-cyan-300" />
                  Ayarlar
                </h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg border border-[#1E293B] p-2 text-slate-300" aria-label="Bağla">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">İnterfeys teması</h3>
              <div className="grid gap-2">
                {THEMES.map((item) => {
                  const selected = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTheme(item.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left",
                        selected ? "border-cyan-400/60 bg-cyan-400/10" : "border-[#1E293B] bg-[#060B14]",
                      )}
                      aria-pressed={selected}
                    >
                      <span className={cn("h-9 w-9 shrink-0 rounded-full border-2", item.swatch)} />
                      <span>
                        <span className="block text-sm font-semibold text-white">{item.title}</span>
                        <span className="block text-[11px] text-slate-400">{item.caption}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Kiber Divar həssaslıq həddi</h3>
                <span className="font-mono text-sm font-bold text-cyan-300">{quarantineThreshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={85}
                step={1}
                value={quarantineThreshold}
                onChange={(event) => setQuarantineThreshold(Number(event.target.value))}
                aria-label="Kiber Divar həssaslıq həddi"
                className="w-full"
              />
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Fişinq analizində ümumi risk balı {quarantineThreshold}%-i keçəndə avtomatik karantin işə düşür. Şantaj, pul və ya şifrə tələbi bu həddən asılı olmayaraq karantinə alınır.
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
