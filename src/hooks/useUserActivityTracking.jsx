import { useEffect, useRef } from "react";
import { auth, isFirebaseConfigured } from "../lib/firebase";
import { activityApiUrl, authenticatedHeaders } from "../services/userActivityApi";

const sessionKey = "roca-eterna-activity-session-id";
const pendingKey = "roca-eterna-pending-activity-events";
const backoffKey = "roca-eterna-activity-backoff-until";
const maxPendingEvents = 6;
const retryBackoffMs = 5 * 60 * 1000;

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

function makeDisconnectEventId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${getSessionId()}-disconnect-${Date.now()}-${randomPart}`;
}

function buildActivityBody(payload = {}) {
  return {
    eventId: payload.eventId || makeDisconnectEventId(),
    sessionId: payload.sessionId || getSessionId(),
    clientTimestamp: payload.clientTimestamp || new Date().toISOString(),
    userAgent: payload.userAgent || navigator.userAgent || "",
    eventType: "disconnect",
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
  for (const event of pending.slice(-3)) {
    await postActivity(profile, event);
  }
}

export function useUserActivityTracking(profile) {
  const profileRef = useRef(profile);
  const cachedHeadersRef = useRef(null);
  const disconnectSentRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());

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
    sessionStartedAtRef.current = Date.now();
    disconnectSentRef.current = false;
    flushPendingEvents(profile).catch(() => undefined);
    return undefined;
  }, [profile?.uid]);

  useEffect(() => {
    if (!shouldTrack(profile)) return undefined;

    const handleDisconnect = (reason = "") => {
      if (disconnectSentRef.current) return;
      disconnectSentRef.current = true;
      const endedAt = Date.now();
      const durationMs = Math.max(0, endedAt - sessionStartedAtRef.current);
      const payload = {
        eventId: makeDisconnectEventId(),
        eventType: "disconnect",
        reason: reason || (document.visibilityState === "hidden" ? "hidden" : "pagehide"),
        startedAt: new Date(sessionStartedAtRef.current).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs
      };
      postActivityFast(profileRef.current, payload, cachedHeadersRef.current);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        handleDisconnect("hidden");
      } else {
        disconnectSentRef.current = false;
        sessionStartedAtRef.current = Date.now();
        flushPendingEvents(profileRef.current).catch(() => undefined);
      }
    };

    const handleForcedDisconnect = () => handleDisconnect("signout");
    const handleBeforeUnload = () => handleDisconnect("beforeunload");
    const handlePageHide = () => handleDisconnect("pagehide");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("roca-eterna-force-disconnect", handleForcedDisconnect);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("roca-eterna-force-disconnect", handleForcedDisconnect);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [profile?.uid]);
}
