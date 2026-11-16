import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RASHAD_ID, employees as seedEmployees, threatJournal } from "../data/mockData.ts";
import { postSecurityAlert, saveMailSettings, loadMailSettings, type SecurityAlertInput } from "../lib/alertClient.ts";
import { randomAttackIp, type SimulationOutcome } from "../lib/scenario.ts";
import { unlockAudio } from "../lib/tones.ts";
import { formatClock, fullName } from "../lib/utils.ts";
import type { AppTab, Employee, FeedEvent, SimPhase, ToastMessage } from "../types.ts";

export type SocTheme = "cyber" | "emerald" | "violet" | "daylight";

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
  applySimulationLock: (outcome: SimulationOutcome) => void;
  theme: SocTheme;
  setTheme: (theme: SocTheme) => void;
  quarantineThreshold: number;
  setQuarantineThreshold: (value: number) => void;
  lastOutcome: SimulationOutcome | null;
  phishingTrap: PhishingTrap | null;
  clearPhishingTrap: () => void;
  sendPhishingTrap: (employeeName: string) => Promise<{ ok: boolean; skipped: boolean; message: string }>;
  toggleFreeze: (id: string) => void;
  applyTraining: (id: string, correct: number, options?: { restore?: boolean }) => void;
  releasePhishingTrap: () => void;
  registerPhishingBlock: (title: string) => void;
  registerDeepfakeCatch: (title: string) => void;
  mailAlertsEnabled: boolean;
  setMailAlertsEnabled: (enabled: boolean) => void;
  alertRecipient: string;
  setAlertRecipient: (email: string) => void;
  sendSecurityAlert: (alert: SecurityAlertInput, options?: { force?: boolean }) => Promise<{ ok: boolean; skipped: boolean; message: string }>;
}

const SocContext = createContext<SocContextValue | null>(null);

function loadTheme(): SocTheme {
  try {
    const value = localStorage.getItem("kibergozetci-theme");
    if (value === "emerald" || value === "violet" || value === "daylight" || value === "cyber") return value;
  } catch {
    return "cyber";
  }
  return "cyber";
}

function loadThreshold(): number {
  try {
    const stored = localStorage.getItem("kibergozetci-threshold");
    if (!stored) return 65;
    const value = Number(stored);
    if (!Number.isFinite(value)) return 65;
    return Math.min(85, Math.max(50, Math.round(value)));
  } catch {
    return 65;
  }
}

function stampJournal(events: FeedEvent[]): FeedEvent[] {
  const now = Date.now();
  return events.map((event, index) => ({
    ...event,
    time: formatClock(new Date(now - (events.length - index) * 9 * 60 * 1000 - index * 23000)),
  }));
}

const TRAP_HIT_KEY = "kibergozetci-phish-trap-hit";
const TRAP_PENDING_KEY = "kibergozetci-phish-trap-pending";

export interface PhishingTrap {
  employeeId: string | null;
  employeeName: string;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("az-AZ");
}

