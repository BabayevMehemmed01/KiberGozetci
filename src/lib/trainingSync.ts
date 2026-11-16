import type { Employee, FeedEvent } from "../types.ts";
import { formatClock, fullName } from "./utils.ts";

export const TRAINING_LOG_KEY = "kibergozetci-training-log";

export interface TrainingRecord {
  id: string;
  employeeName: string;
  kind: "clicked" | "restored";
  at: number;
}

export function normalizeEmployeeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("az-AZ");
}

function isRecord(value: unknown): value is TrainingRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TrainingRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.employeeName === "string" &&
    (record.kind === "clicked" || record.kind === "restored") &&
    typeof record.at === "number"
  );
}

export function readTrainingLog(): TrainingRecord[] {
  try {
    const raw = localStorage.getItem(TRAINING_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

export function appendTrainingRecord(input: { employeeName: string; kind: TrainingRecord["kind"] }): TrainingRecord {
  const record: TrainingRecord = {
    id: crypto.randomUUID(),
    employeeName: input.employeeName.trim().replace(/\s+/g, " "),
    kind: input.kind,
    at: Date.now(),
  };
  const next = [...readTrainingLog(), record].slice(-40);
  localStorage.setItem(TRAINING_LOG_KEY, JSON.stringify(next));
  return record;
}

function sameEmployee(employee: Employee, name: string): boolean {
  const key = normalizeEmployeeName(name);
  return normalizeEmployeeName(fullName(employee)) === key || employee.id === name;
}

export function applyTrainingRecord(list: Employee[], record: TrainingRecord): Employee[] {
  return list.map((employee) => {
    if (!sameEmployee(employee, record.employeeName)) return employee;
    if (record.kind === "clicked") {
      return {
        ...employee,
        awarenessScore: Math.max(0, employee.awarenessScore - 15),
        status: employee.status === "Dondurulub" ? "Dondurulub" : "Nəzarətdə",
        lastTestResult: "Sınaq fişinq keçidini açdı",
        lastTestStatus: "ugursuz",
      };
    }
    return {
      ...employee,
      awarenessScore: Math.min(100, employee.awarenessScore + 15),
      lastTestResult: "Kiber-təlim tamamlandı",
      lastTestStatus: "ugurlu",
    };
  });
}

export function trainingFeedEvent(record: TrainingRecord): FeedEvent {
  const name = record.employeeName;
  if (record.kind === "clicked") {
    return {
      id: record.id,
      time: formatClock(new Date(record.at)),
      title: `Tələyə düşdü: ${name} sınaq fişinq keçidini açdı`,
      detail: `${name} simulyasiya edilmiş fişinq keçidini açdı. Kiber-sayıqlıq balı 15 vahid azaldı və hesab nəzarətə alındı.`,
      technical: "Təcrid olunmuş /training səhifəsində tələ qeydə alındı və SOC panelinə yazıldı.",
      mitre: "T1566.002 — Spearphishing Link",
      severity: "critical",
      category: "Fişinq",
      source: "user",
    };
  }
  return {
    id: record.id,
    time: formatClock(new Date(record.at)),
    title: `Kiber-təlim tamamlandı: ${name}`,
    detail: `${name} 3 suallıq təlimi bitirdi. Sayıqlıq balı 15 vahid bərpa olundu.`,
    technical: "Təlim nəticəsi localStorage hadisəsi ilə canlı təhlükəsizlik axınına düşdü.",
    mitre: "T1566.002 — Spearphishing Link",
    severity: "success",
    category: "Sistem",
    source: "user",
  };
}
