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
const OWNER_EMAIL = "liquea45@gmail.com";
const ONLINE_NOTIFY_COOLDOWN_MS = 20 * 60 * 1000;
const requestBuckets = new Map();

function safeString(value = "", maxLength = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeEventId(value = "") {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
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
    eventId: safeEventId(body.eventId),
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

async function saveActivityEvent(payload = {}) {
  if (!payload.eventId) {
    await admin.firestore().collection("userActivity").add(payload);
    return { duplicate: false };
  }

  const ref = admin.firestore().doc(`userActivity/${payload.eventId}`);
  let duplicate = false;
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      duplicate = true;
      return;
    }
    transaction.set(ref, payload);
  });
  return { duplicate };
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

function appBaseUrl() {
  return (process.env.PUSH_APP_BASE_URL || process.env.PUSH_ALLOWED_ORIGIN || "https://musica.rocaeternamexico.com.mx").replace(/\/$/, "");
}

function notificationIconUrl() {
  return `${appBaseUrl()}/icons/notification-icon.png`;
}

async function ownerUser() {
  const snapshot = await admin.firestore()
    .collection("users")
    .where("email", "==", OWNER_EMAIL)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return { uid: snapshot.docs[0].id, ...(snapshot.docs[0].data() || {}) };
}

async function ownerTokens(uid = "") {
  if (!uid) return [];
  const snapshot = await admin.firestore().collection(`users/${uid}/fcmTokens`).get();
  const tokens = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((item) => item.active === true && item.token && String(item.email || "").toLowerCase() === OWNER_EMAIL)
    .map((item) => item.token);
  return [...new Set(tokens)];
}

async function maybeNotifyOwnerOnline(payload = {}) {
  if (payload.email === OWNER_EMAIL) return false;
  if (payload.eventType !== "section_view" || !["enter", "route_change"].includes(payload.reason || "")) return false;

  const presenceRef = admin.firestore().doc(`userActivityPresence/${payload.uid}`);
  const now = Date.now();
  let shouldNotify = false;
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(presenceRef);
    const lastNotifiedAt = snapshot.exists ? Number(snapshot.data()?.lastOnlineNotifiedAt || 0) : 0;
    shouldNotify = !lastNotifiedAt || now - lastNotifiedAt > ONLINE_NOTIFY_COOLDOWN_MS;
    transaction.set(presenceRef, {
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName || payload.email,
      lastOnlineAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSection: payload.section || "",
      ...(shouldNotify ? { lastOnlineNotifiedAt: now } : {})
    }, { merge: true });
  });
  if (!shouldNotify) return false;

  const userName = payload.displayName || payload.email;
  const title = `${userName} está en línea`;
  const body = payload.section ? `Entró a ${payload.section}.` : "Abrió la app.";
  const owner = await ownerUser();
  await admin.firestore().collection("notifications").add({
    type: "user_online",
    title,
    message: body,
    recipientEmail: OWNER_EMAIL,
    targetUsers: owner?.uid ? [owner.uid] : [],
    targetRoles: [],
    targetViewerTypes: [],
    uid: payload.uid,
    userEmail: payload.email,
    section: payload.section || "",
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    pushNotificationId: `user-online-${payload.uid}-${now}`
  }).catch(() => undefined);

  const tokens = await ownerTokens(owner?.uid || "");
  if (!tokens.length) return true;

  await admin.messaging().sendEachForMulticast({
    tokens,
    data: {
      type: "user_online",
      title,
      body,
      recipientEmail: OWNER_EMAIL,
      userEmail: payload.email,
      uid: payload.uid,
      section: payload.section || "",
      url: "/#/configuracion"
    },
    webpush: {
      fcmOptions: {
        link: `${appBaseUrl()}/#/configuracion`
      }
    }
  });
  return true;
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
      allowedRoles: ["admin", "editor", "viewer", "corista", "musico", "músico", "musician", "medios", "medio", "media", "administrativo"],
      unauthenticatedMessage: "Necesitas iniciar sesión para registrar actividad.",
      forbiddenMessage: "No tienes permiso para registrar actividad."
    });
    enforceActivityRateLimit(requester.uid);

    const payload = safeActivityPayload(parseBody(request), requester);
    const saveResult = await saveActivityEvent(payload);

    let ownerNotified = false;
    if (!saveResult.duplicate) {
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
      ownerNotified = await maybeNotifyOwnerOnline(payload).catch(() => false);
    }

    response.status(200).json({ ok: true, ownerNotified, duplicate: saveResult.duplicate });
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
