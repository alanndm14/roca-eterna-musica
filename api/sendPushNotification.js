import admin from "firebase-admin";

const allowedTypes = new Set(["new_schedule", "new_song", "updated_schedule", "self_test_data_only", "other"]);
const BROADCAST_TOPIC = "roca-eterna-updates";
const invalidTokenCodes = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
]);
const DEFAULT_ALLOWED_ORIGINS = [
  "https://musica.rocaeternamexico.com.mx",
  "https://alanndm14.github.io"
];
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const FAILED_DELIVERY_RETRY_AFTER_MS = 5 * 60 * 1000;
const STALE_SENDING_AFTER_MS = 2 * 60 * 1000;
const requestBuckets = new Map();
const FCM_OPERATION_TIMEOUT_MS = 12000;
const FIRESTORE_OPERATION_TIMEOUT_MS = 4000;

function withTimeout(promise, label = "Operacion FCM", options = {}) {
  const timeoutMs = options.timeoutMs || FCM_OPERATION_TIMEOUT_MS;
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => {
      const error = new Error(`${label} excedio el tiempo de espera.`);
      error.code = options.code || "FCM_TIMEOUT";
      error.stage = options.stage || "send_fcm";
      reject(error);
    }, timeoutMs))
  ]);
}

function withFirestoreTimeout(promise, stage, label) {
  return withTimeout(promise, label, {
    timeoutMs: FIRESTORE_OPERATION_TIMEOUT_MS,
    code: "FIRESTORE_TIMEOUT",
    stage
  });
}

function initializeAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "";

  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error("Firebase Admin no esta configurado en el backend.");
    error.code = "BACKEND_CONFIG_MISSING";
    throw error;
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
    ...(storageBucket ? { storageBucket } : {})
  });
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}

function maskToken(token = "") {
  if (!token) return "";
  if (token.length <= 14) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function sanitizeError(error = {}) {
  return {
    code: error.code || error.errorInfo?.code || "",
    message: error.message || String(error),
    details: error.details || error.errorInfo?.message || ""
  };
}

function isInvalidTokenError(error = {}) {
  const code = error.code || error.errorInfo?.code || "";
  const message = error.message || "";
  return invalidTokenCodes.has(code)
    || (code === "messaging/invalid-argument" && message.toLowerCase().includes("registration token"));
}

function isQuotaError(error = {}) {
  const code = String(error.code || error.errorInfo?.code || "");
  const message = String(error.message || "");
  return code.includes("RESOURCE_EXHAUSTED")
    || code.includes("resource-exhausted")
    || code === "8"
    || message.includes("RESOURCE_EXHAUSTED")
    || message.toLowerCase().includes("quota exceeded");
}

function isTransientFirestoreError(error = {}) {
  const code = String(error.code || error.errorInfo?.code || "");
  return isQuotaError(error) || code === "FIRESTORE_TIMEOUT";
}

function isPreconditionError(error = {}) {
  const code = String(error.code || error.errorInfo?.code || "");
  const message = String(error.message || "");
  return code.includes("FAILED_PRECONDITION")
    || code.includes("failed-precondition")
    || code === "9"
    || message.includes("FAILED_PRECONDITION");
}

function firestoreStage(stage = "") {
  return ["check_role", "read_tokens", "dedupe", "cleanup_invalid_tokens"].includes(stage);
}

function environmentDiagnostic() {
  return {
    hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    adminInitialized: admin.apps.length > 0,
    adminProjectId: admin.app().options.projectId || process.env.FIREBASE_PROJECT_ID || ""
  };
}

function logSafe(label, payload) {
  console.log(label, JSON.stringify(payload));
}

function normalizeOrigin(origin = "") {
  return String(origin || "").replace(/\/$/, "");
}

function allowedOrigins() {
  const raw = process.env.PUSH_ALLOWED_ORIGIN || process.env.PUSH_ALLOWED_ORIGINS || "";
  const configured = raw
    .split(",")
    .map((item) => normalizeOrigin(item.trim()))
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function isAllowedOrigin(origin = "") {
  if (!origin) return true;
  return allowedOrigins().has(normalizeOrigin(origin));
}

function applyCors(request, response) {
  const origin = normalizeOrigin(request.headers.origin || "");
  if (isAllowedOrigin(origin)) {
  response.setHeader("Access-Control-Allow-Origin", origin || [...allowedOrigins()][0]);
  response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
  response.setHeader("X-Push-Backend-Revision", "direct-token-fallback-20260621");
}

function appBaseUrl() {
  return (process.env.PUSH_APP_BASE_URL || process.env.PUSH_ALLOWED_ORIGIN || "https://alanndm14.github.io/roca-eterna-musica").replace(/\/$/, "");
}

function safeInternalUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return "/";
  if (/^https?:\/\//i.test(value)) {
    const parsed = new URL(value);
    const appUrl = new URL(appBaseUrl());
    if (parsed.origin !== appUrl.origin) {
      const error = new Error("La URL de la notificacion debe pertenecer a la app.");
      error.status = 400;
      error.stage = "validate_payload";
      throw error;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  }
  if (value.startsWith("/") || value.startsWith("#/")) return value;
  return `/${value}`;
}

function absoluteAppUrl(url = "") {
  const safeUrl = safeInternalUrl(url);
  const base = appBaseUrl();
  if (!safeUrl) return `${base}/`;
  if (safeUrl.startsWith("/#/")) return `${base}${safeUrl}`;
  if (safeUrl.startsWith("#/")) return `${base}/${safeUrl}`;
  if (safeUrl.startsWith("/")) return `${base}${safeUrl}`;
  return `${base}/${safeUrl}`;
}

function publicIconUrl() {
  return `${appBaseUrl()}/icons/pwa-192.png`;
}

function stringData(payload) {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value ?? "")]));
}

