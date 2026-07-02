import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, FileSearch, ListMusic, Music2, Search, Sparkles, Tags, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import { SortableHandle, SortableList } from "../ui/SortableList";
import { SongCoverImage } from "../song/SongCoverArtwork";
import { RecommendationCard } from "./RecommendationCard";
import { SmartPanel } from "./SmartPanel";
import {
  buildUsageIndex,
  getServiceSlots,
  getSongRecommendations,
  inferSmartServiceType,
  parseThemeInput,
  toSongEntry
} from "../../services/smartRecommendations";
import { formatDate, getScheduleStartDate, isCountableSchedule } from "../../services/dateUtils";
import { getSongCategoryOptions, normalizeSearchText } from "../../services/songUtils";
import { getAssistantServiceOptions, getWorshipLeaderOptions } from "../../services/serviceOptions";

const searchTabs = [
  { id: "title", label: "Cantos y letra", icon: Music2 },
  { id: "history", label: "Por historial", icon: CalendarDays },
  { id: "theme", label: "Por tema", icon: Tags }
];

const historyFilterOptions = [
  { value: "", label: "Última vez" },
  { value: "none", label: "Sin historial" },
  ...Array.from({ length: 11 }, (_, index) => {
    const months = index + 2;
    return {
      value: `m${months}`,
      label: months === 12 ? "Hace un año" : `Hace ${months} meses`
    };
  })
];

function suggestedServiceType(dateValue = "") {
  if (!dateValue) return "";
  const day = new Date(`${dateValue}T12:00:00`).getDay();
  if (day === 3) return "Miércoles de oración";
  if (day === 0) return "Domingo AM";
  return "Servicio especial";
}

function ChipInput({ values = [], onChange, placeholder }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const additions = parseThemeInput(draft);
    if (!additions.length) return;
    const current = new Set(values.map(normalizeSearchText));
    onChange([...values, ...additions.filter((value) => !current.has(normalizeSearchText(value)))]);
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-white/70 p-2 dark:border-white/12 dark:bg-black/20">
      {values.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="rounded-full bg-brass/14 px-2.5 py-1 text-xs font-bold text-ink transition hover:bg-red-500/12 hover:text-red-700 dark:hover:text-red-200"
              title="Quitar"
            >
              {value} ×
            </button>
          ))}
        </div>
      ) : null}
      <Input
        value={draft}
        className="border-0 bg-transparent px-1 shadow-none"
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
}

function songThemeText(song = {}) {
  return normalizeSearchText([
    song.mainTheme,
    ...(Array.isArray(song.otherThemes) ? song.otherThemes : []),
    ...(Array.isArray(song.tags) ? song.tags : [])
  ].filter(Boolean).join(" "));
}

function songThemeValues(song = {}) {
  return [
    song.mainTheme,
    ...(Array.isArray(song.otherThemes) ? song.otherThemes : []),
    ...(Array.isArray(song.tags) ? song.tags : [])
  ].filter(Boolean);
}

function buildTitleSearchMatches(songs = [], query = "") {
  const normalizedQuery = normalizeSearchText(query);
  const matches = new Map();
  if (!normalizedQuery) return matches;

  const directMatches = songs.filter((song) => normalizeSearchText(song.title).includes(normalizedQuery));
  directMatches.forEach((song) => matches.set(song.id, { kind: "direct" }));

  const anchorThemes = new Map();
  const anchorCategories = new Set();
  directMatches.forEach((song) => {
    songThemeValues(song).forEach((theme) => {
      const key = normalizeSearchText(theme);
      if (key && !anchorThemes.has(key)) anchorThemes.set(key, theme);
    });
    const category = normalizeSearchText(song.category);
    if (["himno", "navidad", "santa cena"].includes(category)) anchorCategories.add(category);
  });

  songs.forEach((song) => {
    if (!song?.id || matches.has(song.id)) return;
    const themeValues = songThemeValues(song);
    const metadataMatch = themeValues.find((theme) => normalizeSearchText(theme).includes(normalizedQuery));
    if (metadataMatch) {
      matches.set(song.id, {
        kind: "related",
        label: "Relacionado",
        reason: `Relacionado por tema: ${metadataMatch}`
      });
      return;
    }

    const sharedTheme = themeValues.find((theme) => anchorThemes.has(normalizeSearchText(theme)));
    if (sharedTheme) {
      matches.set(song.id, {
        kind: "related",
        label: "Relacionado",
        reason: `Comparte el tema: ${sharedTheme}`
      });
      return;
    }

    const category = normalizeSearchText(song.category);
    if (category && anchorCategories.has(category)) {
      matches.set(song.id, {
        kind: "related",
        label: "Relacionado",
        reason: `Misma categoría: ${song.category}`
      });
    }
  });

  return matches;
}

