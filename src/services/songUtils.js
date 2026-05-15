export const REVIEW_STATUSES = ["pendiente", "en revisión", "completado"];
export const SONG_FORMATS = ["texto", "imagen", "pdf", "otro"];
export const SONG_CATEGORIES = ["normal", "navidad", "himno", "especial", "santa cena", "jóvenes", "otro"];

const sharpNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flatNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const aliases = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11
};

const canonicalThemeNames = {
  adoracion: "adoración",
  senorio: "señorío",
  redencion: "redención",
  mision: "misión",
  oracion: "oración",
  acciondegracias: "gratitud",
  agradecimiento: "gratitud"
};

export const BASIC_KEYS = ["", "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];

export function stripAccents(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function canonicalThemeKey(value = "") {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9ñ\s]/g, "")
    .replace(/\s/g, "");
}

export function normalizeThemeName(value = "") {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const key = canonicalThemeKey(clean);
  return canonicalThemeNames[key] || clean.toLowerCase();
}

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

export function resolvePublicPdfPath(path = "") {
  const value = String(path || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const base = import.meta.env.BASE_URL || "/";
  const cleanBase = base === "/" ? "/" : `/${base.replace(/^\/+|\/+$/g, "")}/`;
  let cleanPath = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const baseWithoutSlash = cleanBase.replace(/^\/+|\/+$/g, "");

  if (baseWithoutSlash && cleanPath === baseWithoutSlash) return cleanBase;
  if (baseWithoutSlash && cleanPath.startsWith(`${baseWithoutSlash}/`)) {
    cleanPath = cleanPath.slice(baseWithoutSlash.length + 1);
  }

  return `${cleanBase}${cleanPath}`.replace(/\/{2,}/g, "/");
}

export function resolvePublicAssetPath(path = "") {
  return resolvePublicPdfPath(path);
}

export function getInstitutionalLogo(settings = {}, fallback = "") {
  return settings.logoUrl || resolvePublicAssetPath(settings.logoLocalPath || "") || fallback;
}

export function getSongPdfUrl(song) {
  return song?.pdfPreviewUrl || normalizeDrivePdfUrl(song?.drivePdfUrl) || song?.pdfUrl || song?.chordsUrl || resolvePublicPdfPath(song?.localPdfPath) || song?.storagePdfUrl || "";
}

export function getSongPreviewUrl(song) {
  return song?.pdfPreviewUrl || normalizeDrivePdfUrl(song?.drivePdfUrl || song?.pdfUrl || song?.chordsUrl) || resolvePublicPdfPath(song?.localPdfPath) || song?.storagePdfUrl || "";
}

export function getSongYoutubeUrl(song) {
  return song?.youtubeUrl || song?.youTubeUrl || "";
}

export function getSongSpotifyUrl(song) {
  return song?.spotifyUrl || song?.spotify || "";
}

export function getSongExternalChordsUrl(song) {
  const explicit = song?.externalChordsUrl || song?.chordsExternalUrl || "";
  if (explicit) return explicit;
  const hasSeparatePdf = Boolean(song?.pdfUrl || song?.drivePdfUrl || song?.pdfPreviewUrl || song?.localPdfPath || song?.storagePdfUrl);
  return hasSeparatePdf ? song?.chordsUrl || "" : "";
}

export function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = stripAccents(value).trim().toLowerCase();
  if (["si", "yes", "true", "1", "x", "cantado"].includes(normalized)) return true;
  if (["no", "false", "0", "pendiente", ""].includes(normalized)) return false;
  return false;
}

export function normalizeReviewStatus(value) {
  const normalized = stripAccents(value).trim().toLowerCase();
  if (["completo", "completado", "done", "listo", "terminado"].includes(normalized)) return "completado";
  if (["revision", "en revision", "review", "revisando"].includes(normalized)) return "en revisión";
  return "pendiente";
}

export function splitThemes(value) {
  if (Array.isArray(value)) return value.map(normalizeThemeName).filter(Boolean);
  return String(value || "")
    .split(/[;,]/)
    .map(normalizeThemeName)
    .filter(Boolean);
}

export function normalizeSong(song = {}, keyPreference = "sharps") {
  const mainTheme = normalizeThemeName(song.mainTheme || song.tema || song.theme || song.tags?.[0] || "");
  const otherThemes = splitThemes(song.otherThemes || song.otros_temas || song.tags?.slice?.(1) || []);
  const tags = [...new Set([mainTheme, ...otherThemes, ...(song.tags || []).map(normalizeThemeName)].filter(Boolean))];
  const drivePdfUrl = song.drivePdfUrl || "";
  const chordsAsPdfFallback = song.externalChordsUrl || song.chordsExternalUrl ? "" : song.chordsUrl || "";
  const pdfUrl = song.pdfUrl || chordsAsPdfFallback || "";
  const pdfPreviewUrl = song.pdfPreviewUrl || normalizeDrivePdfUrl(drivePdfUrl || pdfUrl);
  const capoNumber = song.capo === "" || song.capo === undefined ? 0 : Number(song.capo);
  const capo = Number.isFinite(capoNumber) ? Math.min(Math.max(capoNumber, 0), 12) : 0;
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
    localPdfPath: song.localPdfPath || song.local_pdf_path || "",
    storagePdfUrl: song.storagePdfUrl || "",
    chordsUrl: song.chordsUrl || pdfUrl,
    externalChordsUrl: song.externalChordsUrl || song.chordsExternalUrl || "",
    youtubeUrl: song.youtubeUrl || song.youTubeUrl || "",
    spotifyUrl: song.spotifyUrl || song.spotify || "",
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
  const byKey = new Map();
  configuredThemes
    .filter((theme) => theme.active !== false)
    .forEach((theme) => {
      const name = normalizeThemeName(theme.name);
      if (name) byKey.set(canonicalThemeKey(name), name);
    });

  songs.forEach((song) => {
    [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].forEach((theme) => {
      const name = normalizeThemeName(theme);
      if (name) byKey.set(canonicalThemeKey(name), name);
    });
  });

  return [...byKey.values()].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
}

export function collectSongKeys(songs = []) {
  const keys = new Set();
  songs.forEach((song) => {
    if (song.mainKey) keys.add(song.mainKey);
    if (song.keyWithCapo) keys.add(song.keyWithCapo);
  });
  return [...keys].sort((a, b) => a.localeCompare(b, "es"));
}
