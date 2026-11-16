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
  intents: string[];
}

interface Signal {
  phrase: string;
  urgency: number;
  theft: number;
  style: number;
  label: string;
}

const SIGNALS: Signal[] = [
  { phrase: "hesabınız askıya alındı", urgency: 22, theft: 8, style: 8, label: "hesabınız askıya alındı" },
  { phrase: "account suspended", urgency: 22, theft: 8, style: 8, label: "account suspended" },
  { phrase: "wire transfer", urgency: 18, theft: 16, style: 0, label: "wire transfer" },
  { phrase: "verification code", urgency: 8, theft: 30, style: 0, label: "verification code" },
  { phrase: "one-time code", urgency: 8, theft: 30, style: 0, label: "one-time code" },
  { phrase: "do not tell", urgency: 16, theft: 0, style: 28, label: "do not tell" },
  { phrase: "verify now", urgency: 18, theft: 8, style: 6, label: "verify now" },
  { phrase: "код подтверждения", urgency: 8, theft: 32, style: 0, label: "код подтверждения" },
  { phrase: "никому не говорите", urgency: 16, theft: 0, style: 28, label: "никому не говорите" },
  { phrase: "kimseye söyleme", urgency: 16, theft: 0, style: 28, label: "kimseye söyleme" },
  { phrase: "doğrulama kodu", urgency: 8, theft: 30, style: 0, label: "doğrulama kodu" },
  { phrase: "heç kimə demə", urgency: 18, theft: 0, style: 36, label: "heç kimə demə" },
  { phrase: "geri qaytarılacaq", urgency: 12, theft: 0, style: 8, label: "geri qaytarılacaq" },
  { phrase: "birdəfəlik kod", urgency: 8, theft: 30, style: 0, label: "birdəfəlik kod" },
  { phrase: "askıya alındı", urgency: 18, theft: 6, style: 6, label: "askıya alındı" },
  { phrase: "bloklanacaq", urgency: 18, theft: 0, style: 10, label: "bloklanacaq" },
  { phrase: "dondurulacaq", urgency: 14, theft: 0, style: 8, label: "dondurulacaq" },
  { phrase: "заблокирован", urgency: 20, theft: 4, style: 8, label: "заблокирован" },
  { phrase: "немедленно", urgency: 16, theft: 0, style: 0, label: "немедленно" },
  { phrase: "immediately", urgency: 16, theft: 0, style: 0, label: "immediately" },
  { phrase: "hesabınız", urgency: 14, theft: 8, style: 0, label: "hesabınız" },
  { phrase: "köçürmə", urgency: 16, theft: 10, style: 0, label: "köçürmə" },
  { phrase: "klikləyin", urgency: 10, theft: 4, style: 6, label: "klikləyin" },
  { phrase: "şifrəniz", urgency: 6, theft: 36, style: 0, label: "şifrəniz" },
  { phrase: "fin kod", urgency: 4, theft: 28, style: 0, label: "FİN kod" },
  { phrase: "password", urgency: 8, theft: 32, style: 0, label: "password" },
  { phrase: "suspended", urgency: 16, theft: 4, style: 4, label: "suspended" },
  { phrase: "перевод", urgency: 16, theft: 12, style: 0, label: "перевод" },
  { phrase: "пароль", urgency: 8, theft: 32, style: 0, label: "пароль" },
  { phrase: "срочно", urgency: 18, theft: 0, style: 0, label: "срочно" },
  { phrase: "штраф", urgency: 16, theft: 0, style: 0, label: "штраф" },
  { phrase: "havale", urgency: 16, theft: 12, style: 0, label: "havale" },
  { phrase: "şifreniz", urgency: 6, theft: 34, style: 0, label: "şifreniz" },
  { phrase: "təcili", urgency: 16, theft: 0, style: 0, label: "təcili" },
  { phrase: "cərimə", urgency: 16, theft: 0, style: 0, label: "cərimə" },
  { phrase: "dərhal", urgency: 14, theft: 0, style: 0, label: "dərhal" },
  { phrase: "urgent", urgency: 18, theft: 0, style: 0, label: "urgent" },
  { phrase: "hemen", urgency: 16, theft: 0, style: 0, label: "hemen" },
  { phrase: "acil", urgency: 16, theft: 0, style: 0, label: "acil" },
  { phrase: "bloke", urgency: 16, theft: 4, style: 4, label: "bloke" },
  { phrase: "şifrə", urgency: 8, theft: 32, style: 0, label: "şifrə" },
  { phrase: "parol", urgency: 8, theft: 32, style: 0, label: "parol" },
  { phrase: "otp", urgency: 8, theft: 30, style: 0, label: "OTP" },
  { phrase: "pul", urgency: 10, theft: 16, style: 0, label: "pul" },
  { phrase: "kocur", urgency: 12, theft: 18, style: 0, label: "köçürmə" },
  { phrase: "kart", urgency: 8, theft: 20, style: 0, label: "kart" },
  { phrase: "hesab", urgency: 8, theft: 14, style: 0, label: "hesab" },
  { phrase: "iban", urgency: 6, theft: 22, style: 0, label: "IBAN" },
  { phrase: "bank", urgency: 8, theft: 14, style: 0, label: "bank" },
  { phrase: "dollar", urgency: 8, theft: 16, style: 0, label: "dollar" },
  { phrase: "manat", urgency: 8, theft: 14, style: 0, label: "manat" },
  { phrase: "azn", urgency: 8, theft: 12, style: 0, label: "AZN" },
  { phrase: "usd", urgency: 8, theft: 12, style: 0, label: "USD" },
  { phrase: "pay", urgency: 10, theft: 12, style: 0, label: "pay" },
  { phrase: "wire", urgency: 12, theft: 14, style: 0, label: "wire" },
  { phrase: "send", urgency: 10, theft: 12, style: 0, label: "send" },
  { phrase: "money", urgency: 10, theft: 16, style: 0, label: "money" },
  { phrase: "account", urgency: 8, theft: 16, style: 0, label: "account" },
  { phrase: "transfer", urgency: 12, theft: 16, style: 0, label: "transfer" },
  { phrase: "cash", urgency: 8, theft: 12, style: 0, label: "cash" },
  { phrase: "para", urgency: 10, theft: 14, style: 0, label: "para" },
  { phrase: "gonder", urgency: 10, theft: 14, style: 0, label: "göndər" },
  { phrase: "деньги", urgency: 10, theft: 16, style: 0, label: "деньги" },
  { phrase: "карт", urgency: 8, theft: 16, style: 0, label: "карт" },
  { phrase: "счет", urgency: 8, theft: 14, style: 0, label: "счет" },
  { phrase: "счёт", urgency: 8, theft: 14, style: 0, label: "счёт" },
  { phrase: "tez", urgency: 16, theft: 0, style: 4, label: "tez" },
  { phrase: "tecili", urgency: 16, theft: 0, style: 0, label: "təcili" },
  { phrase: "derhal", urgency: 14, theft: 0, style: 0, label: "dərhal" },
  { phrase: "pls", urgency: 14, theft: 0, style: 8, label: "pls" },
  { phrase: "please", urgency: 10, theft: 0, style: 4, label: "please" },
  { phrase: "asap", urgency: 16, theft: 0, style: 6, label: "asap" },
  { phrase: "now", urgency: 12, theft: 0, style: 0, label: "now" },
  { phrase: "cerime", urgency: 16, theft: 0, style: 8, label: "cərimə" },
  { phrase: "serefsiz", urgency: 8, theft: 0, style: 28, label: "şərəfsiz" },
  { phrase: "mehkeme", urgency: 14, theft: 0, style: 12, label: "məhkəmə" },
  { phrase: "polis", urgency: 14, theft: 0, style: 10, label: "polis" },
  { phrase: "hebs", urgency: 16, theft: 0, style: 12, label: "həbs" },
  { phrase: "kod", urgency: 6, theft: 24, style: 0, label: "kod" },
  { phrase: "sifre", urgency: 6, theft: 30, style: 0, label: "şifrə" },
  { phrase: "pin", urgency: 6, theft: 28, style: 0, label: "PIN" },
  { phrase: "cvv", urgency: 4, theft: 34, style: 0, label: "CVV" },
  { phrase: "verify", urgency: 12, theft: 16, style: 0, label: "verify" },
  { phrase: "login", urgency: 8, theft: 18, style: 0, label: "login" },
  { phrase: "confirm", urgency: 10, theft: 12, style: 0, label: "confirm" },
  { phrase: "код", urgency: 6, theft: 24, style: 0, label: "код" },
];

