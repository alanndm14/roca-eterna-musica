export const REVIEW_STATUSES = ["pendiente", "en revisión", "completado"];
export const SONG_FORMATS = ["texto", "imagen", "pdf", "otro"];
export const SONG_CATEGORIES = ["normal", "navidad", "himno", "especial", "santa cena", "jóvenes", "otro"];

const sharpNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flatNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const aliases = {
  "C": 0,
  "C#": 1,
  "DB": 1,
  "D": 2,
  "D#": 3,
  "EB": 3,
  "E": 4,
  "F": 5,
  "F#": 6,
  "GB": 6,
  "G": 7,
  "G#": 8,
  "AB": 8,
  "A": 9,
  "A#": 10,
  "BB": 10,
  "B": 11
};

export const BASIC_KEYS = ["", "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];

export function transposeKey(key, steps = 0, preference = "sharps") {
  if (!key) return "";
  const normalized = String(key).trim().replace("♯", "#").replace("♭", "b");
  const index = aliases[normalized.toUpperCase()];
  if (index === undefined) return normalized;
  const next = (index + Number(steps || 0) + 120) % 12;
  return preference === "flats" ? flatNotes[next] : sharpNotes[next];
}

export function calculateKeyWithCapo(mainKey, capo = 0, preference = "sharps") {
  if (!mainKey) return "";
  return transposeKey(mainKey, Number(capo || 0), preference);
}

export function normalizeDrivePdfUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  const patterns = [
    /drive\.google\.com\/file\/d\/([^/]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/,
    /drive\.google\.com\/uc\?id=([^&]+)/
  ];
  const match = patterns.map((pattern) => value.match(pattern)).find(Boolean);
  return match?.[1] ? `https://drive.google.com/file/d/${match[1]}/preview` : value;
}

export function getSongPdfUrl(song) {
  return song?.pdfPreviewUrl || normalizeDrivePdfUrl(song?.drivePdfUrl) || song?.pdfUrl || song?.chordsUrl || "";
}

export function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["si", "sí", "yes", "true", "1", "x"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return false;
}

export function normalizeReviewStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["completo", "completado", "done", "listo"].includes(normalized)) return "completado";
  if (["revision", "revisión", "en revision", "en revisión", "review"].includes(normalized)) return "en revisión";
  return "pendiente";
}

export function splitThemes(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeSong(song = {}, keyPreference = "sharps") {
  const mainTheme = song.mainTheme || song.tema || song.theme || song.tags?.[0] || "";
  const otherThemes = splitThemes(song.otherThemes || song.otros_temas || song.tags?.slice?.(1) || []);
  const tags = [...new Set([mainTheme, ...otherThemes, ...(song.tags || [])].filter(Boolean))];
  const drivePdfUrl = song.drivePdfUrl || "";
  const pdfUrl = song.pdfUrl || song.chordsUrl || "";
  const pdfPreviewUrl = song.pdfPreviewUrl || normalizeDrivePdfUrl(drivePdfUrl || pdfUrl);
  const capo = song.capo === "" || song.capo === undefined ? 0 : Number(song.capo);
  const keyWithCapo = song.keyWithCapo || calculateKeyWithCapo(song.mainKey, capo, keyPreference);

  return {
    ...song,
    title: song.title || song.nombre || "",
    artistOrSource: song.artistOrSource || song.artist || song.fuente || "",
    category: song.category || song.categoria || "normal",
    mainTheme,
    otherThemes,
    mainKey: song.mainKey || song.tonalidad || "",
    capo,
    keyWithCapo,
    hasKeyChange: normalizeBoolean(song.hasKeyChange ?? song.cambio_de_tono),
    format: song.format || song.formato || (pdfUrl || drivePdfUrl ? "pdf" : "texto"),
    pdfUrl,
    drivePdfUrl,
    pdfPreviewUrl,
    storagePdfUrl: song.storagePdfUrl || "",
    chordsUrl: song.chordsUrl || pdfUrl,
    musicReviewStatus: normalizeReviewStatus(song.musicReviewStatus || song.revision_musical),
    keynoteReviewStatus: normalizeReviewStatus(song.keynoteReviewStatus || song.revision_keynote),
    pdfReviewStatus: normalizeReviewStatus(song.pdfReviewStatus || song.revision_pdf),
    sungBefore: normalizeBoolean(song.sungBefore ?? song.cantado),
    internalNotes: song.internalNotes || song.comentario || "",
    tags,
    lyricsSections: song.lyricsSections || []
  };
}

export function collectSongThemes(songs = [], configuredThemes = []) {
  const themeSet = new Set();
  configuredThemes.filter((theme) => theme.active !== false).forEach((theme) => themeSet.add(theme.name));
  songs.forEach((song) => {
    if (song.mainTheme) themeSet.add(song.mainTheme);
    (song.otherThemes || []).forEach((theme) => themeSet.add(theme));
    (song.tags || []).forEach((theme) => themeSet.add(theme));
  });
  return [...themeSet].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
}

export function collectSongKeys(songs = []) {
  const keys = new Set();
  songs.forEach((song) => {
    if (song.mainKey) keys.add(song.mainKey);
    if (song.keyWithCapo) keys.add(song.keyWithCapo);
  });
  return [...keys].sort((a, b) => a.localeCompare(b, "es"));
}
