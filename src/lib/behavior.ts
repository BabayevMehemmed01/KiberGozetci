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
  minute: number;
  files: number;
  title: string;
  detail: string;
  mitre: string;
  sourceIp: string;
}

export interface ProfileStats {
  zScore: number;
  risk: number;
  deviation: number;
  files: number;
  hour: string;
}

const BREACHES: Record<string, BreachStory> = {
  "rashad-aliyev": {
    hour: 2,
    minute: 30,
    files: 14500,
    title: "CRM bazasının kütləvi ixracı",
    detail: "Saat 02:30-da 14.500 müştəri qeydi ixrac edilib. Baş mühasib üçün gündəlik limit 15 fayldır.",
    mitre: "T1048 — Exfiltration Over Alternative Protocol",
    sourceIp: "185.203.44.19",
  },
  "nigar-mammadova": {
    hour: 3,
    minute: 12,
    files: 2680,
    title: "İdarə heyəti modelinin köçürülməsi",
    detail: "Saat 03:12-də 2.680 sətirlik maliyyə modeli xarici poçta yönəldilib. Direktorun gündəlik norması 8 fayldır.",
    mitre: "T1213 — Data from Information Repositories",
    sourceIp: "185.203.18.64",
  },
  "elvin-hasanov": {
    hour: 4,
    minute: 15,
    files: 6400,
    title: "Verilənlər bazası ehtiyat nüsxəsi",
    detail: "Saat 04:15-də xarici IP-dən 6.400 verilənlər bazası ehtiyat faylı köçürülüb. İT administratorun norması 18 fayldır.",
    mitre: "T1020 — Automated Exfiltration",
    sourceIp: "91.132.45.17",
  },
  "aysel-guliyeva": {
    hour: 23,
    minute: 50,
    files: 3200,
    title: "Müqavilə qovluğunun yüklənməsi",
    detail: "Saat 23:50-də 3.200 satış müqaviləsi endirilib. Satış menecerinin gündəlik norması 14 fayldır.",
    mitre: "T1048 — Exfiltration Over Alternative Protocol",
    sourceIp: "185.203.22.90",
  },
  "kamran-ibrahimov": {
    hour: 0,
    minute: 20,
    files: 2100,
    title: "İşçi qovluqlarının kütləvi çıxarışı",
    detail: "Saat 00:20-də 2.100 kadr sənədi arxivlənib. HR norması gündə 9 fayldır.",
    mitre: "T1530 — Data from Cloud Storage",
    sourceIp: "185.203.28.41",
  },
  "leyla-huseynova": {
    hour: 5,
    minute: 10,
    files: 740,
    title: "Məhkəmə sənədlərinin köçürülməsi",
    detail: "Saat 05:10-da 740 hüquqi iş qovluğu xarici diskə yazılıb. Hüquqşünasın norması 6 fayldır.",
    mitre: "T1213 — Data from Information Repositories",
    sourceIp: "185.203.31.12",
  },
  "tural-babayev": {
    hour: 22,
    minute: 15,
    files: 1280,
    title: "Təchizatçı fakturalarının ixracı",
    detail: "Saat 22:15-də 1.280 faktura və qiymət razılaşması açılıb. Satınalma norması 11 fayldır.",
    mitre: "T1078 — Valid Accounts",
    sourceIp: "185.203.19.77",
  },
  "orxan-valiyev": {
    hour: 3,
    minute: 40,
    files: 4100,
    title: "Sistem jurnallarının arxivlənməsi",
    detail: "Saat 03:40-da 4.100 sistem jurnalı xarici anbara ötürülüb. Analitik üçün norma 16 fayldır.",
    mitre: "T1048 — Exfiltration Over Alternative Protocol",
    sourceIp: "45.138.16.204",
  },
  "aygun-rzayeva": {
    hour: 1,
    minute: 5,
    files: 560,
    title: "Audit iş sənədlərinin çıxarışı",
    detail: "Saat 01:05-də 560 audit faylı şəxsi ünvana göndərilib. Auditorun norması 5 fayldır.",
    mitre: "T1213 — Data from Information Repositories",
    sourceIp: "185.203.26.53",
  },
  "fuad-nasirov": {
    hour: 1,
    minute: 40,
    files: 1900,
    title: "Təchizatçı qiymət cədvəllərinin ixracı",
    detail: "Saat 01:40-da 1.900 anbar və qiymət cədvəli kütləvi ixrac olunub. Anbar müdirinin norması 7 fayldır.",
    mitre: "T1048 — Exfiltration Over Alternative Protocol",
    sourceIp: "185.203.15.88",
  },
  "cavid-gasimov": {
    hour: 0,
    minute: 45,
    files: 980,
    title: "Ödəniş tapşırıqlarının çıxarışı",
    detail: "Saat 00:45-də 980 ödəniş tapşırığı endirilib. Kiçik mühasibin norması 13 fayldır.",
    mitre: "T1048 — Exfiltration Over Alternative Protocol",
    sourceIp: "185.203.41.23",
  },
  "rena-ismayilova": {
    hour: 22,
    minute: 48,
    files: 430,
    title: "İnzibati skanların köçürülməsi",
    detail: "Saat 22:48-də 430 inzibati skan xarici ünvana ötürülüb. Ofis administratorunun norması 10 fayldır.",
    mitre: "T1041 — Exfiltration Over C2 Channel",
    sourceIp: "185.203.33.70",
  },
};

