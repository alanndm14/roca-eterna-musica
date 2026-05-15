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
  { label: "Inicio", path: "/", icon: Home, tourId: "nav-inicio" },
  { label: "Repertorio", path: "/repertorio", icon: ListMusic, tourId: "nav-repertorio" },
  { label: "Programacion", path: "/programacion", icon: CalendarDays, tourId: "nav-programacion" },
  { label: "Musicos", path: "/musicos", icon: Music2, tourId: "nav-musicos" },
  { label: "Historial", path: "/historial", icon: Clock3, tourId: "nav-historial" },
  { label: "Estadisticas", path: "/estadisticas", icon: BarChart3, tourId: "nav-estadisticas" },
  { label: "Configuracion", path: "/configuracion", icon: Settings, tourId: "nav-configuracion" },
  { label: "Auditoria", path: "/auditoria", icon: FileClock },
  { label: "Actualizaciones", path: "/actualizaciones", icon: Sparkles }
];

export const mobilePrimaryItems = [navItems[0], navItems[1], navItems[2], navItems[3]];
export const mobileExtraItems = [navItems[4], navItems[5], { ...navItems[6], icon: UsersRound }, navItems[7], navItems[8]];
export const mobileNavItems = [...mobilePrimaryItems, { ...navItems[6], icon: UsersRound }];
