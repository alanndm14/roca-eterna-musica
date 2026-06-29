import {
  collection,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";
import { getToken as getAppCheckToken } from "firebase/app-check";
import { appCheck, auth, db, pushServerUrl } from "../lib/firebase";
import { resolvePublicAssetUrl } from "./songUtils";

export const MAX_PRACTICE_AUDIO_BYTES = 25 * 1024 * 1024;
export const SERVER_PRACTICE_AUDIO_BYTES = 3 * 1024 * 1024;
export const PRACTICE_AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/ogg"]);
const localKey = (songId) => `roca-eterna-practice-guides:${songId}`;

const safeSegment = (value = "") => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 100);

function extensionFor(file) {
  const fromName = String(file?.name || "").split(".").pop()?.toLowerCase();
  if (["mp3", "m4a", "mp4", "wav", "ogg"].includes(fromName)) return fromName;
  return {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/ogg": "ogg"
  }[file?.type] || "audio";
}

function mimeTypeFor(file) {
  if (PRACTICE_AUDIO_TYPES.has(file?.type)) return file.type;
  return {
    mp3: "audio/mpeg",
    m4a: "audio/x-m4a",
    mp4: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg"
  }[String(file?.name || "").split(".").pop()?.toLowerCase()] || "";
}

export function validatePracticeAudio(file) {
  if (!file) throw new Error("Selecciona un archivo de audio.");
  if (!mimeTypeFor(file)) throw new Error("Formato no permitido. Usa MP3, M4A, WAV u OGG.");
  if (!file.size || file.size > MAX_PRACTICE_AUDIO_BYTES) throw new Error("El audio debe pesar menos de 25 MB.");
}

export function readAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const finish = (value) => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(Number.isFinite(value) ? Math.round(value * 10) / 10 : 0);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

function normalizeGuide(id, data = {}) {
  return {
    id,
    title: data.title || "Guía de ensayo",
    sectionType: data.sectionType || "full",
    customSectionName: data.customSectionName || "",
    voicePart: data.voicePart || "all",
    key: data.key || "",
    bpm: Number(data.bpm || 0),
    timeSignature: data.timeSignature || "4/4",
    entryNote: data.entryNote || "",
    notes: data.notes || "",
    storagePath: data.storagePath || "",
    audioUrl: data.audioUrl || "",
    fileName: data.fileName || "",
    mimeType: data.mimeType || "",
    sizeBytes: Number(data.sizeBytes || 0),
    durationSeconds: Number(data.durationSeconds || 0),
    order: Number(data.order || 0),
    enabled: data.enabled !== false,
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || "",
    createdBy: data.createdBy || "",
    updatedBy: data.updatedBy || ""
  };
}

export async function loadPracticeGuides(songId, useLocal = false) {
  if (!songId) return [];
  if (useLocal || !db) {
    try {
      return JSON.parse(localStorage.getItem(localKey(songId)) || "[]").map((item) => normalizeGuide(item.id, item));
    } catch {
      return [];
    }
  }
  const snapshot = await getDocs(query(collection(db, "songs", songId, "practiceGuides"), orderBy("order", "asc")));
  return snapshot.docs.map((item) => normalizeGuide(item.id, item.data()));
}

export async function getPracticeGuideAudioUrl(guide, useLocal = false) {
  if (guide?.audioUrl) return guide.audioUrl;
  if (!guide?.storagePath || useLocal) return "";
  const publicPath = String(guide.storagePath).replace(/^public\//, "");
  return resolvePublicAssetUrl(`/${publicPath}`);
}

function saveLocal(songId, guides) {
  localStorage.setItem(localKey(songId), JSON.stringify(guides));
}

function uploadEndpoint() {
  const configured = import.meta.env.VITE_PRACTICE_GUIDE_UPLOAD_SERVER_URL || "";
  if (configured) return configured;
  const pdfEndpoint = import.meta.env.VITE_PDF_UPLOAD_SERVER_URL || "";
  if (pdfEndpoint) {
    try {
      return new URL("/api/uploadPracticeGuideToGithub", pdfEndpoint).href;
    } catch {
      return "";
    }
  }
  if (pushServerUrl) {
    try {
      return new URL("/api/uploadPracticeGuideToGithub", pushServerUrl).href;
    } catch {
      return "";
    }
  }
  return "/api/uploadPracticeGuideToGithub";
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo preparar el audio."));
    reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
    reader.readAsDataURL(file);
  });
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
      const result = await getAppCheckToken(appCheck, false);
      if (result?.token) headers["X-Firebase-AppCheck"] = result.token;
    } catch {
      // El backend decide si App Check es obligatorio.
    }
  }
  return headers;
}

