import { useMemo, useState } from "react";
import { Link2, ShieldBan } from "lucide-react";
import { phishingTemplates } from "../data/mockData.ts";
import { analyzePhishing, type PhishingReport } from "../lib/phishingEngine.ts";
import { useSoc } from "../context/SocContext.tsx";
import { DefenseInsight } from "./DefenseInsight.tsx";
import { Meter, Panel } from "./ui.tsx";
import { cn } from "../lib/utils.ts";

const QUARANTINE = {
  alindi: {
    status: "TƏTBİQ OLUNDU",
    className: "border-red-400/40 bg-red-500/10 text-red-100",
  },
  nezaret: {
    status: "NƏZARƏT REJİMİ",
    className: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  },
  tehlukesiz: {
    status: "TƏLƏB OLUNMUR",
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  },
} as const;

export function PhishingAnalyzer() {
  const { registerPhishingBlock } = useSoc();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<PhishingReport | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [loggedKey, setLoggedKey] = useState("");

  const dirty = report !== null && snapshot !== `${text}||${url}`;
  const quarantine = report ? QUARANTINE[report.quarantine] : null;
  const canLog = report !== null && report.quarantine !== "tehlukesiz" && loggedKey !== `${text}||${url}`;

  function run(nextText = text, nextUrl = url) {
    if (!nextText.trim() && !nextUrl.trim()) return;
    const next = analyzePhishing(nextText, nextUrl);
    setText(nextText);
    setUrl(nextUrl);
    setReport(next);
    setSnapshot(`${nextText}||${nextUrl}`);
  }

  const highlighted = useMemo(() => report?.highlights ?? [], [report]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-cyan-300">1-Cİ MÜDAFİƏ XƏTTİ</p>
        <h2 className="mt-1 text-xl font-bold text-white">Fişinq və sosial mühəndislik analizatoru</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Mətn və keçid yerli alqoritmlə yoxlanılır. Azərbaycan, ingilis, rus və türk dillərindəki tələskənlik sözləri, saxta domenlər, kart və IBAN izləri qırmızı ilə işarələnir.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {phishingTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => run(template.text, template.url)}
            className={cn(
              "rounded-xl border px-3 py-2 text-left",
              template.tone === "tehlukesiz"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-red-400/30 bg-red-400/10 text-red-100",
            )}
          >
            <span className="block text-xs font-bold">{template.title}</span>
            <span className="block text-[11px] opacity-75">{template.description}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <label className="mb-2 block text-sm font-semibold text-slate-200" htmlFor="phish-text">
            E-poçt və ya mesaj mətni
          </label>
          <textarea
            id="phish-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            placeholder="Şübhəli məktubu bura yapışdırın..."
            className="w-full resize-y rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
          />
          <label className="mt-4 mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200" htmlFor="phish-url">
            <Link2 className="h-4 w-4 text-cyan-300" />
            Keçid (URL)
          </label>
          <input
            id="phish-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://numune-kecid.example/yoxla"
            className="w-full rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-2.5 font-mono text-sm outline-none placeholder:text-slate-600"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{text.trim().length} simvol</span>
            <button
              type="button"
              onClick={() => run()}
              disabled={!text.trim() && !url.trim()}
              className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Analiz Et
            </button>
          </div>
        </Panel>

        <Panel>
          {!report || !quarantine ? (
            <div className="grid h-full min-h-[280px] place-items-center text-center">
              <div>
                <ShieldBan className="mx-auto mb-3 h-8 w-8 text-cyan-300" />
                <p className="text-sm text-slate-300">Hazır nümunə seçin və ya mətn yapışdırıb analizi başladın.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn("rounded-2xl border px-4 py-3", quarantine.className)}>
                <div className="text-[11px] font-bold tracking-[0.16em]">AVTOMATİK KARANTİNƏ AL</div>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="font-mono text-4xl font-semibold">{report.overall}%</div>
                  <div className="text-right text-sm font-bold">{quarantine.status}</div>
                </div>
                <p className="mt-1 text-xs opacity-80">Ümumi təhlükə faizi</p>
              </div>
              {dirty ? <p className="text-xs text-amber-300">Mətn dəyişib. Nəticəni yeniləmək üçün «Analiz Et» düyməsinə basın.</p> : null}
              <Meter label="Tələskənlik taktikası" value={report.urgency} intent="risk" />
              <Meter label="Saxta domen riski" value={report.domain} intent="risk" />
              <Meter label="Üslub uyğunsuzluğu" value={report.style} intent="risk" />
              <Meter label="Məlumat oğurluğu ehtimalı" value={report.theft} intent="risk" />
              <DefenseInsight
                techniques={
                  report.quarantine === "tehlukesiz"
                    ? [{ code: "—", name: "Uyğun hücum texnikası yoxdur" }]
                    : [
                        { code: "T1566.002", name: "Spearphishing Link" },
                        ...(report.theft >= 28 ? [{ code: "T1056", name: "Input Capture" }] : []),
                      ]
                }
                steps={[
                  `Təcililik balı ${report.urgency} ümumi riskə 36% çəki ilə daxil olur.`,
                  `Domen balı ${report.domain} 30% çəki daşıyır.`,
                  `Üslub balı ${report.style} 16%, oğurluq balı ${report.theft} 18% çəki daşıyır.`,
                  report.quarantine === "alindi"
                    ? `Cəm ${report.overall}% karantin həddi olan 70-i keçir, ona görə mesaj təcrid olunur.`
                    : report.quarantine === "nezaret"
                      ? `Cəm ${report.overall}% nəzarət zolağındadır (40–69).`
                      : `Cəm ${report.overall}% təhlükəsiz həddin altındadır.`,
                ]}
              />
              <button
                type="button"
                disabled={!canLog}
                onClick={() => {
                  registerPhishingBlock(`Karantin: ${report.overall}% riskli mesaj`);
                  setLoggedKey(`${text}||${url}`);
                }}
                className="w-full rounded-xl border border-red-400/40 bg-red-500/15 py-2.5 text-sm font-bold text-red-100 disabled:opacity-40"
              >
                {canLog ? "Karantinə sal və jurnala yaz" : report.quarantine === "tehlukesiz" ? "Karantin tələb olunmur" : "Jurnalda qeyd olundu"}
              </button>
            </div>
          )}
        </Panel>
      </div>

      {report ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-white">İşarələnmiş mətn</h3>
            <p className="max-h-64 overflow-auto text-sm leading-7 whitespace-pre-wrap text-slate-200">
              {highlighted.map((part, index) =>
                part.hit ? (
                  <mark key={`${index}-${part.text}`} className="rounded bg-red-500/25 px-0.5 font-semibold text-red-200">
                    {part.text}
                  </mark>
                ) : (
                  <span key={`${index}-plain`}>{part.text}</span>
                ),
              )}
            </p>
            {report.matchedTerms.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {report.matchedTerms.map((term) => (
                  <span key={term} className="rounded-full border border-red-400/30 px-2 py-1 text-[11px] text-red-200">
                    {term}
                  </span>
                ))}
              </div>
            ) : null}
          </Panel>
          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-white">Aşkarlanan əlamətlər</h3>
            {report.analyzedUrl ? <p className="mb-3 font-mono text-xs break-all text-cyan-200">{report.analyzedUrl}</p> : null}
            <ul className="space-y-2 text-sm text-slate-300">
              {report.findings.map((finding) => (
                <li key={finding} className="rounded-lg border border-[#1E293B] bg-[#060B14] px-3 py-2">
                  {finding}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
