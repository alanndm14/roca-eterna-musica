import { PDFDocument } from "pdf-lib";
import { getBytes, ref } from "firebase/storage";
import { storage } from "../lib/firebase";
import { buildServiceSongs, getServiceFileName } from "./serviceSheetPdf";

const DRIVE_DOWNLOAD_REASON = "Drive bloqueó la descarga directa, el link no es público, CORS o el archivo no es PDF descargable.";
const DIRECT_DOWNLOAD_REASON = "No se pudo descargar el PDF directo o el archivo no es PDF descargable.";

export function extractGoogleDriveFileId(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  const patterns = [
    /drive\.google\.com\/file\/d\/([^/?#]+)/i,
    /drive\.google\.com\/open\?id=([^&#]+)/i,
    /drive\.google\.com\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
    /drive\.google\.com\/drive\/folders\/([^/?#]+)/i
  ];
  const match = patterns.map((pattern) => value.match(pattern)).find(Boolean);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function getGoogleDriveDownloadUrl(url = "") {
  const fileId = extractGoogleDriveFileId(url);
  return fileId ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}` : "";
}

export function getGoogleDrivePreviewUrl(url = "") {
  const fileId = extractGoogleDriveFileId(url);
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : "";
}

function isDirectPdfUrl(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return String(url || "").toLowerCase().split("?")[0].endsWith(".pdf");
  }
}

function firstValue(values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

export function getSongPdfSource(song = {}) {
  const url = firstValue([
    song.storagePdfUrl,
    song.pdfUrl,
    song.drivePdfUrl,
    song.pdfPreviewUrl,
    song.chordsUrl
  ]);

  if (!url && song.storagePath) {
    return { type: "storage-path", path: song.storagePath, label: "PDF subido a la app" };
  }

  if (!url) return { type: "missing", label: "Sin PDF" };

  const driveId = extractGoogleDriveFileId(url);
  if (driveId) {
    return {
      type: "drive",
      url,
      fileId: driveId,
      downloadUrl: getGoogleDriveDownloadUrl(url),
      previewUrl: getGoogleDrivePreviewUrl(url),
      label: "Google Drive"
    };
  }

  return {
    type: isDirectPdfUrl(url) ? "direct" : "external",
    url,
    label: isDirectPdfUrl(url) ? "PDF directo" : "Enlace externo"
  };
}

export async function fetchPdfArrayBuffer(url) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar el PDF (${response.status}).`);
  }

  return response.arrayBuffer();
}

async function readPdfSource(source) {
  if (source.type === "storage-path") {
    if (!storage) throw new Error("La app no tiene Storage configurado.");
    return getBytes(ref(storage, source.path));
  }

  if (source.type === "drive") {
    return fetchPdfArrayBuffer(source.downloadUrl);
  }

  if (source.type === "direct" || source.type === "external") {
    return fetchPdfArrayBuffer(source.url);
  }

  throw new Error("PDF no registrado.");
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

export function getServicePdfFileName(schedule) {
  return getServiceFileName(schedule);
}

function sourceFailureReason(source, error) {
  if (source.type === "missing") return "PDF no registrado.";
  if (source.type === "drive") return DRIVE_DOWNLOAD_REASON;
  if (source.type === "direct" || source.type === "external") return DIRECT_DOWNLOAD_REASON;
  return error?.message || "No se pudo leer el PDF.";
}

export async function mergeServicePdfs(schedule, songs, keyPreference = "sharps") {
  const serviceSongs = buildServiceSongs(schedule, songs, keyPreference);
  const included = [];
  const omitted = [];
  const buffers = [];

  for (const serviceSong of serviceSongs) {
    const sourceSong = {
      ...serviceSong.full,
      ...serviceSong.merged,
      pdfUrl: serviceSong.pdfUrl || serviceSong.merged?.pdfUrl || serviceSong.full?.pdfUrl,
      pdfPreviewUrl: serviceSong.previewUrl || serviceSong.merged?.pdfPreviewUrl || serviceSong.full?.pdfPreviewUrl
    };
    const source = getSongPdfSource(sourceSong);

    if (source.type === "missing") {
      omitted.push({ title: serviceSong.title, reason: sourceFailureReason(source) });
      continue;
    }

    try {
      const bytes = await readPdfSource(source);
      await PDFDocument.load(bytes, { ignoreEncryption: true });
      buffers.push(bytes);
      included.push({ title: serviceSong.title, source: source.label });
    } catch (error) {
      omitted.push({ title: serviceSong.title, reason: sourceFailureReason(source, error) });
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
