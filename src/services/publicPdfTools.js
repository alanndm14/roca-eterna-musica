import { normalizePublicAssetPath, resolvePublicAssetUrl } from "./songUtils";

const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

function bytesToAscii(bytes = []) {
  return Array.from(bytes)
    .slice(0, 16)
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function bytesToText(bytes = []) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 256)).toLowerCase();
}

function messageFor({ status, isHtml, isPdf, isImage, expectedType, error }) {
  if (error) return error;
  if (status === 404) return "No se encontro el archivo publicado. Verifica que GitHub Pages ya haya desplegado el archivo.";
  if (isHtml) return "Se recibio HTML en lugar del archivo. Probablemente la ruta apunta al index.html, a una pagina 404 o el archivo no esta publicado.";
  if (expectedType === "pdf" && isPdf) return "PDF encontrado.";
  if (expectedType === "image" && isImage) return "Imagen encontrada.";
  if (expectedType === "pdf") return "Archivo encontrado, pero no parece ser PDF valido.";
  if (expectedType === "image") return "Archivo encontrado, pero no parece ser imagen valida.";
  return "Archivo encontrado.";
}

export async function diagnosePublicAsset(path, expectedType = "file") {
  const savedPath = path || "";
  const normalizedPath = normalizePublicAssetPath(savedPath);
  const finalUrl = resolvePublicAssetUrl(savedPath);

  if (!finalUrl) {
    return {
      ok: false,
      savedPath,
      normalizedPath,
      finalUrl,
      status: "",
      contentType: "",
      sizeBytes: "",
      isPdf: false,
      isImage: false,
      isHtml: false,
      message: "No hay ruta guardada."
    };
  }

  try {
    const response = await fetch(finalUrl, { method: "GET", cache: "no-store", credentials: "omit" });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const contentLength = response.headers.get("content-length") || "";
    const buffer = await response.arrayBuffer();
    const firstBytes = new Uint8Array(buffer.slice(0, 512));
    const signature = bytesToAscii(firstBytes);
    const firstText = bytesToText(firstBytes);
    const isPdf = contentType.includes("application/pdf") || signature.startsWith("%PDF");
    const isImage = imageTypes.some((type) => contentType.includes(type));
    const isHtml = contentType.includes("text/html") || firstText.includes("<!doctype html") || firstText.includes("<html");
    const ok = response.ok && (expectedType === "pdf" ? isPdf : expectedType === "image" ? isImage : !isHtml);

    return {
      ok,
      savedPath,
      normalizedPath,
      finalUrl,
      status: response.status,
      contentType: contentType || "(sin content-type)",
      sizeBytes: contentLength || buffer.byteLength,
      isPdf,
      isImage,
      isHtml,
      firstBytes: signature,
      message: messageFor({ status: response.status, isHtml, isPdf, isImage, expectedType })
    };
  } catch (error) {
    return {
      ok: false,
      savedPath,
      normalizedPath,
      finalUrl,
      status: "error",
      contentType: "",
      sizeBytes: "",
      isPdf: false,
      isImage: false,
      isHtml: false,
      message: messageFor({ expectedType, error: error?.message || "No se pudo leer el archivo." })
    };
  }
}

export async function testPublicPdfPath(localPdfPath) {
  return diagnosePublicAsset(localPdfPath, "pdf");
}

export async function fetchValidPdfArrayBuffer(path) {
  const diagnosis = await diagnosePublicAsset(path, "pdf");
  if (!diagnosis.ok) {
    const reason = diagnosis.isHtml
      ? "se recibio HTML en lugar de PDF"
      : diagnosis.status === 404
        ? "archivo no publicado o no descargable"
        : "archivo encontrado, pero no parece ser PDF valido";
    const error = new Error(reason);
    error.diagnosis = diagnosis;
    throw error;
  }
  const response = await fetch(diagnosis.finalUrl, { method: "GET", cache: "no-store", credentials: "omit" });
  return {
    buffer: await response.arrayBuffer(),
    diagnosis
  };
}
