import { Eye, Plus, X } from "lucide-react";
import { Button } from "../ui/Button";
import { normalizeSearchText } from "../../services/songUtils";
import { SongCoverImage } from "../song/SongCoverArtwork";

function compactLabel(text = "") {
  const value = String(text || "").toLowerCase();
  if (value.includes("tema principal")) return "Coincide con tema";
  if (value.includes("tema adicional")) return "Tema adicional";
  if (value.includes("letra") || value.includes("pdf:")) return "Letra coincide";
  if (value.includes("keynote listo")) return "Keynote listo";
  if (value.includes("pdf listo")) return "PDF listo";
  if (value.includes("pdf local")) return "PDF local";
  if (value.includes("revisión pdf") || value.includes("revision pdf")) return "PDF revisado";
  if (value.includes("poco usado")) return "Poco usado";
  if (value.includes("sin historial") || value.includes("sin uso reciente")) return "Sin uso reciente";
  if (value.includes("encaja")) return "Buena posición";
  if (value.includes("himno")) return "Himno";
  if (value.includes("tonalidad")) return "Tono cercano";
  return String(text || "").replace(/:.+$/, "").slice(0, 34);
}

function compactWarning(text = "") {
  const value = String(text || "").toLowerCase();
  if (value.includes("youtube")) return "Sin YouTube";
  if (value.includes("spotify")) return "Sin Spotify";
  if (value.includes("keynote")) return "Keynote pendiente";
  if (value.includes("pdf")) return "Sin PDF";
  if (value.includes("uso") || value.includes("usó") || value.includes("uso reciente")) return "Uso reciente";
  if (value.includes("tema")) return "Tema débil";
  if (value.includes("tono")) return "Falta tono";
  return String(text || "").replace(/:.+$/, "").slice(0, 34);
}

function shouldHideCompactChip(label = "") {
  return normalizeSearchText(label) === "tono definido";
}

function recommendationTone(score = 0) {
  const value = Number(score) || 0;
  if (value >= 90) return { label: "Muy recomendado", chip: "bg-emerald-500/12 text-emerald-800 dark:bg-emerald-400/14 dark:text-emerald-100", bar: "bg-emerald-500" };
  if (value >= 80) return { label: "Recomendado", chip: "bg-brass/16 text-brass dark:bg-brass/18 dark:text-brass", bar: "bg-brass" };
  if (value >= 65) return { label: "Útil", chip: "bg-yellow-500/14 text-yellow-800 dark:bg-yellow-400/16 dark:text-yellow-100", bar: "bg-yellow-500" };
  if (value >= 50) return { label: "Con reservas", chip: "bg-orange-500/14 text-orange-800 dark:bg-orange-400/16 dark:text-orange-100", bar: "bg-orange-500" };
  return { label: "Poco conveniente", chip: "bg-red-500/12 text-red-800 dark:bg-red-400/16 dark:text-red-100", bar: "bg-red-500" };
}

function getVisibleChips(item = {}) {
  const positives = (item.scoreDetails?.positives || [])
    .filter((entry) => !String(entry.label || "").toLowerCase().includes("base"))
    .map((entry) => ({ label: compactLabel(entry.label), tone: "good" }));
  const penalties = (item.scoreDetails?.penalties || [])
    .map((entry) => ({ label: compactWarning(entry.label), tone: "warn" }));
  const combined = [...positives, ...penalties];
  const seen = new Set();
  return combined.filter((chip) => {
    if (!chip.label || shouldHideCompactChip(chip.label) || seen.has(chip.label)) return false;
    seen.add(chip.label);
    return true;
  }).slice(0, 4);
}

