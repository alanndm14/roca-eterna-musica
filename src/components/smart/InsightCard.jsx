import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Button } from "../ui/Button";

const iconBySeverity = {
  oportunidad: Lightbulb,
  atención: AlertTriangle,
  informativo: Info
};

export function InsightCard({ insight, onAction }) {
  const Icon = iconBySeverity[insight.severity] || Info;
  const tone = insight.severity === "atención" ? "text-yellow-700 bg-yellow-500/12" : insight.severity === "oportunidad" ? "text-brass bg-brass/12" : "text-blue-gray bg-blue-gray/12";
  return (
    <article className="rounded-[1.4rem] border border-white/60 bg-white/74 p-4 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/45">{insight.severity}</p>
          <h3 className="mt-1 font-bold text-ink">{insight.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/62">{insight.message}</p>
          {insight.action ? <Button variant="subtle" className="mt-3 h-9 px-3 text-xs" onClick={onAction}>{insight.action}</Button> : null}
        </div>
      </div>
    </article>
  );
}
