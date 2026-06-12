import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseApp, firebaseVapidKey, isFirebaseConfigured } from "../lib/firebase";
import { registerPushTokenForBroadcast } from "./externalPush";
import { resolvePublicAssetUrl } from "./songUtils";
import { getNotificationDeviceContext } from "./stagingNotificationFlow";

const TOKEN_STORAGE_KEY = "roca-eterna-fcm-token-id";
const LAST_FOREGROUND_KEY = "roca-eterna-last-foreground-push";
const LAST_BACKGROUND_KEY = "roca-eterna-last-background-push";
const FOREGROUND_LISTENER_KEY = "roca-eterna-foreground-listener";
let broadcastRegistrationPromise = null;

const tokenIdFromValue = (token = "") => token.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120) || `${Date.now()}`;

const maskToken = (token = "") => {
  if (!token) return "";
  if (token.length <= 14) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
};

const buildTokenPath = (uid, tokenId) => `users/${uid}/fcmTokens/${tokenId}`;

export async function ensurePushBroadcastSubscription(profile) {
  if (
    !profile?.uid
    || typeof window === "undefined"
    || !("Notification" in window)
    || Notification.permission !== "granted"
    || !firebaseVapidKey
  ) {
    return { ok: false, skipped: true, reason: "El dispositivo no tiene permiso push activo." };
  }
  if (broadcastRegistrationPromise) return broadcastRegistrationPromise;

  broadcastRegistrationPromise = (async () => {
    const supported = await isSupported().catch(() => false);
    if (!supported) return { ok: false, skipped: true, reason: "FCM no es compatible con este navegador." };
    const registration = await getServiceWorkerRegistration();
    const token = await getToken(getMessaging(firebaseApp), {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration || undefined
    });
    if (!token) return { ok: false, skipped: true, reason: "No se obtuvo token FCM." };
    const tokenId = tokenIdFromValue(token);
    const result = await registerPushTokenForBroadcast(token, tokenId).catch((error) => ({
      ok: false,
      error: error?.message || String(error)
    }));
    if (result?.ok) localStorage.setItem(TOKEN_STORAGE_KEY, tokenId);
    return { ...result, token, tokenId };
  })().finally(() => {
    broadcastRegistrationPromise = null;
  });

  return broadcastRegistrationPromise;
}

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

const deniedInstructions = "Las notificaciones están bloqueadas para este sitio. Reactívalas desde Chrome > Configuración > Configuración de sitios > Notificaciones, busca alanndm14.github.io y cambia a Permitir. También revisa Ajustes del teléfono > Apps > Chrome > Notificaciones.";

const androidDefaultInstructions = "Este sitio todavia no tiene permiso de notificaciones. Toca Activar notificaciones para solicitarlo. Los permisos generales de Chrome no bastan; este sitio debe tener permiso propio.";

const iconUrl = () => {
  const preferred =
    localStorage.getItem("roca-eterna-logo-light-src")
    || localStorage.getItem("roca-eterna-logo-dark-src")
    || localStorage.getItem("roca-eterna-logo-src")
    || "";
  return resolvePublicAssetUrl(preferred || "icons/pwa-192.png");
};

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
    icon: notification.icon || data.icon || iconUrl(),
    badge: data.badge || iconUrl(),
    url,
    tag: data.tag || notificationId,
    type: data.type || "other",
    hasNotificationPayload: Boolean(payload.notification?.title || payload.notification?.body),
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
  const registration = await navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl });
  await navigator.serviceWorker.ready.catch(() => undefined);
  return registration;
}

function serviceWorkerUrl() {
  return new URL(`${import.meta.env.BASE_URL || "/"}sw.js`, window.location.origin).href;
}

async function checkActiveServiceWorkerFcmSupport(registration) {
  const active = registration?.active || navigator.serviceWorker.controller;
  if (!active) return { supported: false, error: "Sin service worker activo." };
  try {
    const channel = new MessageChannel();
    const responsePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ supported: false, error: "Sin respuesta del service worker." }), 1500);
      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        resolve({
          supported: event.data?.type === "roca-eterna-fcm-pong" && event.data?.hasConfig === true,
          hasConfig: Boolean(event.data?.hasConfig),
          scriptURL: event.data?.scriptURL || "",
          scope: event.data?.scope || ""
        });
      };
    });
    active.postMessage({ type: "roca-eterna-fcm-ping" }, [channel.port2]);
    return responsePromise;
  } catch (error) {
    return { supported: false, error: error?.message || String(error) };
  }
}

