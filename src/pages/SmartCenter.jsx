import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, CalendarCheck2, GitCompareArrows, Lightbulb, ListChecks, RefreshCw, Search, Shuffle, Wand2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { SmartCard, SmartGradientBackground, SmartPanel } from "../components/smart/SmartPanel";
import { RecommendationCard } from "../components/smart/RecommendationCard";
import { ServiceReviewPanel } from "../components/smart/ServiceReviewPanel";
import { InsightCard } from "../components/smart/InsightCard";
import { ScoreBadge } from "../components/smart/ScoreBadge";
import { ReasonChips } from "../components/smart/ReasonChips";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getCurrentOrNextSchedule } from "../services/dateUtils";
import {
  buildUsageIndex,
  createSuggestedServiceBlock,
  getPreparationGaps,
  getReplacementCandidates,
  getRepertoireInsights,
  getSlotAlternatives,
  getSmartServiceDefaultCount,
  getSongRecommendations,
  inferSmartServiceType,
  parseThemeInput,
  reviewServiceSchedule,
  scoreSong,
  searchSongsByIntent,
  smartServiceTypes,
  toSongEntry
} from "../services/smartRecommendations";
import { getSongPdfUrl } from "../services/songUtils";

const tabItems = [
  { id: "programar", label: "Programar", icon: Wand2 },
  { id: "revisar", label: "Revisar", icon: CalendarCheck2 },
  { id: "sustituir", label: "Sustituir", icon: GitCompareArrows },
  { id: "balance", label: "Balance", icon: Lightbulb },
  { id: "buscar", label: "Buscar", icon: Search }
];

const defaultOptions = {
  serviceType: "Domingo AM",
  theme: "adoración",
  category: "",
  count: 5,
  includeHymns: true,
  avoidRecent: true,
  onlyKeynoteReady: false,
  preferredKey: "",
  seed: 0
};

const shortDate = (schedule = {}) => schedule.date
  ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(`${schedule.date}T00:00:00`))
  : "Sin fecha";

const scheduleLabel = (schedule = {}) => `${schedule.serviceLabel || schedule.type || "Servicio"} · ${shortDate(schedule)} · ${schedule.time || "Sin hora"}`;

function nextBlockState(block, overrides) {
  if (!Object.keys(overrides).length) return block;
  const items = block.items.map((item) => overrides[item.slot.id] || item);
  return {
    ...block,
    items,
    score: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0
  };
}

function songFactRows(song = {}, item = {}) {
  return [
    ["Tema", song.mainTheme || "Sin tema"],
    ["Categoría", song.category || "Sin categoría"],
    ["Tono", song.mainKey || "Sin tono"],
    ["Capo", song.capo || 0],
    ["Suena en", song.keyWithCapo || song.mainKey || "Sin tono"],
    ["Última vez usado", item.usage?.lastUsedAt || "Sin historial"],
    ["Usos este mes", item.usage?.monthCount || 0],
    ["Keynote", song.keynoteReviewStatus || "pendiente"],
    ["PDF Drive", song.drivePdfUrl || song.pdfUrl ? "Sí" : "No"],
    ["PDF local", song.localPdfPath ? "Sí" : "No"],
    ["YouTube/Spotify", song.youtubeUrl || song.spotifyUrl ? "Sí" : "No"]
  ];
}

function EmptySmartState({ title, message, action, onAction }) {
  return (
    <SmartPanel>
      <p className="text-lg font-black text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink/60">{message}</p>
      {action ? <Button className="mt-4" variant="secondary" onClick={onAction}>{action}</Button> : null}
    </SmartPanel>
  );
}

