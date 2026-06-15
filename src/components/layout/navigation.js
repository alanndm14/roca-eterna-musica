import {
  BarChart3,
  CalendarDays,
  Clock3,
  FileClock,
  History,
  Home,
  ListMusic,
  Music2,
  Settings,
  Sparkles,
  PanelsTopLeft,
  UsersRound
} from "lucide-react";

export const navItems = [
  { label: "Inicio", path: "/", icon: Home, tourId: "nav-inicio", roles: ["admin", "editor", "viewer"] },
  { label: "Repertorio", path: "/repertorio", icon: ListMusic, tourId: "nav-repertorio", roles: ["admin", "editor", "viewer"] },
  { label: "Programación", path: "/programacion", icon: CalendarDays, tourId: "nav-programacion", roles: ["admin", "editor"] },
  { label: "Músicos", path: "/musicos", icon: Music2, tourId: "nav-musicos", roles: ["admin", "editor"] },
  { label: "Servicios", path: "/servicios", icon: PanelsTopLeft, tourId: "nav-servicios", roles: ["viewer"] },
  { label: "Centro Inteligente", path: "/inteligente", icon: Sparkles, tourId: "nav-inteligente", roles: ["admin", "editor"] },
  { label: "Historial", path: "/historial", icon: Clock3, tourId: "nav-historial", roles: ["admin", "editor"] },
  { label: "Estadísticas", path: "/estadisticas", icon: BarChart3, tourId: "nav-estadisticas", roles: ["admin", "editor"] },
  { label: "Configuración", path: "/configuracion", icon: Settings, tourId: "nav-configuracion", roles: ["admin", "editor", "viewer"] },
  { label: "Auditoría", path: "/auditoria", icon: FileClock, tourId: "nav-auditoria", roles: ["admin"] },
  { label: "Actualizaciones", path: "/actualizaciones", icon: History, tourId: "nav-actualizaciones", roles: ["admin", "editor"] }
];

const normalizeProfile = (profileOrRole = "viewer") => (
  typeof profileOrRole === "string"
    ? { role: profileOrRole, viewerType: "corista" }
    : { role: profileOrRole?.role || "viewer", viewerType: profileOrRole?.viewerType || "corista" }
);

export const getVisibleNavItems = (profileOrRole = "viewer") => {
  const profile = normalizeProfile(profileOrRole);
  return navItems.filter((item) => (
    item.roles.includes(profile.role)
    && (profile.role !== "viewer" || !item.viewerTypes || item.viewerTypes.includes(profile.viewerType))
  ));
};

const mobilePrimaryOrder = ["/", "/programacion", "/inteligente", "/musicos"];

export const getMobilePrimaryItems = (profileOrRole = "viewer") => {
  const profile = normalizeProfile(profileOrRole);
  const visible = getVisibleNavItems(profile);
  if (profile.role === "viewer") return visible;
  return mobilePrimaryOrder
    .map((path) => visible.find((item) => item.path === path))
    .filter(Boolean)
    .slice(0, 4);
};
export const getMobileExtraItems = (profileOrRole = "viewer") =>
  getVisibleNavItems(profileOrRole)
    .filter((item) => !getMobilePrimaryItems(profileOrRole).some((primary) => primary.path === item.path))
    .map((item) => (item.path === "/configuracion" ? { ...item, icon: UsersRound } : item));

export const mobilePrimaryItems = getMobilePrimaryItems("admin");
export const mobileExtraItems = getMobileExtraItems("admin");
export const mobileNavItems = [...mobilePrimaryItems, { ...navItems[7], icon: UsersRound }];
