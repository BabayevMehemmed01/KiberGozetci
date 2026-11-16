import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RASHAD_ID, employees as seedEmployees, threatJournal } from "../data/mockData.ts";
import { randomAttackIp } from "../lib/scenario.ts";
import { unlockAudio } from "../lib/tones.ts";
import { formatClock, fullName } from "../lib/utils.ts";
import type { AppTab, Employee, FeedEvent, SimPhase, ToastMessage } from "../types.ts";

interface SocContextValue {
  employees: Employee[];
  feed: FeedEvent[];
  phishingBlocked: number;
  deepfakeCaught: number;
  averageScore: number;
  frozenCount: number;
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  killOpen: boolean;
  simPhase: SimPhase;
  killToken: number;
  simulationLocked: boolean;
  targetEmployeeId: string;
  setTargetEmployeeId: (id: string) => void;
  lockedEmployeeId: string | null;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  openKillChain: () => void;
  closeKillChain: () => void;
  replayKillChain: () => void;
  updatePhase: (phase: SimPhase) => void;
  applySimulationLock: () => void;
  sendAwarenessTest: (id: string) => void;
  toggleFreeze: (id: string) => void;
  applyTraining: (id: string, correct: number) => void;
  registerPhishingBlock: (title: string) => void;
  registerDeepfakeCatch: (title: string) => void;
}

const SocContext = createContext<SocContextValue | null>(null);

function stampJournal(events: FeedEvent[]): FeedEvent[] {
  const now = Date.now();
  return events.map((event, index) => ({
    ...event,
    time: formatClock(new Date(now - (events.length - index) * 9 * 60 * 1000 - index * 23000)),
  }));
}

const LIVE_KINDS = [
  {
    category: "Fişinq" as const,
    severity: "critical" as const,
    mitre: "T1566.002 — Spearphishing Link",
    title: (name: string) => `${name} üçün saxta keçid bloklandı`,
    detail: (ip: string) => `Poçt şlüzü ${ip} ünvanından gələn fişinq mesajını karantinə aldı.`,
  },
  {
    category: "Dipfeyk" as const,
    severity: "warning" as const,
    mitre: "T1656 — Impersonation / Deepfake",
    title: (name: string) => `${name} ünvanına klon səs dayandırıldı`,
    detail: (ip: string) => `Akustik mühərrik ${ip} mənbəli səs izini sintetik kimi saxladı.`,
  },
  {
    category: "Daxili anomaliya" as const,
    severity: "critical" as const,
    mitre: "T1048 — Exfiltration Over Alternative Protocol",
    title: (name: string) => `${name} hesabında gecə ixracı kəsildi`,
    detail: (ip: string) => `Davranış modeli ${ip} sessiyasında qeyri-adi yükləməni dayandırdı.`,
  },
];

