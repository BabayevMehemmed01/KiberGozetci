import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phishingTemplates } from "../src/data/mockData.ts";
import { analyzePcm, verdictFor } from "../src/lib/dsp.ts";
import { analyzePhishing } from "../src/lib/phishingEngine.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readWav(name: string): { samples: Float32Array; sampleRate: number } {
  const buffer = readFileSync(join(root, "public", "samples", name));
  const sampleRate = buffer.readUInt32LE(24);
  const count = buffer.readUInt32LE(40) / 2;
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    samples[index] = buffer.readInt16LE(44 + index * 2) / 32767;
  }
  return { samples, sampleRate };
}

let failed = false;

function expect(condition: boolean, message: string) {
  if (!condition) {
    failed = true;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK   ${message}`);
  }
}

for (const name of [
  "rehber_tecili_kocurme_deepfake.wav",
  "maliyye_hesabat_heqiqi.wav",
  "namelum_otp_telebi_deepfake.wav",
]) {
  const audio = readWav(name);
  const report = analyzePcm(audio.samples, audio.sampleRate);
  const verdict = verdictFor(report);
  console.log(
    `${name}: ${report.probability}% ${verdict.label} pattern=${report.pattern} vocoder=${report.vocoder} breath=${report.breathNatural} spectrum=${report.spectrumAnomaly}`,
  );
  console.log(`     metrics ${JSON.stringify(report.metrics)}`);
}

const boss = analyzePcm(readWav("rehber_tecili_kocurme_deepfake.wav").samples, 22050);
const real = analyzePcm(readWav("maliyye_hesabat_heqiqi.wav").samples, 22050);
const otp = analyzePcm(readWav("namelum_otp_telebi_deepfake.wav").samples, 22050);

expect(boss.probability >= 85 && boss.pattern === "synthetic", `boss deepfake ${boss.probability}`);
expect(otp.probability >= 85 && otp.pattern === "synthetic", `otp deepfake ${otp.probability}`);
expect(real.probability <= 20 && real.pattern === "speech", `real voice ${real.probability}`);

for (const template of phishingTemplates) {
  const report = analyzePhishing(template.text, template.url);
  console.log(`${template.id}: ${report.overall}% urgency=${report.urgency} domain=${report.domain} style=${report.style} theft=${report.theft} ${report.quarantine}`);
  if (template.tone === "tehlukeli") expect(report.overall >= 70, `${template.id} should quarantine`);
  else expect(report.overall <= 15, `${template.id} should be safe`);
}

if (failed) process.exit(1);
