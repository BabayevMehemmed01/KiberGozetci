import { AnimatePresence, motion } from "framer-motion";
import { Dashboard } from "./components/Dashboard.tsx";
import { DeepfakeDetector } from "./components/DeepfakeDetector.tsx";
import { Header } from "./components/Header.tsx";
import { InsiderTracker } from "./components/InsiderTracker.tsx";
import { KillChainModal } from "./components/KillChainModal.tsx";
import { PhishingAnalyzer } from "./components/PhishingAnalyzer.tsx";
import { ToastViewport } from "./components/ui.tsx";
import { SocProvider, useSoc } from "./context/SocContext.tsx";

function Shell() {
  const { tab } = useSoc();
  return (
    <div className="relative min-h-screen">
      <div className="soc-grid pointer-events-none fixed inset-0" />
      <div className="soc-glow pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.16),transparent_62%)]" />
      <div className="relative z-10">
        <Header />
        <main className="mx-auto max-w-[1480px] px-4 py-6 md:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {tab === "overview" ? <Dashboard /> : null}
              {tab === "phishing" ? <PhishingAnalyzer /> : null}
              {tab === "deepfake" ? <DeepfakeDetector /> : null}
              {tab === "insider" ? <InsiderTracker /> : null}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="border-t border-[#1E293B] px-4 py-4 text-center text-xs text-slate-500">
          Analizlər yerli mühərrikdə aparılır · Bildirişlər Resend üzərindən göndərilir
        </footer>
      </div>
      <KillChainModal />
      <ToastViewport />
    </div>
  );
}

export default function App() {
  return (
    <SocProvider>
      <Shell />
    </SocProvider>
  );
}