function buildScheduleSongs(selectedItems = [], serviceType = "") {
  const slots = getServiceSlots(serviceType || "Servicio especial", selectedItems.length);
  return selectedItems.map((item, index) => {
    const song = item.song || item;
    const currentEntry = item.entry || {};
    return {
      ...toSongEntry(song, slots[index]?.role || currentEntry.position || ""),
      notes: currentEntry.notes || song.internalNotes || ""
    };
  });
}

function selectedItemId(item = {}) {
  return item.song?.id || item.songId || item.id;
}

function usageForSong(usageIndex, songId) {
  return usageIndex?.usage?.get(songId) || null;
}

function historyMonthBucket(daysSince) {
  if (daysSince === null || daysSince === undefined || !Number.isFinite(daysSince)) return null;
  return Math.floor(Number(daysSince) / 30);
}

function historyLabel(usage) {
  if (!usage?.lastUsedAt) return "Sin historial previo";
  const days = Number(usage.lastUsedDays);
  if (!Number.isFinite(days)) return `Último uso: ${usage.lastUsedAt}`;
  if (days < 30) return `Último uso: hace ${days} día(s)`;
  const months = Math.floor(days / 30);
  const rest = days % 30;
  return rest ? `Último uso: hace ${months} mes(es) y ${rest} día(s)` : `Último uso: hace ${months} mes(es)`;
}

function historyFilterMatches(usage, filter) {
  if (!filter) return true;
  if (filter === "none") return !usage?.lastUsedAt;
  const months = Number(String(filter).replace("m", ""));
  if (!Number.isFinite(months)) return true;
  const bucket = historyMonthBucket(usage?.lastUsedDays);
  if (bucket === null) return false;
  return months >= 12 ? bucket >= 12 : bucket === months;
}

function readinessSignals(song = {}) {
  const positives = [];
  const penalties = [];
  if (song.keynoteReviewStatus === "completado") positives.push({ value: 4, label: "Keynote listo" });
  else penalties.push({ value: -3, label: "Keynote pendiente" });
  if (song.pdfReviewStatus === "completado" || song.drivePdfUrl || song.pdfUrl || song.localPdfPath) positives.push({ value: 4, label: "PDF listo" });
  else penalties.push({ value: -3, label: "PDF pendiente" });
  if (song.mainKey || song.keyWithCapo) positives.push({ value: 2, label: "Tono definido" });
  else penalties.push({ value: -2, label: "Falta tono" });
  return { positives, penalties };
}

function categoryMatches(song = {}, categoryChoice = "cualquiera") {
  const selected = normalizeSearchText(categoryChoice || "cualquiera");
  if (!selected || selected === "cualquiera") return true;
  return normalizeSearchText(song.category || "") === selected;
}

function buildHistoryRecommendations(songs = [], usageIndex, { filter = "", sort = "az", categoryChoice = "cualquiera" } = {}) {
  const rows = songs
    .filter((song) => categoryMatches(song, categoryChoice))
    .map((song) => {
      const usage = usageForSong(usageIndex, song.id);
      const hasHistory = Boolean(usage?.lastUsedAt);
      const daysSince = hasHistory && Number.isFinite(Number(usage.lastUsedDays)) ? Number(usage.lastUsedDays) : Number.POSITIVE_INFINITY;
      return { song, usage, hasHistory, daysSince };
    })
    .filter((item) => historyFilterMatches(item.usage, filter));

  rows.sort((a, b) => {
    const titleCompare = String(a.song.title || "").localeCompare(String(b.song.title || ""), "es", { sensitivity: "base" });
    return sort === "za" ? -titleCompare : titleCompare;
  });

  return rows.map((item, index) => {
    const signals = readinessSignals(item.song);
    const usageText = historyLabel(item.usage);
    const positives = [
      { value: 0, label: item.hasHistory ? usageText : "Sin historial previo" },
      ...signals.positives
    ];
    const penalties = [
      ...signals.penalties,
      ...(item.hasHistory && item.daysSince < 30 ? [{ value: -8, label: "Uso reciente" }] : [])
    ];
    return {
      song: item.song,
      score: 0,
      reasons: positives.map((entry) => entry.label),
      warnings: penalties.map((entry) => entry.label),
      usageSummary: {
        lastUse: usageText,
        monthly: `${item.usage?.recent30Count || 0} uso(s) en 30 días`
      },
      scoreDetails: {
        positives,
        penalties,
        warnings: [],
        rawScore: 0,
        finalScore: 0,
        usage: item.usage || null
      }
    };
  });
}

