import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, HelpCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { getInstitutionalLogo } from "../../services/songUtils";
import { Button } from "../ui/Button";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

const pageNames = {
  "/": "Inicio",
  "/repertorio": "Repertorio",
  "/programacion": "Programacion",
  "/musicos": "Vista para musicos",
  "/historial": "Historial",
  "/estadisticas": "Estadisticas",
  "/configuracion": "Configuracion",
  "/auditoria": "Registro de cambios",
  "/actualizaciones": "Actualizaciones"
};

const sidebarStorageKey = "roca-eterna-sidebar-collapsed";

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, saveUserPreferences } = useAuth();
  const { settings, useLocal, notifications, markNotificationRead, markAllNotificationsRead } = useMusicData();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarStorageKey) === "true");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pageTitle = pageNames[location.pathname] || "Roca Eterna Musica";
  const themeMode = profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system";
  const logoSrc = getInstitutionalLogo(settings, appLogo);
  const logoAlt = settings.logoAltText || "Roca Eterna Musica";
  const unreadNotifications = notifications.filter((item) => !(item.readBy || []).includes(profile?.uid));
  const shellStyle = {
    "--color-brass": hexToRgb(profile?.accentColor || localStorage.getItem("roca-eterna-accent-color") || "#b6945f"),
    "--color-blue-gray": hexToRgb(profile?.blueGrayColor || "#60717d")
  };

  useEffect(() => {
    localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (logoSrc) localStorage.setItem("roca-eterna-logo-src", logoSrc);
    if (logoAlt) localStorage.setItem("roca-eterna-logo-alt", logoAlt);
  }, [logoAlt, logoSrc]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const shouldUseDark = themeMode === "dark" || (themeMode === "system" && media?.matches);
      document.documentElement.classList.toggle("dark", Boolean(shouldUseDark));
      localStorage.setItem("roca-eterna-theme-mode", themeMode);
    };

    applyTheme();
    media?.addEventListener?.("change", applyTheme);
    return () => media?.removeEventListener?.("change", applyTheme);
  }, [themeMode]);

  const openGuide = () => window.dispatchEvent(new Event("roca-eterna-open-guide"));
  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      saveUserPreferences?.({ sidebarCollapsed: next });
      return next;
    });
  };

  const openNotification = async (notification) => {
    await markNotificationRead(notification.id);
    setNotificationsOpen(false);
    if (notification.scheduleId) navigate("/programacion");
  };

  return (
    <div className="min-h-screen bg-stonewash text-ink" style={shellStyle}>
      <Sidebar profile={profile} collapsed={sidebarCollapsed} logoSrc={logoSrc} logoAlt={logoAlt} />
      <main className={`app-main pb-32 transition-all duration-200 lg:pb-0 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <header className="app-header sticky top-0 z-30 border-b border-ink/10 bg-stonewash/86 px-4 py-3 backdrop-blur md:px-8 md:py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logoSrc}
                onError={(event) => {
                  event.currentTarget.src = fallbackAppLogo;
                }}
                alt={logoAlt}
                className="h-11 w-11 shrink-0 rounded-2xl bg-white object-contain p-1 shadow-soft lg:hidden"
              />
              <Button
                variant="subtle"
                className="hidden h-10 w-10 px-0 lg:inline-flex"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                  {settings.churchName || "Roca Eterna"}
                </p>
                <h1 className="truncate text-xl font-bold tracking-normal text-ink md:text-2xl">{pageTitle}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {useLocal ? (
                <span className="hidden rounded-full bg-brass/12 px-3 py-1 text-xs font-semibold text-brass sm:inline-flex">
                  Modo demo
                </span>
              ) : null}
              <Button variant="subtle" className="h-10 w-10 px-0" onClick={openGuide} aria-label="Guia de uso">
                <HelpCircle className="h-4 w-4" />
              </Button>
              <div className="relative">
                <Button variant="subtle" className="h-10 w-10 px-0" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Notificaciones">
                  <Bell className="h-4 w-4" />
                  {unreadNotifications.length ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brass px-1 text-[10px] font-bold text-white">
                      {unreadNotifications.length}
                    </span>
                  ) : null}
                </Button>
                {notificationsOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-ink/10 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-ink">Notificaciones</p>
                      <Button variant="subtle" className="h-9 px-3 text-xs" onClick={markAllNotificationsRead}>
                        <CheckCheck className="h-3.5 w-3.5" />
                        Marcar todas
                      </Button>
                    </div>
                    <div className="mt-3 max-h-80 space-y-2 overflow-auto">
                      {notifications.length ? notifications.slice(0, 12).map((item) => {
                        const unread = !(item.readBy || []).includes(profile?.uid);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openNotification(item)}
                            className={`w-full rounded-2xl p-3 text-left transition ${unread ? "bg-brass/12" : "bg-ink/5 dark:bg-white/7"}`}
                          >
                            <p className="text-sm font-bold text-ink">{item.title}</p>
                            <p className="mt-1 text-xs leading-5 text-ink/60">{item.message}</p>
                          </button>
                        );
                      }) : <p className="rounded-2xl bg-ink/5 p-3 text-sm text-ink/55">No hay notificaciones.</p>}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "182 148 95";
  return `${parseInt(normalized.slice(0, 2), 16)} ${parseInt(normalized.slice(2, 4), 16)} ${parseInt(normalized.slice(4, 6), 16)}`;
}
