import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, isFirebaseConfigured, storage } from "../lib/firebase";
import { sampleSchedules, sampleSettings, sampleSongs, sampleThemes, sampleUsers } from "../data/mockData";
import { canonicalThemeKey, normalizeSong, normalizeThemeName } from "../services/songUtils";
import { extractLocalPdfText } from "../services/pdfTextIndex";
import { useAuth } from "./useAuth";

const MusicDataContext = createContext(null);
const storageKey = "roca-eterna-musica-demo";

const defaultLocalData = {
  songs: sampleSongs,
  schedules: sampleSchedules,
  users: sampleUsers,
  authorizedEmails: [],
  themes: sampleThemes,
  settings: sampleSettings
};

const sampleAuditLogs = [];
const sampleNotifications = [];

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
  const [users, setUsers] = useState(sampleUsers);
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [themes, setThemes] = useState(sampleThemes);
  const [settings, setSettings] = useState(sampleSettings);
  const [auditLogs, setAuditLogs] = useState(sampleAuditLogs);
  const [notifications, setNotifications] = useState(sampleNotifications);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        query(collection(db, "users"), orderBy("email")),
        (snapshot) => setUsers(snapshot.docs.map(withId)),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(db, "authorizedEmails"), orderBy("email")),
        (snapshot) => setAuthorizedEmails(snapshot.docs.map(withId)),
        (snapshotError) => setError(snapshotError.message)
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
        query(collection(db, "auditLogs"), orderBy("createdAt", "desc")),
        (snapshot) => setAuditLogs(snapshot.docs.map(withId)),
        (snapshotError) => setError(snapshotError.message)
      ),
      onSnapshot(
        query(collection(db, "notifications"), orderBy("createdAt", "desc")),
        (snapshot) => setNotifications(snapshot.docs.map(withId)),
        (snapshotError) => setError(snapshotError.message)
      )
    ];

    setLoading(false);
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [profile, settings.keyPreference, useLocal]);

  useEffect(() => {
    if (!profile || !useLocal) return;
    localStorage.setItem(storageKey, JSON.stringify({ songs, schedules, users, authorizedEmails, themes, settings, auditLogs, notifications }));
  }, [auditLogs, authorizedEmails, notifications, profile, schedules, settings, songs, themes, useLocal, users]);

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

  const createNotification = async (notification) => {
    const payload = {
      type: notification.type || "other",
      title: notification.title || "Nueva notificacion",
      message: notification.message || "",
      scheduleId: notification.scheduleId || "",
      targetRoles: notification.targetRoles || ["admin", "editor", "viewer"],
      targetUsers: notification.targetUsers || [],
      readBy: [],
      isFutureSchedule: Boolean(notification.isFutureSchedule),
      createdBy: profile?.uid || "",
      createdAt: useLocal ? new Date().toISOString() : serverTimestamp()
    };
    if (useLocal) {
      setNotifications((current) => [{ ...payload, id: makeId("notification") }, ...current]);
      return;
    }
    await addDoc(collection(db, "notifications"), payload);
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

  const saveSong = async (song) => {
    const before = song.id ? songs.find((item) => item.id === song.id) : null;
    const normalizedSong = normalizeSong(song, settings.keyPreference);
    const payload = {
      ...normalizedSong,
      tags: normalizedSong.tags || [],
      lyricsSections: normalizedSong.lyricsSections || [],
      updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp()
    };

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
      await logAuditEvent({ actionType: "delete", entityType: "song", entityId: songId, entityName: before?.title || "", summary: `Canto eliminado: ${before?.title || songId}`, beforeData: before });
      return;
    }
    await deleteDoc(doc(db, "songs", songId));
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

  const saveSchedule = async (schedule) => {
    const before = schedule.id ? schedules.find((item) => item.id === schedule.id) : null;
    const payload = {
      ...schedule,
      status: "confirmed",
      songs: schedule.songs || [],
      updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp()
    };

    if (useLocal) {
      if (schedule.id) {
        setSchedules((current) => current.map((item) => (item.id === schedule.id ? { ...item, ...payload } : item)));
        await logAuditEvent({ actionType: "update", entityType: "schedule", entityId: schedule.id, entityName: payload.serviceLabel || payload.date, summary: `Programacion editada: ${payload.serviceLabel || payload.date}`, beforeData: before, afterData: payload });
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
        await logAuditEvent({ actionType: "create", entityType: "schedule", entityId: id, entityName: payload.serviceLabel || payload.date, summary: `Programacion creada: ${payload.serviceLabel || payload.date}`, afterData: payload });
        if (isFutureSchedule(payload)) {
          await createNotification({
            type: "new_schedule",
            title: "Nueva programacion futura",
            message: `${payload.serviceLabel || "Servicio"} - ${payload.date} ${payload.time || ""}`.trim(),
            scheduleId: id,
            isFutureSchedule: true
          });
        }
      }
      return;
    }

    if (schedule.id) {
      const { id, ...data } = payload;
      await updateDoc(doc(db, "schedules", id), data);
      await logAuditEvent({ actionType: "update", entityType: "schedule", entityId: id, entityName: data.serviceLabel || data.date, summary: `Programacion editada: ${data.serviceLabel || data.date}`, beforeData: before, afterData: data });
    } else {
      const created = await addDoc(collection(db, "schedules"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: profile.uid
      });
      await logAuditEvent({ actionType: "create", entityType: "schedule", entityId: created.id, entityName: payload.serviceLabel || payload.date, summary: `Programacion creada: ${payload.serviceLabel || payload.date}`, afterData: payload });
      if (isFutureSchedule(payload)) {
        await createNotification({
          type: "new_schedule",
          title: "Nueva programacion futura",
          message: `${payload.serviceLabel || "Servicio"} - ${payload.date} ${payload.time || ""}`.trim(),
          scheduleId: created.id,
          isFutureSchedule: true
        });
      }
    }
  };

  const deleteSchedule = async (scheduleId) => {
    const before = schedules.find((schedule) => schedule.id === scheduleId);
    if (useLocal) {
      setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
      await logAuditEvent({ actionType: "delete", entityType: "schedule", entityId: scheduleId, entityName: before?.serviceLabel || before?.date || "", summary: `Programacion eliminada: ${before?.serviceLabel || before?.date || scheduleId}`, beforeData: before });
      return;
    }
    await deleteDoc(doc(db, "schedules", scheduleId));
    await logAuditEvent({ actionType: "delete", entityType: "schedule", entityId: scheduleId, entityName: before?.serviceLabel || before?.date || "", summary: `Programacion eliminada: ${before?.serviceLabel || before?.date || scheduleId}`, beforeData: before });
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
    const before = schedules.find((item) => item.id === scheduleId);
    if (!before || !oldSongEntry || !newSong) return;
    const nextSongs = (before.songs || []).map((entry) => (
      entry === oldSongEntry || (entry.songId && entry.songId === oldSongEntry.songId && entry.titleSnapshot === oldSongEntry.titleSnapshot)
        ? {
            songId: newSong.id,
            titleSnapshot: newSong.title,
            keySnapshot: newSong.keyWithCapo || newSong.mainKey || "",
            pdfUrl: newSong.pdfPreviewUrl || newSong.pdfUrl || newSong.drivePdfUrl || newSong.chordsUrl || "",
            notes: entry.notes || ""
          }
        : entry
    ));
    const updated = { ...before, songs: nextSongs, status: "confirmed", updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp() };
    const summary = `Canto sustituido en programacion: ${oldSongEntry.titleSnapshot || "canto anterior"} -> ${newSong.title}`;

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

    if (isFutureSchedule(updated)) {
      await createNotification({
        type: "updated_schedule",
        title: "Programacion actualizada",
        message: summary,
        scheduleId,
        isFutureSchedule: true
      });
    }
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
      await logAuditEvent({ actionType: "update", entityType: "settings", entityId: "main", entityName: "Configuracion global", summary: "Configuracion global actualizada", beforeData: before, afterData: nextSettings });
      return;
    }
    await setDoc(doc(db, "settings", "main"), nextSettings, { merge: true });
    await logAuditEvent({ actionType: "update", entityType: "settings", entityId: "main", entityName: "Configuracion global", summary: "Configuracion global actualizada", beforeData: before, afterData: nextSettings });
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

  const indexLocalPdfTexts = async (onProgress) => {
    const results = {
      found: 0,
      indexed: 0,
      failed: 0,
      noText: 0,
      missing: 0,
      indexedItems: [],
      noTextItems: [],
      missingItems: [],
      errorItems: []
    };
    const candidates = songs.filter((item) => item.localPdfPath);
    let current = 0;
    for (const song of candidates) {
      current += 1;
      onProgress?.({ current, total: candidates.length, songTitle: song.title, pdfPath: song.localPdfPath, ...results });
      const extracted = await extractLocalPdfText(song.localPdfPath);
      const status = extracted.status === "failed" ? "error" : extracted.status;
      const itemSummary = {
        title: song.title,
        localPdfPath: song.localPdfPath,
        resolvedUrl: extracted.resolvedUrl || "",
        statusHttp: extracted.statusHttp || "",
        contentType: extracted.contentType || "",
        message: extracted.message || ""
      };
      const payload = {
        ...song,
        pdfSearchText: extracted.status === "indexed" ? extracted.text : "",
        pdfSearchTokens: extracted.tokens || [],
        pdfIndexStatus: status,
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
      onProgress?.({ current, total: candidates.length, songTitle: song.title, pdfPath: song.localPdfPath, ...results });
    }
    await logAuditEvent({
      actionType: "update",
      entityType: "pdf",
      entityId: "local-pdf-index",
      entityName: "Indice de PDFs locales",
      summary: `Indexacion PDF: ${results.indexed} indexados, ${results.noText} sin texto, ${results.missing} no encontrados, ${results.failed} con error`,
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
      saveSchedule,
      replaceScheduleSong,
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
    [auditLogs, authorizedEmails, error, loading, notifications, schedules, settings, songs, themes, useLocal, users]
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
