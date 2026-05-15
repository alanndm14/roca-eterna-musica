import { PDFDocument } from "pdf-lib";
import { buildServiceSongs, getServiceFileName } from "./serviceSheetPdf";
import { resolvePublicPdfPath } from "./songUtils";
import { fetchValidPdfArrayBuffer } from "./publicPdfTools";

export function extractGoogleDriveFileId(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  const patterns = [
    /drive\.google\.com\/file\/d\/([^/?#]+)/i,
    /drive\.google\.com\/open\?id=([^&#]+)/i,
    /drive\.google\.com\/uc\?(?:[^#]*&)?id=([^&#]+)/i
  ];
  const match = patterns.map((pattern) => value.match(pattern)).find(Boolean);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function getGoogleDrivePreviewUrl(url = "") {
  const fileId = extractGoogleDriveFileId(url);
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : "";
}

function firstValue(values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

export function getSongPdfSource(song = {}) {
  if (song.localPdfPath) {
    return { type: "local", url: resolvePublicPdfPath(song.localPdfPath), label: "PDF local" };
  }

  const url = firstValue([song.pdfPreviewUrl, song.drivePdfUrl, song.pdfUrl, song.chordsUrl, song.storagePdfUrl]);
  if (!url) return { type: "missing", label: "Sin PDF" };

  if (extractGoogleDriveFileId(url)) return { type: "drive", url, label: "Google Drive" };
  return { type: "external", url, label: "Enlace externo" };
}

export async function fetchPdfArrayBuffer(url) {
  const response = await fetch(url, { method: "GET", cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error(`No se pudo descargar el PDF (${response.status}).`);
  return response.arrayBuffer();
}

export async function mergePdfBuffers(buffers) {
  const merged = await PDFDocument.create();

  for (const buffer of buffers) {
    const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices());
    copiedPages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}

export async function mergePdfFiles(files = []) {
  const buffers = [];
  for (const file of files) {
    buffers.push(await file.arrayBuffer());
  }
  const mergedBytes = await mergePdfBuffers(buffers);
  return new Blob([mergedBytes], { type: "application/pdf" });
}

export function getServicePdfFileName(schedule) {
  return getServiceFileName(schedule);
}

export async function mergeServiceLocalPdfs(schedule, songs, keyPreference = "sharps") {
  const serviceSongs = buildServiceSongs(schedule, songs, keyPreference);
  const included = [];
  const omitted = [];
  const buffers = [];

  for (const serviceSong of serviceSongs) {
    const localPdfPath = serviceSong.localPdfPath || serviceSong.full?.localPdfPath || serviceSong.merged?.localPdfPath || "";

    if (!localPdfPath) {
      omitted.push({ title: serviceSong.title, reason: "sin ruta PDF local" });
      continue;
    }

    try {
      const { buffer: bytes, diagnosis } = await fetchValidPdfArrayBuffer(localPdfPath);
      await PDFDocument.load(bytes, { ignoreEncryption: true });
      buffers.push(bytes);
      included.push({ title: serviceSong.title, source: localPdfPath, resolvedUrl: diagnosis.finalUrl });
    } catch (error) {
      omitted.push({
        title: serviceSong.title,
        source: localPdfPath,
        resolvedUrl: error.diagnosis?.finalUrl || resolvePublicPdfPath(localPdfPath),
        reason: error.message || "archivo no publicado o no descargable"
      });
    }
  }

  const mergedBytes = buffers.length ? await mergePdfBuffers(buffers) : null;
  const blob = mergedBytes ? new Blob([mergedBytes], { type: "application/pdf" }) : null;

  return {
    blob,
    fileName: getServicePdfFileName(schedule),
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
