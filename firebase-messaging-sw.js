/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey") || "",
  authDomain: params.get("authDomain") || "",
  projectId: params.get("projectId") || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId: params.get("appId") || ""
};

const baseUrl = new URL(self.registration.scope).pathname || "/";
const iconPath = `${baseUrl.replace(/\/$/, "")}/icons/icon-192.png`;
const hasConfig = Object.values(firebaseConfig).every(Boolean);

if (hasConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "Roca Eterna Musica";
    const options = {
      body: payload.notification?.body || payload.data?.body || payload.data?.message || "",
      icon: payload.data?.icon || iconPath,
      badge: payload.data?.badge || iconPath,
      data: payload.data || {}
    };
    self.registration.showNotification(title, options);
  });
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Roca Eterna Musica", body: event.data?.text?.() || "Nueva notificacion" };
  }

  const notification = data.notification || data;
  const title = notification.title || data.title || "Roca Eterna Musica";
  const options = {
    body: notification.body || notification.message || data.body || "",
    icon: data.icon || data.data?.icon || iconPath,
    badge: data.badge || data.data?.badge || iconPath,
    data: data.data || data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
