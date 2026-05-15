import {
  BarChart3,
  CalendarDays,
  Clock3,
  FileClock,
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
  { label: "Programacion", path: "/programacion", icon: CalendarDays, tourId: "nav-programacion", roles: ["admin", "editor", "viewer"] },
  { label: "Musicos", path: "/musicos", icon: Music2, tourId: "nav-musicos", roles: ["admin", "editor", "viewer"] },
  { label: "Historial", path: "/historial", icon: Clock3, tourId: "nav-historial", roles: ["admin", "editor"] },
  { label: "Estadisticas", path: "/estadisticas", icon: BarChart3, tourId: "nav-estadisticas", roles: ["admin", "editor"] },
  { label: "Configuracion", path: "/configuracion", icon: Settings, tourId: "nav-configuracion", roles: ["admin", "editor", "viewer"] },
  { label: "Auditoria", path: "/auditoria", icon: FileClock, tourId: "nav-auditoria", roles: ["admin"] },
  { label: "Actualizaciones", path: "/actualizaciones", icon: Sparkles, tourId: "nav-actualizaciones", roles: ["admin", "editor"] }
];

export const getVisibleNavItems = (role = "viewer") =>
  navItems.filter((item) => item.roles.includes(role || "viewer"));

export const getMobilePrimaryItems = (role = "viewer") => getVisibleNavItems(role).slice(0, 4);
export const getMobileExtraItems = (role = "viewer") =>
  getVisibleNavItems(role).slice(4).map((item) => (item.path === "/configuracion" ? { ...item, icon: UsersRound } : item));

export const mobilePrimaryItems = getMobilePrimaryItems("admin");
export const mobileExtraItems = getMobileExtraItems("admin");
export const mobileNavItems = [...mobilePrimaryItems, { ...navItems[6], icon: UsersRound }];
