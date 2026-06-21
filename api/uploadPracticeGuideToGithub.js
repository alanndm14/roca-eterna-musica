import admin from "firebase-admin";
import {
  applyCors,
  encodeGithubPath,
  enforceRateLimit,
  githubRequest,
  initializeAdmin,
  isAllowedOrigin,
  parseBody,
  verifyAppCheckIfRequired,
  verifyRequester
} from "./uploadSongPdfToGithub.js";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/wav", "wav"],
  ["audio/ogg", "ogg"]
]);
const VALID_SECTIONS = new Set(["full", "verse", "prechorus", "chorus", "bridge", "final-chorus", "intro", "outro", "other"]);
const VALID_VOICES = new Set(["all", "melody", "soprano", "alto", "tenor", "second", "other"]);
const VALID_SIGNATURES = new Set(["2/4", "3/4", "4/4", "6/8"]);
const activeUpdates = new Set();

function safeSegment(value = "", fallback = "archivo") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || fallback;
}

function validateId(value, label) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    const error = new Error(`${label} no es válido.`);
    error.status = 400;
    error.code = "INVALID_ID";
    throw error;
  }
  return id;
}

function practiceConfig() {
  const token = process.env.GITHUB_PDF_UPLOAD_TOKEN || "";
  const owner = process.env.GITHUB_PDF_UPLOAD_OWNER || "";
  const repo = process.env.GITHUB_PDF_UPLOAD_REPO || "";
  const branch = process.env.GITHUB_PDF_UPLOAD_BRANCH || "main";
  const basePath = String(process.env.GITHUB_PRACTICE_GUIDES_BASE_PATH || "public/practice-guides")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!token || !owner || !repo) {
    const error = new Error("La subida de guías no está configurada en el servidor.");
    error.status = 503;
    error.code = "GITHUB_PRACTICE_UPLOAD_NOT_CONFIGURED";
    throw error;
  }
  if (basePath !== "public/practice-guides") {
    const error = new Error("La ruta configurada para guías no es válida.");
    error.status = 503;
    error.code = "INVALID_PRACTICE_GUIDES_PATH";
    throw error;
  }
  return {
    token,
    owner,
    repo,
    branch,
    basePath,
    committerName: process.env.GITHUB_PDF_UPLOAD_COMMITTER_NAME || "",
    committerEmail: process.env.GITHUB_PDF_UPLOAD_COMMITTER_EMAIL || ""
  };
}

function contentUrl(config, repoPath) {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeGithubPath(repoPath)}`;
}

async function getGithubFile(config, repoPath) {
  const result = await githubRequest(
    `${contentUrl(config, repoPath)}?ref=${encodeURIComponent(config.branch)}`,
    { method: "GET" },
    config
  );
  if (!result.response.ok && result.response.status !== 404) {
    const error = new Error("No se pudo consultar la guía actual en GitHub.");
    error.status = result.response.status === 401 || result.response.status === 403 ? 503 : 502;
    error.code = "GITHUB_PRACTICE_LOOKUP_FAILED";
    throw error;
  }
  return result.response.ok ? result.payload : null;
}

async function putGithubFile(config, repoPath, buffer, title) {
  const current = await getGithubFile(config, repoPath);
  const body = {
    message: `${current?.sha ? "Update" : "Add"} vocal practice guide for ${title}`,
    content: buffer.toString("base64"),
    branch: config.branch,
    ...(current?.sha ? { sha: current.sha } : {}),
    ...(config.committerName && config.committerEmail ? {
      committer: { name: config.committerName, email: config.committerEmail }
    } : {})
  };
  const result = await githubRequest(contentUrl(config, repoPath), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, config);
  if (!result.response.ok) {
    const error = new Error(result.response.status === 409
      ? "Hubo un conflicto al guardar la guía. Intenta nuevamente."
      : "No se pudo guardar la guía en GitHub.");
    error.status = result.response.status === 409 ? 409 : 502;
    error.code = result.response.status === 409 ? "GITHUB_CONFLICT" : "GITHUB_PRACTICE_UPLOAD_FAILED";
    throw error;
  }
  return result.payload.commit?.sha || "";
}

async function deleteGithubFile(config, repoPath, title) {
  if (!repoPath) return false;
  const current = await getGithubFile(config, repoPath);
  if (!current?.sha) return false;
  const result = await githubRequest(contentUrl(config, repoPath), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Delete vocal practice guide for ${title}`,
      sha: current.sha,
      branch: config.branch,
      ...(config.committerName && config.committerEmail ? {
        committer: { name: config.committerName, email: config.committerEmail }
      } : {})
    })
  }, config);
  if (!result.response.ok) {
    const error = new Error("No se pudo eliminar la guía de GitHub.");
    error.status = result.response.status === 409 ? 409 : 502;
    error.code = "GITHUB_PRACTICE_DELETE_FAILED";
    throw error;
  }
  return true;
}

