import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  addDoc,
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
import { db, isFirebaseConfigured } from "../lib/firebase";
import { sampleSchedules, sampleSettings, sampleSongs, sampleThemes, sampleUsers } from "../data/mockData";
import { canonicalThemeKey, normalizeSong, normalizeThemeName } from "../services/songUtils";
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

export function MusicDataProvider({ children }) {
  const { profile, isDemoMode } = useAuth();
  const [songs, setSongs] = useState(sampleSongs.map((song) => normalizeSong(song, sampleSettings.keyPreference)));
  const [schedules, setSchedules] = useState(sampleSchedules);
  const [users, setUsers] = useState(sampleUsers);
  const [authorizedEmails, setAuthorizedEmails] = useState([]);
  const [themes, setThemes] = useState(sampleThemes);
  const [settings, setSettings] = useState(sampleSettings);
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
      )
    ];

    setLoading(false);
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [profile, settings.keyPreference, useLocal]);

  useEffect(() => {
    if (!profile || !useLocal) return;
    localStorage.setItem(storageKey, JSON.stringify({ songs, schedules, users, authorizedEmails, themes, settings }));
  }, [authorizedEmails, profile, schedules, settings, songs, themes, useLocal, users]);

  const saveSong = async (song) => {
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
      } else {
        setSongs((current) => [
          ...current,
          {
            ...normalizeSong(payload, settings.keyPreference),
            id: makeId("song"),
            usageCount: 0,
            createdAt: new Date().toISOString().slice(0, 10),
            createdBy: profile.uid
          }
        ]);
      }
      return;
    }

    if (song.id) {
      const { id, ...data } = payload;
      await updateDoc(doc(db, "songs", id), data);
    } else {
      await addDoc(collection(db, "songs"), {
        ...payload,
        usageCount: 0,
        createdAt: serverTimestamp(),
        createdBy: profile.uid
      });
    }
  };

  const deleteSong = async (songId) => {
    if (useLocal) {
      setSongs((current) => current.filter((song) => song.id !== songId));
      return;
    }
    await deleteDoc(doc(db, "songs", songId));
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
    const payload = {
      ...schedule,
      songs: schedule.songs || [],
      updatedAt: useLocal ? new Date().toISOString().slice(0, 10) : serverTimestamp()
    };

    if (useLocal) {
      if (schedule.id) {
        setSchedules((current) => current.map((item) => (item.id === schedule.id ? { ...item, ...payload } : item)));
      } else {
        setSchedules((current) => [
          ...current,
          {
            ...payload,
            id: makeId("schedule"),
            createdAt: new Date().toISOString().slice(0, 10),
            createdBy: profile.uid
          }
        ]);
      }
      return;
    }

    if (schedule.id) {
      const { id, ...data } = payload;
      await updateDoc(doc(db, "schedules", id), data);
    } else {
      await addDoc(collection(db, "schedules"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: profile.uid
      });
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (useLocal) {
      setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
      return;
    }
    await deleteDoc(doc(db, "schedules", scheduleId));
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
      return;
    }

    await setDoc(doc(db, "authorizedEmails", email), payload, { merge: true });

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

  const saveSettings = async (nextSettings) => {
    if (useLocal) {
      setSettings(nextSettings);
      return;
    }
    await setDoc(doc(db, "settings", "main"), nextSettings, { merge: true });
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
      return;
    }

    if (theme.id) {
      await updateDoc(doc(db, "themes", theme.id), payload);
    } else {
      await addDoc(collection(db, "themes"), payload);
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
      loading,
      error,
      useLocal,
      saveSong,
      deleteSong,
      duplicateSong,
      saveSchedule,
      deleteSchedule,
      duplicateSchedule,
      saveUser,
      saveSettings,
      saveTheme,
      mergeTheme,
      importSongs,
      seedExampleData
    }),
    [authorizedEmails, error, loading, schedules, settings, songs, themes, useLocal, users]
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