async function verifyRequester(request) {
  const authHeader = request.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    const error = new Error("Falta token de autenticacion.");
    error.status = 401;
    error.stage = "verify_id_token";
    throw error;
  }
  return admin.auth().verifyIdToken(idToken);
}

async function verifyAppCheckIfRequired(request) {
  if (process.env.REQUIRE_APP_CHECK !== "true") return;
  const appCheckToken = request.headers["x-firebase-appcheck"] || "";
  if (!appCheckToken) {
    // Mantener ID token, rol y origen como barreras obligatorias mientras el
    // cliente publicado termina de recibir su clave de App Check.
    logSafe("App Check warning", {
      stage: "verify_app_check",
      message: "Cliente autenticado sin token de App Check; se permitio compatibilidad temporal."
    });
    return;
  }
  await admin.appCheck().verifyToken(appCheckToken);
}

function isMediaSlidesPushRequest(payload = {}) {
  return payload.mode === "targeted"
    && payload.audience === "admins_media"
    && payload.type === "other"
    && String(payload.notificationId || "").startsWith("slides-ready-")
    && Boolean(payload.scheduleId);
}

async function checkRole(decoded, payload = {}) {
  const tokenEmail = String(decoded?.email || "").trim().toLowerCase();
  const claimedRole = String(decoded?.role || "").trim().toLowerCase();
  const trustedEmails = new Set(String(process.env.PUSH_ALLOWED_SENDER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean));
  try {
    const requesterSnap = await withFirestoreTimeout(
      admin.firestore().doc(`users/${decoded.uid}`).get(),
      "check_role",
      "Validacion de permisos en Firestore"
    );
    const requester = requesterSnap.data();
    const requesterEmail = String(requester?.email || "").trim().toLowerCase();
    if (requester?.active && requesterEmail && requesterEmail === tokenEmail) {
      if (["admin", "editor"].includes(requester.role)) return requester;
      if (requester.role === "viewer" && requester.viewerType === "medios" && isMediaSlidesPushRequest(payload)) {
        return requester;
      }
    }
  } catch (error) {
    if (!isTransientFirestoreError(error)) throw error;
    if (["admin", "editor"].includes(claimedRole) || trustedEmails.has(tokenEmail)) {
      logSafe("Role fallback", { stage: "check_role", uid: decoded.uid, reason: "firestore_quota" });
      return { active: true, email: tokenEmail, role: claimedRole || "trusted_sender", fallback: true };
    }
    throw error;
  }
  {
    const error = new Error("No autorizado para enviar push.");
    error.status = 403;
    error.stage = "check_role";
    throw error;
  }
}

