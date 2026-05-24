import { getSongPdfUrl, normalizeSearchText } from "./songUtils";

const dayMs = 24 * 60 * 60 * 1000;
const keyOrder = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const keyAliases = { DB: "C#", EB: "D#", GB: "F#", AB: "G#", BB: "A#" };

export const smartServiceTypes = ["Domingo AM", "Domingo PM", "Miércoles de oración", "Servicio especial"];
export const smartEnergies = ["apertura", "congregacional fuerte", "reflexión", "cierre"];

export function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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
    notes: position ? `Posición sugerida: ${position}` : ""
  };
}

export function buildUsageIndex(schedules = [], now = new Date()) {
  const usage = new Map();
  const currentMonth = now.toISOString().slice(0, 7);
  const pastSchedules = [...schedules]
    .filter((schedule) => !schedule.deleted && schedule.date && new Date(`${schedule.date}T${schedule.time || "00:00"}`) <= now)
    .sort((a, b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`));
  const previousService = pastSchedules[0] || null;

  schedules.forEach((schedule) => {
    if (!schedule.date || schedule.deleted) return;
    const scheduleDate = new Date(`${schedule.date}T${schedule.time || "00:00"}`);
    const isFuture = scheduleDate > now;
    const countedInSchedule = new Set();
    (schedule.songs || []).forEach((entry) => {
      if (!entry.songId) return;
      if (countedInSchedule.has(entry.songId)) return;
      countedInSchedule.add(entry.songId);
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

function isHymn(song = {}) {
  const text = normalizeSearchText([song.category, song.mainTheme, song.title].filter(Boolean).join(" "));
  return text.includes("himno");
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

function findIndexedTextMatch(song = {}, themes = []) {
  const rawText = songIndexedText(song);
  const normalizedText = normalizeSearchText(rawText);
  const matchedTheme = themes.find((theme) => theme && normalizedText.includes(normalizeSearchText(theme)));
  if (!matchedTheme) return null;
  const words = String(rawText || "").replace(/\s+/g, " ").trim();
  const normalizedTheme = normalizeSearchText(matchedTheme);
  const normalizedWords = normalizeSearchText(words);
  const index = normalizedWords.indexOf(normalizedTheme);
  const snippet = index >= 0
    ? words.slice(Math.max(0, index - 28), Math.min(words.length, index + String(matchedTheme).length + 36)).trim()
    : String(matchedTheme);
  return { theme: matchedTheme, snippet };
}

function hasThemeMatch(song = {}, themes = []) {
  const text = songThemeText(song);
  return themes.some((theme) => text.includes(normalizeSearchText(theme)));
}

function addUniqueReason(list, reason) {
  if (reason && !list.includes(reason)) list.push(reason);
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
      addWarning(`No coincide directamente con el tema principal: ${primaryTheme}`);
    }
  }

  const additionalMatches = additionalThemes.filter((theme) => {
    const normalized = normalizeSearchText(theme);
    return normalized && (otherThemes.some((other) => other.includes(normalized)) || fullThemeText.includes(normalized));
  });
  additionalMatches.slice(0, 3).forEach((theme) => addPositive(10, `Tema adicional coincide: ${theme}`));

  if (options.includePdfText) {
    const pdfMatch = findIndexedTextMatch(song, themes);
    if (pdfMatch) {
      addPositive(pdfMatch.theme === primaryTheme ? 10 : 6, `Coincidencia en letra/PDF: "${pdfMatch.snippet}"`);
    } else if (!songIndexedText(song)) {
      addWarning("Sin texto indexado de PDF para comparar");
    }
  }

  if (slot) {
    const slotWords = slotThemes[slot.intent] || slotThemes[slot.id] || [];
    if (hasThemeMatch(song, slotWords)) {
      addPositive(14, `Encaja con ${slot.role}`);
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
  }
  if (song.keynoteReviewStatus === "completado") {
    addPositive(15, "Keynote listo");
  } else if (options.onlyKeynoteReady) {
    addPenalty(100, "Keynote pendiente");
  } else {
    addPenalty(4, "Keynote pendiente");
  }
  if (songHasPdf(song)) {
    addPositive(10, "Tiene PDF o ruta disponible");
  } else {
    addPenalty(5, "Falta PDF o ruta local");
  }
  if (!usage.lastUsedAt) {
    addPositive(10, "Sin historial reciente");
  } else {
    const daysSince = Math.floor((Date.now() - new Date(`${usage.lastUsedAt}T00:00:00`).getTime()) / dayMs);
    if (daysSince >= 30) {
      addPositive(10, `No se usa desde hace ${daysSince} días`);
    } else if (daysSince < 14 && options.avoidRecent) {
      addPenalty(15, `Se usó hace ${daysSince} días`);
    }
  }
  if ((usage.monthCount || 0) === 0) {
    addPositive(8, "Poco usado este mes");
  } else if ((usage.monthCount || 0) >= 2) {
    addPenalty(8, "Ya se usó varias veces este mes");
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
    addPenalty(25, "Se usó en el servicio anterior");
  }
  if (scheduledIds.has(song.id)) {
    addPenalty(10, "Ya aparece en la programación seleccionada");
  }
  if (!song.mainKey && !song.keyWithCapo) {
    addPenalty(10, "Falta tono definido");
  }
  if (options.includeHymns === false && isHymn(song)) {
    addPenalty(20, "Es himno y el filtro lo evita");
  }

  const total = clampScore(score);
  scoreDetails.rawScore = score;
  scoreDetails.finalScore = total;
  return {
    song,
    score: total,
    label: total >= 82 ? "Muy recomendado" : total >= 62 ? "Recomendado" : "Útil con reservas",
    reasons: reasons.slice(0, 6),
    warnings: warnings.slice(0, 5),
    scoreDetails,
    usage,
    slot
  };
}

export function getSongRecommendations(songs = [], schedules = [], options = {}) {
  const usageIndex = options.usageIndex || buildUsageIndex(schedules);
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
  const themeValue = parseThemeInput(options.theme).length ? options.theme : fallbackThemes.slice(0, 2).join(", ");
  const slots = getServiceSlots(serviceType, options.count);
  const selected = [];
  const selectedIds = new Set();
  const usedKeys = new Map();
  const usageIndex = buildUsageIndex(schedules);
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
      "Solo un canto después de predicación",
      options.includeHymns ? "Puede abrir con himno si conviene" : "Prioriza cantos no himnos",
      allKeynoteReady ? "Todos tienen Keynote listo" : "Revisa cantos con Keynote pendiente",
      completedWithFallback ? "No hubo suficientes cantos para todas las posiciones" : `Tema trabajado: ${usedThemeText}`
    ]
  };
}

export function getReplacementCandidates(currentSong = {}, songs = [], schedules = [], selectedSchedule = {}, slot = null) {
  const scheduledIds = new Set((selectedSchedule?.songs || []).map((entry) => entry.songId).filter(Boolean));
  return getSongRecommendations(songs, schedules, {
    theme: [currentSong.mainTheme, ...(currentSong.otherThemes || [])].filter(Boolean).join(", "),
    category: currentSong.category,
    preferredKey: currentSong.keyWithCapo || currentSong.mainKey,
    avoidRecent: true,
    includeHymns: true,
    limit: 20,
    slot,
    currentSchedule: selectedSchedule
  }).filter((item) => item.song.id !== currentSong.id && !scheduledIds.has(item.song.id));
}

export function reviewServiceSchedule(schedule = {}, songs = [], schedules = []) {
  const songById = new Map(songs.map((song) => [song.id, song]));
  const entries = schedule?.songs || [];
  const alerts = [];
  const groups = {
    links: { title: "Faltan enlaces", severity: "warning", items: [] },
    files: { title: "Faltan archivos", severity: "warning", items: [] },
    reviews: { title: "Faltan revisiones", severity: "important", items: [] },
    musicData: { title: "Datos musicales incompletos", severity: "warning", items: [] },
    rotation: { title: "Rotación", severity: "info", items: [] }
  };
  let score = 100;
  const themes = new Map();
  const usageIndex = buildUsageIndex(schedules.length ? schedules : [schedule]);

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
    if (!song.youtubeUrl) groups.links.items.push(`${title}: sin YouTube`);
    if (!song.spotifyUrl) groups.links.items.push(`${title}: sin Spotify`);
    if (!songHasListeningLink(song)) {
      alerts.push({ severity: "info", title: "Sin enlace de escucha", message: `${title} no tiene YouTube o Spotify.` });
    }
    const usage = usageIndex.usage.get(entry.songId);
    if (usage?.usedInPreviousService) {
      score -= 8;
      groups.rotation.items.push(`${title}: usado en el servicio anterior`);
    }
    if ((usage?.monthCount || 0) > 1) {
      score -= 5;
      groups.rotation.items.push(`${title}: repetido este mes`);
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
    alerts,
    groups: Object.values(groups).filter((group) => group.items.length)
  };
}
