export type AccountStatus = "Aktiv" | "Nəzarətdə" | "Dondurulub";

export type TestOutcome = "ugurlu" | "qismen" | "ugursuz";

export type FeedSeverity = "info" | "warning" | "critical" | "success";

export type FeedCategory = "Fişinq" | "Dipfeyk" | "Daxili anomaliya" | "Sistem";

export type FeedSource = "history" | "live" | "simulation" | "user";

export type AppTab = "overview" | "phishing" | "deepfake" | "insider";

export type SimPhase = "idle" | "running" | "done";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  workStart: string;
  workEnd: string;
  avgDailyDownloads: number;
  awarenessScore: number;
  lastTestResult: string;
  lastTestStatus: TestOutcome;
  status: AccountStatus;
  email: string;
}

export interface FeedEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  severity: FeedSeverity;
  category: FeedCategory;
  source: FeedSource;
  sourceIp?: string;
  mitre?: string;
  technical?: string;
}

export interface AttackPoint {
  day: string;
  Fişinq: number;
  Dipfeyk: number;
  "Daxili anomaliya": number;
}

export interface PhishingTemplate {
  id: string;
  title: string;
  description: string;
  tone: "tehlukeli" | "tehlukesiz";
  text: string;
  url: string;
}

export interface VoiceSample {
  id: string;
  fileName: string;
  title: string;
  description: string;
  scene: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  tone: "info" | "success" | "warning" | "critical";
}