function enforceRateLimit(uid = "") {
  const key = uid || "anonymous";
  const now = Date.now();
  const bucket = requestBuckets.get(key) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const error = new Error("Demasiados intentos de envio push. Espera un minuto.");
    error.status = 429;
    error.stage = "rate_limit";
    throw error;
  }
  recent.push(now);
  requestBuckets.set(key, recent);
}

function validatePayload(payload = {}) {
  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();
  const type = String(payload.type || "other");
  const mode = String(payload.mode || "broadcast");
  if (!allowedTypes.has(type)) {
    return { ok: false, code: "INVALID_TYPE", message: "Tipo de notificacion no permitido." };
  }
  if (!title || !body) {
    return { ok: false, code: "MISSING_TITLE_BODY", message: "Faltan titulo o mensaje." };
  }
  if (title.length > 160 || body.length > 500) {
    return { ok: false, code: "PAYLOAD_TOO_LONG", message: "Titulo o mensaje demasiado largo." };
  }
  if (!["broadcast", "targeted", "self_test", "self_test_data_only", "register_topic"].includes(mode)) {
    return { ok: false, code: "INVALID_MODE", message: "Modo de envio no permitido." };
  }
  safeInternalUrl(payload.url || "/");
  return { ok: true };
}

async function registerBroadcastTopic(token = "") {
  if (!token || token.length < 40) {
    const error = new Error("Token FCM invalido para registrar el dispositivo.");
    error.status = 400;
    error.stage = "register_topic";
    throw error;
  }
  const result = await withTimeout(admin.messaging().subscribeToTopic([token], BROADCAST_TOPIC), "Registro del canal FCM");
  if (result.failureCount > 0) {
    const firstError = result.errors?.[0]?.error;
    throw firstError || new Error("No se pudo registrar el dispositivo en el canal push.");
  }
  return result;
}

async function readPushTokenRegistry() {
  const devices = [];
  let pageToken;
  do {
    const page = await withTimeout(admin.auth().listUsers(1000, pageToken), "Lectura del registro push");
    page.users.forEach((user) => {
      const pushTokens = Array.isArray(user.customClaims?.pushTokens) ? user.customClaims.pushTokens : [];
      pushTokens.forEach((token) => {
        if (typeof token === "string" && token.length >= 40) {
          devices.push({ uid: user.uid, token, active: true });
        }
      });
    });
    pageToken = page.pageToken;
  } while (pageToken && devices.length < 500);
  return devices.slice(0, 500);
}

async function upsertPushTokenRegistry(decoded, token, tokenId = "") {
  if (!token) return { saved: false, devices: 0 };
  const user = await withTimeout(admin.auth().getUser(decoded.uid), "Lectura del usuario push");
  const currentClaims = user.customClaims || {};
  const currentTokens = Array.isArray(currentClaims.pushTokens)
    ? currentClaims.pushTokens.filter((value) => typeof value === "string" && value.length >= 40 && value !== token)
    : [];
  const pushTokens = [...currentTokens, token].slice(-3);
  await withTimeout(admin.auth().setCustomUserClaims(decoded.uid, {
    ...currentClaims,
    pushTokens
  }), "Escritura del registro push");
  return { saved: true, devices: pushTokens.length, tokenId };
}

