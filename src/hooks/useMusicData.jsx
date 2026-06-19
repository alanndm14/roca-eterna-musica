import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, isFirebaseConfigured, storage } from "../lib/firebase";
import { sampleSchedules, sampleSettings, sampleSongs, sampleThemes, sampleUsers } from "../data/mockData";
import { canonicalThemeKey, normalizeSong, normalizeThemeName, resolveAppLogoForNotification } from "../services/songUtils";
import { extractLocalPdfText } from "../services/pdfTextIndex";
import { sendExternalPush } from "../services/externalPush";
import { ensurePushBroadcastSubscription } from "../services/pushNotifications";
import { createServiceReviewSnapshot, isNoteworthySongFollowUp, reviewServiceSchedule } from "../services/songScoring";
import { useAuth } from "./useAuth";

const MusicDataContext = createContext(null);
const storageKey = "roca-eterna-musica-demo";

const defaultLocalData = {
  songs: sampleSongs,
  schedules: sampleSchedules,
  plannedNewSongs: [],
  users: sampleUsers,
  authorizedEmails: [],
  themes: sampleThemes,
  settings: sampleSettings
};

const sampleAuditLogs = [];
const sampleNotifications = [];
const obsoleteTestSchedulePushIds = new Set([
  "schedule-created-8Tr8Sa2ulHG89a8Tyd5z",
  "schedule-created-kcU7yosLAZ8BguQbTmM0",
  "schedule-created-EByNIYDpNdRvcWqNX5in",
  "schedule-created-CdcEoVLlCj2amkMliS1e",
  "schedule-created-fPXhEWcME95EnctaLCps"
]);
const testNotificationWindowStart = new Date("2026-06-07T20:00:00.000Z").getTime();
const testNotificationWindowEnd = new Date("2026-06-08T04:30:00.000Z").getTime();
const notificationTime = (item = {}) => {
  if (item.createdAt?.seconds) return item.createdAt.seconds * 1000;
  return new Date(item.createdAt || 0).getTime();
};
const isObsoleteTestScheduleNotification = (item = {}) => {
  const time = notificationTime(item);
  return obsoleteTestSchedulePushIds.has(item.pushNotificationId)
    || item.pushNotificationId?.startsWith?.("new-song-scheduled-")
    || (item.type === "new_song" && (item.entityType === "schedule" || item.scheduleId))
    || (["new_schedule", "new_song"].includes(item.type)
      && (item.entityType === "schedule" || item.scheduleId)
      && time >= testNotificationWindowStart
      && time <= testNotificationWindowEnd);
};

const formatSchedulePushBody = (schedule = {}) => {
  const date = schedule.date
    ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" }).format(new Date(`${schedule.date}T00:00:00`))
    : "Sin fecha";
  return `${schedule.serviceLabel || schedule.type || "Servicio"} · ${date} · ${schedule.time || "Sin hora"}`;
};

const formatScheduleShortLabel = (schedule = {}) => {
  const date = schedule.date
    ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" }).format(new Date(`${schedule.date}T00:00:00`))
    : "sin fecha";
  return `${schedule.serviceLabel || schedule.type || "Servicio"} ${date}`;
};

const plannedServiceLabels = {
  domingo_am: "domingo AM",
  domingo_pm: "domingo PM",
  miercoles: "miércoles de oración",
  especial: "servicio especial",
  otro: "servicio"
};

const formatPlannedNewSongLabel = (plannedSong = {}) => {
  const service = plannedServiceLabels[plannedSong.serviceType] || plannedSong.serviceType || "servicio";
  const date = plannedSong.plannedDate
    ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" }).format(new Date(`${plannedSong.plannedDate}T00:00:00`))
    : "sin fecha";
  return `${service} ${date}`;
};

const toDateMs = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === "object" && Number.isFinite(value.seconds)) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const isRecentlyCreatedSong = (song = {}, days = 30) => {
  const createdMs = toDateMs(song.createdAt);
  if (!createdMs) return false;
  const age = Date.now() - createdMs;
  return age >= 0 && age <= days * 24 * 60 * 60 * 1000;
};

const scheduleEntryId = (entry = {}) => entry.songId || entry.titleSnapshot || "";

const simpleHash = (value = "") => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const summarizeTitles = (titles = [], singularVerb = "Se agrego", pluralVerb = "Se agregaron") => {
  const clean = titles.filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return `${singularVerb}: ${clean[0]}`;
  return `${pluralVerb}: ${clean.slice(0, 3).join(", ")}${clean.length > 3 ? ` y ${clean.length - 3} mas` : ""}`;
};

const buildScheduleChange = (before = {}, after = {}) => {
  if (!before?.id || !after) return { relevant: false, summary: "", signature: "", addedEntries: [] };
  const beforeEntries = before.songs || [];
  const afterEntries = after.songs || [];
  const beforeIds = beforeEntries.map(scheduleEntryId);
  const afterIds = afterEntries.map(scheduleEntryId);
  const beforeSet = new Set(beforeIds);
  const afterSet = new Set(afterIds);
  const addedEntries = afterEntries.filter((entry) => !beforeSet.has(scheduleEntryId(entry)));
  const removedEntries = beforeEntries.filter((entry) => !afterSet.has(scheduleEntryId(entry)));
  const commonBefore = beforeIds.filter((id) => afterSet.has(id));
  const commonAfter = afterIds.filter((id) => beforeSet.has(id));
  const parts = [];

  if (beforeEntries.length !== afterEntries.length) parts.push(`Cantidad de cantos: ${beforeEntries.length} a ${afterEntries.length}`);
  const addedSummary = summarizeTitles(addedEntries.map((entry) => entry.titleSnapshot || entry.songId));
  const removedSummary = summarizeTitles(removedEntries.map((entry) => entry.titleSnapshot || entry.songId), "Se quito", "Se quitaron");
  if (addedSummary) parts.push(addedSummary);
  if (removedSummary) parts.push(removedSummary);
  if (JSON.stringify(commonBefore) !== JSON.stringify(commonAfter)) parts.push("Cambio el orden de los cantos");
  if (before.date !== after.date) parts.push(`Cambio la fecha a ${after.date || "sin fecha"}`);
  if (before.time !== after.time) parts.push(`Cambio la hora a ${after.time || "sin hora"}`);
  if ((before.leader || "") !== (after.leader || "")) parts.push(`Cambio el lider a ${after.leader || "sin definir"}`);

  return {
    relevant: parts.length > 0,
    summary: parts.join(". "),
    signature: JSON.stringify({ beforeSongs: beforeIds, afterSongs: afterIds, date: after.date || "", time: after.time || "", leader: after.leader || "" }),
    addedEntries
  };
};

const loadLocalData = () => {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : defaultLocalData;
  } catch {
    return defaultLocalData;
  }
};

const normalizeValue = (value) => {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeValue(child)]));
  }
  return value;
};

const withId = (snap) => ({
  id: snap.id,
  ...normalizeValue(snap.data())
});

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayString = () => new Date().toISOString().slice(0, 10);
const isFutureSchedule = (schedule) => {
  if (!schedule?.date) return false;
  return schedule.date >= todayString();
};

const pickChangedFields = (before = {}, after = {}) => {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));
};

