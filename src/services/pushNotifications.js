import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseApp, firebaseVapidKey, isFirebaseConfigured } from "../lib/firebase";

const TOKEN_STORAGE_KEY = "roca-eterna-fcm-token-id";
const LAST_FOREGROUND_KEY = "roca-eterna-last-foreground-push";
const LAST_BACKGROUND_KEY = "roca-eterna-last-background-push";
const FOREGROUND_LISTENER_KEY = "roca-eterna-foreground-listener";

const tokenIdFromValue = (token = "") => token.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120) || `${Date.now()}`;

const maskToken = (token = "") => {
  if (!token) return "";
  if (token.length <= 14) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
};

const buildTokenPath = (uid, tokenId) => `users/${uid}/fcmTokens/${tokenId}`;

const pushBaseDiagnostic = (overrides = {}) => ({
  supported: false,
  reason: "",
  browserPermission: typeof Notification === "undefined" ? "no_soportado" : Notification.permission,
  hasVapidKey: Boolean(firebaseVapidKey),
  serviceWorkerRegistered: false,
  tokenObtained: false,
  tokenPreview: "",
  tokenPath: "",
  firestoreWrite: "no_intentado",
  error: "",
  ...overrides
});

const deniedInstructions = "Las notificaciones estan bloqueadas para este sitio. Reactivalas desde Chrome > Configuracion > Configuracion de sitios > Notificaciones, busca alanndm14.github.io y cambia a Permitir. Tambien revisa Ajustes del telefono > Apps > Chrome > Notificaciones.";

const androidDefaultInstructions = "Este sitio todavia no tiene permiso de notificaciones. Toca Activar notificaciones para solicitarlo. Los permisos generales de Chrome no bastan; este sitio debe tener permiso propio.";

const iconUrl = () => new URL(`${import.meta.env.BASE_URL || "/"}icons/icon-192.png`, window.location.origin).href;

const normalizePushPayload = (payload = {}) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const url = data.url || payload.fcmOptions?.link || "/";
  const notificationId = data.notificationId || data.scheduleId || data.songId || payload.messageId || `${Date.now()}`;
  return {
    id: notificationId,
    notificationId,
    title: notification.title || data.title || "Roca Eterna Musica",
    body: notification.body || data.body || data.message || "",
    icon: notification.icon || data.icon || `${import.meta.env.BASE_URL || "/"}icons/icon-192.png`,
    badge: data.badge || `${import.meta.env.BASE_URL || "/"}icons/icon-192.png`,
    url,
    tag: data.tag || notificationId,
    type: data.type || "other",
    scheduleId: data.scheduleId || "",
    songId: data.songId || "",
    receivedAt: new Date().toISOString()
  };
};

export function getLastForegroundPush() {
  try {
    return JSON.parse(localStorage.getItem(LAST_FOREGROUND_KEY) || "null");
  } catch {
    return null;
  }
}

export function getLastBackgroundPush() {
  try {
    return JSON.parse(localStorage.getItem(LAST_BACKGROUND_KEY) || "null");
  } catch {
    return null;
  }
}

export function getForegroundListenerStatus() {
  try {
    return JSON.parse(localStorage.getItem(FOREGROUND_LISTENER_KEY) || "null");
  } catch {
    return null;
  }
}

function saveLastForegroundPush(message) {
  try {
    localStorage.setItem(LAST_FOREGROUND_KEY, JSON.stringify(message));
  } catch {
    // El diagnostico no debe romper la experiencia principal.
  }
}

export function saveLastBackgroundPush(message) {
  try {
    localStorage.setItem(LAST_BACKGROUND_KEY, JSON.stringify(message));
  } catch {
    // El diagnostico no debe romper la experiencia principal.
  }
}

function saveForegroundListenerStatus(status) {
  try {
    localStorage.setItem(FOREGROUND_LISTENER_KEY, JSON.stringify({ ...status, updatedAt: new Date().toISOString() }));
  } catch {
    // El diagnostico no debe romper la experiencia principal.
  }
}

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  const baseUrl = import.meta.env.BASE_URL || "/";
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
  });

  try {
    return await navigator.serviceWorker.register(`${baseUrl}firebase-messaging-sw.js?${params.toString()}`);
  } catch (error) {
    const readyRegistration = await navigator.serviceWorker.ready.catch(() => null);
    if (readyRegistration) return readyRegistration;
    throw error;
  }
}

