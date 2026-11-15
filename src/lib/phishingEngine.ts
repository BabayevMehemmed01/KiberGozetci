import { clamp } from "./utils.ts";

export interface TextPart {
  text: string;
  hit: boolean;
}

export interface PhishingReport {
  overall: number;
  urgency: number;
  domain: number;
  style: number;
  theft: number;
  quarantine: "alindi" | "nezaret" | "tehlukesiz";
  highlights: TextPart[];
  matchedTerms: string[];
  findings: string[];
  analyzedUrl: string;
}

interface Signal {
  phrase: string;
  urgency: number;
  theft: number;
  style: number;
  label: string;
}

const SIGNALS: Signal[] = [
  { phrase: "heç kimə demə", urgency: 18, theft: 0, style: 36, label: "heç kimə demə" },
  { phrase: "geri qaytarılacaq", urgency: 12, theft: 0, style: 8, label: "geri qaytarılacaq" },
  { phrase: "birdəfəlik kod", urgency: 8, theft: 30, style: 0, label: "birdəfəlik kod" },
  { phrase: "bloklanacaq", urgency: 18, theft: 0, style: 10, label: "bloklanacaq" },
  { phrase: "dondurulacaq", urgency: 14, theft: 0, style: 8, label: "dondurulacaq" },
  { phrase: "hesabınız", urgency: 14, theft: 8, style: 0, label: "hesabınız" },
  { phrase: "köçürmə", urgency: 16, theft: 10, style: 0, label: "köçürmə" },
  { phrase: "klikləyin", urgency: 10, theft: 4, style: 6, label: "klikləyin" },
  { phrase: "şifrəniz", urgency: 6, theft: 36, style: 0, label: "şifrəniz" },
  { phrase: "fin kod", urgency: 4, theft: 28, style: 0, label: "FİN kod" },
  { phrase: "təcili", urgency: 16, theft: 0, style: 0, label: "təcili" },
  { phrase: "cərimə", urgency: 16, theft: 0, style: 0, label: "cərimə" },
  { phrase: "dərhal", urgency: 14, theft: 0, style: 0, label: "dərhal" },
  { phrase: "şifrə", urgency: 8, theft: 32, style: 0, label: "şifrə" },
  { phrase: "parol", urgency: 8, theft: 32, style: 0, label: "parol" },
  { phrase: "otp", urgency: 8, theft: 30, style: 0, label: "OTP" },
];

const ORDERED = [...SIGNALS].sort((a, b) => b.phrase.length - a.phrase.length);

const UPPER_MAP: Record<string, string> = {
  Ə: "ə",
  I: "ı",
  İ: "i",
  Ö: "ö",
  Ü: "ü",
  Ş: "ş",
  Ğ: "ğ",
  Ç: "ç",
};

export function foldAz(value: string): string {
  let folded = "";
  for (const char of value) {
    const mapped = UPPER_MAP[char];
    if (mapped) {
      folded += mapped;
      continue;
    }
    const lower = char.toLowerCase();
    folded += lower.length === char.length ? lower : char;
  }
  return folded;
}

function isLetter(char: string | undefined): boolean {
  if (!char) return false;
  return /\p{L}/u.test(char);
}

function matchAt(folded: string, index: number, phrase: string): boolean {
  if (!folded.startsWith(phrase, index)) return false;
  if (index > 0 && isLetter(folded[index - 1])) return false;
  if (phrase.length <= 3) {
    const next = folded[index + phrase.length];
    if (isLetter(next)) return false;
  }
  return true;
}

interface Hit {
  signal: Signal;
  start: number;
  end: number;
}

function findHits(text: string): Hit[] {
  const folded = foldAz(text);
  const hits: Hit[] = [];
  let index = 0;
  while (index < folded.length) {
    const signal = ORDERED.find((item) => matchAt(folded, index, item.phrase));
    if (!signal) {
      index += 1;
      continue;
    }
    hits.push({ signal, start: index, end: index + signal.phrase.length });
    index += signal.phrase.length;
  }
  return hits;
}

export function highlightPressure(text: string): TextPart[] {
  const hits = findHits(text);
  if (hits.length === 0) return [{ text, hit: false }];
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) parts.push({ text: text.slice(cursor, hit.start), hit: false });
    parts.push({ text: text.slice(hit.start, hit.end), hit: true });
    cursor = hit.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

function uniqueSignals(hits: Hit[]): Signal[] {
  const seen = new Set<string>();
  const list: Signal[] = [];
  for (const hit of hits) {
    if (seen.has(hit.signal.phrase)) continue;
    seen.add(hit.signal.phrase);
    list.push(hit.signal);
  }
  return list;
}

const SUSPICIOUS_HOST =
  /teyid|login|secure|update|kocurme|kuryer|sifre|parol|otp|verify|blok|hesab-yenile|account/;
const BRAND_HOST = /vergi|bank|gov|asan|maliyye|edovlet|kapital/;
const BAD_TLD = /\.(xyz|top|tk|gq|ml|cf|click|zip|rest|cam|buzz|quest)$/i;

