/* global firebase */
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const CACHE_NAME = "roca-eterna-musica-v1.0.1-single-welcome-splash";
const OLD_ICON_PATTERNS = [
  "icon-192",
  "icon-512",
  "logo%20modo%20claro",
  "logo%20modo%20oscuro",
  "cropped-LOGO-IBRE-5-1"
];

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

const baseUrl = new URL(self.registration.scope).pathname || "/";
const iconPath = `${baseUrl.replace(/\/$/, "")}/icons/pwa-192.png`;
const hasConfig = Object.values(firebaseConfig).every(Boolean);
const shownTags = new Set();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      `${baseUrl}manifest.webmanifest`,
      `${baseUrl}favicon.png`,
      `${baseUrl}icons/roca-eterna-logo-light.png`,
      `${baseUrl}icons/roca-eterna-logo-dark.png`,
      `${baseUrl}icons/pwa-192.png`,
      `${baseUrl}icons/pwa-512.png`,
      `${baseUrl}icons/pwa-maskable-192.png`,
      `${baseUrl}icons/pwa-maskable-512.png`,
      `${baseUrl}icons/apple-touch-icon.png`
    ]).catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(async (key) => {
      if (key !== CACHE_NAME && key.startsWith("roca-eterna-musica")) {
        await caches.delete(key);
      }
    }));
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    await Promise.all(requests.map((request) => {
      const href = request.url || "";
      return OLD_ICON_PATTERNS.some((pattern) => href.includes(pattern)) ? cache.delete(request) : Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

function resolveUrl(url = "") {
  if (/^https?:\/\//i.test(url)) return url;
  const base = self.registration.scope || "/";
  if (!url) return base;
  if (url.startsWith("/#/")) return `${base.replace(/\/$/, "")}${url}`;
  if (url.startsWith("#/")) return `${base}${url}`;
  if (url.startsWith("/")) return new URL(url, self.location.origin).href;
  return new URL(url, base).href;
}

function normalizeMessage(payload = {}) {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const fcmOptions = payload.fcmOptions || {};
  const notificationId = data.notificationId || data.scheduleId || data.songId || payload.messageId || `${Date.now()}`;
  const url = resolveUrl(data.url || fcmOptions.link || self.registration.scope || "/");
  return {
    title: notification.title || data.title || "Roca Eterna Musica",
    body: notification.body || data.body || data.message || "",
    icon: notification.icon || data.icon || iconPath,
    badge: data.badge || iconPath,
    url,
    tag: data.tag || notificationId,
    data: { ...data, url, notificationId }
  };
}

function notifyClients(message) {
  const payload = {
    type: "roca-eterna-background-push",
    payload: {
      title: message.title,
      body: message.body,
      url: message.url,
      tag: message.tag,
      notificationId: message.data?.notificationId || "",
      scheduleId: message.data?.scheduleId || "",
      songId: message.data?.songId || "",
      receivedAt: new Date().toISOString()
    }
  };

  try {
    const channel = new BroadcastChannel("roca-eterna-push");
    channel.postMessage(payload);
    channel.close();
  } catch {
    // BroadcastChannel no esta disponible en todos los navegadores.
  }

  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => client.postMessage(payload));
  });
}

function showNotificationOnce(payload) {
  const message = normalizeMessage(payload);
  notifyClients(message);
  if (shownTags.has(message.tag)) return Promise.resolve();
  shownTags.add(message.tag);
  setTimeout(() => shownTags.delete(message.tag), 60000);
  return self.registration.getNotifications?.({ tag: message.tag }).then((existing = []) => {
    if (existing.length) return undefined;
    return self.registration.showNotification(message.title, {
      body: message.body,
      icon: message.icon,
      badge: message.badge,
      tag: message.tag,
      renotify: false,
      data: message.data
    });
  }) || self.registration.showNotification(message.title, {
    body: message.body,
    icon: message.icon,
    badge: message.badge,
    tag: message.tag,
    renotify: false,
    data: message.data
  });
}

if (hasConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => showNotificationOnce(payload));
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Roca Eterna Musica", body: event.data?.text?.() || "Nueva notificacion" };
  }

  event.waitUntil(showNotificationOnce(data.data ? { data: data.data, notification: data.notification } : data));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "roca-eterna-fcm-ping") {
    event.ports?.[0]?.postMessage({
      type: "roca-eterna-fcm-pong",
      hasConfig,
      scriptURL: self.location.href,
      scope: self.registration.scope
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const fallbackUrl = self.registration.scope || "/";
  const url = event.notification?.data?.url || fallbackUrl;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.focus();
      return existing.navigate(url);
    }
    return clients.openWindow(url);
  })());
});