async function reserveNotificationSend(notificationId, requesterUid) {
  if (!notificationId) return { reserved: true, duplicate: false };
  const ref = admin.firestore().doc(`pushDeliveries/${notificationId}`);
  const now = admin.firestore.FieldValue.serverTimestamp();

  return withFirestoreTimeout(admin.firestore().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const previous = snap.data() || {};
    const updatedAtMs = previous.updatedAt?.toMillis?.() || previous.createdAt?.toMillis?.() || 0;
    const failedStillCoolingDown = previous.status === "failed" && Date.now() - updatedAtMs < FAILED_DELIVERY_RETRY_AFTER_MS;
    const sendingStillActive = previous.status === "sending" && Date.now() - updatedAtMs < STALE_SENDING_AFTER_MS;
    if (snap.exists && (["sent", "partial"].includes(previous.status) || sendingStillActive || failedStillCoolingDown)) {
      return { reserved: false, duplicate: true, data: snap.data() };
    }
    transaction.set(ref, {
      notificationId,
      requestedBy: requesterUid,
      status: "sending",
      createdAt: now,
      updatedAt: now
    }, { merge: true });
    return { reserved: true, duplicate: false, ref };
  }), "dedupe", "Reserva de deduplicacion");
}

async function finishNotificationSend(notificationId, result) {
  if (!notificationId) return;
  await withFirestoreTimeout(admin.firestore().doc(`pushDeliveries/${notificationId}`).set({
    status: result.ok && !result.partial ? "sent" : result.sent > 0 ? "partial" : "failed",
    result,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true }), "dedupe", "Registro de resultado push");
}

async function readActiveTokens() {
  const tokenSnap = await withFirestoreTimeout(admin.firestore()
    .collectionGroup("fcmTokens")
    .where("active", "==", true)
    .limit(500)
    .get(), "read_tokens", "Lectura de tokens activos");
  const entries = [];
  const seenTokens = new Set();
  const tokensFound = tokenSnap.size;
  let activeTokens = 0;
  let duplicateTokens = 0;

  for (const tokenDoc of tokenSnap.docs) {
    const data = tokenDoc.data();
    if (data.active !== true || !data.token) continue;
    activeTokens += 1;
    if (seenTokens.has(data.token)) {
      duplicateTokens += 1;
      continue;
    }
    seenTokens.add(data.token);
    entries.push({
      token: data.token,
      tokenPreview: maskToken(data.token),
      refPath: tokenDoc.ref.path,
      ref: tokenDoc.ref,
      uid: tokenDoc.ref.path.split("/")[1] || "",
      role: data.role || "",
      viewerType: data.viewerType || ""
    });
  }

  return {
    tokensFound,
    activeTokens,
    uniqueTokens: entries.length,
    duplicateTokens,
    entries: entries.slice(0, 500),
    truncated: entries.length > 500
  };
}

async function readSelfTestToken(uid, token, tokenId = "") {
  if (!token) {
    const error = new Error("Falta token FCM para probar este dispositivo.");
    error.status = 400;
    error.stage = "read_tokens";
    throw error;
  }

  let tokenDoc = null;
  try {
    if (tokenId) {
      const snap = await withFirestoreTimeout(
        admin.firestore().doc(`users/${uid}/fcmTokens/${tokenId}`).get(),
        "read_tokens",
        "Lectura del token de prueba"
      );
      if (snap.exists) tokenDoc = snap;
    } else {
      const snap = await withFirestoreTimeout(
        admin.firestore().collection(`users/${uid}/fcmTokens`).get(),
        "read_tokens",
        "Lectura de tokens de prueba"
      );
      tokenDoc = snap.docs.find((docSnap) => docSnap.data()?.token === token) || null;
    }
  } catch (error) {
    if (!isTransientFirestoreError(error)) throw error;
    logSafe("Self test token fallback", { stage: "read_tokens", uid, reason: "firestore_quota" });
    return {
      tokensFound: null,
      activeTokens: null,
      uniqueTokens: 1,
      duplicateTokens: 0,
      entries: [{
        token,
        tokenPreview: maskToken(token),
        refPath: "",
        ref: null
      }],
      truncated: false,
      fallback: true
    };
  }

  if (!tokenDoc) {
    const error = new Error("El token no pertenece al usuario autenticado o esta inactivo.");
    error.status = 403;
    error.stage = "read_tokens";
    throw error;
  }

  const tokenData = tokenDoc.data();
  if (tokenData.token !== token || tokenData.active !== true) {
    const error = new Error("El token no pertenece al usuario autenticado o esta inactivo.");
    error.status = 403;
    error.stage = "read_tokens";
    throw error;
  }

  return {
    tokensFound: 1,
    activeTokens: 1,
    uniqueTokens: 1,
    duplicateTokens: 0,
    entries: [{
      token,
      tokenPreview: maskToken(token),
      refPath: tokenDoc.ref.path,
      ref: tokenDoc.ref
    }],
    truncated: false
  };
}

