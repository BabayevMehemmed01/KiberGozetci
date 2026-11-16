import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GraduationCap } from "lucide-react";
import { questionsFor } from "../data/mockData.ts";
import { getBreach, hourlyProfile, profileStats, simulationBreach } from "../lib/behavior.ts";
import { useSoc } from "../context/SocContext.tsx";
import { DefenseInsight } from "./DefenseInsight.tsx";
import { Panel } from "./ui.tsx";
import { cn, fullName, workHours } from "../lib/utils.ts";

export function InsiderTracker() {
  const { employees, simulationLocked, applyTraining, lockedEmployeeId, toggleFreeze, sendPhishingTrap } = useSoc();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [sendingTrap, setSendingTrap] = useState(false);
  const [showBreach, setShowBreach] = useState(true);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const employee = employees.find((item) => item.id === employeeId) ?? employees[0];
  const story = simulationLocked && employee.id === lockedEmployeeId ? simulationBreach(employee) : getBreach(employee.id);
  const points = useMemo(() => hourlyProfile(employee, showBreach, story), [employee, showBreach, story]);
  const stats = useMemo(() => profileStats(points), [points]);
  const questions = useMemo(() => questionsFor(employee.department), [employee.department]);

  useEffect(() => {
    if (!simulationLocked || !lockedEmployeeId) return;
    setEmployeeId(lockedEmployeeId);
    setShowBreach(true);
  }, [simulationLocked, lockedEmployeeId]);

  useEffect(() => {
    setStep(0);
    setPicked(null);
    setFinished(false);
    setCorrectCount(0);
  }, [employeeId]);

  const question = questions[Math.min(step, questions.length - 1)];
  const pickedOption = question.options.find((option) => option.id === picked);

  function selectEmployee(id: string) {
    setEmployeeId(id);
    setShowBreach(true);
  }

  function advance() {
    if (!pickedOption) return;
    const nextCorrect = correctCount + (pickedOption.correct ? 1 : 0);
    if (step === questions.length - 1) {
      setCorrectCount(nextCorrect);
      setFinished(true);
      applyTraining(employee.id, nextCorrect);
      return;
    }
    setCorrectCount(nextCorrect);
    setPicked(null);
    setStep((value) => value + 1);
  }

  function handleSendTrap() {
    const selectedEmployee = employees.find((item) => item.id === employeeId);
    if (!selectedEmployee) return;
    setSendingTrap(true);
    void sendPhishingTrap(fullName(selectedEmployee)).finally(() => setSendingTrap(false));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-cyan-300">3-CÜ MÜDAFİƏ XƏTTİ</p>
        <h2 className="mt-1 text-xl font-bold text-white">Daxili davranış izləyicisi və kiber-sayıqlıq təlimi</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Hər əməkdaşın normal iş ritmi ilə şübhəli fəaliyyət müqayisə olunur. Sayıqlığı artırmaq üçün üç suallıq mini test balı yeniləyir.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-[240px] flex-1 text-sm">
              <span className="mb-1.5 block text-slate-400">Əməkdaş profili</span>
              <select
                value={employee.id}
                onChange={(event) => selectEmployee(event.target.value)}
                className="w-full cursor-pointer rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-2.5 outline-none"
              >
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {fullName(item)} — {item.position}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={sendingTrap}
              onClick={handleSendTrap}
              className="cursor-pointer rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2.5 text-xs font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingTrap ? "Göndərilir..." : "Sınaq Göndər"}
            </button>
            <button
              type="button"
              onClick={() => setShowBreach((value) => !value)}
              className="cursor-pointer rounded-xl border border-[#1E293B] px-3 py-2.5 text-xs font-semibold text-slate-200"
            >
              {showBreach ? "Şübhəli aktivlik açıqdır" : "Şübhəli aktivliyi göstər"}
            </button>
          </div>
          <div className="mb-3 text-xs text-slate-400">
            {fullName(employee)} · {employee.department} · növbə {workHours(employee)} · norma {employee.avgDailyDownloads} fayl/gün
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 680, height: 280 }}>
              <BarChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" vertical={false} />
                <XAxis dataKey="hour" interval={2} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(6, 182, 212, 0.08)" }}
                  contentStyle={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, color: "#F8FAFC" }}
                  labelStyle={{ color: "#E2E8F0" }}
                  itemStyle={{ color: "#E2E8F0" }}
                  formatter={(value, name, item) => {
                    const payload = item.payload as { fakt?: number; norma?: number };
                    if (name === "Qeydə alınan") {
                      return [`${(payload.fakt ?? Number(value)).toLocaleString("az-AZ")} fayl`, "Qeydə alınan"];
                    }
                    return [`${Number(payload.norma ?? value).toLocaleString("az-AZ")} fayl`, "Normal temp"];
                  }}
                />
                <Bar dataKey="norma" name="Normal temp" fill="#334155" radius={[3, 3, 0, 0]} />
                <Bar dataKey="shown" name="Qeydə alınan" radius={[3, 3, 0, 0]}>
                  {points.map((point) => (
                    <Cell key={point.hour} fill={point.breach ? "#EF4444" : "#06B6D4"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {showBreach && story ? (
            <p className="mt-2 text-xs text-slate-500">Qırmızı sütun şkala tavanında göstərilir. Həqiqi say sağ paneldədir.</p>
          ) : null}
        </Panel>

        <Panel className={cn("space-y-4", simulationLocked && employee.id === lockedEmployeeId && "border-red-400/50")}>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-3">
              <div className="text-[11px] font-bold tracking-wide text-slate-500">Z-SCORE</div>
              <div className="mt-1 font-mono text-2xl text-white">{stats.zScore.toLocaleString("az-AZ", { maximumFractionDigits: 1 })}</div>
              <p className="text-[11px] text-slate-500">σ = {stats.deviation.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-3">
              <div className="text-[11px] font-bold tracking-wide text-slate-500">RİSK İNDEKSİ</div>
              <div className={cn("mt-1 font-mono text-2xl", stats.risk >= 70 ? "text-red-200" : "text-amber-200")}>{stats.risk}</div>
              <p className="text-[11px] text-slate-500">saat {stats.hour}:00 zirvəsi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleFreeze(employee.id)}
            className="w-full cursor-pointer rounded-xl border border-red-400/35 bg-red-500/10 py-2.5 text-sm font-bold text-red-50"
          >
            {employee.status === "Dondurulub" ? "Hesab dondurulub — aktivləşdir" : "Hesabı dərhal dondur"}
          </button>
          {showBreach ? (
            <div>
              <div className="text-[11px] font-bold tracking-[0.16em] text-red-300">ANOMALİYA</div>
              <h3 className="mt-2 text-lg font-bold text-white">{story.title}</h3>
              <div className="mt-4 font-mono text-4xl font-semibold text-red-200">{story.files.toLocaleString("az-AZ")}</div>
              <p className="text-xs text-slate-400">fayl · norma {employee.avgDailyDownloads}/gün · IP {story.sourceIp}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{story.detail}</p>
              <p className="mt-3 text-sm font-semibold text-amber-200">
                Sapma: təxminən {Math.round(story.files / employee.avgDailyDownloads).toLocaleString("az-AZ")} dəfə norma.
              </p>
            </div>
          ) : (
            <div>
              <div className="text-[11px] font-bold tracking-[0.16em] text-emerald-300">NORMAL RİTM</div>
              <h3 className="mt-2 text-lg font-bold text-white">Şübhəli sütun gizlədilib</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {fullName(employee)} üçün baza ritmi iş saatı {workHours(employee)} aralığına və gündəlik {employee.avgDailyDownloads} fayl normasına görə qurulub.
              </p>
            </div>
          )}
          <DefenseInsight
            stacked
            techniques={[
              { code: story.mitre.split(" — ")[0] ?? story.mitre, name: story.mitre.split(" — ")[1] ?? "Exfiltration" },
              { code: "T1078", name: "Valid Accounts" },
            ]}
            steps={[
              `Normal ritm ${employee.department} şöbəsinin növbəsinə və ${employee.avgDailyDownloads} fayl/gün limitinə görə fərdi qurulur.`,
              `Zirvə saat ${stats.hour}:00-da ${stats.files.toLocaleString("az-AZ")} fayldır. Saatlıq norma σ = ${stats.deviation.toFixed(2)}.`,
              `Z-score = (müşahidə − norma) / σ = ${stats.zScore.toLocaleString("az-AZ", { maximumFractionDigits: 1 })}.`,
              `Risk indeksi ${stats.risk}/100 bu sapmadan törəyir. Hədd yüksəkdirsə hesab dondurulur.`,
            ]}
          />
        </Panel>
      </div>

      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-semibold text-white">Mini kiber-test · {fullName(employee)}</h3>
          <span className="ml-auto text-[11px] text-slate-500">
            {question.track === "maliyye" ? "Maliyyə sual bankı" : question.track === "it" ? "İT sual bankı" : "Logistika və digər şöbələr"}
          </span>
        </div>
        {finished ? (
          <div className="rounded-2xl border border-emerald-700/30 bg-emerald-100 p-4 text-emerald-800">
            <div className="font-mono text-3xl text-emerald-800">{correctCount}/3</div>
            <p className="mt-2 text-sm font-semibold text-emerald-800">
              {correctCount >= 2
                ? "Düzgün reaksiyalar sayıqlıq balına yazıldı."
                : "Zəif nəticə. Təzyiq, dipfeyk və gecə ixracı qaydalarını bir daha nəzərdən keçirin."}
            </p>
            <button
              type="button"
              onClick={() => {
                setFinished(false);
                setStep(0);
                setPicked(null);
                setCorrectCount(0);
              }}
              className="mt-4 cursor-pointer rounded-xl border border-cyan-800/40 px-3 py-2 text-xs font-bold text-cyan-800"
            >
              Testi yenidən başlat
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-3 text-xs text-slate-500">Sual {step + 1} / 3</div>
            <h4 className="text-base font-semibold leading-7 text-white">{question.prompt}</h4>
            <div className="mt-4 space-y-2">
              {question.options.map((option) => {
                const selected = picked === option.id;
                const revealed = picked !== null;
                const good = revealed && option.correct;
                const bad = revealed && selected && !option.correct;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPicked(option.id)}
                    className={cn(
                      "block w-full cursor-pointer rounded-xl border px-3 py-3 text-left text-sm",
                      good && "border-emerald-400/50 bg-emerald-400/10",
                      bad && "border-red-400/50 bg-red-400/10",
                      !good && !bad && "border-[#1E293B] bg-[#060B14] hover:border-cyan-400/30",
                    )}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>
            {pickedOption ? <p className="mt-3 text-sm leading-6 text-slate-300">{question.explain}</p> : null}
            <button
              type="button"
              disabled={!picked}
              onClick={advance}
              className="mt-4 cursor-pointer rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === questions.length - 1 ? "Nəticəni yaz" : "Növbəti sual"}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
