import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { auth, isFirebaseConfigured } from "../lib/firebase";
import { activityApiUrl, authenticatedHeaders } from "../services/userActivityApi";

const sessionKey = "roca-eterna-activity-session-id";
const pendingKey = "roca-eterna-pending-activity-events";
const currentSessionKey = "roca-eterna-current-activity-session";
const backoffKey = "roca-eterna-activity-backoff-until";
const maxPendingEvents = 40;
const retryBackoffMs = 5 * 60 * 1000;

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

function makeEventId(eventType = "event") {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${getSessionId()}-${eventType}-${Date.now()}-${randomPart}`;
}

function buildActivityBody(payload = {}) {
  return {
    eventId: payload.eventId || makeEventId(payload.eventType || "event"),
    sessionId: payload.sessionId || getSessionId(),
    clientTimestamp: payload.clientTimestamp || new Date().toISOString(),
    userAgent: payload.userAgent || navigator.userAgent || "",
    ...payload
  };
}

function shouldTrack(profile) {
  const email = String(profile?.email || "").toLowerCase();
  return Boolean(isFirebaseConfigured && auth?.currentUser && profile?.uid && email && profile.uid !== "demo-admin" && activityApiUrl("logUserActivity"));
}

function isBackedOff() {
  try {
    return Date.now() < Number(localStorage.getItem(backoffKey) || 0);
  } catch {
    return false;
  }
}

function setBackoff() {
  try {
    localStorage.setItem(backoffKey, String(Date.now() + retryBackoffMs));
  } catch {
    // La actividad no debe afectar el uso normal de la app.
  }
}

function clearBackoff() {
  try {
    localStorage.removeItem(backoffKey);
  } catch {
    // La actividad no debe afectar el uso normal de la app.
  }
}

function savePendingEvent(payload = {}) {
  try {
    const current = JSON.parse(localStorage.getItem(pendingKey) || "[]");
    const nextEvent = buildActivityBody(payload);
    const deduped = current.filter((event) => event.eventId !== nextEvent.eventId);
    deduped.push(nextEvent);
    localStorage.setItem(pendingKey, JSON.stringify(deduped.slice(-maxPendingEvents)));
  } catch {
    // La actividad no debe afectar el uso normal de la app.
  }
}

function removePendingEvent(eventId = "") {
  if (!eventId) return;
  try {
    const current = JSON.parse(localStorage.getItem(pendingKey) || "[]");
    localStorage.setItem(pendingKey, JSON.stringify(current.filter((event) => event.eventId !== eventId)));
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

function rememberSessionState(payload = {}) {
  try {
    localStorage.setItem(currentSessionKey, JSON.stringify({
      sessionId: getSessionId(),
      lastSeenAt: new Date().toISOString(),
      disconnected: false,
      ...payload
    }));
  } catch {
    // La actividad no debe afectar el uso normal de la app.
  }
}

function markSessionDisconnectPending(payload = {}) {
  try {
    const current = JSON.parse(localStorage.getItem(currentSessionKey) || "{}");
    localStorage.setItem(currentSessionKey, JSON.stringify({
      ...current,
      disconnected: false,
      disconnectPending: true,
      pendingDisconnectEventId: payload.eventId || "",
      disconnectedAt: payload.endedAt || new Date().toISOString()
    }));
  } catch {
    // La actividad no debe afectar el uso normal de la app.
  }
}

function readPreviousOpenSession() {
  try {
    const current = JSON.parse(localStorage.getItem(currentSessionKey) || "null");
    if (current?.disconnectPending) return null;
    if (!current || current.disconnected || current.sessionId === getSessionId()) return null;
    return current;
  } catch {
    return null;
  }
}

async function postActivity(profile, payload = {}, headersOverride = null) {
  if (!shouldTrack(profile)) return;
  const endpoint = activityApiUrl("logUserActivity");
  const body = buildActivityBody(payload);
  if (isBackedOff()) {
    savePendingEvent(body);
    return;
  }
  try {
    const headers = headersOverride || await authenticatedHeaders();
    if (!headers) {
      savePendingEvent(body);
      return;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true
    });
    if (response.ok) {
      clearBackoff();
      removePendingEvent(body.eventId);
    } else {
      if (response.status === 429 || response.status >= 500) setBackoff();
      savePendingEvent(body);
    }
  } catch {
    savePendingEvent(body);
  }
}

function postActivityFast(profile, payload = {}, headers = null) {
  const body = buildActivityBody(payload);
  if (body.eventType === "disconnect") savePendingEvent(body);
  if (!shouldTrack(profile) || !headers || isBackedOff()) {
    savePendingEvent(body);
    return;
  }
  const endpoint = activityApiUrl("logUserActivity");
  fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    keepalive: true
  })
    .then((response) => {
      if (response.ok) {
        clearBackoff();
        removePendingEvent(body.eventId);
      } else {
        if (response.status === 429 || response.status >= 500) setBackoff();
        savePendingEvent(body);
      }
    })
    .catch(() => savePendingEvent(body));
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
  const cachedHeadersRef = useRef(null);
  const disconnectSentRef = useRef(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!shouldTrack(profile)) return undefined;
    let cancelled = false;
    const refreshHeaders = () => {
      authenticatedHeaders()
        .then((headers) => {
          if (!cancelled && headers) cachedHeadersRef.current = headers;
        })
        .catch(() => undefined);
    };
    refreshHeaders();
    const interval = window.setInterval(refreshHeaders, 4 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [profile?.uid]);

  useEffect(() => {
    if (!shouldTrack(profile)) return undefined;
    const previous = readPreviousOpenSession();
    if (previous) {
      postActivity(profile, {
        eventType: "disconnect",
        section: previous.section || "Inicio",
        route: previous.route || "/",
        reason: "previous_session_closed",
        startedAt: previous.startedAt || "",
        endedAt: previous.lastSeenAt || new Date().toISOString(),
        durationMs: previous.startedAt && previous.lastSeenAt
          ? Math.max(0, new Date(previous.lastSeenAt).getTime() - new Date(previous.startedAt).getTime())
          : 0
      }).catch(() => undefined);
    }
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
    rememberSessionState({
      section: sectionFromPath(location.pathname),
      route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
      startedAt: new Date().toISOString()
    });
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
    disconnectSentRef.current = false;
    activeViewRef.current = {
      section: sectionFromPath(location.pathname),
      route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
      startedAt: Date.now()
    };
    rememberSessionState({
      section: activeViewRef.current.section,
      route: activeViewRef.current.route,
      startedAt: new Date(activeViewRef.current.startedAt).toISOString()
    });

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
      if (disconnectSentRef.current) return;
      disconnectSentRef.current = true;
      const current = activeViewRef.current;
      const endedAt = Date.now();
      const durationMs = current ? Math.max(0, endedAt - current.startedAt) : 0;
      activeViewRef.current = null;
      const payload = {
        eventId: makeEventId("disconnect"),
        eventType: "disconnect",
        section: current?.section || sectionFromPath(location.pathname),
        route: current?.route || `${location.pathname}${location.search || ""}${location.hash || ""}`,
        reason: document.visibilityState === "hidden" ? "hidden" : "pagehide",
        startedAt: current ? new Date(current.startedAt).toISOString() : "",
        endedAt: new Date(endedAt).toISOString(),
        durationMs
      };
      markSessionDisconnectPending(payload);
      postActivityFast(profileRef.current, payload, cachedHeadersRef.current);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        handleDisconnect();
      } else if (!activeViewRef.current) {
        disconnectSentRef.current = false;
        activeViewRef.current = {
          section: sectionFromPath(location.pathname),
          route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
          startedAt: Date.now()
        };
        rememberSessionState({
          section: activeViewRef.current.section,
          route: activeViewRef.current.route,
          startedAt: new Date(activeViewRef.current.startedAt).toISOString()
        });
        flushPendingEvents(profileRef.current).catch(() => undefined);
      }
    };

    const rememberHeartbeat = () => {
      const current = activeViewRef.current;
      rememberSessionState({
        section: current?.section || sectionFromPath(location.pathname),
        route: current?.route || `${location.pathname}${location.search || ""}${location.hash || ""}`,
        startedAt: current ? new Date(current.startedAt).toISOString() : new Date().toISOString()
      });
    };

    const heartbeat = window.setInterval(rememberHeartbeat, 15000);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("roca-eterna-force-disconnect", handleDisconnect);
    window.addEventListener("beforeunload", handleDisconnect);
    window.addEventListener("pagehide", handleDisconnect);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("roca-eterna-force-disconnect", handleDisconnect);
      window.removeEventListener("beforeunload", handleDisconnect);
      window.removeEventListener("pagehide", handleDisconnect);
    };
  }, [location.pathname, location.search, location.hash, profile?.uid]);
}