function ScoreMiniBar({ score = 0 }) {
  const normalized = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = recommendationTone(normalized);
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/14">
      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${normalized}%` }} />
    </div>
  );
}

function HighlightedText({ text = "", query = "" }) {
  const value = String(text || "");
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return value;
  return value.split(/(\s+)/).map((word, index) => (
    normalizeSearchText(word).includes(normalizedQuery)
      ? <mark key={`${word}-${index}`} className="rounded bg-brass/25 px-0.5 text-inherit">{word}</mark>
      : word
  ));
}

function MatchPreview({ match }) {
  if (!match?.snippet) return null;
  return (
    <p className="mt-2 line-clamp-2 rounded-xl bg-brass/10 px-2.5 py-2 text-xs leading-5 text-ink/70">
      <span className="mr-1 font-black text-brass">{match.theme}:</span>
      <HighlightedText text={match.snippet} query={match.matchedValue || match.theme} />
    </p>
  );
}

export function RecommendationCard({
  item,
  onAdd,
  onView,
  onDismiss,
  onExplain,
  actionLabel = "Agregar a programación",
  titleQuery = "",
  relation = null,
  isAdded = false
}) {
  const song = item.song || item;
  const chips = getVisibleChips(item);
  const tone = recommendationTone(item.score);
  return (
    <article className="flex h-full min-h-0 min-w-0 max-w-full flex-col rounded-[1.1rem] border border-ink/10 bg-white/90 p-3.5 shadow-soft backdrop-blur-xl dark:border-white/12 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <SongCoverImage song={song} wrapperClassName="h-11 w-11 rounded-xl" />
          <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <p className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${tone.chip}`}>{tone.label}</p>
            {relation?.kind === "related" ? (
              <span
                className="inline-flex rounded-full bg-brass/14 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-brass"
                title={relation.reason || "Relacionado con el canto buscado"}
              >
                Relacionado
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 truncate text-base font-black text-ink">
            <HighlightedText text={song.title} query={titleQuery} />
          </h3>
          <p className="mt-1 truncate text-xs font-semibold text-ink/55">
            {song.category || "Sin categoría"} · {song.keyWithCapo || song.mainKey || "Sin tono"}
          </p>
          </div>
        </div>
        <div className="w-20 shrink-0 text-right">
          <span className="text-2xl font-black text-ink">{Math.round(Number(item.score) || 0)}%</span>
          <ScoreMiniBar score={item.score} />
        </div>
      </div>

      <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
        {chips.length ? chips.map((chip) => (
          <span
            key={`${chip.tone}-${chip.label}`}
            className={chip.tone === "good"
              ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-100"
              : "rounded-full bg-amber-500/14 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-400/14 dark:text-amber-100"}
          >
            {chip.label}
          </span>
        )) : <span className="text-xs font-semibold text-ink/45">Sin datos suficientes</span>}
      </div>
      <p className="mt-2 truncate text-[11px] font-semibold text-ink/45">
        {item.usageSummary?.lastUse || item.usageSummary?.recent || "Sin historial previo"} · {item.usageSummary?.monthly || "0 usos en 30 días"}
      </p>
      {relation?.kind === "related" && relation.reason ? (
        <p className="mt-1 truncate text-[11px] font-bold text-brass">{relation.reason}</p>
      ) : null}
      <MatchPreview match={item.scoreDetails?.pdfMatch} />

      <div className="mt-auto pt-3">
        {onAdd ? (
          <Button className="h-9 w-full px-3 text-xs" onClick={() => onAdd(song)} disabled={isAdded}>
            {isAdded ? null : <Plus className="h-4 w-4" />}
            {actionLabel}
          </Button>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {onView ? <Button className="h-8 px-2 text-[11px]" variant="secondary" onClick={() => onView(song)}><Eye className="h-3.5 w-3.5" />Detalle</Button> : null}
          {onExplain ? <Button className="h-8 px-2 text-[11px]" variant="subtle" onClick={() => onExplain(item)}>Ver score</Button> : null}
          {onDismiss ? <Button className="col-span-2 h-8 px-2 text-[11px] sm:col-span-1" variant="subtle" onClick={() => onDismiss(song)}><X className="h-3.5 w-3.5" />Descartar</Button> : null}
        </div>
      </div>
    </article>
  );
}
