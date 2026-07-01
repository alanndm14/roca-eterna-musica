import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";

const ownerEmail = "liquea45@gmail.com";
const sessionKey = "roca-eterna-activity-session-id";

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
  return Boolean(isFirebaseConfigured && db && profile?.uid && email && email !== ownerEmail && profile.uid !== "demo-admin");
}

async function saveActivity(profile, payload = {}, durationMs = 0) {
  if (!shouldTrack(profile)) return;
  const email = String(profile.email || "").toLowerCase();
  const basePayload = {
    uid: profile.uid,
    email,
    displayName: profile.preferredDisplayName || profile.displayName || email,
    role: profile.role || "",
    viewerType: profile.viewerType || "",
    sessionId: getSessionId(),
    createdAt: serverTimestamp(),
    clientTimestamp: new Date().toISOString(),
    userAgent: navigator.userAgent || "",
    ...payload
  };

  await addDoc(collection(db, "userActivity"), basePayload);

  const userUpdate = {
    lastActivityAt: serverTimestamp(),
    lastActivitySection: payload.section || ""
  };
  if (durationMs > 0) userUpdate.activityTotalMs = increment(Math.max(0, Math.round(durationMs)));
  if (payload.eventType === "disconnect") userUpdate.lastDisconnectedAt = serverTimestamp();
  await updateDoc(doc(db, "users", profile.uid), userUpdate);
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

    const closeActiveView = (reason = "route_change") => {
      const current = activeViewRef.current;
      if (!current) return;
      activeViewRef.current = null;
      const endedAt = Date.now();
      const durationMs = Math.max(0, endedAt - current.startedAt);
      saveActivity(profileRef.current, {
        eventType: "section_view",
        section: current.section,
        route: current.route,
        reason,
        startedAt: new Date(current.startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        durationMs
      }, durationMs).catch(() => undefined);
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
      saveActivity(profileRef.current, {
        eventType: "click",
        section: activeViewRef.current?.section || sectionFromPath(location.pathname),
        route: `${location.pathname}${location.search || ""}${location.hash || ""}`,
        targetLabel: label,
        targetTag: target.tagName?.toLowerCase?.() || "",
        targetRole: target.getAttribute("role") || "",
        targetHref: target.getAttribute("href") || ""
      }).catch(() => undefined);
    };

    const handleDisconnect = () => {
      const current = activeViewRef.current;
      const endedAt = Date.now();
      const durationMs = current ? Math.max(0, endedAt - current.startedAt) : 0;
      activeViewRef.current = null;
      saveActivity(profileRef.current, {
        eventType: "disconnect",
        section: current?.section || sectionFromPath(location.pathname),
        route: current?.route || `${location.pathname}${location.search || ""}${location.hash || ""}`,
        reason: document.visibilityState === "hidden" ? "hidden" : "pagehide",
        startedAt: current ? new Date(current.startedAt).toISOString() : "",
        endedAt: new Date(endedAt).toISOString(),
        durationMs
      }, durationMs).catch(() => undefined);
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