async function requestPracticeGuide(method, payload) {
  const endpoint = uploadEndpoint();
  if (!endpoint) throw new Error("La subida de guías no está configurada.");
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(endpoint, {
      method,
      headers: await authenticatedHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { message: text };
    }
    if (!response.ok || body.ok === false) {
      const error = new Error(body.message || "No se pudo guardar la guía de ensayo.");
      error.code = body.code || "";
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La subida tardó demasiado. Revisa tu conexión antes de intentarlo nuevamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function githubApi(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!response.ok) {
    const error = new Error(body.message || "No se pudo subir el audio a GitHub.");
    error.status = response.status;
    throw error;
  }
  return body;
}

async function uploadPracticeAudioDirectToGithub(upload, file) {
  const { token, owner, repo, branch, storagePath, commitMessage } = upload || {};
  if (!token || !owner || !repo || !branch || !storagePath) {
    throw new Error("La subida directa a GitHub no está preparada.");
  }
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const encodedBranch = encodeURIComponent(branch);
  const ref = await githubApi(`${apiBase}/git/ref/heads/${encodedBranch}`, token);
  const baseCommitSha = ref.object?.sha || "";
  if (!baseCommitSha) throw new Error("No se pudo ubicar la rama de GitHub.");
  const baseCommit = await githubApi(`${apiBase}/git/commits/${baseCommitSha}`, token);
  const baseTreeSha = baseCommit.tree?.sha || "";
  if (!baseTreeSha) throw new Error("No se pudo preparar el árbol de GitHub.");
  const content = await readFileAsBase64(file);
  const blob = await githubApi(`${apiBase}/git/blobs`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding: "base64" })
  });
  const tree = await githubApi(`${apiBase}/git/trees`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{ path: storagePath, mode: "100644", type: "blob", sha: blob.sha }]
    })
  });
  const commit = await githubApi(`${apiBase}/git/commits`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: commitMessage || `Update audio ${storagePath}`,
      tree: tree.sha,
      parents: [baseCommitSha]
    })
  });
  await githubApi(`${apiBase}/git/refs/heads/${encodedBranch}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha: commit.sha })
  });
  return { commitSha: commit.sha };
}

export async function savePracticeGuide({ songId, guide = {}, file, profile, useLocal = false }) {
  if (!songId) throw new Error("El canto no es válido.");
  if (file) validatePracticeAudio(file);
  const guideId = guide.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const durationSeconds = file ? await readAudioDuration(file) : Number(guide.durationSeconds || 0);
  if (file && !durationSeconds) throw new Error("El archivo no parece contener audio válido.");
  let storagePath = guide.storagePath || "";
  let audioUrl = guide.audioUrl || "";

  if (useLocal || !db) {
    if (file) {
      storagePath = `practice-guides/${songId}/${guideId}.${extensionFor(file)}`;
      audioUrl = URL.createObjectURL(file);
    }
    const guides = await loadPracticeGuides(songId, true);
    const payload = normalizeGuide(guideId, {
      ...guide,
      storagePath,
      audioUrl,
      fileName: file?.name || guide.fileName,
      mimeType: file ? mimeTypeFor(file) : guide.mimeType,
      sizeBytes: file?.size || guide.sizeBytes,
      durationSeconds,
      updatedAt: new Date().toISOString(),
      createdAt: guide.createdAt || new Date().toISOString(),
      createdBy: guide.createdBy || profile?.uid || "",
      updatedBy: profile?.uid || ""
    });
    const next = guides.some((item) => item.id === guideId)
      ? guides.map((item) => item.id === guideId ? payload : item)
      : [...guides, payload];
    saveLocal(songId, next);
    return { ...payload, audioUrl };
  }

  const payload = {
    songId,
    guideId,
    title: String(guide.title || "Guía de ensayo").trim().slice(0, 160),
    sectionType: guide.sectionType || "full",
    customSectionName: String(guide.customSectionName || "").trim().slice(0, 120),
    voicePart: guide.voicePart || "all",
    key: String(guide.key || "").trim().slice(0, 24),
    bpm: Number(guide.bpm || 0),
    timeSignature: guide.timeSignature || "4/4",
    entryNote: String(guide.entryNote || "").trim().slice(0, 16),
    notes: String(guide.notes || "").trim().slice(0, 1000),
    fileName: file?.name || guide.fileName || "",
    mimeType: file ? mimeTypeFor(file) : guide.mimeType || "",
    sizeBytes: Number(file?.size || guide.sizeBytes || 0),
    durationSeconds,
    order: Number(guide.order || 0),
    enabled: guide.enabled !== false
  };
  if (file && file.size > SERVER_PRACTICE_AUDIO_BYTES) {
    const init = await requestPracticeGuide("POST", { ...payload, mode: "direct_upload_init" });
    const uploaded = await uploadPracticeAudioDirectToGithub(init.upload, file);
    const response = await requestPracticeGuide(file || !guide.id ? "POST" : "PATCH", {
      ...payload,
      guideId: init.guideId || guideId,
      githubDirectUpload: true,
      storagePath: init.upload?.storagePath || "",
      audioUrl: init.upload?.audioUrl || "",
      commitSha: uploaded.commitSha || ""
    });
    return normalizeGuide(init.guideId || guideId, response.guide || { ...guide, ...payload });
  }
  if (file) payload.fileBase64 = await readFileAsBase64(file);
  const response = await requestPracticeGuide(file || !guide.id ? "POST" : "PATCH", payload);
  return normalizeGuide(guideId, response.guide || { ...guide, ...payload });
}

export async function deletePracticeGuide({ songId, guide, useLocal = false }) {
  if (!songId || !guide?.id) return;
  if (useLocal || !db) {
    const guides = await loadPracticeGuides(songId, true);
    if (guide.audioUrl?.startsWith("blob:")) URL.revokeObjectURL(guide.audioUrl);
    saveLocal(songId, guides.filter((item) => item.id !== guide.id));
    return;
  }
  await requestPracticeGuide("DELETE", { songId, guideId: guide.id });
}
