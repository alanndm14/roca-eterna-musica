const DB_NAME = "roca-eterna-temporary-pdfs";
const STORE_NAME = "servicePdfs";
const DB_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "scheduleId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB."));
  });
}

function txStore(db, mode = "readonly") {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Error en IndexedDB."));
  });
}

export async function saveTemporaryServicePdf(record) {
  const db = await openDb();
  const payload = {
    ...record,
    generatedAt: record.generatedAt || new Date().toISOString(),
    expiresAt: record.expiresAt || new Date(Date.now() + DAY_MS).toISOString()
  };
  await requestToPromise(txStore(db, "readwrite").put(payload));
  db.close();
  return payload;
}

export async function getTemporaryServicePdf(scheduleId) {
  if (!scheduleId) return null;
  const db = await openDb();
  const record = await requestToPromise(txStore(db).get(scheduleId));
  db.close();
  if (!record) return null;
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    await deleteTemporaryServicePdf(scheduleId);
    return null;
  }
  return record;
}

export async function deleteTemporaryServicePdf(scheduleId) {
  if (!scheduleId) return;
  const db = await openDb();
  await requestToPromise(txStore(db, "readwrite").delete(scheduleId));
  db.close();
}

export async function cleanupExpiredTemporaryServicePdfs() {
  const db = await openDb();
  const all = await requestToPromise(txStore(db).getAll());
  const expired = all.filter((record) => record.expiresAt && new Date(record.expiresAt).getTime() < Date.now());
  db.close();
  await Promise.all(expired.map((record) => deleteTemporaryServicePdf(record.scheduleId)));
  return expired.length;
}
