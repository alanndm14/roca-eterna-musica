import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info, ShieldAlert } from "lucide-react";
import { ScoreBadge } from "./ScoreBadge";

const alertStyles = {
  important: { icon: ShieldAlert, className: "border-red-300 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100" },
  warning: { icon: AlertCircle, className: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-400/25 dark:bg-yellow-500/10 dark:text-yellow-100" },
  info: { icon: Info, className: "border-blue-gray/25 bg-blue-gray/10 text-ink dark:text-white/80" },
  success: { icon: CheckCircle2, className: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100" }
};

export function ServiceReviewPanel({ review }) {
  const [openGroups, setOpenGroups] = useState({});
  const groups = review.groups || [];
  return (
    <section className="rounded-[1.75rem] border border-white/60 bg-white/76 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Revisión inteligente</p>
          <h2 className="mt-1 text-2xl font-black text-ink">{review.status}</h2>
          <p className="mt-1 text-sm text-ink/60">Preparación del servicio: {review.score}%</p>
        </div>
        <ScoreBadge score={review.score} label="Preparación" />
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-brass" style={{ width: `${review.score || 0}%` }} />
      </div>

      {groups.length ? (
        <div className="mt-5 grid gap-3">
          {groups.map((group) => {
            const config = alertStyles[group.severity] || alertStyles.info;
            const Icon = config.icon;
            const open = openGroups[group.title] ?? true;
            return (
              <article key={group.title} className={`rounded-2xl border p-3 ${config.className}`}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((current) => ({ ...current, [group.title]: !open }))}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="block font-bold">{group.title}</span>
                      <span className="text-sm opacity-80">{group.items.length} pendiente(s)</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open ? (
                  <ul className="mt-3 space-y-1 pl-7 text-sm leading-6 opacity-85">
                    {group.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100">
          No se detectaron faltantes importantes para este servicio.
        </div>
      )}
    </section>
  );
}
