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

const hasConfig = Object.values(firebaseConfig).every(Boolean);

if (hasConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "Roca Eterna Música";
    const options = {
      body: payload.notification?.body || payload.data?.body || payload.data?.message || "",
      icon: payload.data?.icon || "/roca-eterna-musica/icons/icon-192.png",
      badge: payload.data?.badge || "/roca-eterna-musica/icons/icon-192.png",
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
    data = { title: "Roca Eterna Música", body: event.data?.text?.() || "Nueva notificación" };
  }

  const notification = data.notification || data;
  const title = notification.title || data.title || "Roca Eterna Música";
  const options = {
    body: notification.body || notification.message || data.body || "",
    icon: data.icon || data.data?.icon || "/roca-eterna-musica/icons/icon-192.png",
    badge: data.badge || data.data?.badge || "/roca-eterna-musica/icons/icon-192.png",
    data: data.data || data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/roca-eterna-musica/";
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.includes("/roca-eterna-musica/"));
    if (existing) {
      await existing.focus();
      return existing.navigate(url);
    }
    return clients.openWindow(url);
  })());
});