async function getRuntimeDiagnostics() {
  const deviceContext = getNotificationDeviceContext();
  const diagnostic = {
    origin: window.location.origin,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    pathnameBase: import.meta.env.BASE_URL || "/",
    href: window.location.href,
    notificationPermission: typeof Notification === "undefined" ? "no_soportado" : Notification.permission,
    serviceWorkerSupport: "serviceWorker" in navigator,
    pushManagerSupport: "PushManager" in window,
    isSecureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
    serviceWorkerUrl: serviceWorkerUrl(),
    serviceWorkerFileStatus: "",
    serviceWorkerScope: "",
    serviceWorkerScriptURL: "",
    serviceWorkerControllerScriptURL: navigator.serviceWorker?.controller?.scriptURL || "",
    serviceWorkerUsedForTokenScope: "",
    serviceWorkerUsedForTokenScriptURL: "",
    serviceWorkerUsedMatchesActive: false,
    serviceWorkerHasFcmSupport: false,
    serviceWorkerFcmSupportError: "",
    foregroundListenerRegistered: false,
    foregroundListenerRegisteredAt: "",
    foregroundListenerError: "",
    serviceWorkerScopeWarning: "",
    lastForegroundPush: getLastForegroundPush(),
    lastBackgroundPush: getLastBackgroundPush(),
    androidDevice: deviceContext.android,
    mobileDevice: deviceContext.mobile,
    standalonePwa: deviceContext.standalone,
    generalPermission: deviceContext.android ? "no_comprobable" : "no_aplica",
    sitePermission: typeof Notification === "undefined" ? "no_soportado" : Notification.permission,
    tokenSaved: Boolean(localStorage.getItem(TOKEN_STORAGE_KEY))
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
    diagnostic.serviceWorkerControllerScriptURL = navigator.serviceWorker?.controller?.scriptURL || "";
    diagnostic.serviceWorkerRegistrations = (registrations || []).map((item) => ({
      scope: item.scope,
      active: item.active?.scriptURL || "",
      waiting: item.waiting?.scriptURL || "",
      installing: item.installing?.scriptURL || ""
    }));
    const fcmSupport = await checkActiveServiceWorkerFcmSupport(registration);
    diagnostic.serviceWorkerHasFcmSupport = Boolean(fcmSupport.supported);
    diagnostic.serviceWorkerFcmSupportError = fcmSupport.error || "";
    if (diagnostic.serviceWorkerScope && !diagnostic.serviceWorkerScope.includes(import.meta.env.BASE_URL || "/")) {
      diagnostic.serviceWorkerScopeWarning = "El service worker no esta bajo el scope correcto de GitHub Pages.";
    }
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
      console.info("[FCM] foreground payload received", {
        title: message.title,
        type: message.type,
        notificationId: message.notificationId,
        scheduleId: message.scheduleId,
        songId: message.songId,
        receivedAt: message.receivedAt
      });
      callback?.(message, payload);
    });
    saveForegroundListenerStatus({ registered: true, registeredAt: new Date().toISOString(), error: "" });
    console.info("[FCM] foreground listener registered");
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
  if (Notification.permission !== "granted") {
    return {
      ...diagnostic,
      supported: true,
      reason: androidDefaultInstructions
    };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    diagnostic.serviceWorkerRegistered = Boolean(registration);
    diagnostic.serviceWorkerUsedForTokenScope = registration?.scope || "";
    diagnostic.serviceWorkerUsedForTokenScriptURL = registration?.active?.scriptURL || registration?.installing?.scriptURL || registration?.waiting?.scriptURL || "";
    diagnostic.serviceWorkerUsedMatchesActive = !diagnostic.serviceWorkerScriptURL || diagnostic.serviceWorkerUsedForTokenScriptURL === diagnostic.serviceWorkerScriptURL;
  } catch (error) {
    diagnostic.supported = false;
    diagnostic.reason = "No se pudo registrar el service worker de notificaciones.";
    diagnostic.error = error?.message || String(error);
  }

  const cachedTokenId = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (profile?.uid && cachedTokenId) {
    diagnostic.tokenPath = buildTokenPath(profile.uid, cachedTokenId);
    diagnostic.firestoreWrite = "token existente";
    diagnostic.tokenSaved = true;
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

  const support = await getPushSupportStatus();
  Object.assign(diagnostic, support);
  diagnostic.browserPermission = Notification.permission;
  if (!support.supported) return diagnostic;

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  diagnostic.browserPermission = permission;
  if (permission !== "granted") {
    return {
      ...diagnostic,
      supported: false,
      reason: permission === "default"
        ? "Chrome no mostró el permiso. Abre el candado o Configuración del sitio y permite notificaciones para este sitio."
        : "El permiso de notificaciones no fue concedido."
    };
  }

  Object.assign(diagnostic, await getRuntimeDiagnostics());

  let registration = null;
  try {
    registration = await getServiceWorkerRegistration();
    diagnostic.serviceWorkerRegistered = Boolean(registration);
    diagnostic.serviceWorkerUsedForTokenScope = registration?.scope || "";
    diagnostic.serviceWorkerUsedForTokenScriptURL = registration?.active?.scriptURL || registration?.installing?.scriptURL || registration?.waiting?.scriptURL || "";
    diagnostic.serviceWorkerUsedMatchesActive = !diagnostic.serviceWorkerScriptURL || diagnostic.serviceWorkerUsedForTokenScriptURL === diagnostic.serviceWorkerScriptURL;
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

  const topicRegistration = await registerPushTokenForBroadcast(token, tokenId).catch((error) => ({
    ok: false,
    error: error?.message || String(error)
  }));

  try {
    const previousTokenId = localStorage.getItem(TOKEN_STORAGE_KEY);
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
    if (previousTokenId && previousTokenId !== tokenId) {
      await setDoc(
        doc(db, "users", profile.uid, "fcmTokens", previousTokenId),
        { active: false, replacedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => undefined);
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenId);
    return {
      ...diagnostic,
      supported: true,
      firestoreWrite: "permitida",
      reason: "Notificaciones del navegador activadas para este dispositivo.",
      tokenId,
      tokenSaved: true,
      topicRegistered: topicRegistration?.ok === true,
      topicRegistration
    };
  } catch (error) {
    if (topicRegistration?.ok === true) {
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenId);
      return {
        ...diagnostic,
        supported: true,
        firestoreWrite: "temporalmente no disponible",
        reason: "Notificaciones activadas. El registro de diagnostico en Firestore se completara despues.",
        tokenId,
        tokenSaved: true,
        topicRegistered: true,
        topicRegistration,
        firestoreError: error?.message || String(error)
      };
    }
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
  const runtime = await getRuntimeDiagnostics();
  const diagnostic = {
    ...support,
    ...runtime,
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
  diagnostic.serviceWorkerUsedForTokenScope = registration?.scope || "";
  diagnostic.serviceWorkerUsedForTokenScriptURL = registration?.active?.scriptURL || registration?.installing?.scriptURL || registration?.waiting?.scriptURL || "";
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
    tokenId,
    firestoreWrite: "token existente",
    token
  };
}

export async function cleanupCurrentUserFcmTokens(profile) {
  if (!profile?.uid || !db) {
    return { ok: false, error: "No hay usuario autenticado.", total: 0, active: 0, unique: 0, duplicatesDeactivated: 0, inactive: 0 };
  }

  const snapshot = await getDocs(collection(db, "users", profile.uid, "fcmTokens"));
  const seen = new Map();
  const result = {
    ok: true,
    total: snapshot.size,
    active: 0,
    unique: 0,
    duplicatesDeactivated: 0,
    inactive: 0,
    invalidDeactivated: 0,
    error: ""
  };

  await Promise.all(snapshot.docs.map(async (tokenDoc) => {
    const data = tokenDoc.data();
    if (!data?.token) {
      result.invalidDeactivated += 1;
      await setDoc(tokenDoc.ref, {
        active: false,
        deactivatedAt: serverTimestamp(),
        inactiveReason: "token_vacio"
      }, { merge: true });
      return;
    }
    if (data.active !== true) {
      result.inactive += 1;
      return;
    }
    result.active += 1;
    if (seen.has(data.token)) {
      result.duplicatesDeactivated += 1;
      await setDoc(tokenDoc.ref, {
        active: false,
        duplicateOf: seen.get(data.token),
        deactivatedAt: serverTimestamp(),
        inactiveReason: "token_duplicado"
      }, { merge: true });
      return;
    }
    seen.set(data.token, tokenDoc.id);
    result.unique += 1;
  }));

  return result;
}

export async function requestSiteNotificationPermissionOnly() {
  const permissionBefore = typeof Notification === "undefined" ? "no_soportado" : Notification.permission;
  const result = {
    permissionBefore,
    permissionAfter: permissionBefore,
    origin: window.location.origin,
    href: window.location.href,
    error: ""
  };

  if (!("Notification" in window)) {
    return { ...result, error: "Este navegador no soporta notificaciones." };
  }
  if (Notification.permission === "denied") {
    return { ...result, error: deniedInstructions };
  }

  const permission = await Notification.requestPermission();
  result.permissionAfter = permission;
  if (permission === "default") {
    result.error = "Chrome no mostro el permiso. En algunos Android, las push web requieren instalar la app como PWA o abrir el sitio desde Chrome completo, no desde una vista embebida. Abre el sitio en Chrome, menu de tres puntos, Agregar a pantalla principal o Instalar app, abre desde el icono instalado y toca Activar notificaciones.";
  } else if (permission !== "granted") {
    result.error = "El permiso de notificaciones no fue concedido.";
  }
  return result;
}

async function showLocalTestNotification({ title, body, requireInteraction = false }) {
  if (!("Notification" in window)) {
    return { ok: false, method: "", error: "Notification API no disponible" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, method: "", error: "Permiso no concedido" };
  }

  const options = {
    body,
    icon: iconUrl(),
    badge: iconUrl(),
    tag: "roca-eterna-local-test",
    requireInteraction: Boolean(requireInteraction),
    data: {
      url: window.location.href,
      type: "local_test"
    }
  };

  let registration = null;
  let registrationError = "";
  try {
    registration = await navigator.serviceWorker?.ready;
  } catch (error) {
    registrationError = error?.message || String(error);
  }

  if (registration && typeof registration.showNotification === "function") {
    try {
      await registration.showNotification(title, options);
      return { ok: true, method: "serviceWorkerRegistration.showNotification", error: "" };
    } catch (error) {
      registrationError = error?.message || String(error);
    }
  }

  if (typeof Notification === "function") {
    try {
      const notification = new Notification(title, {
        body,
        icon: iconUrl(),
        tag: "roca-eterna-local-test",
        requireInteraction: Boolean(requireInteraction)
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return { ok: true, method: "new Notification", error: "" };
    } catch (error) {
      const notificationError = error?.message || String(error);
      if (registration && typeof registration.showNotification === "function") {
        try {
          await registration.showNotification(title, options);
          return { ok: true, method: "serviceWorkerRegistration.showNotification", error: "" };
        } catch (retryError) {
          return {
            ok: false,
            method: "serviceWorkerRegistration.showNotification",
            error: retryError?.message || String(retryError)
          };
        }
      }
      return {
        ok: false,
        method: "new Notification",
        error: registrationError ? `${notificationError} / Service worker: ${registrationError}` : notificationError
      };
    }
  }

  return {
    ok: false,
    method: registrationError ? "serviceWorkerRegistration.showNotification" : "",
    error: registrationError || "Notification API no disponible"
  };
}

export async function testLocalNotification(options = {}) {
  const permissionBefore = typeof Notification === "undefined" ? "no_soportado" : Notification.permission;
  const result = {
    permissionBefore,
    permissionAfter: permissionBefore,
    attempted: false,
    executed: false,
    method: "",
    error: "",
    origin: window.location.origin,
    href: window.location.href
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
      ? "Chrome no mostró el permiso. Abre el candado o Configuración del sitio y permite notificaciones para este sitio."
      : "El permiso de notificaciones no fue concedido.";
    return result;
  }

  try {
    result.attempted = true;
    const localResult = await showLocalTestNotification({
      title: options.requireInteraction ? "Prueba local persistente" : "Prueba local",
      body: "Chrome puede mostrar notificaciones para Roca Eterna Musica.",
      requireInteraction: Boolean(options.requireInteraction)
    });
    result.method = localResult.method;
    result.executed = localResult.ok;
    result.error = localResult.error || "";
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
  localStorage.removeItem(TOKEN_STORAGE_KEY);
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
