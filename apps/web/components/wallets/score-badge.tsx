type ScoreBadgeProps = {
  score: number;
};

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const tone =
    score >= 90
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : score >= 80
        ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
        : "border-slate-600/50 bg-slate-700/20 text-slate-300";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {score}
    </span>
  );
}

