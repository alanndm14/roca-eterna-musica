import { Eye, GitCompare, Plus, X } from "lucide-react";
import { Button } from "../ui/Button";
import { ScoreBadge } from "./ScoreBadge";
import { ReasonChips } from "./ReasonChips";

export function RecommendationCard({ item, onAdd, onView, onCompare, onDismiss, onExplain, actionLabel = "Agregar a programación" }) {
  const song = item.song || item;
  return (
    <article className="rounded-[1.5rem] border border-white/60 bg-white/78 p-4 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-brass">{item.label || "Recomendación"}</p>
          <h3 className="mt-1 text-lg font-black text-ink">{song.title}</h3>
          <p className="mt-1 text-sm text-ink/60">
            {song.mainTheme || "Sin tema"} · {song.category || "Sin categoría"} · {song.keyWithCapo || song.mainKey || "Sin tono"}
          </p>
          <p className="mt-2 text-xs text-ink/45">
            Capo {song.capo || 0} · Keynote {song.keynoteReviewStatus || "pendiente"} · {item.usage?.lastUsedAt ? `Última vez: ${item.usage.lastUsedAt}` : "Sin historial"}
          </p>
        </div>
        <ScoreBadge score={item.score} compact />
      </div>
      <div className="mt-4">
        <ReasonChips reasons={item.reasons} warnings={item.warnings} />
      </div>
      <p className="mt-4 text-sm leading-6 text-ink/62">
        Este canto se recomienda por su coincidencia de tema, preparación y rotación dentro del repertorio.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {onAdd ? <Button onClick={() => onAdd(song)}><Plus className="h-4 w-4" />{actionLabel}</Button> : null}
        {onView ? <Button variant="secondary" onClick={() => onView(song)}><Eye className="h-4 w-4" />Ver detalle</Button> : null}
        {onCompare ? <Button variant="subtle" onClick={() => onCompare(song)}><GitCompare className="h-4 w-4" />Comparar</Button> : null}
        {onExplain ? <Button variant="subtle" onClick={() => onExplain(item)}>¿Cómo se calculó?</Button> : null}
        {onDismiss ? <Button variant="subtle" onClick={() => onDismiss(song)}><X className="h-4 w-4" />Descartar</Button> : null}
      </div>
    </article>
  );
}
