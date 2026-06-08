import { getSongPdfUrl, normalizeSearchText } from "./songUtils";
import { formatScheduleDateWithService, getEstimatedServiceEndDate, getScheduleStartDate } from "./dateUtils";

const dayMs = 24 * 60 * 60 * 1000;
const recentStrongDays = 14;
const recentWindowDays = 30;
const keyOrder = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const keyAliases = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#" };

export const smartServiceTypes = ["Domingo AM", "Domingo PM", "Miércoles de oración", "Servicio especial"];
export const smartEnergies = ["apertura", "congregacional fuerte", "reflexión", "cierre"];

export function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

const closedStatuses = new Set(["realizado", "realizada", "cerrado", "cerrada", "closed", "done"]);

function isDeletedSchedule(schedule = {}) {
  return Boolean(schedule.deleted || schedule.active === false || schedule.relatedEntityDeleted);
}

function scheduleKey(schedule = {}) {
  return `${schedule.date || ""}|${schedule.time || ""}|${schedule.serviceType || ""}|${schedule.serviceLabel || schedule.type || ""}`;
}

function sameSchedule(left = {}, right = {}) {
  if (!left || !right) return false;
  if (left.id && right.id && left.id === right.id) return true;
  return Boolean(left.date && right.date && scheduleKey(left) === scheduleKey(right));
}

function scheduleStartMs(schedule = {}) {
  const start = getScheduleStartDate(schedule);
  return start?.getTime?.() || null;
}

function scheduleEndMs(schedule = {}) {
  const end = getEstimatedServiceEndDate(schedule);
  return end?.getTime?.() || null;
}

export function getScheduleReviewMode(schedule = {}, now = new Date()) {
  const status = normalizeSearchText(schedule.status || "");
  if (closedStatuses.has(status)) return "closed";
  const endMs = scheduleEndMs(schedule);
  const startMs = scheduleStartMs(schedule);
  if (endMs && endMs <= now.getTime()) return "past";
  if (startMs && startMs <= now.getTime() && (!endMs || endMs > now.getTime())) return "current";
  return "future";
}

export function getPreviousRealService(currentSchedule = {}, allSchedules = []) {
  const currentStartMs = scheduleStartMs(currentSchedule);
  if (!currentStartMs) return null;
  return [...(Array.isArray(allSchedules) ? allSchedules : [])]
    .filter((schedule) => schedule?.date && !isDeletedSchedule(schedule) && !sameSchedule(schedule, currentSchedule))
    .map((schedule) => ({ schedule, startMs: scheduleStartMs(schedule) }))
    .filter((entry) => entry.startMs && entry.startMs < currentStartMs)
    .sort((a, b) => b.startMs - a.startMs)[0]?.schedule || null;
}

const serviceDefaults = {
  "Miércoles de oración": { count: 3, preferredThemeFallbacks: ["oración", "entrega", "fe", "esperanza"] },
  "Domingo AM": { count: 5, preferredThemeFallbacks: ["adoración", "gloria", "señorío", "cruz"] },
  "Domingo PM": { count: 4, preferredThemeFallbacks: ["adoración", "entrega", "gracia", "esperanza"] },
  "Servicio especial": { count: 4, preferredThemeFallbacks: ["adoración", "entrega", "gloria", "esperanza"] }
};

const slotThemes = {
  apertura: ["gloria", "alabanza", "señorío", "gratitud", "adoración", "gozo"],
  congregacional: ["adoración", "gloria", "alabanza", "señorío", "fe"],
  enfoque: ["adoración", "cruz", "gracia", "esperanza", "entrega", "fe"],
  antes_predicacion: ["palabra", "enseñanza", "entrega", "oración", "cruz", "fe"],
  despues_predicacion: ["respuesta", "entrega", "oración", "cruz", "gracia", "consagración", "reflexión"],
  oracion: ["oración", "dependencia", "fe", "entrega", "esperanza", "sencillez"],
  santa_cena: ["cruz", "sangre", "gracia", "redención", "sacrificio", "recordar"],
  navidad: ["navidad", "encarnación", "gloria", "esperanza"]
};

export function inferSmartServiceType(schedule = {}) {
  const label = normalizeSearchText([schedule.serviceLabel, schedule.type, schedule.serviceType].filter(Boolean).join(" "));
  const time = String(schedule.time || "");
  if (label.includes("navidad") || label.includes("santa cena") || label.includes("aniversario")) return "Servicio especial";
  if (label.includes("especial") || label.includes("congreso") || label.includes("vigilia") || label.includes("evento")) return "Servicio especial";
  if (label.includes("miercoles") || label.includes("oracion")) return "Miércoles de oración";
  if (label.includes("tarde") || label.includes("pm") || time.startsWith("17")) return "Domingo PM";
  if (label.includes("manana") || label.includes("am") || time.startsWith("11")) return "Domingo AM";
  if (schedule.date) {
    const weekday = new Date(`${schedule.date}T00:00:00`).getDay();
    if (weekday === 3) return "Miércoles de oración";
    if (weekday === 0 && time >= "16:00") return "Domingo PM";
    if (weekday === 0) return "Domingo AM";
  }
  return "Servicio especial";
}

export function getSmartServiceDefaultCount(serviceType = "Domingo AM") {
  return serviceDefaults[serviceType]?.count || 4;
}