function hashId(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function getBreach(employeeId: string): BreachStory {
  return (
    BREACHES[employeeId] ?? {
      hour: 2,
      minute: 10,
      files: 640,
      title: "İş saatından kənar ixrac",
      detail: "Gecə saatında gündəlik limitdən kənar fayl çıxarışı qeydə alınıb.",
      mitre: "T1048 — Exfiltration Over Alternative Protocol",
      sourceIp: "185.203.20.20",
    }
  );
}

export function simulationBreach(employee: Employee): BreachStory {
  const story = getBreach(employee.id);
  return {
    ...story,
    detail: `${story.detail} Zəncirvari ssenaridə hədəf ${employee.firstName} ${employee.lastName} hesabıdır.`,
  };
}

export function hourlyProfile(employee: Employee, showBreach: boolean, story: BreachStory | null = getBreach(employee.id)): HourPoint[] {
  const start = Number(employee.workStart.slice(0, 2));
  const end = Number(employee.workEnd.slice(0, 2));
  const span = Math.max(1, end - start);
  const hash = hashId(employee.id);
  const shift = (hash % 5) - 2;
  const narrow = 2.35 + (hash % 4) * 0.28;
  const weights = Array.from({ length: 24 }, (_, hour) => {
    if (hour < start || hour >= end) return (hash % 3 === 0 && hour === start - 1 ? 0.04 : 0);
    const mid = (start + end - 1) / 2 + shift * 0.55;
    const sigma = span / narrow;
    const primary = Math.exp(-0.5 * ((hour - mid) / sigma) ** 2);
    const secondPeak = (hash >> 4) % 3 === 0 ? 0.28 * Math.exp(-0.5 * ((hour - (end - 2)) / 1.2) ** 2) : 0;
    return primary + secondPeak;
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
      const wobble = 0.82 + ((hour * 3 + (hash % 7)) % 5) * 0.05;
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

export function profileStats(points: HourPoint[]): ProfileStats {
  const baseline = points.filter((point) => !point.breach);
  const sample = baseline.length > 0 ? baseline : points;
  const mean = sample.reduce((sum, point) => sum + point.norma, 0) / sample.length;
  const variance = sample.reduce((sum, point) => sum + (point.norma - mean) ** 2, 0) / sample.length;
  const deviation = Math.sqrt(variance) || 0.35;
  const peak = points.reduce((best, point) => (point.fakt > best.fakt ? point : best), points[0] ?? { hour: "00", norma: 0, fakt: 0, shown: 0, breach: false });
  const zScore = (peak.fakt - peak.norma) / deviation;
  const risk = Math.round(Math.min(99, zScore > 8 ? 72 + Math.min(27, Math.log10(zScore) * 12) : Math.max(4, zScore * 9)));
  return {
    zScore,
    risk: Math.max(0, Math.min(99, risk)),
    deviation,
    files: peak.fakt,
    hour: peak.hour,
  };
}