export function SmartCenter() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { profile, canEdit } = useAuth();
  const { songs, schedules, themes, saveSchedule, replaceScheduleSong } = useMusicData();
  const nextSchedule = getCurrentOrNextSchedule(schedules) || schedules[0] || null;
  const [activeTab, setActiveTab] = useState("programar");
  const [options, setOptions] = useState(defaultOptions);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [replacementSongId, setReplacementSongId] = useState("");
  const [intentQuery, setIntentQuery] = useState("adoración en tono G");
  const [dismissed, setDismissed] = useState([]);
  const [status, setStatus] = useState("");
  const [blockOverrides, setBlockOverrides] = useState({});
  const [alternativeSlot, setAlternativeSlot] = useState(null);
  const [compareItem, setCompareItem] = useState(null);
  const [compareSongId, setCompareSongId] = useState("");
  const [applyBlockModalOpen, setApplyBlockModalOpen] = useState(false);

  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) || nextSchedule;
  const selectedServiceType = options.serviceType || inferSmartServiceType(selectedSchedule || {});
  const usageIndex = useMemo(() => buildUsageIndex(schedules), [schedules]);
  const themeOptions = useMemo(() => {
    const values = new Set();
    (themes || []).forEach((theme) => values.add(theme.name || theme.label || theme));
    songs.forEach((song) => {
      if (song.mainTheme) values.add(song.mainTheme);
      (song.otherThemes || []).forEach((theme) => values.add(theme));
    });
    return [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "es"));
  }, [songs, themes]);
  const recommendations = useMemo(
    () => getSongRecommendations(songs, schedules, { ...options, serviceType: selectedServiceType, currentSchedule: selectedSchedule, limit: 20, usageIndex })
      .filter((item) => !dismissed.includes(item.song.id)),
    [dismissed, options, schedules, selectedSchedule, selectedServiceType, songs, usageIndex]
  );
  const rawBlock = useMemo(
    () => createSuggestedServiceBlock(songs, schedules, { ...options, serviceType: selectedServiceType, currentSchedule: selectedSchedule }),
    [options, schedules, selectedSchedule, selectedServiceType, songs]
  );
  const suggestedBlock = useMemo(() => nextBlockState(rawBlock, blockOverrides), [blockOverrides, rawBlock]);
  const review = useMemo(
    () => selectedSchedule ? reviewServiceSchedule(selectedSchedule, songs) : { score: 0, status: "Sin programación", alerts: [] },
    [selectedSchedule, songs]
  );
  const currentReplacementEntry = selectedSchedule?.songs?.find((entry) => entry.songId === replacementSongId) || selectedSchedule?.songs?.[0] || null;
  const currentReplacementSong = songs.find((song) => song.id === currentReplacementEntry?.songId) || null;
  const replacementCandidates = useMemo(
    () => currentReplacementSong ? getReplacementCandidates(currentReplacementSong, songs, schedules, selectedSchedule).slice(0, 8) : [],
    [currentReplacementSong, schedules, selectedSchedule, songs]
  );
  const insights = useMemo(() => getRepertoireInsightsSafe(songs, schedules), [schedules, songs]);
  const gaps = useMemo(() => getPreparationGaps(songs), [songs]);
  const intentSearch = useMemo(() => searchSongsByIntent(intentQuery, songs, usageIndex), [intentQuery, songs, usageIndex]);
  const alternativeCandidates = useMemo(() => {
    if (!alternativeSlot) return [];
    const selectedIds = new Set(suggestedBlock.items.map((item) => item.song.id));
    selectedIds.delete(suggestedBlock.items.find((item) => item.slot.id === alternativeSlot.id)?.song.id);
    return getSlotAlternatives(songs, schedules, { ...options, serviceType: selectedServiceType, currentSchedule: selectedSchedule }, alternativeSlot, selectedIds).slice(0, 8);
  }, [alternativeSlot, options, schedules, selectedSchedule, selectedServiceType, songs, suggestedBlock.items]);
  const compareTargetSong = songs.find((song) => song.id === compareSongId) || recommendations.find((item) => item.song.id !== compareItem?.song?.id)?.song || null;
  const compareTargetItem = compareTargetSong ? scoreSong(compareTargetSong, { ...options, serviceType: selectedServiceType }, { usageIndex }) : null;

  const updateOption = (key, value) => {
    setBlockOverrides({});
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const generateForNextService = () => {
    if (!nextSchedule) {
      setStatus("No hay programación próxima registrada. Crea una programación y vuelve a generar el bloque.");
      return;
    }
    const serviceType = inferSmartServiceType(nextSchedule);
    setSelectedScheduleId(nextSchedule.id);
    setOptions((current) => ({
      ...current,
      serviceType,
      count: getSmartServiceDefaultCount(serviceType),
      seed: current.seed + 1
    }));
    setBlockOverrides({});
    setActiveTab("programar");
    setStatus(`Bloque generado para ${scheduleLabel(nextSchedule)}.`);
  };

  const regenerateBlock = () => {
    setOptions((current) => ({ ...current, seed: current.seed + 1 }));
    setBlockOverrides({});
    setStatus("Bloque regenerado con nuevas alternativas.");
  };

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

  const applyBlock = async (mode) => {
    if (!selectedSchedule?.id) {
      setStatus("No hay programación destino. Abre Programación para crear el servicio primero.");
      setApplyBlockModalOpen(false);
      return;
    }
    const entries = suggestedBlock.items.map((item) => toSongEntry(item.song, item.role));
    const nextSongs = mode === "replace" ? entries : [...(selectedSchedule.songs || []), ...entries.filter((entry) => !(selectedSchedule.songs || []).some((current) => current.songId === entry.songId))];
    await saveSchedule({ ...selectedSchedule, songs: nextSongs });
    setApplyBlockModalOpen(false);
    setStatus(mode === "replace" ? "Bloque aplicado reemplazando los cantos actuales." : "Bloque agregado al final de la programación.");
  };

  const replaceSong = async (candidate) => {
    if (!selectedSchedule?.id || !currentReplacementEntry || !candidate?.id) return;
    if (!confirm(`¿Sustituir "${currentReplacementEntry.titleSnapshot}" por "${candidate.title}"?`)) return;
    await replaceScheduleSong(selectedSchedule.id, currentReplacementEntry, candidate);
    setStatus(`Sustitución aplicada: ${currentReplacementEntry.titleSnapshot} -> ${candidate.title}`);
  };

  const openRepertoireFilter = (params = {}) => {
    const search = new URLSearchParams(params);
    navigate(`/repertorio?${search.toString()}`);
  };

  const openCompare = (item) => {
    setCompareItem(item);
    setCompareSongId(recommendations.find((candidate) => candidate.song.id !== item.song.id)?.song.id || "");
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
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brass/25 bg-brass/12 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brass">
              <BrainCircuit className="h-4 w-4" />
              Análisis inteligente sin IA externa
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-normal text-ink md:text-4xl">Centro Inteligente</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
              Un panel de apoyo para armar servicios reales con tema, posición, rotación y preparación.
            </p>
          </div>
          <Button onClick={generateForNextService}>
            <Wand2 className="h-4 w-4" />
            Generar bloque para el siguiente servicio
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SmartPanel>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Próximo servicio</p>
                <p className="mt-1 font-black text-ink">{nextSchedule ? scheduleLabel(nextSchedule) : "Sin próxima programación"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Tipo detectado</p>
                <p className="mt-1 font-black text-ink">{nextSchedule ? inferSmartServiceType(nextSchedule) : selectedServiceType}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Cantos sugeridos</p>
                <p className="mt-1 font-black text-ink">{getSmartServiceDefaultCount(nextSchedule ? inferSmartServiceType(nextSchedule) : selectedServiceType)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Preparación</p>
                <p className="mt-1 font-black text-ink">{review.score}/100</p>
              </div>
            </div>
          </SmartPanel>
          <SmartPanel>
            <p className="text-xs font-bold uppercase tracking-wide text-brass">Tema actual</p>
            <p className="mt-1 text-lg font-black text-ink">{parseThemeInput(options.theme).join(" + ") || "Sin tema elegido"}</p>
            <p className="mt-1 text-sm text-ink/60">{songs.length} cantos · {schedules.length} programaciones analizadas</p>
          </SmartPanel>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${active ? "bg-ink text-white shadow-soft dark:bg-brass dark:text-ink" : "bg-white/70 text-ink ring-1 ring-ink/10 hover:bg-brass/10 dark:bg-white/8 dark:ring-white/10"}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {status ? <p className="mt-5 rounded-2xl border border-brass/25 bg-brass/12 p-3 text-sm font-semibold text-ink">{status}</p> : null}

        {activeTab === "programar" ? (
          <section className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
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
                  <Select value={selectedServiceType} onChange={(event) => updateOption("serviceType", event.target.value)}>
                    {smartServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </Select>
                </Field>
                <Field label="Tema principal y secundarios">
                  <Input value={options.theme} onChange={(event) => updateOption("theme", event.target.value)} placeholder="cruz, gracia" />
                </Field>
                {themeOptions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {themeOptions.slice(0, 10).map((theme) => (
                      <button key={theme} type="button" onClick={() => updateOption("theme", theme)} className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">
                        {theme}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Field label="Número de cantos">
                  <Input type="number" min="1" max="8" value={options.count} onChange={(event) => updateOption("count", Number(event.target.value || getSmartServiceDefaultCount(selectedServiceType)))} />
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={options.includeHymns} onChange={(event) => updateOption("includeHymns", event.target.checked)} />
                  Intentar abrir con himno si conviene
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={options.avoidRecent} onChange={(event) => updateOption("avoidRecent", event.target.checked)} />
                  Evitar repetidos recientes
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={options.onlyKeynoteReady} onChange={(event) => updateOption("onlyKeynoteReady", event.target.checked)} />
                  Solo con Keynote listo
                </label>
                <div className="grid gap-2">
                  <Button onClick={regenerateBlock}><Wand2 className="h-4 w-4" />Crear bloque sugerido</Button>
                  <Button variant="secondary" onClick={regenerateBlock}><RefreshCw className="h-4 w-4" />Regenerar bloque</Button>
                  <Button variant="secondary" onClick={() => updateOption("count", getSmartServiceDefaultCount(selectedServiceType))}>Usar cantidad sugerida</Button>
                </div>
              </div>
            </SmartPanel>

            <div className="grid gap-4">
              <SmartPanel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brass">{selectedServiceType} · Tema: {suggestedBlock.theme}</p>
                    <h3 className="text-xl font-black text-ink">Bloque sugerido</h3>
                  </div>
                  <ScoreBadge score={suggestedBlock.score} label="Bloque" />
                </div>
                <div className="mt-4 grid gap-3">
                  {suggestedBlock.items.length ? suggestedBlock.items.map((item, index) => (
                    <article key={`${item.slot.id}-${item.song.id}`} className="rounded-2xl border border-white/60 bg-white/74 p-4 shadow-soft dark:border-white/10 dark:bg-white/8">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-brass">{index + 1}. {item.role}</p>
                          <h4 className="mt-1 text-lg font-black text-ink">{item.song.title}</h4>
                          <p className="mt-1 text-sm text-ink/60">{item.slot.description}</p>
                          <div className="mt-3"><ReasonChips reasons={item.reasons} warnings={item.warnings} /></div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <ScoreBadge score={item.score} compact />
                          <Button variant="secondary" onClick={() => setAlternativeSlot(item.slot)}><Shuffle className="h-4 w-4" />Cambiar</Button>
                          <Button variant="subtle" onClick={() => openCompare(item)}>Comparar</Button>
                        </div>
                      </div>
                    </article>
                  )) : (
                    <EmptySmartState title="No hay suficientes datos" message="No se pudo formar un bloque. Revisa que los cantos tengan tema, tono y preparación." action="Ir a repertorio" onAction={() => navigate("/repertorio")} />
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestedBlock.reasons.map((reason) => <span key={reason} className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{reason}</span>)}
                </div>
                <Button className="mt-4" disabled={!suggestedBlock.items.length || !canEdit} onClick={() => setApplyBlockModalOpen(true)}>
                  <ListChecks className="h-4 w-4" />
                  Agregar bloque a programación
                </Button>
              </SmartPanel>

              <div className="grid gap-4 lg:grid-cols-2">
                {recommendations.slice(0, 8).map((item) => (
                  <RecommendationCard
                    key={item.song.id}
                    item={item}
                    onAdd={addSongToSchedule}
                    onView={(song) => navigate(`/repertorio/${song.id}`)}
                    onCompare={() => openCompare(item)}
                    onDismiss={(song) => setDismissed((current) => [...current, song.id])}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "revisar" ? <section className="mt-6"><ServiceReviewPanel review={review} /></section> : null}

        {activeTab === "sustituir" ? (
          <section className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SmartPanel>
              <div className="flex items-center gap-2">
                <GitCompareArrows className="h-5 w-5 text-brass" />
                <h2 className="text-xl font-black text-ink">Sustitución inteligente</h2>
              </div>
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
              ) : <p className="mt-4 text-sm text-ink/60">Esta programación no tiene cantos para sustituir.</p>}
            </SmartPanel>
            <div className="grid gap-4 lg:grid-cols-2">
              {replacementCandidates.map((item) => (
                <RecommendationCard
                  key={item.song.id}
                  item={{ ...item, label: "Compatibilidad de sustitución" }}
                  actionLabel="Sustituir"
                  onAdd={replaceSong}
                  onView={(song) => navigate(`/repertorio/${song.id}`)}
                  onCompare={() => openCompare(item)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "balance" ? (
          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <SmartPanel>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-brass" />
                <h2 className="text-xl font-black text-ink">Balance del repertorio</h2>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {insights.map((insight) => (
                  <InsightCard key={insight.title} insight={insight} onAction={() => openRepertoireFilter(insight.filter || { q: insight.title })} />
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
                    <Button variant="subtle" className="mt-3 h-9 px-3 text-xs" onClick={() => openRepertoireFilter({ smartFilter: gap.key })}>Aplicar filtro</Button>
                  </div>
                ))}
              </div>
            </SmartPanel>
          </section>
        ) : null}

        {activeTab === "buscar" ? (
          <section className="mt-6">
            <SmartPanel>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-brass" />
                <h2 className="text-xl font-black text-ink">Buscar por intención</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={intentQuery} onChange={(event) => setIntentQuery(event.target.value)} placeholder="cantos para santa cena, himnos no usados, sin youtube..." />
                <Button variant="secondary" onClick={() => openRepertoireFilter({ q: intentQuery })}>Aplicar filtro</Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {intentSearch.interpretation.length ? intentSearch.interpretation.map((item) => <span key={item} className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{item}</span>) : <span className="text-sm text-ink/55">Escribe una intención para interpretarla.</span>}
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
        ) : null}
      </motion.div>

      <Modal open={Boolean(alternativeSlot)} title={`Cambiar ${alternativeSlot?.role || "posición"}`} onClose={() => setAlternativeSlot(null)} wide>
        <div className="grid max-h-[70dvh] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
          {alternativeCandidates.map((item) => (
            <RecommendationCard
              key={item.song.id}
              item={{ ...item, label: alternativeSlot?.role }}
              actionLabel="Usar aquí"
              onAdd={() => {
                setBlockOverrides((current) => ({ ...current, [alternativeSlot.id]: { ...item, role: alternativeSlot.role, slot: alternativeSlot } }));
                setAlternativeSlot(null);
              }}
              onView={(song) => navigate(`/repertorio/${song.id}`)}
              onCompare={() => openCompare(item)}
            />
          ))}
          {!alternativeCandidates.length ? <p className="text-sm text-ink/60">No hay alternativas disponibles para esta posición sin duplicar cantos.</p> : null}
        </div>
      </Modal>

      <Modal open={applyBlockModalOpen} title="¿Agregar este bloque a la programación?" onClose={() => setApplyBlockModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-ink/62">Destino: <strong>{selectedSchedule ? scheduleLabel(selectedSchedule) : "sin programación"}</strong></p>
          <div className="grid gap-2">
            <Button onClick={() => applyBlock("replace")}>Reemplazar cantos actuales</Button>
            <Button variant="secondary" onClick={() => applyBlock("append")}>Agregar al final</Button>
            <Button variant="subtle" onClick={() => setApplyBlockModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(compareItem)} title="Comparar cantos" onClose={() => setCompareItem(null)} wide>
        {compareItem ? (
          <div className="max-h-[75dvh] overflow-y-auto pr-1">
            <Field label="Comparar contra">
              <Select value={compareTargetSong?.id || ""} onChange={(event) => setCompareSongId(event.target.value)}>
                {songs.filter((song) => song.id !== compareItem.song.id).map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
              </Select>
            </Field>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[compareItem, compareTargetItem].filter(Boolean).map((item) => (
                <article key={item.song.id} className="rounded-2xl border border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-white/8">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-brass">{item.label || "Candidato"}</p>
                      <h3 className="mt-1 text-xl font-black text-ink">{item.song.title}</h3>
                    </div>
                    <ScoreBadge score={item.score} compact />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    {songFactRows(item.song, item).map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 border-b border-ink/5 py-1">
                        <span className="font-semibold text-ink/55">{label}</span>
                        <span className="text-right font-bold text-ink">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4"><ReasonChips reasons={item.reasons} warnings={item.warnings} /></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {getSongPdfUrl(item.song) ? <Button variant="secondary" onClick={() => window.open(getSongPdfUrl(item.song), "_blank", "noopener,noreferrer")}>Abrir PDF</Button> : null}
                    <Button variant="subtle" onClick={() => navigate(`/repertorio/${item.song.id}`)}>Ver detalle</Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </SmartGradientBackground>
  );
}

function getRepertoireInsightsSafe(songs, schedules) {
  return getRepertoireInsights(songs, schedules).map((insight) => ({
    ...insight,
    filter: insight.filter || (insight.action?.toLowerCase().includes("filtrar") ? { q: insight.title } : { smart: insight.title })
  }));
}
