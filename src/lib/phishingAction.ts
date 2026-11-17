import { deobfuscate, normalizeText } from "./phishingEngine.ts";

export interface PhishingAction {
  v1: number;
  v2: number;
  v3: number;
  v4: number;
  secrecy: boolean;
  obfuscated: boolean;
  obfuscationQuotes: string[];
  contextQuotes: string[];
  demandQuotes: string[];
  financial: boolean;
  credential: boolean;
  highlightPhrases: string[];
  terms: { V1: string[]; V2: string[]; V3: string[]; V4: string[] };
}

const NEGATION = [
  "hec bir odenis teleb edilmir",
  "hec bir odenis teleb olunmur",
  "teleb etmeyecekler",
  "teleb etmeyecek",
  "teleb etmir",
  "teleb olunmur",
  "teleb edilmir",
  "ehtiyac yoxdur",
  "lazim deyil",
  "gozlenilmir",
  "gozlenmir",
  "paylasmayin",
  "vermeyin",
  "gondermeyin",
  "daxil olmayin",
  "acmayin",
  "do not share",
  "dont share",
  "never ask",
  "not required",
  "no action required",
  "do not open",
  "do not click",
  "never share",
];

const NEUTRAL = [
  "yalniz melumatlandirma meqsedi dasiyir",
  "melumatlandirma meqsedi",
  "daxili arxivde saxlanilacaq",
  "daxili hesabatda qeyd edilmisdir",
  "maliyye sobesine muraciet ede bilersiniz",
  "muraciet ede bilersiniz",
  "is saatlari haqqinda",
  "heyata kecirilmisdir",
  "heyata kecirilib",
  "heyata kecirilmis",
  "qeyde alinmisdir",
  "qeyde alinmis",
  "yenilenmisdir",
  "hazirlanmisdir",
  "hazirlanib",
  "planlasdirilir",
  "icra edilecek",
  "qeyd edilmisdir",
  "has been",
  "was completed",
  "for your information",
];

const IMPERATIVE: RegExp[] = [
  /kocur(?:ul)?mesini xahis/,
  /kocurme\w{0,12}\b.{0,48}\bgonder(?!ici|en)/,
  /\bkocurun\b/,
  /\bkocur\b/,
  /odenis etmelisiniz/,
  /odenis edin\b/,
  /\bodeyin\b/,
  /hesaba gonder(?!ici|en)/,
  /rekvizitleri gonder(?!ici|en)/,
  /pay now/,
  /send funds/,
  /send (?:the )?(?:money|payment|funds)/,
  /выполните перевод/,
  /сделайте перевод/,
  /(?:pul|bitcoin|usdt|crypto)\w{0,8}\b.{0,32}\bgonder(?!ici|en)/,
  /\bgonder(?!ici|en)(?:in)?\b.{0,32}(?:pul|mebleg|vesait|odenis|bitcoin|usdt|money|funds)/,
];

const TOPIC: RegExp[] = [/wire transfer/, /yeni bank hesabina/, /\btransfer\b/];

function isLetter(char: string | undefined): boolean {
  if (!char) return false;
  return /\p{L}/u.test(char);
}

function take(text: string, pattern: RegExp): string | null {
  const match = new RegExp(pattern.source, pattern.flags.replace("g", "")).exec(text);
  return match?.[0] ?? null;
}

function longestPhrase(text: string, phrases: readonly string[]): string | null {
  let best: string | null = null;
  for (const phrase of phrases) {
    if (!text.includes(phrase)) continue;
    if (best === null || phrase.length > best.length) best = phrase;
  }
  return best;
}

function hasBounded(text: string, phrase: string): boolean {
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf(phrase, from);
    if (index < 0) return false;
    if (!isLetter(text[index - 1]) && !isLetter(text[index + phrase.length])) return true;
    from = index + Math.max(1, phrase.length);
  }
  return false;
}

