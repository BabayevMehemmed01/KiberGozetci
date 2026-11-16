import { clamp } from "./utils.ts";

export interface TextPart {
  text: string;
  hit: boolean;
}

export interface AttackTechnique {
  code: string;
  name: string;
}

export interface IntentVector {
  id: "V1" | "V2" | "V3" | "V4";
  name: string;
  score: number;
  base: number;
  terms: string[];
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
  techniques: AttackTechnique[];
  critical: boolean;
  vectors: IntentVector[];
  reasoning: string[];
  payloadCarrier: boolean;
  obfuscated: boolean;
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
  { phrase: "pul yatir", urgency: 22, theft: 20, style: 8, label: "pul yatır" },
  { phrase: "delete account", urgency: 24, theft: 14, style: 10, label: "delete account" },
  { phrase: "ish teklifi", urgency: 18, theft: 10, style: 6, label: "iş təklifi" },
  { phrase: "is teklifi", urgency: 18, theft: 10, style: 6, label: "iş təklifi" },
  { phrase: "cv gonder", urgency: 18, theft: 12, style: 6, label: "CV göndər" },
  { phrase: "bitcoin", urgency: 18, theft: 16, style: 6, label: "bitcoin" },
  { phrase: "crypto", urgency: 18, theft: 14, style: 6, label: "crypto" },
  { phrase: "invest", urgency: 16, theft: 12, style: 4, label: "invest" },
  { phrase: "qazanc", urgency: 16, theft: 14, style: 6, label: "qazanc" },
  { phrase: "bonus", urgency: 12, theft: 8, style: 4, label: "bonus" },
  { phrase: "silinecek", urgency: 22, theft: 8, style: 10, label: "silinəcək" },
  { phrase: "baglanacaq", urgency: 22, theft: 8, style: 10, label: "bağlanacaq" },
  { phrase: "deaktiv", urgency: 18, theft: 8, style: 8, label: "deaktiv" },
  { phrase: "terminate", urgency: 20, theft: 8, style: 8, label: "terminate" },
  { phrase: "vakansiya", urgency: 16, theft: 10, style: 4, label: "vakansiya" },
  { phrase: "interview", urgency: 12, theft: 8, style: 4, label: "interview" },
  { phrase: "salary", urgency: 12, theft: 10, style: 4, label: "salary" },
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
  if (phrase === "invest" && !investWord(word)) return false;
  return true;
}

function investWord(word: string): boolean {
  return word === "invest" || word.startsWith("investisi") || word.startsWith("investment") || word.startsWith("investor");
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
const WHITELIST = ["sirket.az", "google.com", "gov.az"];

function compactName(host: string): string {
  const labels = host.replace(/^www\./, "").split(".").filter(Boolean);
  return labels.slice(0, -1).join("").replace(/-/g, "");
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 0; row < left.length; row += 1) {
    const next = [row + 1];
    for (let column = 0; column < right.length; column += 1) {
      const cost = left[row] === right[column] ? 0 : 1;
      next.push(Math.min(next[column] + 1, previous[column + 1] + 1, previous[column] + cost));
    }
    previous = next;
  }
  return previous[right.length];
}

function isWhitelisted(host: string): boolean {
  const bare = host.replace(/^www\./, "");
  return WHITELIST.some((brand) => bare === brand || bare.endsWith(`.${brand}`));
}

function typosquatDistance(host: string): number | null {
  if (isWhitelisted(host)) return null;
  const name = compactName(host);
  if (!name) return null;
  let best = Number.POSITIVE_INFINITY;
  for (const brand of WHITELIST) {
    const brandName = compactName(brand);
    const brandAll = brand.replace(/[-.]/g, "");
    best = Math.min(best, levenshtein(name, brandName), levenshtein(name, brandAll));
  }
  return best <= 2 ? best : null;
}

