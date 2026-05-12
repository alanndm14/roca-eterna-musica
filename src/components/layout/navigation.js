import {
  BarChart3,
  CalendarDays,
  Clock3,
  Home,
  ListMusic,
  Music2,
  Settings,
  UsersRound
} from "lucide-react";

export const navItems = [
  { label: "Inicio", path: "/", icon: Home },
  { label: "Repertorio", path: "/repertorio", icon: ListMusic },
  { label: "Programación", path: "/programacion", icon: CalendarDays },
  { label: "Músicos", path: "/musicos", icon: Music2 },
  { label: "Historial", path: "/historial", icon: Clock3 },
  { label: "Estadísticas", path: "/estadisticas", icon: BarChart3 },
  { label: "Configuración", path: "/configuracion", icon: Settings }
];

export const mobilePrimaryItems = [navItems[0], navItems[1], navItems[2], navItems[3]];
export const mobileExtraItems = [navItems[4], navItems[5], { ...navItems[6], icon: UsersRound }];
export const mobileNavItems = [...mobilePrimaryItems, { ...navItems[6], icon: UsersRound }];
