import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, CalendarCheck2, GitCompareArrows, Lightbulb, ListChecks, Search, Wand2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import { SmartCard, SmartGradientBackground, SmartPanel } from "../components/smart/SmartPanel";
import { RecommendationCard } from "../components/smart/RecommendationCard";
import { ServiceReviewPanel } from "../components/smart/ServiceReviewPanel";
import { InsightCard } from "../components/smart/InsightCard";
import { ScoreBadge } from "../components/smart/ScoreBadge";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import {
  buildUsageIndex,
  createSuggestedServiceBlock,
  getPreparationGaps,
  getReplacementCandidates,
  getRepertoireInsights,
  getSongRecommendations,
  reviewServiceSchedule,
  searchSongsByIntent,
  smartEnergies,
  smartServiceTypes,
  toSongEntry
} from "../services/smartRecommendations";

const defaultOptions = {
  serviceType: "Domingo AM",
  theme: "adoración",
  category: "",
  count: 4,
  includeHymns: true,
  avoidRecent: true,
  onlyKeynoteReady: false,
  preferredKey: "",
  energy: "congregacional fuerte"
};

const shortDate = (schedule = {}) => schedule.date
  ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(`${schedule.date}T00:00:00`))
  : "Sin fecha";

const scheduleLabel = (schedule = {}) => `${schedule.serviceLabel || schedule.type || "Servicio"} · ${shortDate(schedule)} · ${schedule.time || "Sin hora"}`;

