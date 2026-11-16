import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Settings, X } from "lucide-react";
import { useSoc, type SocTheme } from "../context/SocContext.tsx";
import { cn } from "../lib/utils.ts";

const THEMES: { id: SocTheme; title: string; caption: string; swatch: string }[] = [
  { id: "cyber", title: "Kiber Firuzəyi", caption: "Cyber Cyan — standart tünd rejim", swatch: "bg-[#06141c] border-cyan-400" },
  { id: "emerald", title: "Zümrüd Matriks", caption: "Emerald Matrix — dərin qara-yaşıl kiber tonlar", swatch: "bg-[#04140e] border-emerald-400" },
  { id: "violet", title: "Kvant Bənövşəyi", caption: "Quantum Violet — neon bənövşəyi və tünd göy", swatch: "bg-[#140a24] border-violet-400" },
  { id: "daylight", title: "Gündüz SOC", caption: "Daylight Slate — yüksək kontrastlı aydın rejim", swatch: "bg-slate-100 border-slate-500" },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme, quarantineThreshold, setQuarantineThreshold, mailAlertsEnabled, setMailAlertsEnabled, alertRecipient, setAlertRecipient, sendPhishingTrap, employees, targetEmployeeId } = useSoc();
  const [sendingTest, setSendingTest] = useState(false);
  const [testNote, setTestNote] = useState("");

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
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#1E293B] bg-[#0F172A] p-5 shadow-2xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-cyan-800 dark:text-cyan-300">SOC PARAMETRLƏRİ</p>
                <h2 id="settings-title" className="mt-1 flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
                  <Settings className="h-4 w-4 text-cyan-800 dark:text-cyan-300" />
                  Ayarlar
                </h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg border border-[#1E293B] p-2 text-slate-300" aria-label="Bağla">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">İnterfeys teması</h3>
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
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
                        <span className="block text-[11px] text-slate-400">{item.caption}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Kiber Divar həssaslıq həddi</h3>
                <span className="font-mono text-sm font-bold text-cyan-800 dark:text-cyan-300">{quarantineThreshold}%</span>
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

            <div className="mt-5 border-t border-[#1E293B] pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Mail className="h-4 w-4 text-cyan-800 dark:text-cyan-300" />
                  Avtomatik E-poçt Bildirişləri (Resend API)
                </h3>
                <button
                  type="button"
                  role="switch"
                  aria-checked={mailAlertsEnabled}
                  onClick={() => setMailAlertsEnabled(!mailAlertsEnabled)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border",
                    mailAlertsEnabled ? "border-cyan-800 bg-cyan-700 dark:border-cyan-400/70 dark:bg-cyan-400/30" : "border-slate-400 bg-slate-300 dark:border-slate-600 dark:bg-slate-800",
                  )}
                >
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", mailAlertsEnabled ? "left-6" : "left-0.5")} />
                </button>
              </div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300" htmlFor="alert-recipient">
                Alıcı E-poçt Ünvanı
              </label>
              <input
                id="alert-recipient"
                type="email"
                value={alertRecipient}
                onChange={(event) => setAlertRecipient(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
              />
              <button
                type="button"
                disabled={sendingTest}
                onClick={() => {
                  setSendingTest(true);
                  setTestNote("Test bildirişi göndərilir...");
                  const person = employees.find((item) => item.id === targetEmployeeId) ?? employees[0];
                  const name = person ? `${person.firstName} ${person.lastName}` : "Rəşad Əliyev";
                  void sendPhishingTrap(name).then((result) => {
                    setTestNote(result.message);
                    setSendingTest(false);
                  });
                }}
                className="mt-3 w-full cursor-pointer rounded-xl border border-cyan-800/40 bg-cyan-800/10 px-3 py-2 text-sm font-semibold text-cyan-800 disabled:opacity-60 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-100"
              >
                {sendingTest ? "Göndərilir..." : "Test Bildirişi Göndər"}
              </button>
              {testNote ? <p className="mt-2 text-xs leading-5 text-cyan-800 dark:text-cyan-200">{testNote}</p> : null}
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Bildirişlər aktiv olduqda test məktubu və fişinq tələsi eyni serverless Resend endpoint-indən, göndərən onboarding@resend.dev ünvanı ilə çıxır. Açar yalnız server mühitində saxlanılır.
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
