import { Headphones, Lightbulb, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPreparationGaps, getRepertoireInsights } from "../../services/repertoireInsights";
import { normalizeSearchText } from "../../services/songUtils";
import { Button } from "../ui/Button";
import { InsightCard } from "./InsightCard";
import { SmartPanel } from "./SmartPanel";

const gapFilterMap = {
  youtube: "missing-youtube",
  spotify: "missing-spotify",
  drive: "missing-drive-pdf",
  localPdf: "missing-local-pdf",
  keynote: "missing-keynote",
  musicReview: "missing-music-review",
  key: "missing-key",
  theme: "missing-theme",
  ocr: "ocr-pending"
};

function inferInsightFilter(insight = {}) {
  const text = normalizeSearchText(`${insight.title || ""} ${insight.message || ""} ${insight.action || ""}`);
  if (text.includes("youtube") || text.includes("escucha")) return { filter: "missing-youtube" };
  if (text.includes("documentos") || text.includes("pdf")) return { filter: "missing-drive-pdf" };
  if (text.includes("himnos")) return { filter: "hymns-ready" };
  if (text.includes("olvidados")) return { filter: "unused-ready" };
  if (text.includes("repeticion") || text.includes("repetidos")) return { filter: "repeated" };
  if (text.includes("navidad")) return { q: "navidad" };
  return { q: insight.title || "" };
}

export function RepertoireBalancePanel({ songs = [], schedules = [] }) {
  const navigate = useNavigate();
  const insights = getRepertoireInsights(songs, schedules);
  const gaps = getPreparationGaps(songs);
  const openRepertoire = (params = {}) => navigate(`/repertorio?${new URLSearchParams(params).toString()}`);

  return (
    <div className="grid min-w-0 gap-5">
      <SmartPanel>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brass/15 text-brass">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-black text-ink">Balance del repertorio</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">Tendencias, oportunidades y mantenimiento general del repertorio.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <InsightCard
              key={insight.title}
              insight={insight}
              onAction={() => openRepertoire(inferInsightFilter(insight))}
            />
          ))}
        </div>
      </SmartPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <SmartPanel>
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-black text-ink">Qué falta preparar</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gaps.map((gap) => (
              <article key={gap.key} className="rounded-2xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{gap.label}</p>
                    <p className="mt-1 text-xs font-semibold text-ink/45">Prioridad {gap.priority}</p>
                  </div>
                  <span className="text-2xl font-black text-brass">{gap.count}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brass" style={{ width: `${Math.min(100, gap.percent)}%` }} />
                </div>
                <Button
                  variant="subtle"
                  className="mt-3 h-9 px-3 text-xs"
                  onClick={() => openRepertoire({ filter: gapFilterMap[gap.key] || gap.key })}
                >
                  Aplicar filtro
                </Button>
              </article>
            ))}
          </div>
        </SmartPanel>

        <SmartPanel>
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-brass" />
            <h2 className="text-lg font-black text-ink">Enlaces de escucha</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            YouTube y Spotify ayudan al ensayo, pero son informativos y no cuentan como preparación obligatoria.
          </p>
          <div className="mt-4 grid gap-2">
            <Button variant="secondary" onClick={() => openRepertoire({ filter: "missing-youtube" })}>Ver cantos sin YouTube</Button>
            <Button variant="secondary" onClick={() => openRepertoire({ filter: "missing-spotify" })}>Ver cantos sin Spotify</Button>
          </div>
        </SmartPanel>
      </div>
    </div>
  );
}
