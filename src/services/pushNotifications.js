import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseApp, firebaseVapidKey, isFirebaseConfigured } from "../lib/firebase";

const TOKEN_STORAGE_KEY = "roca-eterna-fcm-token-id";

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

export async function diagnosePushNotifications(profile) {
  const support = await getPushSupportStatus();
  if (!support.supported) return support;

  const diagnostic = {
    ...support,
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
  }

  return diagnostic;
}

export async function enablePushNotificationsForUser(profile) {
  const support = await getPushSupportStatus();
  const diagnostic = {
    ...support,
    browserPermission: typeof Notification === "undefined" ? "no_soportado" : Notification.permission
  };

  if (!profile?.uid) {
    return {
      ...diagnostic,
      supported: false,
      reason: "No se encontro un usuario autenticado para guardar este dispositivo."
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

  const permission = await Notification.requestPermission();
  diagnostic.browserPermission = permission;
  if (permission !== "granted") {
    return {
      ...diagnostic,
      supported: false,
      reason: "El permiso de notificaciones no fue concedido."
    };
  }

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
    token
  };
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
