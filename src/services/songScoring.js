import { getSongPdfUrl, normalizeSearchText } from "./songUtils";

const dayMs = 24 * 60 * 60 * 1000;
const keyOrder = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const keyAliases = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#" };

export const smartServiceTypes = ["Domingo AM", "Domingo PM", "Miércoles de oración", "Santa Cena", "Especial", "Aniversario", "Navidad"];
export const smartEnergies = ["apertura", "congregacional fuerte", "reflexión", "cierre"];

export function toSongEntry(song = {}) {
  return {
    songId: song.id,
    titleSnapshot: song.title || "",
    keySnapshot: song.keyWithCapo || song.mainKey || "",
    pdfUrl: song.pdfPreviewUrl || song.pdfUrl || song.drivePdfUrl || song.chordsUrl || "",
    notes: ""
  };
}

export function buildUsageIndex(schedules = [], now = new Date()) {
  const usage = new Map();
  const currentMonth = now.toISOString().slice(0, 7);
  const pastSchedules = [...schedules]
    .filter((schedule) => schedule.date && new Date(`${schedule.date}T${schedule.time || "00:00"}`) <= now)
    .sort((a, b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`));
  const previousService = pastSchedules[0] || null;

  schedules.forEach((schedule) => {
    if (!schedule.date) return;
    const scheduleDate = new Date(`${schedule.date}T${schedule.time || "00:00"}`);
    const isFuture = scheduleDate > now;
    (schedule.songs || []).forEach((entry) => {
      if (!entry.songId) return;
      const current = usage.get(entry.songId) || { count: 0, monthCount: 0, lastUsedAt: "", lastSchedule: null, usedInPreviousService: false };
      if (!isFuture) {
        current.count += 1;
        if (String(schedule.date).startsWith(currentMonth)) current.monthCount += 1;
        if (!current.lastSchedule || `${schedule.date}${schedule.time || ""}` > `${current.lastSchedule.date}${current.lastSchedule.time || ""}`) {
          current.lastSchedule = schedule;
          current.lastUsedAt = schedule.date;
        }
        if (previousService?.id && schedule.id === previousService.id) current.usedInPreviousService = true;
      }
      usage.set(entry.songId, current);
    });
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

export function songHasPdf(song = {}) {
  return Boolean(getSongPdfUrl(song) || song.localPdfPath || song.drivePdfUrl || song.pdfUrl || song.chordsUrl);
}

export function songHasListeningLink(song = {}) {
  return Boolean(song.youtubeUrl || song.spotifyUrl || song.youtube || song.spotify);
}

export function scoreSong(song = {}, options = {}, context = {}) {
  const usage = context.usageIndex?.usage?.get(song.id) || {};
  const scheduledIds = context.scheduledIds || new Set();
  const reasons = [];
  const warnings = [];
  let score = 20;

  const desiredTheme = normalizeSearchText(options.theme || "");
  const mainTheme = normalizeSearchText(song.mainTheme || "");
  const otherThemes = [...(song.otherThemes || []), ...(song.tags || [])].map((theme) => normalizeSearchText(theme));
  if (desiredTheme && mainTheme.includes(desiredTheme)) {
    score += 25;
    reasons.push(`Coincide con el tema principal: ${song.mainTheme}`);
  } else if (desiredTheme && otherThemes.some((theme) => theme.includes(desiredTheme))) {
    score += 15;
    reasons.push("Coincide con temas secundarios");
  }

  if (options.category && song.category === options.category) {
    score += 15;
    reasons.push(`Categoría adecuada: ${song.category}`);
  }
  if (song.keynoteReviewStatus === "completado") {
    score += 15;
    reasons.push("Keynote listo");
  } else if (options.onlyKeynoteReady) {
    score -= 10;
    warnings.push("Keynote pendiente");
  }
  if (songHasPdf(song)) {
    score += 10;
    reasons.push("Tiene PDF o ruta disponible");
  } else {
    warnings.push("Falta PDF o ruta local");
  }
  if (songHasListeningLink(song)) {
    score += 8;
    reasons.push("Tiene enlace de escucha");
  }
  if (!usage.lastUsedAt) {
    score += 10;
    reasons.push("Sin historial reciente");
  } else {
    const daysSince = Math.floor((Date.now() - new Date(`${usage.lastUsedAt}T00:00:00`).getTime()) / dayMs);
    if (daysSince >= 30) {
      score += 10;
      reasons.push(`No se usa desde hace ${daysSince} días`);
    } else if (daysSince < 14 && options.avoidRecent) {
      score -= 15;
      warnings.push(`Se usó hace ${daysSince} días`);
    }
  }
  if ((usage.monthCount || 0) === 0) {
    score += 8;
    reasons.push("Poco usado este mes");
  }
  if (options.preferredKey) {
    const distance = keyDistance(song.keyWithCapo || song.mainKey, options.preferredKey);
    if (distance !== null && distance <= 2) {
      score += 5;
      reasons.push("Tonalidad cercana a la preferida");
    } else if (distance !== null && distance >= 5) {
      warnings.push("Tonalidad lejana a la preferida");
    }
  }
  if (usage.usedInPreviousService) {
    score -= 25;
    warnings.push("Se usó en el servicio anterior");
  }
  if (scheduledIds.has(song.id)) {
    score -= 10;
    warnings.push("Ya aparece en la programación seleccionada");
  }
  if (!song.mainKey && !song.keyWithCapo) {
    score -= 10;
    warnings.push("Falta tono definido");
  }
  if (options.includeHymns === false && normalizeSearchText(song.category) === "himno") {
    score -= 20;
    warnings.push("Es himno y el filtro lo evita");
  }
  if (options.onlyKeynoteReady && song.keynoteReviewStatus !== "completado") score -= 100;

  const total = Math.max(0, Math.min(100, Math.round(score)));
  return {
    song,
    score: total,
    label: total >= 82 ? "Muy recomendado" : total >= 62 ? "Recomendado" : "Útil con reservas",
    reasons: reasons.slice(0, 5),
    warnings: warnings.slice(0, 4),
    usage
  };
}

export function getSongRecommendations(songs = [], schedules = [], options = {}) {
  const usageIndex = buildUsageIndex(schedules);
  const scheduledIds = new Set((options.currentSchedule?.songs || []).map((entry) => entry.songId).filter(Boolean));
  return songs
    .map((song) => scoreSong(song, options, { usageIndex, scheduledIds }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.song.title || "").localeCompare(b.song.title || "", "es"))
    .slice(0, options.limit || 20);
}

export function createSuggestedServiceBlock(songs = [], schedules = [], options = {}) {
  const slots = [
    { role: "Apertura", energy: "apertura" },
    { role: "Congregacional", energy: "congregacional fuerte" },
    { role: "Enfoque", energy: options.energy || "reflexión" },
    { role: "Respuesta / cierre", energy: "cierre" }
  ].slice(0, Math.max(1, Number(options.count || 4)));
  const selected = [];
  const selectedIds = new Set();

  slots.forEach((slot) => {
    const recommendations = getSongRecommendations(songs, schedules, {
      ...options,
      energy: slot.energy,
      limit: 12
    }).filter((item) => !selectedIds.has(item.song.id));
    const next = recommendations[0];
    if (next) {
      selectedIds.add(next.song.id);
      selected.push({ ...next, role: slot.role, energy: slot.energy });
    }
  });

  const allKeynoteReady = selected.every((item) => item.song.keynoteReviewStatus === "completado");
  return {
    items: selected,
    score: selected.length ? Math.round(selected.reduce((sum, item) => sum + item.score, 0) / selected.length) : 0,
    reasons: [
      "No repite cantos dentro del bloque",
      options.includeHymns ? "Puede incluir himnos" : "Prioriza cantos no himnos",
      allKeynoteReady ? "Todos tienen Keynote listo" : "Revisa cantos con Keynote pendiente",
      "Balancea tema, preparación y rotación"
    ]
  };
}

export function getReplacementCandidates(currentSong = {}, songs = [], schedules = [], selectedSchedule = {}) {
  const scheduledIds = new Set((selectedSchedule?.songs || []).map((entry) => entry.songId).filter(Boolean));
  return getSongRecommendations(songs, schedules, {
    theme: currentSong.mainTheme,
    category: currentSong.category,
    preferredKey: currentSong.keyWithCapo || currentSong.mainKey,
    avoidRecent: true,
    includeHymns: true,
    limit: 16,
    currentSchedule: selectedSchedule
  }).filter((item) => item.song.id !== currentSong.id && !scheduledIds.has(item.song.id));
}

export function reviewServiceSchedule(schedule = {}, songs = []) {
  const songById = new Map(songs.map((song) => [song.id, song]));
  const entries = schedule?.songs || [];
  const alerts = [];
  let score = 100;
  const themes = new Map();

  entries.forEach((entry) => {
    const song = songById.get(entry.songId) || entry;
    const title = song.title || entry.titleSnapshot || "Canto";
    if (song.keynoteReviewStatus !== "completado") {
      score -= 10;
      alerts.push({ severity: "important", title: "Keynote pendiente", message: `${title} no tiene Keynote completado.` });
    }
    if (!songHasPdf(song) && !entry.pdfUrl) {
      score -= 8;
      alerts.push({ severity: "warning", title: "PDF faltante", message: `${title} no tiene PDF o ruta local disponible.` });
    }
    if (!song.mainKey && !song.keyWithCapo && !entry.keySnapshot) {
      score -= 7;
      alerts.push({ severity: "warning", title: "Tono faltante", message: `${title} no tiene tono definido.` });
    }
    if (!songHasListeningLink(song)) {
      alerts.push({ severity: "info", title: "Sin enlace de escucha", message: `${title} no tiene YouTube o Spotify.` });
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
    }
  });
  if (!alerts.some((alert) => alert.title === "Tono faltante")) {
    alerts.push({ severity: "success", title: "Tonos completos", message: "Todos los cantos tienen tono definido." });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    status: finalScore >= 88 ? "Listo" : finalScore >= 72 ? "Casi listo" : finalScore >= 50 ? "Revisar antes del servicio" : "Riesgo alto",
    alerts
  };
}
