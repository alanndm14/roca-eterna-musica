import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarCheck2, FileSearch, GitCompareArrows, ListChecks, Music2, RefreshCw, Shuffle, Sparkles, Tags, Wand2, X } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { SortableList, SortableHandle } from "../components/ui/SortableList";
import { SmartGradientBackground, SmartPanel } from "../components/smart/SmartPanel";
import { RecommendationCard } from "../components/smart/RecommendationCard";
import { ServiceReviewPanel } from "../components/smart/ServiceReviewPanel";
import { ServiceFollowUpPanel } from "../components/smart/ServiceFollowUpPanel";
import { SongSuggestionAssistant } from "../components/smart/SongSuggestionAssistant";
import { ScoreBadge } from "../components/smart/ScoreBadge";
import { ReasonChips } from "../components/smart/ReasonChips";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getCurrentOrNextSchedule, getScheduleStartDate, isCountableSchedule } from "../services/dateUtils";
import {
  buildUsageIndex,
  clampScore,
  createSuggestedServiceBlock,
  getReplacementCandidates,
  getServiceSlots,
  getSlotAlternatives,
  getSmartServiceDefaultCount,
  getSongRecommendations,
  inferThemesFromPdfMatches,
  inferSmartServiceType,
  parseThemeInput,
  reviewServiceSchedule,
  scoreSong,
  smartServiceTypes,
  toSongEntry
} from "../services/smartRecommendations";
import { getSongPdfUrl, normalizeSearchText } from "../services/songUtils";

