import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ListMusic, Music2, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field, Input } from "../ui/Field";
import { StatCard } from "../ui/StatCard";
import { formatDate, getScheduleStartDate, todayString } from "../../services/dateUtils";
import { formatSongLastSung } from "../../services/songHistory";
import { findIndexedTextMatches } from "../../services/songScoring";
import { calendarDaysBetween, getRotationServiceLabel, hasKeynoteReady, shortRepeatDays } from "../../services/rotationStats";
import { normalizeSearchText, normalizeThemeName } from "../../services/songUtils";

const rowLimit = 6;
const countLabel = (value, singular, plural = `${singular}s`) => `${value} ${value === 1 ? singular : plural}`;
const songPath = (song) => `/repertorio/${song.id}`;
const songLinkClass = "font-bold text-ink underline-offset-2 hover:text-brass hover:underline";
const schedulePath = (schedule) => `/programacion?${new URLSearchParams(schedule.id ? { schedule: schedule.id } : { date: schedule.date })}`;
const scheduleLabel = (schedule) => `${getRotationServiceLabel(schedule)} · ${formatDate(schedule.date)}`;

function MoreRows({ expanded, onToggle, count }) {
  if (count <= rowLimit) return null;
  return (
    <Button variant="secondary" className="mt-4" onClick={onToggle} aria-expanded={expanded}>
      {expanded ? "Mostrar menos" : `Ver los ${count}`}
    </Button>
  );
}

function RotationSuggestions({ rows, theme, now, nextSchedule, sectionRef }) {
  const [phrase, setPhrase] = useState("");
  const [expanded, setExpanded] = useState(false);
  const today = todayString(now);
  const normalizedPhrase = normalizeSearchText(phrase);
  const searchLyrics = normalizedPhrase.replaceAll(" ", "").length >= 3;
  const suggestions = useMemo(() => {
    if (!theme && !searchLyrics) return [];
    const alreadyScheduled = new Set((nextSchedule?.songs || []).map(({ songId }) => songId).filter(Boolean));
    return rows.flatMap((row) => {
      const song = row.song;
      if (alreadyScheduled.has(song.id)) return [];
      const match = searchLyrics ? findIndexedTextMatches({
        ...song,
        lyricsText: [song.lyricsText, ...(song.lyricsSections || []).map(({ text }) => text)].filter(Boolean).join(" ")
      }, [phrase], { allowWordMatches: false })[0] : null;
      if (searchLyrics && !match) return [];
      const recent = row.latest && calendarDaysBetween(row.latest.date, nextSchedule?.date || today) <= shortRepeatDays;
      return [{ ...row, match, ready: hasKeynoteReady(song), recent }];
    }).sort((a, b) =>
      Number(b.ready) - Number(a.ready)
      || (a.latest?.date || "").localeCompare(b.latest?.date || "")
      || a.count - b.count
      || a.song.title.localeCompare(b.song.title, "es")
    );
  }, [nextSchedule, phrase, rows, searchLyrics, theme, today]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 ref={sectionRef} tabIndex={-1} className="scroll-mt-24 text-lg font-bold text-ink">Qué cantar en el próximo servicio</h3>
          {nextSchedule ? <p className="mt-1 text-sm text-ink/65">{scheduleLabel(nextSchedule)}</p> : null}
        </div>
        <Link className={`inline-flex items-center gap-1 text-sm ${songLinkClass}`} to={nextSchedule ? schedulePath(nextSchedule) : "/programacion"}>
          Abrir Programación <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <Field className="mt-4 max-w-lg" label="Palabra o frase de la letra (opcional)">
        <Input value={phrase} onChange={(event) => { setPhrase(event.target.value); setExpanded(false); }} placeholder="Ej. mi esperanza está en Cristo" />
      </Field>
      {suggestions.length ? (
        <>
          <p className="mt-3 text-sm text-ink/65">Primero aparecen los cantos con Keynote listo y más tiempo sin uso registrado.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(expanded ? suggestions : suggestions.slice(0, rowLimit)).map(({ song, count, latest, match, ready, recent }) => (
              <li key={song.id} className="rounded-xl border border-ink/10 bg-ink/[0.025] p-3">
                <Link className={songLinkClass} to={songPath(song)}>{song.title}</Link>
                <p className="mt-1 text-xs font-semibold text-ink/65">{ready ? "Keynote listo" : "Keynote pendiente"} · {countLabel(count, "uso")} en el periodo</p>
                <p className="mt-1 text-sm text-ink/65">{latest ? formatSongLastSung(latest.date, today) : "Sin fecha de canto registrada"}</p>
                {recent ? <p className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-200">Uso cercano · {getRotationServiceLabel(latest)}</p> : null}
                {match ? <p className="mt-2 break-words text-sm text-ink/65">«{match.snippet}»</p> : null}
              </li>
            ))}
          </ul>
          <MoreRows expanded={expanded} onToggle={() => setExpanded(!expanded)} count={suggestions.length} />
        </>
      ) : (
        <p className="mt-3 text-sm text-ink/65">
          {searchLyrics ? "No se encontró esa frase en las letras disponibles con estos filtros."
            : theme ? "No hay más opciones para este tema con los filtros actuales."
              : "Elige un tema en los filtros o busca una frase de la letra para ver opciones."}
        </p>
      )}
    </Card>
  );
}

