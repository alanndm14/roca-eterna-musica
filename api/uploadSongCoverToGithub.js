import admin from "firebase-admin";
import {
  applyCors,
  encodeGithubPath,
  enforceRateLimit,
  githubRequest,
  initializeAdmin,
  isAllowedOrigin,
  parseBody,
  slugifySongTitle,
  validateSongId,
  verifyAppCheckIfRequired,
  verifyRequester
} from "./uploadSongPdfToGithub.js";

const MAX_COVER_BYTES = 1024 * 1024;
const VALID_POSITIONS = new Set(["center", "top", "bottom", "left", "right"]);
const VALID_INTENSITIES = new Set(["subtle", "medium"]);
const VALID_BACKGROUND_MODES = new Set(["image", "color"]);
const activeCoverUpdates = new Set();

function coverConfig() {
  const token = process.env.GITHUB_PDF_UPLOAD_TOKEN || "";
  const owner = process.env.GITHUB_PDF_UPLOAD_OWNER || "";
  const repo = process.env.GITHUB_PDF_UPLOAD_REPO || "";
  const branch = process.env.GITHUB_PDF_UPLOAD_BRANCH || "main";
  const basePath = String(process.env.GITHUB_COVERS_BASE_PATH || "public/covers")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!token || !owner || !repo) {
    const error = new Error("La función de portadas no está configurada en el servidor.");
    error.status = 503;
    error.code = "GITHUB_COVER_UPLOAD_NOT_CONFIGURED";
    throw error;
  }
  if (basePath !== "public/covers") {
    const error = new Error("La ruta configurada para portadas no es válida.");
    error.status = 503;
    error.code = "INVALID_COVER_BASE_PATH";
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

function safePosition(value) {
  return VALID_POSITIONS.has(value) ? value : "center";
}

function safeIntensity(value) {
  return VALID_INTENSITIES.has(value) ? value : "subtle";
}

function safeBackgroundMode(value) {
  return VALID_BACKGROUND_MODES.has(value) ? value : "image";
}

function safeBackgroundOpacity(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 14;
  return Math.min(36, Math.max(4, Math.round(numericValue)));
}

function safeAccent(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? String(value).toLowerCase() : "#b6945f";
}

function existingCoverFileName(song = {}) {
  const cleanPath = String(song.coverImagePath || "")
    .split(/[?#]/)[0]
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^public\//i, "");
  if (!cleanPath.startsWith("covers/")) return "";
  const fileName = cleanPath.slice("covers/".length);
  if (!/^[a-z0-9][a-z0-9-]{0,119}\.webp$/.test(fileName)) return "";
  return fileName;
}

function resolveCoverFileName(song = {}, requested = "") {
  const existing = existingCoverFileName(song);
  if (existing) return existing;
  const requestedName = String(requested || "").trim().toLowerCase();
  if (requestedName && /^[a-z0-9][a-z0-9-]{0,119}\.webp$/.test(requestedName)) return requestedName;
  return `${slugifySongTitle(song.title)}.webp`;
}

function coverBuffer(body = {}) {
  if (String(body.contentType || "").toLowerCase() !== "image/webp") {
    const error = new Error("El archivo no es una imagen válida.");
    error.status = 400;
    error.code = "INVALID_COVER_TYPE";
    throw error;
  }
  const fileBase64 = String(body.fileBase64 || "").replace(/\s/g, "");
  if (!fileBase64 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(fileBase64)) {
    const error = new Error("El contenido de la portada no es válido.");
    error.status = 400;
    error.code = "INVALID_COVER_BASE64";
    throw error;
  }
  if (fileBase64.length > Math.ceil(MAX_COVER_BYTES * 4 / 3) + 8) {
    const error = new Error("La imagen procesada supera el tamaño permitido.");
    error.status = 413;
    error.code = "COVER_TOO_LARGE";
    throw error;
  }
  const buffer = Buffer.from(fileBase64, "base64");
  const isWebp = buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!buffer.length || buffer.length > MAX_COVER_BYTES || !isWebp) {
    const error = new Error(buffer.length > MAX_COVER_BYTES
      ? "La imagen procesada supera el tamaño permitido."
      : "El archivo no es una imagen WebP válida.");
    error.status = buffer.length > MAX_COVER_BYTES ? 413 : 400;
    error.code = buffer.length > MAX_COVER_BYTES ? "COVER_TOO_LARGE" : "INVALID_COVER_SIGNATURE";
    throw error;
  }
  return buffer;
}

function contentUrl(config, repoPath) {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeGithubPath(repoPath)}`;
}

async function getGithubFile(config, repoPath) {
  const lookup = await githubRequest(
    `${contentUrl(config, repoPath)}?ref=${encodeURIComponent(config.branch)}`,
    { method: "GET" },
    config
  );
  if (!lookup.response.ok && lookup.response.status !== 404) {
    const error = new Error("No se pudo consultar la portada actual en GitHub.");
    error.status = lookup.response.status === 401 || lookup.response.status === 403 ? 503 : 502;
    error.code = "GITHUB_COVER_LOOKUP_FAILED";
    throw error;
  }
  return lookup.response.ok ? lookup.payload : null;
}

async function putGithubCover({ config, repoPath, buffer, songTitle }) {
  const current = await getGithubFile(config, repoPath);
  const exists = Boolean(current?.sha);
  const body = {
    message: `${exists ? "Update" : "Add"} cover for ${songTitle}`,
    content: buffer.toString("base64"),
    branch: config.branch,
    ...(exists ? { sha: current.sha } : {}),
    ...(config.committerName && config.committerEmail ? {
      committer: { name: config.committerName, email: config.committerEmail }
    } : {})
  };
  const upload = await githubRequest(contentUrl(config, repoPath), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, config);
  if (!upload.response.ok) {
    const error = new Error(upload.response.status === 409
      ? "Hubo un conflicto al reemplazar el archivo."
      : "No se pudo actualizar la portada en GitHub.");
    error.status = upload.response.status === 409 ? 409 : 502;
    error.code = upload.response.status === 409 ? "GITHUB_CONFLICT" : "GITHUB_COVER_UPLOAD_FAILED";
    throw error;
  }
  return {
    created: !exists,
    commitSha: upload.payload.commit?.sha || "",
    contentSha: upload.payload.content?.sha || ""
  };
}

async function deleteGithubCover({ config, repoPath, songTitle }) {
  const current = await getGithubFile(config, repoPath);
  if (!current?.sha) return { deleted: false, missing: true };
  const body = {
    message: `Delete cover for ${songTitle}`,
    sha: current.sha,
    branch: config.branch,
    ...(config.committerName && config.committerEmail ? {
      committer: { name: config.committerName, email: config.committerEmail }
    } : {})
  };
  const result = await githubRequest(contentUrl(config, repoPath), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, config);
  if (!result.response.ok) {
    const error = new Error(result.response.status === 409
      ? "Hubo un conflicto al eliminar la portada."
      : "No se pudo eliminar la portada de GitHub.");
    error.status = result.response.status === 409 ? 409 : 502;
    error.code = result.response.status === 409 ? "GITHUB_CONFLICT" : "GITHUB_COVER_DELETE_FAILED";
    throw error;
  }
  return { deleted: true, commitSha: result.payload.commit?.sha || "" };
}

async function auditCover({ actionType, songRef, song, requester, beforeData, afterData }) {
  try {
    await admin.firestore().collection("auditLogs").add({
      actionType,
      entityType: "song",
      entityId: songRef.id,
      entityName: song.title || "",
      summary: `${actionType}: ${song.title || songRef.id}`,
      beforeData: beforeData || null,
      afterData: afterData || null,
      performedByUid: requester.uid,
      performedByName: requester.displayName,
      performedByEmail: requester.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.warn("[cover-upload] No se pudo registrar auditoría.", {
      code: error.code || "",
      message: error.message || ""
    });
  }
}

function coverFieldsToDelete() {
  const remove = admin.firestore.FieldValue.delete();
  return {
    coverImagePath: remove,
    coverFileName: remove,
    coverVersion: remove,
    coverEnabled: remove,
    coverPosition: remove,
    coverIntensity: remove,
    coverBackgroundMode: remove,
    coverBackgroundOpacity: remove,
    coverAccentColor: remove,
    coverUpdatedAt: remove,
    coverUpdatedBy: remove,
    coverUpdatedByName: remove
  };
}

function safeError(error = {}) {
  return {
    ok: false,
    code: error.code || "COVER_UPDATE_FAILED",
    message: error.message || "No se pudo actualizar la portada.",
    stage: "song_cover"
  };
}

export default async function handler(request, response) {
  applyCors(request, response, "POST, DELETE, OPTIONS");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (!["POST", "DELETE"].includes(request.method)) {
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
      forbiddenMessage: "No tienes permiso para actualizar portadas."
    });
    enforceRateLimit(requester.uid, "cover");
    const body = parseBody(request);
    const songId = validateSongId(body.songId);
    updateKey = `${requester.uid}:${songId}`;
    if (activeCoverUpdates.has(updateKey)) {
      const error = new Error("Ya hay una actualización de portada en curso para este canto.");
      error.status = 409;
      error.code = "COVER_UPDATE_IN_PROGRESS";
      throw error;
    }
    activeCoverUpdates.add(updateKey);

    const songRef = admin.firestore().doc(`songs/${songId}`);
    const snapshot = await songRef.get();
    if (!snapshot.exists) {
      const error = new Error("El canto ya no existe.");
      error.status = 404;
      error.code = "SONG_NOT_FOUND";
      throw error;
    }
    const song = snapshot.data() || {};

    if (request.method === "POST") {
      const config = coverConfig();
      const buffer = coverBuffer(body);
      const fileName = resolveCoverFileName(song, body.desiredFileName);
      const repoPath = `${config.basePath}/${fileName}`;
      const github = await putGithubCover({
        config,
        repoPath,
        buffer,
        songTitle: song.title || body.songTitle || songId
      });
      const version = Date.now();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      const metadata = {
        coverImagePath: `/covers/${fileName}`,
        coverFileName: fileName,
        coverVersion: version,
        coverEnabled: body.coverEnabled !== false,
        coverPosition: safePosition(body.coverPosition),
        coverIntensity: safeIntensity(body.coverIntensity),
        coverBackgroundMode: safeBackgroundMode(body.coverBackgroundMode),
        coverBackgroundOpacity: safeBackgroundOpacity(body.coverBackgroundOpacity),
        coverAccentColor: safeAccent(body.coverAccentColor),
        coverUpdatedAt: timestamp,
        coverUpdatedBy: requester.uid,
        coverUpdatedByName: requester.displayName,
        updatedAt: timestamp
      };
      try {
        await songRef.update(metadata);
      } catch {
        const error = new Error("La portada se subió, pero no se pudo actualizar el canto.");
        error.status = 502;
        error.code = "COVER_METADATA_UPDATE_FAILED";
        throw error;
      }
      await auditCover({
        actionType: github.created ? "song_cover_uploaded" : "song_cover_replaced",
        songRef,
        song,
        requester,
        beforeData: { coverImagePath: song.coverImagePath || "", coverVersion: song.coverVersion || null },
        afterData: { ...metadata, coverUpdatedAt: new Date().toISOString(), commitSha: github.commitSha }
      });
      response.status(github.created ? 201 : 200).json({
        ok: true,
        created: github.created,
        songId,
        coverImagePath: metadata.coverImagePath,
        coverFileName: fileName,
        coverVersion: version,
        coverEnabled: metadata.coverEnabled,
        coverPosition: metadata.coverPosition,
        coverIntensity: metadata.coverIntensity,
        coverBackgroundMode: metadata.coverBackgroundMode,
        coverBackgroundOpacity: metadata.coverBackgroundOpacity,
        coverAccentColor: metadata.coverAccentColor,
        coverUpdatedAt: new Date().toISOString(),
        coverUpdatedBy: requester.uid,
        coverUpdatedByName: requester.displayName,
        message: "La portada se actualizó correctamente."
      });
      return;
    }

    const deleteMode = body.mode === "delete" ? "delete" : "unlink";
    if (deleteMode === "delete" && requester.role !== "admin") {
      const error = new Error("Solo un administrador puede eliminar la portada definitivamente.");
      error.status = 403;
      error.code = "ADMIN_REQUIRED";
      throw error;
    }
    const fileName = existingCoverFileName(song);
    let githubResult = null;
    if (deleteMode === "delete" && fileName) {
      const config = coverConfig();
      githubResult = await deleteGithubCover({
        config,
        repoPath: `${config.basePath}/${fileName}`,
        songTitle: song.title || songId
      });
    }
    await songRef.update({ ...coverFieldsToDelete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await auditCover({
      actionType: deleteMode === "delete" ? "song_cover_deleted" : "song_cover_unlinked",
      songRef,
      song,
      requester,
      beforeData: {
        coverImagePath: song.coverImagePath || "",
        coverVersion: song.coverVersion || null
      },
      afterData: {
        removed: true,
        physicalFileDeleted: deleteMode === "delete" && Boolean(githubResult?.deleted)
      }
    });
    response.status(200).json({
      ok: true,
      songId,
      removed: true,
      deleted: deleteMode === "delete" && Boolean(githubResult?.deleted),
      message: deleteMode === "delete" ? "La portada se eliminó definitivamente." : "La portada se quitó de la app."
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) {
      console.error("[cover-upload]", {
        code: error.code || "",
        message: error.message || "Error interno"
      });
    }
    response.status(status).json(safeError(error));
  } finally {
    if (updateKey) activeCoverUpdates.delete(updateKey);
  }
}