const tabItems = [
  { id: "programar", label: "Asistente de programación", icon: Wand2, primary: true },
  { id: "revisar", label: "Revisar", icon: CalendarCheck2 },
  { id: "sustituir", label: "Sustituir", icon: GitCompareArrows }
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
  ideaQuery: "",
  rotationPriority: "underused",
  preferUnderused: true,
  preferKeynoteReady: true,
  preferLocalPdfReady: true,
  allowPending: true,
  categoryChoice: "cualquiera",
  prioritizePlannedSongs: false,
  recommendationMode: "general",
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

function suggestServiceTypeFromDate(dateValue = "") {
  if (!dateValue) return "";
  const day = new Date(`${dateValue}T12:00:00`).getDay();
  if (day === 3) return "Miércoles de oración";
  if (day === 0) return "Domingo AM";
  return "Servicio especial";
}
const embeddedAssistantModes = [
  { id: "sustituir", label: "Sustituir canto", icon: GitCompareArrows }
];

function ChipInput({ values = [], onChange, placeholder = "Escribe y presiona Enter" }) {
  const [draft, setDraft] = useState("");
  const addDraft = () => {
    const next = parseThemeInput(draft);
    if (!next.length) return;
    const normalized = new Set(values.map(normalizeTheme));
    onChange([...values, ...next.filter((value) => !normalized.has(normalizeTheme(value)))]);
    setDraft("");
  };
  return (
    <div className="rounded-xl border border-ink/10 bg-white/70 p-2 dark:border-white/12 dark:bg-black/20">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brass/14 px-2.5 py-1 text-xs font-bold text-ink">
            <span className="truncate">{value}</span>
            <button type="button" aria-label={`Quitar ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <Input
        className="mt-2 border-0 bg-transparent px-1 shadow-none"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={addDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addDraft();
          }
        }}
      />
    </div>
  );
}

const shortDate = (schedule = {}) => schedule.date
  ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(`${schedule.date}T00:00:00`))
  : "Sin fecha";

const scheduleLabel = (schedule = {}) => `${schedule.serviceLabel || schedule.type || "Servicio"} · ${shortDate(schedule)} · ${schedule.time || "Sin hora"}`;
const normalizeTheme = (theme = "") => normalizeSearchText(theme);

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

export function SmartCenter({ scheduleId = "", embedded = false, initialDate = "" }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { profile, canEdit } = useAuth();
  const { songs, schedules, plannedNewSongs = [], themes, settings, saveSchedule, replaceScheduleSong, indexLocalPdfTexts, saveServiceFollowUp, closeScheduleService } = useMusicData();
  const nextSchedule = getCurrentOrNextSchedule(schedules) || schedules[0] || null;
  const initialSuggestedServiceType = scheduleId ? "" : suggestServiceTypeFromDate(initialDate);
  const [activeTab, setActiveTab] = useState("programar");
  const [planningMode, setPlanningMode] = useState(() => scheduleId ? "existing" : "create");
  const [draftDate, setDraftDate] = useState(initialDate);
  const [leaderChoice, setLeaderChoice] = useState("");
  const [manualLeader, setManualLeader] = useState("");
  const [blockGenerated, setBlockGenerated] = useState(false);
  const [options, setOptions] = useState(() => ({
    ...defaultOptions,
    serviceType: initialSuggestedServiceType,
    count: initialSuggestedServiceType ? getSmartServiceDefaultCount(initialSuggestedServiceType) : defaultOptions.count,
    includeHymns: initialSuggestedServiceType !== "Miércoles de oración",
    recommendationMode: embedded ? "general" : "general",
    includePdfText: false
  }));
  const [selectedScheduleId, setSelectedScheduleId] = useState(scheduleId);
  const [existingDate, setExistingDate] = useState(nextSchedule?.date || "");
  const [replacementSongId, setReplacementSongId] = useState("");
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
  const [baseSongQuery, setBaseSongQuery] = useState("");
  const [baseSongs, setBaseSongs] = useState([]);

  const schedulesForExistingDate = useMemo(
    () => schedules.filter((schedule) => !schedule.deleted && isCountableSchedule(schedule) && schedule.date === existingDate).sort((a, b) => `${a.time || ""}`.localeCompare(`${b.time || ""}`)),
    [existingDate, schedules]
  );
  const contextualSchedule = embedded ? schedules.find((schedule) => schedule.id === scheduleId) || null : null;
  const existingSchedule = contextualSchedule
    || schedules.find((schedule) => schedule.id === selectedScheduleId)
    || schedulesForExistingDate[0]
    || nextSchedule;
  const selectedSchedule = planningMode === "existing" ? (contextualSchedule || existingSchedule) : null;
  const selectedServiceType = planningMode === "existing" && selectedSchedule
    ? inferSmartServiceType(selectedSchedule)
    : options.serviceType || "";
  const effectiveCount = selectedServiceType
    ? isManualCountService(selectedServiceType)
      ? Number((selectedSchedule?.songs || []).length || options.count || 4)
      : getSmartServiceDefaultCount(selectedServiceType)
    : 0;
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
    && isCountableSchedule(schedule)
    && schedule.date === draftDate
    && inferSmartServiceType(schedule) === selectedServiceType
  );
  const usageIndex = useMemo(
    () => buildUsageIndex(schedules, planningReferenceDate, {
      currentSchedule: planningReferenceSchedule,
      excludeScheduleId: selectedSchedule?.id,
      beforeDateTime: planningReferenceSchedule ? planningReferenceDate.toISOString() : ""
    }),
    [planningReferenceDate, planningReferenceSchedule, schedules, selectedSchedule?.id]
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
  const pdfTerms = parseThemeInput(options.pdfSearchQuery);
  const ideaTerms = parseThemeInput(options.ideaQuery);
  const recommendationMode = options.recommendationMode || "general";
  const editingGeneral = recommendationMode === "general";
  const editingThemeCriteria = recommendationMode === "theme";
  const editingPdfCriteria = recommendationMode === "pdf";
  const editingSeedCriteria = recommendationMode === "seeds";
  const hasThemeCriteria = selectedThemes.length > 0 || ideaTerms.length > 0;
  const hasPdfCriteria = pdfTerms.length > 0;
  const nearbyPlannedSongs = useMemo(() => {
    if (!planningReferenceSchedule?.date) return [];
    const referenceMs = new Date(`${planningReferenceSchedule.date}T00:00:00`).getTime();
    return plannedNewSongs.filter((item) => {
      if (!item?.plannedDate) return false;
      const days = Math.abs(new Date(`${item.plannedDate}T00:00:00`).getTime() - referenceMs) / (24 * 60 * 60 * 1000);
      return days <= 14 && !["estrenado", "cancelado"].includes(normalizeSearchText(item.status || ""));
    });
  }, [plannedNewSongs, planningReferenceSchedule?.date]);
  const plannedSongIds = useMemo(() => {
    const ids = new Set();
    nearbyPlannedSongs.forEach((planned) => {
      if (planned.songId) ids.add(planned.songId);
      const title = normalizeSearchText(planned.title || planned.songTitle || "");
      const match = songs.find((song) => normalizeSearchText(song.title) === title);
      if (match?.id) ids.add(match.id);
    });
    return [...ids];
  }, [nearbyPlannedSongs, songs]);
  const baseSongItems = useMemo(() => baseSongs.map((entry) => ({
    ...entry,
    song: songs.find((song) => song.id === entry.songId)
  })).filter((entry) => entry.song), [baseSongs, songs]);
  const baseSongThemes = useMemo(() => {
    const counts = new Map();
    baseSongItems.forEach(({ song }) => [song.mainTheme, ...(song.otherThemes || [])].filter(Boolean).forEach((theme) => {
      const key = normalizeTheme(theme);
      const current = counts.get(key) || { theme, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }));
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3).map((item) => item.theme);
  }, [baseSongItems]);
  const pdfDetectedThemes = useMemo(
    () => (!selectedThemes.length && hasPdfCriteria && options.pdfSearchQuery
      ? inferThemesFromPdfMatches(songs, options.pdfSearchQuery)
      : []),
    [hasPdfCriteria, options.pdfSearchQuery, selectedThemes.length, songs]
  );
  const combinedThemes = useMemo(() => {
    const values = [...selectedThemes, ...baseSongThemes, ...pdfDetectedThemes];
    const seen = new Set();
    return values.filter((theme) => {
      const key = normalizeTheme(theme);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [baseSongThemes, pdfDetectedThemes, selectedThemes]);
  const hasSeedCriteria = baseSongItems.length > 0;
  const effectiveSmartOptions = useMemo(() => ({
    ...options,
    theme: combinedThemes.join(", "),
    includePdfText: hasPdfCriteria,
    ideaQuery: options.ideaQuery,
    pdfSearchQuery: options.pdfSearchQuery,
    plannedSongIds,
    allowThemeFallback: false
  }), [combinedThemes, hasPdfCriteria, options, plannedSongIds]);
  const songsWithIndexedText = useMemo(() => songs.filter((song) => song.pdfSearchText || song.pdfOcrText || song.pdfText || song.lyricsText).length, [songs]);
  const recommendations = useMemo(
    () => getSongRecommendations(songs, schedules, { ...effectiveSmartOptions, serviceType: selectedServiceType, currentSchedule: selectedSchedule, limit: 20, usageIndex })
      .filter((item) => !editingPdfCriteria || !hasPdfCriteria || item.scoreDetails?.pdfMatches?.length)
      .filter((item) => !dismissed.includes(item.song.id)),
    [dismissed, editingPdfCriteria, effectiveSmartOptions, hasPdfCriteria, schedules, selectedSchedule, selectedServiceType, songs, usageIndex]
  );
  const rawBlock = useMemo(
    () => createSuggestedServiceBlock(songs, schedules, { ...effectiveSmartOptions, count: effectiveCount, serviceType: selectedServiceType, currentSchedule: selectedSchedule, referenceDate: planningReferenceDate, usageIndex }),
    [effectiveCount, effectiveSmartOptions, planningReferenceDate, schedules, selectedSchedule, selectedServiceType, songs, usageIndex]
  );
  const blockWithBaseSongs = useMemo(() => {
    if (!hasSeedCriteria || !baseSongItems.length) return rawBlock;
    const slots = getServiceSlots(selectedServiceType, effectiveCount);
    const required = baseSongItems.filter((entry) => entry.mode === "required");
    const ideas = baseSongItems.filter((entry) => entry.mode !== "required");
    const scoredIdeas = ideas.map((entry, index) => ({
      entry,
      scored: scoreSong(entry.song, { ...effectiveSmartOptions, slot: slots[Math.min(required.length + index, Math.max(0, slots.length - 1))] }, { usageIndex })
    }));
    const retainedIdeas = scoredIdeas.filter(({ scored }) => scored.score >= 60).map(({ entry }) => entry);
    const replacedIdeas = scoredIdeas.filter(({ scored }) => scored.score < 60);
    const chosen = [...required, ...retainedIdeas].slice(0, effectiveCount);
    const chosenIds = new Set(chosen.map((entry) => entry.song.id));
    const replacedIdeaIds = new Set(replacedIdeas.map(({ entry }) => entry.song.id));
    const remaining = rawBlock.items.filter((item) => !chosenIds.has(item.song.id) && !replacedIdeaIds.has(item.song.id));
    const items = [...chosen.map((entry, index) => ({
      ...scoreSong(entry.song, { ...effectiveSmartOptions, slot: slots[index] }, { usageIndex }),
      song: entry.song,
      slot: slots[index],
      role: slots[index]?.role || "Canto",
      energy: slots[index]?.intent || "",
      baseMode: entry.mode
    })), ...remaining].slice(0, effectiveCount).map((item, index) => ({
      ...item,
      slot: slots[index],
      role: slots[index]?.role || item.role,
      energy: slots[index]?.intent || item.energy
    }));
    return {
      ...rawBlock,
      slots,
      items,
      score: items.length ? clampScore(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0,
      reasons: [
        `${required.length} canto(s) obligatorio(s) conservado(s)`,
        ...(replacedIdeas.length ? [`${replacedIdeas.length} idea(s) reemplazada(s) por baja compatibilidad`] : []),
        ...rawBlock.reasons
      ]
    };
  }, [baseSongItems, effectiveCount, effectiveSmartOptions, hasSeedCriteria, rawBlock, selectedServiceType, usageIndex]);
  const suggestedBlock = useMemo(
    () => applyManualBlockOrder(nextBlockState(blockWithBaseSongs, blockOverrides), blockOrder, selectedServiceType, effectiveSmartOptions, usageIndex, selectedSchedule),
    [blockOrder, blockOverrides, blockWithBaseSongs, effectiveSmartOptions, selectedSchedule, selectedServiceType, usageIndex]
  );
  const blockReadiness = useMemo(() => {
    const items = suggestedBlock.items || [];
    if (!items.length) return { ready: 0, recent: 0, underused: 0, planned: 0 };
    return {
      ready: Math.round((items.filter((item) => item.song.keynoteReviewStatus === "completado" && getSongPdfUrl(item.song)).length / items.length) * 100),
      recent: items.filter((item) => (item.usage?.lastUsedDays ?? 999) <= 30 || item.usage?.usedInPreviousService).length,
      underused: items.filter((item) => (item.usage?.recent30Count || 0) <= 1).length,
      planned: items.filter((item) => plannedSongIds.includes(item.song.id)).length
    };
  }, [plannedSongIds, suggestedBlock.items]);
  const baseSongResults = useMemo(() => {
    const query = normalizeSearchText(baseSongQuery);
    if (!query) return [];
    const selectedIds = new Set(baseSongs.map((entry) => entry.songId));
    return songs.filter((song) => !song.deleted && !selectedIds.has(song.id) && normalizeSearchText(song.title).includes(query)).slice(0, 8);
  }, [baseSongQuery, baseSongs, songs]);
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
    setPlanningError("");
    setOptions((current) => ({ ...current, recommendationMode }));
  };

  const updateThemes = (nextThemes) => {
    updateOption("theme", nextThemes.map((theme) => String(theme || "").trim()).filter(Boolean).join(", "));
  };

  const updatePrimaryTheme = (theme) => {
    updateThemes([theme, ...additionalThemes]);
  };

  const addBaseSong = (song) => {
    setBaseSongs((current) => current.some((entry) => entry.songId === song.id)
      ? current
      : [...current, { songId: song.id, mode: "idea" }]);
    setBaseSongQuery("");
    setBlockGenerated(false);
  };

  const updateBaseSongMode = (songId, mode) => {
    setBaseSongs((current) => current.map((entry) => entry.songId === songId ? { ...entry, mode } : entry));
    setBlockGenerated(false);
  };

  const removeBaseSong = (songId) => {
    setBaseSongs((current) => current.filter((entry) => entry.songId !== songId));
    setBlockGenerated(false);
  };

  const updateServiceType = (serviceType) => {
    setBlockOverrides({});
    setBlockOrder([]);
    setBlockGenerated(false);
    setOptions((current) => ({
      ...current,
      serviceType,
      count: isManualCountService(serviceType) ? current.count || 4 : getSmartServiceDefaultCount(serviceType),
      includeHymns: serviceType === "Miércoles de oración" ? false : current.includeHymns
    }));
  };

  const updateDraftDate = (date) => {
    setDraftDate(date);
    setBlockGenerated(false);
    if (!options.serviceType) updateServiceType(suggestServiceTypeFromDate(date));
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

  useEffect(() => {
    if (!embedded || !contextualSchedule) return;
    const serviceType = inferSmartServiceType(contextualSchedule);
    setPlanningMode("existing");
    setSelectedScheduleId(contextualSchedule.id);
    setExistingDate(contextualSchedule.date || "");
    setOptions((current) => ({
      ...current,
      serviceType,
      count: isManualCountService(serviceType) ? current.count || 4 : getSmartServiceDefaultCount(serviceType),
      includeHymns: serviceType === "Miércoles de oración" ? false : current.includeHymns
    }));
    setBlockGenerated(false);
    setBlockOverrides({});
    setBlockOrder([]);
  }, [contextualSchedule?.date, contextualSchedule?.id, embedded]);

  const selectEmbeddedMode = (mode) => {
    if (mode === "sustituir") {
      setActiveTab("sustituir");
      return;
    }
    setActiveTab("programar");
    updateRecommendationMode(mode);
  };

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
      includeHymns: serviceType === "Miércoles de oración" ? false : current.includeHymns,
      seed: current.seed + 1
    }));
    setBlockOverrides({});
    setBlockOrder([]);
    setBlockGenerated(false);
    setActiveTab("programar");
    setStatus(`Servicio seleccionado: ${scheduleLabel(nextSchedule)}. Elige un método para crear el bloque.`);
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
    setOptions((current) => ({ ...current, seed: current.seed + 1 }));
    setBlockOverrides({});
    setBlockOrder([]);
    setBlockGenerated(true);
    const criteria = [
      hasThemeCriteria ? "tema" : "",
      hasPdfCriteria ? "letra/PDF" : "",
      hasSeedCriteria ? "cantos elegidos" : ""
    ].filter(Boolean);
    setStatus(`Bloque sugerido para ${selectedServiceType} con ${effectiveCount} canto(s)${criteria.length ? ` usando ${criteria.join(", ")}` : " usando preparación y rotación"}.`);
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
    if (!canEdit) {
      setStatus("Puedes ver sugerencias, pero no modificar la programación.");
      return;
    }
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
    if (!canEdit) {
      setStatus("No tienes permiso para crear programaciones.");
      return;
    }
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
    const createdId = await saveSchedule(buildNewSchedulePayload());
    setConflictModalOpen(false);
    setStatus("Programación creada con el bloque sugerido.");
    navigate(createdId ? `/programacion?schedule=${createdId}` : "/programacion");
  };

  const applyBlock = async (mode) => {
    if (!canEdit) {
      setStatus("Puedes ver sugerencias, pero no aplicar cambios.");
      return;
    }
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
    const currentSongs = selectedSchedule.songs || [];
    const missingCount = Math.max(0, effectiveCount - currentSongs.length);
    const additions = entries
      .filter((entry) => !currentSongs.some((current) => current.songId === entry.songId))
      .slice(0, mode === "complete" ? missingCount : entries.length);
    const nextSongs = mode === "replace" ? entries : [...currentSongs, ...additions];
    await saveSchedule({ ...selectedSchedule, songs: nextSongs });
    setApplyBlockModalOpen(false);
    setStatus(mode === "replace"
      ? "Bloque aplicado reemplazando los cantos actuales."
      : `${additions.length} canto(s) agregado(s) para completar faltantes.`);
  };

  const replaceSong = async (candidate) => {
    if (!canEdit) {
      setStatus("No tienes permiso para sustituir cantos.");
      return;
    }
    if (!selectedSchedule?.id || !currentReplacementEntry || !candidate?.id) return;
    if (!confirm(`¿Sustituir "${currentReplacementEntry.titleSnapshot}" por "${candidate.title}"?`)) return;
    await replaceScheduleSong(selectedSchedule.id, currentReplacementEntry, candidate);
    setStatus(`Sustitución aplicada: ${currentReplacementEntry.titleSnapshot} -> ${candidate.title}`);
  };

  const openCompare = (item) => {
    setCompareItem(item);
    setCompareSongId(recommendations.find((candidate) => candidate.song.id !== item.song.id)?.song.id || "");
  };

  return (
    <SmartGradientBackground>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      >
        {embedded ? null : (
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brass/25 bg-brass/12 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brass">
              <Sparkles className="h-4 w-4" />
              Análisis musical
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-normal text-ink md:text-4xl">Centro Inteligente</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">
              Busca sugerencias, revisa un servicio o encuentra sustitutos con historial real del repertorio.
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(embedded ? [{ id: "programar", label: "Sugerencias", icon: Wand2 }, ...embeddedAssistantModes] : tabItems).map((tab) => {
            const Icon = tab.icon;
            const active = embedded
              ? tab.id === "sustituir"
                ? activeTab === "sustituir"
                : activeTab === "programar"
              : activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => embedded ? (tab.id === "sustituir" ? selectEmbeddedMode(tab.id) : setActiveTab("programar")) : setActiveTab(tab.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${active ? "bg-ink text-white shadow-soft dark:bg-brass dark:text-ink" : tab.primary ? "border border-brass/40 bg-brass/12 text-ink shadow-soft hover:bg-brass/18 dark:bg-brass/15" : "bg-white/70 text-ink ring-1 ring-ink/10 hover:bg-brass/10 dark:bg-white/8 dark:ring-white/10"}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {!embedded && tab.primary ? <span className="rounded-full bg-brass px-2 py-0.5 text-[10px] font-black text-ink">Especial</span> : null}
              </button>
            );
          })}
        </div>

        {status ? <p className="mt-5 rounded-2xl border border-brass/25 bg-brass/12 p-3 text-sm font-semibold text-ink">{status}</p> : null}

        <AnimatePresence mode="wait">
        {activeTab === "programar" ? (
          <motion.div
            key="song-suggestions"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <SongSuggestionAssistant
              songs={songs}
              schedules={schedules}
              themes={themes}
              settings={settings}
              schedule={contextualSchedule || schedules.find((item) => item.id === scheduleId) || null}
              initialDate={initialDate}
              canEdit={canEdit}
              saveSchedule={saveSchedule}
              indexLocalPdfTexts={indexLocalPdfTexts}
              navigate={navigate}
              onExplainScore={setScoreHelpItem}
            />
          </motion.div>
        ) : null}
        {false && activeTab === "programar" ? (
          <motion.section key="programar" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <SmartPanel>
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-brass" />
                <h2 className="text-xl font-black text-ink">{embeddedAssistantModes.find((item) => item.id === recommendationMode)?.label || "Servicio"}</h2>
              </div>
              <div className="mt-5 grid gap-4">
                {editingGeneral ? <>
                <Field label="Modo">
                  <Select value={planningMode} onChange={(event) => { setPlanningMode(event.target.value); setBlockGenerated(false); setBlockOverrides({}); setBlockOrder([]); }}>
                    <option value="create">Crear nueva programación</option>
                    <option value="existing">Usar programación existente</option>
                  </Select>
                </Field>
                {planningMode === "create" ? (
                  <>
                    <Field label="Fecha">
                      <Input type="date" value={draftDate} onChange={(event) => updateDraftDate(event.target.value)} />
                    </Field>
                    <SmartScheduleCalendar
                      schedules={schedules.filter((schedule) => !schedule.deleted)}
                      selectedDate={draftDate}
                      selectedId=""
                      onSelectDate={updateDraftDate}
                      onSelectSchedule={(schedule) => {
                        setPlanningMode("existing");
                        setSelectedScheduleId(schedule.id);
                        setExistingDate(schedule.date || "");
                        const serviceType = inferSmartServiceType(schedule);
                        setOptions((current) => ({
                          ...current,
                          serviceType,
                          count: isManualCountService(serviceType) ? current.count || 4 : getSmartServiceDefaultCount(serviceType),
                          includeHymns: serviceType === "Miércoles de oración" ? false : current.includeHymns
                        }));
                        setBlockGenerated(false);
                      }}
                    />
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
                          count: isManualCountService(serviceType) ? current.count || 4 : getSmartServiceDefaultCount(serviceType),
                          includeHymns: serviceType === "Miércoles de oración" ? false : current.includeHymns
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
                </> : (
                  <div className="rounded-2xl border border-brass/25 bg-brass/10 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-brass">Servicio actual</p>
                    <p className="mt-1 font-black text-ink">{selectedSchedule?.serviceLabel || selectedSchedule?.type || "Servicio"}</p>
                    <p className="mt-1 text-xs font-semibold text-ink/55">{selectedServiceType} · {effectiveCount} cantos esperados</p>
                  </div>
                )}
                {editingThemeCriteria ? (
                  <>
                    <p className="text-xs font-black uppercase tracking-wide text-ink/45">Criterios para este servicio</p>
                    <Field label="Tema principal">
                      <Input value={primaryTheme} onChange={(event) => updatePrimaryTheme(event.target.value)} placeholder="Ej. cruz" />
                    </Field>
                    {themeOptions.length ? (
                      <div className="max-h-48 overflow-y-auto rounded-2xl border border-ink/10 bg-white/55 p-2 dark:border-white/10 dark:bg-white/7">
                        <div className="flex flex-wrap gap-1.5">
                          {themeOptions.map((theme) => (
                            <button key={`primary-${theme}`} type="button" onClick={() => updatePrimaryTheme(theme)} className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${normalizeTheme(primaryTheme) === normalizeTheme(theme) ? "bg-brass text-ink" : "bg-ink/5 text-ink/65 hover:bg-brass/15"}`}>
                              {theme}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <Field label="Temas adicionales">
                      <ChipInput values={additionalThemes} onChange={(values) => updateThemes([primaryTheme, ...values])} placeholder="Agrega temas opcionales" />
                    </Field>
                    <Field label="Ideas o frases para orientar la sugerencia">
                      <ChipInput values={ideaTerms} onChange={(values) => updateOption("ideaQuery", values.join(", "))} placeholder="Ej. perdón, cruz, gracia, redención, te exaltaré" />
                      <p className="mt-2 text-xs leading-5 text-ink/50">Estas frases ayudan a orientar el bloque. Para explorar coincidencias específicas en letras/PDF usa la pestaña Buscar por letra/PDF.</p>
                    </Field>
                    <p className="rounded-xl bg-brass/10 px-3 py-2 text-xs font-semibold text-ink/65">
                      Estos temas se combinarán con cualquier búsqueda por letra/PDF y con los cantos base elegidos.
                    </p>
                  </>
                ) : null}
                {editingPdfCriteria ? (
                  <Field label="Palabras o frases en letras/PDF">
                    <ChipInput values={pdfTerms} onChange={(values) => updateOption("pdfSearchQuery", values.join(", "))} placeholder="Agrega palabras o frases" />
                  </Field>
                ) : null}
                {editingSeedCriteria ? (
                  <div className="grid gap-3">
                    <Field label="Cantos base">
                      <Input value={baseSongQuery} onChange={(event) => setBaseSongQuery(event.target.value)} placeholder="Buscar por título" />
                    </Field>
                    {baseSongResults.length ? (
                      <div className="grid gap-1 rounded-xl border border-ink/10 bg-white/70 p-2 dark:border-white/10 dark:bg-black/20">
                        {baseSongResults.map((song) => (
                          <button key={song.id} type="button" onClick={() => addBaseSong(song)} className="rounded-lg px-3 py-2 text-left text-sm font-bold text-ink hover:bg-brass/12">
                            {song.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      {baseSongItems.map(({ song, mode }) => {
                        const usage = usageIndex.usage.get(song.id) || {};
                        const recentUses = usage.recent30Count || 0;
                        const rotation = usage.usedInPreviousService
                          ? "Servicio anterior"
                          : usage.lastUsedDays === null || usage.lastUsedDays === undefined
                            ? "Sin historial previo"
                            : usage.lastUsedDays > 30
                              ? "Sin uso en 30 días"
                              : `Último uso: hace ${usage.lastUsedDays} día(s)`;
                        return (
                        <div key={song.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-ink/10 bg-white/65 p-2.5 dark:border-white/10 dark:bg-white/7">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-ink">{song.title}</span>
                            <span className="block truncate text-xs font-semibold text-ink/45">{song.category || "Sin categoría"} · {song.keyWithCapo || song.mainKey || "Sin tono"}</span>
                            <span className="mt-1 block truncate text-[11px] font-semibold text-ink/45">{rotation} · {recentUses} uso(s) en 30 días</span>
                          </span>
                          <Select className="w-28" value={mode} onChange={(event) => updateBaseSongMode(song.id, event.target.value)}>
                            <option value="idea">Solo idea</option>
                            <option value="required">Obligatorio</option>
                          </Select>
                          <button type="button" aria-label={`Quitar ${song.title}`} onClick={() => removeBaseSong(song.id)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/45 hover:bg-red-500/10 hover:text-red-600"><X className="h-4 w-4" /></button>
                        </div>
                        );
                      })}
                    </div>
                    {effectiveCount ? <p className="text-xs font-semibold text-ink/55">{baseSongItems.length >= effectiveCount ? `Seleccionaste ${baseSongItems.length}; este servicio usa ${effectiveCount}.` : `Faltan ${effectiveCount - baseSongItems.length} canto(s) para completar el bloque.`}</p> : null}
                  </div>
                ) : null}
                {editingPdfCriteria ? (
                  <div className="rounded-2xl border border-brass/20 bg-brass/10 p-3 text-sm text-ink">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold">
                        Letras/PDF indexados: {songsWithIndexedText} de {songs.length}
                        <span className="block text-xs font-medium text-ink/55">El índice se guarda en Firestore por canto y se reutiliza si el PDF no cambió.</span>
                      </p>
                      {songsWithIndexedText < songs.length ? (
                        <Button variant="secondary" className="h-9 px-3 text-xs" onClick={indexPdfTextsFromSmartCenter} disabled={isIndexingTexts}>
                          {isIndexingTexts ? "Indexando..." : "Indexar ahora"}
                        </Button>
                      ) : null}
                    </div>
                    {indexProgress ? (
                      <p className="mt-2 text-xs font-semibold text-ink/55">
                        {indexProgress.current || 0}/{indexProgress.total || 0} · Indexados {indexProgress.indexed || 0} · Reutilizados {indexProgress.reused || 0} · OCR {(indexProgress.ocrItems || []).length}
                      </p>
                    ) : null}
                    {indexResult ? (
                      <p className="mt-2 text-xs font-semibold text-ink/55">
                        Listo: {indexResult.indexed} indexados, {indexResult.reused || 0} reutilizados, {indexResult.failed || 0} errores.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {editingGeneral && selectedServiceType && isManualCountService(selectedServiceType) ? (
                  <Field label="Número de cantos">
                    <Input type="number" min="1" max="8" value={options.count} onChange={(event) => updateOption("count", Number(event.target.value || 4))} />
                  </Field>
                ) : editingGeneral && selectedServiceType ? (
                  <p className="rounded-2xl bg-brass/12 p-3 text-sm font-semibold text-ink">
                    {selectedServiceType} usa {effectiveCount} cantos.
                  </p>
                ) : null}
                {editingGeneral ? (
                  <>
                    <Field label="Rotación">
                      <Select value={options.rotationPriority} onChange={(event) => updateOption("rotationPriority", event.target.value)}>
                        <option value="underused">Priorizar los que llevan más tiempo sin cantarse</option>
                        <option value="balanced">Equilibrada</option>
                        <option value="strict">Evitar fuertemente los recientes</option>
                      </Select>
                    </Field>
                    <Field label="Categoría preferida">
                      <Select value={options.categoryChoice} onChange={(event) => updateOption("categoryChoice", event.target.value)}>
                        <option value="cualquiera">Cualquiera</option>
                        <option value="normal">Normal</option>
                        <option value="himno">Himno</option>
                        <option value="navidad">Navidad</option>
                      </Select>
                    </Field>
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input type="checkbox" checked={options.includeHymns} onChange={(event) => updateOption("includeHymns", event.target.checked)} />
                      Permitir himnos
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input type="checkbox" checked={options.avoidRecent} onChange={(event) => updateOption("avoidRecent", event.target.checked)} />
                      Evitar repetidos recientes
                    </label>
                    <p className="rounded-xl border border-ink/10 bg-white/55 px-3 py-2 text-xs font-semibold text-ink/60 dark:border-white/10 dark:bg-white/7">
                      {[hasThemeCriteria ? `${selectedThemes.length || ideaTerms.length} criterio(s) de tema` : "", hasPdfCriteria ? `${pdfTerms.length} frase(s) de letra/PDF` : "", hasSeedCriteria ? `${baseSongItems.length} canto(s) base` : ""].filter(Boolean).join(" · ") || "Sin criterios específicos: se usará preparación y rotación."}
                    </p>
                  </>
                ) : null}
                {editingGeneral ? <div className="grid gap-2">
                  {planningError ? (
                    <p className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800 dark:border-red-400/35 dark:bg-red-500/12 dark:text-red-100">
                      {planningError}
                    </p>
                  ) : null}
                  {!blockGenerated ? (
                    <Button onClick={createBlock}><Wand2 className="h-4 w-4" />Generar bloque del servicio</Button>
                  ) : (
                    <>
                      <Button onClick={regenerateBlock}><RefreshCw className="h-4 w-4" />Regenerar alternativa</Button>
                      <p className="text-xs leading-5 text-ink/55">Regenerar crea una alternativa con los mismos criterios.</p>
                    </>
                  )}
                </div> : null}
              </div>
            </SmartPanel>

            <div className="grid gap-4">
              <SmartPanel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brass">Resumen</p>
                    <h3 className="mt-1 text-lg font-black text-ink">{selectedServiceType || "Configura el servicio"}</h3>
                  </div>
                  <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-black text-ink/60 dark:bg-white/8">{effectiveCount ? `${effectiveCount} cantos` : "Cantidad pendiente"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-brass/12 px-3 py-1 text-brass">{[hasThemeCriteria ? "Tema" : "", hasPdfCriteria ? "Letra/PDF" : "", hasSeedCriteria ? "Cantos base" : ""].filter(Boolean).join(" + ") || "Rotación"}</span>
                  {primaryTheme ? <span className="rounded-full bg-ink/5 px-3 py-1 text-ink/60 dark:bg-white/8">{primaryTheme}</span> : null}
                  {pdfTerms.length ? <span className="rounded-full bg-ink/5 px-3 py-1 text-ink/60 dark:bg-white/8">{pdfTerms.length} frase(s)</span> : null}
                  {baseSongItems.length ? <span className="rounded-full bg-ink/5 px-3 py-1 text-ink/60 dark:bg-white/8">{baseSongItems.length} canto(s) base</span> : null}
                </div>
              </SmartPanel>
              {!blockGenerated ? (
                <EmptySmartState
                  title={editingPdfCriteria ? "Agrega coincidencias de letra/PDF" : editingSeedCriteria ? "Elige cantos base" : editingThemeCriteria ? "Define los temas" : "Configura y genera el servicio"}
                  message={editingPdfCriteria
                    ? "Escribe palabras o frases para encontrar candidatos individuales y agregarlos al servicio."
                    : editingSeedCriteria
                      ? "Usa los cantos actuales o elige uno o dos cantos base; el asistente propondrá los faltantes."
                      : editingThemeCriteria
                        ? "El tema principal y los temas adicionales son opcionales y se combinan con los demás criterios."
                        : "Genera el bloque con tema, letra, cantos base, preparación y rotación, o solo con los criterios que necesites."}
                />
              ) : null}
              {blockGenerated ? <SmartPanel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {blockGenerated ? <p className="text-xs font-bold uppercase tracking-wide text-brass">
                      {selectedServiceType || "Sin servicio"} · {hasSeedCriteria
                        ? `${baseSongItems.length} canto(s) base`
                        : primaryTheme
                          ? `Tema: ${primaryTheme}`
                          : ideaTerms.length
                            ? `${ideaTerms.length} idea(s) o frase(s)`
                            : "Rotación y preparación"}
                    </p> : null}
                    <h3 className="text-xl font-black text-ink">Bloque sugerido para {selectedServiceType}</h3>
                  </div>
                  <ScoreBadge score={blockGenerated ? suggestedBlock.score : 0} label="Bloque" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-ink/5 p-3 dark:bg-white/8">
                    <p className="text-xs font-bold uppercase text-ink/45">Preparación estimada</p>
                    <p className="mt-1 text-lg font-black text-ink">{blockReadiness.ready}%</p>
                  </div>
                  <div className="rounded-xl bg-ink/5 p-3 dark:bg-white/8">
                    <p className="text-xs font-bold uppercase text-ink/45">Rotación</p>
                    <p className="mt-1 font-black text-ink">{blockReadiness.recent ? `${blockReadiness.recent} reciente(s)` : "Rotación saludable"}</p>
                  </div>
                  <div className="rounded-xl bg-ink/5 p-3 dark:bg-white/8">
                    <p className="text-xs font-bold uppercase text-ink/45">Poco usados / nuevos</p>
                    <p className="mt-1 font-black text-ink">{blockReadiness.underused} / {blockReadiness.planned}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {blockGenerated && suggestedBlock.items.length ? (
                    <SortableList items={suggestedBlock.items} getId={blockItemId} onReorder={(items) => setBlockOrder(items.map(blockItemId))} className="grid gap-3">
                      {(item, index, dragHandleProps) => (
                    <article className="rounded-xl border border-white/60 bg-white/74 p-3 shadow-soft dark:border-white/10 dark:bg-white/8">
                      <div className="grid gap-2 sm:grid-cols-[42px_minmax(0,1fr)_170px] sm:items-center">
                        <div className="flex items-start">
                          <SortableHandle {...dragHandleProps} />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <p className="text-xs font-bold uppercase tracking-wide text-brass">{index + 1}. {item.role}</p>
                          <h4 className="mt-1 truncate text-base font-black text-ink">{item.song.title}</h4>
                          <div className="mt-2"><ReasonChips reasons={item.reasons?.slice(0, 2)} warnings={item.warnings?.slice(0, 1)} /></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                          <ScoreBadge score={item.score} compact />
                          <Button className="h-9 px-3 text-xs" variant="secondary" onClick={() => setAlternativeSlot(item.slot)}><Shuffle className="h-4 w-4" />Cambiar</Button>
                          <Button className="h-9 px-3 text-xs" variant="subtle" onClick={() => navigate(`/repertorio/${item.song.id}`)}>Ver detalle</Button>
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button disabled={!suggestedBlock.items.length || !canEdit} onClick={() => setApplyBlockModalOpen(true)}>
                    <ListChecks className="h-4 w-4" />
                    {planningMode === "create" ? "Crear programación" : "Aplicar a programación"}
                  </Button>
                  <Button variant="secondary" onClick={regenerateBlock}><RefreshCw className="h-4 w-4" />Regenerar alternativa</Button>
                  <Button variant="subtle" onClick={() => { setBlockGenerated(false); setBlockOverrides({}); setBlockOrder([]); }}>Descartar</Button>
                </div>
              </SmartPanel> : null}

              {blockGenerated && editingPdfCriteria && hasPdfCriteria ? <SmartPanel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brass">Búsqueda individual</p>
                    <h3 className="text-xl font-black text-ink">Candidatos por letra/PDF</h3>
                  </div>
                  <p className="text-sm font-semibold text-ink/55">Top {Math.min(6, recommendations.length)}</p>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {recommendations.slice(0, 6).map((item) => (
                  <RecommendationCard
                    key={item.song.id}
                    item={item}
                    onAdd={canEdit ? addSongToSchedule : undefined}
                    onView={(song) => navigate(`/repertorio/${song.id}`)}
                    onCompare={() => openCompare(item)}
                    onExplain={setScoreHelpItem}
                    onDismiss={(song) => setDismissed((current) => [...current, song.id])}
                  />
                ))}
                </div>
              </SmartPanel> : null}
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
              {!embedded ? <Field label="Programación" className="mt-5">
                <Select value={selectedSchedule?.id || ""} onChange={(event) => setSelectedScheduleId(event.target.value)}>
                  {schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{scheduleLabel(schedule)}</option>)}
                </Select>
              </Field> : null}
              <Field label="Canto a sustituir" className={embedded ? "mt-5" : "mt-4"}>
                <Select value={currentReplacementEntry?.songId || ""} onChange={(event) => setReplacementSongId(event.target.value)}>
                  {(selectedSchedule?.songs || []).map((entry) => <option key={`${entry.songId}-${entry.titleSnapshot}`} value={entry.songId}>{entry.titleSnapshot}</option>)}
                </Select>
              </Field>
              {currentReplacementSong ? (
                <div className="smart-current-song-card mt-5 rounded-2xl border border-ink/10 bg-ink/5 p-4">
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
                  onAdd={canEdit ? replaceSong : undefined}
                  onView={(song) => navigate(`/repertorio/${song.id}`)}
                  onCompare={() => openCompare(item)}
                  onExplain={setScoreHelpItem}
                />
              ))}
              {!replacementCandidates.length ? (
                <SmartPanel className="lg:col-span-2">
                  <p className="font-black text-ink">No hay sustitutos suficientemente compatibles.</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">Prueba con otro canto actual o completa más datos del repertorio para ampliar las opciones.</p>
                </SmartPanel>
              ) : null}
            </div>
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

      <Modal open={applyBlockModalOpen} title="Aplicar bloque sugerido" onClose={() => setApplyBlockModalOpen(false)}>
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
                <Button onClick={() => {
                  if (!confirm("Esta acción reemplazará los cantos actuales del servicio. ¿Continuar?")) return;
                  applyBlock("replace");
                }}>Reemplazar bloque completo</Button>
                <Button variant="secondary" disabled={(selectedSchedule?.songs || []).length >= effectiveCount} onClick={() => applyBlock("complete")}>Completar faltantes</Button>
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
              <p className="mt-1 text-xs font-semibold text-ink/45">Los puntos a favor se limitan a 100 antes de restar cada punto en contra; así una penalización nunca queda oculta.</p>
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
              <div className="smart-success-empty rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
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