function RepeatsList({ title, repeats, emptyText }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <h4 className="font-bold text-ink">{title} · {repeats.length}</h4>
      {repeats.length ? (
        <ul className="mt-2 divide-y divide-ink/10">
          {(expanded ? repeats : repeats.slice(0, rowLimit)).map(({ song, previous, current, days }) => (
            <li key={`${song.id}-${current.id || scheduleLabel(current)}`} className="py-2 text-sm">
              <Link className={songLinkClass} to={songPath(song)}>{song.title}</Link>
              {days ? <span className="ml-2 font-semibold text-ink/60">{countLabel(days, "día")} entre usos</span> : null}
              <p className="mt-1 text-xs leading-5 text-ink/65">
                <Link className="hover:underline" to={schedulePath(previous)}>{scheduleLabel(previous)}</Link>
                {" → "}
                <Link className="hover:underline" to={schedulePath(current)}>{scheduleLabel(current)}</Link>
              </p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-ink/60">{emptyText}</p>}
      <MoreRows expanded={expanded} onToggle={() => setExpanded(!expanded)} count={repeats.length} />
    </div>
  );
}

function ThemeOptions({ themes, onSelectTheme, themeFilter }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? themes : themes.slice(0, rowLimit);
  return (
    <Card>
      <h3 className="text-lg font-bold text-ink">Dónde ampliar o retomar el repertorio</h3>
      <p className="mt-1 text-sm text-ink/65">Cada canto cuenta una vez por servicio y se agrupa por su tema principal. Los cantos con Keynote listo que quedaron sin uso son opciones para retomar.</p>
      {visible.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((theme) => (
            <article key={theme.key} className="rounded-xl border border-ink/10 p-3">
              <h4 className="font-bold capitalize text-ink">{theme.label}</h4>
              <p className="mt-1 text-sm text-ink/65">{countLabel(theme.uses, "uso")} · {theme.used} de {countLabel(theme.total, "canto")} con uso</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                <div className="h-full rounded-full bg-brass" style={{ width: `${100 * theme.used / theme.total}%` }} />
              </div>
              <p className="mt-2 text-sm text-ink/65">{theme.ready} con Keynote listo · {theme.unusedReady} sin uso y con Keynote listo</p>
              {theme.key && theme.used === theme.total && theme.uses >= theme.total * 2
                ? <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-200">Todas las opciones se usaron. Consideren ampliar este tema.</p>
                : null}
              {theme.key && !themeFilter ? (
                <Button variant="subtle" className="mt-2 px-2" onClick={() => onSelectTheme(theme.label)}>Ver opciones de {theme.label}</Button>
              ) : null}
            </article>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-ink/65">No hay cantos con estos filtros.</p>}
      <MoreRows expanded={expanded} onToggle={() => setExpanded(!expanded)} count={themes.length} />
    </Card>
  );
}

function RankedSongs({ title, rows, now, emptyText }) {
  const [expanded, setExpanded] = useState(false);
  const today = todayString(now);
  return (
    <Card>
      <h3 className="text-lg font-bold text-ink">{title} · {rows.length}</h3>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-ink/10">
          {(expanded ? rows : rows.slice(0, rowLimit)).map(({ song, count, lastSchedule, latest }) => (
            <li key={song.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-sm">
              <div>
                <Link className={songLinkClass} to={songPath(song)}>{song.title}</Link>
                <p className="mt-0.5 text-xs text-ink/65">
                  {normalizeThemeName(song.mainTheme) || "Sin tema principal"}
                  {hasKeynoteReady(song) ? " · Keynote listo" : ""}
                </p>
                <p className="mt-0.5 text-xs text-ink/65">
                  {lastSchedule ? `Última vez en el periodo: ${formatSongLastSung(lastSchedule.date, today)}`
                    : latest ? `Última vez en el historial: ${formatSongLastSung(latest.date, today)}`
                      : "Sin fecha de canto registrada"}
                </p>
              </div>
              <span className="font-semibold text-ink/65">{countLabel(count, "uso")}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-ink/60">{emptyText}</p>}
      <MoreRows expanded={expanded} onToggle={() => setExpanded(!expanded)} count={rows.length} />
    </Card>
  );
}

export function RotationPanel({ summary, now, themeFilter, onSelectTheme, nextSchedule }) {
  const { rows, uses, distinct, serviceCount, servicesWithMatches, unresolvedCount, sameDay, shortRepeats, medianDays, gapCount, themes } = summary;
  const mostUsed = rows.filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || a.song.title.localeCompare(b.song.title, "es"));
  const leastUsed = [...mostUsed].reverse();
  const unused = rows.filter(({ count }) => count === 0)
    .sort((a, b) => Number(hasKeynoteReady(b.song)) - Number(hasKeynoteReady(a.song)) || a.song.title.localeCompare(b.song.title, "es"));
  const days = medianDays?.toLocaleString("es-MX", { maximumFractionDigits: 1 });
  const suggestionHeading = useRef(null);
  const selectTheme = (theme) => {
    onSelectTheme(theme);
    suggestionHeading.current?.focus();
    suggestionHeading.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="space-y-5">
      <RotationSuggestions rows={rows} now={now} theme={themeFilter} nextSchedule={nextSchedule} sectionRef={suggestionHeading} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Servicios con estos cantos" value={servicesWithMatches} detail={`De ${countLabel(serviceCount, "servicio")} en el periodo y tipo elegidos`} />
        <StatCard icon={Music2} label="Cantos distintos usados" value={distinct} detail={`De ${countLabel(rows.length, "canto disponible", "cantos disponibles")} · ${countLabel(uses, "uso")}`} />
        <StatCard icon={ListMusic} label="Cantos sin uso en el periodo" value={unused.length} detail={`${unused.filter(({ song }) => hasKeynoteReady(song)).length} con Keynote listo`} />
        <StatCard icon={RotateCcw} label="Mediana entre repeticiones" value={days == null ? "—" : `${days} ${medianDays === 1 ? "día" : "días"}`} detail={`${countLabel(gapCount, "intervalo")} entre fechas distintas`} />
      </div>
      <p className="text-sm text-ink/65">Los conteos usan los cantos de las programaciones de servicios ya pasados. La última vez en el historial considera todos los servicios registrados.</p>
      {unresolvedCount > 0 ? <p className="text-sm text-ink/65">{unresolvedCount} {unresolvedCount === 1 ? "entrada sin vínculo claro" : "entradas sin vínculo claro"} con el repertorio en los servicios del periodo. Sus usos quedan fuera de los conteos.</p> : null}
      <Card>
        <h3 className="text-lg font-bold text-ink">Repeticiones cercanas</h3>
        <p className="mt-1 text-sm text-ink/65">Revisa el contexto. Una repetición puede encajar con la prédica, el estreno de un canto o una fecha especial.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <RepeatsList title={`En ${shortRepeatDays} días o menos`} repeats={shortRepeats} emptyText="Sin repeticiones cercanas entre fechas distintas." />
          <RepeatsList title="En servicios del mismo día" repeats={sameDay} emptyText="Sin repeticiones el mismo día." />
        </div>
      </Card>
      <ThemeOptions themes={themes} onSelectTheme={selectTheme} themeFilter={themeFilter} />
      <div className="grid gap-4 lg:grid-cols-3">
        <RankedSongs title="Más usados" rows={mostUsed} now={now} emptyText="Sin usos registrados en el periodo." />
        <RankedSongs title="Menos usados" rows={leastUsed} now={now} emptyText="Sin usos registrados en el periodo." />
        <RankedSongs title="Sin uso en el periodo" rows={unused} now={now} emptyText="Todos los cantos de la selección tienen uso registrado." />
      </div>
    </div>
  );
}
