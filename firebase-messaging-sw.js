self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Roca Eterna Música", body: event.data?.text?.() || "Nueva notificación" };
  }

  const notification = data.notification || data;
  const title = notification.title || "Roca Eterna Música";
  const options = {
    body: notification.body || notification.message || "",
    icon: "/roca-eterna-musica/icons/icon-192.png",
    badge: "/roca-eterna-musica/icons/icon-192.png",
    data: data.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/roca-eterna-musica/";
  event.waitUntil(clients.openWindow(url));
});
