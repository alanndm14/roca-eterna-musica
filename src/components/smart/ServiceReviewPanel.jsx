import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info, ShieldAlert } from "lucide-react";

const alertStyles = {
  important: { icon: ShieldAlert, className: "border-red-300 bg-red-50 text-red-900 dark:border-red-400/45 dark:bg-red-500/16 dark:text-red-50" },
  warning: { icon: AlertCircle, className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/45 dark:bg-amber-500/16 dark:text-amber-50" },
  info: { icon: Info, className: "border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-300/40 dark:bg-yellow-400/14 dark:text-yellow-50" },
  success: { icon: CheckCircle2, className: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/45 dark:bg-emerald-500/16 dark:text-emerald-50" }
};

function getRiskTone(score = 0) {
  const value = Number(score) || 0;
  if (value < 50) {
    return {
      label: "Riesgo alto",
      bar: "bg-red-600",
      badge: "border-red-300 bg-red-600 text-white dark:border-red-400/40 dark:bg-red-500 dark:text-white"
    };
  }
  if (value < 70) {
    return {
      label: "Riesgo medio-alto",
      bar: "bg-orange-600",
      badge: "border-orange-300 bg-orange-600 text-white dark:border-orange-400/40 dark:bg-orange-500 dark:text-white"
    };
  }
  if (value < 90) {
    return {
      label: "Riesgo medio",
      bar: "bg-yellow-500",
      badge: "border-yellow-300 bg-yellow-400 text-ink dark:border-yellow-300/45 dark:bg-yellow-400 dark:text-zinc-950"
    };
  }
  return {
    label: "Riesgo bajo",
    bar: "bg-emerald-500",
    badge: "border-emerald-300 bg-emerald-500 text-white dark:border-emerald-400/45 dark:bg-emerald-500 dark:text-white"
  };
}

function groupSummary(group = {}) {
  const count = group.items?.length || 0;
  if (group.title === "Faltan enlaces") return `${count} enlace(s) pendiente(s)`;
  if (group.title === "Faltan archivos") return `${count} archivo(s) pendiente(s)`;
  if (group.title === "Faltan revisiones") return `${count} revisión(es) pendiente(s)`;
  if (group.title === "Datos musicales incompletos") return `${count} dato(s) por completar`;
  if (group.title === "Rotacion" || group.title === "Rotación") return `${count} aviso(s) de rotación`;
  return `${count} pendiente(s)`;
}

export function ServiceReviewPanel({ review }) {
  const [openGroups, setOpenGroups] = useState({});
  const groups = review.groups || [];
  const score = Math.max(0, Math.min(100, Number(review.score) || 0));
  const risk = getRiskTone(score);
  const importantGroups = groups
    .filter((group) => group.severity !== "success")
    .sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0));

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/86 p-5 shadow-soft backdrop-blur-xl dark:border-white/12 dark:bg-zinc-950/74">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Revisión del servicio</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${risk.badge}`}>{risk.label}</span>
            <span className="text-sm font-bold text-ink/65">Preparación {score}%</span>
          </div>
        </div>
        <div className="min-w-48">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink/55">
            <span>Preparación</span>
            <span>{score}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-200 ring-1 ring-black/5 dark:bg-white/12 dark:ring-white/10">
            <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>

      {importantGroups.length ? (
        <div className="mt-5 grid gap-3">
          <p className="text-sm font-black text-ink">Problemas detectados</p>
          {importantGroups.map((group) => {
            const config = alertStyles[group.severity] || alertStyles.info;
            const Icon = config.icon;
            const open = openGroups[group.title] ?? false;
            return (
              <article key={group.title} className={`rounded-2xl border p-3 ${config.className}`}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((current) => ({ ...current, [group.title]: !open }))}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{group.title}</span>
                      <span className="text-sm opacity-85">{groupSummary(group)}</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open ? (
                  <ul className="mt-3 space-y-1 pl-7 text-sm leading-6 opacity-90">
                    {group.items.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
                    {group.items.length > 8 ? <li>Y {group.items.length - 8} más...</li> : null}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/14 dark:text-emerald-50">
          No se detectaron faltantes importantes para este servicio.
        </div>
      )}
    </section>
  );
}