function readPendingTrap(): PhishingTrap | null {
  try {
    const raw = sessionStorage.getItem(TRAP_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PhishingTrap>;
    if (typeof parsed.employeeName !== "string" || !parsed.employeeName.trim()) return null;
    return { employeeId: parsed.employeeId ?? null, employeeName: parsed.employeeName.trim() };
  } catch {
    return null;
  }
}

function initialTab(): AppTab {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("phish_trap") === "1" || sessionStorage.getItem(TRAP_PENDING_KEY)) return "insider";
  } catch {
    return "overview";
  }
  return "overview";
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
  const [tab, setTab] = useState<AppTab>(initialTab);
  const [phishingTrap, setPhishingTrap] = useState<PhishingTrap | null>(readPendingTrap);
  const [killOpen, setKillOpen] = useState(false);
  const [simPhase, setSimPhase] = useState<SimPhase>("idle");
  const [killToken, setKillToken] = useState(0);
  const [simulationLocked, setSimulationLocked] = useState(false);
  const [targetEmployeeId, setTargetEmployeeIdState] = useState(RASHAD_ID);
  const [lockedEmployeeId, setLockedEmployeeId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setThemeState] = useState<SocTheme>(loadTheme);
  const [quarantineThreshold, setThresholdState] = useState(loadThreshold);
  const [lastOutcome, setLastOutcome] = useState<SimulationOutcome | null>(null);
  const [mailAlertsEnabled, setMailAlertsEnabledState] = useState(() => loadMailSettings().enabled);
  const [alertRecipient, setAlertRecipientState] = useState(() => loadMailSettings().recipientEmail);
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

  const setTheme = useCallback((next: SocTheme) => {
    setThemeState(next);
    localStorage.setItem("kibergozetci-theme", next);
  }, []);

  const setQuarantineThreshold = useCallback((value: number) => {
    const next = Math.min(85, Math.max(50, Math.round(value)));
    setThresholdState(next);
    localStorage.setItem("kibergozetci-threshold", String(next));
  }, []);

  const setMailAlertsEnabled = useCallback((enabled: boolean) => {
    setMailAlertsEnabledState(enabled);
    saveMailSettings(enabled, loadMailSettings().recipientEmail);
  }, []);

  const setAlertRecipient = useCallback((email: string) => {
    setAlertRecipientState(email);
    saveMailSettings(loadMailSettings().enabled, email);
  }, []);

  const clearPhishingTrap = useCallback(() => {
    sessionStorage.removeItem(TRAP_PENDING_KEY);
    setPhishingTrap(null);
  }, []);

  const releaseTimer = useRef<number | null>(null);
  const releasePhishingTrap = useCallback(() => {
    sessionStorage.removeItem(TRAP_PENDING_KEY);
    if (releaseTimer.current) window.clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("phish_trap");
      url.searchParams.delete("emp");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setPhishingTrap(null);
      releaseTimer.current = null;
    }, 3000);
  }, []);

  const sendSecurityAlert = useCallback(
    async (alert: SecurityAlertInput, options?: { force?: boolean }) => {
      const result = await postSecurityAlert(alert, options);
      if (!result.skipped) {
        pushToast({
          title: result.ok ? "E-poçt bildirişi göndərildi" : "E-poçt göndərilmədi",
          message: result.message,
          tone: result.ok ? "success" : "warning",
        });
      }
      return result;
    },
    [pushToast],
  );

  const sendPhishingTrap = useCallback(
    (employeeName: string) => {
      const name = employeeName.trim() || "Rəşad Əliyev";
      return sendSecurityAlert(
        {
          type: "phishing_trap",
          alertType: "Fişinq tələsi sınağı",
          targetEmployee: name,
          employeeName: name,
          riskScore: 72,
          mitreCode: "T1566.002 — Spearphishing Link",
          details: `${name} üçün təcili hesab təsdiqi görünümlü sınaq məktubu göndərildi. Keçid yalnız bu saytın fişinq tələsinə açılır.`,
        },
        { force: true },
      );
    },
    [sendSecurityAlert],
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "daylight" ? "light" : "dark";
  }, [theme]);

  const updatePhase = useCallback((phase: SimPhase) => {
    phaseRef.current = phase;
    setSimPhase(phase);
  }, []);

  const pushFeed = useCallback((event: FeedEvent) => {
    setFeed((current) => [event, ...current].slice(0, 16));
  }, []);

  const trapBoot = useRef(false);
  useLayoutEffect(() => {
    if (trapBoot.current) return;
    trapBoot.current = true;
    const params = new URLSearchParams(window.location.search);
    const armed = params.get("phish_trap") === "1";
    const rawName = params.get("emp")?.trim().replace(/\s+/g, " ") ?? "";
    if (!armed || !rawName) return;
    const key = normalizeName(rawName);
    const employee = employeesRef.current.find((item) => normalizeName(fullName(item)) === key || item.id === rawName);
    const name = employee ? fullName(employee) : rawName;
    if (sessionStorage.getItem(TRAP_HIT_KEY) !== key) {
      sessionStorage.setItem(TRAP_HIT_KEY, key);
      if (employee) {
        const nextScore = Math.max(0, employee.awarenessScore - 15);
        setEmployees((current) =>
          current.map((item) =>
            item.id === employee.id
              ? {
                  ...item,
                  awarenessScore: nextScore,
                  status: item.status === "Dondurulub" ? "Dondurulub" : "Nəzarətdə",
                  lastTestResult: "Sınaq fişinq keçidini açdı",
                  lastTestStatus: "ugursuz",
                }
              : item,
          ),
        );
      }
      pushFeed({
        id: crypto.randomUUID(),
        time: formatClock(new Date()),
        title: `Tələyə düşdü: ${name} sınaq fişinq keçidini açdı`,
        detail: employee
          ? employee.status === "Dondurulub"
            ? `${name} simulyasiya edilmiş fişinq keçidini açdı. Kiber-sayıqlıq balı 15 vahid azaldı. Hesab dondurulmuş vəziyyətdə qalır.`
            : `${name} simulyasiya edilmiş fişinq keçidini açdı. Kiber-sayıqlıq balı 15 vahid azaldı və hesab nəzarətə alındı.`
          : `${name} simulyasiya edilmiş fişinq keçidini açdı.`,
        technical: "Keçid ?phish_trap=1 parametri ilə yerli təlim tələsinə düşdü. Kənar sayta yönləndirmə yoxdur.",
        mitre: "T1566.002 — Spearphishing Link",
        severity: "critical",
        category: "Fişinq",
        source: "user",
      });
      pushToast({
        title: "Fişinq tələsi işə düşdü",
        message: `${name} sınaq keçidini açdı.`,
        tone: "critical",
      });
    }
    const pending: PhishingTrap = { employeeId: employee?.id ?? null, employeeName: name };
    sessionStorage.setItem(TRAP_PENDING_KEY, JSON.stringify(pending));
    setPhishingTrap(pending);
    setTab("insider");
    const url = new URL(window.location.href);
    url.searchParams.delete("phish_trap");
    url.searchParams.delete("emp");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [pushFeed, pushToast]);

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
    setLastOutcome(null);
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

  const applySimulationLock = useCallback((outcome: SimulationOutcome) => {
    if (lockAppliedRef.current) return;
    const targetId = targetRef.current;
    const current = employeesRef.current.find((employee) => employee.id === targetId);
    if (!current) return;
    lockAppliedRef.current = true;
    setLastOutcome(outcome);
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
      detail: `Vahid risk balı ${outcome.risk}/100. Bloklama ${outcome.blockSeconds.toFixed(1)} s. Qarşısı alınan zərər ₼ ${outcome.damage.toLocaleString("az-AZ")}. İxrac dayandırıldı, sessiya bağlandı.`,
      technical: `${name} sessiyası üç müdafiə qatının birləşməsindən sonra donduruldu. ${outcome.title}. Aktiv əlaqə kəsildi.`,
      sourceIp: "zəncirvari ssenari",
      mitre: "T1078 — Valid Accounts",
      severity: "critical",
      category: "Sistem",
      source: "simulation",
    });
    pushToast({
      title: "Avtomatik bloklama",
      message: `${name} hesabı donduruldu. Risk ${outcome.risk}/100, reaksiya ${outcome.blockSeconds.toFixed(1)} s.`,
      tone: "critical",
    });
    void sendSecurityAlert({
      alertType: "Zəncirvari hücum simulyasiyası",
      targetEmployee: `${name} · ${current.department} · ${current.email}`,
      riskScore: outcome.risk,
      mitreCode: "T1078 — Valid Accounts",
      details: `${outcome.title}. Bloklama ${outcome.blockSeconds.toFixed(1)} saniyədə tamamlandı. Qarşısı alınan zərər ₼ ${outcome.damage.toLocaleString("az-AZ")}. Tədbir: hesab donduruldu, ixrac dayandırıldı, sessiya bağlandı.`,
    });
  }, [pushFeed, pushToast, sendSecurityAlert]);

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
      if (nextStatus === "Dondurulub") {
        void sendSecurityAlert({
          alertType: "Hesab donduruldu",
          targetEmployee: `${fullName(employee)} · ${employee.department} · ${employee.email}`,
          riskScore: Math.min(98, Math.max(72, 100 - employee.awarenessScore)),
          mitreCode: "T1078 — Valid Accounts",
          details: `${employee.position} vəzifəli hesab operator tərəfindən donduruldu. Sessiya bağlandı və ixrac dayandırıldı. Son sınaq: ${employee.lastTestResult}.`,
        });
      }
    },
    [pushFeed, pushToast, sendSecurityAlert],
  );

  const applyTraining = useCallback(
    (id: string, correct: number, options?: { restore?: boolean }) => {
      const employee = employeesRef.current.find((item) => item.id === id);
      if (!employee) return;
      const delta = options?.restore ? 15 : correct >= 3 ? 8 : correct === 2 ? 5 : correct === 1 ? 2 : 0;
      const nextScore = Math.min(100, employee.awarenessScore + delta);
      setEmployees((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                awarenessScore: nextScore,
                lastTestResult: options?.restore ? `Kiber-təlim tamamlandı: ${correct}/3` : `Kiber-test: ${correct}/3 düzgün`,
                lastTestStatus: correct >= 2 ? "ugurlu" : correct === 1 ? "qismen" : "ugursuz",
                status: item.status === "Dondurulub" ? "Dondurulub" : !options?.restore && correct >= 2 && nextScore >= 75 ? "Aktiv" : item.status,
              }
            : item,
        ),
      );
      if (!options?.restore) {
        pushToast({
          title: delta > 0 ? "Sayıqlıq balı artdı" : "Təlim təkrarı lazımdır",
          message:
            delta > 0
              ? `${fullName(employee)} ${correct}/3 düzgün cavab verdi. Yeni bal: ${nextScore}.`
              : `${fullName(employee)} testi keçə bilmədi. Bal dəyişmədi.`,
          tone: correct >= 2 ? "success" : "warning",
        });
      }
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
      theme,
      setTheme,
      quarantineThreshold,
      setQuarantineThreshold,
      lastOutcome,
      phishingTrap,
      clearPhishingTrap,
      releasePhishingTrap,
      sendPhishingTrap,
      toggleFreeze,
      applyTraining,
      registerPhishingBlock,
      registerDeepfakeCatch,
      mailAlertsEnabled,
      setMailAlertsEnabled,
      alertRecipient,
      setAlertRecipient,
      sendSecurityAlert,
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
      theme,
      setTheme,
      quarantineThreshold,
      setQuarantineThreshold,
      lastOutcome,
      phishingTrap,
      clearPhishingTrap,
      releasePhishingTrap,
      sendPhishingTrap,
      toggleFreeze,
      applyTraining,
      registerPhishingBlock,
      registerDeepfakeCatch,
      mailAlertsEnabled,
      setMailAlertsEnabled,
      alertRecipient,
      setAlertRecipient,
      sendSecurityAlert,
    ],
  );

  return <SocContext.Provider value={value}>{children}</SocContext.Provider>;
}

export function useSoc(): SocContextValue {
  const context = useContext(SocContext);
  if (!context) throw new Error("useSoc yalnız SocProvider daxilində işləyir");
  return context;
}
