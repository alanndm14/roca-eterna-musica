import { appVersion } from "../data/changelog";

const versionStorageKey = "roca-eterna-installed-version";
const dismissedStorageKey = "roca-eterna-update-dismissed-version";

export function compareVersions(a = "0.0.0", b = "0.0.0") {
  const left = String(a).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getInstalledVersion() {
  return localStorage.getItem(versionStorageKey) || appVersion;
}

export function markInstalledVersion(version = appVersion) {
  localStorage.setItem(versionStorageKey, version);
}

export function wasUpdateDismissed(version = "") {
  return Boolean(version) && localStorage.getItem(dismissedStorageKey) === version;
}

export function dismissUpdate(version = "") {
  if (version) localStorage.setItem(dismissedStorageKey, version);
}

export function clearDismissedUpdate(version = "") {
  if (!version || localStorage.getItem(dismissedStorageKey) === version) {
    localStorage.removeItem(dismissedStorageKey);
  }
}

export async function fetchLatestVersion() {
  const base = import.meta.env.BASE_URL || "/";
  const response = await fetch(`${base}version.json?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo consultar version.json (${response.status})`);
  return response.json();
}

export async function activateLatestAppVersion(version = "") {
  clearDismissedUpdate(version);
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((registrations || []).map(async (registration) => {
      registration.waiting?.postMessage?.({ type: "SKIP_WAITING" });
      await registration.update?.();
    }));
  } catch {
    // La recarga sigue siendo segura aunque el navegador no permita controlar el service worker.
  }

  try {
    const keys = await caches?.keys?.();
    await Promise.all((keys || [])
      .filter((key) => key.startsWith("roca-eterna-musica"))
      .map((key) => caches.delete(key)));
  } catch {
    // Algunos navegadores restringen Cache Storage en modo privado.
  }

  if (version) markInstalledVersion(version);
  window.location.reload();
}