function serviceWorkerUrl() {
  return new URL(`${import.meta.env.BASE_URL || "/"}firebase-messaging-sw.js`, window.location.origin).href;
}

async function getRuntimeDiagnostics() {
  const diagnostic = {
    origin: window.location.origin,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    pathnameBase: import.meta.env.BASE_URL || "/",
    notificationPermission: typeof Notification === "undefined" ? "no_soportado" : Notification.permission,
    serviceWorkerSupport: "serviceWorker" in navigator,
    pushManagerSupport: "PushManager" in window,
    isSecureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
    serviceWorkerUrl: serviceWorkerUrl(),
    serviceWorkerFileStatus: "",
    serviceWorkerScope: "",
    serviceWorkerScriptURL: "",
    foregroundListenerRegistered: false,
    foregroundListenerRegisteredAt: "",
    foregroundListenerError: "",
    lastForegroundPush: getLastForegroundPush(),
    lastBackgroundPush: getLastBackgroundPush()
  };

  try {
    const response = await fetch(diagnostic.serviceWorkerUrl, { cache: "no-store" });
    diagnostic.serviceWorkerFileStatus = response.status;
  } catch (error) {
    diagnostic.serviceWorkerFileStatus = error?.message || "fetch_failed";
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    const registration = (registrations || []).find((item) => item.scope.includes(import.meta.env.BASE_URL || "/")) || registrations?.[0];
    diagnostic.serviceWorkerScope = registration?.scope || "";
    diagnostic.serviceWorkerScriptURL = registration?.active?.scriptURL || registration?.installing?.scriptURL || registration?.waiting?.scriptURL || "";
  } catch (error) {
    diagnostic.serviceWorkerScriptURL = error?.message || "";
  }

  const listener = getForegroundListenerStatus();
  diagnostic.foregroundListenerRegistered = Boolean(listener?.registered);
  diagnostic.foregroundListenerRegisteredAt = listener?.registeredAt || "";
  diagnostic.foregroundListenerError = listener?.error || "";

  return diagnostic;
}

export async function getPushSupportStatus() {
  if (!isFirebaseConfigured || !firebaseApp || !db) {
    return pushBaseDiagnostic({ reason: "Firebase no esta configurado." });
  }
  if (!firebaseVapidKey) {
    return pushBaseDiagnostic({
      reason: "Las notificaciones push aun no estan configuradas. Las notificaciones dentro de la app siguen activas."
    });
  }
  if (!("Notification" in window)) {
    return pushBaseDiagnostic({ reason: "Este navegador no soporta notificaciones." });
  }
  if (!("serviceWorker" in navigator)) {
    return pushBaseDiagnostic({ reason: "Este navegador no soporta service workers." });
  }
  if (!(await isSupported())) {
    return pushBaseDiagnostic({ reason: "Firebase Messaging no esta disponible en este navegador." });
  }
  return pushBaseDiagnostic({ supported: true, reason: "" });
}

export async function subscribeForegroundPushMessages(callback) {
  try {
    const support = await getPushSupportStatus();
    if (!support.supported) {
      saveForegroundListenerStatus({ registered: false, error: support.reason || "Push no soportado" });
      return () => {};
    }
    const messaging = getMessaging(firebaseApp);
    const unsubscribe = onMessage(messaging, (payload) => {
      const message = normalizePushPayload(payload);
      saveLastForegroundPush(message);
      callback?.(message, payload);
    });
    saveForegroundListenerStatus({ registered: true, registeredAt: new Date().toISOString(), error: "" });
    return unsubscribe;
  } catch (error) {
    saveForegroundListenerStatus({ registered: false, error: error?.message || String(error) });
    return () => {};
  }
}

