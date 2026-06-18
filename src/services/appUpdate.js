import { appVersion } from "../data/changelog";

const versionStorageKey = "roca-eterna-installed-version";
const dismissedStorageKey = "roca-eterna-update-dismissed-version";
const pendingStorageKey = "roca-eterna-force-update-version";
const updateAttemptStorageKey = "roca-eterna-force-update-attempt";
const updateWaitMs = 8000;

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
  try {
    const pendingVersion = sessionStorage.getItem(pendingStorageKey);
    if (!pendingVersion || compareVersions(version, pendingVersion) >= 0) {
      sessionStorage.removeItem(pendingStorageKey);
      sessionStorage.removeItem(updateAttemptStorageKey);
    }
  } catch {
    // El almacenamiento de sesión puede estar bloqueado en navegación privada.
  }
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

function waitForWorkerState(worker, acceptedStates = ["installed", "activated"], timeoutMs = updateWaitMs) {
  if (!worker || acceptedStates.includes(worker.state)) return Promise.resolve(worker);
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      worker.removeEventListener?.("statechange", onStateChange);
      resolve(worker);
    };
    const onStateChange = () => {
      if (acceptedStates.includes(worker.state) || worker.state === "redundant") finish();
    };
    worker.addEventListener?.("statechange", onStateChange);
    timeoutId = window.setTimeout(finish, timeoutMs);
  });
}

function waitForControllerChange(timeoutMs = updateWaitMs) {
  if (!navigator.serviceWorker?.addEventListener) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;
    const finish = (changed) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener?.("controllerchange", onChange);
      resolve(changed);
    };
    const onChange = () => finish(true);
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    timeoutId = window.setTimeout(() => finish(false), timeoutMs);
  });
}

async function clearAppCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith("roca-eterna-musica") || key.startsWith("workbox-precache"))
    .map((key) => caches.delete(key)));
}

export async function activateLatestAppVersion(version = "") {
  const targetVersion = version || appVersion;
  clearDismissedUpdate(targetVersion);
  try {
    sessionStorage.setItem(pendingStorageKey, targetVersion);
    const previousAttempts = Number.parseInt(sessionStorage.getItem(updateAttemptStorageKey) || "0", 10) || 0;
    sessionStorage.setItem(updateAttemptStorageKey, String(previousAttempts + 1));
  } catch {
    // La actualización continúa aunque sessionStorage no esté disponible.
  }

  try {
    await clearAppCaches();
  } catch {
    // Algunos navegadores restringen Cache Storage en modo privado.
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    for (const registration of registrations || []) {
      const controllerChange = waitForControllerChange();
      const previousActive = registration.active;
      await registration.update?.();
      if (registration.installing) await waitForWorkerState(registration.installing);
      const candidate = registration.waiting || (registration.installing?.state === "installed" ? registration.installing : null);
      candidate?.postMessage?.({ type: "SKIP_WAITING" });
      if (candidate) await controllerChange;
      else if (registration.active !== previousActive) await controllerChange;
    }
  } catch {
    // La recarga sigue siendo segura aunque el navegador no permita controlar el service worker.
  }

  const base = import.meta.env.BASE_URL || "/";
  const hash = window.location.hash || "";
  const separator = base.includes("?") ? "&" : "?";
  window.location.replace(`${window.location.origin}${base}${separator}update=${Date.now()}&target=${encodeURIComponent(targetVersion)}${hash}`);
}
