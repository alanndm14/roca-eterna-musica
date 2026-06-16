import { normalizeSearchText } from "./songUtils";
import { buildUsageIndex, songHasListeningLink, songHasPdf } from "./songScoring";
import { isCountableSchedule } from "./dateUtils";

const currentMonth = () => new Date().toISOString().slice(0, 7);

export function getPreparationGaps(songs = []) {
  const total = Math.max(1, songs.length);
  const gapDefinitions = [
    { key: "youtube", label: "Sin YouTube", priority: "media", test: (song) => !(song.youtubeUrl || song.youtube) },
    { key: "spotify", label: "Sin Spotify", priority: "media", test: (song) => !(song.spotifyUrl || song.spotify) },
    { key: "drive", label: "Sin PDF Drive", priority: "alta", test: (song) => !(song.drivePdfUrl || song.pdfUrl) },
    { key: "localPdf", label: "Sin PDF local", priority: "alta", test: (song) => !song.localPdfPath },
    { key: "keynote", label: "Sin Keynote", priority: "alta", test: (song) => song.keynoteReviewStatus !== "completado" },
    { key: "key", label: "Sin tono", priority: "alta", test: (song) => !(song.mainKey || song.keyWithCapo) },
    { key: "theme", label: "Sin tema", priority: "media", test: (song) => !song.mainTheme },
    { key: "ocr", label: "OCR pendiente", priority: "baja", test: (song) => ["missing", "no_text", "error", "pending"].includes(song.pdfIndexStatus || "") }
  ];

  return gapDefinitions.map((definition) => {
    const items = songs.filter(definition.test);
    return {
      ...definition,
      count: items.length,
      percent: Math.round((items.length / total) * 100),
      items
    };
  });
}

export function getRepertoireInsights(songs = [], schedules = []) {
  const usageIndex = buildUsageIndex(schedules);
  const month = currentMonth();
  const themeCounts = new Map();
  const categoryCounts = new Map();
  schedules
    .filter((schedule) => isCountableSchedule(schedule) && String(schedule.date || "").startsWith(month))
    .forEach((schedule) => (schedule.songs || []).forEach((entry) => {
      const song = songs.find((item) => item.id === entry.songId);
      if (!song) return;
      const theme = song.mainTheme || "Sin tema";
      const category = song.category || "Sin categoría";
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }));

  const readyForgotten = songs.filter((song) => song.keynoteReviewStatus === "completado" && !(usageIndex.usage.get(song.id)?.lastUsedAt));
  const hymnsReady = songs.filter((song) => normalizeSearchText(song.category).includes("himno") && song.keynoteReviewStatus === "completado");
  const missingYoutube = songs.filter((song) => !songHasListeningLink(song));
  const missingPdf = songs.filter((song) => !songHasPdf(song));
  const seasonalChristmas = songs.filter((song) => [song.category, song.mainTheme, ...(song.otherThemes || [])].some((value) => normalizeSearchText(value).includes("navidad")));
  const overused = songs.filter((song) => (usageIndex.usage.get(song.id)?.monthCount || 0) >= 3);
  const topTheme = [...themeCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    topTheme ? {
      severity: "informativo",
      title: "Tema dominante este mes",
      message: `Este mes se usaron principalmente cantos de ${topTheme[0]}.`,
      action: "Ver balance"
    } : {
      severity: "informativo",
      title: "Sin datos este mes",
      message: "Todavía no hay suficientes programaciones del mes actual para detectar tendencias.",
      action: "Revisar programación"
    },
    {
      severity: "oportunidad",
      title: "Cantos listos pero olvidados",
      message: `Hay ${readyForgotten.length} cantos con Keynote listo que no aparecen en el historial reciente.`,
      action: "Sugerir para programación"
    },
    {
      severity: "oportunidad",
      title: "Himnos disponibles",
      message: `Hay ${hymnsReady.length} himnos listos que podrían retomarse.`,
      action: "Ver himnos"
    },
    {
      severity: missingYoutube.length ? "atención" : "informativo",
      title: "Enlaces de escucha",
      message: `Hay ${missingYoutube.length} cantos sin YouTube o Spotify.`,
      action: "Filtrar repertorio"
    },
    {
      severity: missingPdf.length ? "atención" : "informativo",
      title: "Documentos pendientes",
      message: `Hay ${missingPdf.length} cantos sin PDF principal o ruta local.`,
      action: "Ver pendientes"
    },
    {
      severity: overused.length ? "atención" : "informativo",
      title: "Repetición del mes",
      message: `${overused.length} cantos se han repetido demasiado este mes.`,
      action: "Balancear rotación"
    },
    {
      severity: seasonalChristmas.length ? "oportunidad" : "informativo",
      title: "Temporada disponible",
      message: `Hay ${seasonalChristmas.length} cantos de Navidad disponibles para temporada.`,
      action: "Ver temporada"
    }
  ];
}
