import { phishingTemplates } from "../src/data/mockData.ts";
import { analyzePhishing } from "../src/lib/phishingEngine.ts";

let failed = 0;

function expect(condition: boolean, message: string) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK   ${message}`);
  }
}

function vector(text: string, url = "") {
  const report = analyzePhishing(text, url);
  const score = Object.fromEntries(report.vectors.map((item) => [item.id, item.score]));
  return { report, score };
}

function consistent(text: string, url = ""): boolean {
  const { report, score } = vector(text, url);
  let final = Math.min(100, (score.V1 * 35 + score.V3 * 35 + score.V2 * 15 + score.V4 * 15 + report.domain * 30) / 100);
  const ruleB = report.reasoning.some((step) => step.includes("Qayda B"));
  if (score.V3 >= 70) final = Math.max(final, 92);
  if (score.V1 >= 70 && (score.V2 >= 30 || score.V4 >= 20 || ruleB)) final = Math.max(final, 94);
  if (score.V1 < 40 && score.V3 < 40) final = Math.min(final, 25);
  return report.overall === Math.round(final);
}

interface Case {
  id: number;
  text: string;
  url?: string;
  max?: number;
  min?: number;
  v3?: number;
  v1max?: number;
}

const dangerous: Case[] = [
  {
    id: 53,
    text: "Mən baş direktoram. Təcili 24.000 AZN yeni bank hesabına köçürün. Heç kimlə müzakirə etməyin və zəng etməyin.",
    url: "http://maliyye-kocurme.top/teyid",
    min: 90,
    v3: 0,
  },
  {
    id: 57,
    text: "Hesabınız bloklanacaq. Parolunuzu və OTP kodunuzu dərhal daxil edin.",
    url: "http://hesab-yenile.xyz/login",
    min: 90,
  },
  {
    id: 58,
    text: "Ödəniş etməlisiniz. 5.000 AZN məbləğini bu gün hesaba göndərin. Təcili.",
    url: "http://odenis-merkezi.top/pay",
    min: 90,
    v3: 0,
  },
  {
    id: 59,
    text: "Rekvizitləri göndərin. Heç kimlə müzakirə etməyin.",
    min: 90,
    v3: 0,
  },
];

const safe: Case[] = [
  {
    id: 52,
    text: "Bank hesabı üzrə 12.400 AZN ödəniş və rekvizit məlumatı daxili hesabatda qeyd edilmişdir. Yalnız məlumatlandırma məqsədi daşıyır.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 54,
    text: "Parolunuzu və OTP kodunuzu heç kimlə paylaşmayın. Bank hesabı məlumatını da verməyin.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
  {
    id: 55,
    text: "Bank sizdən ödəniş tələb etmir. Köçürmə etmək üçün ehtiyac yoxdur.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
  {
    id: 56,
    text: "Do not share your password or OTP. A transfer is not required.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
  {
    id: 60,
    text: "Heç bir ödəniş tələb edilmir. Hesab məlumatlarınızı göndərməyin.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
  {
    id: 61,
    text: "Ödəniş həyata keçirilmişdir və bank hesabında qeydə alınmışdır. Yalnız məlumatlandırma məqsədi daşıyır.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 62,
    text: "Rekvizitlər yenilənmişdir və daxili hesabatda qeyd edilmişdir. 8.200 AZN qalıq hazırlanmışdır.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 63,
    text: "Yeni bank hesabı məlumatı daxili hesabatda qeyd edilmişdir. İcra ediləcək prosedur daxili arxivdə saxlanılacaq.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 64,
    text: "Növbəti ödəniş planlaşdırılır. Məbləğ 3.500 AZN olacaq və daxili arxivdə saxlanılacaq.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 65,
    text: "IT şöbəsi sizdən parol və ya OTP tələb etməyəcək.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
  {
    id: 66,
    text: "Köçürmə icra ediləcək və sənədlər daxili arxivdə saxlanılacaq.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 67,
    text: "Əlavə sualınız olarsa maliyyə şöbəsinə müraciət edə bilərsiniz. Bu, iş saatları haqqında məlumatdır.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 68,
    text: "Şübhəli keçidə daxil olmayın. OTP kodunu verməyin və faylı açmayın.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
  {
    id: 69,
    text: "Kassa iş saatları haqqında: 09:00-18:00. Ödəniş pəncərəsi yenilənmişdir.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 70,
    text: "No action required. Never ask anyone for a PIN or password.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
  {
    id: 71,
    text: "Bu məktub yalnız məlumatlandırma məqsədi daşıyır. Bank balansı 900 AZN təşkil edir.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 72,
    text: "Rüblük maliyyə hesabatı hazırlanmışdır. Rekvizitlər daxili hesabatda qeyd edilmişdir.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 73,
    text: "Vergi ödənişi gözlənilmir. Hesabat qeydə alınmışdır.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 74,
    text: "Əlavə köçürmə lazım deyil. Bütün məbləğ həyata keçirilmişdir.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 75,
    text: "Kart məlumatı tələb olunmur. Ödəniş artıq qeydə alınmışdır.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 76,
    text: "Şübhəli əlavəni açmayın. Bu, yalnız məlumatlandırma məqsədi daşıyır.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 77,
    text: "Tərəfdaşlar parol tələb etməyəcəklər. Daxili prosedur yenilənmişdir.",
    max: 15,
    v3: 0,
    v1max: 10,
  },
  {
    id: 78,
    text: "Ödəniş tələb olunmur. Bank hesabı məlumatını paylaşmayın və göndərməyin.",
    max: 10,
    v3: 0,
    v1max: 10,
  },
];

const reportBody =
  "Hörmətli həmkarlar, rüblük ödəniş həyata keçirilmişdir. 18.500 AZN bank hesabında qeydə alınmışdır. Hesabat hazırlanmışdır və daxili arxivdə saxlanılacaq.";
const reportFull = `${reportBody} Heç bir ödəniş tələb edilmir.`;

for (const item of dangerous) {
  const { report, score } = vector(item.text, item.url ?? "");
  console.log(`#${item.id} ${report.overall}% V1=${score.V1} V2=${score.V2} V3=${score.V3} V4=${score.V4} domain=${report.domain} ${report.quarantine}`);
  expect(report.overall >= (item.min ?? 90) && report.overall <= 100, `#${item.id} risk ${report.overall} should be 90-100`);
  expect(report.quarantine === "alindi", `#${item.id} should quarantine`);
  if (item.v3 !== undefined) expect(score.V3 === item.v3, `#${item.id} V3 ${score.V3} should be ${item.v3}`);
  expect(consistent(item.text, item.url ?? ""), `#${item.id} formula matches vectors`);
  expect(!report.findings.some((line) => line.includes("Kiber Divar")), `#${item.id} has no hidden cyber wall`);
}

