import { clamp } from "./utils.ts";
import { classifyPhishingText } from "./phishingAction.ts";

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
  if (phrase === "gonder" && (word.startsWith("gonderici") || word.startsWith("gonderen"))) return false;
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

interface DomainReport {
  score: number;
  reasons: string[];
  analyzedUrl: string;
  executable: boolean;
  documentation: boolean;
}

const DOC_HOST = /\.(?:example|invalid|test|localhost)$/i;
const SPOOF_BRANDS = ["microsoft", "office", "outlook", "windows", "google", "apple", "paypal", "amazon", "facebook", "linkedin", "dhl", "fedex"];
const REDIRECT_KEYS = ["next", "url", "redirect", "redir", "dest", "destination", "goto", "return", "continue", "target"];

function rawHostname(input: string): string {
  const stripped = input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = (stripped.split(/[/?#]/)[0] ?? "").trim();
  const hostport = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  return hostport.replace(/:\d+$/, "").replace(/\.$/, "");
}

function isRfc5737(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  const c = Number(match[3]);
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

function isDocumentationHost(host: string): boolean {
  const bare = host.replace(/^www\./, "").toLowerCase();
  return DOC_HOST.test(bare) || bare === "example.com" || bare.includes("numune-kecid") || isRfc5737(bare);
}

function decodeTarget(value: string): string {
  let current = value.trim();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function hostOfTarget(value: string): string {
  const decoded = decodeTarget(value);
  if (!decoded) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(decoded) ? decoded : `http://${decoded}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return rawHostname(decoded).toLowerCase();
  }
}

function brandSubdomain(host: string): { brand: string; registrable: string } | null {
  const labels = host.replace(/^www\./, "").split(".").filter(Boolean);
  if (labels.length < 3) return null;
  const registrable = labels.slice(-2).join(".");
  const left = labels.slice(0, -2);
  for (const brand of SPOOF_BRANDS) {
    const used = left.some((label) => label === brand || label.startsWith(`${brand}-`));
    if (used && !registrable.startsWith(`${brand}.`)) return { brand, registrable };
  }
  return null;
}

function analyzeDomain(rawUrl: string): DomainReport {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      score: 0,
      reasons: ["Keçid daxil edilməyib, domen riski sıfır qəbul edildi."],
      analyzedUrl: "",
      executable: false,
      documentation: false,
    };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return {
      score: 24,
      reasons: ["Keçid ünvanı standart formata uyğun deyil."],
      analyzedUrl: trimmed,
      executable: false,
      documentation: false,
    };
  }

  const host = url.hostname.toLowerCase();
  const rawHost = rawHostname(trimmed);
  const pathname = url.pathname.toLowerCase();
  const documentation = isDocumentationHost(host) || isDocumentationHost(rawHost);
  const reasons: string[] = [];
  let score = 0;
  const execMatch = pathname.match(/\.(exe|scr|bat|vbs)$/i);
  const executable = execMatch !== null;
  const trustedHost = isWhitelisted(host);
  const suspiciousToken = SUSPICIOUS_HOST.test(host);
  const ipHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);

  if (documentation) reasons.push("Test/sənədləşdirmə domeni və ya IP-si (reputasiya neytral)");

  const mixedScript = /[a-z]/i.test(rawHost) && /[\u0400-\u04FF]/.test(rawHost);
  const nonAscii = /[^\u0000-\u007F]/.test(rawHost);
  if (mixedScript || nonAscii || host.includes("xn--")) {
    reasons.push(`Qarışıq əlifba (Homoglyph) maskalanması. IDNA/Punycode: ${host}`);
    if (!documentation) score += mixedScript || nonAscii ? 44 : 36;
  }

  let externalRedirect = false;
  for (const key of REDIRECT_KEYS) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const inner = hostOfTarget(value);
    if (!inner) continue;
    reasons.push(`Daxili yönləndirmə hədəfi aşkarlandı: ${inner}`);
    if (!documentation && !isDocumentationHost(inner) && inner !== host) {
      externalRedirect = true;
      score += 18;
    }
  }

  const spoof = brandSubdomain(host);
  if (spoof) {
    reasons.push(`Əsas domen (registrable) ${spoof.registrable} ünvanıdır. Brend adı (${spoof.brand}) aldadıcı alt-domen kimi işlədilib.`);
    if (!documentation) score += 36;
  }

  if (url.port && url.port !== "80" && url.port !== "443") {
    reasons.push(`Qeyri-standart port (:${url.port}) istifadə olunub`);
  }

  if (SHORTENER.test(host)) {
    reasons.push("Qısaldılmış keçid: final təyinat yeri maskalanıb");
    return {
      score: clamp(Math.min(55, Math.max(45, score > 0 ? Math.max(score, 50) : 50))),
      reasons,
      analyzedUrl: trimmed,
      executable,
      documentation: false,
    };
  }

  if (documentation) {
    return { score: 0, reasons, analyzedUrl: trimmed, executable: false, documentation: true };
  }

  if (execMatch) {
    score += 55;
    reasons.push(`Keçid icra olunan fayla aparır (.${execMatch[1].toLowerCase()}).`);
  } else if (/\.(?:zip|pdf)$/i.test(pathname)) {
    reasons.push("PDF və ya ZIP uzantısı təkbaşına zərərli hökm yaratmır.");
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
  if (trustedHost && !suspiciousToken && !ipHost && lookalike === null && !executable && !externalRedirect && !spoof) {
    const trustedReasons = ["Keçid etibarlı daxili və ya rəsmi domenə aparır."];
    if (url.port && url.port !== "80" && url.port !== "443") trustedReasons.push(`Qeyri-standart port (:${url.port}) istifadə olunub`);
    return { score: 0, reasons: trustedReasons, analyzedUrl: trimmed, executable: false, documentation: false };
  }
  if (!trustedHost && score < 15) {
    score = unknownDomainScore(host);
    reasons.push("Naməlum/Yoxlanılmamış domen. Ağ siyahıda olmadığı üçün baza riski tətbiq edildi.");
  }
  if (reasons.length === 0) reasons.push("Keçiddə açıq saxtakarlıq əlaməti görünmür.");

  return { score: clamp(score), reasons, analyzedUrl: trimmed, executable, documentation: false };
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

const LEET: Record<string, string> = { "3": "e", "0": "o", "1": "i", "@": "a" };
const EVASIVE_PUNCT = /[.,_*/-]/;

interface CleanChar {
  ch: string;
  from: number;
}

export function deobfuscate(raw: string): { text: string; origins: number[]; obfuscated: boolean } {
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

const VECTOR_META = {
  V1: { name: "Financial/Crypto Request", base: 40 },
  V2: { name: "Urgency/Coercion", base: 30 },
  V3: { name: "Credential Theft/Action", base: 40 },
  V4: { name: "Authority/Impersonation", base: 20 },
} as const;

function evidenceHighlights(text: string, phrases: string[]): TextPart[] {
  const folded = normalizeText(text);
  const spans: { start: number; end: number }[] = [];
  for (const phrase of phrases) {
    const needle = normalizeText(phrase);
    if (needle.length < 2) continue;
    let from = 0;
    while (from < folded.length) {
      const index = folded.indexOf(needle, from);
      if (index < 0) break;
      spans.push({ start: index, end: index + needle.length });
      from = index + needle.length;
    }
  }
  spans.sort((left, right) => left.start - right.start || right.end - left.end);
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

export function analyzePhishing(text: string, url: string, threshold = 65): PhishingReport {
  const action = classifyPhishingText(text);
  const markers = findMarkers(text);
  const urls = collectUrls(text, url);
  const domainReports = urls.map((item) => analyzeDomain(item));
  const domain = domainReports.reduce(
    (best, item) => (item.score > best.score ? item : best),
    domainReports[0] ?? {
      score: 0,
      reasons: ["Keçid daxil edilməyib, domen riski sıfır qəbul edildi."],
      analyzedUrl: "",
      executable: false,
      documentation: false,
    },
  );
  const domainScore = domain.score;
  const line = Math.min(85, Math.max(50, Math.round(Number.isFinite(threshold) ? threshold : 65)));
  const weighted = Math.min(100, (action.v1 * 35 + action.v3 * 35 + action.v2 * 15 + action.v4 * 15 + domainScore * 30) / 100);
  const basePercent = Math.min(100, Math.round(weighted));
  let final = weighted;
  const ruleA = action.v3 >= 70;
  const ruleB = action.v1 >= 70 && (action.v2 >= 30 || action.v4 >= 20 || action.secrecy);
  if (ruleA) final = Math.max(final, 92);
  if (ruleB) final = Math.max(final, 94);
  const noDemand = action.v1 < 40 && action.v3 < 40;
  if (noDemand) final = Math.min(final, 25);
  const overall = clamp(Math.round(final));

  const obfuscationLabel = action.obfuscationQuotes.map((item) => `«${item}»`).join(", ");
  const step1 = action.obfuscationQuotes.length > 0
    ? `Addım 1 (Normallaşdırma): Mətndə yayınma/obfuscation aşkarlandı: ${obfuscationLabel}.`
    : action.obfuscated
      ? "Addım 1 (Normallaşdırma): Mətndə yayınma/obfuscation aşkarlandı."
      : "Addım 1 (Normallaşdırma): Mətndə yayınma/obfuscation (p.u.l, h3sab) tapılmadı.";

  const quotedContext = action.contextQuotes.map((item) => `«${item}»`).join(", ");
  const demandQuote = action.demandQuotes[0] ?? "aktiv tələb";
  const step2 = action.contextQuotes.length > 0 && !action.financial && !action.credential
    ? `Addım 2 (Kontekst və İnkar): İnkar/neytral kontekst aşkarlandı: ${quotedContext}.`
    : action.contextQuotes.length > 0
      ? `Addım 2 (Kontekst və İnkar): İnkar/neytral kontekst aşkarlandı: ${quotedContext}. Aktiv tələb bu kontekstdən ayrıdır: «${demandQuote}».`
      : action.financial || action.credential
        ? `Addım 2 (Kontekst və İnkar): Aktiv tələb aşkarlandı: «${demandQuote}». İnkar və ya rəsmi prosedural kontekst bu tələbi örtmür.`
        : "Addım 2 (Kontekst və İnkar): İnkar və ya rəsmi prosedural kontekst tapılmadı. Aktiv köçürmə və ya məxfi məlumat tələbi yoxdur.";

  let step3 = `Addım 3 (Vektor və Formula İzahı): V1: ${action.v1}%, V2: ${action.v2}%, V3: ${action.v3}%, V4: ${action.v4}%, domen: ${domainScore}% → Çəkili bal: ${basePercent}% (Karantin həddi: ${line}%).`;
  if (ruleA && ruleB) {
    step3 += ` Qayda A (Credential/OTP Oğurluğu) və Qayda B (CEO Fraud): Aktiv parol/OTP tələbi + aktiv köçürmə tələbi → Yekun risk: ${overall}%.`;
  } else if (ruleB) {
    const why = action.v4 >= 20 ? "Rəhbər təqlidi" : action.secrecy ? "məxfilik tələbi" : "təzyiq";
    step3 += ` Qayda B (CEO Fraud): Aktiv köçürmə tələbi + ${why} → Yekun risk: ${overall}%.`;
  } else if (ruleA) {
    step3 += ` Qayda A (Credential/OTP Oğurluğu): Aktiv parol/OTP tələbi → Yekun risk: ${overall}%.`;
  } else if (noDemand && basePercent > overall) {
    step3 += ` Aktiv tələb yoxdur (V1 < 40 və V3 < 40), yekun risk ${overall}% səviyyəsində saxlanıldı və avtomatik karantin işə düşmədi.`;
  }

  const reasoning = [step1, step2, step3];
  const intents: string[] = [];
  if (action.v1 >= 70) intents.push("Financial / Invoice Fraud");
  if (action.v3 >= 70) intents.push("Credential / OTP Theft");
  if (intents.length === 0 && action.contextQuotes.length > 0) intents.push("Security Awareness / Safe Notice");

  const techniques: AttackTechnique[] = [];
  if (!noDemand) {
    if (domainScore >= 40) techniques.push({ code: "T1566.002", name: "Spearphishing Link" });
    else techniques.push({ code: "T1566", name: "Phishing" });
    if (action.v1 >= 70 && action.v4 >= 20) techniques.push({ code: "T1656", name: "Impersonation" });
    if (/ransom|sifrelen|bitlocker|decrypt|fidye|fidya/.test(normalizeText(text))) {
      techniques.push({ code: "T1486", name: "Data Encrypted for Impact" });
    }
  }

  const quarantine = noDemand
    ? "tehlukesiz"
    : overall >= line
      ? "alindi"
      : overall >= Math.max(35, line - 25)
        ? "nezaret"
        : "tehlukesiz";

  const findings = [...reasoning];
  if (intents.length > 0) findings.push(`Niyyət sinfi: ${intents.join("; ")}.`);
  if (action.financial || action.credential) {
    for (const marker of markers) {
      if (marker.label === "məbləğ və valyuta") continue;
      if (marker.label === "OTP kod tələbi" && !action.credential) continue;
      findings.push(`Həssas məlumat izi: ${marker.label}.`);
    }
  }
  findings.push(...domain.reasons);
  if (!action.financial && !action.credential && action.contextQuotes.length === 0 && findings.length === 3) {
    findings.push("Mətndə aktiv köçürmə və ya məxfi məlumat tələbi tapılmadı.");
  }

  const vectors: IntentVector[] = (["V1", "V2", "V3", "V4"] as const).map((id) => ({
    id,
    name: VECTOR_META[id].name,
    score: id === "V1" ? action.v1 : id === "V2" ? action.v2 : id === "V3" ? action.v3 : action.v4,
    base: VECTOR_META[id].base,
    terms: action.terms[id],
  }));

  return {
    overall,
    urgency: action.v2,
    domain: domainScore,
    style: action.secrecy ? 24 : 0,
    theft: Math.max(action.v1, action.v3),
    quarantine,
    highlights: action.financial || action.credential ? evidenceHighlights(text, action.highlightPhrases) : [{ text, hit: false }],
    matchedTerms: action.financial || action.credential ? [...new Set(action.demandQuotes)] : [],
    findings,
    analyzedUrl: domain.analyzedUrl,
    intents,
    techniques,
    critical: overall >= 84 && quarantine === "alindi",
    vectors,
    reasoning,
    payloadCarrier: false,
    obfuscated: action.obfuscated,
  };
}