function audioBuffer(body = {}) {
  const mimeType = String(body.mimeType || "").toLowerCase();
  const extension = ALLOWED_TYPES.get(mimeType);
  if (!extension) {
    const error = new Error("Formato no permitido. Usa MP3, M4A, WAV u OGG.");
    error.status = 400;
    error.code = "INVALID_AUDIO_TYPE";
    throw error;
  }
  const fileBase64 = String(body.fileBase64 || "").replace(/\s/g, "");
  if (!fileBase64 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(fileBase64)) {
    const error = new Error("El contenido del audio no es válido.");
    error.status = 400;
    error.code = "INVALID_AUDIO_BASE64";
    throw error;
  }
  if (fileBase64.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 8) {
    const error = new Error("La guía supera el límite de 3 MB.");
    error.status = 413;
    error.code = "AUDIO_TOO_LARGE";
    throw error;
  }
  const buffer = Buffer.from(fileBase64, "base64");
  if (!buffer.length || buffer.length > MAX_AUDIO_BYTES) {
    const error = new Error("La guía supera el límite de 3 MB.");
    error.status = 413;
    error.code = "AUDIO_TOO_LARGE";
    throw error;
  }
  const validSignature = mimeType === "audio/mpeg"
    ? buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
    : mimeType === "audio/wav"
      ? buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE"
      : mimeType === "audio/ogg"
        ? buffer.subarray(0, 4).toString("ascii") === "OggS"
        : buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (!validSignature) {
    const error = new Error("El archivo no parece contener audio válido.");
    error.status = 400;
    error.code = "INVALID_AUDIO_SIGNATURE";
    throw error;
  }
  return { buffer, extension, mimeType };
}

function rawGithubUrl(config, repoPath) {
  return `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/${encodeURIComponent(config.branch)}/${repoPath.split("/").map(encodeURIComponent).join("/")}`;
}

function guidePayload(body, requester, storagePath, audioUrl, existing = {}) {
  const bpm = Number(body.bpm || 0);
  const durationSeconds = Number(body.durationSeconds || 0);
  const order = Number(body.order || 0);
  return {
    title: String(body.title || "Guía de ensayo").trim().slice(0, 160),
    sectionType: VALID_SECTIONS.has(body.sectionType) ? body.sectionType : "full",
    customSectionName: String(body.customSectionName || "").trim().slice(0, 120),
    voicePart: VALID_VOICES.has(body.voicePart) ? body.voicePart : "all",
    key: String(body.key || "").trim().slice(0, 24),
    bpm: Number.isFinite(bpm) ? Math.max(0, Math.min(240, Math.round(bpm))) : 0,
    timeSignature: VALID_SIGNATURES.has(body.timeSignature) ? body.timeSignature : "4/4",
    entryNote: String(body.entryNote || "").trim().slice(0, 16),
    notes: String(body.notes || "").trim().slice(0, 1000),
    storagePath,
    audioUrl,
    fileName: String(body.fileName || existing.fileName || "").trim().slice(0, 180),
    mimeType: String(body.mimeType || existing.mimeType || "").trim().slice(0, 80),
    sizeBytes: Math.max(0, Number(body.sizeBytes || existing.sizeBytes || 0)),
    durationSeconds: Math.max(0, Number.isFinite(durationSeconds) ? durationSeconds : 0),
    order: Number.isFinite(order) ? Math.max(0, Math.round(order)) : 0,
    enabled: body.enabled !== false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: requester.uid
  };
}

