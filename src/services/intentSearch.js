import { normalizeSearchText } from "./songUtils";
import { songHasListeningLink, songHasPdf } from "./songScoring";

const knownThemes = ["adoración", "cruz", "gloria", "evangelismo", "esperanza", "oración", "señorío", "navidad", "santa cena", "gratitud"];
const knownKeys = ["C", "D", "E", "F", "G", "A", "B", "Bb", "Eb", "Ab", "Db", "F#", "C#"];

export function parseIntentQuery(query = "") {
  const text = normalizeSearchText(query);
  const intent = {
    raw: query,
    theme: "",
    category: "",
    keynoteReady: false,
    missingYoutube: false,
    missingSpotify: false,
    missingPdf: false,
    unused: false,
    hymn: false,
    season: "",
    key: "",
    energy: ""
  };

  knownThemes.forEach((theme) => {
    if (text.includes(normalizeSearchText(theme))) intent.theme = theme;
  });
  if (text.includes("santa cena")) {
    intent.category = "santa cena";
    intent.theme = intent.theme || "santa cena";
  }
  if (text.includes("himno")) intent.hymn = true;
  if (text.includes("navidad")) {
    intent.season = "navidad";
    intent.category = "navidad";
  }
  if (text.includes("keynote listo") || text.includes("keynote completado") || text.includes("listos")) intent.keynoteReady = true;
  if (text.includes("sin youtube")) intent.missingYoutube = true;
  if (text.includes("sin spotify")) intent.missingSpotify = true;
  if (text.includes("sin pdf") || text.includes("sin drive")) intent.missingPdf = true;
  if (text.includes("poco usado") || text.includes("no usado") || text.includes("olvidado")) intent.unused = true;
  if (text.includes("cierre")) intent.energy = "cierre";
  if (text.includes("apertura")) intent.energy = "apertura";
  if (text.includes("reflexion") || text.includes("reflexión")) intent.energy = "reflexión";

  knownKeys.forEach((key) => {
    const keyText = normalizeSearchText(key);
    if (new RegExp(`(^| )tono ${keyText}( |$)`).test(text) || new RegExp(`(^| )en ${keyText}( |$)`).test(text)) intent.key = key;
  });

  return intent;
}

export function searchSongsByIntent(query = "", songs = [], usageIndex = null) {
  const intent = parseIntentQuery(query);
  const results = songs.filter((song) => {
    const themeText = normalizeSearchText([song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].join(" "));
    if (intent.theme && !themeText.includes(normalizeSearchText(intent.theme))) return false;
    if (intent.category && normalizeSearchText(song.category) !== normalizeSearchText(intent.category)) return false;
    if (intent.hymn && !normalizeSearchText(song.category).includes("himno")) return false;
    if (intent.keynoteReady && song.keynoteReviewStatus !== "completado") return false;
    if (intent.missingYoutube && (song.youtubeUrl || song.youtube)) return false;
    if (intent.missingSpotify && (song.spotifyUrl || song.spotify)) return false;
    if (intent.missingPdf && songHasPdf(song)) return false;
    if (intent.key && song.mainKey !== intent.key && song.keyWithCapo !== intent.key) return false;
    if (intent.unused && usageIndex?.usage?.get(song.id)?.lastUsedAt) return false;
    if (intent.season && !themeText.includes(normalizeSearchText(intent.season)) && normalizeSearchText(song.category) !== normalizeSearchText(intent.season)) return false;
    return true;
  });

  const interpretation = [
    intent.theme ? `Tema: ${intent.theme}` : "",
    intent.category ? `Categoría: ${intent.category}` : "",
    intent.key ? `Tono: ${intent.key}` : "",
    intent.keynoteReady ? "Keynote listo" : "",
    intent.missingYoutube ? "Sin YouTube" : "",
    intent.missingSpotify ? "Sin Spotify" : "",
    intent.missingPdf ? "Sin PDF" : "",
    intent.unused ? "Poco usados / sin uso" : "",
    intent.energy ? `Energía: ${intent.energy}` : ""
  ].filter(Boolean);

  return {
    intent,
    interpretation: interpretation.length ? interpretation : ["Búsqueda general por texto"],
    results
  };
}
