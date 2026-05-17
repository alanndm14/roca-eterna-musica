import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseApp, firebaseVapidKey, isFirebaseConfigured } from "../lib/firebase";

const tokenIdFromValue = (token = "") => token.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120) || `${Date.now()}`;

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  const baseUrl = import.meta.env.BASE_URL || "/";
  try {
    return await navigator.serviceWorker.register(`${baseUrl}firebase-messaging-sw.js`);
  } catch {
    return navigator.serviceWorker.ready;
  }
}

export async function getPushSupportStatus() {
  if (!isFirebaseConfigured || !firebaseApp) return { supported: false, reason: "Firebase no está configurado." };
  if (!firebaseVapidKey) return { supported: false, reason: "Las notificaciones push aún no están configuradas. Las notificaciones dentro de la app siguen activas." };
  if (!("Notification" in window)) return { supported: false, reason: "Este navegador no soporta notificaciones." };
  if (!(await isSupported())) return { supported: false, reason: "Firebase Messaging no está disponible en este navegador." };
  return { supported: true, reason: "" };
}

export async function enablePushNotificationsForUser(profile) {
  const support = await getPushSupportStatus();
  if (!support.supported) return support;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { supported: false, reason: "El permiso de notificaciones no fue concedido." };

  const registration = await getServiceWorkerRegistration();
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration: registration || undefined
  });

  if (!token) return { supported: false, reason: "No se pudo obtener token FCM." };

  const tokenId = tokenIdFromValue(token);
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

  localStorage.setItem("roca-eterna-fcm-token-id", tokenId);
  return { supported: true, tokenId };
}

export async function disablePushNotificationsForUser(profile) {
  if (!profile?.uid || !isFirebaseConfigured || !firebaseApp) return;
  const tokenId = localStorage.getItem("roca-eterna-fcm-token-id");
  try {
    if (await isSupported()) {
      const messaging = getMessaging(firebaseApp);
      await deleteToken(messaging).catch(() => undefined);
    }
  } finally {
    if (tokenId) {
      await setDoc(doc(db, "users", profile.uid, "fcmTokens", tokenId), { active: false, lastSeenAt: serverTimestamp() }, { merge: true });
      localStorage.removeItem("roca-eterna-fcm-token-id");
    }
  }
}