export function SongSuggestionAssistant({
  songs = [],
  schedules = [],
  themes = [],
  settings = {},
  schedule = null,
  initialDate = "",
  canEdit = false,
  saveSchedule,
  indexLocalPdfTexts,
  navigate,
  onExplainScore
}) {
  const safeSongs = Array.isArray(songs) ? songs : [];
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const serviceOptions = useMemo(() => getAssistantServiceOptions(settings), [settings]);
  const worshipLeaderOptions = useMemo(() => [...new Set([...getWorshipLeaderOptions(settings), "Otro"])], [settings]);
  const serviceMeta = useMemo(
    () => Object.fromEntries(serviceOptions.map((option) => [option.assistantLabel, option])),
    [serviceOptions]
  );
  const fallbackService = serviceOptions.find((option) => option.value === "especial") || serviceOptions[0];
  const [targetDate, setTargetDate] = useState(schedule?.date || initialDate || "");
  const [targetScheduleId, setTargetScheduleId] = useState(schedule?.id || "");
  const [serviceType, setServiceType] = useState(() => schedule ? inferSmartServiceType(schedule) : suggestedServiceType(initialDate));
  const [leaderChoice, setLeaderChoice] = useState(() => (schedule?.leader && worshipLeaderOptions.includes(schedule.leader)) ? schedule.leader : schedule?.leader ? "Otro" : "");
  const [manualLeader, setManualLeader] = useState(() => (schedule?.leader && !worshipLeaderOptions.includes(schedule.leader)) ? schedule.leader : "");
  const [searchTab, setSearchTab] = useState("title");
  const [titleQuery, setTitleQuery] = useState("");
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [pdfTerms, setPdfTerms] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("");
  const [historySort, setHistorySort] = useState("az");
  const rotationPriority = "strict";
  const [categoryChoice, setCategoryChoice] = useState("cualquiera");
  const [hasSearched, setHasSearched] = useState(false);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(null);

  const schedulesOnDate = useMemo(
    () => safeSchedules
      .filter((item) => !item.deleted && isCountableSchedule(item) && item.date === targetDate)
      .sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))),
    [safeSchedules, targetDate]
  );
  const targetSchedule = safeSchedules.find((item) => item.id === targetScheduleId)
    || (schedule?.id === targetScheduleId ? schedule : null);

  useEffect(() => {
    const nextDate = schedule?.date || initialDate || "";
    setTargetDate(nextDate);
    const nextSchedule = schedule || safeSchedules.find((item) => (
      !item.deleted
      && isCountableSchedule(item)
      && item.date === nextDate
    )) || null;
    setTargetScheduleId(nextSchedule?.id || "");
    setServiceType(nextSchedule ? inferSmartServiceType(nextSchedule) : suggestedServiceType(nextDate));
    setLeaderChoice(nextSchedule?.leader && worshipLeaderOptions.includes(nextSchedule.leader) ? nextSchedule.leader : nextSchedule?.leader ? "Otro" : "");
    setManualLeader(nextSchedule?.leader && !worshipLeaderOptions.includes(nextSchedule.leader) ? nextSchedule.leader : "");
  }, [initialDate, safeSchedules, schedule, worshipLeaderOptions]);

  useEffect(() => {
    const source = targetSchedule?.songs || [];
    setSelectedItems(source.map((entry) => {
      const song = safeSongs.find((item) => item.id === entry.songId);
      return song ? { song, entry } : null;
    }).filter(Boolean));
  }, [safeSongs, targetSchedule?.id]);

  useEffect(() => {
    if (!targetSchedule) return;
    setServiceType(inferSmartServiceType(targetSchedule));
    setLeaderChoice(targetSchedule?.leader && worshipLeaderOptions.includes(targetSchedule.leader) ? targetSchedule.leader : targetSchedule?.leader ? "Otro" : "");
    setManualLeader(targetSchedule?.leader && !worshipLeaderOptions.includes(targetSchedule.leader) ? targetSchedule.leader : "");
  }, [targetSchedule, worshipLeaderOptions]);

  const selectedLeader = leaderChoice === "Otro" ? manualLeader.trim() : leaderChoice;

  const referenceSchedule = useMemo(() => targetSchedule || (
    targetDate && serviceType
      ? { date: targetDate, ...(serviceMeta[serviceType] || fallbackService) }
      : null
  ), [fallbackService, serviceMeta, serviceType, targetDate, targetSchedule]);
  const referenceDate = useMemo(
    () => getScheduleStartDate(referenceSchedule || {}) || new Date(),
    [referenceSchedule]
  );
  const usageIndex = useMemo(
    () => buildUsageIndex(safeSchedules, referenceDate, {
      currentSchedule: referenceSchedule,
      excludeScheduleId: targetSchedule?.id,
      beforeDateTime: referenceSchedule ? referenceDate.toISOString() : ""
    }),
    [referenceDate, referenceSchedule, safeSchedules, targetSchedule?.id]
  );

  const themeOptions = useMemo(() => {
    const values = new Set();
    (Array.isArray(themes) ? themes : []).forEach((theme) => values.add(theme?.name || theme?.label || theme));
    safeSongs.forEach((song) => {
      if (song.mainTheme) values.add(song.mainTheme);
      (Array.isArray(song.otherThemes) ? song.otherThemes : []).forEach((theme) => values.add(theme));
    });
    return [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "es"));
  }, [safeSongs, themes]);

  const categoryOptions = useMemo(
    () => getSongCategoryOptions(settings, safeSongs).sort((a, b) => String(a).localeCompare(String(b), "es", { sensitivity: "base" })),
    [safeSongs, settings]
  );

  const indexableSongs = useMemo(
    () => safeSongs.filter((song) => song.localPdfPath),
    [safeSongs]
  );
  const indexedCount = useMemo(
    () => indexableSongs.filter((song) => song.pdfSearchText || song.pdfOcrText || song.pdfText || song.lyricsText).length,
    [indexableSongs]
  );
  const missingIndexCount = Math.max(0, indexableSongs.length - indexedCount);
  const normalizedTitleQuery = normalizeSearchText(titleQuery);
  const normalizedThemes = selectedThemes.map(normalizeSearchText).filter(Boolean);
  const titleSearchMatches = useMemo(
    () => buildTitleSearchMatches(safeSongs, titleQuery),
    [safeSongs, titleQuery]
  );
  const titleRelations = useMemo(() => {
    const relations = new Map();
    titleSearchMatches.forEach((value, songId) => {
      if (value.kind === "related") relations.set(songId, value);
    });
    return relations;
  }, [titleSearchMatches]);
  const searchOptions = useMemo(() => ({
    serviceType,
    currentSchedule: targetSchedule,
    titleQuery,
    theme: selectedThemes.join(", "),
    includePdfText: pdfTerms.length > 0,
    pdfSearchQuery: pdfTerms.join(", "),
    rotationPriority,
    preferUnderused: true,
    avoidRecent: true,
    includeHymns: serviceType !== "Miércoles de oración",
    categoryChoice,
    allowPending: true,
    includeZeroScore: true,
    titleRelations,
    usageIndex,
    limit: Math.max(1, safeSongs.length)
  }), [
    categoryChoice,
    pdfTerms,
    rotationPriority,
    safeSongs.length,
    selectedThemes,
    serviceType,
    targetSchedule,
    titleQuery,
    titleRelations,
    usageIndex
  ]);

  const recommendations = useMemo(() => {
    if (!hasSearched) return [];
    if (searchTab === "history") {
      return buildHistoryRecommendations(safeSongs, usageIndex, { filter: historyFilter, sort: historySort, categoryChoice })
        .filter((item) => !dismissedIds.includes(item.song.id));
    }
    return getSongRecommendations(safeSongs, safeSchedules, searchOptions)
      .map((item) => ({
        ...item,
        searchRelation: titleSearchMatches.get(item.song.id) || null
      }))
      .filter((item) => !dismissedIds.includes(item.song.id))
      .filter((item) => !normalizedTitleQuery || titleSearchMatches.has(item.song.id))
      .filter((item) => !normalizedThemes.length || normalizedThemes.some((theme) => songThemeText(item.song).includes(theme)))
      .filter((item) => !pdfTerms.length || item.scoreDetails?.pdfMatches?.length)
      .sort((a, b) => {
        const leftRelationRank = a.searchRelation?.kind === "direct" ? 0 : 1;
        const rightRelationRank = b.searchRelation?.kind === "direct" ? 0 : 1;
        const leftMatches = a.scoreDetails?.pdfMatches?.length || 0;
        const rightMatches = b.scoreDetails?.pdfMatches?.length || 0;
        return leftRelationRank - rightRelationRank
          || rightMatches - leftMatches
          || b.score - a.score
          || String(a.song.title || "").localeCompare(String(b.song.title || ""), "es");
      });
  }, [
    dismissedIds,
    hasSearched,
    categoryChoice,
    historyFilter,
    historySort,
    normalizedThemes,
    normalizedTitleQuery,
    pdfTerms.length,
    safeSchedules,
    safeSongs,
    searchTab,
    searchOptions,
    titleSearchMatches,
    usageIndex
  ]);

  const selectedIds = useMemo(() => new Set(selectedItems.map(selectedItemId)), [selectedItems]);
  const activeCriteria = [
    normalizedTitleQuery ? `Título: ${titleQuery.trim()}` : "",
    searchTab === "history" && historyFilter ? historyFilterOptions.find((item) => item.value === historyFilter)?.label : "",
    selectedThemes.length ? `${selectedThemes.length} tema(s)` : "",
    pdfTerms.length ? `${pdfTerms.length} palabra(s) o frase(s)` : ""
  ].filter(Boolean);

  const search = () => {
    setHasSearched(true);
    setDismissedIds([]);
    setStatus("");
  };

  const addSong = (song) => {
    if (!song?.id || selectedIds.has(song.id)) return;
    setSelectedItems((current) => [...current, { song, entry: null }]);
    setStatus(`Agregado: ${song.title}`);
  };

  const removeSong = (songId) => {
    setSelectedItems((current) => current.filter((item) => selectedItemId(item) !== songId));
  };

  const saveSelection = async () => {
    if (!canEdit || !saveSchedule) return;
    if (!targetDate) {
      setStatus("Selecciona un día en el calendario principal.");
      return;
    }
    if (!serviceType) {
      setStatus("Selecciona el tipo de servicio.");
      return;
    }
    if (!selectedItems.length) {
      setStatus("Agrega al menos un canto.");
      return;
    }

    setIsSaving(true);
    try {
      const scheduleSongs = buildScheduleSongs(selectedItems, serviceType);
      if (targetSchedule?.id) {
        await saveSchedule({ ...targetSchedule, leader: selectedLeader, songs: scheduleSongs });
        setStatus("Programación actualizada.");
        navigate?.(`/programacion?schedule=${targetSchedule.id}`);
        return;
      }
      const meta = serviceMeta[serviceType] || fallbackService;
      const createdId = await saveSchedule({
        date: targetDate,
        serviceType: meta.serviceType,
        serviceLabel: meta.serviceLabel,
        type: meta.serviceLabel,
        time: meta.time,
        leader: selectedLeader,
        songs: scheduleSongs,
        generalNotes: "",
        isSpecialService: Boolean(meta.special || meta.value === "especial"),
        specialProgram: [],
        status: "confirmed"
      });
      setStatus("Programación creada.");
      navigate?.(createdId ? `/programacion?schedule=${createdId}` : "/programacion");
    } finally {
      setIsSaving(false);
    }
  };

  const runIndexing = async () => {
    if (!indexLocalPdfTexts) return;
    setIsIndexing(true);
    setStatus("");
    try {
      const result = await indexLocalPdfTexts(setIndexProgress, { enableOcr: true, force: false });
      setStatus(`Indexación lista: ${result.indexed || 0} PDF(s) actualizados y ${result.reused || 0} índices vigentes.`);
    } finally {
      setIsIndexing(false);
    }
  };

  const renderSelectionPanel = (className = "") => (
    <SmartPanel className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-brass">Programación</p>
          <h3 className="mt-1 text-xl font-black text-ink">{selectedItems.length} canto(s)</h3>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white dark:bg-brass dark:text-ink">
          <ListMusic className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink/55">Agrega solo los cantos que elijas y arrástralos para ordenar el servicio.</p>

      <div className="mt-4">
        {selectedItems.length ? (
          <SortableList items={selectedItems} getId={selectedItemId} onReorder={setSelectedItems} className="grid gap-2">
            {(item, index, dragHandleProps) => (
              <article className="grid min-w-0 grid-cols-[40px_auto_minmax(0,1fr)_36px] items-center gap-2 rounded-xl border border-ink/10 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/7">
                <SortableHandle {...dragHandleProps} />
                <SongCoverImage song={item.song} wrapperClassName="h-10 w-10 rounded-xl" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-ink">{index + 1}. {item.song.title}</p>
                  <p className="truncate text-xs font-semibold text-ink/45">{item.song.category || "Sin categoría"} · {item.song.keyWithCapo || item.song.mainKey || "Sin tono"}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Quitar ${item.song.title}`}
                  onClick={() => removeSong(item.song.id)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink/40 transition hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            )}
          </SortableList>
        ) : (
          <div className="rounded-2xl bg-ink/5 p-4 text-sm text-ink/55 dark:bg-white/7">Todavía no has agregado cantos.</div>
        )}
      </div>

      {status ? <p className="mt-4 rounded-xl border border-brass/20 bg-brass/10 p-3 text-sm font-bold text-ink">{status}</p> : null}
      <Button className="mt-4 w-full" onClick={saveSelection} disabled={!canEdit || !selectedItems.length} isLoading={isSaving}>
        {targetSchedule ? <Check className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
        {targetSchedule ? "Guardar programación" : "Crear programación"}
      </Button>
    </SmartPanel>
  );

  return (
    <section className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <div className="grid min-w-0 gap-4">
        <SmartPanel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-brass">
                <Sparkles className="h-5 w-5" />
                <p className="text-xs font-black uppercase tracking-wide">Asistente de programación</p>
              </div>
              <h2 className="mt-2 text-2xl font-black text-ink">Encuentra cantos y decide tú</h2>
              <p className="mt-1 text-sm leading-6 text-ink/60">Combina título, temas y palabras de la letra. La rotación y la preparación ordenan los resultados.</p>
            </div>
            <div className="shrink-0 rounded-2xl border border-brass/20 bg-brass/10 px-3 py-2 text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-brass">{targetDate ? formatDate(targetDate) : "Sin fecha"}</p>
              <p className="mt-1 text-sm font-black text-ink">{serviceType || "Selecciona un servicio"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Field label="Destino">
              <Select
                value={targetScheduleId || "new"}
                onChange={(event) => {
                  const id = event.target.value === "new" ? "" : event.target.value;
                  setTargetScheduleId(id);
                  const next = safeSchedules.find((item) => item.id === id);
                  if (next) setServiceType(inferSmartServiceType(next));
                }}
              >
                <option value="new">Nueva programación</option>
                {schedulesOnDate.map((item) => (
                  <option key={item.id} value={item.id}>{item.serviceLabel || item.type || "Servicio"} · {item.time || "Sin hora"}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de servicio">
              <Select value={serviceType} onChange={(event) => setServiceType(event.target.value)} disabled={Boolean(targetSchedule)}>
                <option value="">Seleccionar</option>
                {serviceOptions.map((type) => <option key={type.value} value={type.assistantLabel}>{type.assistantLabel}</option>)}
              </Select>
            </Field>
            <Field label="Líder de adoración">
              <Select
                value={leaderChoice}
                onChange={(event) => {
                  setLeaderChoice(event.target.value);
                  if (event.target.value !== "Otro") setManualLeader("");
                }}
              >
                <option value="">Sin líder definido</option>
                {worshipLeaderOptions.map((leader) => (
                  <option key={leader} value={leader}>{leader}</option>
                ))}
              </Select>
            </Field>
            {leaderChoice === "Otro" ? (
              <Field label="Nombre del líder">
                <Input
                  value={manualLeader}
                  onChange={(event) => setManualLeader(event.target.value)}
                  placeholder="Escribe el nombre"
                />
              </Field>
            ) : null}
          </div>
        </SmartPanel>

        <SmartPanel>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {searchTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSearchTab(tab.id)}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition ${searchTab === tab.id ? "bg-ink text-white dark:bg-brass dark:text-ink" : "bg-ink/5 text-ink/65 hover:bg-brass/12 dark:bg-white/8"}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {searchTab === "title" ? (
              <div className="grid gap-4">
                <Field label="Título del canto">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-ink/35" />
                    <Input className="pl-9" value={titleQuery} onChange={(event) => setTitleQuery(event.target.value)} placeholder="Escribe el nombre o una parte" />
                  </div>
                </Field>
                <Field label="Palabras o frases en letras/PDF (opcional)">
                  <ChipInput values={pdfTerms} onChange={setPdfTerms} placeholder="Ej. perdón, gracia sublime, redención" />
                </Field>
                <div className="flex flex-col gap-2 rounded-2xl border border-brass/20 bg-brass/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <FileSearch className="h-4 w-4 shrink-0 text-brass" />
                    <span>
                      {indexedCount} de {indexableSongs.length} PDFs locales con texto indexado
                      {indexProgress ? <span className="block text-xs text-ink/50">{indexProgress.current || 0}/{indexProgress.total || 0}</span> : null}
                    </span>
                  </div>
                  {indexableSongs.length ? (
                    <Button variant="secondary" className="h-9 px-3 text-xs" onClick={runIndexing} disabled={isIndexing}>
                      {isIndexing ? "Indexando..." : missingIndexCount ? `Indexar faltantes (${missingIndexCount})` : "Revisar cambios"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {searchTab === "history" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-ink/10 bg-white/70 p-4 dark:border-white/12 dark:bg-black/20">
                  <p className="text-xs font-black uppercase tracking-wide text-brass">Última vez</p>
                  <Select className="mt-3" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}>
                    {historyFilterOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </section>
                <section className="rounded-2xl border border-ink/10 bg-white/70 p-4 dark:border-white/12 dark:bg-black/20">
                  <p className="text-xs font-black uppercase tracking-wide text-brass">Ordenar por</p>
                  <Select className="mt-3" value={historySort} onChange={(event) => setHistorySort(event.target.value)}>
                    <option value="az">A a Z</option>
                    <option value="za">Z a A</option>
                  </Select>
                </section>
              </div>
            ) : null}
            {searchTab === "theme" ? (
              <div className="grid gap-3">
                <Field label="Temas">
                  <ChipInput values={selectedThemes} onChange={setSelectedThemes} placeholder="Escribe uno o varios temas" />
                </Field>
                <div className="max-h-44 overflow-y-auto rounded-2xl border border-ink/10 bg-white/70 p-2 dark:border-brass/20 dark:bg-zinc-950/70">
                  <div className="flex flex-wrap gap-1.5">
                    {themeOptions.map((theme) => {
                      const selected = selectedThemes.some((item) => normalizeSearchText(item) === normalizeSearchText(theme));
                      return (
                        <button
                          key={theme}
                          type="button"
                          onClick={() => setSelectedThemes((current) => selected ? current.filter((item) => normalizeSearchText(item) !== normalizeSearchText(theme)) : [...current, theme])}
                          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${selected ? "bg-brass text-ink" : "bg-ink/5 text-ink/65 hover:bg-brass/15 dark:bg-white/8"}`}
                        >
                          {theme}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            <Field label="Categoría">
              <Select value={categoryChoice} onChange={(event) => setCategoryChoice(event.target.value)}>
                <option value="cualquiera">Cualquiera</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </Field>
          </div>

          {activeCriteria.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeCriteria.map((criterion) => <span key={criterion} className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{criterion}</span>)}
            </div>
          ) : searchTab !== "history" ? (
            <p className="mt-4 text-xs font-semibold text-ink/50">
              Sin búsqueda específica: se ordenará todo el repertorio por rotación y preparación.
            </p>
          ) : null}

          <Button variant="accent" className="mt-4 w-full" onClick={search}>
            <Search className="h-4 w-4" />
            Buscar sugerencias
          </Button>
        </SmartPanel>

        {renderSelectionPanel("xl:hidden")}

        {hasSearched ? (
          <SmartPanel>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-brass">Resultados</p>
                <h3 className="mt-1 text-xl font-black text-ink">{recommendations.length} canto(s) encontrados</h3>
              </div>
              <p className="text-xs font-semibold text-ink/50">
                {searchTab === "history" ? "Ordenados por título" : "Ordenados por coincidencia, rotación y preparación"}
              </p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {recommendations.map((item) => (
                <RecommendationCard
                  key={item.song.id}
                  item={item}
                  titleQuery={titleQuery}
                  relation={item.searchRelation}
                  isAdded={selectedIds.has(item.song.id)}
                  actionLabel={selectedIds.has(item.song.id) ? "Agregado" : "Agregar"}
                  onAdd={canEdit ? addSong : undefined}
                  onView={(song) => navigate?.(`/repertorio/${song.id}`)}
                  onExplain={searchTab === "history" ? undefined : onExplainScore}
                  onDismiss={(song) => setDismissedIds((current) => [...current, song.id])}
                  hideScore={searchTab === "history"}
                />
              ))}
            </div>
            {!recommendations.length ? (
              <div className="mt-4 rounded-2xl bg-ink/5 p-4 text-sm text-ink/60 dark:bg-white/7">
                No hay coincidencias con todos los criterios activos. Quita un tema, una frase o el filtro de categoría para ampliar la búsqueda.
              </div>
            ) : null}
          </SmartPanel>
        ) : null}
      </div>

      <div className="hidden xl:block">
      <SmartPanel className="h-fit xl:sticky xl:top-24">
        <div className="flex items-start justify-between gap-3">
          <div>
          <p className="text-xs font-black uppercase tracking-wide text-brass">Programación</p>
            <h3 className="mt-1 text-xl font-black text-ink">{selectedItems.length} canto(s)</h3>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white dark:bg-brass dark:text-ink">
            <ListMusic className="h-5 w-5" />
          </span>
        </div>
      <p className="mt-2 text-sm leading-6 text-ink/55">Agrega solo los cantos que elijas y arrástralos para ordenar el servicio.</p>

        <div className="mt-4">
          {selectedItems.length ? (
            <SortableList items={selectedItems} getId={selectedItemId} onReorder={setSelectedItems} className="grid gap-2">
              {(item, index, dragHandleProps) => (
                <article className="grid min-w-0 grid-cols-[40px_auto_minmax(0,1fr)_36px] items-center gap-2 rounded-xl border border-ink/10 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/7">
                  <SortableHandle {...dragHandleProps} />
                  <SongCoverImage song={item.song} wrapperClassName="h-10 w-10 rounded-xl" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-ink">{index + 1}. {item.song.title}</p>
                  <p className="truncate text-xs font-semibold text-ink/45">{item.song.category || "Sin categoría"} · {item.song.keyWithCapo || item.song.mainKey || "Sin tono"}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Quitar ${item.song.title}`}
                    onClick={() => removeSong(item.song.id)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-ink/40 transition hover:bg-red-500/10 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              )}
            </SortableList>
          ) : (
          <div className="rounded-2xl bg-ink/5 p-4 text-sm text-ink/55 dark:bg-white/7">Todavía no has agregado cantos.</div>
          )}
        </div>

        {status ? <p className="mt-4 rounded-xl border border-brass/20 bg-brass/10 p-3 text-sm font-bold text-ink">{status}</p> : null}
        <Button className="mt-4 w-full" onClick={saveSelection} disabled={!canEdit || !selectedItems.length} isLoading={isSaving}>
          {targetSchedule ? <Check className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
        {targetSchedule ? "Guardar programación" : "Crear programación"}
        </Button>
      </SmartPanel>
      </div>
    </section>
  );
}
