export function ReasonChips({ reasons = [], warnings = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {reasons.slice(0, 5).map((reason) => (
        <span key={reason} className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-100">
          {reason}
        </span>
      ))}
      {warnings.slice(0, 4).map((warning) => (
        <RiskBadge key={warning}>{warning}</RiskBadge>
      ))}
    </div>
  );
}

export function RiskBadge({ children }) {
  return (
    <span className="rounded-full bg-yellow-500/12 px-3 py-1 text-xs font-bold text-yellow-800 dark:text-yellow-100">
      {children}
    </span>
  );
}
