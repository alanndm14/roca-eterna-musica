import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Info, ShieldAlert } from "lucide-react";

const alertStyles = {
  important: { icon: ShieldAlert, className: "border-red-300 bg-red-50 text-red-900 dark:border-red-400/55 dark:bg-red-950/70 dark:text-red-100" },
  warning: { icon: AlertCircle, className: "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-400/55 dark:bg-orange-950/70 dark:text-orange-100" },
  info: { icon: Info, className: "border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-400/50 dark:bg-yellow-950/65 dark:text-yellow-100" },
  success: { icon: CheckCircle2, className: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-950/65 dark:text-emerald-100" }
};

export function getRiskTone(score = 0) {
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
  if (group.title === "Enlaces de escucha") return `${count} enlace(s) informativo(s)`;
  return `${count} pendiente(s)`;
}

function filterGroups(groups = [], showInformative = true) {
  return groups
    .filter((group) => group.severity !== "success")
    .filter((group) => showInformative || group.title !== "Enlaces de escucha")
    .sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0));
}

export function ServiceReviewPanel({ review, compact = false, interactive = false, open = false, onToggle }) {
  const [openGroups, setOpenGroups] = useState({});
  const [activeCompactGroup, setActiveCompactGroup] = useState("");
  const groups = review.groups || [];
  const score = Math.max(0, Math.min(100, Number(review.score) || 0));
  const risk = getRiskTone(score);
  const importantGroups = filterGroups(groups);
  const visibleGroups = compact ? importantGroups.slice(0, 4) : importantGroups;
  return (
    <section
      onClick={interactive && !compact ? onToggle : undefined}
      onKeyDown={interactive && !compact ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle?.();
        }
      } : undefined}
      role={interactive && !compact ? "button" : undefined}
      tabIndex={interactive && !compact ? 0 : undefined}
      className={`${compact ? "w-full p-3 text-left" : "p-5"} rounded-[1.5rem] border border-ink/10 bg-white shadow-soft transition dark:border-white/16 dark:bg-[#181818] dark:shadow-[0_18px_45px_rgba(0,0,0,0.38)] ${interactive ? "hover:border-brass/45 dark:hover:border-brass/55 dark:hover:bg-[#1d1d1d]" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Revisión del servicio</p>
          {review.subtitle ? <p className="mt-1 text-xs font-semibold text-ink/50">{review.subtitle}</p> : null}
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
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-200 ring-1 ring-black/5 dark:bg-black/55 dark:ring-white/20">
            <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>

      {visibleGroups.length ? (
        <div className={`${compact ? "mt-4" : "mt-5"} grid gap-2`}>
          <p className="text-sm font-black text-ink">{compact ? "Resumen" : "Problemas detectados"}</p>
          {visibleGroups.map((group) => {
            const config = alertStyles[group.severity] || alertStyles.info;
            const Icon = config.icon;
            const expanded = compact ? activeCompactGroup === group.title : (openGroups[group.title] ?? false);
            return (
              <article key={group.title} className={`rounded-2xl border ${compact ? "p-2.5" : "p-3"} ${config.className}`}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (compact) {
                      setActiveCompactGroup((current) => current === group.title ? "" : group.title);
                      return;
                    }
                    setOpenGroups((current) => ({ ...current, [group.title]: !expanded }));
                  }}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{group.title}</span>
                      <span className={`${compact ? "text-xs" : "text-sm"} opacity-85`}>{groupSummary(group)}</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded ? (
                  <ul className="mt-3 space-y-1 pl-7 text-sm leading-6 opacity-90">
                    {group.items.slice(0, 8).map((item) => <li key={item}>{item}</li>)}
                    {group.items.length > 8 ? <li>Y {group.items.length - 8} más...</li> : null}
                  </ul>
                ) : null}
              </article>
            );
          })}
          {groups.some((group) => group.title === "Enlaces de escucha") ? (
            <p className="text-xs font-semibold text-ink/50">Los enlaces de escucha ayudan al ensayo, pero no afectan la preparación.</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/14 dark:text-emerald-50">
          No se detectaron faltantes importantes para este servicio.
        </div>
      )}
    </section>
  );
}
