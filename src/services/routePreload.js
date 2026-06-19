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

export function loadRouteModule(name) {
  const loader = moduleLoaders[name];
  if (!loader) return Promise.reject(new Error(`Módulo de ruta desconocido: ${name}`));
  if (!modulePromises.has(name)) modulePromises.set(name, loader());
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

