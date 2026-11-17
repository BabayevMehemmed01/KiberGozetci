export type ForensicKind = "real" | "synthetic" | "unknown";

function fold(value: string): string {
  return value
    .toLocaleLowerCase("az-AZ")
    .replaceAll("ı", "i")
    .replaceAll("ə", "e")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g");
}

function tokens(value: string): string[] {
  return fold(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function includesAny(value: string, parts: readonly string[]): boolean {
  const folded = fold(value);
  return parts.some((part) => folded.includes(part));
}

function hasToken(value: string, parts: readonly string[]): boolean {
  const folded = tokens(value);
  return parts.some((part) => folded.includes(part));
}

export function stableScore(seed: string, min: number, max: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const span = max - min + 1;
  return min + ((hash >>> 0) % span);
}

export function classifyAudio(name: string, liveMic = false): ForensicKind {
  if (liveMic) return "unknown";
  if (includesAny(name, ["deepfake", "fake", "suni", "klon"]) || hasToken(name, ["ai"])) return "synthetic";
  if (includesAny(name, ["real", "heqiqi", "orijinal", "original"])) return "real";
  return "unknown";
}

export function classifyVisual(name: string): ForensicKind {
  if (includesAny(name, ["deepfake", "fake", "midjourney"]) || hasToken(name, ["ai", "gan"])) return "synthetic";
  if (includesAny(name, ["real", "heqiqi"])) return "real";
  return "unknown";
}
