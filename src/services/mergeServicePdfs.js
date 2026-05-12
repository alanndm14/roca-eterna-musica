import { PDFDocument } from "pdf-lib";
import { getBytes, ref } from "firebase/storage";
import { storage } from "../lib/firebase";
import { buildServiceSongs, getServiceFileName } from "./serviceSheetPdf";

export function getSongPdfSource(song) {
  if (song?.storagePath) return { type: "storage", path: song.storagePath, label: "Firebase Storage" };
  if (song?.storagePdfUrl) return { type: "storage-url", url: song.storagePdfUrl, label: "Firebase Storage" };
  if (song?.pdfUrl || song?.drivePdfUrl || song?.pdfPreviewUrl || song?.chordsUrl) {
    return { type: "drive", url: song.pdfUrl || song.drivePdfUrl || song.pdfPreviewUrl || song.chordsUrl, label: "Drive / enlace externo" };
  }
  return { type: "missing", label: "Sin PDF" };
}

async function readStoragePdf(source) {
  if (source.type === "storage" && storage) {
    return getBytes(ref(storage, source.path));
  }
  if (source.type === "storage-url") {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error("No se pudo descargar el PDF de Storage.");
    return response.arrayBuffer();
  }
  throw new Error("El PDF no está en Firebase Storage.");
}

export async function mergeServicePdfs(schedule, songs, keyPreference = "sharps") {
  const serviceSongs = buildServiceSongs(schedule, songs, keyPreference);
  const merged = await PDFDocument.create();
  const included = [];
  const omitted = [];

  for (const serviceSong of serviceSongs) {
    const source = getSongPdfSource(serviceSong.full);
    if (source.type !== "storage" && source.type !== "storage-url") {
      omitted.push({
        title: serviceSong.title,
        reason: source.type === "drive" ? "solo Drive o enlace externo" : "sin PDF registrado"
      });
      continue;
    }

    try {
      const bytes = await readStoragePdf(source);
      const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copiedPages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => merged.addPage(page));
      included.push({ title: serviceSong.title, source: source.label });
    } catch (error) {
      omitted.push({ title: serviceSong.title, reason: error.message || "no se pudo leer el PDF" });
    }
  }

  const mergedBytes = included.length ? await merged.save() : null;
  const blob = mergedBytes ? new Blob([mergedBytes], { type: "application/pdf" }) : null;

  return {
    blob,
    fileName: getServiceFileName(schedule),
    included,
    omitted,
    isPartial: omitted.length > 0
  };
}

export function downloadBlob(blob, filename) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