const UPPER_MAP: Record<string, string> = {
  Ə: "ə",
  Ö: "ö",
  Ü: "ü",
  Ş: "ş",
  Ğ: "ğ",
  Ç: "ç",
};

export function foldAz(value: string): string {
  let folded = "";
  for (const char of value) {
    if (char === "I" || char === "İ" || char === "ı" || char === "i") {
      folded += "i";
      continue;
    }
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

const LATIN_STRIP: Record<string, string> = {
  ə: "e",
  ş: "s",
  ç: "c",
  ğ: "g",
  ö: "o",
  ü: "u",
  ı: "i",
};

export function normalizeText(value: string): string {
  const folded = foldAz(value);
  let normalized = "";
  for (const char of folded) normalized += LATIN_STRIP[char] ?? char;
  return normalized;
}

const ORDERED = [...SIGNALS]
  .map((signal) => ({ ...signal, phrase: normalizeText(signal.phrase) }))
  .sort((a, b) => b.phrase.length - a.phrase.length);

const PREFIX_ROOTS = new Set([
  "kocur",
  "kart",
  "hesab",
  "dollar",
  "manat",
  "send",
  "money",
  "account",
  "transfer",
  "gonder",
  "para",
  "wire",
  "cash",
  "bank",
  "serefsiz",
  "cerime",
  "mehkeme",
  "sifre",
  "parol",
  "verify",
  "login",
  "confirm",
  "pul",
  "tez",
  "pay",
  "kod",
  "otp",
  "tecili",
]);

function isLetter(char: string | undefined): boolean {
  if (!char) return false;
  return /\p{L}/u.test(char);
}

function wordEnd(folded: string, index: number): number {
  let end = index;
  while (end < folded.length && isLetter(folded[end])) end += 1;
  return end;
}

function matchAt(folded: string, index: number, phrase: string): boolean {
  if (!folded.startsWith(phrase, index)) return false;
  if (index > 0 && isLetter(folded[index - 1])) return false;
  const next = folded[index + phrase.length];
  if (!isLetter(next)) return true;
  if (phrase.length <= 3 && !PREFIX_ROOTS.has(phrase)) return false;
  const word = folded.slice(index, wordEnd(folded, index));
  if (phrase === "hesab" && word.startsWith("hesabat")) return false;
  return true;
}

interface Hit {
  signal: Signal;
  start: number;
  end: number;
}

function findHits(text: string): Hit[] {
  const folded = normalizeText(text);
  const hits: Hit[] = [];
  let index = 0;
  while (index < folded.length) {
    const signal = ORDERED.find((item) => matchAt(folded, index, item.phrase));
    if (!signal) {
      index += 1;
      continue;
    }
    const end = isLetter(folded[index + signal.phrase.length]) ? wordEnd(folded, index) : index + signal.phrase.length;
    hits.push({ signal, start: index, end });
    index = Math.max(index + 1, end);
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
  /teyid|login|secure|update|kocurme|kuryer|sifre|parol|otp|verify|blok|hesab-yenile|account|wire|password|bezopas/;
const BRAND_HOST = /vergi|bank|gov|asan|maliyye|edovlet|kapital/;
const BAD_TLD = /\.(xyz|top|tk|gq|ml|cf|click|info|zip|rest|cam|buzz|quest)$/i;
const SHORTENER = /^(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rb\.gy|tiny\.cc)$/i;

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
  const hasLatin = /[a-z]/i.test(host);
  const hasCyrillic = /[\u0400-\u04FF]/.test(host);
  if (hasLatin && hasCyrillic) {
    score += 44;
    reasons.push("Kiril və latın hərfləri qarışdırılmış saxta domen.");
  } else if (host.includes("xn--") || hasCyrillic) {
    score += 36;
    reasons.push("Oxşar hərf dəyişikliyi: punycode və ya kiril simvol maskalanması.");
  }
  if (SHORTENER.test(host)) {
    score += 58;
    reasons.push("Qısaldılmış keçid (bit.ly və ya oxşarı) hədəfi gizlədir.");
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

const URL_IN_TEXT =
  /(?:https?:\/\/|www\.)[^\s<>"')\]]+|bit\.ly\/[^\s<>"')\]]+|t\.co\/[^\s<>"')\]]+|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-z0-9-]+\.)+(?:xyz|top|click|info|tk|gq|ml|cf|zip|rest|buzz|quest)(?:\/[^\s<>"')\]]*)?/gi;

function collectUrls(text: string, url: string): string[] {
  const found: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim().replace(/[.,;]+$/, "");
    if (trimmed && !found.includes(trimmed)) found.push(trimmed);
  };
  push(url);
  for (const match of text.matchAll(URL_IN_TEXT)) push(match[0]);
  return found;
}

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

interface Marker {
  start: number;
  end: number;
  label: string;
  theft: number;
  style: number;
}

function findMarkers(text: string): Marker[] {
  const markers: Marker[] = [];
  const cardPattern = /\b(?:\d{4}[ -]){3}\d{1,7}\b|\b\d{13,19}\b/g;
  for (const match of text.matchAll(cardPattern)) {
    const digits = match[0].replace(/\D/g, "");
    if (!luhnValid(digits) || match.index === undefined) continue;
    markers.push({ start: match.index, end: match.index + match[0].length, label: "bank kartı nömrəsi", theft: 42, style: 0 });
  }
  const ibanPattern = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi;
  for (const match of text.matchAll(ibanPattern)) {
    if (match.index === undefined || match[0].length < 15 || match[0].length > 34) continue;
    markers.push({ start: match.index, end: match.index + match[0].length, label: "IBAN", theft: 36, style: 0 });
  }
  const codePattern =
    /(?:birdəfəlik kod|verification code|one-time code|doğrulama kodu|kod təsdiq|код подтверждения|otp)\s*[:\-]?\s*\d{4,8}/gi;
  for (const match of text.matchAll(codePattern)) {
    if (match.index === undefined) continue;
    markers.push({ start: match.index, end: match.index + match[0].length, label: "OTP kod tələbi", theft: 18, style: 0 });
  }
  const normalized = normalizeText(text);
  const amountPattern = /\d+\s*(?:dollar|usd|azn|manat|tl|rub|\$|€)/gi;
  for (const match of normalized.matchAll(amountPattern)) {
    if (match.index === undefined) continue;
    markers.push({
      start: match.index,
      end: match.index + match[0].length,
      label: "məbləğ və valyuta",
      theft: 8,
      style: 0,
    });
  }
  return markers;
}

const MONEY_ROOT = /pul|kocur|kart|hesab|iban|bank|dollar|manat|azn|usd|send|money|account|transfer|pay|cash|wire|para|gonder|перевод|карт|счет|счёт|деньг/;
const PRESSURE_ROOT = /tez|tecili|derhal|pls|please|asap|urgent|immediately|now|срочно|acil|hemen|bloklan|cerime|serefsiz|mehkeme|polis|hebs/;
const THEFT_ROOT = /kod|otp|sifre|parol|pin|cvv|verify|login|confirm|код|парол/;

function intentProfile(signals: Signal[], markers: Marker[]) {
  let money = 0;
  let pressure = 0;
  let theft = 0;
  for (const signal of signals) {
    const phrase = signal.phrase;
    if (MONEY_ROOT.test(phrase)) money += 1;
    if (PRESSURE_ROOT.test(phrase)) pressure += 1;
    if (THEFT_ROOT.test(phrase)) theft += 1;
  }
  const amount = markers.some((marker) => marker.label === "məbləğ və valyuta");
  const moneyRequest = money >= 2 || (money >= 1 && amount);
  const intents: string[] = [];
  let floor = 0;
  if (moneyRequest) {
    floor = 74 + Math.min(14, money * 3 + (amount ? 5 : 0) + pressure * 2);
    if (pressure >= 1 && money >= 1) floor = Math.max(floor, 80);
    floor = Math.min(88, Math.max(72, floor));
    intents.push("Maliyyə / Kart Köçürmə Tələbi Niyyəti Aşkarlandı");
  }
  if (pressure >= 1) intents.push("Tələskənlik, təzyiq və aqressiya niyyəti aşkarlandı");
  if (theft >= 1) intents.push("Məlumat və OTP oğurluğu niyyəti aşkarlandı");
  return { money, pressure, theft, amount, floor, intents };
}

function styleExtras(text: string, folded: string, urgency: number): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const exclamations = text.match(/!/g)?.length ?? 0;
  if (exclamations >= 3) {
    score += 18;
    reasons.push("Həddindən artıq nida işarəsi (`!!!`) ilə təzyiq yaradılır.");
  } else if (exclamations === 2) {
    score += 8;
  }
  const generic =
    folded.includes("hörmətli müştəri") ||
    folded.includes("dear customer") ||
    folded.includes("уважаемый клиент") ||
    folded.includes("sayin müştəri") ||
    folded.includes("sayin müşteri");
  if (generic && urgency >= 20) {
    score += 28;
    reasons.push("Ümumi müştəri müraciəti təhlükə dili ilə birləşir.");
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

function buildHighlights(text: string, markers: Marker[]): TextPart[] {
  const spans = [
    ...findHits(text).map((hit) => ({ start: hit.start, end: hit.end })),
    ...markers.map((marker) => ({ start: marker.start, end: marker.end })),
  ].sort((left, right) => left.start - right.start || right.end - left.end);
  const merged: { start: number; end: number }[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (!last || span.start > last.end) merged.push({ start: span.start, end: span.end });
    else last.end = Math.max(last.end, span.end);
  }
  if (merged.length === 0) return [{ text, hit: false }];
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const span of merged) {
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start), hit: false });
    parts.push({ text: text.slice(span.start, span.end), hit: true });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

export function analyzePhishing(text: string, url: string): PhishingReport {
  const hits = findHits(text);
  const signals = uniqueSignals(hits);
  const markers = findMarkers(text);
  const repeats = Math.max(0, hits.length - signals.length);

  let urgency = signals.reduce((sum, signal) => sum + signal.urgency, 0) + repeats * 3;
  let theft = signals.reduce((sum, signal) => sum + signal.theft, 0) + markers.reduce((sum, marker) => sum + marker.theft, 0);
  let style = signals.reduce((sum, signal) => sum + signal.style, 0);
  urgency = clamp(urgency);
  theft = clamp(theft);

  const folded = foldAz(text);
  const extras = styleExtras(text, folded, urgency);
  style = clamp(style + extras.score);

  const urls = collectUrls(text, url);
  const domainReports = urls.map((item) => analyzeDomain(item));
  const domain = domainReports.reduce(
    (best, item) => (item.score > best.score ? item : best),
    domainReports[0] ?? { score: 0, reasons: ["Keçid daxil edilməyib, domen riski sıfır qəbul edildi."], analyzedUrl: "" },
  );

  let overall = urgency * 0.36 + domain.score * 0.3 + style * 0.16 + theft * 0.18;
  if (urgency >= 45 && domain.score >= 40) overall += 10;
  if (theft >= 28 && (urgency >= 24 || domain.score >= 40)) overall += 6;
  if (markers.some((marker) => marker.label === "bank kartı nömrəsi" || marker.label === "IBAN")) overall += 8;
  if (urgency < 12 && domain.score < 15 && theft < 12 && style < 18) overall = Math.min(overall, 8);
  if (text.trim().length < 12 && domain.score >= 50) overall = Math.max(overall, domain.score * 0.8);
  overall = clamp(Math.round(overall));

  const intent = intentProfile(signals, markers);
  if (domain.score >= 40) intent.intents.push("Saxta domen və ya şübhəli keçid aşkarlandı");
  if (intent.floor > 0) overall = clamp(Math.max(overall, intent.floor));
  if (intent.floor >= 72) {
    urgency = clamp(Math.max(urgency, 64));
    theft = clamp(Math.max(theft, 58));
    if (intent.pressure >= 1) style = clamp(Math.max(style, 36));
  }

  const quarantine = overall >= 70 ? "alindi" : overall >= 40 ? "nezaret" : "tehlukesiz";
  const findings = [
    ...intent.intents,
    ...signals.map((signal) => `Təzyiq və ya oğurluq sözü: «${signal.label}».`),
    ...markers.map((marker) => `Həssas məlumat izi: ${marker.label}.`),
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
    highlights: buildHighlights(text, markers),
    matchedTerms: [...signals.map((signal) => signal.label), ...markers.map((marker) => marker.label)],
    findings,
    analyzedUrl: domain.analyzedUrl,
    intents: intent.intents,
  };
}
