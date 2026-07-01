import admin from "firebase-admin";
import {
  applyCors,
  initializeAdmin,
  isAllowedOrigin,
  parseBody,
  verifyAppCheckIfRequired,
  verifyRequester
} from "./uploadSongPdfToGithub.js";

const VALID_EVENT_TYPES = new Set(["section_view", "click", "disconnect"]);
const MAX_DURATION_MS = 8 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 180;
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

function safeActivityPayload(body = {}, requester = {}) {
  const eventType = safeString(body.eventType, 40);
  if (!VALID_EVENT_TYPES.has(eventType)) {
    const error = new Error("Tipo de actividad no válido.");
    error.status = 400;
    error.code = "INVALID_ACTIVITY_TYPE";
    throw error;
  }

  return {
    uid: requester.uid,
    email: requester.email,
    displayName: requester.displayName || requester.email,
    role: requester.role || "",
    viewerType: requester.viewerType || "",
    eventType,
    section: safeString(body.section, 80),
    route: safeString(body.route, 240),
    sessionId: safeString(body.sessionId, 80),
    targetLabel: safeString(body.targetLabel, 180),
    targetTag: safeString(body.targetTag, 40),
    targetRole: safeString(body.targetRole, 40),
    targetHref: safeString(body.targetHref, 240),
    reason: safeString(body.reason, 60),
    startedAt: safeString(body.startedAt, 40),
    endedAt: safeString(body.endedAt, 40),
    clientTimestamp: safeString(body.clientTimestamp, 40) || new Date().toISOString(),
    durationMs: safeDuration(body.durationMs),
    userAgent: safeString(body.userAgent, 260),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function responseError(error = {}) {
  return {
    ok: false,
    code: error.code || "ACTIVITY_LOG_FAILED",
    message: error.message || "No se pudo registrar la actividad."
  };
}

function enforceActivityRateLimit(uid = "") {
  const now = Date.now();
  const recent = (requestBuckets.get(uid) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const error = new Error("Hay demasiados eventos de actividad. Intenta de nuevo en un momento.");
    error.status = 429;
    error.code = "RATE_LIMITED";
    throw error;
  }
  recent.push(now);
  requestBuckets.set(uid, recent);
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
    initializeAdmin();
    await verifyAppCheckIfRequired(request);
    const requester = await verifyRequester(request, {
      allowedRoles: ["admin", "editor", "viewer"],
      unauthenticatedMessage: "Necesitas iniciar sesión para registrar actividad.",
      forbiddenMessage: "No tienes permiso para registrar actividad."
    });
    enforceActivityRateLimit(requester.uid);

    const payload = safeActivityPayload(parseBody(request), requester);
    await admin.firestore().collection("userActivity").add(payload);

    const userUpdate = {
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivitySection: payload.section
    };
    if (payload.durationMs > 0) {
      userUpdate.activityTotalMs = admin.firestore.FieldValue.increment(payload.durationMs);
    }
    if (payload.eventType === "disconnect") {
      userUpdate.lastDisconnectedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await admin.firestore().doc(`users/${requester.uid}`).set(userUpdate, { merge: true });

    response.status(200).json({ ok: true });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) {
      console.error("[activity-log]", {
        code: error.code || "",
        message: error.message || "Error interno"
      });
    }
    response.status(status).json(responseError(error));
  }
}
