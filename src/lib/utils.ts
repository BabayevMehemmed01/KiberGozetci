import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDay(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString("az-AZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

export function fullName(employee: { firstName: string; lastName: string }): string {
  return `${employee.firstName} ${employee.lastName}`;
}

export function workHours(employee: { workStart: string; workEnd: string }): string {
  return `${employee.workStart}–${employee.workEnd}`;
}
