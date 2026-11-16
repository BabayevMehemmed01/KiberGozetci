import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSoc } from "../context/SocContext.tsx";
import { StatusPill } from "./ui.tsx";
import { cn, fullName, scoreTone, workHours } from "../lib/utils.ts";
import type { TestOutcome } from "../types.ts";

const TEST_LABEL: Record<TestOutcome, string> = {
  ugurlu: "Uğurlu",
  qismen: "Qismən",
  ugursuz: "Uğursuz",
};

export function EmployeeTable() {
  const { employees, sendPhishingTrap, toggleFreeze, simulationLocked, lockedEmployeeId } = useSoc();
  const [query, setQuery] = useState("");
  const [riskFirst, setRiskFirst] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("az-AZ");
    return employees
      .filter((employee) => {
        if (!needle) return true;
        const haystack = `${fullName(employee)} ${employee.position} ${employee.department}`.toLocaleLowerCase("az-AZ");
        return haystack.includes(needle);
      })
      .sort((a, b) => (riskFirst ? a.awarenessScore - b.awarenessScore : b.awarenessScore - a.awarenessScore));
  }, [employees, query, riskFirst]);

  function runTest(id: string) {
    const employee = employees.find((item) => item.id === id);
    if (!employee) return;
    setPendingId(id);
    void sendPhishingTrap(fullName(employee)).finally(() => {
      setPendingId((current) => (current === id ? null : current));
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad, vəzifə və ya şöbə axtar"
            className="w-full rounded-xl border border-[#1E293B] bg-[#060B14] py-2.5 pr-3 pl-9 text-sm outline-none placeholder:text-slate-600"
          />
        </label>
        <button
          type="button"
          onClick={() => setRiskFirst((value) => !value)}
          className="rounded-xl border border-[#1E293B] px-3 py-2.5 text-xs font-semibold text-slate-300 hover:border-cyan-400/40"
        >
          {riskFirst ? "Ən riskli yuxarıda" : "Ən sayıq yuxarıda"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-[11px] tracking-wide text-slate-500 uppercase">
            <tr className="border-b border-[#1E293B]">
              <th className="px-2 py-3 font-medium">Əməkdaş</th>
              <th className="px-2 py-3 font-medium">Vəzifə</th>
              <th className="px-2 py-3 font-medium">Şöbə</th>
              <th className="px-2 py-3 font-medium">İş saatı</th>
              <th className="px-2 py-3 font-medium">Orta yükləmə</th>
              <th className="px-2 py-3 font-medium">Kiber-sayıqlıq</th>
              <th className="px-2 py-3 font-medium">Son test</th>
              <th className="px-2 py-3 font-medium">Status</th>
              <th className="px-2 py-3 font-medium">Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((employee) => {
              const tone = scoreTone(employee.awarenessScore);
              const bar = tone === "good" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : "bg-red-400";
              return (
                <tr
                  key={employee.id}
                  className={cn(
                    "border-b border-[#1E293B]/80",
                    simulationLocked && employee.id === lockedEmployeeId && "bg-red-500/10",
                  )}
                >
                  <td className="px-2 py-3">
                    <div className="font-semibold text-slate-100">{fullName(employee)}</div>
                    <div className="text-[11px] text-slate-500">{employee.email}</div>
                  </td>
                  <td className="px-2 py-3 text-slate-300">{employee.position}</td>
                  <td className="px-2 py-3 text-slate-400">{employee.department}</td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-300">{workHours(employee)}</td>
                  <td className="px-2 py-3 text-slate-300">{employee.avgDailyDownloads} fayl/gün</td>
                  <td className="px-2 py-3">
                    <div className="mb-1 font-mono text-xs text-slate-200">{employee.awarenessScore}</div>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#1E293B]">
                      <div className={cn("h-full rounded-full", bar)} style={{ width: `${employee.awarenessScore}%` }} />
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className={cn("text-xs font-semibold", employee.lastTestStatus === "ugurlu" ? "text-emerald-300" : employee.lastTestStatus === "qismen" ? "text-amber-300" : "text-red-300")}>
                      {TEST_LABEL[employee.lastTestStatus]}
                    </div>
                    <div className="max-w-[180px] text-[11px] text-slate-500">{employee.lastTestResult}</div>
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill status={employee.status} />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={pendingId === employee.id}
                        onClick={() => runTest(employee.id)}
                        className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100 disabled:opacity-60"
                      >
                        {pendingId === employee.id ? "Göndərilir..." : "Sınaq Göndər"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFreeze(employee.id)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold",
                          employee.status === "Dondurulub"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                            : "border-red-400/30 bg-red-400/10 text-red-100",
                        )}
                      >
                        {employee.status === "Dondurulub" ? "Aktivləşdir" : "Hesabı Dondur"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Uyğun əməkdaş tapılmadı.</p> : null}
      </div>
    </div>
  );
}
