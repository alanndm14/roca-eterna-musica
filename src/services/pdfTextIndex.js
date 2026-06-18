import { fetchValidPdfArrayBuffer } from "./publicPdfTools";
import { resolvePublicPdfPath } from "./songUtils";

const normalizeTokenText = (text = "") =>
  String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function buildPdfSearchTokens(text = "") {
  return [...new Set(normalizeTokenText(text).split(" ").filter((token) => token.length > 2))].slice(0, 700);
}

async function hashArrayBuffer(buffer) {
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  const view = new Uint8Array(buffer);
  for (let index = 0; index < view.length; index += 1) {
    hash = ((hash << 5) - hash + view[index]) | 0;
  }
  return `fallback-${view.length}-${Math.abs(hash)}`;
}

export async function fingerprintLocalPdf(localPdfPath, pdfVersion = "") {
  const url = resolvePublicPdfPath(localPdfPath, pdfVersion);
  if (!url) return { status: "missing", fingerprint: "", message: "Sin ruta PDF local." };
  const { buffer, diagnosis } = await fetchValidPdfArrayBuffer(url);
  const fingerprint = await hashArrayBuffer(buffer);
  return {
    status: "found",
    fingerprint,
    buffer,
    diagnosis,
    resolvedUrl: diagnosis.finalUrl,
    statusHttp: diagnosis.status,
    contentType: diagnosis.contentType
  };
}

async function extractTextWithOcr(document, onOcrProgress) {
  if (typeof window === "undefined" || typeof window.document === "undefined") {
    return { text: "", pages: 0 };
  }
  const { recognize } = await import("tesseract.js");
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.45 });
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    onOcrProgress?.({ pageNumber, totalPages: document.numPages, phase: "ocr" });
    const result = await recognize(canvas, "spa", {
      logger: (event) => onOcrProgress?.({
        pageNumber,
        totalPages: document.numPages,
        phase: event.status || "ocr",
        progress: event.progress || 0
      })
    });
    pages.push(result?.data?.text || "");
  }
  return { text: pages.join(" "), pages: pages.length };
}

export async function extractLocalPdfText(localPdfPath, options = {}) {
  const url = resolvePublicPdfPath(localPdfPath, options.pdfVersion || "");
  if (!url) return { status: "missing", text: "", tokens: [], message: "Sin ruta PDF local." };

  try {
    const pdfjsLib = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;

    const prefetched = options.prefetched || await fingerprintLocalPdf(localPdfPath, options.pdfVersion || "");
    const { buffer, diagnosis } = prefetched;
    const document = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }

    const text = normalizeTokenText(pages.join(" "));
    const tokens = buildPdfSearchTokens(text);
    if (!tokens.length) {
      if (!options.enableOcr) {
        return { status: "no_text", text: "", tokens: [], message: "Este PDF no tiene texto seleccionable. Activa OCR automático para leer PDFs escaneados." };
      }
      const ocr = await extractTextWithOcr(document, options.onOcrProgress);
      const ocrText = normalizeTokenText(ocr.text);
      const ocrTokens = buildPdfSearchTokens(ocrText);
      if (!ocrTokens.length) {
        return { status: "no_text", text: "", tokens: [], message: "OCR ejecutado, pero no encontró texto legible.", method: "ocr" };
      }
      return {
        status: "indexed",
        text: ocrText,
        tokens: ocrTokens,
        message: "PDF indexado con OCR automático.",
        resolvedUrl: diagnosis.finalUrl,
        statusHttp: diagnosis.status,
        contentType: diagnosis.contentType,
        method: "ocr",
        fingerprint: prefetched.fingerprint || ""
      };
    }
    return { status: "indexed", text, tokens, message: "PDF indexado correctamente.", resolvedUrl: diagnosis.finalUrl, statusHttp: diagnosis.status, contentType: diagnosis.contentType, method: "text", fingerprint: prefetched.fingerprint || "" };
  } catch (error) {
    const diagnosis = error.diagnosis;
    return {
      status: diagnosis?.status === 404 ? "missing" : "failed",
      text: "",
      tokens: [],
      message: diagnosis?.message || "No se pudo indexar este PDF local.",
      resolvedUrl: diagnosis?.finalUrl || url,
      statusHttp: diagnosis?.status || "error",
      contentType: diagnosis?.contentType || ""
    };
  }
}
