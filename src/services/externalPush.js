import { getToken as getAppCheckToken } from "firebase/app-check";
import { appCheck, auth, pushServerUrl } from "../lib/firebase";

const LAST_AUTO_KEY = "roca-eterna-last-auto-push";
const LAST_TEST_KEY = "roca-eterna-last-test-push";

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const saveLastPushResult = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ...value, at: new Date().toISOString() }));
  } catch {
    // El diagnostico no debe romper el flujo principal.
  }
};

export function getLastPushResult(type = "auto") {
  try {
    return JSON.parse(localStorage.getItem(type === "test" ? LAST_TEST_KEY : LAST_AUTO_KEY) || "null");
  } catch {
    return null;
  }
}

export function isPushBackendConfigured() {
  return Boolean(pushServerUrl);
}

export async function sendExternalPush(payload = {}, options = {}) {
  const meta = options.meta || {};
  const shouldSaveResult = options.kind !== "registration";
  if (!pushServerUrl || !auth?.currentUser) {
    const result = { skipped: true, reason: "Push externo no configurado.", ...meta };
    if (shouldSaveResult) saveLastPushResult(options.kind === "test" ? LAST_TEST_KEY : LAST_AUTO_KEY, {
      notificationId: payload.notificationId || "",
      scheduleId: payload.scheduleId || "",
      songId: payload.songId || "",
      mode: payload.mode || "broadcast",
      ...result
    });
    return result;
  }

  try {
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
        // App Check no debe bloquear push hasta que se active enforcement en backend.
      }
    }
    const response = await fetch(pushServerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true
    });
    const body = await parseJsonSafely(response);
    const result = {
      skipped: false,
      ok: response.ok && body.ok !== false,
      status: response.status,
      pushEnviado: response.ok && body.ok !== false && Number(body.sent || body.enviados || 0) > 0,
      body
    };
    if (shouldSaveResult) saveLastPushResult(options.kind === "test" ? LAST_TEST_KEY : LAST_AUTO_KEY, {
      ...meta,
      notificationId: payload.notificationId || "",
      scheduleId: payload.scheduleId || "",
      songId: payload.songId || "",
      mode: payload.mode || "broadcast",
      ...result
    });
    return result;
  } catch (error) {
    const result = { skipped: false, ok: false, error: error.message, ...meta };
    if (shouldSaveResult) saveLastPushResult(options.kind === "test" ? LAST_TEST_KEY : LAST_AUTO_KEY, {
      notificationId: payload.notificationId || "",
      scheduleId: payload.scheduleId || "",
      songId: payload.songId || "",
      mode: payload.mode || "broadcast",
      ...result
    });
    return result;
  }
}

export async function registerPushTokenForBroadcast(token = "", tokenId = "") {
  if (!token) return { ok: false, skipped: true, reason: "Sin token FCM." };
  return sendExternalPush({
    mode: "register_topic",
    type: "other",
    title: "Registro de dispositivo",
    body: "Registro del canal de notificaciones.",
    token,
    tokenId
  }, { kind: "registration" });
}
