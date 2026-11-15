import type { Employee } from "../types.ts";

export interface HourPoint {
  hour: string;
  norma: number;
  fakt: number;
  shown: number;
  breach: boolean;
}

export interface BreachStory {
  hour: number;
  files: number;
  title: string;
  detail: string;
}

const BREACHES: Record<string, BreachStory> = {
  "rashad-aliyev": {
    hour: 2,
    files: 14500,
    title: "CRM bazasının kütləvi ixracı",
    detail: "Saat 02:30-da 14.500 müştəri qeydi ixrac edilib. Şəxsi və şirkət limiti: 15 fayl/gün.",
  },
  "fuad-nasirov": {
    hour: 1,
    files: 860,
    title: "Anbar hesabında gecə ixracı",
    detail: "Saat 01:12-də 860 anbar sənədi yüklənib. Gündəlik norma cəmi 7 fayldır.",
  },
  "cavid-gasimov": {
    hour: 23,
    files: 420,
    title: "OTP paylaşımından sonra ixrac",
    detail: "Saat 23:18-də 420 maliyyə sətri çıxarılıb. Hesab artıq dondurulub.",
  },
  "rena-ismayilova": {
    hour: 22,
    files: 190,
    title: "Saxta kuryer keçidindən sonra fəaliyyət",
    detail: "Saat 22:05-də 190 inzibati fayl kopyalanıb. Norma: 10 fayl/gün.",
  },
  "tural-babayev": {
    hour: 21,
    files: 96,
    title: "Satınalma qovluğunda gec sapma",
    detail: "Saat 21:40-da 96 müqavilə faylı açılıb. Gündəlik orta göstərici 11 fayldır.",
  },
};

export function getBreach(employeeId: string): BreachStory | null {
  return BREACHES[employeeId] ?? null;
}

export function simulationBreach(employee: Employee): BreachStory {
  return {
    hour: 2,
    files: 14500,
    title: "CRM bazasının kütləvi ixracı",
    detail: `Saat 02:30-da 14.500 müştəri qeydi ixrac edilib. ${employee.firstName} ${employee.lastName} üçün şəxsi limit: ${employee.avgDailyDownloads} fayl/gün.`,
  };
}

export function hourlyProfile(employee: Employee, showBreach: boolean, story: BreachStory | null = getBreach(employee.id)): HourPoint[] {
  const start = Number(employee.workStart.slice(0, 2));
  const end = Number(employee.workEnd.slice(0, 2));
  const span = Math.max(1, end - start);
  const weights = Array.from({ length: 24 }, (_, hour) => {
    if (hour < start || hour >= end) return 0;
    const mid = (start + end - 1) / 2;
    const sigma = span / 3.1;
    return Math.exp(-0.5 * ((hour - mid) / sigma) ** 2);
  });
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
  const ceiling = Math.max(4, employee.avgDailyDownloads * 0.42);

  return weights.map((weight, hour) => {
    const norma = Math.round((weight / weightSum) * employee.avgDailyDownloads * 10) / 10;
    let fakt = norma;
    let breach = false;
    if (showBreach && story && story.hour === hour) {
      fakt = story.files;
      breach = true;
    } else if (!showBreach) {
      const wobble = 0.84 + ((hour * 3 + employee.avgDailyDownloads) % 5) * 0.06;
      fakt = Math.round(norma * wobble * 10) / 10;
    }
    return {
      hour: String(hour).padStart(2, "0"),
      norma,
      fakt,
      shown: Math.min(fakt, ceiling),
      breach,
    };
  });
}
