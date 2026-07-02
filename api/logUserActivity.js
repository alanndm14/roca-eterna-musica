import admin from "firebase-admin";
import {
  applyCors,
  initializeAdmin,
  isAllowedOrigin,
  parseBody,
  verifyAppCheckIfRequired,
  verifyRequester
} from "./uploadSongPdfToGithub.js";

const MAX_DURATION_MS = 8 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const requestBuckets = new Map();

function safeString(value = "", maxLength = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeDuration(value = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(MAX_DURATION_MS, Math.round(numeric)));
}

function enforceDisconnectRateLimit(uid = "") {
  const now = Date.now();
  const recent = (requestBuckets.get(uid) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const error = new Error("Hay demasiados registros de desconexión. Intenta de nuevo en un momento.");
    error.status = 429;
    error.code = "RATE_LIMITED";
    throw error;
  }
  recent.push(now);
  requestBuckets.set(uid, recent);
}

function responseError(error = {}) {
  return {
    ok: false,
    code: error.code || "DISCONNECT_LOG_FAILED",
    message: error.message || "No se pudo registrar la desconexión."
  };
}

export default async function handler(request, response) {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Método no permitido." });
    return;
  }
  if (!isAllowedOrigin(request.headers.origin || "")) {
    response.status(403).json({ ok: false, code: "ORIGIN_NOT_ALLOWED", message: "Origen no permitido." });
    return;
  }

  try {
    const body = parseBody(request);
    if (safeString(body.eventType, 40) !== "disconnect") {
      response.status(200).json({ ok: true, ignored: true });
      return;
    }

    initializeAdmin();
    await verifyAppCheckIfRequired(request);
    const requester = await verifyRequester(request, {
      allowedRoles: ["admin", "editor", "viewer", "corista", "musico", "músico", "musician", "medios", "medio", "media"],
      unauthenticatedMessage: "Necesitas iniciar sesión para registrar desconexión.",
      forbiddenMessage: "No tienes permiso para registrar desconexión."
    });
    enforceDisconnectRateLimit(requester.uid);

    await admin.firestore().doc(`users/${requester.uid}`).set({
      lastDisconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastDisconnectClientAt: safeString(body.endedAt, 40) || new Date().toISOString(),
      lastDisconnectReason: safeString(body.reason, 60),
      lastSessionDurationMs: safeDuration(body.durationMs)
    }, { merge: true });

    response.status(200).json({ ok: true, saved: "disconnect" });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) {
      console.error("[disconnect-log]", {
        code: error.code || "",
        message: error.message || "Error interno"
      });
    }
    response.status(status).json(responseError(error));
  }
}
