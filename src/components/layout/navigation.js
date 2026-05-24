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
  UsersRound
} from "lucide-react";

export const navItems = [
  { label: "Inicio", path: "/", icon: Home, tourId: "nav-inicio", roles: ["admin", "editor", "viewer"] },
  { label: "Repertorio", path: "/repertorio", icon: ListMusic, tourId: "nav-repertorio", roles: ["admin", "editor", "viewer"] },
  { label: "Programación", path: "/programacion", icon: CalendarDays, tourId: "nav-programacion", roles: ["admin", "editor", "viewer"] },
  { label: "Músicos", path: "/musicos", icon: Music2, tourId: "nav-musicos", roles: ["admin", "editor", "viewer"] },
  { label: "Centro Inteligente", path: "/inteligente", icon: Sparkles, tourId: "nav-inteligente", roles: ["admin", "editor"] },
  { label: "Historial", path: "/historial", icon: Clock3, tourId: "nav-historial", roles: ["admin", "editor"] },
  { label: "Estadísticas", path: "/estadisticas", icon: BarChart3, tourId: "nav-estadisticas", roles: ["admin", "editor"] },
  { label: "Configuración", path: "/configuracion", icon: Settings, tourId: "nav-configuracion", roles: ["admin", "editor", "viewer"] },
  { label: "Auditoría", path: "/auditoria", icon: FileClock, tourId: "nav-auditoria", roles: ["admin"] },
  { label: "Actualizaciones", path: "/actualizaciones", icon: History, tourId: "nav-actualizaciones", roles: ["admin", "editor"] }
];

export const getVisibleNavItems = (role = "viewer") =>
  navItems.filter((item) => item.roles.includes(role || "viewer"));

const mobilePrimaryOrder = ["/", "/programacion", "/inteligente", "/musicos"];

export const getMobilePrimaryItems = (role = "viewer") => {
  const visible = getVisibleNavItems(role);
  return mobilePrimaryOrder
    .map((path) => visible.find((item) => item.path === path))
    .filter(Boolean)
    .slice(0, 4);
};
export const getMobileExtraItems = (role = "viewer") =>
  getVisibleNavItems(role)
    .filter((item) => !getMobilePrimaryItems(role).some((primary) => primary.path === item.path))
    .map((item) => (item.path === "/configuracion" ? { ...item, icon: UsersRound } : item));

export const mobilePrimaryItems = getMobilePrimaryItems("admin");
export const mobileExtraItems = getMobileExtraItems("admin");
export const mobileNavItems = [...mobilePrimaryItems, { ...navItems[7], icon: UsersRound }];
