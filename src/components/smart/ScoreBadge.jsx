export function ScoreBadge({ score = 0, label = "Score", compact = false }) {
  const normalized = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = normalized >= 82 ? "bg-emerald-500" : normalized >= 62 ? "bg-brass" : "bg-yellow-500";
  return (
    <div className={compact ? "w-full min-w-0 sm:min-w-32" : "w-full min-w-0 sm:min-w-40"}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-ink/45">{label}</span>
        <span className="text-sm font-black text-ink">{normalized}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}