async function auditGuide({ actionType, songId, songTitle, guideId, requester, beforeData, afterData }) {
  try {
    await admin.firestore().collection("auditLogs").add({
      actionType,
      entityType: "practiceGuide",
      entityId: guideId,
      entityName: afterData?.title || beforeData?.title || guideId,
      summary: `${actionType}: ${songTitle}`,
      beforeData: beforeData || null,
      afterData: afterData || null,
      parentSongId: songId,
      performedByUid: requester.uid,
      performedByName: requester.displayName,
      performedByEmail: requester.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.warn("[practice-guide] No se pudo registrar auditoría.", {
      code: error.code || "",
      message: error.message || ""
    });
  }
}

function publicGuideData(guideId, data = {}, createdAt = "") {
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...safeData
  } = data;
  return {
    id: guideId,
    ...safeData,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export default async function handler(request, response) {
  applyCors(request, response, "POST, PATCH, DELETE, OPTIONS");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (!["POST", "PATCH", "DELETE"].includes(request.method)) {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Método no permitido." });
    return;
  }
  if (!isAllowedOrigin(request.headers.origin || "")) {
    response.status(403).json({ ok: false, code: "ORIGIN_NOT_ALLOWED", message: "Origen no permitido." });
    return;
  }

  let updateKey = "";
  try {
    initializeAdmin();
    await verifyAppCheckIfRequired(request);
    const requester = await verifyRequester(request, {
      unauthenticatedMessage: "No se pudo validar tu sesión.",
      forbiddenMessage: "No tienes permiso para administrar guías vocales."
    });
    const memberType = String(requester.viewerType || "").trim().toLowerCase();
    const fullAdmin = requester.role === "admin" && requester.adminMode !== "administrative";
    if (!fullAdmin && !["corista", "musico"].includes(memberType)) {
      const error = new Error("Esta función está reservada para integrantes musicales.");
      error.status = 403;
      error.code = "MUSICAL_PROFILE_REQUIRED";
      throw error;
    }
    enforceRateLimit(requester.uid, "practice-guide");
    const body = parseBody(request);
    const songId = validateId(body.songId, "El canto");
    const guideId = validateId(body.guideId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, "La guía");
    updateKey = `${requester.uid}:${songId}:${guideId}`;
    if (activeUpdates.has(updateKey)) {
      const error = new Error("Ya hay una actualización en curso para esta guía.");
      error.status = 409;
      error.code = "PRACTICE_GUIDE_UPDATE_IN_PROGRESS";
      throw error;
    }
    activeUpdates.add(updateKey);

    const songRef = admin.firestore().doc(`songs/${songId}`);
    const songSnapshot = await songRef.get();
    if (!songSnapshot.exists) {
      const error = new Error("El canto ya no existe.");
      error.status = 404;
      error.code = "SONG_NOT_FOUND";
      throw error;
    }
    const song = songSnapshot.data() || {};
    const guideRef = songRef.collection("practiceGuides").doc(guideId);
    const guideSnapshot = await guideRef.get();
    const existing = guideSnapshot.exists ? guideSnapshot.data() || {} : {};
    const config = practiceConfig();

    if (request.method === "DELETE") {
      await deleteGithubFile(config, String(existing.storagePath || ""), song.title || songId);
      await guideRef.delete();
      await auditGuide({
        actionType: "practice_guide_deleted",
        songId,
        songTitle: song.title || songId,
        guideId,
        requester,
        beforeData: existing,
        afterData: { deleted: true }
      });
      response.status(200).json({ ok: true, deleted: true });
      return;
    }

    const previousStoragePath = String(existing.storagePath || "");
    let storagePath = previousStoragePath;
    let commitSha = "";
    if (body.fileBase64) {
      const audio = audioBuffer(body);
      const fileName = `${safeSegment(body.title || existing.title || "guia")}-${guideId}.${audio.extension}`;
      const nextPath = `${config.basePath}/${safeSegment(songId, "canto")}/${fileName}`;
      commitSha = await putGithubFile(config, nextPath, audio.buffer, song.title || songId);
      storagePath = nextPath;
    }
    if (!storagePath) {
      const error = new Error("Selecciona un archivo de audio para crear la guía.");
      error.status = 400;
      error.code = "AUDIO_REQUIRED";
      throw error;
    }

    const payload = guidePayload(body, requester, storagePath, rawGithubUrl(config, storagePath), existing);
    if (!guideSnapshot.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
      payload.createdBy = requester.uid;
    }
    try {
      await guideRef.set(payload, { merge: true });
    } catch (writeError) {
      if (body.fileBase64 && storagePath !== previousStoragePath) {
        await deleteGithubFile(config, storagePath, song.title || songId).catch(() => false);
      }
      const error = new Error("El audio se procesó, pero no se pudo guardar la guía.");
      error.status = 502;
      error.code = "PRACTICE_GUIDE_METADATA_FAILED";
      error.cause = writeError;
      throw error;
    }
    if (body.fileBase64 && previousStoragePath && previousStoragePath !== storagePath) {
      await deleteGithubFile(config, previousStoragePath, song.title || songId).catch(() => false);
    }
    const responseGuide = publicGuideData(guideId, {
      ...existing,
      ...payload
    }, guideSnapshot.exists ? existing.createdAt : new Date().toISOString());
    await auditGuide({
      actionType: guideSnapshot.exists ? "practice_guide_updated" : "practice_guide_created",
      songId,
      songTitle: song.title || songId,
      guideId,
      requester,
      beforeData: guideSnapshot.exists ? existing : null,
      afterData: { ...responseGuide, commitSha }
    });
    response.status(guideSnapshot.exists ? 200 : 201).json({
      ok: true,
      guide: responseGuide,
      message: "La guía de ensayo se guardó correctamente."
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) {
      console.error("[practice-guide]", {
        code: error.code || "",
        message: error.message || "Error interno"
      });
    }
    response.status(status).json({
      ok: false,
      code: error.code || "PRACTICE_GUIDE_FAILED",
      message: error.message || "No se pudo actualizar la guía de ensayo."
    });
  } finally {
    if (updateKey) activeUpdates.delete(updateKey);
  }
}