export function getServiceSlots(serviceType = "Domingo AM", count) {
  const desiredCount = Number(count || getSmartServiceDefaultCount(serviceType));
  if (serviceType === "Servicio especial") {
    const special = [
      { id: "apertura", role: "Apertura", intent: "apertura", description: "Inicio congregacional del servicio especial." },
      { id: "congregacional", role: "Congregacional", intent: "congregacional", description: "Canto para unir a la iglesia." },
      { id: "enfoque", role: "Enfoque", intent: "enfoque", description: "Canto conectado con el tema principal." },
      { id: "especial_1", role: "Canto especial", intent: "enfoque", description: "Espacio flexible según el evento." },
      { id: "antes_predicacion", role: "Antes de predicación", intent: "antes_predicacion", description: "Prepara el corazón para la Palabra." },
      { id: "despues_predicacion", role: "Después de predicación", intent: "despues_predicacion", description: "Solo un canto de respuesta." },
      { id: "especial_2", role: "Cierre especial", intent: "despues_predicacion", description: "Cierre flexible del evento." },
      { id: "especial_3", role: "Canto adicional", intent: "congregacional", description: "Canto adicional si el programa lo requiere." }
    ];
    return special.slice(0, Math.max(1, Math.min(desiredCount, special.length)));
  }
  const countLimit = Math.max(1, Math.min(desiredCount, 8));
  return Array.from({ length: countLimit }, (_, index) => {
    if (index === 0) {
      return { id: "apertura", role: "Apertura", intent: "apertura", description: "Inicio congregacional del servicio." };
    }
    if (index === countLimit - 1) {
      return { id: "despues_predicacion", role: "Después de la prédica", intent: "despues_predicacion", description: "Único canto de respuesta después de la prédica." };
    }
    return { id: `antes_predicacion_${index}`, role: "Antes de la prédica", intent: serviceType === "Miércoles de oración" ? "oracion" : "antes_predicacion", description: "Canto antes de la prédica." };
  });
}

