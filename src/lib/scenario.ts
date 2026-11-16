export interface AttackScenario {
  ip: string;
  clock: string;
  files: number;
  risks: [number, number, number, number];
  title: string;
  mitre: string;
  bait: string;
  blockSeconds: number;
  damage: number;
}

export interface SimulationOutcome {
  risk: number;
  blockSeconds: number;
  damage: number;
  title: string;
}

interface Vector {
  title: string;
  mitre: string;
  bait: string;
}

const VOICE: Vector = {
  title: "Klonlanmış direktor səsi və təcili köçürmə",
  mitre: "T1656 — Impersonation / Deepfake",
  bait: "Klonlanmış direktor səsi təcili köçürmə tələb edir",
};

const TAX: Vector = {
  title: "Saxta vergi cəriməsi və OTP oğurluğu",
  mitre: "T1566.002 — Spearphishing Link",
  bait: "Saxta vergi cəriməsi bildirişi birdəfəlik kod istəyir",
};

const INVOICE: Vector = {
  title: "Saxta təchizatçı fakturası və hesabın ələ keçirilməsi",
  mitre: "T1078 — Valid Accounts",
  bait: "Saxta təchizatçı fakturası hesab məlumatlarını dəyişməyə çağırır",
};

function poolFor(department: string): Vector[] {
  const name = department.toLocaleLowerCase("az-AZ");
  if (name.includes("maliyy")) return [VOICE, INVOICE, TAX, INVOICE];
  if (name.includes("informasiya") || name.includes("texnolog")) return [TAX, INVOICE, TAX, VOICE];
  return [VOICE, TAX, INVOICE];
}

export function randomAttackIp(): string {
  const prefixes = ["185.203", "91.240", "45.134", "194.87"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const third = 1 + Math.floor(Math.random() * 254);
  const fourth = 1 + Math.floor(Math.random() * 254);
  return `${prefix}.${third}.${fourth}`;
}

export function rollScenario(department: string): AttackScenario {
  const pool = poolFor(department);
  const vector = pool[Math.floor(Math.random() * pool.length)];
  const earliest = 1 * 60 + 12;
  const latest = 4 * 60 + 48;
  const minute = earliest + Math.floor(Math.random() * (latest - earliest + 1));
  const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const files = 3400 + Math.floor(Math.random() * (26800 - 3400 + 1));
  const third = 90 + Math.floor(Math.random() * 5);
  const rolled = 92 + Math.floor(Math.random() * 9);
  const risks: [number, number, number, number] = [
    81 + Math.floor(Math.random() * 5),
    86 + Math.floor(Math.random() * 4),
    third,
    Math.min(100, Math.max(rolled, third + 1)),
  ];
  return {
    ip: randomAttackIp(),
    clock,
    files,
    risks,
    title: vector.title,
    mitre: vector.mitre,
    bait: vector.bait,
    blockSeconds: (9 + Math.floor(Math.random() * 19)) / 10,
    damage: 45000 + Math.floor(Math.random() * (320000 - 45000 + 1)),
  };
}