function analyzeDomain(rawUrl: string): { score: number; reasons: string[]; analyzedUrl: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { score: 0, reasons: ["Keçid daxil edilməyib, domen riski sıfır qəbul edildi."], analyzedUrl: "" };
  }

  let score = 0;
  const reasons: string[] = [];
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let host = "";
  let path = "";

  try {
    const url = new URL(withProtocol);
    host = url.hostname.toLowerCase();
    path = `${url.pathname}${url.search}`.toLowerCase();
  } catch {
    score += 24;
    reasons.push("Keçid ünvanı standart formata uyğun deyil.");
    return { score, reasons, analyzedUrl: trimmed };
  }

  const full = `${host}${path}`;
  const trustedHost = host === "sirket.az" || host.endsWith(".sirket.az") || host.endsWith(".gov.az");
  const suspiciousToken = SUSPICIOUS_HOST.test(full);
  const ipHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);

  if (trimmed.includes("@")) {
    score += 34;
    reasons.push("Keçiddə @ işarəsi var — ünvan maskalana bilər.");
  }
  if (ipHost) {
    score += 58;
    reasons.push("Domen əvəzinə birbaşa IP ünvanı istifadə olunub.");
  }
  if (BAD_TLD.test(host)) {
    score += 42;
    reasons.push("Yüksək riskli domen sonluğu aşkarlandı (.xyz, .top və ya oxşarı).");
  }
  if (host.includes("xn--") || /[\u0400-\u04FF]/.test(host)) {
    score += 36;
    reasons.push("Oxşar hərf dəyişikliyi: punycode və ya kiril simvol maskalanması.");
  }
  if (/\d/.test(host) && BRAND_HOST.test(host)) {
    score += 22;
    reasons.push("Brend görünümlü domendə hərf-rəqəm əvəzlənməsi var.");
  }
  if (BRAND_HOST.test(host) && !trustedHost) {
    score += 28;
    reasons.push("Rəsmi qurum adını təqlid edən, lakin etibarsız domen.");
  }
  if (suspiciousToken && !trustedHost) {
    score += 18;
    reasons.push("Keçiddə təsdiq, giriş və ya köçürmə sözləri gizlədilib.");
  }
  if (!ipHost && host.split(".").filter(Boolean).length >= 4 && !trustedHost) {
    score += 12;
    reasons.push("Həddindən artıq uzun alt-domen zənciri.");
  }
  if (trustedHost && !suspiciousToken && !ipHost) {
    return {
      score: 0,
      reasons: ["Keçid etibarlı daxili və ya rəsmi domenə aparır."],
      analyzedUrl: trimmed,
    };
  }
  if (reasons.length === 0) {
    reasons.push("Keçiddə açıq saxtakarlıq əlaməti görünmür.");
  }

  return { score: clamp(score), reasons, analyzedUrl: trimmed };
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  return match?.[0] ?? "";
}

function styleExtras(text: string, folded: string, urgency: number): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const exclamations = text.match(/!/g)?.length ?? 0;
  if (exclamations >= 3) {
    score += 16;
    reasons.push("Həddindən artıq nida işarəsi ilə təzyiq yaradılır.");
  } else if (exclamations === 2) {
    score += 8;
  }
  if (folded.includes("hörmətli müştəri") && urgency >= 20) {
    score += 28;
    reasons.push("Ümumi «hörmətli müştəri» müraciəti təhlükə dili ilə birləşir.");
  }
  if (text.trim().length < 420 && urgency >= 30) {
    score += 14;
    reasons.push("Qısa mətn tələskən qərar verməyə itələyir.");
  }
  if (/[A-ZƏÖÜĞŞÇİ]{10,}/.test(text)) {
    score += 12;
    reasons.push("Bağıran böyük hərflərlə üslub uyğunsuzluğu var.");
  }
  return { score: clamp(score), reasons };
}

export function analyzePhishing(text: string, url: string): PhishingReport {
  const hits = findHits(text);
  const signals = uniqueSignals(hits);
  const repeats = Math.max(0, hits.length - signals.length);

  let urgency = signals.reduce((sum, signal) => sum + signal.urgency, 0) + repeats * 3;
  let theft = signals.reduce((sum, signal) => sum + signal.theft, 0);
  let style = signals.reduce((sum, signal) => sum + signal.style, 0);
  urgency = clamp(urgency);
  theft = clamp(theft);

  const folded = foldAz(text);
  const extras = styleExtras(text, folded, urgency);
  style = clamp(style + extras.score);

  const domainInput = url.trim() || extractUrl(text);
  const domain = analyzeDomain(domainInput);

  let overall = urgency * 0.36 + domain.score * 0.3 + style * 0.16 + theft * 0.18;
  if (urgency >= 45 && domain.score >= 40) overall += 10;
  if (theft >= 28 && (urgency >= 24 || domain.score >= 40)) overall += 6;
  if (urgency < 12 && domain.score < 15 && theft < 12 && style < 18) overall = Math.min(overall, 8);
  if (text.trim().length < 12 && domain.score >= 50) overall = Math.max(overall, domain.score * 0.8);
  overall = clamp(Math.round(overall));

  const quarantine = overall >= 70 ? "alindi" : overall >= 40 ? "nezaret" : "tehlukesiz";
  const findings = [
    ...signals.map((signal) => `Təzyiq və ya oğurluq sözü: «${signal.label}».`),
    ...domain.reasons,
    ...extras.reasons,
  ];
  if (findings.length === 0) {
    findings.push("Mətndə fişinq əlaməti tapılmadı. Üslub rəsmi daxili yazışmaya uyğundur.");
  }

  return {
    overall,
    urgency,
    domain: domain.score,
    style,
    theft,
    quarantine,
    highlights: highlightPressure(text),
    matchedTerms: signals.map((signal) => signal.label),
    findings,
    analyzedUrl: domain.analyzedUrl,
  };
}