export function SocProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(() => seedEmployees.map((employee) => ({ ...employee })));
  const [feed, setFeed] = useState<FeedEvent[]>(() => stampJournal(threatJournal));
  const [phishingBlocked, setPhishingBlocked] = useState(() => 136 + Math.floor(Math.random() * 33));
  const [deepfakeCaught, setDeepfakeCaught] = useState(() => 16 + Math.floor(Math.random() * 13));
  const [tab, setTab] = useState<AppTab>("overview");
  const [killOpen, setKillOpen] = useState(false);
  const [simPhase, setSimPhase] = useState<SimPhase>("idle");
  const [killToken, setKillToken] = useState(0);
  const [simulationLocked, setSimulationLocked] = useState(false);
  const [targetEmployeeId, setTargetEmployeeIdState] = useState(RASHAD_ID);
  const [lockedEmployeeId, setLockedEmployeeId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const employeesRef = useRef(employees);
  const phaseRef = useRef<SimPhase>("idle");
  const snapshotRef = useRef<Employee | null>(null);
  const lockAppliedRef = useRef(false);
  const targetRef = useRef(RASHAD_ID);
  const lockedIdRef = useRef<string | null>(null);
  employeesRef.current = employees;

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-4), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4300);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const updatePhase = useCallback((phase: SimPhase) => {
    phaseRef.current = phase;
    setSimPhase(phase);
  }, []);

  const pushFeed = useCallback((event: FeedEvent) => {
    setFeed((current) => [event, ...current].slice(0, 16));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const employee = seedEmployees[Math.floor(Math.random() * seedEmployees.length)];
      const name = fullName(employee);
      const kind = LIVE_KINDS[Math.floor(Math.random() * LIVE_KINDS.length)];
      const ip = randomAttackIp();
      pushFeed({
        id: crypto.randomUUID(),
        time: formatClock(new Date()),
        title: kind.title(name),
        detail: kind.detail(ip),
        technical: `${kind.mitre}. Mənbə ${ip}. Hədəf: ${name}.`,
        sourceIp: ip,
        mitre: kind.mitre,
        severity: kind.severity,
        category: kind.category,
        source: "live",
      });
      if (kind.category === "Fişinq") setPhishingBlocked((count) => count + 1);
      if (kind.category === "Dipfeyk") setDeepfakeCaught((count) => count + 1);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [pushFeed]);

  const closeKillChain = useCallback(() => setKillOpen(false), []);

  const resetSimulation = useCallback(() => {
    const snapshot = snapshotRef.current;
    lockAppliedRef.current = false;
    snapshotRef.current = null;
    if (snapshot) {
      setEmployees((current) => current.map((employee) => (employee.id === snapshot.id ? { ...snapshot } : employee)));
    }
    setSimulationLocked(false);
    setLockedEmployeeId(null);
    lockedIdRef.current = null;
    setFeed((current) => current.filter((event) => event.source !== "simulation"));
  }, []);

  const openKillChain = useCallback(() => {
    unlockAudio();
    setKillOpen(true);
    if (phaseRef.current === "running") return;
    if (phaseRef.current === "done") resetSimulation();
    phaseRef.current = "running";
    setSimPhase("running");
    setKillToken((token) => token + 1);
  }, [resetSimulation]);

  const replayKillChain = useCallback(() => {
    unlockAudio();
    resetSimulation();
    phaseRef.current = "running";
    setSimPhase("running");
    setKillOpen(true);
    setKillToken((token) => token + 1);
  }, [resetSimulation]);

  const setTargetEmployeeId = useCallback((id: string) => {
    targetRef.current = id;
    setTargetEmployeeIdState(id);
  }, []);

  const applySimulationLock = useCallback(() => {
    if (lockAppliedRef.current) return;
    const targetId = targetRef.current;
    const current = employeesRef.current.find((employee) => employee.id === targetId);
    if (!current) return;
    lockAppliedRef.current = true;
    if (!snapshotRef.current) snapshotRef.current = { ...current };
    lockedIdRef.current = targetId;
    setLockedEmployeeId(targetId);
    const name = fullName(current);
    setEmployees((list) =>
      list.map((employee) =>
        employee.id === targetId
          ? {
              ...employee,
              status: "Dondurulub",
              awarenessScore: Math.max(20, employee.awarenessScore - 6),
              lastTestResult: "Zəncirvari hücumda linkə kliklədi",
              lastTestStatus: "ugursuz",
            }
          : employee,
      ),
    );
    setSimulationLocked(true);
    pushFeed({
      id: crypto.randomUUID(),
      time: formatClock(new Date()),
      title: `Hesab donduruldu: ${name}`,
      detail: "Vahid risk balı 99/100. İxrac dayandırıldı, sessiya bağlandı.",
      technical: `${name} sessiyası üç müdafiə qatının birləşməsindən sonra donduruldu. Aktiv əlaqə kəsildi.`,
      sourceIp: "zəncirvari ssenari",
      mitre: "T1078 — Valid Accounts",
      severity: "critical",
      category: "Sistem",
      source: "simulation",
    });
    pushToast({
      title: "Avtomatik bloklama",
      message: `${name} hesabı donduruldu. Dondurulmuş hesab sayı yeniləndi.`,
      tone: "critical",
    });
  }, [pushFeed, pushToast]);

  const sendAwarenessTest = useCallback(
    (id: string) => {
      const employee = employeesRef.current.find((item) => item.id === id);
      if (!employee) return;
      const passed = Math.random() < 0.28 + employee.awarenessScore / 150;
      const delta = passed ? 4 + Math.floor(Math.random() * 5) : -(4 + Math.floor(Math.random() * 4));
      const nextScore = Math.max(15, Math.min(100, employee.awarenessScore + delta));
      const nextStatus =
        employee.status === "Dondurulub"
          ? "Dondurulub"
          : passed && nextScore >= 75
            ? "Aktiv"
            : !passed && nextScore < 70
              ? "Nəzarətdə"
              : employee.status;
      setEmployees((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                awarenessScore: nextScore,
                status: nextStatus,
                lastTestStatus: passed ? "ugurlu" : "ugursuz",
                lastTestResult: passed ? "Şübhəli məktubu bildirdi" : "Sınaq keçidinə kliklədi",
              }
            : item,
        ),
      );
      pushToast({
        title: passed ? "Sınaqdan keçdi" : "Sınaqda zəiflik",
        message: `${fullName(employee)} üçün yeni kiber-sayıqlıq balı: ${nextScore}.`,
        tone: passed ? "success" : "warning",
      });
    },
    [pushToast],
  );

  const toggleFreeze = useCallback(
    (id: string) => {
      const employee = employeesRef.current.find((item) => item.id === id);
      if (!employee) return;
      const nextStatus = employee.status === "Dondurulub" ? "Aktiv" : "Dondurulub";
      setEmployees((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
      if (id === lockedIdRef.current && nextStatus === "Aktiv") {
        setSimulationLocked(false);
        setLockedEmployeeId(null);
        lockedIdRef.current = null;
      }
      pushFeed({
        id: crypto.randomUUID(),
        time: formatClock(new Date()),
        title: nextStatus === "Dondurulub" ? `Hesab donduruldu: ${fullName(employee)}` : `Hesab aktivləşdirildi: ${fullName(employee)}`,
        detail: nextStatus === "Dondurulub" ? "Operator hesabı əl ilə dondurdu." : "Operator hesabı yenidən aktiv etdi.",
        severity: nextStatus === "Dondurulub" ? "critical" : "success",
        category: "Sistem",
        source: "user",
      });
      pushToast({
        title: nextStatus === "Dondurulub" ? "Hesab donduruldu" : "Hesab aktivləşdirildi",
        message: fullName(employee),
        tone: nextStatus === "Dondurulub" ? "critical" : "success",
      });
    },
    [pushFeed, pushToast],
  );

  const applyTraining = useCallback(
    (id: string, correct: number) => {
      const employee = employeesRef.current.find((item) => item.id === id);
      if (!employee) return;
      const delta = correct >= 3 ? 8 : correct === 2 ? 5 : correct === 1 ? 2 : 0;
      const nextScore = Math.min(100, employee.awarenessScore + delta);
      setEmployees((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                awarenessScore: nextScore,
                lastTestResult: `Kiber-test: ${correct}/3 düzgün`,
                lastTestStatus: correct >= 2 ? "ugurlu" : correct === 1 ? "qismen" : "ugursuz",
                status: item.status === "Dondurulub" ? "Dondurulub" : correct >= 2 && nextScore >= 75 ? "Aktiv" : item.status,
              }
            : item,
        ),
      );
      pushToast({
        title: delta > 0 ? "Sayıqlıq balı artdı" : "Təlim təkrarı lazımdır",
        message:
          delta > 0
            ? `${fullName(employee)} ${correct}/3 düzgün cavab verdi. Yeni bal: ${nextScore}.`
            : `${fullName(employee)} testi keçə bilmədi. Bal dəyişmədi.`,
        tone: correct >= 2 ? "success" : "warning",
      });
    },
    [pushToast],
  );

  const registerPhishingBlock = useCallback(
    (title: string) => {
      setPhishingBlocked((count) => count + 1);
      pushFeed({
        id: crypto.randomUUID(),
        time: formatClock(new Date()),
        title,
        detail: "Fişinq analizatoru mesajı avtomatik karantinə aldı.",
        technical: "Qərar ağacı təcililik, domen və oğurluq ballarını birləşdirib karantin həddini keçdi.",
        sourceIp: "yerli analiz",
        mitre: "T1566.002 — Spearphishing Link",
        severity: "critical",
        category: "Fişinq",
        source: "user",
      });
      pushToast({ title: "Karantin tətbiq olundu", message: title, tone: "critical" });
    },
    [pushFeed, pushToast],
  );

  const registerDeepfakeCatch = useCallback(
    (title: string) => {
      setDeepfakeCaught((count) => count + 1);
      pushFeed({
        id: crypto.randomUUID(),
        time: formatClock(new Date()),
        title,
        detail: "Dipfeyk detektoru səs izini blok siyahısına saldı.",
        technical: "RMS, sıfır-keçid və steril pauza ölçüləri süni sintez qoluna düşdü.",
        sourceIp: "yerli analiz",
        mitre: "T1656 — Impersonation / Deepfake",
        severity: "critical",
        category: "Dipfeyk",
        source: "user",
      });
      pushToast({ title: "Dipfeyk bloklandı", message: title, tone: "critical" });
    },
    [pushFeed, pushToast],
  );

  const averageScore = Math.round(employees.reduce((sum, employee) => sum + employee.awarenessScore, 0) / employees.length);
  const frozenCount = employees.filter((employee) => employee.status === "Dondurulub").length;

  const value = useMemo<SocContextValue>(
    () => ({
      employees,
      feed,
      phishingBlocked,
      deepfakeCaught,
      averageScore,
      frozenCount,
      tab,
      setTab,
      killOpen,
      simPhase,
      killToken,
      simulationLocked,
      targetEmployeeId,
      setTargetEmployeeId,
      lockedEmployeeId,
      toasts,
      dismissToast,
      openKillChain,
      closeKillChain,
      replayKillChain,
      updatePhase,
      applySimulationLock,
      sendAwarenessTest,
      toggleFreeze,
      applyTraining,
      registerPhishingBlock,
      registerDeepfakeCatch,
    }),
    [
      employees,
      feed,
      phishingBlocked,
      deepfakeCaught,
      averageScore,
      frozenCount,
      tab,
      killOpen,
      simPhase,
      killToken,
      simulationLocked,
      targetEmployeeId,
      setTargetEmployeeId,
      lockedEmployeeId,
      toasts,
      dismissToast,
      openKillChain,
      closeKillChain,
      replayKillChain,
      updatePhase,
      applySimulationLock,
      sendAwarenessTest,
      toggleFreeze,
      applyTraining,
      registerPhishingBlock,
      registerDeepfakeCatch,
    ],
  );

  return <SocContext.Provider value={value}>{children}</SocContext.Provider>;
}

export function useSoc(): SocContextValue {
  const context = useContext(SocContext);
  if (!context) throw new Error("useSoc yalnız SocProvider daxilində işləyir");
  return context;
}