function unknownDomainScore(host: string): number {
  let hash = 2166136261;
  for (let index = 0; index < host.length; index += 1) {
    hash ^= host.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 15 + ((hash >>> 0) % 11);
}

function analyzeDomain(rawUrl: string): { score: number; reasons: string[]; analyzedUrl: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { score: 0, reasons: ["Keçid daxil edilməyib, domen riski sıfır qəbul edildi."], analyzedUrl: "" };
  }

  let score = 0;
  const reasons: string[] = [];
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let host = "";
  let pathname = "";

  try {
    const url = new URL(withProtocol);
    host = url.hostname.toLowerCase();
    pathname = url.pathname.toLowerCase();
  } catch {
    score += 24;
    reasons.push("Keçid ünvanı standart formata uyğun deyil.");
    return { score, reasons, analyzedUrl: trimmed };
  }

  const trustedHost = isWhitelisted(host);
  const suspiciousToken = SUSPICIOUS_HOST.test(host);
  const ipHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  const payloadFile = /\.(?:exe|scr|zip|apk|php)$/i.test(pathname);
  if (payloadFile) {
    score += 70;
    reasons.push("Keçidin sonunda icra, arxiv və ya skript uzantısı var (.exe, .scr, .zip, .apk, .php).");
  }

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
  const lookalike = typosquatDistance(host);
  if (lookalike !== null) {
    const lookalikeScore = 22 - lookalike * 2;
    score = Math.max(score, lookalikeScore);
    reasons.push("Defis və nöqtə silindikdən sonra domen ağ siyahıdakı ada Levenshtein məsafəsi ilə oxşayır.");
  }
  if (trustedHost && !suspiciousToken && !ipHost && lookalike === null && !payloadFile) {
    return {
      score: 0,
      reasons: ["Keçid etibarlı daxili və ya rəsmi domenə aparır."],
      analyzedUrl: trimmed,
    };
  }
  if (!trustedHost && score < 15) {
    score = unknownDomainScore(host);
    reasons.push("Naməlum/Yoxlanılmamış domen. Ağ siyahıda olmadığı üçün baza riski tətbiq edildi.");
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
    floor = 84 + Math.min(14, money * 3 + (amount ? 5 : 0) + pressure * 2);
    floor = Math.min(98, Math.max(84, floor));
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

type WallKind = "blackmail" | "money" | "credential" | "malware" | "impersonation" | "pressure";
type WallRole = "strong" | "media" | "channel" | "paired" | "weak" | "normal";

interface WallRoot {
  root: string;
  kind: WallKind;
  role: WallRole;
  prefix: boolean;
}

interface WallHit {
  kind: WallKind;
  role: WallRole;
  start: number;
  end: number;
  root: string;
}

function wallRoot(root: string, kind: WallKind, role: WallRole, prefix = root.length >= 4): WallRoot {
  return { root, kind, role, prefix };
}

const SHORT_PREFIX = new Set(["pin", "kod", "otp", "pay", "pul", "tez", "код"]);

const WALL_ROOTS: WallRoot[] = [
  wallRoot("hec kime deme", "pressure", "normal"),
  wallRoot("enable content", "malware", "strong"),
  wallRoot("fayli ac", "malware", "strong"),
  wallRoot("senedi yukle", "malware", "strong"),
  wallRoot("it support", "impersonation", "normal"),
  wallRoot("paylasacam", "blackmail", "strong"),
  wallRoot("yayacam", "blackmail", "strong"),
  wallRoot("blackmail", "blackmail", "strong"),
  wallRoot("compromise", "blackmail", "strong"),
  wallRoot("instagram", "blackmail", "channel"),
  wallRoot("telegram", "blackmail", "channel"),
  wallRoot("whatsapp", "blackmail", "channel"),
  wallRoot("immediately", "pressure", "normal"),
  wallRoot("shantaj", "blackmail", "strong"),
  wallRoot("santaj", "blackmail", "strong"),
  wallRoot("webcam", "blackmail", "strong"),
  wallRoot("expose", "blackmail", "strong"),
  wallRoot("goruntu", "blackmail", "media"),
  wallRoot("ifsaa", "blackmail", "strong"),
  wallRoot("biabir", "blackmail", "strong"),
  wallRoot("invoice", "money", "normal"),
  wallRoot("faktura", "money", "normal"),
  wallRoot("attachment", "malware", "weak"),
  wallRoot("download", "malware", "weak"),
  wallRoot("direktor", "impersonation", "normal"),
  wallRoot("password", "credential", "strong"),
  wallRoot("suspend", "credential", "paired"),
  wallRoot("serefsiz", "pressure", "normal"),
  wallRoot("mehkeme", "impersonation", "normal"),
  wallRoot("whatsapp", "blackmail", "channel"),
  wallRoot("tiktok", "blackmail", "channel"),
  wallRoot("account", "money", "normal"),
  wallRoot("transfer", "money", "normal"),
  wallRoot("odenis", "money", "normal"),
  wallRoot("rehber", "impersonation", "normal"),
  wallRoot("verify", "credential", "paired"),
  wallRoot("login", "credential", "paired"),
  wallRoot("reset", "credential", "paired"),
  wallRoot("urgent", "pressure", "normal"),
  wallRoot("please", "pressure", "normal"),
  wallRoot("gonder", "money", "normal"),
  wallRoot("dollar", "money", "normal"),
  wallRoot("manat", "money", "normal"),
  wallRoot("money", "money", "normal"),
  wallRoot("nude", "blackmail", "strong"),
  wallRoot("photo", "blackmail", "media"),
  wallRoot("sekil", "blackmail", "media"),
  wallRoot("share", "blackmail", "channel"),
  wallRoot("leak", "blackmail", "strong"),
  wallRoot("ifsa", "blackmail", "strong"),
  wallRoot("video", "blackmail", "media"),
  wallRoot("macro", "malware", "strong"),
  wallRoot("quick", "pressure", "normal"),
  wallRoot("gizli", "pressure", "normal"),
  wallRoot("derhal", "pressure", "normal"),
  wallRoot("tecili", "pressure", "normal"),
  wallRoot("cerime", "pressure", "normal"),
  wallRoot("hebs", "pressure", "normal"),
  wallRoot("vergi", "impersonation", "normal"),
  wallRoot("polis", "impersonation", "normal"),
  wallRoot("admin", "impersonation", "normal"),
  wallRoot("kocur", "money", "normal"),
  wallRoot("hesab", "money", "normal"),
  wallRoot("kart", "money", "normal"),
  wallRoot("bank", "money", "normal"),
  wallRoot("send", "money", "normal"),
  wallRoot("cash", "money", "normal"),
  wallRoot("wire", "money", "normal"),
  wallRoot("para", "money", "normal"),
  wallRoot("iban", "money", "normal"),
  wallRoot("sifre", "credential", "strong"),
  wallRoot("parol", "credential", "strong"),
  wallRoot("blok", "credential", "paired"),
  wallRoot("asap", "pressure", "normal"),
  wallRoot("now", "pressure", "normal", false),
  wallRoot("pls", "pressure", "normal", false),
  wallRoot("tez", "pressure", "normal", true),
  wallRoot("pul", "money", "normal", true),
  wallRoot("pay", "money", "normal", true),
  wallRoot("kod", "credential", "strong", true),
  wallRoot("otp", "credential", "strong", true),
  wallRoot("pin", "credential", "strong", true),
  wallRoot("cvv", "credential", "strong", false),
  wallRoot("azn", "money", "normal", false),
  wallRoot("usd", "money", "normal", false),
  wallRoot("ceo", "impersonation", "normal", false),
  wallRoot("hr", "impersonation", "normal", false),
  wallRoot("шантаж", "blackmail", "strong"),
  wallRoot("разошлю", "blackmail", "strong"),
  wallRoot("видео", "blackmail", "media"),
  wallRoot("слив", "blackmail", "strong"),
  wallRoot("деньги", "money", "normal"),
  wallRoot("перевод", "money", "normal"),
  wallRoot("карт", "money", "normal"),
  wallRoot("счет", "money", "normal"),
  wallRoot("счёт", "money", "normal"),
  wallRoot("пароль", "credential", "strong"),
  wallRoot("срочно", "pressure", "normal"),
  wallRoot("acil", "pressure", "normal"),
  wallRoot("hemen", "pressure", "normal"),
  wallRoot("код", "credential", "strong", true),
].map((item) => (SHORT_PREFIX.has(item.root) ? { ...item, prefix: true } : item));

function overlaps(taken: { start: number; end: number }[], start: number, end: number): boolean {
  return taken.some((span) => start < span.end && end > span.start);
}

function scanRoots(text: string, roots: WallRoot[]): WallHit[] {
  const ordered = [...roots].sort((left, right) => right.root.length - left.root.length);
  const taken: { start: number; end: number }[] = [];
  const hits: WallHit[] = [];
  for (const item of ordered) {
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(item.root, from);
      if (index < 0) break;
      const before = text[index - 1];
      const after = text[index + item.root.length];
      const word = text.slice(index, wordEnd(text, index));
      const end = item.prefix && isLetter(after) ? wordEnd(text, index) : index + item.root.length;
      const allowed = !isLetter(before) && (item.prefix || !isLetter(after)) && !(item.root === "hesab" && word.startsWith("hesabat"));
      if (allowed && !overlaps(taken, index, end)) {
        taken.push({ start: index, end });
        hits.push({ kind: item.kind, role: item.role, start: index, end, root: item.root });
      }
      from = index + Math.max(1, item.root.length);
    }
  }
  return hits;
}

function scanExtensions(text: string): WallHit[] {
  const hits: WallHit[] = [];
  for (const match of text.matchAll(/\.(?:exe|zip|rar|scr|apk|bat)(?!\p{L})/giu)) {
    if (match.index === undefined) continue;
    hits.push({
      kind: "malware",
      role: "strong",
      start: match.index,
      end: match.index + match[0].length,
      root: match[0].toLowerCase(),
    });
  }
  return hits;
}

function assessCyberWall(text: string, markers: Marker[]) {
  const hits = [...scanExtensions(text), ...scanRoots(text, WALL_ROOTS)];
  const count = (kind: WallKind, role?: WallRole) => hits.filter((hit) => hit.kind === kind && (role === undefined || hit.role === role)).length;
  const amount = markers.some((marker) => marker.label === "məbləğ və valyuta");
  const card = markers.some((marker) => marker.label === "bank kartı nömrəsi" || marker.label === "IBAN");
  const otpMarker = markers.some((marker) => marker.label === "OTP kod tələbi");
  const blackmail = count("blackmail");
  const money = count("money");
  const pressure = count("pressure");
  const impersonation = count("impersonation");
  const strongBlackmail = count("blackmail", "strong");
  const media = count("blackmail", "media");
  const channel = count("blackmail", "channel");
  const strongCredential = count("credential", "strong");
  const pairedCredential = count("credential", "paired");
  const malwareStrong = count("malware", "strong");
  const malwareWeak = count("malware", "weak");
  const blackmailHard = strongBlackmail > 0 || (media > 0 && channel > 0);
  const moneyHard = card || money >= 2 || (money >= 1 && (amount || pressure >= 1)) || (amount && pressure >= 1);
  const credentialHard = strongCredential > 0 || otpMarker || (pairedCredential > 0 && (pressure >= 1 || pairedCredential >= 2));
  const malwareHard = malwareStrong > 0 || (malwareWeak >= 2) || (malwareWeak > 0 && (pressure >= 1 || moneyHard || credentialHard || blackmailHard));
  const forced = blackmailHard || moneyHard || credentialHard || malwareHard;
  const impersonationActive = impersonation >= 2 || (impersonation >= 1 && (forced || pressure >= 1));
  const showPressure = pressure >= 1 && (forced || impersonationActive || pressure >= 2);
  const intents: string[] = [];
  if (blackmailHard) intents.push("Şantaj, hədə və məxfilik pozuntusu niyyəti aşkarlandı");
  if (moneyHard) intents.push("Maliyyə / Kart Köçürmə Tələbi Niyyəti Aşkarlandı");
  if (credentialHard) intents.push("Məlumat və OTP oğurluğu niyyəti aşkarlandı");
  if (malwareHard) intents.push("Zərərli fayl və texniki tələ niyyəti aşkarlandı");
  if (impersonationActive) intents.push("Rəhbər və ya qurum təqlidi niyyəti aşkarlandı");
  if (showPressure) intents.push("Tələskənlik, təzyiq və aqressiya niyyəti aşkarlandı");
  const visible = new Set<WallKind>();
  if (blackmailHard) visible.add("blackmail");
  if (moneyHard || forced) visible.add("money");
  if (credentialHard || forced) visible.add("credential");
  if (malwareHard) visible.add("malware");
  if (impersonationActive) visible.add("impersonation");
  if (showPressure || forced) visible.add("pressure");
  if (!forced && !impersonationActive) visible.clear();
  const spans = hits.filter((hit) => visible.has(hit.kind)).map((hit) => ({ start: hit.start, end: hit.end }));
  const labels = hits.filter((hit) => visible.has(hit.kind)).map((hit) => hit.root);
  const techniques: AttackTechnique[] = [];
  if (blackmailHard || impersonationActive) techniques.push({ code: "T1656", name: "Impersonation" });
  if (moneyHard || credentialHard) techniques.push({ code: "T1566", name: "Phishing" });
  if (malwareHard) techniques.push({ code: "T1486", name: "Data Encrypted for Impact" });
  let floor = 0;
  if (forced) {
    const weight = blackmail * 4 + money * 3 + (strongCredential + pairedCredential) * 3 + pressure * 2 + (amount || card ? 5 : 0) + (malwareHard ? 4 : 0);
    floor = Math.min(98, 84 + Math.min(14, weight));
  }
  return { floor, forced, intents, spans, labels, techniques, pressure };
}

function buildHighlights(text: string, markers: Marker[], extra: { start: number; end: number }[] = []): TextPart[] {
  const spans = [
    ...findHits(text).map((hit) => ({ start: hit.start, end: hit.end })),
    ...markers.map((marker) => ({ start: marker.start, end: marker.end })),
    ...extra,
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

type LureKind = "crypto" | "recruit" | "deletion";

interface LureRoot {
  phrase: string;
  kind: LureKind;
  label: string;
}

const LURE_ROOTS: LureRoot[] = [
  { phrase: "pul yatir", kind: "crypto", label: "pul yatır" },
  { phrase: "delete account", kind: "deletion", label: "delete account" },
  { phrase: "ish teklifi", kind: "recruit", label: "iş təklifi" },
  { phrase: "is teklifi", kind: "recruit", label: "iş təklifi" },
  { phrase: "cv gonder", kind: "recruit", label: "CV göndər" },
  { phrase: "bitcoin", kind: "crypto", label: "bitcoin" },
  { phrase: "crypto", kind: "crypto", label: "crypto" },
  { phrase: "invest", kind: "crypto", label: "invest" },
  { phrase: "qazanc", kind: "crypto", label: "qazanc" },
  { phrase: "bonus", kind: "crypto", label: "bonus" },
  { phrase: "silinecek", kind: "deletion", label: "silinəcək" },
  { phrase: "baglanacaq", kind: "deletion", label: "bağlanacaq" },
  { phrase: "deaktiv", kind: "deletion", label: "deaktiv" },
  { phrase: "terminate", kind: "deletion", label: "terminate" },
  { phrase: "vakansiya", kind: "recruit", label: "vakansiya" },
  { phrase: "interview", kind: "recruit", label: "interview" },
  { phrase: "salary", kind: "recruit", label: "salary" },
];

function lureEnd(text: string, index: number, phrase: string): number | null {
  if (!text.startsWith(phrase, index)) return null;
  if (index > 0 && isLetter(text[index - 1])) return null;
  if (phrase === "invest" && !investWord(text.slice(index, wordEnd(text, index)))) return null;
  const base = index + phrase.length;
  return isLetter(text[base]) ? wordEnd(text, base) : base;
}

function assessLures(text: string) {
  const ordered = [...LURE_ROOTS].sort((left, right) => right.phrase.length - left.phrase.length);
  const taken: { start: number; end: number }[] = [];
  const hits: { kind: LureKind; label: string; phrase: string; start: number; end: number }[] = [];
  for (const item of ordered) {
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(item.phrase, from);
      if (index < 0) break;
      const end = lureEnd(text, index, item.phrase);
      if (end !== null && !overlaps(taken, index, end)) {
        taken.push({ start: index, end });
        hits.push({ kind: item.kind, label: item.label, phrase: item.phrase, start: index, end });
      }
      from = index + Math.max(1, item.phrase.length);
    }
  }
  const phrases = new Set(hits.map((hit) => hit.phrase));
  const kinds = new Set(hits.map((hit) => hit.kind));
  const cryptoStrong = ["bitcoin", "crypto", "pul yatir", "qazanc", "invest"].filter((phrase) => phrases.has(phrase)).length;
  const recruitStrong = ["vakansiya", "ish teklifi", "is teklifi", "cv gonder"].filter((phrase) => phrases.has(phrase)).length;
  const recruitWeak = ["interview", "salary"].filter((phrase) => phrases.has(phrase)).length;
  let floor = 0;
  if (cryptoStrong >= 2 || (cryptoStrong >= 1 && phrases.has("bonus"))) floor = 90;
  else if (cryptoStrong === 1) floor = 78;
  else if (phrases.has("bonus")) floor = 54;
  if (kinds.has("deletion")) floor = Math.max(floor, 88);
  if (recruitStrong >= 2 || phrases.has("cv gonder") || phrases.has("ish teklifi") || phrases.has("is teklifi")) floor = Math.max(floor, 86);
  else if (recruitStrong === 1) floor = Math.max(floor, 74);
  else if (recruitWeak >= 2) floor = Math.max(floor, 80);
  else if (recruitWeak === 1) floor = Math.max(floor, 58);
  if (kinds.size >= 2) floor = Math.max(floor, 90);
  const intents: string[] = [];
  if (kinds.has("crypto")) intents.push("Kripto, maliyyə piramidası və investisiya tələsi niyyəti aşkarlandı");
  if (kinds.has("recruit")) intents.push("Saxta iş təklifi və CV tələsi niyyəti aşkarlandı");
  if (kinds.has("deletion")) intents.push("Hədə-qorxu və hesabın silinməsi niyyəti aşkarlandı");
  const techniques: AttackTechnique[] = [];
  if (kinds.has("crypto")) techniques.push({ code: "T1204", name: "User Execution" });
  if (kinds.has("crypto") && cryptoStrong >= 1) techniques.push({ code: "T1566", name: "Phishing" });
  if (kinds.has("recruit")) {
    techniques.push({ code: "T1566", name: "Phishing" });
    techniques.push({ code: "T1204", name: "User Execution" });
  }
  if (kinds.has("deletion")) {
    techniques.push({ code: "T1534", name: "Internal Spearphishing" });
    techniques.push({ code: "T1566", name: "Phishing" });
  }
  return {
    floor,
    intents,
    techniques,
    spans: hits.map((hit) => ({ start: hit.start, end: hit.end })),
    labels: [...new Set(hits.map((hit) => hit.label))],
  };
}

const LEET: Record<string, string> = { "3": "e", "0": "o", "1": "i", "@": "a" };
const EVASIVE_PUNCT = /[.,_*/-]/;

interface CleanChar {
  ch: string;
  from: number;
}

function deobfuscate(raw: string): { text: string; origins: number[]; obfuscated: boolean } {
  const normalized = normalizeText(raw);
  const kept: CleanChar[] = [];
  let obfuscated = false;
  for (let index = 0; index < normalized.length; index += 1) {
    let ch = normalized[index] ?? "";
    const leet = LEET[ch];
    const prev = normalized[index - 1];
    const next = normalized[index + 1];
    const besideLetter = isLetter(prev) || isLetter(next);
    if (leet && besideLetter && ch !== "@") {
      ch = leet;
      obfuscated = true;
    } else if (ch === "@" && isLetter(prev) && isLetter(next)) {
      let email = false;
      for (let cursor = index; cursor >= 0 && normalized[cursor] !== " "; cursor -= 1) {
        if (normalized[cursor] === ".") email = true;
      }
      for (let cursor = index; cursor < normalized.length && normalized[cursor] !== " "; cursor += 1) {
        if (normalized[cursor] === ".") email = true;
      }
      if (!email) {
        ch = "a";
        obfuscated = true;
      }
    }
    if (EVASIVE_PUNCT.test(ch)) {
      const prev = normalized[index - 1];
      const next = normalized[index + 1];
      if (isLetter(prev) && isLetter(next)) obfuscated = true;
      continue;
    }
    kept.push({ ch, from: index });
  }
  const compact: CleanChar[] = [];
  for (const item of kept) {
    if (item.ch === " " || item.ch === "\n" || item.ch === "\t" || item.ch === "\r") {
      if (compact.length === 0 || compact[compact.length - 1]?.ch === " ") continue;
      compact.push({ ch: " ", from: item.from });
      continue;
    }
    compact.push(item);
  }
  const isolated = (index: number) => {
    const ch = compact[index]?.ch;
    if (!isLetter(ch)) return false;
    const prev = compact[index - 1]?.ch;
    const next = compact[index + 1]?.ch;
    return (index === 0 || prev === " ") && (next === undefined || next === " ");
  };
  const merged: CleanChar[] = [];
  let index = 0;
  while (index < compact.length) {
    if (isolated(index)) {
      const run = [compact[index]];
      let cursor = index;
      while (compact[cursor + 1]?.ch === " " && isolated(cursor + 2)) {
        run.push(compact[cursor + 2]);
        cursor += 2;
      }
      if (run.length >= 3) {
        obfuscated = true;
        merged.push(...run);
        index = cursor + 1;
        continue;
      }
    }
    const item = compact[index];
    if (item) merged.push(item);
    index += 1;
  }
  return {
    text: merged.map((item) => item.ch).join(""),
    origins: merged.map((item) => item.from),
    obfuscated,
  };
}

type VectorId = "V1" | "V2" | "V3" | "V4";

interface IntentTerm {
  vector: VectorId;
  term: string;
  label: string;
}

const INTENT_TERMS: IntentTerm[] = [
  { vector: "V1", term: "bitcoin", label: "bitcoin" },
  { vector: "V1", term: "crypto", label: "crypto" },
  { vector: "V1", term: "transfer", label: "transfer" },
  { vector: "V1", term: "usdt", label: "usdt" },
  { vector: "V1", term: "qazanc", label: "qazanc" },
  { vector: "V1", term: "invest", label: "invest" },
  { vector: "V1", term: "kocur", label: "köçürmə" },
  { vector: "V1", term: "gonder", label: "göndər" },
  { vector: "V1", term: "odenis", label: "ödəniş" },
  { vector: "V1", term: "money", label: "money" },
  { vector: "V1", term: "wire", label: "wire" },
  { vector: "V1", term: "kart", label: "kart" },
  { vector: "V1", term: "hesab", label: "hesab" },
  { vector: "V1", term: "pul", label: "pul" },
  { vector: "V1", term: "btc", label: "btc" },
  { vector: "V2", term: "immediately", label: "immediately" },
  { vector: "V2", term: "gecikmeden", label: "gecikmədən" },
  { vector: "V2", term: "blackmail", label: "blackmail" },
  { vector: "V2", term: "deadline", label: "deadline" },
  { vector: "V2", term: "shantaj", label: "şantaj" },
  { vector: "V2", term: "santaj", label: "şantaj" },
  { vector: "V2", term: "urgent", label: "urgent" },
  { vector: "V2", term: "tecili", label: "təcili" },
  { vector: "V2", term: "derhal", label: "dərhal" },
  { vector: "V2", term: "nude", label: "nude" },
  { vector: "V2", term: "ifsa", label: "ifşa" },
  { vector: "V2", term: "asap", label: "asap" },
  { vector: "V2", term: "tez", label: "tez" },
  { vector: "V3", term: "password", label: "password" },
  { vector: "V3", term: "tesdiq", label: "təsdiqlə" },
  { vector: "V3", term: "verify", label: "verify" },
  { vector: "V3", term: "klikle", label: "kliklə" },
  { vector: "V3", term: "login", label: "login" },
  { vector: "V3", term: "sifre", label: "şifrə" },
  { vector: "V3", term: "parol", label: "parol" },
  { vector: "V3", term: "klik", label: "klik" },
  { vector: "V3", term: "otp", label: "otp" },
  { vector: "V4", term: "direktor", label: "direktor" },
  { vector: "V4", term: "rehber", label: "rəhbər" },
  { vector: "V4", term: "admin", label: "admin" },
  { vector: "V4", term: "vergi", label: "vergi" },
  { vector: "V4", term: "polis", label: "polis" },
  { vector: "V4", term: "ceo", label: "ceo" },
];

const VECTOR_META: Record<VectorId, { name: string; base: number; code: string; technique: string }> = {
  V1: { name: "Financial/Crypto Request", base: 40, code: "T1566.002", technique: "Spearphishing Link" },
  V2: { name: "Urgency/Coercion", base: 30, code: "T1204", technique: "User Execution" },
  V3: { name: "Credential Theft/Action", base: 40, code: "T1566.002", technique: "Spearphishing Link" },
  V4: { name: "Authority/Impersonation", base: 20, code: "T1534", technique: "Internal Spearphishing" },
};

const BLACKMAIL_TERMS = new Set(["santaj", "shantaj", "ifsa", "nude", "blackmail"]);

function termHits(text: string, origins: number[], term: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf(term, from);
    if (index < 0) break;
    const before = text[index - 1];
    const after = text[index + term.length];
    const word = text.slice(index, wordEnd(text, index));
    const prefix = term.length >= 4 || term === "pul" || term === "tez";
    const allowed = !isLetter(before) && (prefix || !isLetter(after)) && !(term === "hesab" && word.startsWith("hesabat")) && !(term === "invest" && !investWord(word));
    if (allowed) {
      const originStart = origins[index];
      const originEnd = origins[index + term.length - 1];
      if (originStart !== undefined && originEnd !== undefined) spans.push({ start: originStart, end: originEnd + 1 });
    }
    from = index + Math.max(1, term.length);
  }
  return spans;
}

function assessIntent(raw: string, hasUrl: boolean) {
  const cleaned = deobfuscate(raw);
  const grouped: Record<VectorId, { labels: string[]; spans: { start: number; end: number }[]; blackmail: number }> = {
    V1: { labels: [], spans: [], blackmail: 0 },
    V2: { labels: [], spans: [], blackmail: 0 },
    V3: { labels: [], spans: [], blackmail: 0 },
    V4: { labels: [], spans: [], blackmail: 0 },
  };
  for (const item of INTENT_TERMS) {
    const spans = termHits(cleaned.text, cleaned.origins, item.term);
    if (spans.length === 0) continue;
    const bucket = grouped[item.vector];
    if (!bucket.labels.includes(item.label)) bucket.labels.push(item.label);
    bucket.spans.push(spans[0]);
    if (BLACKMAIL_TERMS.has(item.term)) bucket.blackmail += 1;
  }
  const scoreOf = (id: VectorId) => {
    const count = grouped[id].labels.length;
    if (count === 0) return 0;
    return clamp(VECTOR_META[id].base + (count - 1) * 22);
  };
  const v1 = scoreOf("V1");
  const v2 = scoreOf("V2");
  const v3 = scoreOf("V3");
  const v4 = scoreOf("V4");
  const blackmailScore = grouped.V2.blackmail === 0 ? 0 : clamp(30 + (grouped.V2.blackmail - 1) * 32);
  const active = [v1, v2, v3, v4].filter((score) => score > 0);
  const financialPair = v2 > 0 && v1 > 0;
  const credentialPair = v2 > 0 && v3 > 0;
  const synergy = financialPair || credentialPair;
  let semantic = 0;
  let formula = "";
  if (synergy) {
    const paired = (v1 > 0 ? v1 : 0) + (v3 > 0 ? v3 : 0);
    semantic = paired + v2 * 1.5 + (v4 > 0 ? v4 * 0.5 : 0);
    formula = `${v1 > 0 ? `V1 ${v1}` : ""}${v1 > 0 && v3 > 0 ? " + " : ""}${v3 > 0 ? `V3 ${v3}` : ""} + V2 ${v2} × 1.5`;
    if (v4 > 0) formula += ` + V4 ${v4} × 0.5`;
  } else if (active.length >= 2) {
    semantic = (v1 + v2 + v3 + v4) * 0.9;
    formula = `V1 ${v1} + V2 ${v2} + V3 ${v3} + V4 ${v4}`;
  } else if (active.length === 1) {
    const onlyId = (["V1", "V2", "V3", "V4"] as VectorId[]).find((id) => scoreOf(id) > 0);
    const count = onlyId ? grouped[onlyId].labels.length : 0;
    semantic = count >= 2 ? active[0] : Math.min(12, Math.round(active[0] * 0.25));
    formula = count >= 2 ? `${onlyId} ${active[0]}` : `${onlyId} tək söz, çarpan yoxdur`;
  }
  semantic = clamp(Math.round(semantic));
  const payloadCarrier = hasUrl && (v1 > 60 || blackmailScore > 60);
  if (payloadCarrier) semantic = clamp(Math.max(semantic, 85));
  const vectors: IntentVector[] = (["V1", "V2", "V3", "V4"] as VectorId[]).map((id) => ({
    id,
    name: VECTOR_META[id].name,
    score: scoreOf(id),
    base: VECTOR_META[id].base,
    terms: grouped[id].labels,
  }));
  const expose = synergy || payloadCarrier || active.length >= 2 || (active.length === 1 && grouped[(["V1", "V2", "V3", "V4"] as VectorId[]).find((id) => scoreOf(id) > 0) ?? "V1"].labels.length >= 2);
  const reasoning = [
    cleaned.obfuscated
      ? "Addım 1: Mətndəki gizlədilmiş hərflər (obfuscation) və Leetspeak təmizləndi."
      : "Addım 1: Mətn diakritik və böyük-kiçik hərf fərqi nəzərə alınaraq normallaşdırıldı. Yayınma izi tapılmadı.",
    financialPair
      ? "Addım 2: Yüksək tələskənlik (Urgency) və maliyyə tələbi (Financial Intent) arasında korrelyasiya aşkarlandı."
      : credentialPair
        ? "Addım 2: Yüksək tələskənlik (Urgency) və şifrə tələbi (Credential Intent) arasında korrelyasiya aşkarlandı."
        : "Addım 2: Təhdid vektorları ayrı-ayrı ölçüldü. Tələskənlik ilə maliyyə və ya şifrə tələbi arasında sinerji yoxdur.",
    synergy && v4 > 0
      ? `Addım 3: Sinergetik Təhdid İndeksi hesablandı: ${formula}. CEO fraud (Rəhbər təqlidi) taktikası tətbiq olunur.`
      : synergy
        ? `Addım 3: Sinergetik Təhdid İndeksi hesablandı: ${formula}.`
        : active.length === 0
          ? "Addım 3: Kontekstual niyyət matrisi boşdur. Ümumi risk aşağı saxlanıldı."
          : `Addım 3: Sinergetik Təhdid İndeksi hesablandı: ${formula}. Tək vektor kritik həddə çatdırılmadı.`,
  ];
  if (payloadCarrier) {
    reasoning.push("Addım 4: Keçid Zero-Trust yoxlamasından keçmədi. Niyyət 60%-i keçdiyi üçün məktub, domen təmiz olsa belə, Zərərli Payload Daşıyıcısı kimi 85%+ risk aldı.");
  }
  const techniques: AttackTechnique[] = [];
  for (const vector of vectors) {
    if (vector.score === 0 || !expose) continue;
    const meta = VECTOR_META[vector.id];
    const existing = techniques.find((item) => item.code === meta.code);
    const label = `${vector.id} ${meta.technique}`;
    if (!existing) techniques.push({ code: meta.code, name: label });
    else if (!existing.name.includes(vector.id)) existing.name = `${existing.name} · ${label}`;
  }
  return {
    vectors,
    reasoning,
    overall: semantic,
    payloadCarrier,
    obfuscated: cleaned.obfuscated,
    synergy,
    spans: expose ? (["V1", "V2", "V3", "V4"] as VectorId[]).flatMap((id) => grouped[id].spans) : [],
    labels: expose ? (["V1", "V2", "V3", "V4"] as VectorId[]).flatMap((id) => grouped[id].labels) : [],
    techniques,
  };
}

export function analyzePhishing(text: string, url: string, threshold = 65): PhishingReport {
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
  const normalized = normalizeText(text);
  const wall = assessCyberWall(normalized, markers);
  const lure = assessLures(normalized);
  if (domain.score >= 40) intent.intents.push("Saxta domen və ya şübhəli keçid aşkarlandı");
  const intents = [...new Set([...wall.intents, ...intent.intents, ...lure.intents])];
  if (intent.floor > 0 || wall.floor > 0 || lure.floor > 0) overall = clamp(Math.max(overall, intent.floor, wall.floor, lure.floor));
  if (intent.floor >= 84 || wall.forced || lure.floor >= 84) {
    urgency = clamp(Math.max(urgency, 64));
    theft = clamp(Math.max(theft, 58));
    if (intent.pressure >= 1 || wall.pressure >= 1) style = clamp(Math.max(style, 36));
  }

  const urlsPresent = urls.some((item) => item.trim().length > 0);
  const semantic = assessIntent(text, urlsPresent);
  overall = clamp(Math.max(overall, semantic.overall));
  if (domain.reasons.some((reason) => reason.includes(".exe"))) overall = clamp(Math.max(overall, 72));
  urgency = clamp(Math.max(urgency, semantic.vectors.find((vector) => vector.id === "V2")?.score ?? 0));
  theft = clamp(Math.max(theft, semantic.vectors.find((vector) => vector.id === "V1")?.score ?? 0, semantic.vectors.find((vector) => vector.id === "V3")?.score ?? 0));
  if (semantic.synergy) style = clamp(Math.max(style, 36));

  const line = Math.min(85, Math.max(50, Math.round(Number.isFinite(threshold) ? threshold : 65)));
  const critical = wall.forced || intent.floor >= 84 || lure.floor >= 84 || semantic.payloadCarrier || semantic.synergy || overall >= 84;
  const quarantine = wall.forced || intent.floor >= 84 || lure.floor >= 84 || semantic.payloadCarrier || semantic.synergy || overall >= line ? "alindi" : overall >= Math.max(35, line - 25) ? "nezaret" : "tehlukesiz";
  const techniques = [...wall.techniques];
  for (const technique of semantic.techniques) {
    const existing = techniques.find((item) => item.code === technique.code);
    if (!existing) techniques.push(technique);
    else if (!existing.name.includes(technique.name)) existing.name = `${existing.name} · ${technique.name}`;
  }
  if (domain.reasons.some((reason) => reason.includes(".exe")) && !techniques.some((item) => item.code === "T1486")) {
    techniques.push({ code: "T1486", name: "Data Encrypted for Impact" });
  }
  for (const technique of lure.techniques) {
    if (!techniques.some((item) => item.code === technique.code)) techniques.push(technique);
  }
  if (domain.score >= 40 && !techniques.some((item) => item.code === "T1566")) {
    techniques.push({ code: "T1566", name: "Phishing" });
  }
  if (quarantine === "alindi" && techniques.length === 0) {
    techniques.push({ code: "T1566", name: "Phishing" });
  }
  const pressureWords = signals.map((signal) => `«${signal.label}»`);
  const findings = [
    ...semantic.reasoning,
    ...intents,
    ...(semantic.payloadCarrier ? ["Zərərli Payload Daşıyıcısı: maliyyə və ya şantaj niyyəti 60%-i keçir, keçid təmiz domen olsa belə məktub 85%+ risk alır."] : []),
    ...(wall.forced || intent.floor >= 84 ? ["Kiber Divar: keçid olmasa belə kritik niyyət avtomatik karantinə alındı."] : []),
    ...(pressureWords.length > 0 ? [`Təzyiq və ya oğurluq sözləri: ${pressureWords.join(", ")}`] : []),
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
    highlights: buildHighlights(text, markers, [...wall.spans, ...lure.spans, ...semantic.spans]),
    matchedTerms: [...new Set([...signals.map((signal) => signal.label), ...markers.map((marker) => marker.label), ...wall.labels, ...lure.labels, ...semantic.labels])],
    findings,
    analyzedUrl: domain.analyzedUrl,
    intents,
    techniques,
    critical,
    vectors: semantic.vectors,
    reasoning: semantic.reasoning,
    payloadCarrier: semantic.payloadCarrier,
    obfuscated: semantic.obfuscated,
  };
}