for (const item of safe) {
  const { report, score } = vector(item.text, item.url ?? "https://portal.sirket.az/hesabat");
  console.log(`#${item.id} ${report.overall}% V1=${score.V1} V2=${score.V2} V3=${score.V3} V4=${score.V4} domain=${report.domain} ${report.quarantine}`);
  expect(report.overall >= 0 && report.overall <= (item.max ?? 15), `#${item.id} risk ${report.overall} should be 0-${item.max}`);
  expect(report.quarantine === "tehlukesiz", `#${item.id} should not quarantine`);
  expect(score.V3 === 0, `#${item.id} V3 should be 0`);
  expect(score.V1 <= (item.v1max ?? 10), `#${item.id} V1 ${score.V1} should be 0-10`);
  expect(consistent(item.text, item.url ?? "https://portal.sirket.az/hesabat"), `#${item.id} formula matches vectors`);
}

const full = vector(reportFull, "https://portal.sirket.az/hesabat");
const body = vector(reportBody, "https://portal.sirket.az/hesabat");
console.log(`#79 full ${full.report.overall}% body ${body.report.overall}%`);
expect(full.report.overall < 15 && full.report.quarantine === "tehlukesiz", `#79 full risk ${full.report.overall}`);
expect(body.report.overall < 15 && body.report.quarantine === "tehlukesiz", `#79 without negation ${body.report.overall} must stay under 15`);
expect(body.score.V1 <= 10 && body.score.V3 === 0, `#79 body vectors V1=${body.score.V1} V3=${body.score.V3}`);
expect(full.report.reasoning.some((step) => step.includes("İnkar/neytral kontekst") && step.includes("tələb edilmir")), "#79 quotes the negation");
expect(full.report.reasoning.some((step) => step.includes("Çəkili bal") && step.includes("V1:")), "#79 shows the weighted formula");

for (const word of ["bank", "hesab", "ödəniş", "AZN", "rekvizit"]) {
  const { report } = vector(word);
  expect(report.overall <= 25 && report.quarantine === "tehlukesiz", `single word «${word}» is ${report.overall}% ${report.quarantine}`);
}

const obfuscated = vector("p.u.l göndərin, təcili. h3sab nömrəsi gözləyir.");
expect(obfuscated.report.overall >= 90, `obfuscated transfer ${obfuscated.report.overall}`);
expect(obfuscated.report.reasoning.some((step) => step.includes("p.u.l")), "step 1 quotes p.u.l");

for (const template of phishingTemplates) {
  const report = analyzePhishing(template.text, template.url);
  console.log(`template ${template.id}: ${report.overall}% ${report.quarantine}`);
  if (template.tone === "tehlukeli") expect(report.overall >= 70, `${template.id} ${report.overall}`);
  else expect(report.overall <= 15, `${template.id} ${report.overall}`);
}

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all regression checks passed");
