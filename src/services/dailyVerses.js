import { collection, getDoc, getDocs, doc, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";

export const fallbackLoginVerses = [
  {
    id: "fallback-salmo-96-1",
    text: "Cantad a Jehová cántico nuevo; cantad a Jehová, toda la tierra.",
    reference: "Salmo 96:1",
    translation: ""
  },
  {
    id: "fallback-salmo-100-2",
    text: "Servid a Jehová con alegría; venid ante su presencia con regocijo.",
    reference: "Salmo 100:2",
    translation: ""
  },
  {
    id: "fallback-colosenses-3-16",
    text: "Cantando con gracia en vuestros corazones al Señor con salmos e himnos y cánticos espirituales.",
    reference: "Colosenses 3:16",
    translation: ""
  },
  {
    id: "fallback-salmo-133-1",
    text: "¡Mirad cuán bueno y cuán delicioso es habitar los hermanos juntos en armonía!",
    reference: "Salmo 133:1",
    translation: ""
  },
  {
    id: "fallback-lamentaciones-3-23",
    text: "Nuevas son cada mañana; grande es tu fidelidad.",
    reference: "Lamentaciones 3:23",
    translation: ""
  }
];

export function getLocalDateKey(date = new Date(), timeZone = "America/Mexico_City") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function hashDateKey(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getDeterministicDailyVerse(verses = [], dateKey = getLocalDateKey()) {
  const activeVerses = (Array.isArray(verses) ? verses : []).filter((verse) => verse?.active !== false && verse?.text && verse?.reference);
  const source = activeVerses.length ? activeVerses : fallbackLoginVerses;
  return source[hashDateKey(dateKey) % source.length];
}

export function getVerseForDate(verses = [], overrides = [], dateKey = getLocalDateKey()) {
  const override = (Array.isArray(overrides) ? overrides : []).find((item) => item?.date === dateKey || item?.id === dateKey);
  if (override?.verseId) {
    const selected = (Array.isArray(verses) ? verses : []).find((verse) => verse.id === override.verseId && verse.active !== false);
    if (selected) return selected;
  }
  return getDeterministicDailyVerse(verses, dateKey);
}

export async function fetchDailyVerse(dateKey = getLocalDateKey()) {
  const fallback = getDeterministicDailyVerse(fallbackLoginVerses, dateKey);
  if (!isFirebaseConfigured || !db) return fallback;

  try {
    const [verseSnapshot, overrideSnapshot] = await Promise.all([
      getDocs(query(collection(db, "loginVerses"), where("active", "==", true))),
      getDoc(doc(db, "dailyVerseOverrides", dateKey))
    ]);
    const verses = verseSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    const override = overrideSnapshot.exists()
      ? [{ id: overrideSnapshot.id, ...overrideSnapshot.data() }]
      : [];
    return getVerseForDate(verses, override, dateKey) || fallback;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[Versículo diario] Se usará el respaldo local.", error?.message || error);
    }
    return fallback;
  }
}
