import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarCheck2, GitCompareArrows, Lightbulb, ListChecks, RefreshCw, Search, Shuffle, Sparkles, Wand2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { SortableList, SortableHandle } from "../components/ui/SortableList";
import { SmartGradientBackground, SmartPanel } from "../components/smart/SmartPanel";
import { RecommendationCard } from "../components/smart/RecommendationCard";
import { ServiceReviewPanel } from "../components/smart/ServiceReviewPanel";
import { ServiceFollowUpPanel } from "../components/smart/ServiceFollowUpPanel";
import { InsightCard } from "../components/smart/InsightCard";
import { ScoreBadge } from "../components/smart/ScoreBadge";
import { ReasonChips } from "../components/smart/ReasonChips";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getCurrentOrNextSchedule, getScheduleStartDate } from "../services/dateUtils";
import {
  buildUsageIndex,
  clampScore,
  createSuggestedServiceBlock,
  getPreparationGaps,
  getReplacementCandidates,
  getRepertoireInsights,
  getServiceSlots,
  getSlotAlternatives,
  getSmartServiceDefaultCount,
  getSongRecommendations,
  inferThemesFromPdfMatches,
  inferSmartServiceType,
  parseThemeInput,
  reviewServiceSchedule,
  scoreSong,
  searchSongsByIntent,
  smartServiceTypes,
  toSongEntry
} from "../services/smartRecommendations";
import { getSongPdfUrl, normalizeSearchText } from "../services/songUtils";

const tabItems = [
  { id: "programar", label: "Programación Inteligente", icon: Wand2, primary: true },
  { id: "revisar", label: "Revisar", icon: CalendarCheck2 },
  { id: "sustituir", label: "Sustituir", icon: GitCompareArrows },
  { id: "balance", label: "Balance", icon: Lightbulb },
  { id: "buscar", label: "Buscar", icon: Search }
];

const defaultOptions = {
  serviceType: "",
  theme: "",
  category: "",
  count: 4,
  includeHymns: true,
  avoidRecent: true,
  onlyKeynoteReady: false,
  preferredKey: "",
  includePdfText: false,
  pdfSearchQuery: "",
  recommendationMode: "theme",
  seed: 0
};

const worshipLeaders = ["", "Ps. José Campos", "Ps. Eduardo", "Adrián", "Esaú", "Otro"];

const serviceMeta = {
  "Domingo AM": { serviceType: "domingo-manana", serviceLabel: "Domingo AM", time: "11:00" },
  "Domingo PM": { serviceType: "domingo-tarde", serviceLabel: "Domingo PM", time: "17:00" },
  "Miércoles de oración": { serviceType: "miercoles-oracion", serviceLabel: "Miércoles de oración", time: "19:00" },
  "Servicio especial": { serviceType: "especial", serviceLabel: "Servicio especial", time: "" }
};

const normalServiceTypes = ["Domingo AM", "Domingo PM", "Miércoles de oración"];

function isManualCountService(serviceType) {
  return !normalServiceTypes.includes(serviceType);
}

const shortDate = (schedule = {}) => schedule.date
  ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(`${schedule.date}T00:00:00`))
  : "Sin fecha";

const scheduleLabel = (schedule = {}) => `${schedule.serviceLabel || schedule.type || "Servicio"} · ${shortDate(schedule)} · ${schedule.time || "Sin hora"}`;
const normalizeTheme = (theme = "") => normalizeSearchText(theme);
const gapFilterMap = {
  youtube: "missing-youtube",
  spotify: "missing-spotify",
  drive: "missing-drive-pdf",
  localPdf: "missing-local-pdf",
  keynote: "missing-keynote",
  key: "missing-key",
  theme: "missing-theme",
  ocr: "ocr-pending"
};