export async function diagnosePushNotifications(profile) {
  const support = await getPushSupportStatus();
  const runtime = await getRuntimeDiagnostics();
  if (!support.supported) return { ...support, ...runtime };

  const diagnostic = {
    ...support,
    ...runtime,
    browserPermission: Notification.permission,
    supported: true
  };

  if (Notification.permission === "denied") {
    return {
      ...diagnostic,
      supported: false,
      reason: deniedInstructions
    };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    diagnostic.serviceWorkerRegistered = Boolean(registration);
  } catch (error) {
    diagnostic.supported = false;
    diagnostic.reason = "No se pudo registrar el service worker de notificaciones.";
    diagnostic.error = error?.message || String(error);
  }

  const cachedTokenId = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (profile?.uid && cachedTokenId) {
    diagnostic.tokenPath = buildTokenPath(profile.uid, cachedTokenId);
    diagnostic.firestoreWrite = "token existente";
  }

  return diagnostic;
}

export async function enablePushNotificationsForUser(profile) {
  const permissionBefore = typeof Notification === "undefined" ? "no_soportado" : Notification.permission;
  const diagnostic = {
    ...pushBaseDiagnostic(),
    browserPermission: permissionBefore
  };

  if (!profile?.uid) {
    return {
      ...diagnostic,
      supported: false,
      reason: "No se encontro un usuario autenticado para guardar este dispositivo."
    };
  }

  if (!("Notification" in window)) {
    return { ...diagnostic, supported: false, reason: "Este navegador no soporta notificaciones." };
  }
  if (Notification.permission === "denied") {
    return {
      ...diagnostic,
      supported: false,
      browserPermission: "denied",
      reason: deniedInstructions
    };
  }

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  diagnostic.browserPermission = permission;
  if (permission !== "granted") {
    return {
      ...diagnostic,
      supported: false,
      reason: permission === "default"
        ? "Chrome no mostro el permiso. Abre el candado o Configuracion del sitio y permite notificaciones para este sitio."
        : "El permiso de notificaciones no fue concedido."
    };
  }

  const support = await getPushSupportStatus();
  Object.assign(diagnostic, support);
  diagnostic.browserPermission = permission;
  if (!support.supported) return diagnostic;

  let registration = null;
  try {
    registration = await getServiceWorkerRegistration();
    diagnostic.serviceWorkerRegistered = Boolean(registration);
  } catch (error) {
    return {
      ...diagnostic,
      supported: false,
      reason: "No se pudo registrar el service worker de notificaciones.",
      error: error?.message || String(error)
    };
  }

  let token = "";
  try {
    const messaging = getMessaging(firebaseApp);
    token = await getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration || undefined
    });
  } catch (error) {
    return {
      ...diagnostic,
      supported: false,
      reason: "No se pudo obtener token FCM.",
      error: error?.message || String(error)
    };
  }

  if (!token) {
    return {
      ...diagnostic,
      supported: false,
      reason: "No se pudo obtener token FCM."
    };
  }

  const tokenId = tokenIdFromValue(token);
  const tokenPath = buildTokenPath(profile.uid, tokenId);
  diagnostic.tokenObtained = true;
  diagnostic.tokenPreview = maskToken(token);
  diagnostic.tokenPath = tokenPath;

  try {
    await setDoc(
      doc(db, "users", profile.uid, "fcmTokens", tokenId),
      {
        token,
        userAgent: navigator.userAgent,
        active: true,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp()
      },
      { merge: true }
    );
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenId);
    return {
      ...diagnostic,
      supported: true,
      firestoreWrite: "permitida",
      reason: "Notificaciones del navegador activadas para este dispositivo.",
      tokenId
    };
  } catch (error) {
    return {
      ...diagnostic,
      supported: false,
      firestoreWrite: "rechazada",
      reason: "No se pudo guardar este dispositivo para notificaciones. Revisa permisos de Firestore.",
      error: error?.message || String(error)
    };
  }
}

