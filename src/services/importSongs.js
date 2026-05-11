import { calculateKeyWithCapo, normalizeBoolean, normalizeReviewStatus, splitThemes } from "./songUtils";

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
  drivePdfUrl: ["drivePdfUrl", "drive_pdf_url", "google_drive", "drive"],
  youtubeUrl: ["youtube", "youtubeUrl"],
  artistOrSource: ["fuente", "artista", "artistOrSource", "artist"]
};

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  return firstLine.includes("\t") ? "\t" : ",";
}

function parseLine(line, delimiter) {
  if (delimiter === "\t") return line.split("\t");
  const result = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((item) => item.trim());
}

function resolveColumn(header) {
  const normalized = normalizeHeader(header);
  return Object.entries(columnAliases).find(([, aliases]) =>
    aliases.map(normalizeHeader).includes(normalized)
  )?.[0];
}

export function parseSongsTable(text, keyPreference = "sharps") {
  const clean = String(text || "").trim();
  if (!clean) return [];
  const delimiter = detectDelimiter(clean);
  const lines = clean.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseLine(lines[0], delimiter);
  const mappedHeaders = headers.map(resolveColumn);

  return lines.slice(1).map((line, index) => {
    const values = parseLine(line, delimiter);
    const raw = {};
    mappedHeaders.forEach((field, fieldIndex) => {
      if (field) raw[field] = values[fieldIndex] || "";
    });

    const otherThemes = splitThemes(raw.otherThemes);
    const mainTheme = raw.mainTheme || "";
    const capo = raw.capo === "" ? 0 : Number(raw.capo || 0);
    const keyWithCapo = raw.keyWithCapo || calculateKeyWithCapo(raw.mainKey, capo, keyPreference);

    return {
      importId: raw.id || `fila-${index + 2}`,
      title: raw.title || "",
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
      drivePdfUrl: raw.drivePdfUrl || "",
      youtubeUrl: raw.youtubeUrl || "",
      chordsUrl: raw.pdfUrl || "",
      musicReviewStatus: normalizeReviewStatus(raw.musicReviewStatus),
      keynoteReviewStatus: normalizeReviewStatus(raw.keynoteReviewStatus),
      pdfReviewStatus: normalizeReviewStatus(raw.pdfReviewStatus),
      sungBefore: normalizeBoolean(raw.sungBefore),
      internalNotes: raw.internalNotes || "",
      lyricsSections: []
    };
  }).filter((song) => song.title);
}