export function SmartCenter() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { songs, schedules, saveSchedule, replaceScheduleSong } = useMusicData();
  const [options, setOptions] = useState(defaultOptions);
  const [selectedScheduleId, setSelectedScheduleId] = useState(schedules[0]?.id || "");
  const [replacementSongId, setReplacementSongId] = useState("");
  const [intentQuery, setIntentQuery] = useState("adoración en tono G");
  const [dismissed, setDismissed] = useState([]);
  const [compareSong, setCompareSong] = useState(null);
  const [status, setStatus] = useState("");

  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) || schedules[0] || null;
  const usageIndex = useMemo(() => buildUsageIndex(schedules), [schedules]);
  const recommendations = useMemo(
    () => getSongRecommendations(songs, schedules, { ...options, currentSchedule: selectedSchedule, limit: 20 })
      .filter((item) => !dismissed.includes(item.song.id)),
    [dismissed, options, schedules, selectedSchedule, songs]
  );
  const suggestedBlock = useMemo(
    () => createSuggestedServiceBlock(songs, schedules, { ...options, currentSchedule: selectedSchedule }),
    [options, schedules, selectedSchedule, songs]
  );
  const review = useMemo(() => selectedSchedule ? reviewServiceSchedule(selectedSchedule, songs) : { score: 0, status: "Sin programación", alerts: [] }, [selectedSchedule, songs]);
  const currentReplacementEntry = selectedSchedule?.songs?.find((entry) => entry.songId === replacementSongId) || selectedSchedule?.songs?.[0] || null;
  const currentReplacementSong = songs.find((song) => song.id === currentReplacementEntry?.songId) || null;
  const replacementCandidates = useMemo(
    () => currentReplacementSong ? getReplacementCandidates(currentReplacementSong, songs, schedules, selectedSchedule).slice(0, 8) : [],
    [currentReplacementSong, schedules, selectedSchedule, songs]
  );
  const insights = useMemo(() => getRepertoireInsights(songs, schedules), [schedules, songs]);
  const gaps = useMemo(() => getPreparationGaps(songs), [songs]);
  const intentSearch = useMemo(() => searchSongsByIntent(intentQuery, songs, usageIndex), [intentQuery, songs, usageIndex]);

  const updateOption = (key, value) => setOptions((current) => ({ ...current, [key]: value }));

  const addSongToSchedule = async (song) => {
    if (!selectedSchedule?.id || !song?.id) {
      setStatus("Selecciona una programación destino.");
      return;
    }
    const alreadyExists = (selectedSchedule.songs || []).some((entry) => entry.songId === song.id);
    if (alreadyExists) {
      setStatus("Ese canto ya está en la programación seleccionada.");
      return;
    }
    await saveSchedule({
      ...selectedSchedule,
      songs: [...(selectedSchedule.songs || []), toSongEntry(song)]
    });
    setStatus(`Agregado a ${selectedSchedule.serviceLabel || selectedSchedule.date}: ${song.title}`);
  };

  const addBlockToSchedule = async () => {
    if (!selectedSchedule?.id) {
      setStatus("Selecciona una programación destino.");
      return;
    }
    const existing = new Set((selectedSchedule.songs || []).map((entry) => entry.songId));
    const entries = suggestedBlock.items
      .map((item) => item.song)
      .filter((song) => song?.id && !existing.has(song.id))
      .map(toSongEntry);
    if (!entries.length) {
      setStatus("El bloque sugerido ya está incluido o no tiene cantos disponibles.");
      return;
    }
    await saveSchedule({ ...selectedSchedule, songs: [...(selectedSchedule.songs || []), ...entries] });
    setStatus(`Bloque agregado: ${entries.length} canto(s).`);
  };

  const replaceSong = async (candidate) => {
    if (!selectedSchedule?.id || !currentReplacementEntry || !candidate?.id) return;
    if (!confirm(`¿Sustituir "${currentReplacementEntry.titleSnapshot}" por "${candidate.title}"?`)) return;
    await replaceScheduleSong(selectedSchedule.id, currentReplacementEntry, candidate);
    setStatus(`Sustitución aplicada: ${currentReplacementEntry.titleSnapshot} → ${candidate.title}`);
  };

  const openRepertoireFilter = (params = {}) => {
    const search = new URLSearchParams(params);
    navigate(`/repertorio?${search.toString()}`);
  };

  if (profile?.role === "viewer") {
    return (
      <SmartGradientBackground>
        <SmartPanel>
          <h2 className="text-xl font-bold text-ink">No tienes permiso para ver esta sección.</h2>
        </SmartPanel>
      </SmartGradientBackground>
    );
  }

  return (
    <SmartGradientBackground>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brass/25 bg-brass/12 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brass">
            <BrainCircuit className="h-4 w-4" />
            Análisis inteligente sin IA externa
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-normal text-ink md:text-4xl">Centro Inteligente</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
            Reglas avanzadas, historial y metadatos del repertorio para apoyar decisiones de programación.
          </p>
        </div>
        <div className="rounded-3xl border border-white/60 bg-white/65 p-3 text-sm shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
          <p className="font-bold text-ink">Base analizada</p>
          <p className="text-ink/60">{songs.length} cantos · {schedules.length} programaciones</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmartCard icon={Wand2} title="Asistente de programación" description="Genera sugerencias de cantos según tema, categoría, rotación y preparación." metric={`${recommendations[0]?.score || 0}/100`} action="Generar sugerencias" onClick={() => document.getElementById("smart-assistant")?.scrollIntoView({ behavior: "smooth" })} />
        <SmartCard icon={CalendarCheck2} title="Revisión inteligente" description="Detecta faltantes, repeticiones y riesgos antes del servicio." metric={review.status} action="Revisar servicio" onClick={() => document.getElementById("smart-review")?.scrollIntoView({ behavior: "smooth" })} />
        <SmartCard icon={GitCompareArrows} title="Sustitución inteligente" description="Encuentra reemplazos adecuados si un canto no se puede tocar." metric={`${replacementCandidates[0]?.score || 0}/100`} action="Buscar reemplazo" onClick={() => document.getElementById("smart-replacement")?.scrollIntoView({ behavior: "smooth" })} />
        <SmartCard icon={Lightbulb} title="Balance del repertorio" description="Analiza temas, categorías, pendientes y cantos olvidados." metric={`${gaps.filter((gap) => gap.count).length} pendientes`} action="Ver insights" onClick={() => document.getElementById("smart-balance")?.scrollIntoView({ behavior: "smooth" })} />
      </div>

      {status ? <p className="mt-5 rounded-2xl border border-brass/25 bg-brass/12 p-3 text-sm font-semibold text-ink">{status}</p> : null}

      <section id="smart-assistant" className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SmartPanel>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-black text-ink">Asistente de programación</h2>
          </div>
          <div className="mt-5 grid gap-4">
            <Field label="Programación destino">
              <Select value={selectedSchedule?.id || ""} onChange={(event) => setSelectedScheduleId(event.target.value)}>
                {schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{scheduleLabel(schedule)}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de servicio">
              <Select value={options.serviceType} onChange={(event) => updateOption("serviceType", event.target.value)}>
                {smartServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label="Tema deseado">
              <Input value={options.theme} onChange={(event) => updateOption("theme", event.target.value)} placeholder="adoración, cruz, gloria..." />
            </Field>
            <Field label="Categoría">
              <Select value={options.category} onChange={(event) => updateOption("category", event.target.value)}>
                <option value="">Cualquiera</option>
                <option value="normal">Normal</option>
                <option value="himno">Himno</option>
                <option value="navidad">Navidad</option>
                <option value="santa cena">Santa Cena</option>
                <option value="especial">Especial</option>
              </Select>
            </Field>
            <Field label="Número de cantos">
              <Input type="number" min="1" max="8" value={options.count} onChange={(event) => updateOption("count", Number(event.target.value || 4))} />
            </Field>
            <Field label="Energía deseada">
              <Select value={options.energy} onChange={(event) => updateOption("energy", event.target.value)}>
                {smartEnergies.map((energy) => <option key={energy} value={energy}>{energy}</option>)}
              </Select>
            </Field>
            <Field label="Tonalidad preferida">
              <Input value={options.preferredKey} onChange={(event) => updateOption("preferredKey", event.target.value)} placeholder="G, D, Bb..." />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" checked={options.includeHymns} onChange={(event) => updateOption("includeHymns", event.target.checked)} />
              Incluir himnos
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" checked={options.avoidRecent} onChange={(event) => updateOption("avoidRecent", event.target.checked)} />
              Evitar repetidos recientes
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" checked={options.onlyKeynoteReady} onChange={(event) => updateOption("onlyKeynoteReady", event.target.checked)} />
              Solo con Keynote listo
            </label>
          </div>
        </SmartPanel>

        <div className="grid gap-4">
          <SmartPanel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brass">Crear bloque sugerido</p>
                <h3 className="text-xl font-black text-ink">Bloque sugerido para {options.serviceType}</h3>
              </div>
              <ScoreBadge score={suggestedBlock.score} label="Bloque" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {suggestedBlock.items.map((item, index) => (
                <div key={`${item.role}-${item.song.id}`} className="rounded-2xl border border-white/60 bg-white/70 p-3 dark:border-white/10 dark:bg-white/8">
                  <p className="text-xs font-bold uppercase tracking-wide text-brass">{index + 1}. {item.role}</p>
                  <p className="mt-1 font-black text-ink">{item.song.title}</p>
                  <p className="mt-1 text-sm text-ink/60">{item.song.mainTheme || "Sin tema"} · {item.song.keyWithCapo || item.song.mainKey || "Sin tono"}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestedBlock.reasons.map((reason) => <span key={reason} className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{reason}</span>)}
            </div>
            <Button className="mt-4" onClick={addBlockToSchedule}><ListChecks className="h-4 w-4" />Agregar bloque completo</Button>
          </SmartPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            {recommendations.slice(0, 10).map((item) => (
              <RecommendationCard
                key={item.song.id}
                item={item}
                onAdd={addSongToSchedule}
                onView={(song) => navigate(`/repertorio/${song.id}`)}
                onCompare={setCompareSong}
                onDismiss={(song) => setDismissed((current) => [...current, song.id])}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="smart-review" className="mt-6">
        <ServiceReviewPanel review={review} />
      </section>

      <section id="smart-replacement" className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SmartPanel>
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-black text-ink">Sustitución inteligente</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink/62">Compara el canto actual contra candidatos por tema, tono, preparación y rotación.</p>
          <Field label="Programación" className="mt-5">
            <Select value={selectedSchedule?.id || ""} onChange={(event) => setSelectedScheduleId(event.target.value)}>
              {schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{scheduleLabel(schedule)}</option>)}
            </Select>
          </Field>
          <Field label="Canto a sustituir" className="mt-4">
            <Select value={currentReplacementEntry?.songId || ""} onChange={(event) => setReplacementSongId(event.target.value)}>
              {(selectedSchedule?.songs || []).map((entry) => <option key={`${entry.songId}-${entry.titleSnapshot}`} value={entry.songId}>{entry.titleSnapshot}</option>)}
            </Select>
          </Field>
          {currentReplacementSong ? (
            <div className="mt-5 rounded-2xl bg-ink/5 p-4 dark:bg-white/8">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Canto actual</p>
              <p className="mt-1 font-black text-ink">{currentReplacementSong.title}</p>
              <p className="mt-1 text-sm text-ink/60">{currentReplacementSong.mainTheme || "Sin tema"} · {currentReplacementSong.category || "Sin categoría"} · {currentReplacementSong.keyWithCapo || currentReplacementSong.mainKey || "Sin tono"}</p>
            </div>
          ) : null}
        </SmartPanel>
        <div className="grid gap-4 lg:grid-cols-2">
          {replacementCandidates.map((item) => (
            <RecommendationCard
              key={item.song.id}
              item={{ ...item, label: "Compatibilidad de sustitución" }}
              actionLabel="Sustituir"
              onAdd={replaceSong}
              onView={(song) => navigate(`/repertorio/${song.id}`)}
              onCompare={setCompareSong}
            />
          ))}
        </div>
      </section>

      <section id="smart-balance" className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SmartPanel>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-black text-ink">Balance del repertorio</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard key={insight.title} insight={insight} onAction={() => openRepertoireFilter({ smart: insight.title })} />
            ))}
          </div>
        </SmartPanel>
        <SmartPanel>
          <h2 className="text-xl font-black text-ink">Qué falta preparar</h2>
          <div className="mt-4 grid gap-3">
            {gaps.map((gap) => (
              <div key={gap.key} className="rounded-2xl border border-white/60 bg-white/70 p-3 dark:border-white/10 dark:bg-white/8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{gap.label}</p>
                    <p className="text-xs text-ink/55">Prioridad {gap.priority}</p>
                  </div>
                  <p className="text-2xl font-black text-brass">{gap.count}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brass" style={{ width: `${Math.min(100, gap.percent)}%` }} />
                </div>
                <Button variant="subtle" className="mt-3 h-9 px-3 text-xs" onClick={() => openRepertoireFilter({ smartFilter: gap.key })}>Ver</Button>
              </div>
            ))}
          </div>
        </SmartPanel>
      </section>

      <section className="mt-6">
        <SmartPanel>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-black text-ink">Buscar por intención</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <Input value={intentQuery} onChange={(event) => setIntentQuery(event.target.value)} placeholder="cantos para santa cena, himnos no usados, sin youtube..." />
            <Button variant="secondary" onClick={() => openRepertoireFilter({ q: intentQuery })}>Aplicar en repertorio</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {intentSearch.interpretation.map((item) => <span key={item} className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{item}</span>)}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {intentSearch.results.slice(0, 9).map((song) => (
              <button key={song.id} type="button" onClick={() => navigate(`/repertorio/${song.id}`)} className="rounded-2xl border border-white/60 bg-white/70 p-3 text-left shadow-soft dark:border-white/10 dark:bg-white/8">
                <p className="font-bold text-ink">{song.title}</p>
                <p className="mt-1 text-sm text-ink/60">{song.mainTheme || "Sin tema"} · {song.keyWithCapo || song.mainKey || "Sin tono"}</p>
              </button>
            ))}
          </div>
        </SmartPanel>
      </section>

      {compareSong ? (
        <SmartPanel className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl border-brass/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brass">Comparación rápida</p>
              <h3 className="text-lg font-black text-ink">{compareSong.title}</h3>
              <p className="text-sm text-ink/60">{compareSong.mainTheme || "Sin tema"} · {compareSong.category || "Sin categoría"} · {compareSong.keyWithCapo || compareSong.mainKey || "Sin tono"}</p>
            </div>
            <Button variant="secondary" onClick={() => setCompareSong(null)}>Cerrar</Button>
          </div>
        </SmartPanel>
      ) : null}
    </SmartGradientBackground>
  );
}
