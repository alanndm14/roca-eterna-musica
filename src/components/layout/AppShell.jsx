import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, HelpCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { getEffectiveThemeMode, getInstitutionalLogo } from "../../services/songUtils";
import { saveLastBackgroundPush, subscribeForegroundPushMessages } from "../../services/pushNotifications";
import { Button } from "../ui/Button";
import { ErrorBoundary } from "../ui/ErrorBoundary";
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
  const [foregroundPush, setForegroundPush] = useState(null);
  const pageTitle = pageNames[location.pathname] || "Roca Eterna Musica";
  const themeMode = profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system";
  const effectiveTheme = getEffectiveThemeMode(themeMode);
  const logoSrc = getInstitutionalLogo(settings, appLogo, themeMode);
  const logoAlt = settings.logoAltText || "Roca Eterna Música";
  const visibleNotifications = notifications.filter((item) => {
    const targetUsers = item.targetUsers || [];
    const targetRoles = item.targetRoles || [];
    if (targetUsers.length) return targetUsers.includes(profile?.uid);
    if (targetRoles.length) return targetRoles.includes(profile?.role);
    return true;
  });
  const unreadNotifications = visibleNotifications.filter((item) => !(item.readBy || []).includes(profile?.uid));
  const shellStyle = {
    "--color-brass": hexToRgb(profile?.accentColor || localStorage.getItem("roca-eterna-accent-color") || "#b6945f"),
    "--color-blue-gray": hexToRgb(profile?.blueGrayColor || "#60717d")
  };

  useEffect(() => {
    localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (logoSrc) localStorage.setItem("roca-eterna-logo-src", logoSrc);
    localStorage.setItem("roca-eterna-logo-light-src", getInstitutionalLogo(settings, appLogo, "light"));
    localStorage.setItem("roca-eterna-logo-dark-src", getInstitutionalLogo(settings, appLogo, "dark"));
    if (logoAlt) localStorage.setItem("roca-eterna-logo-alt", logoAlt);
    localStorage.removeItem("roca-eterna-logo-invert");
  }, [logoAlt, logoSrc, settings]);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    const shown = new Set();

    const openUrl = (url) => {
      if (!url) return;
      if (url.startsWith("/#/")) {
        navigate(url.replace("/#", ""));
        return;
      }
      if (url.startsWith("#/")) {
        navigate(url.replace("#", ""));
        return;
      }
      if (url.startsWith("/")) {
        window.location.href = url;
      } else {
        window.location.href = url;
      }
    };

    subscribeForegroundPushMessages((message) => {
      if (cancelled || shown.has(message.notificationId)) return;
      shown.add(message.notificationId);
      setForegroundPush(message);
      window.dispatchEvent(new CustomEvent("roca-eterna-foreground-push", { detail: message }));

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(message.title, {
            body: message.body,
            icon: message.icon,
            badge: message.badge,
            tag: message.tag,
            renotify: false,
            data: { url: message.url }
          });
          notification.onclick = () => {
            window.focus();
            openUrl(message.url);
            notification.close();
          };
        } catch {
          // Algunos navegadores bloquean Notification() en foreground; el banner interno queda activo.
        }
      }
    }).then((cleanup) => {
      unsubscribe = cleanup || (() => {});
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type !== "roca-eterna-background-push") return;
      const message = {
        ...(event.data.payload || {}),
        receivedAt: new Date().toISOString()
      };
      saveLastBackgroundPush(message);
      window.dispatchEvent(new CustomEvent("roca-eterna-background-push", { detail: message }));
    };
    let channel = null;
    try {
      channel = new BroadcastChannel("roca-eterna-push");
      channel.onmessage = handleServiceWorkerMessage;
    } catch {
      channel = null;
    }
    navigator.serviceWorker?.addEventListener?.("message", handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener?.("message", handleServiceWorkerMessage);
      channel?.close?.();
    };
  }, []);

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
    if (notification.songId) navigate(`/repertorio/${notification.songId}`);
  };

  const openForegroundPush = () => {
    if (!foregroundPush) return;
    const url = foregroundPush.url || "";
    setForegroundPush(null);
    if (foregroundPush.scheduleId) {
      navigate("/programacion");
    } else if (foregroundPush.songId) {
      navigate(`/repertorio/${foregroundPush.songId}`);
    } else if (url.startsWith("/#/")) {
      navigate(url.replace("/#", ""));
    } else if (url.startsWith("#/")) {
      navigate(url.replace("#", ""));
    }
  };

  return (
    <div className="min-h-screen bg-stonewash text-ink" style={shellStyle}>
      <Sidebar profile={profile} collapsed={sidebarCollapsed} logoSrc={logoSrc} logoAlt={logoAlt} logoMode={effectiveTheme} />
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
                className={`h-11 w-11 shrink-0 rounded-2xl object-contain p-1 shadow-soft lg:hidden ${effectiveTheme === "dark" ? "bg-zinc-950" : "bg-white"}`}
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
                      {visibleNotifications.length ? visibleNotifications.slice(0, 12).map((item) => {
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
          {foregroundPush ? (
            <div className="mb-4 rounded-3xl border border-brass/30 bg-brass/12 p-4 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brass">Notificacion recibida con la app abierta</p>
                  <p className="mt-1 font-bold text-ink">{foregroundPush.title}</p>
                  {foregroundPush.body ? <p className="mt-1 text-sm text-ink/65">{foregroundPush.body}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="h-10 px-3 text-sm" onClick={openForegroundPush}>Abrir</Button>
                  <Button variant="subtle" className="h-10 px-3 text-sm" onClick={() => setForegroundPush(null)}>Cerrar</Button>
                </div>
              </div>
            </div>
          ) : null}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
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