export function MusicDataProvider({ children }) {
  const { profile, isDemoMode } = useAuth();
  const [songs, setSongs] = useState(sampleSongs.map((song) => normalizeSong(song, sampleSettings.keyPreference)));
  const [schedules, setSchedules] = useState(sampleSchedules);
  const [plannedNewSongs, setPlannedNewSongs] = useState([]);
  const [users, setUsers] = useState(sampleUsers);
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [themes, setThemes] = useState(sampleThemes);
  const [settings, setSettings] = useState(sampleSettings);
  const [auditLogs, setAuditLogs] = useState(sampleAuditLogs);
  const [notifications, setNotifications] = useState(sampleNotifications);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const automaticPushRequests = useRef(new Set());

  const useLocal = !isFirebaseConfigured || isDemoMode;

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return undefined;
    }

    if (useLocal) {
      const localData = loadLocalData();
      const keyPreference = localData.settings?.keyPreference || sampleSettings.keyPreference;
      setSongs((localData.songs || sampleSongs).map((song) => normalizeSong(song, keyPreference)));
      setSchedules(localData.schedules || sampleSchedules);
      setPlannedNewSongs(Array.isArray(localData.plannedNewSongs) ? localData.plannedNewSongs : []);
      setUsers(localData.users || sampleUsers);
      setAuthorizedEmails(localData.authorizedEmails || localData.allowedEmails || []);
      setThemes(localData.themes || sampleThemes);
      setSettings(localData.settings || sampleSettings);
      setAuditLogs(localData.auditLogs || sampleAuditLogs);
      setNotifications(localData.notifications || sampleNotifications);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribers = [
      onSnapshot(
        query(collection(db, "songs"), orderBy("title")),
        (snapshot) => setSongs(snapshot.docs.map(withId).map((song) => normalizeSong(song, settings.keyPreference))),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(db, "schedules"), orderBy("date", "desc")),
        (snapshot) => setSchedules(snapshot.docs.map(withId)),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(db, "plannedNewSongs"), orderBy("plannedDate")),
        (snapshot) => setPlannedNewSongs(snapshot.docs.map(withId)),
        (snapshotError) => {
          setPlannedNewSongs([]);
          setError(snapshotError.message);
        }
      ),
      onSnapshot(
        query(collection(db, "themes"), orderBy("name")),
        (snapshot) => setThemes(snapshot.docs.map(withId)),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        doc(db, "settings", "main"),
        (snapshot) => setSettings(snapshot.exists() ? normalizeValue(snapshot.data()) : sampleSettings),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(120)),
        (snapshot) => setNotifications(snapshot.docs.map(withId)),
        (snapshotError) => setError(snapshotError.message)
      )
    ];
    if (profile.role === "admin") {
      unsubscribers.push(
        onSnapshot(query(collection(db, "users"), orderBy("email")), (snapshot) => setUsers(snapshot.docs.map(withId)), (snapshotError) => setError(snapshotError.message)),
        onSnapshot(query(collection(db, "authorizedEmails"), orderBy("email")), (snapshot) => setAuthorizedEmails(snapshot.docs.map(withId)), (snapshotError) => setError(snapshotError.message)),
        onSnapshot(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(250)), (snapshot) => setAuditLogs(snapshot.docs.map(withId)), (snapshotError) => setError(snapshotError.message))
      );
    } else {
      setUsers([]);
      setAuthorizedEmails([]);
      setAuditLogs([]);
    }

    setLoading(false);
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [profile, settings.keyPreference, useLocal]);

  useEffect(() => {
    if (!profile || !useLocal) return;
    localStorage.setItem(storageKey, JSON.stringify({ songs, schedules, plannedNewSongs, users, authorizedEmails, themes, settings, auditLogs, notifications }));
  }, [auditLogs, authorizedEmails, notifications, plannedNewSongs, profile, schedules, settings, songs, themes, useLocal, users]);

  useEffect(() => {
    if (!profile?.uid || profile.role !== "admin" || useLocal || !notifications.length) return;
    const obsolete = notifications.filter((item) => isObsoleteTestScheduleNotification(item) && item.active !== false);
    if (!obsolete.length) return;
    const payload = {
      active: false,
      deleted: true,
      deletedAt: serverTimestamp()
    };
    setNotifications((current) => current.map((item) => (
      isObsoleteTestScheduleNotification(item) ? { ...item, ...payload } : item
    )));
    Promise.allSettled(obsolete.map((item) => updateDoc(doc(db, "notifications", item.id), payload)));
  }, [notifications, profile?.role, profile?.uid, useLocal]);

  const actor = () => ({
    performedByUid: profile?.uid || "",
    performedByName: profile?.preferredDisplayName || profile?.displayName || profile?.email || "",
    performedByEmail: profile?.email || ""
  });

  const logAuditEvent = async (event) => {
    const payload = {
      actionType: event.actionType || "update",
      entityType: event.entityType || "other",
      entityId: event.entityId || "",
      entityName: event.entityName || "",
      summary: event.summary || "",
      beforeData: event.beforeData || null,
      afterData: event.afterData || null,
      changedFields: event.changedFields || pickChangedFields(event.beforeData, event.afterData),
      ...actor(),
      createdAt: useLocal ? new Date().toISOString() : serverTimestamp()
    };
    if (useLocal) {
      setAuditLogs((current) => [{ ...payload, id: makeId("audit") }, ...current].slice(0, 300));
      return;
    }
    await addDoc(collection(db, "auditLogs"), payload);
  };

  const logAuditEventBestEffort = (event) => {
    Promise.resolve()
      .then(() => logAuditEvent(event))
      .catch((error) => {
        console.warn("[Audit] No se pudo registrar auditoría.", {
          entityType: event?.entityType || "",
          entityId: event?.entityId || "",
          message: error?.message || String(error)
        });
      });
  };

  const dispatchInternalNotification = (notification) => {
    if (typeof window === "undefined" || !notification?.id) return;
    window.dispatchEvent(new CustomEvent("roca-eterna-internal-notification", { detail: notification }));
  };

  const showInAppNovelty = (notification) => {
    dispatchInternalNotification({
      ...notification,
      id: notification.id || notification.pushNotificationId || makeId("novelty")
    });
  };

  const createNotificationBestEffort = (notification) => {
    Promise.resolve()
      .then(() => createNotification(notification))
      .catch((error) => {
        console.warn("[Push] No se pudo crear la notificacion interna persistente.", {
          notificationId: notification.pushNotificationId || "",
          message: error?.message || String(error)
        });
      });
  };

  const sendPushBestEffort = (payload, meta = {}) => {
    const notificationId = payload.notificationId || "";
    if (notificationId && automaticPushRequests.current.has(notificationId)) {
      console.info("[push] skipped duplicate", { notificationId });
      return Promise.resolve({ skipped: true, duplicate: true, notificationId });
    }
    if (notificationId) automaticPushRequests.current.add(notificationId);
    console.info("[push] automatic send requested", {
      notificationId,
      type: payload.type || "",
      entityId: payload.scheduleId || payload.songId || ""
    });
    const request = ensurePushBroadcastSubscription(profile)
      .catch((error) => {
        console.warn("[Push] No se pudo confirmar la suscripcion antes del envio.", error?.message || error);
        return { ok: false };
      })
      .then((registration) => sendExternalPush({
        ...payload,
        token: registration?.token || "",
        tokenId: registration?.tokenId || ""
      }, {
          kind: "auto",
          meta: {
            eventoGuardado: true,
            novedadInternaCreada: true,
            pushIntentado: true,
            pushEnviado: false,
            ...meta
          }
        }))
      .then((result) => {
        if (result?.ok === false) {
          console.warn("[Push] No se pudo enviar push externo.", {
            notificationId: payload.notificationId || "",
            stage: result.body?.stage || "",
            message: result.body?.message || result.error || ""
          });
        }
        if (notificationId && (result?.skipped || result?.ok === false)) {
          automaticPushRequests.current.delete(notificationId);
        }
        return result;
      })
      .catch((error) => {
        if (notificationId) automaticPushRequests.current.delete(notificationId);
        console.warn("[Push] Error no bloqueante al enviar push externo.", {
          notificationId: payload.notificationId || "",
          message: error?.message || String(error)
        });
        return { ok: false, error: error?.message || String(error), notificationId };
      });
    return request;
  };

  const notifyScheduleCreatedBestEffort = (schedulePayload, scheduleId) => {
    if (!isFutureSchedule(schedulePayload) || !scheduleId) return;
    const pushNotificationId = `schedule-created-${scheduleId}`;
    const notificationPayload = {
      type: "new_schedule",
      title: "Nueva programación",
      message: formatSchedulePushBody(schedulePayload),
      entityType: "schedule",
      entityId: scheduleId,
      scheduleId,
      isFutureSchedule: true,
      pushNotificationId
    };
    showInAppNovelty(notificationPayload);
    createNotificationBestEffort(notificationPayload);
    sendPushBestEffort({
      type: "new_schedule",
      title: "Nueva programación",
      body: formatSchedulePushBody(schedulePayload),
      url: `/#/programacion?schedule=${scheduleId}`,
      scheduleId,
      notificationId: pushNotificationId,
      icon: resolveAppLogoForNotification(settings, "light"),
      badge: resolveAppLogoForNotification(settings, "light")
    }, { tipoEvento: "schedule_created", eventoGuardado: true, novedadInternaCreada: true });
  };

  const getFirstUseRecentSongs = (addedEntries = [], scheduleId = "") => {
    const previouslyScheduledIds = new Set();
    schedules.forEach((schedule) => {
      if (!schedule || schedule.id === scheduleId || schedule.deleted || schedule.active === false) return;
      (schedule.songs || []).forEach((entry) => {
        if (entry.songId) previouslyScheduledIds.add(entry.songId);
      });
    });
    return addedEntries
      .map((entry) => songs.find((song) => song.id === entry.songId))
      .filter((song) => song?.id && isRecentlyCreatedSong(song) && !previouslyScheduledIds.has(song.id));
  };

  const notifyNewSongsScheduledBestEffort = (schedulePayload, scheduleId, addedEntries = []) => {
    if (!isFutureSchedule(schedulePayload) || !scheduleId) return;
    const newSongs = getFirstUseRecentSongs(addedEntries, scheduleId);
    if (!newSongs.length) return;
    const serviceLabel = formatScheduleShortLabel(schedulePayload);
    const songTitles = newSongs.map((song) => song.title).filter(Boolean);
    const title = newSongs.length === 1 ? `Canto nuevo para ${serviceLabel}` : `Cantos nuevos para ${serviceLabel}`;
    const message = newSongs.length === 1
      ? `${songTitles[0]} se agrego por primera vez a una programación.`
      : `${songTitles.slice(0, 3).join(", ")}${songTitles.length > 3 ? ` y ${songTitles.length - 3} mas` : ""} se agregaron por primera vez.`;
    const pushNotificationId = `new-song-scheduled-${scheduleId}-${simpleHash(newSongs.map((song) => song.id).sort().join("|"))}`;
    const notificationPayload = {
      type: "new_song",
      title,
      message,
      entityType: "schedule",
      entityId: scheduleId,
      scheduleId,
      songId: newSongs.length === 1 ? newSongs[0].id : "",
      isFutureSchedule: true,
      pushNotificationId
    };
    showInAppNovelty(notificationPayload);
    createNotificationBestEffort(notificationPayload);
    sendPushBestEffort({
      type: "new_song",
      title,
      body: message,
      url: `/#/programacion?schedule=${scheduleId}`,
      scheduleId,
      songId: newSongs.length === 1 ? newSongs[0].id : "",
      notificationId: pushNotificationId,
      icon: resolveAppLogoForNotification(settings, "light"),
      badge: resolveAppLogoForNotification(settings, "light")
    }, { tipoEvento: "new_song_scheduled", eventoGuardado: true, novedadInternaCreada: true });
  };

  const notifyScheduleUpdatedBestEffort = (schedulePayload, scheduleId, change = {}) => {
    if (!isFutureSchedule(schedulePayload) || !scheduleId || !change.relevant || !change.summary) return;
    const pushNotificationId = `schedule-updated-${scheduleId}-${simpleHash(change.signature || change.summary)}`;
    const notificationPayload = {
      type: "updated_schedule",
      title: "Programacion actualizada",
      message: `${formatScheduleShortLabel(schedulePayload)}: ${change.summary}`,
      entityType: "schedule",
      entityId: scheduleId,
      scheduleId,
      isFutureSchedule: true,
      pushNotificationId
    };
    showInAppNovelty(notificationPayload);
    createNotificationBestEffort(notificationPayload);
    sendPushBestEffort({
      type: "updated_schedule",
      title: "Programacion actualizada",
      body: notificationPayload.message,
      url: `/#/programacion?schedule=${scheduleId}`,
      scheduleId,
      notificationId: pushNotificationId,
      icon: resolveAppLogoForNotification(settings, "light"),
      badge: resolveAppLogoForNotification(settings, "light")
    }, { tipoEvento: "schedule_updated", eventoGuardado: true, novedadInternaCreada: true });
  };

  const notifySlidesAddedBestEffort = (schedulePayload, scheduleId) => {
    if (!isFutureSchedule(schedulePayload) || !scheduleId || !schedulePayload.slidesUrl) return;
    const pushNotificationId = `slides-ready-${scheduleId}-${simpleHash(schedulePayload.slidesUrl)}`;
    const label = formatScheduleShortLabel(schedulePayload);
    const notificationPayload = {
      type: "other",
      title: "Diapositivas listas para revisión",
      message: `Se agregó el enlace de las diapositivas para ${label}.`,
      entityType: "schedule",
      entityId: scheduleId,
      scheduleId,
      isFutureSchedule: true,
      targetRoles: ["admin", "viewer"],
      targetViewerTypes: ["medios"],
      pushNotificationId
    };
    if (profile?.role === "admin" || (profile?.role === "viewer" && profile?.viewerType === "medios")) {
      showInAppNovelty(notificationPayload);
    }
    createNotificationBestEffort(notificationPayload);
    sendPushBestEffort({
      mode: "targeted",
      audience: "admins_media",
      type: "other",
      title: notificationPayload.title,
      body: notificationPayload.message,
      url: `/#/servicios?schedule=${scheduleId}`,
      scheduleId,
      notificationId: pushNotificationId,
      icon: resolveAppLogoForNotification(settings, "light"),
      badge: resolveAppLogoForNotification(settings, "light")
    }, { tipoEvento: "slides_ready", eventoGuardado: true, novedadInternaCreada: true });
  };

  const createNotification = async (notification) => {
    const payload = {
      type: notification.type || "other",
      title: notification.title || "Nueva notificación",
      message: notification.message || "",
      pushNotificationId: notification.pushNotificationId || "",
      entityType: notification.entityType || (notification.scheduleId ? "schedule" : notification.songId ? "song" : "other"),
      entityId: notification.entityId || notification.scheduleId || notification.songId || "",
      scheduleId: notification.scheduleId || "",
      songId: notification.songId || "",
      active: notification.active !== false,
      deleted: false,
      relatedEntityDeleted: false,
      targetRoles: notification.targetRoles || ["admin", "editor", "viewer"],
      targetUsers: notification.targetUsers || [],
      targetViewerTypes: notification.targetViewerTypes || [],
      readBy: [],
      isFutureSchedule: Boolean(notification.isFutureSchedule),
      createdBy: profile?.uid || "",
      createdByUid: profile?.uid || "",
      createdByName: profile?.preferredDisplayName || profile?.displayName || profile?.email || "",
      createdByEmail: profile?.email || "",
      createdAt: useLocal ? new Date().toISOString() : serverTimestamp()
    };
    if (useLocal) {
      const createdNotification = { ...payload, id: makeId("notification") };
      setNotifications((current) => [createdNotification, ...current]);
      dispatchInternalNotification(createdNotification);
      return createdNotification;
    }
    const created = await addDoc(collection(db, "notifications"), payload);
    const createdNotification = { ...payload, id: created.id };
    dispatchInternalNotification(createdNotification);
    return createdNotification;
  };

  const markNotificationRead = async (notificationId) => {
    if (!profile?.uid || !notificationId) return;
    if (useLocal) {
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, readBy: [...new Set([...(item.readBy || []), profile.uid])] } : item));
      return;
    }
    await updateDoc(doc(db, "notifications", notificationId), { readBy: arrayUnion(profile.uid) });
  };

  const markAllNotificationsRead = async () => {
    await Promise.all(notifications.filter((item) => !(item.readBy || []).includes(profile?.uid)).map((item) => markNotificationRead(item.id)));
  };

  const deactivateRelatedNotifications = async ({ entityType, entityId }) => {
    if (!entityType || !entityId) return;
    const matchesEntity = (item) => (
      item.entityType === entityType && item.entityId === entityId
    ) || (
      entityType === "schedule" && item.scheduleId === entityId
    ) || (
      entityType === "song" && item.songId === entityId
    );
    const payload = {
      active: false,
      deleted: true,
      relatedEntityDeleted: true,
      deletedAt: useLocal ? new Date().toISOString() : serverTimestamp()
    };

    if (useLocal) {
      setNotifications((current) => current.map((item) => matchesEntity(item) ? { ...item, ...payload } : item));
      return;
    }

    const fieldName = entityType === "schedule" ? "scheduleId" : "songId";
    const [entitySnap, legacySnap] = await Promise.all([
      getDocs(query(collection(db, "notifications"), where("entityId", "==", entityId))).catch(() => ({ docs: [] })),
      getDocs(query(collection(db, "notifications"), where(fieldName, "==", entityId))).catch(() => ({ docs: [] }))
    ]);
    const refs = new Map();
    [...entitySnap.docs, ...legacySnap.docs].forEach((item) => refs.set(item.ref.path, item.ref));
    await Promise.all([...refs.values()].map((refItem) => updateDoc(refItem, payload).catch(() => undefined)));
  };

  const saveSong = async (song) => {
    const before = song.id ? songs.find((item) => item.id === song.id) : null;
    const normalizedSong = normalizeSong(song, settings.keyPreference);
    const payload = {
      ...normalizedSong,
      tags: normalizedSong.tags || [],
      lyricsSections: normalizedSong.lyricsSections || [],
      updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp()
    };
    const pdfSourceChanged = Boolean(before) && (
      String(before.localPdfPath || "").trim() !== String(payload.localPdfPath || "").trim()
      || String(before.pdfVersion || "") !== String(payload.pdfVersion || "")
    );
    if (pdfSourceChanged) {
      Object.assign(payload, {
        pdfSearchText: "",
        pdfOcrText: "",
        pdfSearchTokens: [],
        pdfIndexStatus: "pending",
        pdfIndexMethod: "",
        indexedTextAvailable: false,
        textFingerprint: "",
        indexedPdfPath: "",
        indexedPdfVersion: "",
        pdfIndexedAt: ""
      });
    }

    if (useLocal) {
      if (song.id) {
        setSongs((current) => current.map((item) => (item.id === song.id ? { ...item, ...payload } : item)));
        await logAuditEvent({ actionType: "update", entityType: "song", entityId: song.id, entityName: payload.title, summary: `Canto editado: ${payload.title}`, beforeData: before, afterData: payload });
        return song.id;
      } else {
        const id = makeId("song");
        setSongs((current) => [
          ...current,
          {
            ...normalizeSong(payload, settings.keyPreference),
            id,
            usageCount: 0,
            createdAt: new Date().toISOString().slice(0, 10),
            createdBy: profile.uid
          }
        ]);
        await logAuditEvent({ actionType: "create", entityType: "song", entityId: id, entityName: payload.title, summary: `Canto creado: ${payload.title}`, afterData: payload });
        return id;
      }
    }

    if (song.id) {
      const { id, ...data } = payload;
      await updateDoc(doc(db, "songs", id), data);
      await logAuditEvent({ actionType: "update", entityType: "song", entityId: id, entityName: data.title, summary: `Canto editado: ${data.title}`, beforeData: before, afterData: data });
      return id;
    } else {
      const created = await addDoc(collection(db, "songs"), {
        ...payload,
        usageCount: 0,
        createdAt: serverTimestamp(),
        createdBy: profile.uid
      });
      await logAuditEvent({ actionType: "create", entityType: "song", entityId: created.id, entityName: payload.title, summary: `Canto creado: ${payload.title}`, afterData: payload });
      return created.id;
    }
  };

  const uploadSongPdf = async (songId, file) => {
    if (!songId || !file) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const storagePath = `song-pdfs/${songId}/${Date.now()}-${safeName}`;

    if (useLocal) {
      const storagePdfUrl = URL.createObjectURL(file);
      const payload = {
        storagePath,
        storagePdfUrl,
        originalFileName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: profile.uid,
        pdfReviewStatus: "completado",
        format: "pdf"
      };
      setSongs((current) => current.map((song) => (song.id === songId ? { ...song, ...payload } : song)));
      return payload;
    }

    if (!storage) {
      throw new Error("Firebase Storage no está configurado. Usa links de Drive o Ruta PDF local.");
    }

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: "application/pdf" });
    const storagePdfUrl = await getDownloadURL(storageRef);
    const payload = {
      storagePath,
      storagePdfUrl,
      originalFileName: file.name,
      uploadedAt: serverTimestamp(),
      uploadedBy: profile.uid,
      pdfReviewStatus: "completado",
      format: "pdf",
      updatedAt: serverTimestamp()
    };
    await updateDoc(doc(db, "songs", songId), payload);
    return payload;
  };

  const deleteSongPdf = async (song) => {
    if (!song?.id) return;
    if (useLocal) {
      setSongs((current) =>
        current.map((item) =>
          item.id === song.id
            ? { ...item, storagePath: "", storagePdfUrl: "", originalFileName: "", uploadedAt: "", uploadedBy: "" }
            : item
        )
      );
      return;
    }
    if (song.storagePath) {
      try {
        await deleteObject(ref(storage, song.storagePath));
      } catch (deleteError) {
        console.warn("No se pudo eliminar el PDF anterior de Storage.", deleteError);
      }
    }
    await updateDoc(doc(db, "songs", song.id), {
      storagePath: "",
      storagePdfUrl: "",
      originalFileName: "",
      uploadedAt: "",
      uploadedBy: "",
      updatedAt: serverTimestamp()
    });
  };

  const deleteSong = async (songId) => {
    const before = songs.find((song) => song.id === songId);
    if (useLocal) {
      setSongs((current) => current.filter((song) => song.id !== songId));
      await deactivateRelatedNotifications({ entityType: "song", entityId: songId });
      await logAuditEvent({ actionType: "delete", entityType: "song", entityId: songId, entityName: before?.title || "", summary: `Canto eliminado: ${before?.title || songId}`, beforeData: before });
      return;
    }
    await deleteDoc(doc(db, "songs", songId));
    await deactivateRelatedNotifications({ entityType: "song", entityId: songId });
    await logAuditEvent({ actionType: "delete", entityType: "song", entityId: songId, entityName: before?.title || "", summary: `Canto eliminado: ${before?.title || songId}`, beforeData: before });
  };

  const duplicateSong = async (song) => {
    const { id, ...copy } = song;
    await saveSong({
      ...copy,
      title: `${song.title} copia`,
      usageCount: 0,
      lastUsedAt: ""
    });
  };

  const notifyPlannedNewSongBestEffort = (plannedSongPayload, plannedSongId) => {
    if (!plannedSongId || plannedSongPayload.status === "estrenado") return;
    const songId = plannedSongPayload.songId || "";
    const serviceLabel = formatPlannedNewSongLabel(plannedSongPayload);
    const title = `Canto nuevo para ${serviceLabel}`;
    const message = `${plannedSongPayload.songTitle} está planeado para ${serviceLabel}.`;
    const pushNotificationId = `planned-new-song-${plannedSongId}`;
    const notificationPayload = {
      type: "new_song",
      title,
      message,
      entityType: songId ? "song" : "planned_new_song",
      entityId: songId || plannedSongId,
      songId,
      isFutureSchedule: true,
      pushNotificationId
    };
    showInAppNovelty(notificationPayload);
    createNotificationBestEffort(notificationPayload);
    sendPushBestEffort({
      type: "new_song",
      title,
      body: message,
      url: songId ? `/#/repertorio/${songId}` : "/#/servicios",
      songId,
      notificationId: pushNotificationId,
      icon: resolveAppLogoForNotification(settings, "light"),
      badge: resolveAppLogoForNotification(settings, "light")
    }, { tipoEvento: "planned_new_song", eventoGuardado: true, novedadInternaCreada: true });
  };

  const assertCanEditPlannedNewSongs = () => {
    if (!["admin", "editor"].includes(profile?.role)) {
      throw new Error("No tienes permiso para modificar cantos nuevos planeados.");
    }
  };

  const savePlannedNewSong = async (plannedSong) => {
    assertCanEditPlannedNewSongs();
    const before = plannedSong.id ? plannedNewSongs.find((item) => item.id === plannedSong.id) : null;
    const payload = {
      songId: plannedSong.songId || null,
      songTitle: String(plannedSong.songTitle || "").trim(),
      plannedDate: plannedSong.plannedDate || "",
      serviceType: plannedSong.serviceType || "",
      status: plannedSong.status || "planeado",
      notes: String(plannedSong.notes || "").trim(),
      createdBy: before?.createdBy || profile?.uid || "",
      introducedAt: plannedSong.status === "estrenado"
        ? (before?.introducedAt || (useLocal ? new Date().toISOString() : serverTimestamp()))
        : null,
      updatedAt: useLocal ? new Date().toISOString() : serverTimestamp()
    };
    if (!useLocal && before?.introducedAt && plannedSong.status === "estrenado") {
      delete payload.introducedAt;
    }
    if (!payload.songTitle || !payload.plannedDate || !payload.serviceType || !payload.status) {
      throw new Error("Completa canto, fecha, servicio y estado.");
    }

    if (useLocal) {
      if (plannedSong.id) {
        setPlannedNewSongs((current) => current.map((item) => item.id === plannedSong.id ? { ...item, ...payload } : item));
        await logAuditEvent({ actionType: "update", entityType: "planned_new_song", entityId: plannedSong.id, entityName: payload.songTitle, summary: `Canto nuevo planeado editado: ${payload.songTitle}`, beforeData: before, afterData: payload });
        return plannedSong.id;
      }
      const id = makeId("planned-song");
      const created = { ...payload, id, createdAt: new Date().toISOString() };
      setPlannedNewSongs((current) => [...current, created].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)));
      await logAuditEvent({ actionType: "create", entityType: "planned_new_song", entityId: id, entityName: payload.songTitle, summary: `Canto nuevo planeado creado: ${payload.songTitle}`, afterData: created });
      notifyPlannedNewSongBestEffort(created, id);
      return id;
    }

    if (plannedSong.id) {
      await updateDoc(doc(db, "plannedNewSongs", plannedSong.id), payload);
      await logAuditEvent({ actionType: "update", entityType: "planned_new_song", entityId: plannedSong.id, entityName: payload.songTitle, summary: `Canto nuevo planeado editado: ${payload.songTitle}`, beforeData: before, afterData: payload });
      return plannedSong.id;
    }
    const created = await addDoc(collection(db, "plannedNewSongs"), { ...payload, createdAt: serverTimestamp() });
    await logAuditEvent({ actionType: "create", entityType: "planned_new_song", entityId: created.id, entityName: payload.songTitle, summary: `Canto nuevo planeado creado: ${payload.songTitle}`, afterData: payload });
    notifyPlannedNewSongBestEffort(payload, created.id);
    return created.id;
  };

  const markPlannedNewSongIntroduced = async (plannedSongId) => {
    assertCanEditPlannedNewSongs();
    const plannedSong = plannedNewSongs.find((item) => item.id === plannedSongId);
    if (!plannedSong) throw new Error("No se encontró el canto nuevo planeado.");
    return savePlannedNewSong({ ...plannedSong, status: "estrenado" });
  };

  const deletePlannedNewSong = async (plannedSongId) => {
    if (profile?.role !== "admin") {
      throw new Error("Solo un administrador puede eliminar cantos nuevos planeados.");
    }
    const before = plannedNewSongs.find((item) => item.id === plannedSongId);
    if (useLocal) {
      setPlannedNewSongs((current) => current.filter((item) => item.id !== plannedSongId));
    } else {
      await deleteDoc(doc(db, "plannedNewSongs", plannedSongId));
    }
    await logAuditEvent({ actionType: "delete", entityType: "planned_new_song", entityId: plannedSongId, entityName: before?.songTitle || "", summary: `Canto nuevo planeado eliminado: ${before?.songTitle || plannedSongId}`, beforeData: before });
  };

  const syncScheduleSongNotes = async (entries = [], previousEntries = null) => {
    const changes = entries
      .map((entry) => {
        const song = songs.find((item) => item.id === entry.songId);
        const previous = previousEntries?.find((item) => item.songId === entry.songId);
        if (previousEntries && String(previous?.notes || "") === String(entry.notes || "")) return null;
        if (!song || String(song.internalNotes || "") === String(entry.notes || "")) return null;
        return { songId: song.id, internalNotes: entry.notes || "" };
      })
      .filter(Boolean);
    if (!changes.length) return;
    if (useLocal) {
      setSongs((current) => current.map((song) => {
        const change = changes.find((item) => item.songId === song.id);
        return change ? { ...song, internalNotes: change.internalNotes } : song;
      }));
      return;
    }
    const batch = writeBatch(db);
    changes.forEach(({ songId, internalNotes }) => {
      batch.update(doc(db, "songs", songId), { internalNotes, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  };

  const saveSchedule = async (schedule) => {
    const before = schedule.id ? schedules.find((item) => item.id === schedule.id) : null;
    const scheduleChange = before ? buildScheduleChange(before, { ...before, ...schedule, songs: schedule.songs || [] }) : null;
    const payload = {
      ...schedule,
      status: schedule.status || before?.status || "confirmed",
      songs: schedule.songs || [],
      updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp()
    };
    const slidesLinkChanged = Boolean(payload.slidesUrl) && payload.slidesUrl !== before?.slidesUrl;

    if (useLocal) {
      if (schedule.id) {
        setSchedules((current) => current.map((item) => (item.id === schedule.id ? { ...item, ...payload } : item)));
        notifyScheduleUpdatedBestEffort(payload, schedule.id, scheduleChange);
        if (slidesLinkChanged) notifySlidesAddedBestEffort(payload, schedule.id);
        await logAuditEvent({ actionType: "update", entityType: "schedule", entityId: schedule.id, entityName: payload.serviceLabel || payload.date, summary: `Programación editada: ${payload.serviceLabel || payload.date}`, beforeData: before, afterData: payload });
      } else {
        const id = makeId("schedule");
        setSchedules((current) => [
          ...current,
          {
            ...payload,
            id,
            createdAt: new Date().toISOString().slice(0, 10),
            createdBy: profile.uid
          }
        ]);
        notifyScheduleCreatedBestEffort(payload, id);
        if (slidesLinkChanged) notifySlidesAddedBestEffort(payload, id);
        logAuditEventBestEffort({ actionType: "create", entityType: "schedule", entityId: id, entityName: payload.serviceLabel || payload.date, summary: `Programación creada: ${payload.serviceLabel || payload.date}`, afterData: payload });
        await syncScheduleSongNotes(payload.songs || [], before?.songs || null);
        return id;
      }
      await syncScheduleSongNotes(payload.songs || [], before?.songs || null);
      return schedule.id;
    }

    if (schedule.id) {
      const { id, ...data } = payload;
      await updateDoc(doc(db, "schedules", id), data);
      notifyScheduleUpdatedBestEffort(payload, id, scheduleChange);
      if (slidesLinkChanged) notifySlidesAddedBestEffort(payload, id);
      await logAuditEvent({ actionType: "update", entityType: "schedule", entityId: id, entityName: data.serviceLabel || data.date, summary: `Programación editada: ${data.serviceLabel || data.date}`, beforeData: before, afterData: data });
      await syncScheduleSongNotes(payload.songs || [], before?.songs || null);
      return id;
    } else {
      const created = await addDoc(collection(db, "schedules"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: profile.uid
      });
      notifyScheduleCreatedBestEffort(payload, created.id);
      if (slidesLinkChanged) notifySlidesAddedBestEffort(payload, created.id);
      logAuditEventBestEffort({ actionType: "create", entityType: "schedule", entityId: created.id, entityName: payload.serviceLabel || payload.date, summary: `Programación creada: ${payload.serviceLabel || payload.date}`, afterData: payload });
      await syncScheduleSongNotes(payload.songs || [], before?.songs || null);
      return created.id;
    }
  };

  const saveScheduleSlidesUrl = async (scheduleId, value = "") => {
    const before = schedules.find((schedule) => schedule.id === scheduleId);
    const isMediaViewer = profile?.role === "viewer" && profile?.viewerType === "medios";
    if (!before) throw new Error("No se encontró la programación seleccionada.");
    if (!["admin", "editor"].includes(profile?.role) && !isMediaViewer) {
      throw new Error("Tu perfil no puede modificar las diapositivas.");
    }

    const slidesUrl = String(value || "").trim();
    if (slidesUrl && !/^https:\/\//i.test(slidesUrl)) {
      throw new Error("Usa un enlace seguro que comience con https://");
    }
    const actorName = profile?.preferredDisplayName || profile?.displayName || profile?.email || "";
    const update = {
      slidesUrl,
      slidesUpdatedAt: useLocal ? new Date().toISOString() : serverTimestamp(),
      slidesUpdatedByUid: profile?.uid || "",
      slidesUpdatedByName: actorName
    };
    const updatedSchedule = { ...before, ...update };

    if (useLocal) {
      setSchedules((current) => current.map((schedule) => (
        schedule.id === scheduleId ? updatedSchedule : schedule
      )));
    } else {
      await updateDoc(doc(db, "schedules", scheduleId), update);
    }

    await logAuditEvent({
      actionType: "update",
      entityType: "schedule_slides",
      entityId: scheduleId,
      entityName: before.serviceLabel || before.date,
      summary: slidesUrl ? `Enlace de diapositivas agregado: ${before.serviceLabel || before.date}` : `Enlace de diapositivas eliminado: ${before.serviceLabel || before.date}`,
      beforeData: { slidesUrl: before.slidesUrl || "" },
      afterData: { slidesUrl }
    });
    if (slidesUrl && slidesUrl !== before.slidesUrl) {
      notifySlidesAddedBestEffort(updatedSchedule, scheduleId);
    }
    return scheduleId;
  };

  const deleteSchedule = async (scheduleId) => {
    const before = schedules.find((schedule) => schedule.id === scheduleId);
    if (useLocal) {
      setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
      await deactivateRelatedNotifications({ entityType: "schedule", entityId: scheduleId });
      await logAuditEvent({ actionType: "delete", entityType: "schedule", entityId: scheduleId, entityName: before?.serviceLabel || before?.date || "", summary: `Programación eliminada: ${before?.serviceLabel || before?.date || scheduleId}`, beforeData: before });
      return;
    }
    await deleteDoc(doc(db, "schedules", scheduleId));
    await deactivateRelatedNotifications({ entityType: "schedule", entityId: scheduleId });
    await logAuditEvent({ actionType: "delete", entityType: "schedule", entityId: scheduleId, entityName: before?.serviceLabel || before?.date || "", summary: `Programación eliminada: ${before?.serviceLabel || before?.date || scheduleId}`, beforeData: before });
  };

  const restoreFromAuditLog = async (log) => {
    const collectionByType = { song: "songs", schedule: "schedules", theme: "themes" };
    const collectionName = collectionByType[log?.entityType];
    const restoreData = log?.beforeData;
    const entityId = log?.entityId || restoreData?.id;
    if (!collectionName || !restoreData || !entityId) {
      throw new Error("Este registro no tiene datos suficientes para restaurar.");
    }

    const restored = {
      ...restoreData,
      id: entityId,
      restoredAt: useLocal ? new Date().toISOString() : serverTimestamp(),
      restoredBy: profile?.uid || ""
    };
    const { id, ...firestoreData } = restored;

    if (useLocal) {
      if (log.entityType === "song") {
        setSongs((current) => current.some((item) => item.id === entityId) ? current.map((item) => (item.id === entityId ? restored : item)) : [...current, restored]);
      } else if (log.entityType === "schedule") {
        setSchedules((current) => current.some((item) => item.id === entityId) ? current.map((item) => (item.id === entityId ? restored : item)) : [...current, restored]);
      } else if (log.entityType === "theme") {
        setThemes((current) => current.some((item) => item.id === entityId) ? current.map((item) => (item.id === entityId ? restored : item)) : [...current, restored]);
      }
    } else {
      await setDoc(doc(db, collectionName, entityId), firestoreData, { merge: false });
    }

    await logAuditEvent({
      actionType: "restore",
      entityType: log.entityType,
      entityId,
      entityName: log.entityName || restoreData.title || restoreData.serviceLabel || restoreData.name || entityId,
      summary: `Restauracion aplicada: ${log.entityName || entityId}`,
      beforeData: log.afterData || null,
      afterData: restored
    });
  };

  const replaceScheduleSong = async (scheduleId, oldSongEntry, newSong) => {
    if (!["admin", "editor"].includes(profile?.role)) {
      throw new Error("No tienes permiso para sustituir cantos.");
    }
    const before = schedules.find((item) => item.id === scheduleId);
    if (!before || !oldSongEntry || !newSong) return;
    const nextSongs = (before.songs || []).map((entry) => (
      entry === oldSongEntry || (entry.songId && entry.songId === oldSongEntry.songId && entry.titleSnapshot === oldSongEntry.titleSnapshot)
        ? {
            songId: newSong.id,
            titleSnapshot: newSong.title,
            keySnapshot: newSong.keyWithCapo || newSong.mainKey || "",
            pdfUrl: newSong.pdfPreviewUrl || newSong.pdfUrl || newSong.drivePdfUrl || newSong.chordsUrl || "",
            notes: entry.notes || newSong.internalNotes || ""
          }
        : entry
    ));
    const updated = { ...before, songs: nextSongs, status: "confirmed", updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp() };
    const summary = `Canto sustituido en programación: ${oldSongEntry.titleSnapshot || "canto anterior"} -> ${newSong.title}`;

    if (useLocal) {
      setSchedules((current) => current.map((item) => (item.id === scheduleId ? updated : item)));
    } else {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "schedules", scheduleId), data);
    }

    await logAuditEvent({
      actionType: "update",
      entityType: "schedule",
      entityId: scheduleId,
      entityName: before.serviceLabel || before.date,
      summary,
      beforeData: before,
      afterData: updated
    });

    const change = buildScheduleChange(before, updated);
    notifyScheduleUpdatedBestEffort(updated, scheduleId, change);
  };

  const saveServiceFollowUp = async (scheduleId, followUp = {}) => {
    const before = schedules.find((item) => item.id === scheduleId);
    if (!before) return;
    const updated = {
      ...before,
      serviceFollowUp: {
        ...(before.serviceFollowUp || {}),
        ...followUp,
        updatedAt: useLocal ? new Date().toISOString() : serverTimestamp(),
        updatedBy: profile?.uid || ""
      },
      updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp()
    };
    if (useLocal) {
      setSchedules((current) => current.map((item) => (item.id === scheduleId ? updated : item)));
    } else {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "schedules", id), data);
    }
    await logAuditEvent({
      actionType: "update",
      entityType: "schedule",
      entityId: scheduleId,
      entityName: before.serviceLabel || before.date,
      summary: `Seguimiento del servicio actualizado: ${before.serviceLabel || before.date}`,
      beforeData: before,
      afterData: updated
    });
  };

  const closeScheduleService = async (scheduleId, followUp = {}) => {
    const before = schedules.find((item) => item.id === scheduleId);
    if (!before) return;
    const review = reviewServiceSchedule(before, songs, schedules);
    const snapshot = createServiceReviewSnapshot(review, before, songs);
    const compactSongs = Object.fromEntries(
      Object.entries(followUp.songs || {}).filter(([, item]) => item?.resolved === true || isNoteworthySongFollowUp(item))
    );
    const compactFollowUp = { ...followUp, songs: compactSongs };
    const updated = {
      ...before,
      status: "cerrada",
      serviceReviewSnapshot: {
        ...snapshot,
        notes: compactFollowUp.overall || compactFollowUp.nextServiceNotes || compactFollowUp.generalObservations || before.serviceReviewSnapshot?.notes || ""
      },
      serviceFollowUp: {
        ...(before.serviceFollowUp || {}),
        ...compactFollowUp,
        closedAt: useLocal ? new Date().toISOString() : serverTimestamp(),
        closedBy: profile?.uid || ""
      },
      closedAt: useLocal ? new Date().toISOString() : serverTimestamp(),
      closedBy: profile?.uid || "",
      updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp()
    };
    if (useLocal) {
      setSchedules((current) => current.map((item) => (item.id === scheduleId ? updated : item)));
    } else {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "schedules", id), data);
    }
    await logAuditEvent({
      actionType: "update",
      entityType: "schedule",
      entityId: scheduleId,
      entityName: before.serviceLabel || before.date,
      summary: `Servicio cerrado: ${before.serviceLabel || before.date}`,
      beforeData: before,
      afterData: updated
    });
  };

  const duplicateSchedule = async (schedule) => {
    const { id, ...copy } = schedule;
    await saveSchedule({
      ...copy,
      date: "",
      generalNotes: `${schedule.generalNotes || ""}`.trim()
    });
  };

  const saveUser = async (user) => {
    const email = user.email.toLowerCase();
    const payload = {
      email,
      displayName: user.displayName || email,
      role: user.role || "viewer",
      viewerType: (user.role || "viewer") === "viewer" ? user.viewerType || "corista" : null,
      active: Boolean(user.active)
    };

    if (useLocal) {
      setUsers((current) =>
        user.id
          ? current.map((item) => (item.id === user.id ? { ...item, ...payload } : item))
          : [...current, { ...payload, id: makeId("user"), uid: makeId("uid"), createdAt: new Date().toISOString() }]
      );
      setAuthorizedEmails((current) => {
        const exists = current.some((item) => item.email === email);
        return exists
          ? current.map((item) => (item.email === email ? { ...item, ...payload, id: item.id || email } : item))
          : [...current, { ...payload, id: email }];
      });
      await logAuditEvent({ actionType: user.id ? "role_change" : "access_added", entityType: "authorizedEmail", entityId: email, entityName: email, summary: `Acceso actualizado: ${email}`, afterData: payload });
      return;
    }

    await setDoc(doc(db, "authorizedEmails", email), payload, { merge: true });
    await logAuditEvent({ actionType: user.id ? "role_change" : "access_added", entityType: "authorizedEmail", entityId: email, entityName: email, summary: `Acceso actualizado: ${email}`, afterData: payload });

    if (!user.uid && (!user.id || user.id.includes("@"))) return;

    const id = user.uid || user.id;
    await setDoc(
      doc(db, "users", id),
      {
        ...payload,
        createdAt: user.createdAt || serverTimestamp()
      },
      { merge: true }
    );
  };

  const removeUserAccess = async (user) => {
    const email = user.email?.toLowerCase();
    if (!email) return;
    const existingUser = users.find((item) => item.email?.toLowerCase() === email);
    const before = { ...user, userDoc: existingUser || null };
    if (useLocal) {
      setAuthorizedEmails((current) => current.filter((item) => item.email?.toLowerCase() !== email));
      setUsers((current) => current.map((item) => item.email?.toLowerCase() === email ? { ...item, active: false, revoked: true } : item));
      await logAuditEvent({ actionType: "access_removed", entityType: "authorizedEmail", entityId: email, entityName: email, summary: `Acceso eliminado: ${email}`, beforeData: before });
      return;
    }
    await deleteDoc(doc(db, "authorizedEmails", email));
    if (existingUser?.id || existingUser?.uid) {
      await setDoc(doc(db, "users", existingUser.uid || existingUser.id), { active: false, revoked: true, revokedAt: serverTimestamp() }, { merge: true });
    }
    await logAuditEvent({ actionType: "access_removed", entityType: "authorizedEmail", entityId: email, entityName: email, summary: `Acceso eliminado: ${email}`, beforeData: before });
  };

  const saveSettings = async (nextSettings) => {
    const before = settings;
    if (useLocal) {
      setSettings(nextSettings);
      await logAuditEvent({ actionType: "update", entityType: "settings", entityId: "main", entityName: "Configuración global", summary: "Configuración global actualizada", beforeData: before, afterData: nextSettings });
      return;
    }
    await setDoc(doc(db, "settings", "main"), nextSettings, { merge: true });
    await logAuditEvent({ actionType: "update", entityType: "settings", entityId: "main", entityName: "Configuración global", summary: "Configuración global actualizada", beforeData: before, afterData: nextSettings });
  };

  const saveTheme = async (theme) => {
    const payload = {
      name: normalizeThemeName(theme.name),
      active: theme.active !== false,
      ignored: Boolean(theme.ignored),
      createdAt: theme.createdAt || (useLocal ? new Date().toISOString() : serverTimestamp())
    };
    if (!payload.name) return;

    if (useLocal) {
      setThemes((current) =>
        theme.id
          ? current.map((item) => (item.id === theme.id ? { ...item, ...payload } : item))
          : [...current, { ...payload, id: makeId("theme") }]
      );
      await logAuditEvent({ actionType: theme.id ? "update" : "create", entityType: "theme", entityId: theme.id || payload.name, entityName: payload.name, summary: `Tema guardado: ${payload.name}`, afterData: payload });
      return;
    }

    if (theme.id) {
      await updateDoc(doc(db, "themes", theme.id), payload);
      await logAuditEvent({ actionType: "update", entityType: "theme", entityId: theme.id, entityName: payload.name, summary: `Tema editado: ${payload.name}`, afterData: payload });
    } else {
      const created = await addDoc(collection(db, "themes"), payload);
      await logAuditEvent({ actionType: "create", entityType: "theme", entityId: created.id, entityName: payload.name, summary: `Tema creado: ${payload.name}`, afterData: payload });
    }
  };

  const importSongs = async (incomingSongs, mode = "skip") => {
    const existingByTitle = new Map(songs.map((song) => [song.title.trim().toLowerCase(), song]));
    const results = { created: 0, updated: 0, skipped: 0 };

    for (const incoming of incomingSongs) {
      const normalized = normalizeSong(incoming, settings.keyPreference);
      const existing = existingByTitle.get(normalized.title.trim().toLowerCase());
      if (existing && mode === "skip") {
        results.skipped += 1;
        continue;
      }
      if (existing && mode === "update") {
        await saveSong({ ...existing, ...normalized, id: existing.id });
        results.updated += 1;
      } else {
        await saveSong(normalized);
        results.created += 1;
      }
    }

    const existingThemeKeys = new Set(themes.map((theme) => canonicalThemeKey(theme.name)));
    const importedThemes = new Set();
    incomingSongs.forEach((song) => {
      [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].forEach((theme) => {
        const normalized = normalizeThemeName(theme);
        if (normalized && !existingThemeKeys.has(canonicalThemeKey(normalized))) importedThemes.add(normalized);
      });
    });
    for (const theme of importedThemes) {
      await saveTheme({ name: theme, active: true });
    }

    await logAuditEvent({
      actionType: "create",
      entityType: "other",
      entityId: "import",
      entityName: "Importacion de repertorio",
      summary: `Importacion: ${results.created} creados, ${results.updated} actualizados, ${results.skipped} omitidos`,
      afterData: results
    });

    return results;
  };

  const indexLocalPdfTexts = async (onProgress, options = {}) => {
    const results = {
      found: 0,
      indexed: 0,
      reused: 0,
      checked: 0,
      failed: 0,
      noText: 0,
      missing: 0,
      indexedItems: [],
      ocrItems: [],
      noTextItems: [],
      missingItems: [],
      errorItems: []
    };
    const sourceCandidates = songs.filter((item) => item.localPdfPath);
    const candidates = sourceCandidates
      .filter((song) => {
        if (options.force) return true;
        const hasExistingIndex = Boolean(song.indexedTextAvailable || song.pdfSearchText || (song.pdfSearchTokens || []).length);
        const markedPending = ["pending", "error", "failed", "missing"].includes(String(song.pdfIndexStatus || ""));
        const pathChanged = Boolean(song.indexedPdfPath) && song.indexedPdfPath !== song.localPdfPath;
        const versionChanged = Boolean(song.indexedPdfVersion) && String(song.indexedPdfVersion) !== String(song.pdfVersion || "");
        if (hasExistingIndex && !markedPending && !pathChanged && !versionChanged) {
          results.reused += 1;
          results.found += 1;
          return false;
        }
        return true;
      })
      .map((song) => ({ song, prefetched: null }));
    results.checked = sourceCandidates.length;

    onProgress?.({
      phase: "indexing",
      current: 0,
      total: candidates.length,
      songTitle: "",
      pdfPath: "",
      ...results
    });
    let current = 0;
    for (const candidate of candidates) {
      const { song, prefetched } = candidate;
      current += 1;
      onProgress?.({ phase: "indexing", current, total: candidates.length, songTitle: song.title, pdfPath: song.localPdfPath, ...results });
      const extracted = await extractLocalPdfText(song.localPdfPath, {
        enableOcr: Boolean(options.enableOcr),
        pdfVersion: song.pdfVersion,
        prefetched,
        onOcrProgress: (ocrProgress) => onProgress?.({ current, total: candidates.length, songTitle: song.title, pdfPath: song.localPdfPath, ocrProgress, ...results })
      });
      const status = extracted.status === "failed" ? "error" : extracted.status;
      const itemSummary = {
        title: song.title,
        localPdfPath: song.localPdfPath,
        resolvedUrl: extracted.resolvedUrl || "",
        statusHttp: extracted.statusHttp || "",
        contentType: extracted.contentType || "",
        message: extracted.message || "",
        method: extracted.method || ""
      };
      const payload = {
        ...song,
        pdfSearchText: extracted.status === "indexed" ? extracted.text : "",
        pdfOcrText: extracted.status === "indexed" && extracted.method === "ocr" ? extracted.text : "",
        pdfSearchTokens: extracted.tokens || [],
        pdfIndexStatus: status,
        pdfIndexMethod: extracted.method || "",
        searchIndexVersion: "2026-05-ocr-v2",
        indexedTextAvailable: status === "indexed",
        indexSource: extracted.method === "ocr" ? "ocr" : status === "indexed" ? "pdf-text" : status,
        textFingerprint: extracted.fingerprint || prefetched?.fingerprint || "",
        indexedPdfPath: song.localPdfPath || "",
        indexedPdfVersion: song.pdfVersion || "",
        pdfIndexMessage: extracted.message,
        pdfIndexError: status === "error" ? extracted.message : "",
        pdfIndexUrl: extracted.resolvedUrl || "",
        pdfIndexHttpStatus: extracted.statusHttp || "",
        pdfIndexContentType: extracted.contentType || "",
        localPdfStatus: extracted.status === "indexed" || extracted.status === "no_text" ? "found" : status,
        pdfIndexedAt: new Date().toISOString()
      };
      await saveSong(payload);
      if (status === "indexed") {
        results.indexed += 1;
        results.found += 1;
        results.indexedItems.push(itemSummary);
        if (extracted.method === "ocr") results.ocrItems.push(itemSummary);
      } else if (status === "no_text") {
        results.noText += 1;
        results.found += 1;
        results.noTextItems.push({
          ...itemSummary,
          message: itemSummary.message || "El PDF existe, pero no tiene texto seleccionable."
        });
      } else if (status === "missing") {
        results.missing += 1;
        results.missingItems.push(itemSummary);
      } else {
        results.failed += 1;
        results.errorItems.push({
          ...itemSummary,
          message: itemSummary.message || "Error al procesar"
        });
      }
      onProgress?.({ phase: "indexing", current, total: candidates.length, songTitle: song.title, pdfPath: song.localPdfPath, ...results });
    }
    await logAuditEvent({
      actionType: "update",
      entityType: "pdf",
      entityId: "local-pdf-index",
      entityName: "Indice de PDFs locales",
      summary: `Indexacion PDF: ${results.indexed} indexados, ${results.reused} reutilizados, ${results.ocrItems.length} con OCR, ${results.noText} sin texto, ${results.missing} no encontrados, ${results.failed} con error`,
      afterData: results
    });
    return results;
  };

  const mergeTheme = async (sourceName, targetName) => {
    const sourceKey = canonicalThemeKey(sourceName);
    const target = normalizeThemeName(targetName);
    if (!sourceKey || !target) return;

    const replaceThemes = (values = []) =>
      [...new Set(values.map((value) => (canonicalThemeKey(value) === sourceKey ? target : normalizeThemeName(value))).filter(Boolean))];

    const affected = songs.filter((song) =>
      [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].some((theme) => canonicalThemeKey(theme) === sourceKey)
    );

    for (const song of affected) {
      const mainTheme = canonicalThemeKey(song.mainTheme) === sourceKey ? target : normalizeThemeName(song.mainTheme);
      const otherThemes = replaceThemes(song.otherThemes || []).filter((theme) => canonicalThemeKey(theme) !== canonicalThemeKey(mainTheme));
      await saveSong({
        ...song,
        mainTheme,
        otherThemes,
        tags: [...new Set([mainTheme, ...otherThemes].filter(Boolean))]
      });
    }

    const sourceTheme = themes.find((theme) => canonicalThemeKey(theme.name) === sourceKey);
    if (sourceTheme) await saveTheme({ ...sourceTheme, active: false, ignored: true });
  };

  const seedExampleData = async () => {
    if (useLocal) {
      setSongs(sampleSongs);
      setSchedules(sampleSchedules);
      setThemes(sampleThemes);
      setSettings(sampleSettings);
      return;
    }

    const batch = writeBatch(db);
    sampleSongs.forEach((song) => {
      const { id, ...data } = song;
      batch.set(doc(db, "songs", id), data);
    });
    sampleSchedules.forEach((schedule) => {
      const { id, ...data } = schedule;
      batch.set(doc(db, "schedules", id), data);
    });
    sampleThemes.forEach((theme) => {
      const { id, ...data } = theme;
      batch.set(doc(db, "themes", id), data);
    });
    batch.set(doc(db, "settings", "main"), sampleSettings, { merge: true });
    await batch.commit();
  };

  const value = useMemo(
    () => ({
      songs,
      schedules,
      plannedNewSongs: Array.isArray(plannedNewSongs) ? plannedNewSongs : [],
      users,
      authorizedEmails,
      allowedEmails: authorizedEmails,
      themes,
      settings,
      auditLogs,
      notifications,
      loading,
      error,
      useLocal,
      logAuditEvent,
      saveSong,
      uploadSongPdf,
      deleteSongPdf,
      deleteSong,
      duplicateSong,
      savePlannedNewSong,
      markPlannedNewSongIntroduced,
      deletePlannedNewSong,
      saveSchedule,
      saveScheduleSlidesUrl,
      replaceScheduleSong,
      saveServiceFollowUp,
      closeScheduleService,
      deleteSchedule,
      duplicateSchedule,
      saveUser,
      removeUserAccess,
      saveSettings,
      saveTheme,
      mergeTheme,
      importSongs,
      indexLocalPdfTexts,
      markNotificationRead,
      markAllNotificationsRead,
      restoreFromAuditLog,
      seedExampleData
    }),
    [auditLogs, authorizedEmails, error, loading, notifications, plannedNewSongs, schedules, settings, songs, themes, useLocal, users]
  );

  return <MusicDataContext.Provider value={value}>{children}</MusicDataContext.Provider>;
}

export const useMusicData = () => {
  const context = useContext(MusicDataContext);
  if (!context) {
    throw new Error("useMusicData debe usarse dentro de MusicDataProvider");
  }
  return context;
};

