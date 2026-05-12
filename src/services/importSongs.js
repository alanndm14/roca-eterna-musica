import Papa from "papaparse";
import { calculateKeyWithCapo, normalizeBoolean, normalizeReviewStatus, splitThemes, stripAccents } from "./songUtils";

const columnAliases = {
  id: ["id"],
  title: ["nombre", "title", "titulo", "título"],
  mainTheme: ["tema", "mainTheme", "main_theme"],
  otherThemes: ["otros_temas", "otros temas", "otherThemes", "other_themes"],
  category: ["categoria", "categoría", "category"],
  sungBefore: ["cantado", "sungBefore", "sung_before"],
  mainKey: ["tonalidad", "tono", "mainKey", "main_key"],
  capo: ["capo", "cejilla"],
  keyWithCapo: ["tonalidad_con_capo", "tono_con_capo", "keyWithCapo", "key_with_capo"],
  hasKeyChange: ["cambio_de_tono", "cambio tono", "hasKeyChange", "has_key_change"],
  musicReviewStatus: ["revision_musical", "revisión musical", "musicReviewStatus"],
  keynoteReviewStatus: ["revision_keynote", "revisión keynote", "keynoteReviewStatus"],
  pdfReviewStatus: ["revision_pdf", "revisión pdf", "pdfReviewStatus"],
  format: ["formato", "format"],
  internalNotes: ["comentario", "comentarios", "notas", "internalNotes"],
  pdfUrl: ["pdf", "pdfUrl", "pdf_url", "link_pdf"],
  localPdfPath: ["local_pdf", "localPdfPath", "local_pdf_path", "ruta_pdf_local"],
  drivePdfUrl: ["drivePdfUrl", "drive_pdf_url", "google_drive", "drive"],
  youtubeUrl: ["youtube", "youtubeUrl"],
  spotifyUrl: ["spotify", "spotifyUrl", "spotify_url"],
  artistOrSource: ["fuente", "artista", "artistOrSource", "artist"]
};

const normalizeHeader = (value) =>
  stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const aliasLookup = Object.entries(columnAliases).reduce((acc, [field, aliases]) => {
  aliases.forEach((alias) => {
    acc[normalizeHeader(alias)] = field;
  });
  return acc;
}, {});

const detectDelimiter = (text) => {
  const firstLine = String(text || "").split(/\r?\n/).find(Boolean) || "";
  return firstLine.includes("\t") ? "\t" : "";
};

export function parseSongsTable(text, keyPreference = "sharps") {
  const clean = String(text || "").trim();
  if (!clean) {
    return { songs: [], errors: [], rows: [], headers: [] };
  }

  const parsed = Papa.parse(clean, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: detectDelimiter(clean),
    transformHeader: (header) => aliasLookup[normalizeHeader(header)] || normalizeHeader(header)
  });

  const errors = parsed.errors.map((error) => ({
    row: error.row ? error.row + 2 : "-",
    message: error.message
  }));

  const songs = [];
  const rows = [];

  parsed.data.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const raw = Object.fromEntries(Object.entries(rawRow).map(([key, value]) => [key, String(value ?? "").trim()]));
    rows.push(raw);

    if (!raw.title) {
      errors.push({ row: rowNumber, message: "Fila omitida: falta el nombre del canto." });
      return;
    }

    const otherThemes = splitThemes(raw.otherThemes);
    const mainTheme = splitThemes(raw.mainTheme)[0] || "";
    const parsedCapo = raw.capo === "" ? 0 : Number(raw.capo || 0);
    const capo = Number.isFinite(parsedCapo) ? Math.min(Math.max(parsedCapo, 0), 12) : 0;
    const keyWithCapo = raw.keyWithCapo || calculateKeyWithCapo(raw.mainKey, capo, keyPreference);

    songs.push({
      importId: raw.id || `fila-${rowNumber}`,
      title: raw.title,
      artistOrSource: raw.artistOrSource || "",
      category: raw.category || "normal",
      mainTheme,
      otherThemes,
      tags: [...new Set([mainTheme, ...otherThemes].filter(Boolean))],
      mainKey: raw.mainKey || "",
      capo,
      keyWithCapo,
      hasKeyChange: normalizeBoolean(raw.hasKeyChange),
      format: raw.format || "pdf",
      pdfUrl: raw.pdfUrl || "",
      localPdfPath: raw.localPdfPath || "",
      drivePdfUrl: raw.drivePdfUrl || "",
      youtubeUrl: raw.youtubeUrl || "",
      spotifyUrl: raw.spotifyUrl || "",
      chordsUrl: raw.pdfUrl || "",
      musicReviewStatus: normalizeReviewStatus(raw.musicReviewStatus),
      keynoteReviewStatus: normalizeReviewStatus(raw.keynoteReviewStatus),
      pdfReviewStatus: normalizeReviewStatus(raw.pdfReviewStatus),
      sungBefore: normalizeBoolean(raw.sungBefore),
      internalNotes: raw.internalNotes || "",
      lyricsSections: [],
      _rowNumber: rowNumber
    });
  });

  return { songs, errors, rows, headers: parsed.meta.fields || [] };
}

export function analyzeImport(parsedSongs, existingSongs) {
  const existingByTitle = new Set(existingSongs.map((song) => song.title?.trim().toLowerCase()).filter(Boolean));
  const duplicates = parsedSongs.filter((song) => existingByTitle.has(song.title.trim().toLowerCase())).length;
  return {
    detected: parsedSongs.length,
    duplicates,
    news: parsedSongs.length - duplicates
  };
}