function SmartScheduleCalendar({ schedules = [], selectedDate = "", selectedId = "", onSelectDate, onSelectSchedule }) {
  const [cursor, setCursor] = useState(() => new Date(`${selectedDate || new Date().toISOString().slice(0, 10)}T00:00:00`));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const byDate = schedules.reduce((acc, schedule) => {
    if (!schedule.date) return acc;
    acc[schedule.date] = acc[schedule.date] || [];
    acc[schedule.date].push(schedule);
    return acc;
  }, {});
  const selectedDaySchedules = [...(byDate[selectedDate] || [])].sort((a, b) => `${a.time || ""}`.localeCompare(`${b.time || ""}`));

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/8">
      <div className="flex items-center justify-between gap-2">
        <Button variant="subtle" className="h-9 px-3 text-xs" onClick={() => setCursor(new Date(year, month - 1, 1))}>Anterior</Button>
        <p className="text-sm font-black text-ink">{new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(cursor)}</p>
        <Button variant="subtle" className="h-9 px-3 text-xs" onClick={() => setCursor(new Date(year, month + 1, 1))}>Siguiente</Button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-ink/40">
        {["D", "L", "M", "M", "J", "V", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateString = day.toISOString().slice(0, 10);
          const count = byDate[dateString]?.length || 0;
          const isSelected = selectedDate === dateString;
          const inMonth = day.getMonth() === month;
          return (
            <button
              key={dateString}
              type="button"
              onClick={() => onSelectDate(dateString)}
              className={`min-h-10 rounded-xl border p-1 text-xs font-bold transition ${isSelected ? "border-brass bg-brass/15 text-brass" : "border-transparent bg-ink/5 text-ink/65 hover:border-brass/35"} ${inMonth ? "" : "opacity-35"}`}
            >
              <span>{day.getDate()}</span>
              {count ? <span className="mt-0.5 block text-[10px] text-brass">{count}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-xs font-black uppercase tracking-wide text-ink/45">{selectedDate ? formatDate(selectedDate) : "Selecciona una fecha"}</p>
        {selectedDaySchedules.length ? selectedDaySchedules.map((schedule) => (
          <button
            key={schedule.id}
            type="button"
            onClick={() => onSelectSchedule(schedule)}
            className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === schedule.id ? "border-brass bg-brass/12" : "border-ink/10 bg-white/70 hover:border-brass/40 dark:border-white/10 dark:bg-white/7"}`}
          >
            <p className="font-bold text-ink">{schedule.serviceLabel || schedule.type || "Servicio"}</p>
            <p className="mt-1 text-xs text-ink/55">{schedule.time || "Sin hora"} · {schedule.leader || "Sin líder"} · {(schedule.songs || []).length} cantos</p>
          </button>
        )) : (
          <p className="rounded-2xl bg-ink/5 p-3 text-sm text-ink/55">No hay programaciones en esta fecha.</p>
        )}
      </div>
    </div>
  );
}

function nextBlockState(block, overrides) {
  if (!Object.keys(overrides).length) return block;
  const items = block.items.map((item) => overrides[item.slot.id] || item);
  return {
    ...block,
    items,
    score: items.length ? clampScore(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0
  };
}

const blockItemId = (item) => `${item.slot?.id || "slot"}-${item.song?.id || item.songId || item.role}`;

function applyManualBlockOrder(block, orderIds, serviceType, options, usageIndex, selectedSchedule) {
  if (!block?.items?.length) return block;
  const byId = new Map(block.items.map((item) => [blockItemId(item), item]));
  const ordered = orderIds.length
    ? [...orderIds.map((id) => byId.get(id)).filter(Boolean), ...block.items.filter((item) => !orderIds.includes(blockItemId(item)))]
    : block.items;
  const normalService = serviceType !== "Servicio especial";
  const slots = normalService ? getServiceSlots(serviceType, ordered.length) : block.slots;
  const scheduledIds = new Set((selectedSchedule?.songs || []).map((entry) => entry.songId).filter(Boolean));
  const items = ordered.map((item, index) => {
    const slot = normalService ? (slots[index] || item.slot) : item.slot;
    const scored = scoreSong(item.song, { ...options, serviceType, slot }, { usageIndex, scheduledIds });
    return { ...item, ...scored, role: slot.role, slot, energy: slot.intent };
  });
  return {
    ...block,
    slots,
    items,
    score: items.length ? clampScore(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0
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
  const { songs, schedules, themes, saveSchedule, replaceScheduleSong, indexLocalPdfTexts, saveServiceFollowUp, closeScheduleService } = useMusicData();
  const nextSchedule = getCurrentOrNextSchedule(schedules) || schedules[0] || null;
  const [activeTab, setActiveTab] = useState("programar");
  const [planningMode, setPlanningMode] = useState("create");
  const [draftDate, setDraftDate] = useState("");
  const [leaderChoice, setLeaderChoice] = useState("");
  const [manualLeader, setManualLeader] = useState("");
  const [blockGenerated, setBlockGenerated] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [existingDate, setExistingDate] = useState(nextSchedule?.date || "");
  const [replacementSongId, setReplacementSongId] = useState("");
  const [intentQuery, setIntentQuery] = useState("");
  const [dismissed, setDismissed] = useState([]);
  const [status, setStatus] = useState("");
  const [planningError, setPlanningError] = useState("");
  const [isIndexingTexts, setIsIndexingTexts] = useState(false);
  const [indexProgress, setIndexProgress] = useState(null);
  const [indexResult, setIndexResult] = useState(null);
  const [blockOverrides, setBlockOverrides] = useState({});
  const [blockOrder, setBlockOrder] = useState([]);
  const [alternativeSlot, setAlternativeSlot] = useState(null);
  const [compareItem, setCompareItem] = useState(null);
  const [compareSongId, setCompareSongId] = useState("");
  const [applyBlockModalOpen, setApplyBlockModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [scoreHelpItem, setScoreHelpItem] = useState(null);
  const [showAllBalance, setShowAllBalance] = useState(false);

  const schedulesForExistingDate = useMemo(
    () => schedules.filter((schedule) => !schedule.deleted && schedule.date === existingDate).sort((a, b) => `${a.time || ""}`.localeCompare(`${b.time || ""}`)),
    [existingDate, schedules]
  );
  const existingSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId)
    || schedulesForExistingDate[0]
    || nextSchedule;
  const selectedSchedule = planningMode === "existing" ? existingSchedule : null;
  const selectedServiceType = options.serviceType || (planningMode === "existing" && existingSchedule ? inferSmartServiceType(existingSchedule) : "");
  const effectiveCount = selectedServiceType ? (isManualCountService(selectedServiceType) ? Number(options.count || 4) : getSmartServiceDefaultCount(selectedServiceType)) : 0;
  const planningReferenceSchedule = useMemo(() => planningMode === "existing"
    ? selectedSchedule
    : draftDate && selectedServiceType
      ? { date: draftDate, ...(serviceMeta[selectedServiceType] || serviceMeta["Servicio especial"]) }
      : null, [draftDate, planningMode, selectedSchedule, selectedServiceType]);
  const planningReferenceDate = useMemo(
    () => getScheduleStartDate(planningReferenceSchedule || {}) || new Date(),
    [planningReferenceSchedule]
  );
  const selectedLeader = leaderChoice === "Otro" ? manualLeader : leaderChoice;
  const newScheduleConflict = schedules.find((schedule) =>
    !schedule.deleted
    && schedule.date === draftDate
    && inferSmartServiceType(schedule) === selectedServiceType
  );
  const usageIndex = useMemo(
    () => buildUsageIndex(schedules, planningReferenceDate, {
      currentSchedule: selectedSchedule,
      excludeScheduleId: selectedSchedule?.id,
      beforeDateTime: planningReferenceSchedule ? planningReferenceDate.toISOString() : ""
    }),
    [planningReferenceDate, planningReferenceSchedule, schedules, selectedSchedule]
  );
  const themeOptions = useMemo(() => {
    const values = new Set();
    (themes || []).forEach((theme) => values.add(theme.name || theme.label || theme));
    songs.forEach((song) => {
      if (song.mainTheme) values.add(song.mainTheme);
      (song.otherThemes || []).forEach((theme) => values.add(theme));
    });
    return [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), "es"));
  }, [songs, themes]);
  const selectedThemes = parseThemeInput(options.theme);
  const primaryTheme = selectedThemes[0] || "";
  const additionalThemes = selectedThemes.slice(1);
  const recommendationMode = options.recommendationMode || "theme";
  const usesThemeCriteria = recommendationMode !== "pdf";
  const usesPdfCriteria = recommendationMode !== "theme";
  const pdfDetectedThemes = useMemo(
    () => (!usesThemeCriteria && usesPdfCriteria && options.pdfSearchQuery
      ? inferThemesFromPdfMatches(songs, options.pdfSearchQuery)
      : []),
    [options.pdfSearchQuery, songs, usesPdfCriteria, usesThemeCriteria]
  );
  const effectiveSmartOptions = useMemo(() => ({
    ...options,
    theme: usesThemeCriteria ? options.theme : pdfDetectedThemes.join(", "),
    includePdfText: usesPdfCriteria,
    allowThemeFallback: usesThemeCriteria
  }), [options, pdfDetectedThemes, usesPdfCriteria, usesThemeCriteria]);
  const songsWithIndexedText = useMemo(() => songs.filter((song) => song.pdfSearchText || song.pdfOcrText || song.pdfText || song.lyricsText).length, [songs]);
  const recommendations = useMemo(
    () => getSongRecommendations(songs, schedules, { ...effectiveSmartOptions, serviceType: selectedServiceType, currentSchedule: selectedSchedule, limit: 20, usageIndex })
      .filter((item) => !dismissed.includes(item.song.id)),
    [dismissed, effectiveSmartOptions, schedules, selectedSchedule, selectedServiceType, songs, usageIndex]
  );
  const rawBlock = useMemo(
    () => createSuggestedServiceBlock(songs, schedules, { ...effectiveSmartOptions, count: effectiveCount, serviceType: selectedServiceType, currentSchedule: selectedSchedule, referenceDate: planningReferenceDate, usageIndex }),
    [effectiveCount, effectiveSmartOptions, planningReferenceDate, schedules, selectedSchedule, selectedServiceType, songs, usageIndex]
  );
  const suggestedBlock = useMemo(
    () => applyManualBlockOrder(nextBlockState(rawBlock, blockOverrides), blockOrder, selectedServiceType, effectiveSmartOptions, usageIndex, selectedSchedule),
    [blockOrder, blockOverrides, effectiveSmartOptions, rawBlock, selectedSchedule, selectedServiceType, usageIndex]
  );
  const review = useMemo(
    () => selectedSchedule ? reviewServiceSchedule(selectedSchedule, songs, schedules) : { score: 0, status: "Sin programación", alerts: [], groups: [] },
    [schedules, selectedSchedule, songs]
  );
  const currentReplacementEntry = selectedSchedule?.songs?.find((entry) => entry.songId === replacementSongId) || selectedSchedule?.songs?.[0] || null;
  const currentReplacementSong = songs.find((song) => song.id === currentReplacementEntry?.songId) || null;
  const replacementCandidates = useMemo(
    () => currentReplacementSong ? getReplacementCandidates(currentReplacementSong, songs, schedules, selectedSchedule).slice(0, 8) : [],
    [currentReplacementSong, schedules, selectedSchedule, songs]
  );
  const insights = useMemo(() => getRepertoireInsightsSafe(songs, schedules), [schedules, songs]);
  const visibleInsights = showAllBalance ? insights.slice(0, 8) : insights.slice(0, 4);
  const gaps = useMemo(() => getPreparationGaps(songs).slice(0, 6), [songs]);
  const intentSearch = useMemo(() => searchSongsByIntent(intentQuery, songs, usageIndex), [intentQuery, songs, usageIndex]);
  const alternativeCandidates = useMemo(() => {
    if (!alternativeSlot) return [];
    const selectedIds = new Set(suggestedBlock.items.map((item) => item.song.id));
    selectedIds.delete(suggestedBlock.items.find((item) => item.slot.id === alternativeSlot.id)?.song.id);
    return getSlotAlternatives(songs, schedules, { ...effectiveSmartOptions, serviceType: selectedServiceType, currentSchedule: selectedSchedule, usageIndex }, alternativeSlot, selectedIds).slice(0, 8);
  }, [alternativeSlot, effectiveSmartOptions, schedules, selectedSchedule, selectedServiceType, songs, suggestedBlock.items, usageIndex]);
  const compareTargetSong = songs.find((song) => song.id === compareSongId) || recommendations.find((item) => item.song.id !== compareItem?.song?.id)?.song || null;
  const compareTargetItem = compareTargetSong ? scoreSong(compareTargetSong, { ...effectiveSmartOptions, serviceType: selectedServiceType }, { usageIndex }) : null;

  const updateOption = (key, value) => {
    setBlockOverrides({});
    setBlockOrder([]);
    if (key !== "seed") setBlockGenerated(false);
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const updateRecommendationMode = (recommendationMode) => {
    setBlockOverrides({});
    setBlockOrder([]);
    setBlockGenerated(false);
    setPlanningError("");
    setOptions((current) => ({
      ...current,
      recommendationMode,
      includePdfText: recommendationMode !== "theme"
    }));
  };

  const updateThemes = (nextThemes) => {
    updateOption("theme", nextThemes.map((theme) => String(theme || "").trim()).filter(Boolean).join(", "));
  };

  const updatePrimaryTheme = (theme) => {
    updateThemes([theme, ...additionalThemes]);
  };

  const updateAdditionalThemes = (value) => {
    updateThemes([primaryTheme, ...parseThemeInput(value)]);
  };

  const toggleAdditionalTheme = (theme) => {
    if (!primaryTheme) {
      updateThemes([theme]);
      return;
    }
    const exists = additionalThemes.some((item) => normalizeTheme(item) === normalizeTheme(theme));
    updateThemes([primaryTheme, ...(exists ? additionalThemes.filter((item) => normalizeTheme(item) !== normalizeTheme(theme)) : [...additionalThemes, theme])]);
  };

  const updateServiceType = (serviceType) => {
    setBlockOverrides({});
    setBlockOrder([]);
    setBlockGenerated(false);
    setOptions((current) => ({
      ...current,
      serviceType,
      count: isManualCountService(serviceType) ? current.count || 4 : getSmartServiceDefaultCount(serviceType)
    }));
  };

  useEffect(() => {
    if (planningMode !== "existing") return;
    if (!existingDate && nextSchedule?.date) setExistingDate(nextSchedule.date);
  }, [existingDate, nextSchedule?.date, planningMode]);

  useEffect(() => {
    if (planningMode !== "existing") return;
    if (!selectedScheduleId && schedulesForExistingDate[0]?.id) {
      setSelectedScheduleId(schedulesForExistingDate[0].id);
    }
  }, [planningMode, schedulesForExistingDate, selectedScheduleId]);

  const generateForNextService = () => {
    if (!nextSchedule) {
      setPlanningMode("create");
      setDraftDate("");
      setBlockGenerated(false);
      setStatus("Elige fecha, servicio y criterios para crear una programación nueva.");
      return;
    }
    const serviceType = inferSmartServiceType(nextSchedule);
    setPlanningMode("existing");
    setSelectedScheduleId(nextSchedule.id);
    setOptions((current) => ({
      ...current,
      serviceType,
      count: getSmartServiceDefaultCount(serviceType),
      seed: current.seed + 1
    }));
    setBlockOverrides({});
    setBlockOrder([]);
    setBlockGenerated(true);
    setActiveTab("programar");
    setStatus(`Bloque generado para ${scheduleLabel(nextSchedule)}.`);
  };

  const createBlock = () => {
    setPlanningError("");
    if (planningMode === "create" && !draftDate) {
      setPlanningError("Selecciona una fecha para crear el bloque.");
      return;
    }
    if (!selectedServiceType) {
      setPlanningError("Selecciona el tipo de servicio.");
      return;
    }
    if (usesThemeCriteria && !primaryTheme.trim()) {
      setPlanningError("Escribe o selecciona un tema principal.");
      return;
    }
    if (usesPdfCriteria && !(options.pdfSearchQuery || "").trim()) {
      setPlanningError("Escribe una o varias palabras o frases para buscar en letras/PDF.");
      return;
    }
    setOptions((current) => ({ ...current, seed: current.seed + 1 }));
    setBlockOverrides({});
    setBlockOrder([]);
    setBlockGenerated(true);
    setStatus(`Bloque sugerido para ${selectedServiceType} con ${effectiveCount} canto(s).`);
  };

  const indexPdfTextsFromSmartCenter = async () => {
    setIsIndexingTexts(true);
    setIndexResult(null);
    try {
      const result = await indexLocalPdfTexts(setIndexProgress, { enableOcr: true, force: false });
      setIndexResult(result);
      setStatus(`Indexación lista: ${result.indexed} indexados, ${result.reused || 0} reutilizados.`);
    } finally {
      setIsIndexingTexts(false);
    }
  };

  const regenerateBlock = () => {
    if (!blockGenerated) {
      createBlock();
      return;
    }
    setOptions((current) => ({ ...current, seed: current.seed + 1 }));
    setBlockOverrides({});
    setBlockOrder([]);
    setStatus("Generando una alternativa con los mismos criterios.");
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

  const buildNewSchedulePayload = () => {
    const meta = serviceMeta[selectedServiceType] || serviceMeta["Servicio especial"];
    return {
      date: draftDate,
      serviceType: meta.serviceType,
      serviceLabel: meta.serviceLabel,
      type: meta.serviceLabel,
      time: meta.time,
      leader: selectedLeader,
      songs: suggestedBlock.items.map((item) => toSongEntry(item.song, item.role)),
      generalNotes: "",
      isSpecialService: isManualCountService(selectedServiceType),
      specialProgram: [],
      status: "confirmed"
    };
  };

  const createScheduleFromBlock = async ({ force = false } = {}) => {
    if (!draftDate) {
      setStatus("Elige una fecha para crear la programación.");
      return;
    }
    if (!suggestedBlock.items.length) {
      setStatus("Primero crea un bloque sugerido.");
      return;
    }
    if (newScheduleConflict && !force) {
      setConflictModalOpen(true);
      return;
    }
    await saveSchedule(buildNewSchedulePayload());
    setConflictModalOpen(false);
    setStatus("Programación creada con el bloque sugerido.");
    navigate("/programacion");
  };

  const applyBlock = async (mode) => {
    if (planningMode === "create") {
      await createScheduleFromBlock();
      setApplyBlockModalOpen(false);
      return;
    }
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
              <Sparkles className="h-4 w-4" />
              Análisis musical del servicio
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
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45">{planningMode === "create" ? "Servicio seleccionado" : "Servicio sugerido"}</p>
                <p className="mt-1 font-black text-ink">{planningMode === "existing" && nextSchedule ? inferSmartServiceType(nextSchedule) : selectedServiceType || "Sin seleccionar"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Cantos sugeridos</p>
                <p className="mt-1 font-black text-ink">{effectiveCount || "--"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Preparación</p>
                <p className="mt-1 font-black text-ink">{review.score}%</p>
              </div>
            </div>
          </SmartPanel>
          <SmartPanel>
            <p className="text-xs font-bold uppercase tracking-wide text-brass">{usesThemeCriteria ? "Tema actual" : "Búsqueda en letra/PDF"}</p>
              <p className="mt-1 line-clamp-2 text-lg font-black text-ink">{usesThemeCriteria ? (selectedThemes.join(" + ") || "Sin tema elegido") : (options.pdfSearchQuery || "Sin frases elegidas")}</p>
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
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${active ? "bg-ink text-white shadow-soft dark:bg-brass dark:text-ink" : tab.primary ? "border border-brass/40 bg-brass/12 text-ink shadow-soft hover:bg-brass/18 dark:bg-brass/15" : "bg-white/70 text-ink ring-1 ring-ink/10 hover:bg-brass/10 dark:bg-white/8 dark:ring-white/10"}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.primary ? <span className="rounded-full bg-brass px-2 py-0.5 text-[10px] font-black text-ink">Especial</span> : null}
              </button>
            );
          })}
        </div>

        {status ? <p className="mt-5 rounded-2xl border border-brass/25 bg-brass/12 p-3 text-sm font-semibold text-ink">{status}</p> : null}

        <AnimatePresence mode="wait">
        {activeTab === "programar" ? (
          <motion.section key="programar" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SmartPanel>
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-brass" />
                <h2 className="text-xl font-black text-ink">Configurar servicio</h2>
              </div>
              <div className="mt-5 grid gap-4">
                <Field label="Modo">
                  <Select value={planningMode} onChange={(event) => { setPlanningMode(event.target.value); setBlockGenerated(false); setBlockOverrides({}); setBlockOrder([]); }}>
                    <option value="create">Crear nueva programación</option>
                    <option value="existing">Usar programación existente</option>
                  </Select>
                </Field>
                {planningMode === "create" ? (
                  <>
                    <Field label="Fecha">
                      <Input type="date" value={draftDate} onChange={(event) => { setDraftDate(event.target.value); setBlockGenerated(false); }} />
                    </Field>
                    <Field label="Líder de adoración">
                      <Select value={leaderChoice} onChange={(event) => setLeaderChoice(event.target.value)}>
                        {worshipLeaders.map((leader) => <option key={leader || "empty"} value={leader}>{leader || "Sin líder definido"}</option>)}
                      </Select>
                    </Field>
                    {leaderChoice === "Otro" ? (
                      <Field label="Nombre del líder">
                        <Input value={manualLeader} onChange={(event) => setManualLeader(event.target.value)} placeholder="Nombre" />
                      </Field>
                    ) : null}
                  </>
                ) : (
                  <div className="grid gap-3">
                    <Field label="Fecha de la programación">
                      <Input type="date" value={existingDate} onChange={(event) => { setExistingDate(event.target.value); setSelectedScheduleId(""); setBlockGenerated(false); }} />
                    </Field>
                    <SmartScheduleCalendar
                      schedules={schedules.filter((schedule) => !schedule.deleted)}
                      selectedDate={existingDate}
                      selectedId={existingSchedule?.id || ""}
                      onSelectDate={(date) => { setExistingDate(date); setSelectedScheduleId(""); setBlockGenerated(false); }}
                      onSelectSchedule={(schedule) => {
                        setSelectedScheduleId(schedule.id);
                        setExistingDate(schedule.date || existingDate);
                        setBlockGenerated(false);
                        const serviceType = inferSmartServiceType(schedule);
                        setOptions((current) => ({
                          ...current,
                          serviceType,
                          count: isManualCountService(serviceType) ? current.count || 4 : getSmartServiceDefaultCount(serviceType)
                        }));
                      }}
                    />
                  </div>
                )}
                <Field label="Tipo de servicio">
                  <Select value={selectedServiceType} onChange={(event) => updateServiceType(event.target.value)}>
                    <option value="">Seleccionar servicio</option>
                    {smartServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </Select>
                </Field>
                <Field label="Crear recomendaciones por">
                  <Select value={recommendationMode} onChange={(event) => updateRecommendationMode(event.target.value)}>
                    <option value="theme">Tema</option>
                    <option value="pdf">Letra/PDF</option>
                    <option value="both">Tema y letra/PDF</option>
                  </Select>
                </Field>
                {usesThemeCriteria ? (
                  <>
                <Field label="Tema principal">
                  <Input value={primaryTheme} onChange={(event) => updatePrimaryTheme(event.target.value)} placeholder="cruz" />
                </Field>
                <Field label="Temas adicionales">
                  <Input value={additionalThemes.join(", ")} onChange={(event) => updateAdditionalThemes(event.target.value)} placeholder="gracia, redención, entrega" />
                </Field>
                {themeOptions.length ? (
                  <div className="grid gap-3 rounded-2xl border border-ink/10 bg-white/55 p-3 dark:border-white/10 dark:bg-white/8">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-ink/45">Seleccionar tema principal</p>
                      <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
                        {themeOptions.map((theme) => {
                          const active = normalizeTheme(primaryTheme) === normalizeTheme(theme);
                          return (
                            <button key={`primary-${theme}`} type="button" onClick={() => updatePrimaryTheme(theme)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${active ? "bg-brass text-ink" : "bg-ink/5 text-ink/65 hover:bg-brass/15 hover:text-brass"}`}>
                              {theme}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-ink/45">Seleccionar temas adicionales</p>
                      <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                        {themeOptions.map((theme) => {
                          const active = additionalThemes.some((item) => normalizeTheme(item) === normalizeTheme(theme));
                          return (
                            <button key={`additional-${theme}`} type="button" onClick={() => toggleAdditionalTheme(theme)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${active ? "bg-brass text-ink" : "bg-ink/5 text-ink/65 hover:bg-brass/15 hover:text-brass"}`}>
                              {theme}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
                {usesThemeCriteria && usesPdfCriteria ? <div className="flex items-start gap-2 rounded-2xl bg-white/55 p-3 text-sm font-semibold text-ink dark:bg-white/8">
                  <span>
                    Buscar también en letras/PDF
                    {options.includePdfText && songsWithIndexedText < songs.length ? <span className="block text-xs font-medium text-ink/55">Algunos cantos no tienen texto indexado; la búsqueda puede ser incompleta.</span> : null}
                  </span>
                </div> : null}
                {options.includePdfText ? (
                  <Field label="Palabras o frases en letras/PDF">
                    <Textarea
                      value={options.pdfSearchQuery || ""}
                      onChange={(event) => updateOption("pdfSearchQuery", event.target.value)}
                      placeholder={"Ej. gracia sublime\ncruz\nredención"}
                    />
                    <span className="mt-2 block text-xs font-semibold text-ink/45">Separa varias palabras o frases con comas o líneas nuevas. Las coincidencias se combinan.</span>
                  </Field>
                ) : null}
                  </>
                ) : null}
                {!usesThemeCriteria && usesPdfCriteria ? (
                  <Field label="Palabras o frases en letras/PDF">
                    <Textarea
                      value={options.pdfSearchQuery || ""}
                      onChange={(event) => updateOption("pdfSearchQuery", event.target.value)}
                      placeholder={"Ej. gracia sublime\ncruz\nredención"}
                    />
                    <span className="mt-2 block text-xs font-semibold text-ink/45">No necesitas elegir un tema. El sistema combinará coincidencias y detectará temas comunes entre los cantos.</span>
                  </Field>
                ) : null}
                {usesPdfCriteria ? (
                  <div className="rounded-2xl border border-brass/20 bg-brass/10 p-3 text-sm text-ink">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold">
                        Letras/PDF indexados: {songsWithIndexedText} de {songs.length}
                        <span className="block text-xs font-medium text-ink/55">El ?ndice se guarda en Firestore por canto y se reutiliza si el PDF no cambi?.</span>
                      </p>
                      {songsWithIndexedText < songs.length ? (
                        <Button variant="secondary" className="h-9 px-3 text-xs" onClick={indexPdfTextsFromSmartCenter} disabled={isIndexingTexts}>
                          {isIndexingTexts ? "Indexando..." : "Indexar ahora"}
                        </Button>
                      ) : null}
                    </div>
                    {indexProgress ? (
                      <p className="mt-2 text-xs font-semibold text-ink/55">
                        {indexProgress.current || 0}/{indexProgress.total || 0} ? Indexados {indexProgress.indexed || 0} ? Reutilizados {indexProgress.reused || 0} ? OCR {(indexProgress.ocrItems || []).length}
                      </p>
                    ) : null}
                    {indexResult ? (
                      <p className="mt-2 text-xs font-semibold text-ink/55">
                        Listo: {indexResult.indexed} indexados, {indexResult.reused || 0} reutilizados, {indexResult.failed || 0} errores.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {isManualCountService(selectedServiceType) ? (
                  <Field label="Número de cantos">
                    <Input type="number" min="1" max="8" value={options.count} onChange={(event) => updateOption("count", Number(event.target.value || 4))} />
                  </Field>
                ) : (
                  <p className="rounded-2xl bg-brass/12 p-3 text-sm font-semibold text-ink">
                    {selectedServiceType} usa {effectiveCount} cantos.
                  </p>
                )}
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
                  {planningError ? (
                    <p className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800 dark:border-red-400/35 dark:bg-red-500/12 dark:text-red-100">
                      {planningError}
                    </p>
                  ) : null}
                  {!blockGenerated ? (
                    <Button onClick={createBlock}><Wand2 className="h-4 w-4" />Crear bloque sugerido</Button>
                  ) : (
                    <>
                      <Button onClick={regenerateBlock}><RefreshCw className="h-4 w-4" />Regenerar alternativa</Button>
                      <p className="text-xs leading-5 text-ink/55">Regenerar crea una alternativa con los mismos criterios.</p>
                    </>
                  )}
                </div>
              </div>
            </SmartPanel>

            <div className="grid gap-4">
              <SmartPanel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {blockGenerated ? <p className="text-xs font-bold uppercase tracking-wide text-brass">
                      {selectedServiceType || "Sin servicio"} · {usesThemeCriteria ? `Tema: ${primaryTheme || "sin tema"}` : `Letra/PDF: ${options.pdfSearchQuery || "sin búsqueda"}`}
                    </p> : null}
                    <h3 className="text-xl font-black text-ink">Bloque sugerido</h3>
                  </div>
                  <ScoreBadge score={blockGenerated ? suggestedBlock.score : 0} label="Bloque" />
                </div>
                <div className="mt-4 grid gap-3">
                  {blockGenerated && suggestedBlock.items.length ? (
                    <SortableList items={suggestedBlock.items} getId={blockItemId} onReorder={(items) => setBlockOrder(items.map(blockItemId))} className="grid gap-3">
                      {(item, index, dragHandleProps) => (
                    <article className="rounded-2xl border border-white/60 bg-white/74 p-3 shadow-soft dark:border-white/10 dark:bg-white/8 sm:p-4">
                      <div className="grid gap-3 lg:grid-cols-[42px_minmax(0,1fr)_190px] lg:items-start">
                        <div className="flex items-start">
                          <SortableHandle {...dragHandleProps} />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <p className="text-xs font-bold uppercase tracking-wide text-brass">{index + 1}. {item.role}</p>
                          <h4 className="mt-1 text-lg font-black text-ink">{item.song.title}</h4>
                          <p className="mt-1 line-clamp-2 text-sm text-ink/60">{item.slot.description}</p>
                          <div className="mt-3"><ReasonChips reasons={item.reasons} warnings={item.warnings} /></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                          <ScoreBadge score={item.score} compact />
                          <Button className="h-9 px-3 text-xs" variant="secondary" onClick={() => setAlternativeSlot(item.slot)}><Shuffle className="h-4 w-4" />Cambiar</Button>
                          <Button className="h-9 px-3 text-xs" variant="subtle" onClick={() => openCompare(item)}>Comparar</Button>
                          <Button className="h-9 px-3 text-xs" variant="subtle" onClick={() => setScoreHelpItem(item)}>Ver score</Button>
                        </div>
                      </div>
                    </article>
                      )}
                    </SortableList>
                  ) : (
                    <EmptySmartState title={blockGenerated ? "No hay suficientes datos" : "Listo para generar"} message={blockGenerated ? "No se pudo formar un bloque. Revisa los datos y criterios elegidos." : "Elige fecha, servicio y criterios. Luego crea el bloque sugerido."} action={blockGenerated ? "Ir a repertorio" : ""} onAction={() => navigate("/repertorio")} />
                  )}
                </div>
                {blockGenerated ? <div className="mt-4 flex flex-wrap gap-2">
                  {suggestedBlock.reasons.map((reason) => <span key={reason} className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{reason}</span>)}
                </div> : null}
                <Button className="mt-4" disabled={!blockGenerated || !suggestedBlock.items.length || !canEdit} onClick={() => setApplyBlockModalOpen(true)}>
                  <ListChecks className="h-4 w-4" />
                  {planningMode === "create" ? "Crear programación con este bloque" : "Agregar bloque a programación"}
                </Button>
              </SmartPanel>

              <SmartPanel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brass">Recomendaciones</p>
                    <h3 className="text-xl font-black text-ink">Cantos candidatos</h3>
                  </div>
                  <p className="text-sm font-semibold text-ink/55">Top {Math.min(6, recommendations.length)}</p>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {recommendations.slice(0, 6).map((item) => (
                  <RecommendationCard
                    key={item.song.id}
                    item={item}
                    onAdd={addSongToSchedule}
                    onView={(song) => navigate(`/repertorio/${song.id}`)}
                    onCompare={() => openCompare(item)}
                    onExplain={setScoreHelpItem}
                    onDismiss={(song) => setDismissed((current) => [...current, song.id])}
                  />
                ))}
                </div>
              </SmartPanel>
            </div>
          </motion.section>
        ) : null}

        {activeTab === "revisar" ? (
          <motion.section key="revisar" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-6 grid gap-4">
            <ServiceReviewPanel review={review} />
            {selectedSchedule ? (
              <ServiceFollowUpPanel schedule={selectedSchedule} canEdit={canEdit} onSave={saveServiceFollowUp} onCloseService={closeScheduleService} />
            ) : null}
          </motion.section>
        ) : null}

        {activeTab === "sustituir" ? (
          <motion.section key="sustituir" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
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
                  onExplain={setScoreHelpItem}
                />
              ))}
            </div>
          </motion.section>
        ) : null}

        {activeTab === "balance" ? (
          <motion.section key="balance" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SmartPanel>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-brass" />
                <h2 className="text-xl font-black text-ink">Balance del repertorio</h2>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {visibleInsights.map((insight) => (
                  <InsightCard key={insight.title} insight={insight} onAction={() => openRepertoireFilter(insight.filter || { q: insight.title })} />
                ))}
              </div>
              {insights.length > 4 ? (
                <Button variant="subtle" className="mt-4" onClick={() => setShowAllBalance((current) => !current)}>
                  {showAllBalance ? "Ver menos" : "Ver más"}
                </Button>
              ) : null}
            </SmartPanel>
            <SmartPanel>
              <h2 className="text-xl font-black text-ink">Qué falta preparar</h2>
              <div className="mt-3 grid gap-2">
                {gaps.map((gap) => (
                  <div key={gap.key} className="rounded-2xl border border-white/60 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/8">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink">{gap.label}</p>
                        <p className="text-xs text-ink/55">Prioridad {gap.priority}</p>
                      </div>
                      <p className="text-xl font-black text-brass">{gap.count}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                      <div className="h-full rounded-full bg-brass" style={{ width: `${Math.min(100, gap.percent)}%` }} />
                    </div>
                    <Button variant="subtle" className="mt-3 h-9 px-3 text-xs" onClick={() => openRepertoireFilter({ filter: gapFilterMap[gap.key] || gap.key })}>Aplicar filtro</Button>
                  </div>
                ))}
              </div>
            </SmartPanel>
          </motion.section>
        ) : null}

        {activeTab === "buscar" ? (
          <motion.section key="buscar" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-6">
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
          </motion.section>
        ) : null}
        </AnimatePresence>
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
              onExplain={setScoreHelpItem}
            />
          ))}
          {!alternativeCandidates.length ? <p className="text-sm text-ink/60">No hay alternativas disponibles para esta posición sin duplicar cantos.</p> : null}
        </div>
      </Modal>

      <Modal open={applyBlockModalOpen} title="¿Agregar este bloque a la programación?" onClose={() => setApplyBlockModalOpen(false)}>
        <div className="space-y-4">
          {planningMode === "create" ? (
            <>
              <p className="text-sm leading-6 text-ink/62">Se creará una programación nueva para <strong>{draftDate}</strong> · <strong>{selectedServiceType}</strong>.</p>
              <div className="grid gap-2">
                <Button onClick={() => createScheduleFromBlock()}>Crear programación con este bloque</Button>
                <Button variant="subtle" onClick={() => setApplyBlockModalOpen(false)}>Cancelar</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-ink/62">Destino: <strong>{selectedSchedule ? scheduleLabel(selectedSchedule) : "sin programación"}</strong></p>
              <div className="grid gap-2">
                <Button onClick={() => applyBlock("replace")}>Reemplazar cantos actuales</Button>
                <Button variant="secondary" onClick={() => applyBlock("append")}>Agregar al final</Button>
                <Button variant="subtle" onClick={() => setApplyBlockModalOpen(false)}>Cancelar</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={conflictModalOpen} title="Ya existe una programación para este servicio" onClose={() => setConflictModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-ink/62">
            Ya existe: <strong>{newScheduleConflict ? scheduleLabel(newScheduleConflict) : "programación existente"}</strong>.
          </p>
          <div className="grid gap-2">
            <Button onClick={() => { setConflictModalOpen(false); setPlanningMode("existing"); setSelectedScheduleId(newScheduleConflict?.id || ""); }}>Abrir existente</Button>
            <Button variant="secondary" onClick={async () => {
              if (!newScheduleConflict) return;
              await saveSchedule({ ...newScheduleConflict, songs: suggestedBlock.items.map((item) => toSongEntry(item.song, item.role)) });
              setConflictModalOpen(false);
              setApplyBlockModalOpen(false);
              navigate("/programacion");
            }}>Reemplazar cantos</Button>
            <Button variant="secondary" onClick={() => createScheduleFromBlock({ force: true })}>Crear de todos modos</Button>
            <Button variant="subtle" onClick={() => setConflictModalOpen(false)}>Cancelar</Button>
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

      <Modal open={Boolean(scoreHelpItem)} title="Ver score" onClose={() => setScoreHelpItem(null)} panelClassName="flex max-h-[92dvh] flex-col dark:border dark:border-white/12 dark:bg-[#181818]">
        {scoreHelpItem ? (
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pb-24 pr-1 md:pb-1">
            <div className="rounded-2xl bg-ink/5 p-4 dark:bg-white/8">
              <p className="text-2xl font-black text-ink">{scoreHelpItem.song.title} - {scoreHelpItem.scoreDetails?.finalScore ?? scoreHelpItem.score}%</p>
              <div className="mt-3 grid gap-2 text-sm font-semibold text-ink/62 sm:grid-cols-2">
                <span>{scoreHelpItem.usageSummary?.lastUse || scoreHelpItem.usageSummary?.recent || "Sin historial reciente"}</span>
                <span>{scoreHelpItem.usageSummary?.monthly || "Uso mensual: sin datos"}</span>
              </div>
              <p className="mt-2 text-xs font-bold text-ink/50">{scoreHelpItem.usageSummary?.rotationImpact || "Rotacion sin impacto negativo."}</p>
              <p className="mt-1 text-xs font-semibold text-ink/45">Rotacion: 0-14 dias penaliza fuerte, 15-30 dias penaliza moderado, 0-1 usos en 30 dias cuenta como poco usado, 3 o mas usos penaliza.</p>
              {scoreHelpItem.scoreDetails?.pdfMatches?.length ? (
                <div className="mt-2 grid gap-2">
                  {scoreHelpItem.scoreDetails.pdfMatches.map((match) => (
                    <p key={`${match.theme}-${match.snippet}`} className="rounded-xl bg-brass/12 px-3 py-2 text-xs font-bold text-brass">
                      {match.theme}: "{match.snippet}"
                    </p>
                  ))}
                </div>
              ) : scoreHelpItem.scoreDetails?.pdfMatch ? (
                <p className="mt-2 rounded-xl bg-brass/12 px-3 py-2 text-xs font-bold text-brass">Coincide en letra/PDF: "{scoreHelpItem.scoreDetails.pdfMatch.snippet}"</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-emerald-300/50 bg-emerald-50 p-3 dark:border-emerald-400/35 dark:bg-emerald-950/55">
              <p className="font-bold text-ink">A favor</p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-950 dark:text-emerald-100">
                {(scoreHelpItem.scoreDetails?.positives || [])
                  .filter((item) => !String(item.label || "").toLowerCase().includes("base"))
                  .map((item) => <li key={`${item.points}-${item.label}`}>+{item.points} {item.label}</li>)}
              </ul>
            </div>
            {(scoreHelpItem.scoreDetails?.penalties || []).length ? (
              <div className="rounded-2xl border border-orange-300/60 bg-orange-50 p-3 dark:border-orange-400/40 dark:bg-orange-950/65">
                <p className="font-bold text-ink">En contra</p>
                <ul className="mt-2 space-y-1 text-sm text-orange-950 dark:text-orange-100">
                  {scoreHelpItem.scoreDetails.penalties.map((item) => <li key={`${item.points}-${item.label}`}>{item.points} {item.label}</li>)}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/12 dark:text-emerald-100">
                Sin puntos en contra.
              </div>
            )}
            {scoreHelpItem.scoreDetails?.warnings?.length ? (
              <div className="rounded-2xl border border-ink/10 bg-ink/5 p-3 dark:border-white/12 dark:bg-white/7">
                <p className="font-bold text-ink">Notas</p>
                <ul className="mt-2 space-y-1 text-sm text-ink/65">
                  {scoreHelpItem.scoreDetails.warnings.map((warning) => <li key={warning}>- {warning}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </SmartGradientBackground>
  );
}

function getRepertoireInsightsSafe(songs, schedules) {
  const inferFilter = (insight = {}) => {
    const text = normalizeSearchText(`${insight.title || ""} ${insight.message || ""} ${insight.action || ""}`);
    if (text.includes("youtube")) return { filter: "missing-youtube" };
    if (text.includes("spotify")) return { filter: "missing-spotify" };
    if (text.includes("documentos") || text.includes("pdf")) return { filter: "missing-drive-pdf" };
    if (text.includes("himnos")) return { filter: "hymns-ready" };
    if (text.includes("olvidados")) return { filter: "unused-ready" };
    if (text.includes("repeticion") || text.includes("repetidos")) return { filter: "repeated" };
    if (text.includes("navidad")) return { q: "navidad" };
    return { q: insight.title };
  };
  return getRepertoireInsights(songs, schedules).map((insight) => ({
    ...insight,
    filter: insight.filter || inferFilter(insight)
  }));
}