export function parseThemeInput(value = "") {
  return String(value || "")
    .split(/[,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toSongEntry(song = {}, position = "") {
  return {
    songId: song.id,
    titleSnapshot: song.title || "",
    keySnapshot: song.keyWithCapo || song.mainKey || "",
    pdfUrl: song.pdfPreviewUrl || song.pdfUrl || song.drivePdfUrl || song.chordsUrl || "",
    notes: song.internalNotes || ""
  };
}

export function getRealSongUsage(songId, schedules = [], options = {}) {
  const now = options.now || new Date();
  const beforeMs = options.beforeDateTime ? new Date(options.beforeDateTime).getTime() : null;
  const excludeScheduleId = options.excludeScheduleId || options.currentSchedule?.id || "";
  const currentSchedule = options.currentSchedule || null;
  const usage = { count: 0, monthCount: 0, recent30Count: 0, lastUsedAt: "", lastUsedDays: null, lastSchedule: null, lastFollowUp: null, usedInPreviousService: false };
  const currentMonth = now.toISOString().slice(0, 7);
  const previousService = currentSchedule ? getPreviousRealService(currentSchedule, schedules) : null;

  (Array.isArray(schedules) ? schedules : []).forEach((schedule) => {
    if (!schedule?.date || isDeletedSchedule(schedule)) return;
    if (excludeScheduleId && schedule.id === excludeScheduleId) return;
    if (currentSchedule && sameSchedule(schedule, currentSchedule)) return;
    const startMs = scheduleStartMs(schedule);
    if (!startMs) return;
    if (beforeMs && startMs >= beforeMs) return;
    if (!beforeMs && startMs > now.getTime()) return;
    const countedInSchedule = new Set((schedule.songs || []).map((entry) => entry.songId).filter(Boolean));
    if (!countedInSchedule.has(songId)) return;

    const daysFromService = Math.floor((now.getTime() - startMs) / dayMs);
    usage.count += 1;
    if (String(schedule.date).startsWith(currentMonth)) usage.monthCount += 1;
    if (daysFromService >= 0 && daysFromService <= recentWindowDays) usage.recent30Count += 1;
    if (!usage.lastSchedule || startMs > scheduleStartMs(usage.lastSchedule)) {
      usage.lastSchedule = schedule;
      usage.lastUsedAt = schedule.date;
      usage.lastUsedDays = daysFromService;
      usage.lastFollowUp = getSongFollowUp(schedule, songId);
    }
    if (previousService?.id && schedule.id === previousService.id) usage.usedInPreviousService = true;
  });

  return usage;
}

export function buildUsageIndex(schedules = [], now = new Date(), options = {}) {
  const usage = new Map();
  const currentSchedule = options.currentSchedule || null;
  const beforeDateTime = options.beforeDateTime || (currentSchedule ? getScheduleStartDate(currentSchedule)?.toISOString() : "");
  const previousService = currentSchedule
    ? getPreviousRealService(currentSchedule, schedules)
    : [...schedules]
      .filter((schedule) => !isDeletedSchedule(schedule) && schedule.date && scheduleStartMs(schedule) && scheduleStartMs(schedule) <= now.getTime())
      .sort((a, b) => (scheduleStartMs(b) || 0) - (scheduleStartMs(a) || 0))[0] || null;

  schedules.forEach((schedule) => {
    if (!schedule.date || isDeletedSchedule(schedule)) return;
    if (options.excludeScheduleId && schedule.id === options.excludeScheduleId) return;
    if (currentSchedule && sameSchedule(schedule, currentSchedule)) return;
    const startMs = scheduleStartMs(schedule);
    if (!startMs) return;
    if (beforeDateTime && startMs >= new Date(beforeDateTime).getTime()) return;
    const isFuture = startMs > now.getTime();
    const countedInSchedule = new Set();
    (schedule.songs || []).forEach((entry) => {
      if (!entry.songId) return;
      if (countedInSchedule.has(entry.songId)) return;
      countedInSchedule.add(entry.songId);
      const current = usage.get(entry.songId) || { count: 0, monthCount: 0, recent30Count: 0, lastUsedAt: "", lastUsedDays: null, lastSchedule: null, lastFollowUp: null, usedInPreviousService: false };
      if (!isFuture) {
        const daysFromService = Math.floor((now.getTime() - startMs) / dayMs);
        current.count += 1;
        if (String(schedule.date).startsWith(now.toISOString().slice(0, 7))) current.monthCount += 1;
        if (daysFromService >= 0 && daysFromService <= recentWindowDays) current.recent30Count += 1;
        if (!current.lastSchedule || startMs > scheduleStartMs(current.lastSchedule)) {
          current.lastSchedule = schedule;
          current.lastUsedAt = schedule.date;
          current.lastUsedDays = daysFromService;
          current.lastFollowUp = getSongFollowUp(schedule, entry.songId);
        }
        if (previousService?.id && schedule.id === previousService.id) current.usedInPreviousService = true;
      }
      usage.set(entry.songId, current);
    });
  });
  usage.forEach((item, songId) => {
    const outstanding = getOutstandingSongFollowUps(songId, schedules, currentSchedule)[0];
    if (outstanding?.followUp) item.lastFollowUp = outstanding.followUp;
  });

  return { usage, previousService };
}

function noteIndex(key = "") {
  const clean = String(key || "").trim().replace("♯", "#").replace("♭", "b").toUpperCase();
  const normalized = keyAliases[clean] || clean;
  return keyOrder.findIndex((keyName) => keyName.toUpperCase() === normalized);
}

function keyDistance(a = "", b = "") {
  const left = noteIndex(a);
  const right = noteIndex(b);
  if (left < 0 || right < 0) return null;
  const diff = Math.abs(left - right);
  return Math.min(diff, 12 - diff);
}

function isHymn(song = {}) {
  const text = normalizeSearchText([song.category, song.mainTheme, song.title].filter(Boolean).join(" "));
  return text.includes("himno");
}

function isChristmasCategory(song = {}) {
  return normalizeSearchText(song.category || "").includes("navidad");
}

function songThemeText(song = {}) {
  return normalizeSearchText([
    song.title,
    song.category,
    song.mainTheme,
    ...(song.otherThemes || []),
    ...(song.tags || [])
  ].filter(Boolean).join(" "));
}

function songIndexedText(song = {}) {
  return [
    song.pdfSearchText,
    song.pdfOcrText,
    song.pdfText,
    song.lyricsText,
    ...(song.pdfSearchTokens || [])
  ].filter(Boolean).join(" ");
}

function splitSearchTerms(value = "") {
  return String(value || "")
    .split(/[\n,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findIndexedTextMatches(song = {}, searchValue = "", options = {}) {
  const rawText = songIndexedText(song);
  const normalizedText = normalizeSearchText(rawText);
  const terms = Array.isArray(searchValue) ? searchValue : splitSearchTerms(searchValue);
  const cleanedTerms = terms
    .map((term) => String(term || "").trim())
    .filter((term) => normalizeSearchText(term).length >= 2);
  if (!rawText || !cleanedTerms.length) return [];
  const words = String(rawText || "").replace(/\s+/g, " ").trim();
  const normalizedWords = normalizeSearchText(words);
  const matches = [];
  cleanedTerms.forEach((term) => {
    const normalizedTerm = normalizeSearchText(term);
    let matchedValue = normalizedText.includes(normalizedTerm) ? term : "";
    let kind = matchedValue ? "exact" : "partial";
    if (!matchedValue && options.allowWordMatches !== false) {
      matchedValue = normalizedTerm.split(/\s+/).filter((word) => word.length >= 4).find((word) => normalizedText.includes(word)) || "";
    }
    if (!matchedValue) return;
    const normalizedMatch = normalizeSearchText(matchedValue);
    const index = normalizedWords.indexOf(normalizedMatch);
    const snippet = index >= 0
      ? words.slice(Math.max(0, index - 28), Math.min(words.length, index + String(matchedValue).length + 36)).trim()
      : String(matchedValue);
    matches.push({ theme: term, matchedValue, snippet, kind });
  });
  return matches;
}

function findIndexedTextMatch(song = {}, searchValue = "", options = {}) {
  return findIndexedTextMatches(song, searchValue, options)[0] || null;
}

export function inferThemesFromPdfMatches(songs = [], searchValue = "") {
  const counts = new Map();
  songs.forEach((song) => {
    const matches = findIndexedTextMatches(song, searchValue);
    if (!matches.length) return;
    [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].filter(Boolean).forEach((theme) => {
      const key = normalizeSearchText(theme);
      if (!key) return;
      const current = counts.get(key) || { theme, count: 0 };
      current.count += Math.max(1, matches.length);
      counts.set(key, current);
    });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || String(a.theme).localeCompare(String(b.theme), "es"))
    .slice(0, 2)
    .map((item) => item.theme);
}

function hasThemeMatch(song = {}, themes = []) {
  const text = songThemeText(song);
  return themes.some((theme) => text.includes(normalizeSearchText(theme)));
}

function addUniqueReason(list, reason) {
  if (reason && !list.includes(reason)) list.push(reason);
}

function pluralizeUse(count = 0) {
  return `${count} ${count === 1 ? "vez" : "veces"}`;
}

function describeLastUse(usage = {}) {
  if (!usage?.lastUsedAt) return "Sin historial previo";
  if (usage.lastUsedDays === 0) return `Usado hoy (${usage.lastUsedAt})`;
  if (usage.lastUsedDays === 1) return `Usado hace 1 dia (${usage.lastUsedAt})`;
  return `Usado hace ${usage.lastUsedDays} dias (${usage.lastUsedAt})`;
}

function describeRecentImpact(usage = {}) {
  const days = usage?.lastUsedDays;
  if (days === null || days === undefined) return "Sin penalizacion por historial";
  if (days <= recentStrongDays) return "Penalizacion fuerte por uso en los ultimos 14 dias";
  if (days <= recentWindowDays) return "Penalizacion moderada por uso entre 15 y 30 dias";
  return "Sin penalizacion por uso reciente";
}

function getSongFollowUp(schedule = {}, songId = "") {
  if (!songId) return null;
  const followUp = schedule.serviceFollowUp?.songs?.[songId] || null;
  return followUp?.resolved === true ? null : followUp;
}

export function isNoteworthySongFollowUp(followUp = {}) {
  return Boolean(
    followUp.notes
    || followUp.resourceIssues
    || (followUp.result && followUp.result !== "bien")
    || (followUp.difficulty && !["normal", "facil"].includes(followUp.difficulty))
    || (followUp.congregationResponse && followUp.congregationResponse !== "normal" && followUp.congregationResponse !== "bien")
    || (followUp.keyComfort && followUp.keyComfort !== "comoda")
  );
}

export function getOutstandingSongFollowUps(songId = "", schedules = [], currentSchedule = null) {
  if (!songId) return [];
  const beforeMs = currentSchedule ? scheduleStartMs(currentSchedule) : Date.now();
  const history = (Array.isArray(schedules) ? schedules : [])
    .filter((schedule) => !isDeletedSchedule(schedule) && schedule.id !== currentSchedule?.id && scheduleStartMs(schedule) && scheduleStartMs(schedule) < beforeMs)
    .map((schedule) => ({ schedule, followUp: schedule.serviceFollowUp?.songs?.[songId] || null }))
    .filter(({ followUp }) => followUp)
    .sort((a, b) => (scheduleStartMs(b.schedule) || 0) - (scheduleStartMs(a.schedule) || 0));
  const latestDecision = history.find(({ followUp }) => followUp.resolved === true || isNoteworthySongFollowUp(followUp));
  return latestDecision && latestDecision.followUp.resolved !== true ? [latestDecision] : [];
}

export function songHasPdf(song = {}) {
  return Boolean(getSongPdfUrl(song) || song.localPdfPath || song.drivePdfUrl || song.pdfUrl || song.chordsUrl);
}

export function songHasListeningLink(song = {}) {
  return Boolean(song.youtubeUrl || song.spotifyUrl || song.youtube || song.spotify);
}

function songHasLocalPdf(song = {}) {
  return Boolean(song.localPdfPath);
}

export function scoreSong(song = {}, options = {}, context = {}) {
  const usage = context.usageIndex?.usage?.get(song.id) || {};
  const scheduledIds = context.scheduledIds || new Set();
  const themes = parseThemeInput(options.theme || "");
  const primaryTheme = themes[0] || "";
  const additionalThemes = themes.slice(1);
  const normalizedPrimaryTheme = normalizeSearchText(primaryTheme);
  const normalizedAdditionalThemes = additionalThemes.map(normalizeSearchText);
  const slot = options.slot || null;
  const reasons = [];
  const warnings = [];
  let score = 20;
  const scoreDetails = {
    base: 20,
    positives: [{ points: 20, label: "Base de evaluación" }],
    warnings: [],
    penalties: [],
    rawScore: 20,
    finalScore: 20
  };
  const addPositive = (points, reason) => {
    score += points;
    scoreDetails.positives.push({ points, label: reason });
    addUniqueReason(reasons, reason);
  };
  const addPenalty = (points, reason) => {
    const value = Math.abs(points);
    score -= value;
    scoreDetails.penalties.push({ points: -value, label: reason });
    addUniqueReason(warnings, reason);
  };
  const addWarning = (reason) => {
    scoreDetails.warnings.push(reason);
    addUniqueReason(warnings, reason);
  };

  const mainTheme = normalizeSearchText(song.mainTheme || "");
  const otherThemes = [...(song.otherThemes || []), ...(song.tags || [])].map((theme) => normalizeSearchText(theme));
  const fullThemeText = songThemeText(song);

  if (normalizedPrimaryTheme) {
    if (mainTheme.includes(normalizedPrimaryTheme) || fullThemeText.includes(normalizedPrimaryTheme)) {
      addPositive(25, `Tema principal coincide: ${primaryTheme}`);
    } else {
      addPenalty(10, `No coincide bien con el tema: ${primaryTheme}`);
    }
  }

  const additionalMatches = additionalThemes.filter((theme) => {
    const normalized = normalizeSearchText(theme);
    return normalized && (otherThemes.some((other) => other.includes(normalized)) || fullThemeText.includes(normalized));
  });
  additionalMatches.slice(0, 3).forEach((theme) => addPositive(10, `Tema adicional coincide: ${theme}`));

  const pdfSearchValue = options.pdfSearchQuery || (options.includePdfText ? options.theme : "");
  if (options.includePdfText && pdfSearchValue) {
    const pdfTerms = splitSearchTerms(pdfSearchValue);
    const pdfMatches = findIndexedTextMatches(song, pdfTerms);
    if (pdfMatches.length) {
      const pdfPoints = Math.min(25, pdfMatches.reduce((sum, match, index) => sum + (match.kind === "exact" ? (index === 0 ? 15 : 5) : 3), 0));
      addPositive(pdfPoints, `Coincidencia combinada en letra/PDF: ${pdfMatches.length} de ${pdfTerms.length} término(s)`);
      scoreDetails.pdfMatch = pdfMatches[0];
      scoreDetails.pdfMatches = pdfMatches;
    } else if (!songIndexedText(song)) {
      addWarning("Sin texto indexado de PDF para comparar");
    }
  }

  if (slot) {
    const slotWords = slotThemes[slot.intent] || slotThemes[slot.id] || [];
    if (hasThemeMatch(song, slotWords)) {
      addPositive(14, `Encaja con ${slot.role}`);
    } else {
      addPenalty(6, `Encaja poco con ${slot.role}`);
    }
    if (slot.id === "apertura") {
      if (isHymn(song)) {
        addPositive(12, "Buen himno para abrir");
      }
      if (hasThemeMatch(song, ["gloria", "alabanza", "señorío", "gratitud"])) addPositive(8, "Tema fuerte para apertura");
      if (hasThemeMatch(song, ["reflexión", "dolor", "quebrantamiento"])) {
        addPenalty(8, "Puede sentirse muy reflexivo para apertura");
      }
    }
    if (slot.id === "antes_predicacion" && hasThemeMatch(song, ["palabra", "enseñanza", "entrega", "fe", "oración"])) {
      addPositive(10, "Prepara bien la predicación");
    }
    if (slot.id === "despues_predicacion") {
      if (hasThemeMatch(song, ["respuesta", "entrega", "oración", "cruz", "gracia", "consagración", "reflexión"])) {
        addPositive(14, "Funciona como respuesta después de la predicación");
      }
      if (hasThemeMatch(song, ["apertura", "fiesta", "celebración"])) {
        addPenalty(10, "Suena más a apertura que a respuesta");
      }
    }
  }

  if (options.category && normalizeSearchText(song.category) === normalizeSearchText(options.category)) {
    addPositive(12, `Categoría adecuada: ${song.category}`);
  } else if (options.category) {
    const targetCategory = normalizeSearchText(options.category);
    const candidateCategory = normalizeSearchText(song.category || "");
    const targetIsHymn = targetCategory.includes("himno");
    const candidateIsHymn = isHymn(song);
    const targetIsChristmas = targetCategory.includes("navidad");
    const candidateIsChristmas = candidateCategory.includes("navidad");
    if (targetIsHymn && !candidateIsHymn) {
      addPenalty(candidateIsChristmas ? 28 : 14, "No conserva la categoría de himno");
    } else if (!targetIsChristmas && candidateIsChristmas) {
      addPenalty(32, "Navidad no es una sustitución natural para esta categoría");
    } else if (targetCategory && candidateCategory && targetCategory !== candidateCategory) {
      addPenalty(8, `Categoría distinta: ${song.category || "sin categoría"}`);
    }
  }
  if (song.keynoteReviewStatus === "completado") {
    addPositive(15, "Keynote listo");
  } else if (options.onlyKeynoteReady) {
    addPenalty(100, "Keynote pendiente");
  } else {
    addPenalty(8, "Keynote pendiente");
  }
  if (songHasPdf(song)) {
    addPositive(10, "PDF listo");
  } else {
    addPenalty(10, "Falta PDF o ruta");
  }
  if (songHasLocalPdf(song)) {
    addPositive(5, "PDF local listo");
  } else {
    addPenalty(4, "Falta PDF local");
  }
  if (song.pdfReviewStatus === "completado") {
    addPositive(6, "Revisión PDF lista");
  } else {
    addPenalty(5, "Falta revisión PDF");
  }
  if (!usage.lastUsedAt) {
    addPositive(10, "Sin historial reciente");
  } else {
    const daysSince = Number.isFinite(usage.lastUsedDays)
      ? usage.lastUsedDays
      : Math.floor((Date.now() - new Date(`${usage.lastUsedAt}T00:00:00`).getTime()) / dayMs);
    if (daysSince > recentWindowDays) {
      addPositive(10, `Sin uso reciente: hace ${daysSince} dias`);
    } else if (daysSince <= recentStrongDays && options.avoidRecent) {
      addPenalty(15, `Se uso hace ${daysSince} dias`);
    } else if (daysSince <= recentWindowDays && options.avoidRecent) {
      addPenalty(7, `Uso reciente: hace ${daysSince} dias`);
    }
  }
  const recentUses = usage.recent30Count ?? usage.monthCount ?? 0;
  if (recentUses <= 1) {
    addPositive(8, "Poco usado");
  } else if (recentUses === 3) {
    addPenalty(8, "Usado 3 veces en los ultimos 30 dias");
  } else if (recentUses >= 4) {
    addPenalty(12, "Muy usado en los ultimos 30 dias");
  }
  if (options.preferredKey) {
    const distance = keyDistance(song.keyWithCapo || song.mainKey, options.preferredKey);
    if (distance !== null && distance <= 2) {
      addPositive(5, "Tonalidad cercana a la preferida");
    } else if (distance !== null && distance >= 5) {
      addWarning("Tonalidad lejana a la preferida");
    }
  }
  if (usage.usedInPreviousService) {
    addPenalty(20, "Se usó en el servicio anterior");
  }
  if (usage.lastFollowUp?.result === "no-funciono") {
    addPenalty(6, "Nota anterior: no funcionó bien");
  } else if (usage.lastFollowUp?.result === "regular") {
    addWarning("Nota anterior: funcionó regular");
  } else if (usage.lastFollowUp?.result === "bien") {
    addWarning("Nota anterior: funcionó bien");
  }
  if (usage.lastFollowUp?.keyComfort === "alta") addWarning("Observación previa: tono alto para la congregación");
  if (usage.lastFollowUp?.keyComfort === "baja") addWarning("Observación previa: tono bajo para la congregación");
  if (usage.lastFollowUp?.resourceIssues) addWarning("Observación previa: revisar PDF/Keynote");
  if (usage.lastFollowUp?.notes) addWarning(`Nota pendiente del uso anterior: ${String(usage.lastFollowUp.notes).slice(0, 120)}`);
  if (scheduledIds.has(song.id)) {
    addPenalty(10, "Ya aparece en la programación seleccionada");
  }
  if (!song.mainKey && !song.keyWithCapo) {
    addPenalty(10, "Falta tono definido");
  }
  if (!song.mainTheme) {
    addPenalty(8, "Falta tema principal");
  }
  if (options.includeHymns === false && isHymn(song)) {
    addPenalty(20, "Es himno y el filtro lo evita");
  }

  const total = clampScore(score);
  scoreDetails.rawScore = score;
  scoreDetails.finalScore = total;
  const daysSince = usage.lastUsedAt
    ? (Number.isFinite(usage.lastUsedDays)
        ? usage.lastUsedDays
        : Math.floor((Date.now() - new Date(`${usage.lastUsedAt}T00:00:00`).getTime()) / dayMs))
    : null;
  const usageForDisplay = {
    ...usage,
    recent30Count: recentUses,
    lastUsedDays: daysSince
  };
  return {
    song,
    score: total,
    label: total >= 90 ? "Muy recomendado" : total >= 80 ? "Recomendado" : total >= 65 ? "Útil" : total >= 50 ? "Con reservas" : "Poco conveniente",
    reasons: reasons.slice(0, 6),
    warnings: warnings.slice(0, 5),
    scoreDetails,
    usage: usageForDisplay,
    usageSummary: {
      recent: daysSince === null ? "Sin historial reciente" : `Uso reciente: hace ${daysSince} dias`,
      monthly: `Uso mensual: ${pluralizeUse(recentUses)} en los ultimos 30 dias`,
      lastUse: describeLastUse(usageForDisplay),
      rotationImpact: describeRecentImpact(usageForDisplay)
    },
    slot
  };
}

export function getSongRecommendations(songs = [], schedules = [], options = {}) {
  const usageIndex = options.usageIndex || buildUsageIndex(schedules, new Date(), {
    currentSchedule: options.currentSchedule,
    excludeScheduleId: options.currentSchedule?.id,
    beforeDateTime: options.currentSchedule ? getScheduleStartDate(options.currentSchedule)?.toISOString() : options.beforeDateTime
  });
  const scheduledIds = new Set((options.currentSchedule?.songs || []).map((entry) => entry.songId).filter(Boolean));
  return songs
    .filter((song) => song?.id && !song.deleted)
    .map((song) => scoreSong(song, options, { usageIndex, scheduledIds }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.song.title || "").localeCompare(b.song.title || "", "es"))
    .slice(0, options.limit || 20);
}

export function getSlotAlternatives(songs = [], schedules = [], options = {}, slot = {}, selectedIds = new Set()) {
  return getSongRecommendations(songs, schedules, {
    ...options,
    slot,
    limit: 30
  }).filter((item) => !selectedIds.has(item.song.id));
}

export function createSuggestedServiceBlock(songs = [], schedules = [], options = {}) {
  const serviceType = options.serviceType || inferSmartServiceType(options.currentSchedule || {});
  const fallbackThemes = serviceDefaults[serviceType]?.preferredThemeFallbacks || serviceDefaults["Servicio especial"].preferredThemeFallbacks;
  const detectedPdfThemes = !parseThemeInput(options.theme).length && options.includePdfText && options.pdfSearchQuery
    ? inferThemesFromPdfMatches(songs, options.pdfSearchQuery)
    : [];
  const themeValue = parseThemeInput(options.theme).length
    ? options.theme
    : detectedPdfThemes.length
      ? detectedPdfThemes.join(", ")
    : options.allowThemeFallback === false
      ? ""
      : fallbackThemes.slice(0, 2).join(", ");
  const slots = getServiceSlots(serviceType, options.count);
  const selected = [];
  const selectedIds = new Set();
  const usedKeys = new Map();
  const usageIndex = options.usageIndex || buildUsageIndex(schedules, options.referenceDate || new Date(), {
    currentSchedule: options.currentSchedule,
    excludeScheduleId: options.currentSchedule?.id,
    beforeDateTime: options.currentSchedule ? getScheduleStartDate(options.currentSchedule)?.toISOString() : options.beforeDateTime
  });
  const seed = Number(options.seed || 0);
  let completedWithFallback = false;

  slots.forEach((slot, slotIndex) => {
    const alternatives = getSlotAlternatives(songs, schedules, {
      ...options,
      theme: themeValue,
      serviceType,
      usageIndex,
      limit: 40
    }, slot, selectedIds).map((item) => {
      const key = item.song.keyWithCapo || item.song.mainKey || "";
      const keyPenalty = key && usedKeys.get(key) ? -5 : 0;
      if (!keyPenalty) return item;
      const nextScore = clampScore(item.score + keyPenalty);
      return {
        ...item,
        score: nextScore,
        warnings: [...(item.warnings || []), "Repite tonalidad dentro del bloque"],
        scoreDetails: {
          ...(item.scoreDetails || {}),
          penalties: [...(item.scoreDetails?.penalties || []), { points: keyPenalty, label: "Repite tonalidad dentro del bloque" }],
          rawScore: (item.scoreDetails?.rawScore ?? item.score) + keyPenalty,
          finalScore: nextScore
        }
      };
    }).sort((a, b) => b.score - a.score || (a.song.title || "").localeCompare(b.song.title || "", "es"));

    const chosen = alternatives[(seed + slotIndex) % Math.max(1, Math.min(3, alternatives.length))] || alternatives[0];
    if (chosen) {
      selectedIds.add(chosen.song.id);
      const key = chosen.song.keyWithCapo || chosen.song.mainKey || "";
      if (key) usedKeys.set(key, (usedKeys.get(key) || 0) + 1);
      selected.push({ ...chosen, role: slot.role, slot, energy: slot.intent });
    } else {
      completedWithFallback = true;
    }
  });

  const allKeynoteReady = selected.every((item) => item.song.keynoteReviewStatus === "completado");
  const usedThemeText = parseThemeInput(themeValue).join(", ");
  return {
    serviceType,
    theme: usedThemeText,
    slots,
    items: selected,
    score: selected.length ? clampScore(selected.reduce((sum, item) => sum + item.score, 0) / selected.length) : 0,
    reasons: [
      `Estructura para ${serviceType}`,
      serviceType === "Servicio especial"
        ? "Las posiciones pueden ajustarse al editar el programa especial"
        : "Solo un canto después de predicación",
      options.includeHymns ? "Puede abrir con himno si conviene" : "Prioriza cantos no himnos",
      allKeynoteReady ? "Todos tienen Keynote listo" : "Revisa cantos con Keynote pendiente",
      completedWithFallback
        ? "No hubo suficientes cantos para todas las posiciones"
        : detectedPdfThemes.length
          ? `Temas sugeridos desde la letra: ${detectedPdfThemes.join(", ")}`
        : usedThemeText
          ? `Tema trabajado: ${usedThemeText}`
          : options.pdfSearchQuery
            ? `Busqueda en letra/PDF: ${options.pdfSearchQuery}`
            : "Bloque basado en preparacion y rotacion"
    ]
  };
}

export function getReplacementCandidates(currentSong = {}, songs = [], schedules = [], selectedSchedule = {}, slot = null) {
  const scheduledIds = new Set((selectedSchedule?.songs || []).map((entry) => entry.songId).filter(Boolean));
  const candidates = getSongRecommendations(songs, schedules, {
    theme: [currentSong.mainTheme, ...(currentSong.otherThemes || [])].filter(Boolean).join(", "),
    category: currentSong.category,
    preferredKey: currentSong.keyWithCapo || currentSong.mainKey,
    avoidRecent: true,
    includeHymns: true,
    limit: 60,
    slot,
    currentSchedule: selectedSchedule
  }).filter((item) => item.song.id !== currentSong.id && !scheduledIds.has(item.song.id));
  const currentIsHymn = isHymn(currentSong);
  const currentIsChristmas = isChristmasCategory(currentSong);
  const categoryAware = candidates.filter((item) => {
    if (!currentIsChristmas && isChristmasCategory(item.song)) return item.score >= 88;
    return true;
  });
  if (!currentIsHymn) return categoryAware.slice(0, 20);
  const hymnCandidates = categoryAware.filter((item) => isHymn(item.song)).slice(0, 2);
  const seen = new Set(hymnCandidates.map((item) => item.song.id));
  return [...hymnCandidates, ...categoryAware.filter((item) => !seen.has(item.song.id))].slice(0, 20);
}

export function reviewServiceSchedule(schedule = {}, songs = [], schedules = []) {
  const mode = getScheduleReviewMode(schedule);
  if ((mode === "past" || mode === "closed") && schedule.serviceReviewSnapshot?.readinessPercent !== undefined) {
    return {
      score: clampScore(schedule.serviceReviewSnapshot.readinessPercent),
      status: schedule.serviceReviewSnapshot.status || schedule.serviceReviewSnapshot.riskLevel || "Revisión guardada",
      mode,
      snapshot: true,
      subtitle: "Estado al cierre del servicio",
      alerts: schedule.serviceReviewSnapshot.alerts || [],
      groups: schedule.serviceReviewSnapshot.groups || []
    };
  }
  const songById = new Map(songs.map((song) => [song.id, song]));
  const entries = schedule?.songs || [];
  const alerts = [];
  const groups = {
    links: { title: "Faltan enlaces", severity: "warning", items: [] },
    listening: { title: "Enlaces de escucha", severity: "info", items: [] },
    files: { title: "Faltan archivos", severity: "warning", items: [] },
    reviews: { title: "Faltan revisiones", severity: "important", items: [] },
    musicData: { title: "Datos musicales incompletos", severity: "warning", items: [] },
    rotation: { title: "Rotación", severity: "info", items: [] }
  };
  let score = 100;
  const themes = new Map();
  const usageIndex = buildUsageIndex(schedules.length ? schedules : [schedule], new Date(), {
    currentSchedule: schedule,
    excludeScheduleId: schedule.id,
    beforeDateTime: getScheduleStartDate(schedule)?.toISOString()
  });
  const previousRealService = getPreviousRealService(schedule, schedules.length ? schedules : [schedule]);

  entries.forEach((entry) => {
    const song = songById.get(entry.songId) || entry;
    const title = song.title || entry.titleSnapshot || "Canto";
    if (song.keynoteReviewStatus !== "completado") {
      score -= 10;
      alerts.push({ severity: "important", title: "Keynote pendiente", message: `${title} no tiene Keynote completado.` });
      groups.reviews.items.push(`${title}: Keynote pendiente`);
    }
    if (song.pdfReviewStatus !== "completado") {
      score -= 5;
      groups.reviews.items.push(`${title}: revisión PDF pendiente`);
    }
    if (!songHasPdf(song) && !entry.pdfUrl) {
      score -= 8;
      alerts.push({ severity: "warning", title: "PDF faltante", message: `${title} no tiene PDF o ruta local disponible.` });
      groups.links.items.push(`${title}: sin PDF de Drive o acordes`);
      groups.files.items.push(`${title}: sin ruta PDF local`);
    } else {
      if (!(song.drivePdfUrl || song.pdfUrl || song.chordsUrl || entry.pdfUrl)) groups.links.items.push(`${title}: sin PDF de Drive`);
      if (!song.localPdfPath) groups.files.items.push(`${title}: sin ruta PDF local`);
    }
    if (!song.mainKey && !song.keyWithCapo && !entry.keySnapshot) {
      score -= 7;
      alerts.push({ severity: "warning", title: "Tono faltante", message: `${title} no tiene tono definido.` });
      groups.musicData.items.push(`${title}: sin tono`);
    }
    if (!song.mainTheme) {
      score -= 4;
      groups.musicData.items.push(`${title}: sin tema principal`);
    }
    if (!song.youtubeUrl && !song.youtube) groups.listening.items.push(`${title}: sin YouTube`);
    if (!song.spotifyUrl && !song.spotify) groups.listening.items.push(`${title}: sin Spotify`);
    const usage = usageIndex.usage.get(entry.songId);
    if (usage?.usedInPreviousService) {
      score -= 8;
      groups.rotation.items.push(`${title}: usado en el servicio anterior (${previousRealService ? formatScheduleDateWithService(previousRealService) : "servicio previo"})`);
    } else if (usage?.lastUsedAt && (usage.lastUsedDays ?? 999) <= recentStrongDays) {
      score -= 6;
      groups.rotation.items.push(`${title}: ${describeLastUse(usage)}. Impacto: penalizacion fuerte por uso reciente.`);
    } else if (usage?.lastUsedAt && (usage.lastUsedDays ?? 999) <= recentWindowDays) {
      score -= 3;
      groups.rotation.items.push(`${title}: ${describeLastUse(usage)}. Impacto: penalizacion moderada por rotacion.`);
    }
    if ((usage?.recent30Count || usage?.monthCount || 0) >= 3) {
      score -= 5;
      groups.rotation.items.push(`${title}: muy usado en los últimos 30 días`);
    }
    const theme = song.mainTheme || "Sin tema";
    themes.set(theme, (themes.get(theme) || 0) + 1);
  });

  if (entries.length < 3) {
    score -= 10;
    alerts.push({ severity: "warning", title: "Pocos cantos", message: "La programación tiene menos de 3 cantos." });
  }
  if (entries.length > 6) {
    score -= 8;
    alerts.push({ severity: "info", title: "Servicio largo", message: "La programación tiene más de 6 cantos." });
  }
  [...themes.entries()].forEach(([theme, count]) => {
    if (theme !== "Sin tema" && count >= Math.max(3, Math.ceil(entries.length * 0.75))) {
      score -= 8;
      alerts.push({ severity: "info", title: "Tema muy repetido", message: `Hay ${count} cantos del tema ${theme}.` });
      groups.rotation.items.push(`${count} cantos del tema ${theme}`);
    }
  });
  if (!alerts.some((alert) => alert.title === "Tono faltante")) {
    alerts.push({ severity: "success", title: "Tonos completos", message: "Todos los cantos tienen tono definido." });
  }

  const finalScore = clampScore(score);
  return {
    score: finalScore,
    status: finalScore >= 90 ? "Listo" : finalScore >= 70 ? "Casi listo" : finalScore >= 50 ? "Revisar" : "Riesgo alto",
    mode,
    snapshot: false,
    subtitle: mode === "past" ? "Estimación basada en datos actuales" : "Revisión actual",
    previousService: previousRealService ? {
      id: previousRealService.id || "",
      label: formatScheduleDateWithService(previousRealService),
      date: previousRealService.date || "",
      time: previousRealService.time || ""
    } : null,
    alerts,
    groups: Object.values(groups).filter((group) => group.items.length)
  };
}

export function createServiceReviewSnapshot(review = {}, schedule = {}, songs = []) {
  const countItems = (title) => (review.groups || []).find((group) => group.title === title)?.items || [];
  const songById = new Map(songs.map((song) => [song.id, song]));
  return {
    readinessPercent: clampScore(review.score),
    status: review.status || "",
    riskLevel: review.status || "",
    checkedAt: new Date().toISOString(),
    scheduleId: schedule.id || "",
    scheduleLabel: formatScheduleDateWithService(schedule),
    missingKeynote: countItems("Faltan revisiones").filter((item) => normalizeSearchText(item).includes("keynote")).length,
    missingPdfReview: countItems("Faltan revisiones").filter((item) => normalizeSearchText(item).includes("pdf")).length,
    missingPdfDrive: countItems("Faltan enlaces").length,
    missingLocalPdf: countItems("Faltan archivos").length,
    missingTone: countItems("Datos musicales incompletos").filter((item) => normalizeSearchText(item).includes("tono")).length,
    missingTheme: countItems("Datos musicales incompletos").filter((item) => normalizeSearchText(item).includes("tema")).length,
    informationalMissingYoutube: countItems("Enlaces de escucha").filter((item) => normalizeSearchText(item).includes("youtube")).length,
    informationalMissingSpotify: countItems("Enlaces de escucha").filter((item) => normalizeSearchText(item).includes("spotify")).length,
    repeatedSongsWarnings: countItems("Rotaci贸n").concat(countItems("Rotacion")),
    alerts: review.alerts || [],
    groups: review.groups || [],
    notes: "",
    songIssues: (schedule.songs || []).map((entry) => {
      const song = songById.get(entry.songId) || entry;
      return {
        songId: entry.songId || "",
        title: song.title || entry.titleSnapshot || "Canto",
        keynotePending: song.keynoteReviewStatus !== "completado",
        pdfReviewPending: song.pdfReviewStatus !== "completado",
        missingPdf: !songHasPdf(song) && !entry.pdfUrl,
        missingLocalPdf: !song.localPdfPath,
        missingTone: !song.mainKey && !song.keyWithCapo && !entry.keySnapshot,
        missingTheme: !song.mainTheme
      };
    })
  };
}
