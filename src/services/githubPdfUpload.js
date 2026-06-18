import { getToken as getAppCheckToken } from "firebase/app-check";
import { appCheck, auth, pushServerUrl } from "../lib/firebase";

export const DIRECT_PDF_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

function uploadEndpoint() {
  const configured = import.meta.env.VITE_PDF_UPLOAD_SERVER_URL || "";
  if (configured) return configured;
  if (pushServerUrl) {
    try {
      return new URL("/api/uploadSongPdfToGithub", pushServerUrl).href;
    } catch {
      return "";
    }
  }
  return "/api/uploadSongPdfToGithub";
}

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el PDF seleccionado."));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() : value);
    };
    reader.readAsDataURL(file);
  });
}

async function authenticatedHeaders() {
  if (!auth?.currentUser) throw new Error("Necesitas iniciar sesion para actualizar PDFs.");
  const idToken = await auth.currentUser.getIdToken(true);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`
  };
  if (appCheck) {
    try {
      const appCheckResult = await getAppCheckToken(appCheck, false);
      if (appCheckResult?.token) headers["X-Firebase-AppCheck"] = appCheckResult.token;
    } catch {
      // El backend decide si App Check es obligatorio.
    }
  }
  return headers;
}

async function sendUploadRequest(payload) {
  const endpoint = uploadEndpoint();
  if (!endpoint) throw new Error("La funcion de subida no esta configurada.");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: await authenticatedHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await parseJsonSafely(response);
    if (!response.ok || body.ok === false) {
      const error = new Error(body.message || "No se pudo actualizar el PDF.");
      error.code = body.code || "";
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La subida excedio el tiempo de espera. Revisa GitHub antes de volver a intentar.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function uploadSongPdfFile(song, file) {
  if (!song?.id) throw new Error("Selecciona un canto valido.");
  if (!file) throw new Error("Selecciona un archivo PDF.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Solo se permiten archivos PDF.");
  }
  if (!file.size) throw new Error("El PDF esta vacio.");
  if (file.size > DIRECT_PDF_UPLOAD_MAX_BYTES) {
    throw new Error("Este PDF es demasiado grande para subirlo directo. Usa Importar desde enlace o comprime el PDF.");
  }
  const fileBase64 = await readFileAsBase64(file);
  return sendUploadRequest({
    mode: "file",
    songId: song.id,
    songTitle: song.title || "",
    originalFileName: file.name,
    contentType: file.type || "application/pdf",
    fileBase64
  });
}

export async function importSongPdfFromUrl(song, sourceUrl) {
  if (!song?.id) throw new Error("Selecciona un canto valido.");
  const url = String(sourceUrl || "").trim();
  if (!url) throw new Error("Pega un enlace publico al PDF.");
  return sendUploadRequest({
    mode: "url",
    songId: song.id,
    songTitle: song.title || "",
    sourceUrl: url
  });
}
