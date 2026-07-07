import { PDFDocument } from "pdf-lib";
import { buildServiceSongs, getServiceFileName } from "./serviceSheetPdf";
import { resolvePublicPdfPath, resolveSongLocalPdfUrl } from "./songUtils";
import { fetchValidPdfArrayBuffer } from "./publicPdfTools";

const FLATTEN_RENDER_SCALE = 2;

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
  if (song.localPdfPath || song.pdfLocalPath) {
    return { type: "local", url: resolveSongLocalPdfUrl(song), label: "PDF local" };
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

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("No se pudo renderizar una pagina del PDF."));
        return;
      }
      resolve(await blob.arrayBuffer());
    }, "image/png");
  });
}

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
}

export async function flattenPdfBuffers(buffers, options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return mergePdfBuffers(buffers);
  }

  const pdfjsLib = await loadPdfJs();
  const merged = await PDFDocument.create();
  const scale = options.scale || FLATTEN_RENDER_SCALE;

  for (const buffer of buffers) {
    const sourceBytes = buffer instanceof ArrayBuffer ? buffer.slice(0) : buffer;
    const documentProxy = await pdfjsLib.getDocument({ data: sourceBytes }).promise;

    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const displayViewport = page.getViewport({ scale: 1 });
      const renderViewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport: renderViewport,
        annotationMode: pdfjsLib.AnnotationMode?.ENABLE
      }).promise;

      const pngBytes = await canvasToPngBytes(canvas);
      const image = await merged.embedPng(pngBytes);
      const outputPage = merged.addPage([displayViewport.width, displayViewport.height]);
      outputPage.drawImage(image, {
        x: 0,
        y: 0,
        width: displayViewport.width,
        height: displayViewport.height
      });

      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return merged.save();
}

export async function mergePdfFiles(files = []) {
  const buffers = [];
  for (const file of files) {
    buffers.push(await file.arrayBuffer());
  }
  const mergedBytes = await flattenPdfBuffers(buffers);
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
    const pdfVersion = serviceSong.pdfVersion || serviceSong.full?.pdfVersion || serviceSong.merged?.pdfVersion || "";

    if (!localPdfPath) {
      omitted.push({ title: serviceSong.title, reason: "sin ruta PDF local" });
      continue;
    }

    try {
      const versionedPdfUrl = resolvePublicPdfPath(localPdfPath, pdfVersion);
      const { buffer: bytes, diagnosis } = await fetchValidPdfArrayBuffer(versionedPdfUrl);
      await PDFDocument.load(bytes, { ignoreEncryption: true });
      buffers.push(bytes);
      included.push({ title: serviceSong.title, source: localPdfPath, resolvedUrl: diagnosis.finalUrl });
    } catch (error) {
      omitted.push({
        title: serviceSong.title,
        source: localPdfPath,
        resolvedUrl: error.diagnosis?.finalUrl || resolvePublicPdfPath(localPdfPath, pdfVersion),
        reason: error.message || "archivo no publicado o no descargable"
      });
    }
  }

  const mergedBytes = buffers.length ? await flattenPdfBuffers(buffers) : null;
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
