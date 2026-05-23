import { AlertCircle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { ScoreBadge } from "./ScoreBadge";

const alertStyles = {
  important: { icon: ShieldAlert, className: "border-red-300 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100" },
  warning: { icon: AlertCircle, className: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-400/25 dark:bg-yellow-500/10 dark:text-yellow-100" },
  info: { icon: Info, className: "border-blue-gray/25 bg-blue-gray/10 text-ink dark:text-white/80" },
  success: { icon: CheckCircle2, className: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100" }
};

export function ServiceReviewPanel({ review }) {
  return (
    <section className="rounded-[1.75rem] border border-white/60 bg-white/76 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Revisión inteligente</p>
          <h2 className="mt-1 text-2xl font-black text-ink">{review.status}</h2>
          <p className="mt-1 text-sm text-ink/60">Preparación del servicio: {review.score}/100</p>
        </div>
        <ScoreBadge score={review.score} label="Preparación" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {review.alerts.map((alert, index) => {
          const config = alertStyles[alert.severity] || alertStyles.info;
          const Icon = config.icon;
          return (
            <article key={`${alert.title}-${index}`} className={`rounded-2xl border p-3 ${config.className}`}>
              <div className="flex gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">{alert.title}</p>
                  <p className="mt-1 text-sm leading-5 opacity-80">{alert.message}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
