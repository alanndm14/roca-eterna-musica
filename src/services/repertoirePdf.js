import { PDFDocument } from "pdf-lib";
import { downloadBlob, mergePdfBuffers } from "./mergeServicePdfs";
import { fetchValidPdfArrayBuffer } from "./publicPdfTools";
import { resolvePublicPdfPath } from "./songUtils";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];

export function getRepertoirePdfFileName(date = new Date()) {
  return `Repertorio_${MONTHS_ES[date.getMonth()]}_${date.getFullYear()}.pdf`;
}

export async function downloadFullRepertoirePdf(songs = []) {
  const repertoire = [...(Array.isArray(songs) ? songs : [])]
    .filter((song) => song && !song.deleted)
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "es", { sensitivity: "base" }));

  const buffers = [];
  const omitted = [];

  for (const song of repertoire) {
    const localPdfPath = song.localPdfPath || song.pdfLocalPath || "";
    if (!localPdfPath) {
      omitted.push(`${song.title || "Canto sin título"}: sin PDF local`);
      continue;
    }

    try {
      const pdfUrl = resolvePublicPdfPath(localPdfPath, song.pdfVersion || "");
      const { buffer } = await fetchValidPdfArrayBuffer(pdfUrl);
      await PDFDocument.load(buffer, { ignoreEncryption: true });
      buffers.push(buffer);
    } catch (error) {
      omitted.push(`${song.title || "Canto sin título"}: ${error.message || "no se pudo cargar el PDF"}`);
    }
  }

  if (!buffers.length) {
    throw new Error("No hay PDFs locales disponibles para generar el repertorio.");
  }

  const mergedBytes = await mergePdfBuffers(buffers);
  const blob = new Blob([mergedBytes], { type: "application/pdf" });
  const fileName = getRepertoirePdfFileName();
  downloadBlob(blob, fileName);

  return {
    fileName,
    includedCount: buffers.length,
    omitted
  };
}
