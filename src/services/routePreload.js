const moduleLoaders = {
  songs: () => import("../pages/Songs"),
  songDetail: () => import("../pages/SongDetail"),
  schedules: () => import("../pages/Schedules"),
  musicianView: () => import("../pages/MusicianView"),
  history: () => import("../pages/History"),
  stats: () => import("../pages/Stats"),
  settings: () => import("../pages/Settings"),
  auditLogs: () => import("../pages/AuditLogs"),
  changelog: () => import("../pages/Changelog")
};

const modulePromises = new Map();
const loadedModules = new Set();

export function loadRouteModule(name) {
  const loader = moduleLoaders[name];
  if (!loader) return Promise.reject(new Error(`Módulo de ruta desconocido: ${name}`));
  if (!modulePromises.has(name)) {
    modulePromises.set(name, loader()
      .then((module) => {
        loadedModules.add(name);
        return module;
      })
      .catch((error) => {
        modulePromises.delete(name);
        throw error;
      }));
  }
  return modulePromises.get(name);
}

const routeModules = {
  "/repertorio": ["songs"],
  "/programacion": ["schedules"],
  "/musicos": ["musicianView"],
  "/servicios": ["musicianView"],
  "/historial": ["history"],
  "/estadisticas": ["stats"],
  "/configuracion": ["settings"],
  "/auditoria": ["auditLogs"],
  "/actualizaciones": ["changelog"]
};

export function preloadRoutePath(path = "") {
  const routePath = Object.keys(routeModules).find((candidate) => (
    path === candidate || path.startsWith(`${candidate}/`)
  ));
  if (!routePath) return Promise.resolve([]);
  return Promise.allSettled(routeModules[routePath].map((name) => loadRouteModule(name)));
}

export async function preloadRoutesForProfile(profile = {}, onProgress) {
  const names = profile?.role === "viewer"
    ? ["songs", "songDetail", "musicianView", "settings"]
    : Object.keys(moduleLoaders);
  let completed = names.filter((name) => loadedModules.has(name)).length;
  const total = names.length;
  const pending = names.filter((name) => !loadedModules.has(name));
  onProgress?.({ completed, total, progress: total ? completed / total : 1 });

  await Promise.allSettled(pending.map(async (name) => {
    await loadRouteModule(name);
    completed += 1;
    onProgress?.({ completed: Math.min(completed, total), total, progress: total ? Math.min(completed, total) / total : 1 });
  }));

  onProgress?.({ completed: total, total, progress: 1 });
}
