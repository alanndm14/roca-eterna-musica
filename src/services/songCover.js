import { getToken as getAppCheckToken } from "firebase/app-check";
import { appCheck, auth, pushServerUrl } from "../lib/firebase";
import { resolvePublicAssetUrl, stripAccents } from "./songUtils";

export const MAX_ORIGINAL_COVER_BYTES = 5 * 1024 * 1024;
export const MAX_PROCESSED_COVER_BYTES = 1024 * 1024;
export const TARGET_PROCESSED_COVER_BYTES = 500 * 1024;
export const COVER_POSITIONS = [
  { value: "center", label: "Centro" },
  { value: "top", label: "Arriba" },
  { value: "bottom", label: "Abajo" },
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" }
];
export const COVER_INTENSITIES = [
  { value: "subtle", label: "Sutil" },
  { value: "medium", label: "Media" }
];

export function slugifyCoverName(title = "") {
  const slug = stripAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${slug || "canto"}.webp`;
}

export function normalizeCoverPosition(value = "") {
  return COVER_POSITIONS.some((item) => item.value === value) ? value : "center";
}

export function normalizeCoverIntensity(value = "") {
  return COVER_INTENSITIES.some((item) => item.value === value) ? value : "subtle";
}

export function getSongCoverUrl(song = {}) {
  if (!song.coverImagePath || song.coverEnabled === false) return "";
  const source = String(song.coverImagePath);
  const resolved = /^(blob:|data:|https?:\/\/)/i.test(source) ? source : resolvePublicAssetUrl(source);
  if (!resolved || !song.coverVersion || /^(blob:|data:)/i.test(resolved)) return resolved;
  return `${resolved}${resolved.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(song.coverVersion))}`;
}

export function coverObjectPosition(position = "center") {
  const values = {
    center: "center center",
    top: "center top",
    bottom: "center bottom",
    left: "left center",
    right: "right center"
  };
  return values[normalizeCoverPosition(position)];
}

function uploadEndpoint() {
  const configured = import.meta.env.VITE_COVER_UPLOAD_SERVER_URL || "";
  if (configured) return configured;
  const pdfEndpoint = import.meta.env.VITE_PDF_UPLOAD_SERVER_URL || "";
  if (pdfEndpoint) {
    try {
      return new URL("/api/uploadSongCoverToGithub", pdfEndpoint).href;
    } catch {
      return "";
    }
  }
  if (pushServerUrl) {
    try {
      return new URL("/api/uploadSongCoverToGithub", pushServerUrl).href;
    } catch {
      return "";
    }
  }
  return "/api/uploadSongCoverToGithub";
}

async function authenticatedHeaders() {
  if (!auth?.currentUser) throw new Error("No se pudo validar tu sesión.");
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
      // El servidor decide si App Check es obligatorio.
    }
  }
  return headers;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function requestCover(method, payload) {
  const endpoint = uploadEndpoint();
  if (!endpoint) throw new Error("La función de portadas no está configurada.");
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(endpoint, {
      method,
      headers: await authenticatedHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await parseResponse(response);
    if (!response.ok || body.ok === false) {
      const error = new Error(body.message || "No se pudo actualizar la portada.");
      error.code = body.code || "";
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La actualización excedió el tiempo de espera. Revisa GitHub antes de intentarlo otra vez.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function uploadSongCover(song, processed, options = {}) {
  return requestCover("POST", {
    songId: song.id,
    songTitle: song.title || "",
    fileBase64: processed.fileBase64,
    contentType: "image/webp",
    desiredFileName: song.coverFileName || slugifyCoverName(song.title),
    coverEnabled: options.coverEnabled !== false,
    coverPosition: normalizeCoverPosition(options.coverPosition),
    coverIntensity: normalizeCoverIntensity(options.coverIntensity),
    coverAccentColor: processed.accentColor || "#b6945f"
  });
}

export function removeSongCover(song, mode = "unlink") {
  return requestCover("DELETE", {
    songId: song.id,
    mode: mode === "delete" ? "delete" : "unlink"
  });
}

function loadSourceImage(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo abrir la imagen seleccionada."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo convertir la imagen a WebP."));
    }, "image/webp", quality);
  });
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function extractAccentColor(canvas) {
  const sample = document.createElement("canvas");
  sample.width = 32;
  sample.height = 32;
  const context = sample.getContext("2d", { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 160) continue;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 510;
    const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (lightness < 0.12 || lightness > 0.88) continue;
    const pixelWeight = 0.35 + Math.min(0.65, saturation);
    red += r * pixelWeight;
    green += g * pixelWeight;
    blue += b * pixelWeight;
    weight += pixelWeight;
  }
  if (!weight) return "#b6945f";
  const average = [red / weight, green / weight, blue / weight];
  const middle = average.reduce((sum, value) => sum + value, 0) / 3;
  const softened = average.map((value) => Math.max(42, Math.min(190, middle + (value - middle) * 0.72)));
  return rgbToHex(...softened);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo preparar la portada."));
    reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
    reader.readAsDataURL(blob);
  });
}

export async function processSongCoverImage(file, crop = {}, onProgress) {
  if (!file) throw new Error("Selecciona una imagen.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Solo se permiten imágenes JPG, PNG o WebP.");
  }
  if (!file.size || file.size > MAX_ORIGINAL_COVER_BYTES) {
    throw new Error(file.size > MAX_ORIGINAL_COVER_BYTES
      ? "La imagen original supera 5 MB."
      : "La imagen seleccionada está vacía.");
  }
  onProgress?.("Preparando vista previa…");
  const image = await loadSourceImage(file);
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  if (!width || !height) throw new Error("La imagen no tiene dimensiones válidas.");
  onProgress?.("Recortando…");
  const zoom = Math.max(1, Math.min(2.5, Number(crop.zoom || 1)));
  const cropSize = Math.min(width, height) / zoom;
  const availableX = Math.max(0, width - cropSize);
  const availableY = Math.max(0, height - cropSize);
  const offsetX = Math.max(-1, Math.min(1, Number(crop.offsetX || 0)));
  const offsetY = Math.max(-1, Math.min(1, Number(crop.offsetY || 0)));
  const sourceX = Math.max(0, Math.min(availableX, availableX / 2 + offsetX * availableX / 2));
  const sourceY = Math.max(0, Math.min(availableY, availableY / 2 + offsetY * availableY / 2));
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 800;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#111111";
  context.fillRect(0, 0, 800, 800);
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 800, 800);
  image.close?.();
  onProgress?.("Comprimiendo…");
  let quality = 0.8;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_PROCESSED_COVER_BYTES && quality > 0.58) {
    quality -= 0.05;
    blob = await canvasToBlob(canvas, quality);
  }
  while (blob.size > MAX_PROCESSED_COVER_BYTES && quality > 0.45) {
    quality -= 0.05;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_PROCESSED_COVER_BYTES) {
    throw new Error("No se pudo reducir la imagen por debajo de 1 MB.");
  }
  const accentColor = extractAccentColor(canvas);
  const fileBase64 = await blobToBase64(blob);
  return {
    blob,
    fileBase64,
    accentColor,
    width: 800,
    height: 800,
    quality: Math.round(quality * 100) / 100,
    size: blob.size
  };
}
