import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, CalendarDays, CheckCheck, Music2, PanelLeftClose, PanelLeftOpen, RefreshCw, Sparkles } from "lucide-react";
import { appDarkLogo, appLogo, fallbackAppLogo } from "../../assets/logo";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { getEffectiveThemeMode, getInstitutionalLogo } from "../../services/songUtils";
import { enablePushNotificationsForUser, saveLastBackgroundPush, subscribeForegroundPushMessages } from "../../services/pushNotifications";
import { activateLatestAppVersion, compareVersions, dismissUpdate, fetchLatestVersion, markInstalledVersion, wasUpdateDismissed } from "../../services/appUpdate";
import { appBuildVersion, appVersion } from "../../data/changelog";
import { Button } from "../ui/Button";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { preloadRoutePath } from "../../services/routePreload";
import { consumeRouteScrollReset, getRouteScroll, requestRouteScrollReset, saveRouteScroll } from "../../services/navigationMemory";

const pageNames = {
  "/": "Inicio",
  "/repertorio": "Repertorio",
  "/programacion": "Programación",
  "/musicos": "Servicios",
  "/servicios": "Servicios",
  "/historial": "Historial",
  "/estadisticas": "Estadísticas",
  "/configuracion": "Configuración",
  "/auditoria": "Registro de cambios",
  "/actualizaciones": "Actualizaciones"
};

const sidebarStorageKey = "roca-eterna-sidebar-collapsed";
const noveltyTypes = new Set(["new_song", "new_schedule", "updated_schedule"]);
const obsoleteTestSchedulePushIds = new Set([
  "schedule-created-8Tr8Sa2ulHG89a8Tyd5z",
  "schedule-created-kcU7yosLAZ8BguQbTmM0",
  "schedule-created-EByNIYDpNdRvcWqNX5in",
  "schedule-created-CdcEoVLlCj2amkMliS1e",
  "schedule-created-fPXhEWcME95EnctaLCps"
]);
const isObsoleteTestScheduleNotification = (item = {}) => {
  const time = item.createdAt?.seconds ? item.createdAt.seconds * 1000 : new Date(item.createdAt || 0).getTime();
  return obsoleteTestSchedulePushIds.has(item.pushNotificationId)
    || item.pushNotificationId?.startsWith?.("new-song-scheduled-")
    || (item.type === "new_song" && (item.entityType === "schedule" || item.scheduleId))
    || (["new_schedule", "new_song"].includes(item.type)
      && (item.entityType === "schedule" || item.scheduleId)
      && time >= new Date("2026-06-07T20:00:00.000Z").getTime()
      && time <= new Date("2026-06-08T04:30:00.000Z").getTime());
};

const notificationToNovelty = (notification = {}) => ({
  id: notification.id || notification.pushNotificationId || "",
  notificationId: notification.pushNotificationId || notification.id || "",
  title: notification.title || "Novedad",
  body: notification.message || notification.body || "",
  type: notification.type || "other",
  recipientEmail: notification.recipientEmail || notification.data?.recipientEmail || "",
  scheduleId: notification.scheduleId || "",
  songId: notification.songId || "",
  url: notification.songId ? `/#/repertorio/${notification.songId}` : notification.scheduleId ? "/#/programacion" : "",
  source: "internal",
  receivedAt: new Date().toISOString()
});

const notificationKey = (notification = {}) => notification.pushNotificationId || notification.notificationId || notification.id || "";
const isMessageForProfile = (message = {}, profile = {}) => {
  const recipientEmail = String(message.recipientEmail || message.data?.recipientEmail || "").toLowerCase();
  if (message.type === "user_online") {
    return recipientEmail === "liquea45@gmail.com" && String(profile?.email || "").toLowerCase() === recipientEmail;
  }
  if (recipientEmail) return String(profile?.email || "").toLowerCase() === recipientEmail;
  return true;
};