async function sendToTokens(entries, payload) {
  const result = {
    stage: "send_fcm",
    tokensAttempted: entries.length,
    sent: 0,
    failed: 0,
    invalidTokens: 0,
    errors: [],
    quotaExceeded: false,
    failedPrecondition: false
  };

  for (const entry of entries) {
    try {
      const icon = payload.icon || publicIconUrl();
      const badge = payload.badge || icon;
      const data = stringData({
        type: payload.type || "other",
        url: safeInternalUrl(payload.url || "/"),
        title: payload.title,
        body: payload.body,
        icon,
        badge,
        tag: payload.notificationId || payload.scheduleId || payload.songId || payload.type || "roca-eterna-push",
        scheduleId: payload.scheduleId || "",
        songId: payload.songId || "",
        notificationId: payload.notificationId || "",
        mode: payload.mode || ""
      });
      const message = {
        token: entry.token,
        data
      };
      if (payload.mode !== "self_test_data_only") {
        message.notification = {
          title: payload.title,
          body: payload.body
        };
        message.webpush = {
          notification: {
            title: payload.title,
            body: payload.body,
            icon,
            badge,
            tag: data.tag,
            renotify: false,
            requireInteraction: false
          },
          fcmOptions: {
            link: absoluteAppUrl(payload.url)
          }
        };
      }
      await withTimeout(admin.messaging().send(message), "Envio FCM directo");
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      const sanitized = sanitizeError(error);
      const invalid = isInvalidTokenError(error);
      if (invalid) {
        result.invalidTokens += 1;
        if (entry.ref) {
          await entry.ref.set({
            active: false,
            invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
            invalidReason: sanitized.code || sanitized.message
          }, { merge: true });
        }
      }
      if (isQuotaError(error)) result.quotaExceeded = true;
      if (isPreconditionError(error)) result.failedPrecondition = true;
      result.errors.push({
        token: entry.tokenPreview,
        invalid,
        ...sanitized
      });
    }
  }

  return result;
}

async function sendToBroadcastTopic(payload) {
  const icon = payload.icon || publicIconUrl();
  const badge = payload.badge || icon;
  const data = stringData({
    type: payload.type || "other",
    url: safeInternalUrl(payload.url || "/"),
    title: payload.title,
    body: payload.body,
    icon,
    badge,
    tag: payload.notificationId || payload.scheduleId || payload.songId || payload.type || "roca-eterna-push",
    scheduleId: payload.scheduleId || "",
    songId: payload.songId || "",
    notificationId: payload.notificationId || "",
    mode: payload.mode || "broadcast"
  });
  const message = {
    topic: BROADCAST_TOPIC,
    data,
    webpush: {
      headers: {
        Urgency: "high",
        TTL: "86400"
      },
      fcmOptions: { link: absoluteAppUrl(payload.url) }
    }
  };
  const messageId = await withTimeout(admin.messaging().send(message), "Envio FCM por canal");
  return {
    stage: "send_fcm_topic",
    tokensAttempted: 0,
    sent: 1,
    failed: 0,
    invalidTokens: 0,
    errors: [],
    quotaExceeded: false,
    failedPrecondition: false,
    topic: BROADCAST_TOPIC,
    messageId
  };
}

