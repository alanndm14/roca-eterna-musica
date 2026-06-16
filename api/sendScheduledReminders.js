import admin from "firebase-admin";

const BROADCAST_TOPIC = "roca-eterna-updates";
const TIME_ZONE = "America/Mexico_City";
const DEFAULT_APP_URL = "https://musica.rocaeternamexico.com.mx";
const VALID_STATUSES = new Set(["planeado", "listo"]);

function initializeAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "";

  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error("Firebase Admin no esta configurado en el backend.");
    error.code = "BACKEND_CONFIG_MISSING";
    throw error;
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
    ...(storageBucket ? { storageBucket } : {})
  });
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}

function sanitizeError(error = {}) {
  return {
    code: error.code || error.errorInfo?.code || "",
    message: error.message || String(error)
  };
}

function appBaseUrl() {
  return String(process.env.PUSH_APP_BASE_URL || process.env.PUSH_ALLOWED_ORIGIN || DEFAULT_APP_URL).split(",")[0].replace(/\/$/, "");
}

function appLink(path = "/") {
  const cleanPath = String(path || "/").startsWith("/") ? path : `/${path}`;
  return `${appBaseUrl()}${cleanPath}`;
}

function publicIconUrl() {
  return `${appBaseUrl()}/icons/pwa-192.png`;
}

