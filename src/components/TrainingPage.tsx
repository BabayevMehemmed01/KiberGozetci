import { useEffect, useMemo, useState } from "react";
import { CircleCheck, ShieldAlert } from "lucide-react";
import { employees as seedEmployees, questionsFor } from "../data/mockData.ts";
import { appendTrainingRecord, normalizeEmployeeName } from "../lib/trainingSync.ts";
import { cn, fullName } from "../lib/utils.ts";

type Phase = "quiz" | "success" | "closed";

function readEmployeeName(): string {
  return new URLSearchParams(window.location.search).get("emp")?.trim().replace(/\s+/g, " ") ?? "";
}

export function TrainingPage() {
  const [employeeName] = useState(readEmployeeName);
  const [phase, setPhase] = useState<Phase>(() => {
    const name = readEmployeeName();
    if (!name) return "quiz";
    return sessionStorage.getItem("kibergozetci-training-done") === normalizeEmployeeName(name) ? "closed" : "quiz";
  });
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const employee = seedEmployees.find((item) => normalizeEmployeeName(fullName(item)) === normalizeEmployeeName(employeeName));
  const questions = useMemo(() => questionsFor(employee?.department ?? "Digər").slice(0, 3), [employee?.department]);
  const question = questions[Math.min(step, Math.max(questions.length - 1, 0))];
  const pickedOption = question?.options.find((option) => option.id === picked);

  useEffect(() => {
    const stored = localStorage.getItem("kibergozetci-theme");
    const theme = stored === "daylight" || stored === "emerald" || stored === "violet" || stored === "cyber" ? stored : "cyber";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "daylight" ? "light" : "dark";
    document.title = "Kiber-təlim — KiberGözətçi";
  }, []);

  useEffect(() => {
    if (!employeeName) return;
    const key = normalizeEmployeeName(employeeName);
    if (sessionStorage.getItem("kibergozetci-training-hit") === key) return;
    sessionStorage.setItem("kibergozetci-training-hit", key);
    appendTrainingRecord({ employeeName, kind: "clicked" });
  }, [employeeName]);

  useEffect(() => {
    if (phase !== "success") return;
    const timer = window.setTimeout(() => setPhase("closed"), 2800);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function advance() {
    if (!pickedOption || !question) return;
    const nextCorrect = correctCount + (pickedOption.correct ? 1 : 0);
    if (step >= questions.length - 1) {
      setCorrectCount(nextCorrect);
      if (employeeName) {
        const key = normalizeEmployeeName(employeeName);
        if (sessionStorage.getItem("kibergozetci-training-done") !== key) {
          sessionStorage.setItem("kibergozetci-training-done", key);
          appendTrainingRecord({ employeeName, kind: "restored" });
        }
      }
      setPhase("success");
      return;
    }
    setCorrectCount(nextCorrect);
    setPicked(null);
    setStep((value) => value + 1);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-xl">
        {phase === "closed" ? (
          <p className="text-center text-lg font-semibold text-slate-800 dark:text-slate-100">Pəncərəni bağlaya bilərsiniz</p>
        ) : null}

        {phase === "success" ? (
          <section className="relative overflow-hidden rounded-3xl border border-emerald-700/25 bg-emerald-100 px-6 py-10 text-center text-emerald-800 shadow-xl">
            {["8%", "22%", "38%", "54%", "70%", "86%"].map((left, index) => (
              <span
                key={left}
                className="confetti-bit"
                style={{
                  left,
                  background: index % 2 === 0 ? "#047857" : "#059669",
                  animationDelay: `${index * 0.06}s`,
                  ["--confetti-x" as string]: index % 2 === 0 ? "18px" : "-18px",
                }}
              />
            ))}
            <CircleCheck className="mx-auto h-12 w-12 text-emerald-800" aria-hidden />
            <p className="mt-4 text-2xl font-extrabold leading-snug text-emerald-800">Təbrik edirik! Sayıqlıq balınız bərpa edildi.</p>
          </section>
        ) : null}

        {phase === "quiz" ? (
          <div className="space-y-5">
            <section role="alert" className="rounded-3xl border border-red-700/30 bg-red-100 px-6 py-8 text-center text-red-800 shadow-xl">
              <ShieldAlert className="mx-auto h-10 w-10 text-red-800" aria-hidden />
              <p className="mt-4 text-2xl font-extrabold leading-snug">
                Siz simulyasiya edilmiş fişinq keçidinə kliklədiniz! Kiber-Sayıqlıq balınız 15 bal azaldıldı.
              </p>
              {employeeName ? <p className="mt-3 text-sm font-semibold text-red-900">Əməkdaş: {employeeName}</p> : null}
            </section>

            {question ? (
              <section className="rounded-3xl border border-slate-300 bg-white p-5 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <p className="text-xs font-bold tracking-[0.16em] text-slate-600 dark:text-slate-300">
                  Mini kiber-təlim · sual {step + 1} / {questions.length}
                </p>
                <h1 className="mt-3 text-lg font-bold leading-7">{question.prompt}</h1>
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
                          good && "border-emerald-700 bg-emerald-100 text-emerald-900",
                          bad && "border-red-700 bg-red-100 text-red-900",
                          !good && !bad && "border-slate-300 bg-slate-50 hover:border-cyan-700 dark:border-slate-600 dark:bg-slate-800",
                        )}
                      >
                        {option.text}
                      </button>
                    );
                  })}
                </div>
                {pickedOption ? <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{question.explain}</p> : null}
                <button
                  type="button"
                  disabled={!picked}
                  onClick={advance}
                  className="mt-4 cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950"
                >
                  {step === questions.length - 1 ? "Nəticəni yaz" : "Növbəti sual"}
                </button>
              </section>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
