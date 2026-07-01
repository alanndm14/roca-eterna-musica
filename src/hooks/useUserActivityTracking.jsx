import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { auth, isFirebaseConfigured } from "../lib/firebase";
import { activityApiUrl, authenticatedHeaders } from "../services/userActivityApi";

const sessionKey = "roca-eterna-activity-session-id";
const pendingKey = "roca-eterna-pending-activity-events";
const maxPendingEvents = 40;

const sectionLabels = {
  "/": "Inicio",
  "/repertorio": "Repertorio",
  "/programacion": "Programación",
  "/musicos": "Servicios",
  "/servicios": "Servicios",
  "/historial": "Historial",
  "/estadisticas": "Estadísticas",
  "/configuracion": "Configuración",
  "/auditoria": "Auditoría",
  "/actualizaciones": "Actualizaciones"
};

function getSessionId() {
  try {
    const existing = sessionStorage.getItem(sessionKey);
    if (existing) return existing;
    const next = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(sessionKey, next);
    return next;
  } catch {
    return `session-${Date.now()}`;
  }
}

function sectionFromPath(pathname = "/") {
  if (pathname.startsWith("/repertorio/")) return "Detalle de canto";
  return sectionLabels[pathname] || pathname.replace("/", "") || "Inicio";
}

function cleanLabel(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function shouldTrack(profile) {
  const email = String(profile?.email || "").toLowerCase();
  return Boolean(isFirebaseConfigured && auth?.currentUser && profile?.uid && email && profile.uid !== "demo-admin" && activityApiUrl("logUserActivity"));
}

function savePendingEvent(payload = {}) {
  try {
    const current = JSON.parse(localStorage.getItem(pendingKey) || "[]");
    current.push(payload);
    localStorage.setItem(pendingKey, JSON.stringify(current.slice(-maxPendingEvents)));
  } catch {
    // La actividad no debe afectar el uso normal de la app.
  }
}

function readPendingEvents() {
  try {
    const current = JSON.parse(localStorage.getItem(pendingKey) || "[]");
    localStorage.removeItem(pendingKey);
    return Array.isArray(current) ? current : [];
  } catch {
    return [];
  }
}

async function postActivity(profile, payload = {}) {
  if (!shouldTrack(profile)) return;
  const endpoint = activityApiUrl("logUserActivity");
  const body = {
    sessionId: getSessionId(),
    clientTimestamp: new Date().toISOString(),
    userAgent: navigator.userAgent || "",
    ...payload
  };
  try {
    const headers = await authenticatedHeaders();
    if (!headers) return;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true
    });
    if (!response.ok) savePendingEvent(body);
  } catch {
    savePendingEvent(body);
  }
}

async function flushPendingEvents(profile) {
  if (!shouldTrack(profile)) return;
  const pending = readPendingEvents();
  if (!pending.length) return;
  for (const event of pending.slice(-12)) {
    await postActivity(profile, event);
  }
}

export function useUserActivityTracking(profile) {
  const location = useLocation();
  const activeViewRef = useRef(null);
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!shouldTrack(profile)) return undefined;
    flushPendingEvents(profile).catch(() => undefined);
    postActivity(profile, {
      eventType: "section_view",
      section: sectionFromPath(location.pathname),
      route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
      reason: "enter",
      startedAt: new Date().toISOString(),
      endedAt: "",
      durationMs: 0
    }).catch(() => undefined);
    return undefined;
  }, [profile?.uid]);

  useEffect(() => {
    if (!shouldTrack(profile)) return undefined;

    const closeActiveView = (reason = "route_change") => {
      const current = activeViewRef.current;
      if (!current) return;
      activeViewRef.current = null;
      const endedAt = Date.now();
      const durationMs = Math.max(0, endedAt - current.startedAt);
      postActivity(profileRef.current, {
        eventType: "section_view",
        section: current.section,
        route: current.route,
        reason,
        startedAt: new Date(current.startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs
      }).catch(() => undefined);
    };

    closeActiveView("route_change");
    activeViewRef.current = {
      section: sectionFromPath(location.pathname),
      route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
      startedAt: Date.now()
    };

    return () => closeActiveView("route_change");
  }, [location.pathname, location.search, location.hash, profile?.uid]);

  useEffect(() => {
    if (!shouldTrack(profile)) return undefined;

    const handleClick = (event) => {
      const target = event.target?.closest?.("button,a,[role='button']");
      if (!target) return;
      const label = cleanLabel(target.getAttribute("aria-label") || target.innerText || target.textContent || target.title || target.href);
      if (!label) return;
      postActivity(profileRef.current, {
        eventType: "click",
        section: activeViewRef.current?.section || sectionFromPath(location.pathname),
        route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
        targetLabel: label,
        targetTag: target.tagName?.toLowerCase?.() || "",
        targetRole: target.getAttribute("role") || "",
        targetHref: target.getAttribute("href") || "",
        durationMs: 0
      }).catch(() => undefined);
    };

    const handleDisconnect = () => {
      const current = activeViewRef.current;
      const endedAt = Date.now();
      const durationMs = current ? Math.max(0, endedAt - current.startedAt) : 0;
      activeViewRef.current = null;
      const payload = {
        eventType: "disconnect",
        section: current?.section || sectionFromPath(location.pathname),
        route: current?.route || `${location.pathname}${location.search || ""}${location.hash || ""}`,
        reason: document.visibilityState === "hidden" ? "hidden" : "pagehide",
        startedAt: current ? new Date(current.startedAt).toISOString() : "",
        endedAt: new Date(endedAt).toISOString(),
        durationMs
      };
      postActivity(profileRef.current, payload).catch(() => savePendingEvent(payload));
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        handleDisconnect();
      } else if (!activeViewRef.current) {
        activeViewRef.current = {
          section: sectionFromPath(location.pathname),
          route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
          startedAt: Date.now()
        };
        flushPendingEvents(profileRef.current).catch(() => undefined);
      }
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleDisconnect);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleDisconnect);
    };
  }, [location.pathname, location.search, location.hash, profile?.uid]);
}
