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

export const mobileNavItems = [navItems[0], navItems[1], navItems[2], navItems[3], { ...navItems[6], icon: UsersRound }];
