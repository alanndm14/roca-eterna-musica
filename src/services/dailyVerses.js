import { collection, getDoc, getDocs, doc, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";

export const fallbackLoginVerses = [
  { id: "fallback-colosenses-3-16", reference: "Colosenses 3:16", text: "La palabra de Cristo more en abundancia en vosotros, ense\u00f1\u00e1ndoos y exhort\u00e1ndoos unos a otros en toda sabidur\u00eda, cantando con gracia en vuestros corazones al Se\u00f1or con salmos e himnos y c\u00e1nticos espirituales.", translation: "RVR60" },
  { id: "fallback-lamentaciones-3-23", reference: "Lamentaciones 3:23", text: "Nuevas son cada ma\u00f1ana; grande es tu fidelidad.", translation: "RVR60" },
  { id: "fallback-salmo-100-2", reference: "Salmo 100:2", text: "Servid a Jehov\u00e1 con alegr\u00eda; venid ante su presencia con regocijo.", translation: "RVR60" },
  { id: "fallback-salmo-133-1", reference: "Salmo 133:1", text: "\u00a1Mirad cu\u00e1n bueno y cu\u00e1n delicioso es habitar los hermanos juntos en armon\u00eda!", translation: "RVR60" },
  { id: "fallback-salmo-96-1", reference: "Salmo 96:1", text: "Cantad a Jehov\u00e1 c\u00e1ntico nuevo; cantad a Jehov\u00e1, toda la tierra.", translation: "RVR60" },
  { id: "fallback-salmo-95-1", reference: "Salmo 95:1", text: "Venid, aclamemos alegremente a Jehov\u00e1; cantemos con j\u00fabilo a la roca de nuestra salvaci\u00f3n.", translation: "RVR60" },
  { id: "fallback-salmo-34-1", reference: "Salmo 34:1", text: "Bendecir\u00e9 a Jehov\u00e1 en todo tiempo; su alabanza estar\u00e1 de continuo en mi boca.", translation: "RVR60" },
  { id: "fallback-salmo-103-1", reference: "Salmo 103:1", text: "Bendice, alma m\u00eda, a Jehov\u00e1, y bendiga todo mi ser su santo nombre.", translation: "RVR60" },
  { id: "fallback-salmo-150-6", reference: "Salmo 150:6", text: "Todo lo que respira alabe a JAH. Aleluya.", translation: "RVR60" },
  { id: "fallback-1-cronicas-16-23", reference: "1 Cr\u00f3nicas 16:23", text: "Cantad a Jehov\u00e1, toda la tierra; proclamad de d\u00eda en d\u00eda su salvaci\u00f3n.", translation: "RVR60" },
  { id: "fallback-1-cronicas-16-29", reference: "1 Cr\u00f3nicas 16:29", text: "Dad a Jehov\u00e1 la honra debida a su nombre; traed ofrenda, y venid delante de \u00e9l; postraos delante de Jehov\u00e1 en la hermosura de la santidad.", translation: "RVR60" },
  { id: "fallback-salmo-145-3", reference: "Salmo 145:3", text: "Grande es Jehov\u00e1, y digno de suprema alabanza; y su grandeza es inescrutable.", translation: "RVR60" },
  { id: "fallback-salmo-147-1", reference: "Salmo 147:1", text: "Alabad a Jehov\u00e1, porque es bueno cantar salmos a nuestro Dios; porque es agradable, la alabanza es hermosa.", translation: "RVR60" },
  { id: "fallback-salmo-149-1", reference: "Salmo 149:1", text: "Alabad a Jehov\u00e1. Cantad a Jehov\u00e1 c\u00e1ntico nuevo; su alabanza sea en la congregaci\u00f3n de los santos.", translation: "RVR60" },
  { id: "fallback-efesios-5-19", reference: "Efesios 5:19", text: "Hablando entre vosotros con salmos, con himnos y c\u00e1nticos espirituales, cantando y alabando al Se\u00f1or en vuestros corazones.", translation: "RVR60" },
  { id: "fallback-hebreos-13-15", reference: "Hebreos 13:15", text: "As\u00ed que, ofrezcamos siempre a Dios, por medio de \u00e9l, sacrificio de alabanza, es decir, fruto de labios que confiesan su nombre.", translation: "RVR60" },
  { id: "fallback-juan-4-24", reference: "Juan 4:24", text: "Dios es Esp\u00edritu; y los que le adoran, en esp\u00edritu y en verdad es necesario que adoren.", translation: "RVR60" },
  { id: "fallback-romanos-12-1", reference: "Romanos 12:1", text: "As\u00ed que, hermanos, os ruego por las misericordias de Dios, que present\u00e9is vuestros cuerpos en sacrificio vivo, santo, agradable a Dios, que es vuestro culto racional.", translation: "RVR60" },
  { id: "fallback-filipenses-4-4", reference: "Filipenses 4:4", text: "Regocijaos en el Se\u00f1or siempre. Otra vez digo: \u00a1Regocijaos!", translation: "RVR60" },
  { id: "fallback-1-tesalonicenses-5-18", reference: "1 Tesalonicenses 5:18", text: "Dad gracias en todo, porque esta es la voluntad de Dios para con vosotros en Cristo Jes\u00fas.", translation: "RVR60" },
  { id: "fallback-habacuc-3-18", reference: "Habacuc 3:18", text: "Con todo, yo me alegrar\u00e9 en Jehov\u00e1, y me gozar\u00e9 en el Dios de mi salvaci\u00f3n.", translation: "RVR60" },
  { id: "fallback-isaias-12-5", reference: "Isa\u00edas 12:5", text: "Cantad a Jehov\u00e1, porque ha hecho cosas magn\u00edficas; sea sabido esto en toda la tierra.", translation: "RVR60" },
  { id: "fallback-isaias-26-3", reference: "Isa\u00edas 26:3", text: "T\u00fa guardar\u00e1s en completa paz a aquel cuyo pensamiento en ti persevera; porque en ti ha confiado.", translation: "RVR60" },
  { id: "fallback-salmo-46-1", reference: "Salmo 46:1", text: "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.", translation: "RVR60" },
  { id: "fallback-proverbios-3-5", reference: "Proverbios 3:5", text: "F\u00edate de Jehov\u00e1 de todo tu coraz\u00f3n, y no te apoyes en tu propia prudencia.", translation: "RVR60" },
  { id: "fallback-salmo-51-10", reference: "Salmo 51:10", text: "Crea en m\u00ed, oh Dios, un coraz\u00f3n limpio, y renueva un esp\u00edritu recto dentro de m\u00ed.", translation: "RVR60" },
  { id: "fallback-salmo-27-4", reference: "Salmo 27:4", text: "Una cosa he demandado a Jehov\u00e1, esta buscar\u00e9; que est\u00e9 yo en la casa de Jehov\u00e1 todos los d\u00edas de mi vida, para contemplar la hermosura de Jehov\u00e1, y para inquirir en su templo.", translation: "RVR60" },
  { id: "fallback-hebreos-10-24", reference: "Hebreos 10:24", text: "Y consider\u00e9monos unos a otros para estimularnos al amor y a las buenas obras.", translation: "RVR60" },
  { id: "fallback-romanos-15-6", reference: "Romanos 15:6", text: "Para que un\u00e1nimes, a una voz, glorifiqu\u00e9is al Dios y Padre de nuestro Se\u00f1or Jesucristo.", translation: "RVR60" },
  { id: "fallback-apocalipsis-4-11", reference: "Apocalipsis 4:11", text: "Se\u00f1or, digno eres de recibir la gloria y la honra y el poder; porque t\u00fa creaste todas las cosas, y por tu voluntad existen y fueron creadas.", translation: "RVR60" },
  { id: "fallback-apocalipsis-5-12", reference: "Apocalipsis 5:12", text: "que dec\u00edan a gran voz: El Cordero que fue inmolado es digno de tomar el poder, las riquezas, la sabidur\u00eda, la fortaleza, la honra, la gloria y la alabanza.", translation: "RVR60" }
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
      console.warn("[Vers\u00edculo diario] Se usar\u00e1 el respaldo local.", error?.message || error);
    }
    return fallback;
  }
}
