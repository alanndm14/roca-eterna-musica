import admin from "firebase-admin";

const allowedTypes = new Set(["new_schedule", "new_song", "updated_schedule", "self_test_data_only", "other"]);
const invalidTokenCodes = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
]);

function initializeAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error("Firebase Admin no esta configurado en el backend.");
    error.code = "BACKEND_CONFIG_MISSING";
    throw error;
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId
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

function isPreconditionError(error = {}) {
  const code = String(error.code || error.errorInfo?.code || "");
  const message = String(error.message || "");
  return code.includes("FAILED_PRECONDITION")
    || code.includes("failed-precondition")
    || code === "9"
    || message.includes("FAILED_PRECONDITION");
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

function appBaseUrl() {
  return (process.env.PUSH_APP_BASE_URL || process.env.PUSH_ALLOWED_ORIGIN || "https://alanndm14.github.io/roca-eterna-musica").replace(/\/$/, "");
}

function absoluteAppUrl(url = "") {
  if (/^https?:\/\//i.test(url)) return url;
  const base = appBaseUrl();
  if (!url) return `${base}/`;
  if (url.startsWith("/#/")) return `${base}${url}`;
  if (url.startsWith("#/")) return `${base}/${url}`;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

function publicIconUrl() {
  return `${appBaseUrl()}/icons/icon-192.png`;
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

async function checkRole(decoded) {
  const requesterSnap = await admin.firestore().doc(`users/${decoded.uid}`).get();
  const requester = requesterSnap.data();
  if (!requester?.active || !["admin", "editor"].includes(requester.role)) {
    const error = new Error("No autorizado para enviar push.");
    error.status = 403;
    error.stage = "check_role";
    throw error;
  }
  return requester;
}

async function reserveNotificationSend(notificationId, requesterUid) {
  if (!notificationId) return { reserved: true, duplicate: false };
  const ref = admin.firestore().doc(`pushDeliveries/${notificationId}`);
  const now = admin.firestore.FieldValue.serverTimestamp();

  return admin.firestore().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.exists && ["sending", "sent", "partial", "failed"].includes(snap.data()?.status)) {
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
  });
}

async function finishNotificationSend(notificationId, result) {
  if (!notificationId) return;
  await admin.firestore().doc(`pushDeliveries/${notificationId}`).set({
    status: result.ok && !result.partial ? "sent" : result.sent > 0 ? "partial" : "failed",
    result,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function readActiveTokens() {
  const usersSnap = await admin.firestore().collection("users").get();
  const entries = [];
  let tokensFound = 0;

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();
    if (!user?.active) continue;
    const tokenSnap = await userDoc.ref.collection("fcmTokens").get();
    tokensFound += tokenSnap.size;
    for (const tokenDoc of tokenSnap.docs) {
      const data = tokenDoc.data();
      if (data.active !== true || !data.token) continue;
      entries.push({
        token: data.token,
        tokenPreview: maskToken(data.token),
        refPath: tokenDoc.ref.path,
        ref: tokenDoc.ref
      });
    }
  }

  return {
    tokensFound,
    activeTokens: entries.length,
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
  if (tokenId) {
    const snap = await admin.firestore().doc(`users/${uid}/fcmTokens/${tokenId}`).get();
    if (snap.exists) tokenDoc = snap;
  } else {
    const snap = await admin.firestore().collection(`users/${uid}/fcmTokens`).get();
    tokenDoc = snap.docs.find((docSnap) => docSnap.data()?.token === token) || null;
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
      const data = stringData({
        type: payload.type || "other",
        url: payload.url || "/roca-eterna-musica/",
        title: payload.title,
        body: payload.body,
        icon: publicIconUrl(),
        badge: publicIconUrl(),
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
            icon: publicIconUrl(),
            badge: publicIconUrl(),
            tag: data.tag,
            renotify: false,
            requireInteraction: false
          },
          fcmOptions: {
            link: absoluteAppUrl(payload.url)
          }
        };
      }
      await admin.messaging().send(message);
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      const sanitized = sanitizeError(error);
      const invalid = isInvalidTokenError(error);
      if (invalid) {
        result.invalidTokens += 1;
        await entry.ref.set({
          active: false,
          invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
          invalidReason: sanitized.code || sanitized.message
        }, { merge: true });
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

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.PUSH_ALLOWED_ORIGIN || "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return sendJson(response, 405, { ok: false, stage: "method", message: "Metodo no permitido." });

  let stage = "initialize_admin";
  let notificationId = "";
  try {
    initializeAdmin();
    const env = environmentDiagnostic();

    stage = "verify_id_token";
    const decoded = await verifyRequester(request);

    stage = "check_role";
    await checkRole(decoded);

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
      notificationId: incomingNotificationId
    } = request.body || {};
    notificationId = incomingNotificationId || "";

    if (!allowedTypes.has(type)) return sendJson(response, 400, { ok: false, stage: "validate_payload", code: "INVALID_TYPE", message: "Tipo de notificacion no permitido." });
    if (!title || !body) return sendJson(response, 400, { ok: false, stage: "validate_payload", code: "MISSING_TITLE_BODY", message: "Faltan titulo o mensaje." });

    if (mode !== "self_test") {
      stage = "dedupe";
      const reservation = await reserveNotificationSend(notificationId, decoded.uid);
      if (reservation.duplicate) {
        return sendJson(response, 200, {
          ok: true,
          duplicate: true,
          stage: "dedupe",
          message: "Este envio push ya fue procesado o esta en proceso.",
          previous: reservation.data || null
        });
      }
    }

    stage = "read_tokens";
    const tokenRead = mode === "self_test"
      ? await readSelfTestToken(decoded.uid, token, tokenId)
      : mode === "self_test_data_only"
        ? await readSelfTestToken(decoded.uid, token, tokenId)
      : await readActiveTokens();

    if (!tokenRead.entries.length) {
      const emptyResult = {
        ok: true,
        stage: "read_tokens",
        message: "No hay dispositivos activos para enviar push.",
        tokensFound: tokenRead.tokensFound,
        activeTokens: tokenRead.activeTokens,
        tokensAttempted: 0,
        sent: 0,
        failed: 0,
        invalidTokens: 0,
        env
      };
      await finishNotificationSend(notificationId, emptyResult);
      return sendJson(response, 200, emptyResult);
    }

    stage = "send_fcm";
    const sendResult = await sendToTokens(tokenRead.entries, { mode, type, title, body, url, scheduleId, songId, notificationId });
    const partial = sendResult.failed > 0 && sendResult.sent > 0;
    const ok = sendResult.sent > 0 || sendResult.failed === 0;
    const message = sendResult.quotaExceeded
      ? "FCM o Firestore reporto cuota excedida. Intenta mas tarde o revisa si hay demasiados tokens/reintentos."
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
      message,
      tokensFound: tokenRead.tokensFound,
      activeTokens: tokenRead.activeTokens,
      tokensAttempted: sendResult.tokensAttempted,
      sent: sendResult.sent,
      failed: sendResult.failed,
      invalidTokens: sendResult.invalidTokens,
      truncated: tokenRead.truncated,
      quotaExceeded: sendResult.quotaExceeded,
      failedPrecondition: sendResult.failedPrecondition,
      errors: sendResult.errors.slice(0, 20),
      env
    };

    await finishNotificationSend(notificationId, result);
    logSafe("Push result", {
      stage: result.stage,
      mode: result.mode,
      notificationId,
      tokensFound: result.tokensFound,
      activeTokens: result.activeTokens,
      tokensAttempted: result.tokensAttempted,
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
    const body = {
      ok: false,
      stage: error.stage || stage,
      source: (error.stage || stage) === "read_tokens" ? "firestore" : "backend",
      ...sanitized,
      message: (error.stage || stage) === "read_tokens"
        ? sanitized.message || "Firestore/Admin SDK fallo al leer tokens."
        : isQuotaError(error)
        ? "FCM o Firestore reporto cuota excedida. Intenta mas tarde o revisa si hay demasiados tokens/reintentos."
        : isPreconditionError(error)
          ? "FCM reporto FAILED_PRECONDITION. Revisa Cloud Messaging API, VAPID key y service account del mismo proyecto."
          : sanitized.message,
      hint: (error.stage || stage) === "read_tokens"
        ? "Fallo al leer tokens desde Firestore/Admin SDK. No es un error de FCM todavia."
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
