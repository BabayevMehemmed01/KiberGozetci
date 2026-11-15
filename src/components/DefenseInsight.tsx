export function DefenseInsight({
  techniques,
  steps,
  stacked = false,
}: {
  techniques: { code: string; name: string }[];
  steps: string[];
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
      <div>
        <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">MITRE ATT&CK</div>
        <ul className="mt-2 space-y-2">
          {techniques.map((technique) => (
            <li key={`${technique.code}-${technique.name}`} className="rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-2">
              <div className="font-mono text-xs text-cyan-200">{technique.code}</div>
              <div className="text-sm text-slate-200">{technique.name}</div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[11px] font-bold tracking-[0.16em] text-cyan-300">İZAHOLUNAN QƏRAR AĞACI</div>
        <ol className="mt-2 space-y-2">
          {steps.map((step, index) => (
            <li key={step} className="rounded-xl border border-[#1E293B] bg-[#060B14] px-3 py-2 text-sm leading-6 text-slate-300">
              <span className="mr-2 font-mono text-cyan-300">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