function hasStem(text: string, phrase: string): boolean {
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf(phrase, from);
    if (index < 0) return false;
    let end = index + phrase.length;
    while (isLetter(text[end])) end += 1;
    const suffix = text.slice(index + phrase.length, end);
    if (!isLetter(text[index - 1]) && suffix.length <= 6) return true;
    from = index + phrase.length;
  }
  return false;
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/\n+|(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function sliceQuote(original: string, normalizedFragment: string): string {
  const folded = normalizeText(original);
  const index = folded.indexOf(normalizedFragment);
  const compact = original.replace(/\s+/g, " ").trim();
  if (index < 0) return compact.length > 110 ? `${compact.slice(0, 107)}...` : compact;
  const quote = original.slice(index, index + normalizedFragment.length).replace(/\s+/g, " ").trim();
  return quote || compact;
}

function firstOf(text: string, phrases: readonly string[]): string | null {
  for (const phrase of phrases) {
    if (hasBounded(text, phrase) || text.includes(phrase)) return phrase;
  }
  return null;
}

function imperativeMatch(text: string): string | null {
  for (const pattern of IMPERATIVE) {
    const found = take(text, pattern);
    if (found) return found;
  }
  return null;
}

function topicMatch(text: string): string | null {
  const transferCue = /(?:please|immediately|now|funds|money|\$|azn|usd|edin\b|et\b)/.test(text);
  for (const pattern of TOPIC) {
    if (pattern.source === "\\btransfer\\b" && !transferCue) continue;
    const found = take(text, pattern);
    if (found) return found;
  }
  return null;
}

function credentialMatch(text: string): string | null {
  const object =
    /parol\w*|sifre\w*|password|\botp\b|one-time code|verification code|dogrulama kodu|birdefelik kod|\bpin\b|\bcvv\b|парол\w*|код подтверждения|fin kod|kart nomre\w*|kart melumat\w*|card number/.exec(text)?.[0] ??
    null;
  if (!object) return null;
  const verb = /teqdim edin|daxil edin|tesdiqleyin|yenileyin|\benter\b|\bsubmit\b|\bprovide\b|send your|send the|confirm your|gonder(?!ici|en)(?:in)?\b/.exec(text)?.[0] ?? null;
  if (!verb) return null;
  return `${object} ${verb}`;
}

function urgencyMatch(text: string): string | null {
  const phrases = ["немедленно", "срочно", "immediately", "urgent", "asap", "bloklan", "dondurul", "suspend", "derhal", "tecili", "deadline", "eks halda"];
  return firstOf(text, phrases);
}

function authorityMatch(text: string): string | null {
  const phrases = ["bank tehlukesizliyi", "bank adindan", "ceo", "direktor", "rehber", "polis", "vergi", "admin"];
  for (const phrase of phrases) {
    if (phrase.includes(" ") ? text.includes(phrase) : hasStem(text, phrase)) return phrase;
  }
  return null;
}

function secrecyMatch(text: string): string | null {
  const phrases = [
    "hec kimle muzakire etmeyin",
    "zeng etmeyin",
    "hec kime deme",
    "do not tell",
    "dont tell",
    "никому не",
    "kimseye soyleme",
  ];
  return firstOf(text, phrases);
}

function obfuscationQuotes(raw: string): string[] {
  const quotes: string[] = [];
  const dotted = raw.match(/(?<!\p{L})\p{L}(?:[.\-_*]\p{L}){2,}(?!\p{L})/gu) ?? [];
  const leet = raw.match(/(?<!\p{L})\p{L}+[0-9]\p{L}+(?!\p{L})/gu) ?? [];
  const spaced = raw.match(/(?<!\p{L})\p{L}(?:[ \t]+\p{L}){2,}(?!\p{L})/gu) ?? [];
  for (const item of [...dotted, ...leet, ...spaced]) {
    if (!quotes.includes(item)) quotes.push(item);
  }
  return quotes.slice(0, 4);
}

export function classifyPhishingText(text: string): PhishingAction {
  const obfuscation = obfuscationQuotes(text);
  const negationQuotes: string[] = [];
  const neutralQuotes: string[] = [];
  const demandQuotes: string[] = [];
  const highlightPhrases: string[] = [];
  let financial = false;
  let credential = false;
  let urgency = false;
  let authority = false;
  let secrecy = false;
  let obfuscated = obfuscation.length > 0;

  for (const sentence of splitSentences(text)) {
    const folded = normalizeText(sentence);
    const cleaned = deobfuscate(sentence);
    obfuscated = obfuscated || cleaned.obfuscated;
    const readable = cleaned.text;
    const negation = longestPhrase(folded, NEGATION) ?? longestPhrase(readable, NEGATION);
    if (negation) {
      negationQuotes.push(sliceQuote(sentence, negation));
      continue;
    }
    const neutral = longestPhrase(folded, NEUTRAL) ?? longestPhrase(readable, NEUTRAL);
    if (neutral) neutralQuotes.push(sliceQuote(sentence, neutral));
    const imperative = imperativeMatch(readable);
    const topic = imperative ? null : neutral ? null : topicMatch(readable);
    const demand = imperative ?? topic;
    if (demand) {
      financial = true;
      demandQuotes.push(sliceQuote(sentence, demand));
      highlightPhrases.push(demand);
    }
    const secret = credentialMatch(readable);
    if (secret) {
      credential = true;
      demandQuotes.push(sliceQuote(sentence, secret.split(" ")[0] ?? secret));
      highlightPhrases.push(secret);
    }
    if (urgencyMatch(readable)) urgency = true;
    if (authorityMatch(readable)) authority = true;
    const hidden = secrecyMatch(readable);
    if (hidden) secrecy = true;
  }

  const v1 = financial ? 86 : 0;
  const v3 = credential ? 88 : 0;
  const v2 = (financial || credential) && urgency ? 74 : 0;
  const v4 = (financial || credential) && authority ? 46 : 0;

  return {
    v1,
    v2,
    v3,
    v4,
    secrecy,
    obfuscated,
    obfuscationQuotes: obfuscation,
    contextQuotes: [...new Set([...negationQuotes, ...neutralQuotes])].slice(0, 3),
    demandQuotes: [...new Set(demandQuotes)].slice(0, 3),
    financial,
    credential,
    highlightPhrases,
    terms: {
      V1: financial ? demandQuotes.slice(0, 2) : [],
      V2: v2 > 0 ? ["təzyiq"] : [],
      V3: credential ? ["parol/OTP tələbi"] : [],
      V4: v4 > 0 ? ["rəhbər və ya qurum təqlidi"] : [],
    },
  };
}