export async function getCurrentPushTokenForUser(profile) {
  const support = await getPushSupportStatus();
  const diagnostic = {
    ...support,
    browserPermission: typeof Notification === "undefined" ? "no_soportado" : Notification.permission
  };

  if (!profile?.uid) {
    return {
      ...diagnostic,
      supported: false,
      reason: "No se encontro un usuario autenticado para probar este dispositivo."
    };
  }
  if (!support.supported) return diagnostic;
  if (Notification.permission === "denied") {
    return {
      ...diagnostic,
      supported: false,
      browserPermission: "denied",
      reason: deniedInstructions
    };
  }
  if (Notification.permission !== "granted") {
    return {
      ...diagnostic,
      supported: false,
      reason: "Primero activa las notificaciones en este dispositivo."
    };
  }

  const registration = await getServiceWorkerRegistration();
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration: registration || undefined
  });

  if (!token) {
    return {
      ...diagnostic,
      serviceWorkerRegistered: Boolean(registration),
      supported: false,
      reason: "No se pudo obtener token FCM."
    };
  }

  const tokenId = tokenIdFromValue(token);
  return {
    ...diagnostic,
    supported: true,
    serviceWorkerRegistered: Boolean(registration),
    tokenObtained: true,
    tokenPreview: maskToken(token),
    tokenPath: buildTokenPath(profile.uid, tokenId),
    firestoreWrite: "token existente",
    token
  };
}

export async function testLocalNotification() {
  const permissionBefore = typeof Notification === "undefined" ? "no_soportado" : Notification.permission;
  const result = {
    permissionBefore,
    permissionAfter: permissionBefore,
    attempted: false,
    shown: false,
    error: "",
    origin: window.location.origin
  };

  if (!("Notification" in window)) {
    return { ...result, error: "Este navegador no soporta notificaciones." };
  }
  if (Notification.permission === "denied") {
    return { ...result, error: deniedInstructions };
  }

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  result.permissionAfter = permission;
  if (permission !== "granted") {
    result.error = permission === "default"
      ? "Chrome no mostro el permiso. Abre el candado o Configuracion del sitio y permite notificaciones para este sitio."
      : "El permiso de notificaciones no fue concedido.";
    return result;
  }

  try {
    result.attempted = true;
    const notification = new Notification("Prueba local", {
      body: "Chrome puede mostrar notificaciones para Roca Eterna Musica.",
      icon: iconUrl(),
      tag: "roca-eterna-local-test"
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    result.shown = true;
  } catch (error) {
    result.error = error?.message || String(error);
  }

  return result;
}

export async function reinstallMessagingServiceWorker() {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const removed = [];
  const registrations = await navigator.serviceWorker?.getRegistrations?.();
  await Promise.all((registrations || []).map(async (registration) => {
    if (registration.scope.includes(baseUrl) || registration.active?.scriptURL?.includes("firebase-messaging-sw.js")) {
      removed.push({ scope: registration.scope, scriptURL: registration.active?.scriptURL || "" });
      await registration.unregister();
    }
  }));
  localStorage.removeItem(FOREGROUND_LISTENER_KEY);
  localStorage.removeItem(LAST_FOREGROUND_KEY);
  localStorage.removeItem(LAST_BACKGROUND_KEY);
  return { removed, serviceWorkerUrl: serviceWorkerUrl() };
}

export async function disablePushNotificationsForUser(profile) {
  const diagnostic = pushBaseDiagnostic({ supported: true });
  if (!profile?.uid || !isFirebaseConfigured || !firebaseApp || !db) return diagnostic;

  const tokenId = localStorage.getItem(TOKEN_STORAGE_KEY);
  diagnostic.tokenPath = tokenId ? buildTokenPath(profile.uid, tokenId) : "";

  try {
    if (await isSupported()) {
      const messaging = getMessaging(firebaseApp);
      await deleteToken(messaging).catch(() => undefined);
    }

    if (tokenId) {
      await setDoc(
        doc(db, "users", profile.uid, "fcmTokens", tokenId),
        { active: false, lastSeenAt: serverTimestamp() },
        { merge: true }
      );
      diagnostic.firestoreWrite = "permitida";
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    return {
      ...diagnostic,
      reason: "Notificaciones del navegador desactivadas para este dispositivo."
    };
  } catch (error) {
    return {
      ...diagnostic,
      supported: false,
      firestoreWrite: "rechazada",
      reason: "No se pudo guardar este dispositivo para notificaciones. Revisa permisos de Firestore.",
      error: error?.message || String(error)
    };
  }
}