export default async function handler(request, response) {
  applyCors(request, response);

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return sendJson(response, 405, { ok: false, stage: "method", message: "Metodo no permitido." });
  if (!isAllowedOrigin(request.headers.origin || "")) {
    return sendJson(response, 403, { ok: false, stage: "origin", message: "Origen no permitido." });
  }

  let stage = "initialize_admin";
  let notificationId = "";
  try {
    initializeAdmin();
    const env = environmentDiagnostic();

    stage = "verify_id_token";
    const decoded = await verifyRequester(request);
    stage = "verify_app_check";
    await verifyAppCheckIfRequired(request);
    enforceRateLimit(decoded.uid);

    const {
      mode = "broadcast",
      type = "other",
      title,
      body,
      url,
      scheduleId,
      songId,
      token,
      tokenId,
      notificationId: incomingNotificationId,
      icon,
      badge,
      audience
    } = request.body || {};
    notificationId = incomingNotificationId || "";

    if (mode === "register_topic") {
      stage = "register_topic";
      const [topicAttempt, registryAttempt] = await Promise.allSettled([
        registerBroadcastTopic(token),
        upsertPushTokenRegistry(decoded, token, tokenId)
      ]);
      if (topicAttempt.status === "rejected" && registryAttempt.status === "rejected") {
        throw topicAttempt.reason || registryAttempt.reason;
      }
      const topicResult = topicAttempt.status === "fulfilled" ? topicAttempt.value : { successCount: 0, failureCount: 1 };
      const registryResult = registryAttempt.status === "fulfilled" ? registryAttempt.value : { saved: false, devices: 0 };
      const registryError = registryAttempt.status === "rejected" ? sanitizeError(registryAttempt.reason) : null;
      logSafe("Topic registration", {
        stage,
        uid: decoded.uid,
        successCount: topicResult.successCount,
        failureCount: topicResult.failureCount,
        registrySaved: registryResult.saved,
        registryDevices: registryResult.devices,
        registryError
      });
      return sendJson(response, 200, {
        ok: true,
        stage,
        registered: true,
        topic: BROADCAST_TOPIC,
        successCount: topicResult.successCount,
        failureCount: topicResult.failureCount,
        registrySaved: registryResult.saved,
        registryDevices: registryResult.devices,
        registryError
      });
    }

    if (!["self_test", "self_test_data_only"].includes(mode)) {
      stage = "check_role";
      await checkRole(decoded, request.body || {});
    }

    const payloadValidation = validatePayload({ mode, type, title, body, url });
    if (!payloadValidation.ok) return sendJson(response, 400, { ok: false, stage: "validate_payload", ...payloadValidation });

    if (!["self_test", "broadcast"].includes(mode)) {
      stage = "dedupe";
      const reservation = await reserveNotificationSend(notificationId, decoded.uid).catch((error) => {
        if (!isTransientFirestoreError(error)) throw error;
        logSafe("Dedupe fallback", { notificationId, reason: error.code === "FIRESTORE_TIMEOUT" ? "firestore_timeout" : "firestore_quota" });
        return { reserved: true, duplicate: false, fallback: true };
      });
      if (reservation.duplicate) {
        return sendJson(response, 200, {
          ok: true,
          duplicate: true,
          deduplicated: true,
          stage: "dedupe",
          notificationId,
          message: "Este envio push ya fue procesado o esta en proceso.",
          previous: reservation.data || null
        });
      }
    }

    stage = "read_tokens";
    let tokenRead = mode === "self_test"
      ? await readSelfTestToken(decoded.uid, token, tokenId)
      : mode === "self_test_data_only"
        ? await readSelfTestToken(decoded.uid, token, tokenId)
        : mode === "targeted"
          ? await readActiveTokens()
      : null;

    if (mode === "targeted") {
      const entries = (tokenRead?.entries || []).filter((entry) => {
        if (audience === "admins_media") {
          return entry.role === "admin" || (entry.role === "viewer" && entry.viewerType === "medios");
        }
        return false;
      });
      tokenRead = {
        ...tokenRead,
        activeTokens: entries.length,
        uniqueTokens: entries.length,
        entries
      };
    }

    if (tokenRead && !tokenRead.entries.length) {
      const emptyResult = {
        ok: true,
        stage: "read_tokens",
        message: "No hay dispositivos activos para enviar push.",
        notificationId,
        tokensFound: tokenRead.tokensFound,
        activeTokens: tokenRead.activeTokens,
        uniqueTokens: tokenRead.uniqueTokens,
        duplicateTokens: tokenRead.duplicateTokens,
        tokensAttempted: 0,
        sent: 0,
        failed: 0,
        invalidTokens: 0,
        env
      };
      await finishNotificationSend(notificationId, emptyResult).catch((error) => {
        logSafe("Delivery log warning", { notificationId, message: sanitizeError(error).message });
      });
      return sendJson(response, 200, emptyResult);
    }

    stage = "send_fcm";
    let sendResult;
    if (mode === "broadcast") {
      const broadcastPayload = { mode, type, title, body, url, scheduleId, songId, notificationId, icon, badge };
      const [registryDevices, firestoreTokens] = await Promise.all([
        readPushTokenRegistry().catch((error) => {
          logSafe("Push registry read warning", { code: sanitizeError(error).code, message: sanitizeError(error).message });
          return [];
        }),
        readActiveTokens().catch((error) => {
          logSafe("Firestore token read warning", { code: sanitizeError(error).code, message: sanitizeError(error).message });
          return { entries: [] };
        })
      ]);
      const directTokens = new Map();
      registryDevices.filter((entry) => entry?.active && entry?.token).forEach((entry) => directTokens.set(entry.token, entry));
      (firestoreTokens.entries || []).forEach((entry) => directTokens.set(entry.token, entry));
      if (token) directTokens.set(token, { token, tokenId, uid: decoded.uid, active: true });
      const directEntries = [...directTokens.values()].map((entry) => ({
        token: entry.token,
        tokenPreview: maskToken(entry.token),
        refPath: entry.refPath || "",
        ref: entry.ref || null
      }));
      const [topicAttempt, directAttempt] = await Promise.allSettled([
        sendToBroadcastTopic(broadcastPayload),
        directEntries.length ? sendToTokens(directEntries, broadcastPayload) : Promise.resolve(null)
      ]);
      const topicResult = topicAttempt.status === "fulfilled" ? topicAttempt.value : null;
      const directResult = directAttempt.status === "fulfilled" ? directAttempt.value : null;
      if (!topicResult && !directResult) throw topicAttempt.reason || directAttempt.reason;
      sendResult = {
        stage: "send_fcm",
        tokensAttempted: directResult?.tokensAttempted || 0,
        sent: (topicResult?.sent || 0) + (directResult?.sent || 0),
        failed: (topicResult?.failed || 0) + (directResult?.failed || 0),
        invalidTokens: directResult?.invalidTokens || 0,
        errors: [
          ...(topicResult?.errors || []),
          ...(directResult?.errors || []),
          ...(topicAttempt.status === "rejected" ? [{ channel: "topic", ...sanitizeError(topicAttempt.reason) }] : [])
        ],
        quotaExceeded: Boolean(topicResult?.quotaExceeded || directResult?.quotaExceeded),
        failedPrecondition: Boolean(topicResult?.failedPrecondition || directResult?.failedPrecondition),
        topic: topicResult?.topic || "",
        registryDevices: directEntries.length,
        firestoreDevices: firestoreTokens.entries?.length || 0,
        directFallback: Boolean(directResult?.sent)
      };
    } else {
      sendResult = await sendToTokens(tokenRead.entries, { mode, type, title, body, url, scheduleId, songId, notificationId, icon, badge });
    }
    const partial = sendResult.failed > 0 && sendResult.sent > 0;
    const ok = sendResult.sent > 0 || sendResult.failed === 0;
    const message = sendResult.quotaExceeded
      ? "FCM reporto cuota excedida. Se pausaron los reintentos."
      : sendResult.failedPrecondition
        ? "FCM reporto FAILED_PRECONDITION. Revisa Cloud Messaging API, VAPID key y service account del mismo proyecto."
        : partial
          ? "Push enviado parcialmente."
          : ok
            ? "Push enviado."
            : "No se pudo enviar push a ningun dispositivo.";

    const result = {
      ok,
      partial,
      stage: "send_fcm",
      mode,
      notificationId,
      deduplicated: false,
      message,
      tokensFound: tokenRead?.tokensFound ?? null,
      activeTokens: tokenRead?.activeTokens ?? null,
      uniqueTokens: tokenRead?.uniqueTokens ?? null,
      duplicateTokens: tokenRead?.duplicateTokens ?? null,
      tokensAttempted: sendResult.tokensAttempted,
      registryDevices: sendResult.registryDevices || 0,
      sent: sendResult.sent,
      failed: sendResult.failed,
      invalidTokens: sendResult.invalidTokens,
      truncated: tokenRead?.truncated || false,
      topic: sendResult.topic || "",
      quotaExceeded: sendResult.quotaExceeded,
      failedPrecondition: sendResult.failedPrecondition,
      errors: sendResult.errors.slice(0, 20),
      env
    };

    if (mode !== "broadcast") {
      await finishNotificationSend(notificationId, result).catch((error) => {
        logSafe("Delivery log warning", { notificationId, message: sanitizeError(error).message });
      });
    }
    logSafe("Push result", {
      stage: result.stage,
      mode: result.mode,
      notificationId,
      tokensFound: result.tokensFound,
      activeTokens: result.activeTokens,
      uniqueTokens: result.uniqueTokens,
      duplicateTokens: result.duplicateTokens,
      tokensAttempted: result.tokensAttempted,
      registryDevices: result.registryDevices,
      sent: result.sent,
      failed: result.failed,
      invalidTokens: result.invalidTokens,
      quotaExceeded: result.quotaExceeded,
      failedPrecondition: result.failedPrecondition
    });
    return sendJson(response, ok ? 200 : 200, result);
  } catch (error) {
    const status = error.status || 500;
    const sanitized = sanitizeError(error);
    const errorStage = error.stage || stage;
    const fromFirestore = firestoreStage(errorStage);
    const body = {
      ok: false,
      stage: errorStage,
      source: fromFirestore ? "firestore" : "backend",
      notificationId,
      ...sanitized,
      message: errorStage === "check_role" && isQuotaError(error)
        ? "Firestore reporto cuota excedida al validar permisos. El evento se guardo, pero el push no se envio."
        : errorStage === "read_tokens"
        ? isQuotaError(error)
          ? "Firestore reporto cuota excedida al leer tokens."
          : sanitized.message || "Firestore/Admin SDK fallo al leer tokens."
        : isQuotaError(error)
        ? "FCM reporto cuota excedida. Se pausaron los reintentos."
        : isPreconditionError(error)
          ? "FCM reporto FAILED_PRECONDITION. Revisa Cloud Messaging API, VAPID key y service account del mismo proyecto."
          : sanitized.message,
      hint: fromFirestore
        ? "Fallo en Firestore/Admin SDK antes de enviar a FCM. No es un error de FCM todavia."
        : "",
      env: stage === "initialize_admin" ? {
        hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
        hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
        hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
        adminInitialized: admin.apps.length > 0,
        adminProjectId: process.env.FIREBASE_PROJECT_ID || ""
      } : environmentDiagnostic()
    };
    logSafe("Push error", {
      stage: body.stage,
      code: body.code,
      message: body.message,
      notificationId
    });
    await finishNotificationSend(notificationId, body).catch(() => undefined);
    return sendJson(response, status, body);
  }
}