const relativeTime = (value) => {
  if (!value) return "";
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

function NotificationsPortal({
  open,
  onClose,
  unreadCount,
  notifications,
  profile,
  onOpenNotification,
  onMarkAllRead,
  isNotificationEntityDeleted
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[12000]" aria-label="Panel de notificaciones">
      <button
        type="button"
        className="absolute inset-0 bg-ink/25 backdrop-blur-[1px] dark:bg-black/45"
        onClick={onClose}
        aria-label="Cerrar notificaciones"
      />
      <aside className="absolute inset-x-3 bottom-20 top-auto max-h-[min(76dvh,620px)] overflow-hidden rounded-3xl border border-ink/10 bg-white p-3 shadow-2xl dark:border-white/12 dark:bg-zinc-950 sm:bottom-auto sm:right-5 sm:left-auto sm:top-20 sm:w-[min(400px,calc(100vw-2rem))]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold text-ink dark:text-white">Notificaciones</p>
            <p className="text-xs text-ink/45 dark:text-white/55">{unreadCount} sin leer</p>
          </div>
          <div className="flex gap-2">
            <Button variant="subtle" className="h-9 shrink-0 px-3 text-xs" onClick={onMarkAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
            <Button variant="subtle" className="h-9 px-3 text-xs" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
        <div className="mt-3 max-h-[calc(min(76dvh,620px)-5rem)] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {notifications.length ? notifications.slice(0, 12).map((item) => {
            const unread = !(item.readBy || []).includes(profile?.uid);
            const Icon = item.type === "new_song" ? Music2 : item.type === "new_schedule" || item.type === "updated_schedule" ? CalendarDays : Bell;
            const entityDeleted = isNotificationEntityDeleted(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenNotification(item)}
                className={`grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-2xl border p-3 text-left transition ${entityDeleted ? "cursor-default border-transparent bg-ink/5 opacity-65 dark:bg-white/5" : unread ? "border-brass/30 bg-brass/12 hover:border-brass/45 hover:bg-brass/5" : "border-transparent bg-ink/5 hover:border-brass/45 hover:bg-brass/5 dark:bg-white/7"}`}
              >
                <span className={`grid h-10 w-10 place-items-center rounded-2xl ${unread ? "bg-brass text-white" : "bg-ink/10 text-ink/65 dark:bg-white/10"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-ink dark:text-white">{entityDeleted ? (item.scheduleId ? "Programación eliminada" : item.songId ? "Canto eliminado" : item.title) : item.title}</span>
                    {unread ? <span className="h-2 w-2 rounded-full bg-brass" aria-label="No leída" /> : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-ink/60 dark:text-white/68">{entityDeleted ? "Esta novedad ya no está activa." : item.message}</span>
                  <span className="mt-2 block text-[11px] font-medium text-ink/45 dark:text-white/58">
                    {item.createdAt ? new Date(item.createdAt.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : ""}
                  </span>
                </span>
              </button>
            );
          }) : <p className="rounded-2xl bg-ink/5 p-3 text-sm text-ink/55">No hay notificaciones.</p>}
        </div>
      </aside>
    </div>,
    document.body
  );
}

function RouteFallback() {
  return (
    <motion.div
      className="route-fallback flex min-h-[42vh] items-start justify-center pt-16"
      aria-label="Cargando sección"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <div className="h-1 w-20 overflow-hidden rounded-full bg-ink/8 dark:bg-white/10">
        <motion.div
          className="h-full w-1/2 rounded-full bg-brass"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { profile, saveUserPreferences } = useAuth();
  const { loading, settings, useLocal, notifications, schedules, songs, markNotificationRead, markAllNotificationsRead } = useMusicData();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarStorageKey) === "true");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const activeScrollPath = useRef(location.pathname);
  const restoringRouteScroll = useRef(false);
  const [foregroundPushes, setForegroundPushes] = useState([]);
  const [availableUpdate, setAvailableUpdate] = useState(null);
  const [updateHidden, setUpdateHidden] = useState(false);
  const [routeLeaving, setRouteLeaving] = useState(false);
  const routeTransitionActive = useRef(false);
  const seenInternalNotifications = useRef(new Set());
  const initializedInternalNotifications = useRef(false);
  const refreshedPushRegistration = useRef(false);
  const pageTitle = location.pathname === "/inteligente" ? "Programación" : pageNames[location.pathname] || "Roca Eterna Música";
  const viewerSchedulePath = "/servicios";
  const themeMode = profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system";
  const effectiveTheme = getEffectiveThemeMode(themeMode);
  const logoSrc = getInstitutionalLogo(settings, effectiveTheme === "dark" ? appDarkLogo : appLogo, themeMode);
  const logoAlt = settings.logoAltText || "Roca Eterna Música";
  const scheduleIds = useMemo(() => new Set(schedules.map((schedule) => schedule.id)), [schedules]);
  const songIds = useMemo(() => new Set(songs.map((song) => song.id)), [songs]);
  const targetedNotifications = useMemo(() => notifications.filter((item) => {
    if (isObsoleteTestScheduleNotification(item)) return false;
    if (!isMessageForProfile(item, profile)) return false;
    const targetUsers = item.targetUsers || [];
    const targetRoles = item.targetRoles || [];
    const targetViewerTypes = item.targetViewerTypes || [];
    if (targetUsers.length) return targetUsers.includes(profile?.uid);
    if (targetRoles.length && !targetRoles.includes(profile?.role)) return false;
    if (profile?.role === "viewer" && targetViewerTypes.length) return targetViewerTypes.includes(profile?.viewerType);
    return true;
  }), [notifications, profile?.email, profile?.role, profile?.uid, profile?.viewerType]);
  const isNotificationEntityDeleted = (item) => Boolean(
    item?.deleted
    || item?.relatedEntityDeleted
    || item?.active === false
    || (item?.scheduleId && !scheduleIds.has(item.scheduleId))
    || (item?.songId && !songIds.has(item.songId))
  );
  const activeNotifications = useMemo(
    () => targetedNotifications.filter((item) => !isNotificationEntityDeleted(item)),
    [targetedNotifications, scheduleIds, songIds]
  );
  const unreadNotifications = activeNotifications.filter((item) => !(item.readBy || []).includes(profile?.uid));
  const shellStyle = {
    "--color-brass": hexToRgb(profile?.accentColor || localStorage.getItem("roca-eterna-accent-color") || "#b6945f"),
    "--color-blue-gray": hexToRgb(profile?.blueGrayColor || "#60717d")
  };

  useEffect(() => {
    localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useLayoutEffect(() => {
    const path = location.pathname;
    activeScrollPath.current = path;
    const shouldReset = consumeRouteScrollReset(path);
    const target = shouldReset ? 0 : getRouteScroll(path);
    let cancelled = false;
    let userInterrupted = false;
    let resizeObserver = null;
    const timeoutIds = [];
    restoringRouteScroll.current = true;
    const interruptRestore = () => {
      userInterrupted = true;
      restoringRouteScroll.current = false;
    };
    const restore = () => {
      if (cancelled || userInterrupted) return;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(target, maxScroll), left: 0, behavior: "auto" });
    };

    [0, 60, 140, 280, 520, 900, 1400].forEach((delay) => {
      timeoutIds.push(window.setTimeout(restore, delay));
    });
    timeoutIds.push(window.setTimeout(() => {
      restoringRouteScroll.current = false;
    }, 1450));
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(restore);
      resizeObserver.observe(document.documentElement);
    }
    window.addEventListener("wheel", interruptRestore, { passive: true });
    window.addEventListener("touchstart", interruptRestore, { passive: true });
    window.addEventListener("pointerdown", interruptRestore, { passive: true });
    window.addEventListener("keydown", interruptRestore);

    return () => {
      cancelled = true;
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      resizeObserver?.disconnect();
      window.removeEventListener("wheel", interruptRestore);
      window.removeEventListener("touchstart", interruptRestore);
      window.removeEventListener("pointerdown", interruptRestore);
      window.removeEventListener("keydown", interruptRestore);
      restoringRouteScroll.current = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRouteLeaving(false);
      routeTransitionActive.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  const navigateSection = useCallback(async (event, path) => {
    const currentPath = location.pathname;
    const isCurrentSection = currentPath === path || currentPath.startsWith(`${path}/`);
    if (isCurrentSection) {
      requestRouteScrollReset(path);
      if (currentPath === path) window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      return;
    }

    event?.preventDefault?.();
    if (routeTransitionActive.current) return;
    saveRouteScroll(currentPath, window.scrollY);
    routeTransitionActive.current = true;
    setRouteLeaving(true);

    const minimumFade = reduceMotion
      ? Promise.resolve()
      : new Promise((resolve) => window.setTimeout(resolve, 190));
    await Promise.all([preloadRoutePath(path), minimumFade]);
    navigate(path);
  }, [location.pathname, navigate, reduceMotion]);

  useEffect(() => {
    const saveCurrentScroll = () => saveRouteScroll(activeScrollPath.current, window.scrollY);
    let frame = 0;
    const trackScroll = () => {
      if (frame || routeTransitionActive.current || restoringRouteScroll.current) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        saveCurrentScroll();
      });
    };
    window.addEventListener("pagehide", saveCurrentScroll);
    window.addEventListener("scroll", trackScroll, { passive: true });
    return () => {
      window.removeEventListener("pagehide", saveCurrentScroll);
      window.removeEventListener("scroll", trackScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    let idleId = 0;
    const paths = profile?.role === "viewer"
      ? ["/repertorio", "/servicios", "/configuracion"]
      : ["/programacion", "/repertorio", "/musicos", "/historial", "/estadisticas", "/configuracion"];

    const scheduleNext = (index, delay = 700) => {
      if (cancelled || index >= paths.length) return;
      timeoutId = window.setTimeout(() => {
        const run = async () => {
          if (cancelled) return;
          await preloadRoutePath(paths[index]);
          scheduleNext(index + 1);
        };
        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(run, { timeout: 3000 });
        } else {
          run();
        }
      }, delay);
    };

    timeoutId = window.setTimeout(() => scheduleNext(0, 0), 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if ("cancelIdleCallback" in window && idleId) window.cancelIdleCallback(idleId);
    };
  }, [profile?.role]);

  useEffect(() => {
    if (
      refreshedPushRegistration.current
      || !profile?.uid
      || typeof Notification === "undefined"
      || Notification.permission !== "granted"
    ) return;
    refreshedPushRegistration.current = true;
    enablePushNotificationsForUser(profile).catch((error) => {
      console.warn("[FCM] No se pudo renovar el registro de este dispositivo.", error?.message || error);
      refreshedPushRegistration.current = false;
    });
  }, [profile]);

  useEffect(() => {
    markInstalledVersion(appBuildVersion);
    let cancelled = false;

    const checkVersion = async () => {
      try {
        const latest = await fetchLatestVersion();
        const shouldShow = latest?.version
          && compareVersions(latest.version, appBuildVersion) > 0
          && (!wasUpdateDismissed(latest.version) || latest.critical);
        if (!cancelled) {
          setAvailableUpdate(shouldShow ? { ...latest, installedVersion: appVersion } : null);
          setUpdateHidden(false);
        }
      } catch {
        if (!cancelled) setAvailableUpdate(null);
      }
    };

    checkVersion();
    const interval = window.setInterval(checkVersion, 30 * 60 * 1000);

    const onControllerChange = () => checkVersion();
    navigator.serviceWorker?.addEventListener?.("controllerchange", onControllerChange);

    navigator.serviceWorker?.ready?.then((registration) => {
      if (cancelled) return;
      registration.update?.();
      registration.addEventListener?.("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener?.("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker?.controller) checkVersion();
        });
      });
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      navigator.serviceWorker?.removeEventListener?.("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    if (logoSrc) localStorage.setItem("roca-eterna-logo-src", logoSrc);
    localStorage.setItem("roca-eterna-logo-light-src", getInstitutionalLogo(settings, appLogo, "light"));
    localStorage.setItem("roca-eterna-logo-dark-src", getInstitutionalLogo(settings, appDarkLogo, "dark"));
    if (logoAlt) localStorage.setItem("roca-eterna-logo-alt", logoAlt);
    localStorage.removeItem("roca-eterna-logo-invert");
  }, [logoAlt, logoSrc, settings]);

  const addNovelty = (notification) => {
    const novelty = notificationToNovelty(notification);
    const key = notificationKey(novelty);
    if (!key || isNotificationEntityDeleted(novelty)) return;
    setForegroundPushes((current) => {
      if (current.some((item) => notificationKey(item) === key)) return current;
      return [novelty, ...current.filter((item) => notificationKey(item) !== key)].slice(0, 3);
    });
  };

  useEffect(() => {
    navigator.serviceWorker?.ready
      ?.then((registration) => {
        registration.active?.postMessage({
          type: "roca-eterna-active-profile",
          email: profile?.email || ""
        });
      })
      .catch(() => undefined);
    navigator.serviceWorker?.controller?.postMessage({
      type: "roca-eterna-active-profile",
      email: profile?.email || ""
    });
  }, [profile?.email]);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    const shown = new Map();

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
      if (!isMessageForProfile(message, profile)) return;
      const tag = message.tag || message.notificationId || message.scheduleId || message.songId || `${message.type}-${Math.floor(Date.now() / 10000)}`;
      if (cancelled || shown.has(tag) || (message.notificationId && seenInternalNotifications.current.has(message.notificationId))) return;
      shown.set(tag, Date.now());
      if (message.notificationId) seenInternalNotifications.current.add(message.notificationId);
      setTimeout(() => shown.delete(tag), 15000);
      addNovelty(message);
      window.dispatchEvent(new CustomEvent("roca-eterna-foreground-push", { detail: message }));

      if (!message.hasNotificationPayload && "Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification(message.title, {
            body: message.body,
            icon: message.icon,
            badge: message.badge,
            tag,
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
  }, [navigate, profile?.email]);

  useEffect(() => {
    const handleInternalNotification = (event) => {
      const notification = event.detail;
      if (!isMessageForProfile(notification, profile)) return;
      const id = notification?.id || notification?.pushNotificationId;
      if (
        !id
        || !noveltyTypes.has(notification?.type)
        || seenInternalNotifications.current.has(id)
        || (notification?.pushNotificationId && seenInternalNotifications.current.has(notification.pushNotificationId))
      ) return;
      seenInternalNotifications.current.add(id);
      if (notification?.pushNotificationId) seenInternalNotifications.current.add(notification.pushNotificationId);
      addNovelty(notification);
    };
    window.addEventListener("roca-eterna-internal-notification", handleInternalNotification);
    return () => window.removeEventListener("roca-eterna-internal-notification", handleInternalNotification);
  }, [profile?.email]);

  useEffect(() => {
    const visibleIds = activeNotifications.map((item) => item.id).filter(Boolean);
    if (!initializedInternalNotifications.current) {
      visibleIds.forEach((id) => seenInternalNotifications.current.add(id));
      initializedInternalNotifications.current = true;
      return;
    }

    const newNotifications = activeNotifications.filter((item) => {
      if (!item?.id || seenInternalNotifications.current.has(item.id) || (item.pushNotificationId && seenInternalNotifications.current.has(item.pushNotificationId))) return false;
      if (!noveltyTypes.has(item.type)) return false;
      if ((item.readBy || []).includes(profile?.uid)) return false;
      return true;
    });

    newNotifications.slice(0, 3).forEach((nextNotification) => {
      seenInternalNotifications.current.add(nextNotification.id);
      if (nextNotification.pushNotificationId) seenInternalNotifications.current.add(nextNotification.pushNotificationId);
      addNovelty(nextNotification);
    });
  }, [profile?.uid, activeNotifications]);

  useEffect(() => {
    setForegroundPushes((current) => current.filter((item) => !isNotificationEntityDeleted(item)));
  }, [scheduleIds, songIds]);

  useEffect(() => {
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type !== "roca-eterna-background-push") return;
      const message = {
        ...(event.data.payload || {}),
        receivedAt: new Date().toISOString()
      };
      if (!isMessageForProfile(message, profile)) return;
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
  }, [profile?.email]);

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
    if (isNotificationEntityDeleted(notification)) {
      alert(notification.scheduleId ? "Esta programación ya fue eliminada." : notification.songId ? "Este canto ya fue eliminado." : "Esta novedad ya no está activa.");
      return;
    }
    if (notification.scheduleId) navigate(profile?.role === "viewer" ? `${viewerSchedulePath}?schedule=${notification.scheduleId}` : `/programacion?schedule=${notification.scheduleId}`);
    if (notification.songId) navigate(`/repertorio/${notification.songId}`);
  };

  const openNovelty = (novelty) => {
    if (!novelty) return;
    const url = novelty.url || "";
    setForegroundPushes((current) => current.filter((item) => notificationKey(item) !== notificationKey(novelty)));
    if (novelty.source === "internal" && novelty.id) {
      markNotificationRead(novelty.id).catch(() => undefined);
    }
    if (isNotificationEntityDeleted(novelty)) {
      alert(novelty.scheduleId ? "Esta programación ya fue eliminada." : novelty.songId ? "Este canto ya fue eliminado." : "Esta novedad ya no está activa.");
      return;
    }
    if (novelty.scheduleId) {
      navigate(profile?.role === "viewer" ? `${viewerSchedulePath}?schedule=${novelty.scheduleId}` : `/programacion?schedule=${novelty.scheduleId}`);
    } else if (novelty.songId) {
      navigate(`/repertorio/${novelty.songId}`);
    } else if (url.startsWith("/#/")) {
      navigate(url.replace("/#", ""));
    } else if (url.startsWith("#/")) {
      navigate(url.replace("#", ""));
    }
  };

  const dismissNovelty = (novelty) => {
    setForegroundPushes((current) => current.filter((item) => notificationKey(item) !== notificationKey(novelty)));
    if (novelty?.source === "internal" && novelty.id) markNotificationRead(novelty.id).catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-stonewash text-ink" style={shellStyle}>
      <Sidebar
        profile={profile}
        collapsed={sidebarCollapsed}
        logoSrc={logoSrc}
        logoAlt={logoAlt}
        logoMode={effectiveTheme}
        onNavigate={navigateSection}
      />
      <main className={`app-main min-w-0 overflow-x-hidden pb-[calc(8rem+env(safe-area-inset-bottom))] transition-all duration-200 lg:pb-0 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <header className="app-header sticky top-0 z-30 border-b border-ink/10 bg-stonewash/86 px-3 py-3 backdrop-blur md:px-8 md:py-4">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
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
            <div className="flex shrink-0 items-center justify-end gap-2 max-sm:w-full">
              {useLocal ? (
                <span className="hidden rounded-full bg-brass/12 px-3 py-1 text-xs font-semibold text-brass sm:inline-flex">
                  Modo demo
                </span>
              ) : null}
              <div className="relative">
                <Button variant="subtle" className="h-11 w-11 !p-0" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Notificaciones">
                  <Bell className="h-6 w-6 shrink-0 stroke-[2.2]" />
                  {unreadNotifications.length ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brass px-1 text-[10px] font-bold text-white">
                      {unreadNotifications.length}
                    </span>
                  ) : null}
                </Button>
              </div>
              </div>
            </div>
        </header>

        <NotificationsPortal
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          unreadCount={unreadNotifications.length}
          notifications={targetedNotifications}
          profile={profile}
          onOpenNotification={openNotification}
          onMarkAllRead={markAllNotificationsRead}
          isNotificationEntityDeleted={isNotificationEntityDeleted}
        />

        <div className="mx-auto max-w-7xl min-w-0 px-4 py-5 md:px-8 md:py-6">
          {availableUpdate && !updateHidden ? (
            <motion.div
              className="mb-4 rounded-3xl border border-brass/35 bg-white p-4 shadow-soft dark:bg-zinc-900"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-brass">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-xs font-bold uppercase tracking-wide">Actualización disponible</p>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-ink">Hay una nueva versión de Roca Eterna Música.</h2>
                  <p className="mt-1 text-sm leading-6 text-ink/60">Actualiza para ver los cambios más recientes.</p>
                  <ul className="mt-3 space-y-1 text-sm text-ink/70">
                    {(availableUpdate.changes || []).slice(0, 3).map((change) => <li key={change}>- {change}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-ink/45">
                    Instalada: {appVersion} · Disponible: {availableUpdate.displayVersion || appVersion}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Button onClick={() => activateLatestAppVersion(availableUpdate.version)}>
                    <RefreshCw className="h-4 w-4" />
                    Actualizar ahora
                  </Button>
                  {profile?.role === "admin" || profile?.role === "editor" ? (
                    <Button variant="secondary" onClick={() => navigate("/actualizaciones")}>Ver cambios</Button>
                  ) : null}
                  {!availableUpdate.critical ? (
                    <Button
                      variant="subtle"
                      onClick={() => {
                        dismissUpdate(availableUpdate.version);
                        setUpdateHidden(true);
                      }}
                    >
                      Después
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : null}
          {foregroundPushes.length ? (
            <motion.div
              className="mb-4 w-full rounded-3xl border border-brass/35 bg-brass/12 p-4 text-left shadow-[0_0_28px_rgba(182,148,95,0.18)]"
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24 }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brass">Novedades</p>
                {activeNotifications.length > 3 ? (
                  <Button variant="subtle" className="h-9 px-3 text-xs" onClick={() => setNotificationsOpen(true)}>Ver todas</Button>
                ) : null}
              </div>
              <div className="grid gap-2">
                {foregroundPushes.slice(0, 3).map((novelty) => (
                  <div key={notificationKey(novelty)} className="grid gap-3 rounded-2xl bg-white/80 p-3 shadow-soft dark:bg-white/10 sm:grid-cols-[2.75rem_1fr_auto] sm:items-center">
                    <button type="button" onClick={() => openNovelty(novelty)} className="contents text-left">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brass text-white shadow-soft">
                        {novelty.type === "new_song" ? <Music2 className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-ink">{novelty.title}</span>
                        {novelty.body ? <span className="mt-1 block text-sm text-ink/65">{novelty.body}</span> : null}
                        <span className="mt-1 block text-xs text-ink/45">{relativeTime(novelty.receivedAt)}</span>
                      </span>
                    </button>
                    <div className="flex gap-2 sm:justify-end">
                      <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => openNovelty(novelty)}>Abrir</Button>
                      <Button variant="subtle" className="h-9 px-3 text-xs" onClick={() => dismissNovelty(novelty)}>Cerrar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
          <motion.div
            key={location.pathname}
            className="route-content min-w-0 transform-gpu will-change-[transform,opacity]"
            initial={reduceMotion ? false : { opacity: 0, y: 5 }}
            animate={routeLeaving ? { opacity: 0.12, y: -4 } : { opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : routeLeaving ? 0.19 : 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <ErrorBoundary resetKey={location.pathname}>
              {loading ? (
                <RouteFallback />
              ) : (
                <Suspense fallback={<RouteFallback />}>
                  <Outlet />
                </Suspense>
              )}
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>
      <BottomNav onNavigate={navigateSection} />
    </div>
  );
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "182 148 95";
  return `${parseInt(normalized.slice(0, 2), 16)} ${parseInt(normalized.slice(2, 4), 16)} ${parseInt(normalized.slice(4, 6), 16)}`;
}
