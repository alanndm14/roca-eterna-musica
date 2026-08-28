import { PDFDocument, StandardFonts } from "pdf-lib";
import { downloadBlob } from "./mergeServicePdfs";
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

const OCR_RENDER_SCALE = 2;
const MIN_SELECTABLE_CHARACTERS = 28;

let pdfJsPromise;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ]).then(([pdfjsLib, worker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getRepertoirePdfFileName(date = new Date()) {
  return `repertorio_Roca_Eterna_${MONTHS_ES[date.getMonth()]}_${date.getFullYear()}.pdf`;
}

export function sortRepertoireSongs(songs = []) {
  return [...(Array.isArray(songs) ? songs : [])]
    .filter((song) => song && !song.deleted)
    .sort((left, right) => String(left.title || "").localeCompare(String(right.title || ""), "es-MX", {
      sensitivity: "base",
      ignorePunctuation: true,
      numeric: true
    }));
}

export function pageHasUsableText(textContent = {}) {
  const text = (textContent.items || [])
    .map((item) => item?.str || "")
    .join(" ")
    .replace(/[^\p{L}\p{N}]/gu, "");
  return text.length >= MIN_SELECTABLE_CHARACTERS;
}

function collectOcrWords(blocks = []) {
  return (blocks || []).flatMap((block) =>
    (block?.paragraphs || []).flatMap((paragraph) =>
      (paragraph?.lines || []).flatMap((line) => line?.words || [])
    )
  );
}

function sanitizeOcrText(text = "", font) {
  const normalized = String(text || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();

  return [...normalized].filter((character) => {
    try {
      font.encodeText(character);
      return true;
    } catch {
      return false;
    }
  }).join("");
}

function addInvisibleOcrLayer(pdfPage, words, font, canvasWidth, canvasHeight) {
  const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
  const scaleX = pageWidth / canvasWidth;
  const scaleY = pageHeight / canvasHeight;
  let insertedWords = 0;

  for (const word of words) {
    const bbox = word?.bbox;
    const text = sanitizeOcrText(word?.text, font);
    if (!bbox || !text) continue;

    const x = clamp(Number(bbox.x0 || 0) * scaleX, 0, Math.max(0, pageWidth - 1));
    const wordHeight = Math.max(1, Number(bbox.y1 || 0) - Number(bbox.y0 || 0)) * scaleY;
    const size = clamp(wordHeight * 0.82, 3.5, 34);
    const y = clamp(pageHeight - (Number(bbox.y1 || 0) * scaleY) + (size * 0.12), 0, Math.max(0, pageHeight - size));

    pdfPage.drawText(text, {
      x,
      y,
      size,
      font,
      opacity: 0
    });
    insertedWords += 1;
  }

  return insertedWords;
}

function createCanvas(viewport) {
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  return canvas;
}

const progressPercent = (songIndex, totalSongs, pageProgress = 0) => {
  if (!totalSongs) return 95;
  return clamp(Math.round(4 + (90 * ((songIndex + pageProgress) / totalSongs))), 4, 94);
};

export async function buildFullRepertoirePdf(songs = [], options = {}) {
  if (typeof window === "undefined" || typeof window.document === "undefined") {
    throw new Error("La generación del repertorio debe ejecutarse desde el navegador.");
  }

  const repertoire = sortRepertoireSongs(songs);
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const report = (details) => onProgress?.({ status: "running", ...details });
  const merged = await PDFDocument.create();
  const ocrFont = await merged.embedFont(StandardFonts.Helvetica);
  const included = [];
  const omitted = [];
  const ocrFailures = [];
  let ocrPageCount = 0;
  let selectablePageCount = 0;
  let ocrWorker = null;
  let ocrUnavailableError = null;
  let activeOcrContext = {};

  merged.setTitle("Repertorio Roca Eterna");
  merged.setAuthor("Roca Eterna Música");
  merged.setSubject("Repertorio completo ordenado alfabéticamente");
  merged.setCreator("Roca Eterna Música");
  merged.setCreationDate(options.date || new Date());

  const ensureOcrWorker = async () => {
    if (ocrWorker) return ocrWorker;
    if (ocrUnavailableError) throw ocrUnavailableError;
    report({
      phase: "ocr-loading",
      percent: activeOcrContext.percent || 4,
      message: "Preparando reconocimiento de texto (OCR)…",
      ...activeOcrContext
    });
    try {
      const { createWorker, OEM } = await import("tesseract.js");
      ocrWorker = await createWorker("spa", OEM.LSTM_ONLY, {
        logger: (event) => {
          if (event?.status !== "recognizing text") return;
          const pageFraction = ((activeOcrContext.pageNumber || 1) - 1 + Number(event.progress || 0))
            / Math.max(1, activeOcrContext.totalPages || 1);
          report({
            ...activeOcrContext,
            phase: "ocr",
            percent: progressPercent(activeOcrContext.songIndex || 0, repertoire.length, pageFraction),
            ocrProgress: Math.round(Number(event.progress || 0) * 100),
            message: `Aplicando OCR a ${activeOcrContext.songTitle || "un canto"}…`
          });
        }
      });
      await ocrWorker.setParameters({ preserve_interword_spaces: "1" });
      return ocrWorker;
    } catch (error) {
      ocrUnavailableError = error;
      throw error;
    }
  };

  try {
    const pdfjsLib = await loadPdfJs();

    for (let songIndex = 0; songIndex < repertoire.length; songIndex += 1) {
      const song = repertoire[songIndex];
      const title = String(song.title || "Canto sin título");
      const localPdfPath = song.localPdfPath || song.pdfLocalPath || "";
      const baseProgress = progressPercent(songIndex, repertoire.length);

      report({
        phase: "loading",
        percent: baseProgress,
        songIndex,
        totalSongs: repertoire.length,
        songTitle: title,
        message: `Preparando ${title}…`
      });

      if (!localPdfPath) {
        omitted.push({ title, reason: "sin PDF local" });
        continue;
      }

      try {
        const pdfUrl = resolvePublicPdfPath(localPdfPath, song.pdfVersion || "");
        const { buffer, diagnosis } = await fetchValidPdfArrayBuffer(pdfUrl);
        const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const copiedPages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => merged.addPage(page));
        included.push({ title, source: localPdfPath, resolvedUrl: diagnosis.finalUrl, pages: copiedPages.length });

        let documentProxy;
        try {
          documentProxy = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
          for (let pageIndex = 0; pageIndex < documentProxy.numPages; pageIndex += 1) {
            const pageNumber = pageIndex + 1;
            const pageProgress = pageIndex / Math.max(1, documentProxy.numPages);
            const sourcePage = await documentProxy.getPage(pageNumber);
            const textContent = await sourcePage.getTextContent();

            if (pageHasUsableText(textContent)) {
              selectablePageCount += 1;
              report({
                phase: "reading",
                percent: progressPercent(songIndex, repertoire.length, pageProgress),
                songIndex,
                totalSongs: repertoire.length,
                songTitle: title,
                pageNumber,
                totalPages: documentProxy.numPages,
                message: `Conservando texto seleccionable de ${title}…`
              });
              continue;
            }

            const viewport = sourcePage.getViewport({ scale: OCR_RENDER_SCALE });
            const canvas = createCanvas(viewport);
            const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            await sourcePage.render({
              canvasContext: context,
              viewport,
              annotationMode: pdfjsLib.AnnotationMode?.ENABLE
            }).promise;

            activeOcrContext = {
              percent: progressPercent(songIndex, repertoire.length, pageProgress),
              songIndex,
              totalSongs: repertoire.length,
              songTitle: title,
              pageNumber,
              totalPages: documentProxy.numPages
            };

            try {
              const worker = await ensureOcrWorker();
              const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
              const insertedWords = addInvisibleOcrLayer(
                copiedPages[pageIndex],
                collectOcrWords(result?.data?.blocks),
                ocrFont,
                canvas.width,
                canvas.height
              );
              if (insertedWords) {
                ocrPageCount += 1;
                selectablePageCount += 1;
              } else {
                ocrFailures.push({ title, pageNumber, reason: "OCR sin texto legible" });
              }
            } catch (error) {
              ocrFailures.push({ title, pageNumber, reason: error?.message || "no se pudo aplicar OCR" });
            } finally {
              canvas.width = 0;
              canvas.height = 0;
            }
          }
        } catch (error) {
          ocrFailures.push({ title, reason: error?.message || "no se pudo revisar el texto del PDF" });
        } finally {
          try {
            await documentProxy?.destroy?.();
          } catch {
            // El documento ya se copió; un fallo de limpieza no debe omitir el canto.
          }
        }
      } catch (error) {
        omitted.push({
          title,
          reason: error?.message || "no se pudo cargar el PDF",
          resolvedUrl: error?.diagnosis?.finalUrl || ""
        });
      }
    }

    if (!included.length) {
      throw new Error("No hay PDFs locales disponibles para generar el repertorio.");
    }

    report({
      phase: "saving",
      percent: 96,
      totalSongs: repertoire.length,
      message: "Uniendo y optimizando el repertorio…"
    });
    const bytes = await merged.save({ useObjectStreams: true });

    return {
      blob: new Blob([bytes], { type: "application/pdf" }),
      fileName: getRepertoirePdfFileName(options.date),
      included,
      omitted,
      ocrFailures,
      ocrPageCount,
      selectablePageCount,
      totalPages: merged.getPageCount()
    };
  } finally {
    try {
      await ocrWorker?.terminate?.();
    } catch {
      // El resultado sigue siendo válido aunque el worker ya se haya cerrado.
    }
  }
}

export async function downloadFullRepertoirePdf(songs = [], options = {}) {
  const result = await buildFullRepertoirePdf(songs, options);
  options.onProgress?.({
    status: "running",
    phase: "downloading",
    percent: 99,
    message: "Iniciando la descarga…",
    totalSongs: result.included.length + result.omitted.length
  });
  downloadBlob(result.blob, result.fileName);
  options.onProgress?.({
    status: "done",
    phase: "done",
    percent: 100,
    message: `${result.fileName} está listo.`,
    totalSongs: result.included.length + result.omitted.length
  });
  return result;
}