function todayInTimeZone(timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDateOnly(dateString = "") {
  const [year, month, day] = String(dateString).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function diffDays(fromDateString, toDateString) {
  const from = parseDateOnly(fromDateString);
  const to = parseDateOnly(toDateString);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function shortDate(dateString = "") {
  const date = parseDateOnly(dateString);
  if (!date) return "sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    day: "numeric",
    month: "long"
  }).format(date);
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function serviceName(serviceType = "") {
  const normalized = normalizeText(serviceType);
  if (normalized.includes("miercoles")) return "miercoles de oracion";
  if (normalized.includes("domingo") && (normalized.includes("pm") || normalized.includes("tarde"))) return "domingo PM";
  if (normalized.includes("domingo")) return "domingo AM";
  if (normalized.includes("especial")) return "servicio especial";
  return serviceType || "servicio";
}

function targetWeekdayWord(serviceType = "", plannedDate = "") {
  const normalized = normalizeText(serviceType);
  if (normalized.includes("miercoles")) return "miercoles";
  if (normalized.includes("domingo")) return "domingo";
  const date = parseDateOnly(plannedDate);
  if (!date) return "servicio";
  return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long" }).format(date);
}

function reminderKind(plannedSong, today) {
  const plannedDate = plannedSong.plannedDate || "";
  const days = diffDays(today, plannedDate);
  if (days === null || days < 0) return null;

  if (days === 2) {
    return {
      id: "two-days",
      title: "Canto nuevo en 2 dias"
    };
  }

  const date = parseDateOnly(plannedDate);
  const weekday = date?.getUTCDay();
  const normalizedServiceType = normalizeText(plannedSong.serviceType);
  const isWednesday = weekday === 3 || normalizedServiceType.includes("miercoles");
  const isSunday = weekday === 0 || normalizedServiceType.includes("domingo");

  if ((isWednesday && days === 6) || (isSunday && days === 3)) {
    return {
      id: "previous-thursday",
      title: `Canto nuevo el proximo ${targetWeekdayWord(plannedSong.serviceType, plannedDate)}`
    };
  }

  return null;
}

function notificationIdFor(plannedSong, kind) {
  const baseId = plannedSong.id || `${plannedSong.songId || "sin-canto"}-${plannedSong.plannedDate || "sin-fecha"}`;
  return `planned-new-song-reminder-${kind.id}-${baseId}`;
}

async function reserveDelivery(notificationId) {
  const ref = admin.firestore().doc(`pushDeliveries/${notificationId}`);
  let reserved = false;
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : null;
    if (data?.status === "sent" || data?.status === "partial" || data?.status === "sending") return;
    transaction.set(ref, {
      status: "sending",
      source: "scheduled_reminder",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    reserved = true;
  });
  return reserved;
}

async function finishDelivery(notificationId, payload) {
  await admin.firestore().doc(`pushDeliveries/${notificationId}`).set({
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function createInternalNotification(plannedSong, reminder, notificationId, body) {
  const existing = await admin.firestore()
    .collection("notifications")
    .where("pushNotificationId", "==", notificationId)
    .limit(1)
    .get();
  if (!existing.empty) return false;

  await admin.firestore().collection("notifications").add({
    type: "new_song",
    title: reminder.title,
    message: body,
    pushNotificationId: notificationId,
    entityType: plannedSong.songId ? "song" : "planned_new_song",
    entityId: plannedSong.songId || plannedSong.id || "",
    songId: plannedSong.songId || "",
    plannedNewSongId: plannedSong.id || "",
    plannedDate: plannedSong.plannedDate || "",
    serviceType: plannedSong.serviceType || "",
    active: true,
    deleted: false,
    relatedEntityDeleted: false,
    targetRoles: ["admin", "editor", "viewer"],
    targetUsers: [],
    readBy: [],
    dismissedBy: [],
    createdBy: "system",
    createdByUid: "system",
    createdByName: "Recordatorio automatico",
    createdByEmail: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return true;
}

async function sendReminder(plannedSong, reminder, notificationId, body) {
  const songPath = plannedSong.songId
    ? `/#/repertorio/${plannedSong.songId}`
    : "/#/servicios";
  const url = appLink(songPath);
  const icon = publicIconUrl();
  const message = {
    topic: BROADCAST_TOPIC,
    notification: {
      title: reminder.title,
      body
    },
    data: {
      type: "new_song",
      notificationId,
      entityType: plannedSong.songId ? "song" : "planned_new_song",
      entityId: plannedSong.songId || plannedSong.id || "",
      songId: plannedSong.songId || "",
      plannedNewSongId: plannedSong.id || "",
      url,
      title: reminder.title,
      body
    },
    webpush: {
      notification: {
        title: reminder.title,
        body,
        icon,
        badge: icon,
        tag: notificationId,
        renotify: false,
        requireInteraction: false,
        data: { url, notificationId }
      },
      fcmOptions: { link: url }
    }
  };

  const messageId = await admin.messaging().send(message);
  return { messageId, url };
}

function hasValidCronSecret(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return true;
  const authorization = request.headers.authorization || "";
  const querySecret = request.query?.secret || "";
  return authorization === `Bearer ${secret}` || querySecret === secret;
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    return sendJson(response, 405, { ok: false, message: "Metodo no permitido." });
  }

  if (!hasValidCronSecret(request)) {
    return sendJson(response, 401, {
      ok: false,
      message: "Recordatorios protegidos. Revisa CRON_SECRET en las variables de entorno de Vercel."
    });
  }

  try {
    initializeAdmin();
    const today = todayInTimeZone();
    const snapshot = await admin.firestore()
      .collection("plannedNewSongs")
      .where("plannedDate", ">=", today)
      .get();

    const reminders = [];
    let checked = 0;
    let due = 0;
    let sent = 0;
    let skipped = 0;
    let internalCreated = 0;
    const errors = [];

    for (const doc of snapshot.docs) {
      const plannedSong = { id: doc.id, ...doc.data() };
      checked += 1;
      if (!VALID_STATUSES.has(plannedSong.status || "planeado")) {
        skipped += 1;
        continue;
      }

      const reminder = reminderKind(plannedSong, today);
      if (!reminder) continue;

      due += 1;
      const notificationId = notificationIdFor(plannedSong, reminder);
      const body = `${plannedSong.songTitle || "Canto nuevo"} - ${serviceName(plannedSong.serviceType)} ${shortDate(plannedSong.plannedDate)}`;

      try {
        const reserved = await reserveDelivery(notificationId);
        if (!reserved) {
          skipped += 1;
          reminders.push({ notificationId, skipped: true, reason: "duplicate" });
          continue;
        }

        const created = await createInternalNotification(plannedSong, reminder, notificationId, body);
        if (created) internalCreated += 1;
        const result = await sendReminder(plannedSong, reminder, notificationId, body);
        await finishDelivery(notificationId, {
          status: "sent",
          source: "scheduled_reminder",
          sent: 1,
          failed: 0,
          notificationId,
          title: reminder.title,
          body,
          url: result.url,
          messageId: result.messageId
        });
        sent += 1;
        reminders.push({ notificationId, title: reminder.title, body, url: result.url, sent: true });
      } catch (error) {
        const sanitized = sanitizeError(error);
        errors.push({ notificationId, ...sanitized });
        await finishDelivery(notificationId, {
          status: "failed",
          source: "scheduled_reminder",
          notificationId,
          error: sanitized
        }).catch(() => undefined);
      }
    }

    return sendJson(response, 200, {
      ok: errors.length === 0,
      today,
      checked,
      due,
      sent,
      skipped,
      internalCreated,
      errors,
      reminders
    });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      ...sanitizeError(error)
    });
  }
}
