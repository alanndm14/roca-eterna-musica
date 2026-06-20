const scrollStorageKey = "roca-eterna-route-scroll";
const resetStorageKey = "roca-eterna-route-reset";

const readPositions = () => {
  try {
    return JSON.parse(sessionStorage.getItem(scrollStorageKey) || "{}") || {};
  } catch {
    return {};
  }
};

export function saveRouteScroll(path, scrollY) {
  if (!path) return;
  const positions = readPositions();
  positions[path] = Math.max(0, Number(scrollY || 0));
  sessionStorage.setItem(scrollStorageKey, JSON.stringify(positions));
}

export function getRouteScroll(path) {
  return Number(readPositions()[path] || 0);
}

export function requestRouteScrollReset(path) {
  if (!path) return;
  const positions = readPositions();
  delete positions[path];
  sessionStorage.setItem(scrollStorageKey, JSON.stringify(positions));
  sessionStorage.setItem(resetStorageKey, path);
}

export function consumeRouteScrollReset(path) {
  if (sessionStorage.getItem(resetStorageKey) !== path) return false;
  sessionStorage.removeItem(resetStorageKey);
  return true;
}
