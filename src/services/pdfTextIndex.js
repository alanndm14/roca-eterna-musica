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

export async function extractLocalPdfText(localPdfPath) {
  const url = resolvePublicPdfPath(localPdfPath);
  if (!url) return { status: "missing", text: "", tokens: [], message: "Sin ruta PDF local." };

  try {
    const pdfjsLib = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return { status: "missing", text: "", tokens: [], message: `No se encontro el PDF local (${response.status}).` };
    }

    const buffer = await response.arrayBuffer();
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
      return { status: "no_text", text: "", tokens: [], message: "Este PDF no tiene texto seleccionable; no puede indexarse sin OCR." };
    }
    return { status: "indexed", text, tokens, message: "PDF indexado correctamente." };
  } catch (error) {
    return { status: "failed", text: "", tokens: [], message: "No se pudo indexar este PDF local." };
  }
}
