import { useEffect, useMemo, useState } from "react";
import { Activity, BellRing, Clock, Database, Download, FileSearch, HelpCircle, Image as ImageIcon, LogOut, MousePointerClick, Palette, Save, Tags, Trash2, Upload, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { FileDiagnosticPanel } from "../components/ui/FileDiagnosticPanel";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { analyzeImport, parseSongsTable } from "../services/importSongs";
import { canonicalThemeKey, collectSongThemes, getInstitutionalLogo, getSongCategoryOptions, normalizeThemeName, resolveAppLogoForNotification, resolvePublicAssetUrl } from "../services/songUtils";
import { diagnosePublicAsset } from "../services/publicPdfTools";
import { getLastPushResult, isPushBackendConfigured, sendExternalPush } from "../services/externalPush";
import { cleanupCurrentUserFcmTokens, diagnosePushNotifications, disablePushNotificationsForUser, enablePushNotificationsForUser, getCurrentPushTokenForUser, getLastBackgroundPush, getLastForegroundPush, reinstallMessagingServiceWorker, requestSiteNotificationPermissionOnly, testLocalNotification } from "../services/pushNotifications";
import { appDarkLogo, appLogo, fallbackAppLogo } from "../assets/logo";
import { activateLatestAppVersion, compareVersions, fetchLatestVersion } from "../services/appUpdate";
import { appBuildVersion, appVersion } from "../data/changelog";
import { AndroidNotificationPermissionWizard } from "../components/notifications/AndroidNotificationPermissionWizard";
import { DailyVerseSettings } from "../components/settings/DailyVerseSettings";
import { EditableServiceOptions, EditableTextOptions } from "../components/settings/EditableOptionsList";
import { isAndroidDevice } from "../services/notificationDevice";
import { defaultServiceTypeOptions, defaultWorshipLeaderOptions, normalizeServiceTypeOption } from "../services/serviceOptions";

const defaultColors = {
  accentColor: "#b6945f",
  blueGrayColor: "#60717d"
};

const formatAccessDate = (value) => {
  if (!value) return "Sin conexión registrada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin conexión registrada" : date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

const activityOwnerEmail = "liquea45@gmail.com";

const resolveDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatExactDate = (value, fallback = "Sin registro") => {
  const date = resolveDateValue(value);
  if (!date) return fallback;
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

const formatDuration = (milliseconds = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min ${seconds} s`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
};

const activityTimestamp = (activity) => {
  const date = resolveDateValue(activity?.createdAt) || resolveDateValue(activity?.clientTimestamp);
  return date?.getTime() || 0;
};

const activityDateKey = (activity) => {
  const timestamp = activityTimestamp(activity);
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatActivityDay = (dateKey = "") => {
  if (!dateKey) return "Sin fecha";
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const activityTypeLabel = (type) => {
  if (type === "click") return "Clic";
  if (type === "section_view") return "Vista";
  if (type === "disconnect") return "Desconexión";
  return type || "Actividad";
};

const boolLabel = (value) => (value === true ? "si" : value === false ? "no" : "sin confirmar");
const permissionLabel = (value) => {
  if (value === "granted") return "concedido";
  if (value === "denied") return "bloqueado";
  if (value === "default") return "pendiente";
  return value || "sin revisar";
};
const yesNoLabel = (value) => (value ? "si" : "no");

export function Settings() {
  const { profile, isAdmin, isFullAdmin, canManageAccess, signOut, saveUserPreferences } = useAuth();
  const isEditor = profile?.role === "editor";
  const isViewer = profile?.role === "viewer";
  const {
    settings,
    songs,
    users,
    themes,
    authorizedEmails,
    saveSettings,
    saveUser,
    saveTheme,
    mergeTheme,
    importSongs,
    removeUserAccess,
    renameSongCategories,
    indexLocalPdfTexts,
    userActivity,
    logAuditEvent,
    seedExampleData
  } = useMusicData();
  const [localSettings, setLocalSettings] = useState(() => ({
    ...settings,
    worshipLeaderOptions: Array.isArray(settings?.worshipLeaderOptions) ? settings.worshipLeaderOptions : defaultWorshipLeaderOptions,
    serviceTypeOptions: Array.isArray(settings?.serviceTypeOptions) ? settings.serviceTypeOptions : defaultServiceTypeOptions,
    songCategoryOptions: getSongCategoryOptions(settings)
  }));
  const [personalSettings, setPersonalSettings] = useState({
    preferredDisplayName: profile?.preferredDisplayName || "",
    themeMode: profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system",
    accentColor: profile?.accentColor || localStorage.getItem("roca-eterna-accent-color") || defaultColors.accentColor,
    blueGrayColor: profile?.blueGrayColor || defaultColors.blueGrayColor
  });
  const [newUser, setNewUser] = useState({ email: "", displayName: "", role: "viewer", viewerType: "corista", active: true });
  const [newTheme, setNewTheme] = useState("");
  const [themeQuery, setThemeQuery] = useState("");
  const [themeFilter, setThemeFilter] = useState("all");
  const [showThemes, setShowThemes] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const [mergeThemeSource, setMergeThemeSource] = useState(null);
  const [mergeThemeTarget, setMergeThemeTarget] = useState("");
  const [importText, setImportText] = useState("");
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState("skip");
  const [importResult, setImportResult] = useState(null);
  const [pdfIndexResult, setPdfIndexResult] = useState(null);
  const [isIndexingPdfs, setIsIndexingPdfs] = useState(false);
  const [pdfIndexProgress, setPdfIndexProgress] = useState(null);
  const [enablePdfOcr, setEnablePdfOcr] = useState(false);
  const [forcePdfReindex, setForcePdfReindex] = useState(false);
  const [logoTest, setLogoTest] = useState(null);
  const [pushStatus, setPushStatus] = useState("");
  const [pushDiagnostic, setPushDiagnostic] = useState(null);
  const [pushTestResult, setPushTestResult] = useState(() => getLastPushResult("test"));
  const [pushAutoResult, setPushAutoResult] = useState(() => getLastPushResult("auto"));
  const [foregroundPushResult, setForegroundPushResult] = useState(() => getLastForegroundPush());
  const [backgroundPushResult, setBackgroundPushResult] = useState(() => getLastBackgroundPush());
  const [localNotificationResult, setLocalNotificationResult] = useState(null);
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [showNotificationWizard, setShowNotificationWizard] = useState(false);
  const [showAdvancedPushDiagnostics, setShowAdvancedPushDiagnostics] = useState(false);
  const [activityUser, setActivityUser] = useState(null);
  const [activityDayFilter, setActivityDayFilter] = useState("all");
  const [activitySectionFilter, setActivitySectionFilter] = useState("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [pushCooldownUntil, setPushCooldownUntil] = useState(0);
  const [pushCooldownNow, setPushCooldownNow] = useState(Date.now());
  const [tokenCleanupResult, setTokenCleanupResult] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [installStatus, setInstallStatus] = useState("");
  const [settingsSaveStatus, setSettingsSaveStatus] = useState("");
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
  });
  const parsedImport = useMemo(() => parseSongsTable(importText, localSettings.keyPreference || "sharps"), [importText, localSettings.keyPreference]);
  const importSummary = useMemo(() => analyzeImport(parsedImport.songs, songs), [parsedImport.songs, songs]);
  const pushSummary = useMemo(() => {
    const browserPermission = pushDiagnostic?.browserPermission || (typeof Notification !== "undefined" ? Notification.permission : "no_soportado");
    const deviceRegistered = Boolean(
      pushDiagnostic?.tokenObtained ||
      pushDiagnostic?.tokenPath ||
      pushDiagnostic?.firestoreWrite === "permitida" ||
      pushDiagnostic?.firestoreWrite === "token existente"
    );
    const foregroundOk = Boolean(foregroundPushResult);
    const backgroundOk = Boolean(backgroundPushResult);
    const lastReceptionAt = foregroundPushResult?.receivedAt || backgroundPushResult?.receivedAt || "";
    const lastReceptionLabel = lastReceptionAt
      ? new Date(lastReceptionAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
      : "sin recepción reciente";
    const sentCount = Number(pushTestResult?.body?.sent || pushTestResult?.body?.enviados || 0);
    const fcmSentOk = Boolean(pushTestResult?.ok && sentCount > 0);
    const fcmOk = Boolean(fcmSentOk || foregroundOk || backgroundOk);
    const lastAttemptFailed = Boolean(pushTestResult && !pushTestResult.ok);
    return {
      browserPermission,
      deviceRegistered,
      fcmOk,
      fcmSentOk,
      fcmStatusLabel: fcmSentOk ? "correcto" : fcmOk ? "recibido previamente" : "sin probar",
      lastAttemptFailed,
      foregroundOk,
      backgroundOk,
      lastReceptionLabel,
      allOk: browserPermission === "granted" && deviceRegistered && fcmOk && foregroundOk && backgroundOk,
      tokenOperational: fcmOk || foregroundOk || backgroundOk
    };
  }, [pushDiagnostic, pushTestResult, foregroundPushResult, backgroundPushResult]);
  const pushCooldownActive = pushCooldownNow < pushCooldownUntil;
  const pushCooldownSeconds = Math.max(0, Math.ceil((pushCooldownUntil - pushCooldownNow) / 1000));
  const applyPushCooldownIfNeeded = (result) => {
    const body = result?.body || {};
    const message = `${body.message || result?.error || ""}`.toLowerCase();
    if (body.quotaExceeded || message.includes("cuota") || message.includes("quota")) {
      setPushCooldownUntil(Date.now() + 60000);
    }
  };

  useEffect(() => {
    if (!pushCooldownUntil) return undefined;
    const interval = window.setInterval(() => setPushCooldownNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [pushCooldownUntil]);

  const themeRows = useMemo(() => {
    const counts = new Map();
    songs.forEach((song) => {
      [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].forEach((theme) => {
        const name = normalizeThemeName(theme);
        if (!name) return;
        const key = canonicalThemeKey(name);
        counts.set(key, { name, count: (counts.get(key)?.count || 0) + 1 });
      });
    });

    const configuredByKey = new Map(themes.map((theme) => [canonicalThemeKey(theme.name), theme]));
    const rows = collectSongThemes(songs, themes).map((name) => {
      const key = canonicalThemeKey(name);
      const configured = configuredByKey.get(key);
      return {
        ...(configured || { id: `detected-${key}`, name, active: true, detectedOnly: true }),
        name: configured?.name || name,
        count: counts.get(key)?.count || 0,
        detectedOnly: !configured
      };
    });

    const duplicateKeys = new Set();
    const seen = new Map();
    rows.forEach((theme) => {
      const key = canonicalThemeKey(theme.name);
      if (seen.has(key)) duplicateKeys.add(key);
      seen.set(key, true);
    });

    return rows
      .filter((theme) => !theme.ignored)
      .filter((theme) => !themeQuery || theme.name.toLowerCase().includes(themeQuery.toLowerCase()))
      .filter((theme) => {
        if (themeFilter === "official") return !theme.detectedOnly;
        if (themeFilter === "detected") return theme.detectedOnly;
        if (themeFilter === "active") return theme.active !== false;
        if (themeFilter === "inactive") return theme.active === false;
        if (themeFilter === "duplicates") return duplicateKeys.has(canonicalThemeKey(theme.name));
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [songs, themes, themeFilter, themeQuery]);

  const userRows = useMemo(() => {
    const byEmail = new Map();
    authorizedEmails.forEach((allowed) => byEmail.set(allowed.email, { ...allowed, source: "authorized" }));
    users.forEach((user) => {
      const existing = byEmail.get(user.email) || {};
      byEmail.set(user.email, { ...existing, ...user, source: "user" });
    });
    return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [authorizedEmails, users]);

  const canViewUserActivity = String(profile?.email || "").toLowerCase() === activityOwnerEmail;
  const safeUserActivity = useMemo(() => (Array.isArray(userActivity) ? userActivity : []), [userActivity]);
  const selectedUserActivity = useMemo(() => {
    if (!activityUser) return [];
    const selectedEmail = String(activityUser.email || "").toLowerCase();
    return safeUserActivity
      .filter((item) => String(item.email || "").toLowerCase() === selectedEmail)
      .filter((item) => activityDayFilter === "all" || activityDateKey(item) === activityDayFilter)
      .filter((item) => activitySectionFilter === "all" || item.section === activitySectionFilter)
      .filter((item) => activityTypeFilter === "all" || item.eventType === activityTypeFilter)
      .sort((a, b) => activityTimestamp(b) - activityTimestamp(a));
  }, [activityDayFilter, activitySectionFilter, activityTypeFilter, activityUser, safeUserActivity]);
  const activityDays = useMemo(() => {
    const selectedEmail = String(activityUser?.email || "").toLowerCase();
    return [...new Set(safeUserActivity
      .filter((item) => String(item.email || "").toLowerCase() === selectedEmail)
      .map(activityDateKey)
      .filter(Boolean))]
      .sort((a, b) => b.localeCompare(a));
  }, [activityUser?.email, safeUserActivity]);
  const activitySections = useMemo(() => {
    const selectedEmail = String(activityUser?.email || "").toLowerCase();
    return [...new Set(safeUserActivity
      .filter((item) => String(item.email || "").toLowerCase() === selectedEmail)
      .map((item) => item.section)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [activityUser?.email, safeUserActivity]);
  const activityTypes = useMemo(() => {
    const selectedEmail = String(activityUser?.email || "").toLowerCase();
    return [...new Set(safeUserActivity
      .filter((item) => String(item.email || "").toLowerCase() === selectedEmail)
      .map((item) => item.eventType)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [activityUser?.email, safeUserActivity]);

  const activeAdmins = userRows.filter((user) => user.active !== false && user.role === "admin").length;

  useEffect(() => {
    setLocalSettings({
      ...settings,
      worshipLeaderOptions: Array.isArray(settings?.worshipLeaderOptions) ? settings.worshipLeaderOptions : defaultWorshipLeaderOptions,
      serviceTypeOptions: Array.isArray(settings?.serviceTypeOptions) ? settings.serviceTypeOptions : defaultServiceTypeOptions,
      songCategoryOptions: getSongCategoryOptions(settings)
    });
  }, [settings]);

  const saveInstitutionalSettings = async () => {
    setSettingsSaveStatus("");
    const worshipLeaderOptions = (localSettings.worshipLeaderOptions || [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const serviceTypeOptions = (localSettings.serviceTypeOptions || [])
      .map(normalizeServiceTypeOption)
      .filter(Boolean);
    const seenSongCategories = new Set();
    const songCategoryOptions = (localSettings.songCategoryOptions || [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .filter((value) => {
        const key = value.toLowerCase();
        if (seenSongCategories.has(key)) return false;
        seenSongCategories.add(key);
        return true;
      });
    if (!serviceTypeOptions.length) {
      alert("Debe quedar al menos un tipo de servicio.");
      return;
    }
    if (!songCategoryOptions.length) {
      alert("Debe quedar al menos un tipo de canto.");
      return;
    }
    const previousSongCategoryOptions = Array.isArray(settings?.songCategoryOptions) && settings.songCategoryOptions.length
      ? settings.songCategoryOptions.map((value) => String(value || "").trim()).filter(Boolean)
      : getSongCategoryOptions(settings);
    const categoryRenames = {};
    previousSongCategoryOptions.forEach((previousValue, index) => {
      const nextValue = songCategoryOptions[index];
      if (!nextValue) return;
      if (String(previousValue || "").trim() !== String(nextValue || "").trim()) {
        categoryRenames[previousValue] = nextValue;
      }
    });
    await saveSettings({ ...localSettings, worshipLeaderOptions, serviceTypeOptions, songCategoryOptions });
    const renameResult = await renameSongCategories(categoryRenames);
    setSettingsSaveStatus(renameResult?.updated
      ? `Ajustes guardados. Se actualizaron ${renameResult.updated} canto(s) con el tipo renombrado.`
      : "Ajustes guardados.");
  };

  useEffect(() => {
    let cancelled = false;
    fetchLatestVersion()
      .then((result) => {
        if (!cancelled) setLatestVersion(result);
      })
      .catch(() => {
        if (!cancelled) setLatestVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPersonalSettings({
      preferredDisplayName: profile?.preferredDisplayName || "",
      themeMode: profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system",
      accentColor: profile?.accentColor || localStorage.getItem("roca-eterna-accent-color") || defaultColors.accentColor,
      blueGrayColor: profile?.blueGrayColor || defaultColors.blueGrayColor
    });
  }, [profile]);

  useEffect(() => {
    const handleForegroundPush = (event) => setForegroundPushResult(event.detail || getLastForegroundPush());
    const handleBackgroundPush = (event) => setBackgroundPushResult(event.detail || getLastBackgroundPush());
    window.addEventListener("roca-eterna-foreground-push", handleForegroundPush);
    window.addEventListener("roca-eterna-background-push", handleBackgroundPush);
    return () => {
      window.removeEventListener("roca-eterna-foreground-push", handleForegroundPush);
      window.removeEventListener("roca-eterna-background-push", handleBackgroundPush);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setInstallStatus("");
    };
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setInstallPromptEvent(null);
      setInstallStatus("App instalada correctamente.");
    };
    const media = window.matchMedia?.("(display-mode: standalone)");
    const updateStandalone = () => setIsStandalone(Boolean(media?.matches || window.navigator?.standalone === true));
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    media?.addEventListener?.("change", updateStandalone);
    updateStandalone();
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      media?.removeEventListener?.("change", updateStandalone);
    };
  }, []);

  const updateSettings = (field, value) => {
    setLocalSettings((current) => ({ ...current, [field]: value }));
  };

  const updatePersonal = (field, value) => {
    setPersonalSettings((current) => ({ ...current, [field]: value }));
  };

  const lightLogo = getInstitutionalLogo(localSettings, appLogo, "light");
  const darkLogo = getInstitutionalLogo(localSettings, appDarkLogo, "dark");
  const lightLogoSource = localSettings.logoLightUrl || "";
  const darkLogoSource = localSettings.logoDarkUrl || "";

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setImportText(await file.text());
  };

  const saveAccessUser = async (user) => {
    const isSelf = user.email?.toLowerCase() === profile?.email?.toLowerCase();
    const removingAdmin = user.role !== "admin" && userRows.find((row) => row.email === user.email)?.role === "admin";
    const deactivatingAdmin = user.active === false && userRows.find((row) => row.email === user.email)?.role === "admin";
    if (isSelf && (user.active === false || user.role !== "admin")) {
      alert("No puedes quitarte tu propio acceso de administrador.");
      return;
    }
    if ((removingAdmin || deactivatingAdmin) && activeAdmins <= 1) {
      alert("Debe quedar al menos un administrador activo.");
      return;
    }
    await saveUser(user);
  };

  const deleteAccessUser = async (user) => {
    const isSelf = user.email?.toLowerCase() === profile?.email?.toLowerCase();
    if (isSelf) {
      alert("No puedes eliminar tu propio acceso.");
      return;
    }
    if (user.role === "admin" && activeAdmins <= 1) {
      alert("Debe quedar al menos un administrador activo.");
      return;
    }
    if (!confirm("Esta persona perdera el acceso a la app. Esta accion quedara registrada.")) return;
    await removeUserAccess(user);
  };

  const statusForUser = (user) => {
    if (user.active === false) return "inactivo";
    return users.some((item) => item.email === user.email) ? "activo" : "pendiente de iniciar sesión";
  };

  const refreshApp = async () => {
    setIsRefreshingApp(true);
    setUpdateStatus("Preparando la versión más reciente...");
    try {
      await activateLatestAppVersion(latestVersion?.version || appVersion);
    } catch (error) {
      setUpdateStatus(error?.message || "No se pudo iniciar la actualización. Recarga la página e inténtalo nuevamente.");
      setIsRefreshingApp(false);
    }
  };

  const installApp = async () => {
    if (isStandalone) {
      setInstallStatus("La app ya está instalada o se abrió en modo app.");
      return;
    }
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
      setInstallStatus(choice?.outcome === "accepted" ? "Instalación iniciada." : "Instalación cancelada por ahora.");
      return;
    }
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    setInstallStatus(
      isiOS
        ? "En Safari, toca Compartir y luego Agregar a pantalla de inicio."
        : "Abre el menú del navegador y elige Instalar app o Agregar a pantalla principal."
    );
  };

  const runPdfIndex = async () => {
    setIsIndexingPdfs(true);
    setPdfIndexResult(null);
    const missingCount = songs.filter((item) => item.localPdfPath && (
      forcePdfReindex
      || !item.indexedTextAvailable
      || ["pending", "error", "failed", "missing"].includes(String(item.pdfIndexStatus || ""))
      || (item.indexedPdfPath && item.indexedPdfPath !== item.localPdfPath)
      || (item.indexedPdfVersion && String(item.indexedPdfVersion) !== String(item.pdfVersion || ""))
    )).length;
    setPdfIndexProgress({ current: 0, total: missingCount, songTitle: "", found: 0, indexed: 0, reused: 0, noText: 0, missing: 0, failed: 0, ocrItems: [] });
    try {
      const result = await indexLocalPdfTexts(setPdfIndexProgress, { enableOcr: enablePdfOcr, force: forcePdfReindex });
      setPdfIndexResult(result);
    } finally {
      setIsIndexingPdfs(false);
    }
  };

  const enablePush = async () => {
    setIsUpdatingPush(true);
    try {
      const result = await enablePushNotificationsForUser(profile);
      setPushDiagnostic(result);
      if (result.supported && (result.tokenSaved || result.tokenObtained)) {
        setPushTestResult(null);
      }
      setPushStatus(result.reason || (result.supported ? "Notificaciones del navegador activadas para este dispositivo." : "No se pudieron activar las notificaciones push."));
      return result;
    } catch (error) {
      const message = error.message || "No se pudo guardar este dispositivo para notificaciones. Revisa permisos de Firestore.";
      setPushDiagnostic({ supported: false, firestoreWrite: "rechazada", error: message });
      setPushStatus(message);
      return { supported: false, reason: message, error: message };
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const handleEnablePush = () => {
    if (isAndroidDevice()) {
      setShowNotificationWizard(true);
      return;
    }
    enablePush();
  };

  const disablePush = async () => {
    setIsUpdatingPush(true);
    try {
      const result = await disablePushNotificationsForUser(profile);
      setPushDiagnostic(result);
      setPushStatus(result.reason || "Notificaciones del navegador desactivadas para este dispositivo.");
    } catch (error) {
      const message = error.message || "No se pudieron desactivar las notificaciones push.";
      setPushDiagnostic({ supported: false, firestoreWrite: "rechazada", error: message });
      setPushStatus(message);
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const sendSelfTestPush = async () => {
    if (pushCooldownActive) {
      setPushStatus(`Espera ${pushCooldownSeconds} segundos antes de volver a probar push.`);
      return;
    }
    setIsUpdatingPush(true);
    try {
      setForegroundPushResult(null);
      const tokenResult = await getCurrentPushTokenForUser(profile);
      setPushDiagnostic(tokenResult);
      if (!tokenResult.supported || !tokenResult.token) {
        setPushStatus(tokenResult.reason || "No se pudo preparar este dispositivo para la prueba push.");
        return tokenResult;
      }
      const result = await sendExternalPush(
        {
          mode: "self_test",
          type: "other",
          title: "Prueba de Roca Eterna Música",
          body: "Este dispositivo ya puede recibir push.",
          url: "/#/configuracion",
          token: tokenResult.token,
          tokenId: tokenResult.tokenId,
          notificationId: `self-test-${Date.now()}`,
          icon: resolveAppLogoForNotification(settings, personalSettings.themeMode || "light"),
          badge: resolveAppLogoForNotification(settings, personalSettings.themeMode || "light")
        },
        { kind: "test" }
      );
      setPushTestResult(result);
      applyPushCooldownIfNeeded(result);
      setForegroundPushResult(getLastForegroundPush());
      setPushStatus(result.ok ? "Push enviado por FCM. Si no aparece en Windows, revisa permisos del navegador/sistema o prueba con la app en segundo plano." : result.body?.message || result.error || "No se pudo enviar el push de prueba.");
      return result;
    } catch (error) {
      const message = error?.message || "No se pudo enviar la prueba push.";
      setPushStatus(message);
      return { ok: false, error: message };
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const sendSelfTestDataOnlyPush = async () => {
    if (pushCooldownActive) {
      setPushStatus(`Espera ${pushCooldownSeconds} segundos antes de volver a probar push.`);
      return;
    }
    setIsUpdatingPush(true);
    try {
      setForegroundPushResult(null);
      const tokenResult = await getCurrentPushTokenForUser(profile);
      setPushDiagnostic(tokenResult);
      if (!tokenResult.supported || !tokenResult.token) {
        setPushStatus(tokenResult.reason || "No se pudo preparar este dispositivo para la prueba data-only.");
        return;
      }
      const result = await sendExternalPush(
        {
          mode: "self_test_data_only",
          type: "self_test_data_only",
          title: "Prueba data-only",
          body: "Mensaje data-only para probar onMessage.",
          url: "/#/configuracion",
          token: tokenResult.token,
          tokenId: tokenResult.tokenId,
          notificationId: `data-only-${Date.now()}`,
          icon: resolveAppLogoForNotification(settings, personalSettings.themeMode || "light"),
          badge: resolveAppLogoForNotification(settings, personalSettings.themeMode || "light")
        },
        { kind: "test" }
      );
      setPushTestResult(result);
      applyPushCooldownIfNeeded(result);
      setPushStatus(result.ok ? "Prueba FCM data-only enviada. Revisa si aparece recepción foreground." : result.body?.message || result.error || "No se pudo enviar la prueba data-only.");
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const runLocalNotificationTest = async () => {
    const result = await testLocalNotification();
    setLocalNotificationResult(result);
    setPushStatus(result.executed ? "Notification API ejecutada sin error. Si no ves el globo, revisa el centro de notificaciones de Windows, No molestar y permisos de Chrome." : result.error || "No se pudo ejecutar la notificación local.");
  };

  const runPersistentLocalNotificationTest = async () => {
    const result = await testLocalNotification({ requireInteraction: true });
    setLocalNotificationResult(result);
    setPushStatus(result.executed ? "Notificación local persistente ejecutada sin error. Si no aparece, el bloqueo está en Chrome/Windows/Android." : result.error || "No se pudo ejecutar la notificación persistente.");
  };

  const requestSitePermission = async () => {
    const result = await requestSiteNotificationPermissionOnly();
    setLocalNotificationResult({
      permissionBefore: result.permissionBefore,
      permissionAfter: result.permissionAfter,
      attempted: false,
      executed: false,
      method: "",
      error: result.error,
      origin: result.origin,
      href: result.href
    });
    setPushStatus(result.error || `Permiso del sitio: ${result.permissionAfter}`);
  };

  const cleanupInactiveTokens = async () => {
    setIsUpdatingPush(true);
    try {
      const result = await cleanupCurrentUserFcmTokens(profile);
      setTokenCleanupResult(result);
      setPushStatus(result.ok
        ? `Limpieza lista: ${result.unique} token(es) activos unicos, ${result.duplicatesDeactivated} duplicado(s) desactivado(s), ${result.inactive} inactivo(s).`
        : result.error || "No se pudieron limpiar tokens.");
    } catch (error) {
      setTokenCleanupResult({ ok: false, error: error?.message || String(error) });
      setPushStatus(error?.message || "No se pudieron limpiar tokens.");
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const reinstallServiceWorker = async () => {
    const result = await reinstallMessagingServiceWorker();
    setPushDiagnostic({ serviceWorkerRegistered: false, serviceWorkerUrl: result.serviceWorkerUrl, serviceWorkerRemoved: result.removed });
    setPushStatus("Service worker eliminado para esta app. Recarga la página y vuelve a activar notificaciones.");
  };

  return (
    <>
    <AndroidNotificationPermissionWizard
      open={showNotificationWizard}
      onClose={() => setShowNotificationWizard(false)}
      onActivate={enablePush}
      onTest={sendSelfTestPush}
      isWorking={isUpdatingPush}
    />
    <div className="settings-page grid min-w-0 max-w-full gap-5 overflow-x-hidden pb-10 xl:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
      <div className="min-w-0 space-y-5">
        <Card>
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Mis preferencias</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre para mostrar">
              <Input value={personalSettings.preferredDisplayName || ""} placeholder={profile?.displayName || profile?.email || ""} onChange={(event) => updatePersonal("preferredDisplayName", event.target.value)} />
            </Field>
            <Field label="Modo">
              <Select value={personalSettings.themeMode || "system"} onChange={(event) => updatePersonal("themeMode", event.target.value)}>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
                <option value="system">Sistema</option>
              </Select>
            </Field>
            <Field label="Acento personal">
              <Input type="color" value={personalSettings.accentColor || defaultColors.accentColor} onChange={(event) => updatePersonal("accentColor", event.target.value)} />
            </Field>
            <Field label="Acento secundario personal">
              <Input type="color" value={personalSettings.blueGrayColor || defaultColors.blueGrayColor} onChange={(event) => updatePersonal("blueGrayColor", event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => saveUserPreferences(personalSettings)}><Save className="h-4 w-4" />Guardar mis preferencias</Button>
            <Button variant="secondary" onClick={() => {
              const next = { ...personalSettings, accentColor: defaultColors.accentColor, blueGrayColor: defaultColors.blueGrayColor };
              setPersonalSettings(next);
              saveUserPreferences(next);
            }}>Restaurar colores por defecto</Button>
          </div>
        </Card>

        {isFullAdmin ? (
        <Card>
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Configuración institucional</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre de la iglesia">
              <Input value={localSettings.churchName || ""} disabled={!isAdmin} onChange={(event) => updateSettings("churchName", event.target.value)} />
            </Field>
            <Field label="Nombre de la app">
              <Input value={localSettings.appName || ""} disabled={!isAdmin} onChange={(event) => updateSettings("appName", event.target.value)} />
            </Field>
            <Field label="Logo para modo claro">
              <Input value={localSettings.logoLightUrl || ""} disabled={!isAdmin} placeholder="/icons/roca-eterna-logo-light.png" onChange={(event) => updateSettings("logoLightUrl", event.target.value)} />
              <p className="mt-2 text-xs leading-5 text-ink/55">Si el archivo esta en public/icons/logo.png, escribe /icons/logo.png. No es necesario escribir public/.</p>
            </Field>
            <Field label="Logo para modo oscuro">
              <Input value={localSettings.logoDarkUrl || ""} disabled={!isAdmin} placeholder="/icons/roca-eterna-logo-dark.png" onChange={(event) => updateSettings("logoDarkUrl", event.target.value)} />
            </Field>
            <Field label="Texto alternativo del logo">
              <Input value={localSettings.logoAltText || ""} disabled={!isAdmin} placeholder="Roca Eterna Música" onChange={(event) => updateSettings("logoAltText", event.target.value)} />
            </Field>
            <Field label="Preferencia de tonalidad">
              <Select value={localSettings.keyPreference || "sharps"} disabled={!isAdmin} onChange={(event) => updateSettings("keyPreference", event.target.value)}>
                <option value="sharps">Sostenidos (#)</option>
                <option value="flats">Bemoles (b)</option>
              </Select>
            </Field>
          </div>
          <div className="mt-5 grid gap-4">
            <EditableTextOptions
              title="Líderes de adoración"
              description="Estas opciones aparecen al crear o editar una programación. La opción para escribir otro nombre seguirá disponible."
              values={localSettings.worshipLeaderOptions || []}
              onChange={(values) => updateSettings("worshipLeaderOptions", values)}
              placeholder="Nombre del líder"
            />
            <EditableServiceOptions
              values={localSettings.serviceTypeOptions || []}
              onChange={(values) => updateSettings("serviceTypeOptions", values)}
            />
            <EditableTextOptions
              title="Tipos de canto"
              description="Estas opciones aparecen al agregar, editar y filtrar cantos. Eliminar una opción no modifica los cantos que ya la usan."
              values={localSettings.songCategoryOptions || []}
              onChange={(values) => updateSettings("songCategoryOptions", values)}
              placeholder="Ej. normal, himno, navidad"
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-ink/55">
            Si tu logo es blanco/transparente, usa una version oscura para modo claro y una version clara para modo oscuro.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <LogoPreview
              title="Vista en modo claro"
              logo={lightLogo}
              source={lightLogoSource}
              alt={localSettings.logoAltText || "Roca Eterna Música"}
              onDiagnose={async () => setLogoTest(await diagnosePublicAsset(lightLogoSource, "image"))}
            />
            <LogoPreview
              title="Vista en modo oscuro"
              logo={darkLogo}
              source={darkLogoSource}
              alt={localSettings.logoAltText || "Roca Eterna Música"}
              dark
              onDiagnose={async () => setLogoTest(await diagnosePublicAsset(darkLogoSource, "image"))}
            />
          </div>
          <FileDiagnosticPanel result={logoTest} />
          {isAdmin ? (
            <div className="mt-5">
              <div className="flex flex-wrap gap-3">
                <Button onClick={saveInstitutionalSettings}><Save className="h-4 w-4" />Guardar ajustes</Button>
                <Button variant="secondary" onClick={() => setLocalSettings((current) => ({ ...current, logoLightUrl: "", logoDarkUrl: "", logoAltText: "" }))}>Restaurar logo por defecto</Button>
              </div>
              {settingsSaveStatus ? (
                <p className="mt-3 rounded-xl bg-brass/10 px-3 py-2 text-sm font-semibold text-brass">{settingsSaveStatus}</p>
              ) : null}
            </div>
          ) : null}
        </Card>
        ) : null}

        {isFullAdmin ? <DailyVerseSettings profile={profile} logAuditEvent={logAuditEvent} /> : null}

        {isFullAdmin || isEditor ? (
        <Card>
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Temas del repertorio</h2>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setShowThemes((current) => !current)}>
              {showThemes ? "Ocultar temas" : "Mostrar temas"}
            </Button>
            <span className="text-sm font-semibold text-ink/55">{themeRows.length} temas visibles</span>
          </div>
          {showThemes ? (
          <>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_320px]">
            <Input placeholder="Buscar tema" value={themeQuery} onChange={(event) => setThemeQuery(event.target.value)} />
            <Select value={themeFilter} onChange={(event) => setThemeFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="official">Oficiales</option>
              <option value="detected">Detectados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="duplicates">Posibles duplicados</option>
            </Select>
            {isAdmin ? (
              <div className="flex gap-2">
                <Input placeholder="Nuevo tema" value={newTheme} onChange={(event) => setNewTheme(event.target.value)} />
                <Button onClick={async () => {
                  await saveTheme({ name: newTheme, active: true });
                  setNewTheme("");
                }}>Agregar</Button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-white dark:border-white/10 dark:bg-white/5">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-ink/5 text-xs uppercase tracking-wide text-ink/45 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                <tr>
                  <th className="px-3 py-3">Tema</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Cantos</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {themeRows.map((theme) => (
                  <tr key={theme.id || theme.name} className="border-b border-ink/10 last:border-b-0 hover:bg-ink/5 dark:border-white/10 dark:hover:bg-white/5">
                    <td className="px-3 py-3">
                      {editingTheme?.id === theme.id ? (
                        <Input value={editingTheme.name} onChange={(event) => setEditingTheme((current) => ({ ...current, name: event.target.value }))} />
                      ) : (
                        <span className="font-semibold text-ink">{theme.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${theme.active === false ? "bg-ink/10 text-ink/55 dark:bg-white/10 dark:text-white/60" : "bg-brass/15 text-brass"}`}>
                        {theme.active === false ? "Inactivo" : "Activo"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink/60">{theme.count}</td>
                    <td className="px-3 py-3 text-ink/60">{theme.detectedOnly ? "Detectado automaticamente" : "Oficial"}</td>
                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {editingTheme?.id === theme.id ? (
                            <>
                              <Button onClick={async () => {
                                await saveTheme(editingTheme);
                                setEditingTheme(null);
                              }}>Guardar</Button>
                              <Button variant="subtle" onClick={() => setEditingTheme(null)}>Cancelar</Button>
                            </>
                          ) : theme.detectedOnly ? (
                            <>
                              <Button variant="secondary" onClick={() => saveTheme({ name: theme.name, active: true })}>Convertir</Button>
                              <Button variant="secondary" onClick={() => {
                                setMergeThemeSource(theme);
                                setMergeThemeTarget("");
                              }}>Fusionar</Button>
                              <Button variant="danger" onClick={() => saveTheme({ name: theme.name, active: false, ignored: true })}>Ignorar</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="secondary" onClick={() => setEditingTheme(theme)}>Editar</Button>
                              <Button variant="secondary" onClick={() => saveTheme({ ...theme, active: theme.active === false })}>
                                {theme.active !== false ? "Desactivar" : "Activar"}
                              </Button>
                              <Button variant="subtle" onClick={() => {
                                setMergeThemeSource(theme);
                                setMergeThemeTarget("");
                              }}>Fusionar</Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink/40">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!themeRows.length ? (
              <div className="p-6 text-center text-sm font-semibold text-ink/50">No hay temas con esos filtros.</div>
            ) : null}
          </div>
          </>
          ) : null}
        </Card>
        ) : null}

        <Modal open={Boolean(mergeThemeSource)} title="Fusionar tema" onClose={() => setMergeThemeSource(null)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-ink/60">
              El tema <strong>{mergeThemeSource?.name}</strong> se reemplazara por el tema oficial que elijas.
            </p>
            <Field label="Tema destino">
              <Select value={mergeThemeTarget} onChange={(event) => setMergeThemeTarget(event.target.value)}>
                <option value="">Selecciona un tema oficial</option>
                {themeRows.filter((target) => target.name !== mergeThemeSource?.name && !target.detectedOnly).map((target) => (
                  <option key={target.id || target.name} value={target.name}>{target.name}</option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="subtle" onClick={() => setMergeThemeSource(null)}>Cancelar</Button>
              <Button disabled={!mergeThemeTarget} onClick={async () => {
                await mergeTheme(mergeThemeSource.name, mergeThemeTarget);
                setMergeThemeSource(null);
                setMergeThemeTarget("");
              }}>Fusionar</Button>
            </div>
          </div>
        </Modal>

        {isFullAdmin ? (
        <Card>
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Importar repertorio</h2>
          </div>
          <p className="mt-1 text-sm text-ink/55">
            Pega CSV/TSV con columnas: id, nombre, tema, otros_temas, categoria, cantado, tonalidad, capo, tonalidad_con_capo, cambio_de_tono, revision_musical, revision_keynote, revision_pdf, formato, comentario.
          </p>
          <div className="mt-5 grid gap-4">
            <Field label="Archivo CSV / TSV">
              <div className="flex flex-wrap items-center gap-3">
                <input id="repertoire-file" className="sr-only" type="file" accept=".csv,.tsv,.txt" onChange={(event) => handleFile(event.target.files?.[0])} />
                <label htmlFor="repertoire-file" className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft ring-1 ring-ink/10 transition hover:ring-ink/25">
                  Seleccionar archivo
                </label>
                <span className="text-sm text-ink/55">{fileName || "Ningun archivo seleccionado"}</span>
              </div>
            </Field>
            <Field label="Texto CSV / TSV">
              <Textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Pega aqui tu tabla..." />
            </Field>
            <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
              <Field label="Duplicados por nombre">
                <Select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                  <option value="skip">Omitir existentes</option>
                  <option value="update">Actualizar existentes</option>
                </Select>
              </Field>
              <div className="rounded-2xl bg-ink/5 p-4 text-sm text-ink/62">
                {!importText.trim() ? (
                  "Pega tu tabla o sube un archivo para previsualizar la importacion."
                ) : (
                  <span>
                    Detectados <strong>{importSummary.detected}</strong> - Nuevos <strong>{importSummary.news}</strong> - Duplicados <strong>{importSummary.duplicates}</strong> - Con errores <strong>{parsedImport.errors.length}</strong>
                  </span>
                )}
              </div>
            </div>
            {parsedImport.songs.length ? (
              <div className="max-h-72 overflow-auto rounded-2xl border border-ink/10 bg-white">
                <div className="grid grid-cols-[1.3fr_1fr_100px_90px] gap-3 border-b border-ink/10 p-3 text-xs font-bold uppercase tracking-wide text-ink/45">
                  <span>Nombre</span><span>Tema</span><span>Tono</span><span>Capo</span>
                </div>
                {parsedImport.songs.slice(0, 10).map((song) => (
                  <div key={song.importId} className="grid grid-cols-[1.3fr_1fr_100px_90px] gap-3 border-b border-ink/10 p-3 text-sm last:border-b-0">
                    <span className="font-semibold text-ink">{song.title}</span>
                    <span className="text-ink/60">{song.mainTheme || "--"}</span>
                    <span className="text-ink/60">{song.mainKey || "--"} / {song.keyWithCapo || "--"}</span>
                    <span className="text-ink/60">{song.capo || 0}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {parsedImport.errors.length ? (
              <div className="max-h-44 overflow-auto rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-bold">Errores detectados</p>
                {parsedImport.errors.slice(0, 8).map((error, index) => (
                  <p key={`${error.row}-${index}`}>Fila {error.row}: {error.message}</p>
                ))}
              </div>
            ) : null}
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={async () => setImportResult(await importSongs(parsedImport.songs, importMode))} disabled={!parsedImport.songs.length}>
                  Importar cantos
                </Button>
                {importResult ? (
                  <span className="text-sm font-semibold text-ink/60">
                    Creados {importResult.created}, actualizados {importResult.updated}, omitidos {importResult.skipped}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
        ) : null}

        {isFullAdmin ? (
        <Card>
          <div className="flex items-center gap-3">
            <FileSearch className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Busqueda dentro de PDFs locales</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Indexa PDFs accesibles desde public/pdfs. No muestra letras completas; guarda texto normalizado para encontrar cantos por palabras.
          </p>
          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-brass/25 bg-brass/10 p-4 text-sm font-semibold text-ink">
            <input className="mt-1" type="checkbox" checked={enablePdfOcr} onChange={(event) => setEnablePdfOcr(event.target.checked)} disabled={isIndexingPdfs} />
            <span>
              Usar OCR automático gratuito para PDFs escaneados
              <span className="mt-1 block text-xs font-medium text-ink/55">
                Se ejecuta en este navegador con Tesseract.js. Puede tardar varios minutos si hay muchos cantos.
              </span>
            </span>
          </label>
          <label className="mt-3 flex items-start gap-3 rounded-2xl bg-ink/5 p-3 text-sm font-semibold text-ink/70">
            <input className="mt-1" type="checkbox" checked={forcePdfReindex} onChange={(event) => setForcePdfReindex(event.target.checked)} disabled={isIndexingPdfs} />
            <span>Forzar reindexación aunque el PDF no haya cambiado</span>
          </label>
          <Button className="mt-4" variant="secondary" isLoading={isIndexingPdfs} disabled={isIndexingPdfs} onClick={runPdfIndex}>
            <FileSearch className="h-4 w-4" />
            {isIndexingPdfs ? "Indexando PDFs..." : forcePdfReindex ? "Forzar reindexación completa" : "Indexar únicamente faltantes"}
          </Button>
          {pdfIndexProgress ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/5 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink/70">
                <span>{isIndexingPdfs ? "Indexando PDFs..." : "Proceso terminado"}</span>
                <span>{pdfIndexProgress.current || 0} / {pdfIndexProgress.total || 0}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-brass transition-all" style={{ width: `${pdfIndexProgress.total ? Math.round(((pdfIndexProgress.current || 0) / pdfIndexProgress.total) * 100) : 0}%` }} />
              </div>
              <p className="mt-3 text-sm text-ink/55">{pdfIndexProgress.songTitle ? `Procesando: ${pdfIndexProgress.songTitle}` : "Preparando indice..."}</p>
              {pdfIndexProgress.ocrProgress ? (
                <p className="mt-1 text-xs font-semibold text-brass">
                  OCR página {pdfIndexProgress.ocrProgress.pageNumber || "-"} de {pdfIndexProgress.ocrProgress.totalPages || "-"} · {pdfIndexProgress.ocrProgress.phase || "leyendo"} {pdfIndexProgress.ocrProgress.progress ? `${Math.round(pdfIndexProgress.ocrProgress.progress * 100)}%` : ""}
                </p>
              ) : null}
              {pdfIndexProgress.pdfPath ? <p className="mt-1 break-all text-xs text-ink/45">PDF: {pdfIndexProgress.pdfPath}</p> : null}
              <p className="mt-2 text-xs font-semibold text-ink/50">
                Encontrados {pdfIndexProgress.found || 0} - Indexados {pdfIndexProgress.indexed || 0} - Reutilizados {pdfIndexProgress.reused || 0} - OCR {(pdfIndexProgress.ocrItems || []).length} - Sin texto {pdfIndexProgress.noText || 0} - No encontrados {pdfIndexProgress.missing || 0} - Errores {pdfIndexProgress.failed || 0}
              </p>
            </div>
          ) : null}
          {pdfIndexResult ? (
            <PdfIndexSummary result={pdfIndexResult} />
          ) : null}
        </Card>
        ) : null}

        {canManageAccess ? (
          <Card data-tour="settings-access" className="overflow-hidden">
            <h2 className="text-xl font-bold text-ink">Correos autorizados</h2>
            <p className="mt-1 text-sm text-ink/55">Autoriza correos antes de que entren con Google. Los usuarios reales aparecen después de iniciar sesión.</p>
            <div className="mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <Input placeholder="correo@gmail.com" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} />
                <Input placeholder="Nombre visible" value={newUser.displayName} onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Select className="w-full sm:w-40" value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}>
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </Select>
                {newUser.role === "viewer" ? (
                  <Select className="w-full sm:w-44" value={newUser.viewerType || "corista"} onChange={(event) => setNewUser((current) => ({ ...current, viewerType: event.target.value }))}>
                    <option value="corista">Corista</option>
                    <option value="musico">Músico</option>
                    <option value="medios">Medios</option>
                  </Select>
                ) : null}
                <Button className="w-full sm:w-auto" onClick={async () => {
                  if (!newUser.email) return;
                  await saveAccessUser(newUser);
                  setNewUser({ email: "", displayName: "", role: "viewer", viewerType: "corista", active: true });
                }}>
                  <UserPlus className="h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {userRows.map((user) => (
                <div key={user.id || user.email} className="rounded-2xl bg-ink/5 p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{user.displayName || user.email}</p>
                      <p className="break-all text-sm text-ink/55">{user.email}</p>
                      <p className="text-xs text-ink/45">Última conexión: {formatAccessDate(user.lastSeenAt || user.lastLoginAt || user.lastLogin)}</p>
                      {canViewUserActivity ? (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/45">
                          <span>Tiempo en app: {formatDuration(user.activityTotalMs || 0)}</span>
                          <span>Desconexión: {formatExactDate(user.lastDisconnectedAt, "Sin desconexión registrada")}</span>
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-ink/60">{statusForUser(user)}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <Select value={user.role || "viewer"} onChange={(event) => saveAccessUser({ ...user, role: event.target.value })}>
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                    </Select>
                    {user.role === "viewer" ? (
                      <Select
                        value={user.viewerType || "corista"}
                        onChange={(event) => saveAccessUser({ ...user, viewerType: event.target.value })}
                        aria-label={`Perfil viewer de ${user.email}`}
                      >
                        <option value="corista">Corista</option>
                        <option value="musico">Músico</option>
                        <option value="medios">Medios</option>
                      </Select>
                    ) : <div className="hidden xl:block" />}
                    <Button variant={user.active !== false ? "secondary" : "danger"} onClick={() => saveAccessUser({ ...user, active: user.active === false })}>
                      {user.active !== false ? "Activo" : "Inactivo"}
                    </Button>
                    {canViewUserActivity ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setActivityUser(user);
                          setActivityDayFilter("all");
                          setActivitySectionFilter("all");
                          setActivityTypeFilter("all");
                        }}
                      >
                        <Activity className="h-4 w-4" />
                        Ver actividad
                      </Button>
                    ) : null}
                    <Button variant="danger" onClick={() => deleteAccessUser(user)}>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {import.meta.env.DEV && isFullAdmin ? (
          <Card>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-brass" />
              <h2 className="text-xl font-bold text-ink">Herramientas de desarrollo</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Ya tienes repertorio real. Cargar datos de ejemplo puede duplicar o ensuciar la base.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => confirm("Ya tienes repertorio real. Cargar datos de ejemplo puede duplicar o ensuciar la base. Continuar?") && seedExampleData()}
            >
              <Database className="h-4 w-4" />
              Cargar datos de ejemplo
            </Button>
          </Card>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-5">
        <Card>
          <h2 className="text-xl font-bold text-ink">Mi sesión</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Nombre</dt><dd className="text-right font-semibold text-ink">{profile?.displayName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Correo</dt><dd className="text-right font-semibold text-ink">{profile?.email}</dd></div>
            {isAdmin ? <div className="flex justify-between gap-4"><dt className="text-ink/50">Rol</dt><dd className="font-semibold text-ink">{profile?.role}</dd></div> : null}
            {isAdmin && isViewer ? <div className="flex justify-between gap-4"><dt className="text-ink/50">Perfil</dt><dd className="font-semibold capitalize text-ink">{profile?.viewerType || "corista"}</dd></div> : null}
          </dl>
          <Button variant="danger" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-ink">Ayuda</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">Abre de nuevo la guía interactiva para repasar como usar cada sección de la app.</p>
          <Button className="mt-4 w-full" variant="secondary" onClick={() => window.dispatchEvent(new Event("roca-eterna-open-guide"))}>
            <HelpCircle className="h-4 w-4" />
            Ver guía otra vez
          </Button>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><BellRing className="h-5 w-5 text-brass" />Notificaciones</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            Las notificaciones dentro de la app ya funcionan. Las push del navegador requieren permiso del dispositivo y una VAPID key configurada.
          </p>
          <p className="mt-3 rounded-2xl bg-ink/5 p-3 text-sm text-ink/60 dark:bg-white/5">
            Backend push configurado: <span className="font-semibold text-ink">{isPushBackendConfigured() ? "si" : "no"}</span>
          </p>
          <div className={`mt-3 rounded-2xl border p-3 text-sm ${pushSummary.allOk ? "border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100" : "border-ink/10 bg-white/70 text-ink/70 dark:bg-white/5"}`}>
            <p className="font-bold text-ink">Estado de notificaciones</p>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt>Permiso del navegador</dt>
                <dd className="font-semibold text-ink">{permissionLabel(pushSummary.browserPermission)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Dispositivo registrado</dt>
                <dd className="font-semibold text-ink">{yesNoLabel(pushSummary.deviceRegistered)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Push</dt>
                <dd className="font-semibold text-ink">{pushSummary.fcmStatusLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Última recepción</dt>
                <dd className="text-right font-semibold text-ink">{pushSummary.lastReceptionLabel}</dd>
              </div>
              {pushSummary.lastAttemptFailed ? (
                <div className="flex justify-between gap-3">
                  <dt>Último intento</dt>
                  <dd className="text-right font-semibold text-brass">falló en {pushTestResult?.body?.stage || "una etapa anterior"}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt>App abierta</dt>
                <dd className="font-semibold text-ink">{pushSummary.foregroundOk ? "recibido" : "sin recibir"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>App en segundo plano</dt>
                <dd className="font-semibold text-ink">{pushSummary.backgroundOk ? "recibido" : "sin recibir"}</dd>
              </div>
            </dl>
            {pushSummary.allOk ? (
              <p className="mt-3 rounded-xl bg-emerald-500/10 p-2 text-xs font-semibold text-emerald-900 dark:text-emerald-100">Push funcionando correctamente en este dispositivo.</p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2">
            {isAdmin ? (
              <Button className="w-full" variant="secondary" disabled={isUpdatingPush} onClick={runLocalNotificationTest}>
                Probar notificación
              </Button>
            ) : null}
            {isAdmin ? (
              <Button className="hidden w-full" variant="subtle" disabled={isUpdatingPush} onClick={runPersistentLocalNotificationTest}>
                Probar notificación local persistente
              </Button>
            ) : null}
            {isAdmin ? (
              <Button className="hidden w-full" variant="subtle" disabled={isUpdatingPush} onClick={requestSitePermission}>
                Solicitar permiso del sitio
              </Button>
            ) : null}
            <Button className="w-full" variant="secondary" isLoading={isUpdatingPush} disabled={isUpdatingPush} onClick={handleEnablePush}>
              Activar notificaciones
            </Button>
            <Button className="w-full" variant="subtle" isLoading={isUpdatingPush} disabled={isUpdatingPush || pushCooldownActive || !isPushBackendConfigured()} onClick={sendSelfTestPush}>
              {pushCooldownActive ? `Espera ${pushCooldownSeconds}s` : "Probar recepción en este dispositivo"}
            </Button>
            {isAdmin ? (
              <>
                <Button className="hidden w-full" variant="subtle" isLoading={isUpdatingPush} disabled={isUpdatingPush || pushCooldownActive || !isPushBackendConfigured()} onClick={sendSelfTestDataOnlyPush}>
                  {pushCooldownActive ? `Espera ${pushCooldownSeconds}s` : "Enviar prueba FCM data-only"}
                </Button>
                <Button className="w-full" variant="subtle" disabled={isUpdatingPush} onClick={reinstallServiceWorker}>
                  Reinstalar service worker
                </Button>
                {showAdvancedPushDiagnostics ? (
                  <Button className="w-full" variant="subtle" disabled={isUpdatingPush} onClick={cleanupInactiveTokens}>
                    Limpiar tokens inactivos
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button className="w-full" variant="subtle" disabled={isUpdatingPush} onClick={disablePush}>
              Desactivar en este dispositivo
            </Button>
          </div>
          {pushStatus ? <p className="mt-3 rounded-2xl bg-ink/5 p-3 text-sm text-ink/60">{pushStatus}</p> : null}
          {(localNotificationResult || pushTestResult || foregroundPushResult || backgroundPushResult) ? (
            <div className="mt-3 space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-3 text-xs text-ink/70 dark:bg-white/5">
              <p className="font-bold text-ink">Últimos resultados</p>
              {localNotificationResult ? (
                <p>Prueba local: {localNotificationResult.executed ? "ejecutada sin error" : "no ejecutada"}{localNotificationResult.method ? ` via ${localNotificationResult.method}` : ""}.</p>
              ) : null}
              {pushTestResult ? (
                <p>Prueba FCM: {pushTestResult.ok ? `enviada (${pushTestResult.body?.sent || 0} enviados, ${pushTestResult.body?.failed || 0} fallidos, etapa ${pushTestResult.body?.stage || "sin etapa"})` : pushTestResult.body?.message || pushTestResult.error || "fallo"}.</p>
              ) : null}
              {pushCooldownActive ? <p className="font-semibold text-brass">Pausa temporal por cuota: espera {pushCooldownSeconds}s antes de volver a probar.</p> : null}
              <p>Recepción: app abierta {foregroundPushResult ? "recibida" : "sin confirmar"}; segundo plano {backgroundPushResult ? "recibida" : "sin confirmar"}.</p>
            </div>
          ) : null}
          {isAdmin ? (
            <Button className="mt-3 w-full" variant="subtle" onClick={() => setShowAdvancedPushDiagnostics((value) => !value)}>
              {showAdvancedPushDiagnostics ? "Ocultar diagnóstico avanzado" : "Diagnóstico avanzado"}
            </Button>
          ) : null}
          {showAdvancedPushDiagnostics && pushDiagnostic ? (
            <dl className="mt-3 space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-3 text-xs text-ink/70 dark:bg-white/5">
              <div className="flex justify-between gap-3">
                <dt>Permiso del navegador</dt>
                <dd className="text-right font-semibold text-ink">{pushDiagnostic.browserPermission || "sin revisar"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>VAPID key</dt>
                <dd className="text-right font-semibold text-ink">{pushDiagnostic.hasVapidKey ? "configurada" : "faltante"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Service worker</dt>
                <dd className="text-right font-semibold text-ink">{pushDiagnostic.serviceWorkerRegistered ? "registrado" : "sin confirmar"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Token FCM</dt>
                <dd className="text-right font-semibold text-ink">{pushDiagnostic.tokenObtained ? `obtenido (${pushDiagnostic.tokenPreview})` : "sin token"}</dd>
              </div>
              <div className="grid gap-1">
                <dt>Ruta Firestore</dt>
                <dd className="break-all rounded-xl bg-ink/5 px-2 py-1 font-mono text-[11px] text-ink/70 dark:bg-white/10">{pushDiagnostic.tokenPath || "sin intento de escritura"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Escritura en Firestore</dt>
                <dd className="text-right font-semibold text-ink">{pushDiagnostic.firestoreWrite || "no intentada"}</dd>
              </div>
              <div className="grid gap-1">
                <dt>Origen actual</dt>
                <dd className="break-all rounded-xl bg-ink/5 px-2 py-1 font-mono text-[11px] text-ink/70 dark:bg-white/10">{pushDiagnostic.origin || window.location.origin}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><dt>HTTPS seguro</dt><dd className="font-semibold text-ink">{boolLabel(pushDiagnostic.isSecureContext)}</dd></div>
                <div><dt>PushManager</dt><dd className="font-semibold text-ink">{boolLabel(pushDiagnostic.pushManagerSupport)}</dd></div>
                <div><dt>SW soporte</dt><dd className="font-semibold text-ink">{boolLabel(pushDiagnostic.serviceWorkerSupport)}</dd></div>
                <div><dt>Foreground listener</dt><dd className="font-semibold text-ink">{pushDiagnostic.foregroundListenerRegistered ? "registrado" : "sin confirmar"}</dd></div>
              </div>
              <div className="grid gap-1">
                <dt>URL completa</dt>
                <dd className="break-all rounded-xl bg-ink/5 px-2 py-1 font-mono text-[11px] text-ink/70 dark:bg-white/10">{pushDiagnostic.href || window.location.href}</dd>
              </div>
              <div className="grid gap-1">
                <dt>Service worker URL</dt>
                <dd className="break-all rounded-xl bg-ink/5 px-2 py-1 font-mono text-[11px] text-ink/70 dark:bg-white/10">{pushDiagnostic.serviceWorkerUrl || ""}</dd>
              </div>
              <div className="grid gap-1">
                <dt>Scope / script activo</dt>
                <dd className="break-all rounded-xl bg-ink/5 px-2 py-1 font-mono text-[11px] text-ink/70 dark:bg-white/10">{`${pushDiagnostic.serviceWorkerScope || "sin scope"} | ${pushDiagnostic.serviceWorkerScriptURL || "sin script"}`}</dd>
              </div>
              <div className="grid gap-1">
                <dt>Controller</dt>
                <dd className="break-all rounded-xl bg-ink/5 px-2 py-1 font-mono text-[11px] text-ink/70 dark:bg-white/10">{pushDiagnostic.serviceWorkerControllerScriptURL || "sin controller"}</dd>
              </div>
              <div className="grid gap-1">
                <dt>Registration usado por getToken</dt>
                <dd className="break-all rounded-xl bg-ink/5 px-2 py-1 font-mono text-[11px] text-ink/70 dark:bg-white/10">{`${pushDiagnostic.serviceWorkerUsedForTokenScope || "sin uso"} | ${pushDiagnostic.serviceWorkerUsedForTokenScriptURL || "sin script"}`}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><dt>SW activo con FCM</dt><dd className="font-semibold text-ink">{boolLabel(pushDiagnostic.serviceWorkerHasFcmSupport)}</dd></div>
                <div><dt>Token FCM operativo</dt><dd className="font-semibold text-ink">{pushSummary.tokenOperational ? "si" : "sin confirmar"}</dd></div>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Status SW file</dt>
                <dd className="text-right font-semibold text-ink">{pushDiagnostic.serviceWorkerFileStatus || "sin revisar"}</dd>
              </div>
              {pushDiagnostic.serviceWorkerScopeWarning ? (
                <div className="rounded-xl bg-yellow-100 px-2 py-1 text-yellow-900 dark:bg-yellow-500/15 dark:text-yellow-100">{pushDiagnostic.serviceWorkerScopeWarning}</div>
              ) : null}
              {pushDiagnostic.error ? (
                <div className="grid gap-1">
                  <dt>Error exacto</dt>
                  <dd className="break-words rounded-xl bg-red-50 px-2 py-1 text-red-700 dark:bg-red-500/10 dark:text-red-200">{pushDiagnostic.error}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {isAdmin ? (
            <>
              <Button
                className="mt-3 w-full"
                variant="subtle"
                onClick={async () => {
                  const status = await diagnosePushNotifications(profile);
                  setPushDiagnostic(status);
                  setPushTestResult(getLastPushResult("test"));
                  setPushAutoResult(getLastPushResult("auto"));
                  setForegroundPushResult(getLastForegroundPush());
                  setBackgroundPushResult(getLastBackgroundPush());
                  setPushStatus(status.supported ? "Push listo para solicitar token en este navegador." : status.reason);
                }}
              >
                Diagnosticar push
              </Button>
              {showAdvancedPushDiagnostics ? (
              <div className="mt-3 space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-3 text-xs text-ink/70 dark:bg-white/5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button className="w-full" variant="secondary" isLoading={isUpdatingPush} disabled={isUpdatingPush || pushCooldownActive || !isPushBackendConfigured()} onClick={sendSelfTestPush}>
                    {pushCooldownActive ? `Espera ${pushCooldownSeconds}s` : "Prueba FCM normal"}
                  </Button>
                  <Button className="w-full" variant="subtle" isLoading={isUpdatingPush} disabled={isUpdatingPush || pushCooldownActive || !isPushBackendConfigured()} onClick={sendSelfTestDataOnlyPush}>
                    {pushCooldownActive ? `Espera ${pushCooldownSeconds}s` : "Prueba data-only"}
                  </Button>
                  <Button className="w-full" variant="subtle" disabled={isUpdatingPush} onClick={runPersistentLocalNotificationTest}>
                    Notificación local persistente
                  </Button>
                  <Button className="w-full" variant="subtle" disabled={isUpdatingPush} onClick={requestSitePermission}>
                    Solicitar permiso del sitio
                  </Button>
                </div>
                <p className="font-semibold text-ink">Prueba local</p>
                {localNotificationResult ? (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-ink/5 p-2 text-[11px] dark:bg-white/10">{JSON.stringify({
                    permisoAntes: localNotificationResult.permissionBefore,
                    permisoDespues: localNotificationResult.permissionAfter,
                    metodoUsado: localNotificationResult.method || "sin metodo",
                    notificacionLocalIntentada: localNotificationResult.attempted ? "sí" : "no",
                    notificationApiEjecutadaSinError: localNotificationResult.executed ? "si" : "no",
                    origin: localNotificationResult.origin,
                    href: localNotificationResult.href,
                    error: localNotificationResult.error
                  }, null, 2)}</pre>
                ) : <p>Sin prueba local registrada.</p>}
                <p className="rounded-xl bg-brass/10 p-2 text-[11px] leading-5 text-ink/70">Si esta prueba dice ejecutada sin error pero no ves el globo, revisa el centro de notificaciones de Windows, No molestar y permisos de Chrome.</p>
                <p className="font-semibold text-ink">Última prueba push</p>
                {pushTestResult ? (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-ink/5 p-2 text-[11px] dark:bg-white/10">{JSON.stringify({
                    hora: pushTestResult.at,
                    statusHttp: pushTestResult.status,
                    notificationId: pushTestResult.body?.notificationId || pushTestResult.notificationId,
                    deduplicado: pushTestResult.body?.deduplicated || pushTestResult.body?.duplicate || false,
                    tokensEncontrados: pushTestResult.body?.tokensFound,
                    tokensActivos: pushTestResult.body?.activeTokens,
                    tokensUnicos: pushTestResult.body?.uniqueTokens,
                    tokensDuplicados: pushTestResult.body?.duplicateTokens,
                    tokensIntentados: pushTestResult.body?.tokensAttempted,
                    enviados: pushTestResult.body?.sent,
                    fallidos: pushTestResult.body?.failed,
                    invalidos: pushTestResult.body?.invalidTokens,
                    avisoForegroundRecibido: foregroundPushResult ? "si" : "no",
                    ultimaRecepcionForeground: foregroundPushResult?.receivedAt || "",
                    code: pushTestResult.body?.code,
                    etapa: pushTestResult.body?.stage,
                    source: pushTestResult.body?.source,
                    hint: pushTestResult.body?.hint,
                    mensaje: pushTestResult.body?.message || pushTestResult.error
                  }, null, 2)}</pre>
                ) : <p>Sin prueba registrada.</p>}
                <div className="rounded-xl bg-ink/5 p-2 text-[11px] leading-5 dark:bg-white/10">
                  <p className="font-semibold text-ink">Recepción foreground</p>
                  <p>{foregroundPushResult ? `Mensaje recibido con la app abierta: ${foregroundPushResult.title}` : "Sin mensaje recibido con la app abierta en este navegador."}</p>
                </div>
                <div className="rounded-xl bg-ink/5 p-2 text-[11px] leading-5 dark:bg-white/10">
                  <p className="font-semibold text-ink">Recepción background / service worker</p>
                  <p>{backgroundPushResult ? `Mensaje recibido por service worker: ${backgroundPushResult.title}` : "Sin mensaje background registrado en este navegador."}</p>
                </div>
                <p className="pt-2 font-semibold text-ink">Último envío automático</p>
                {pushAutoResult ? (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-ink/5 p-2 text-[11px] dark:bg-white/10">{JSON.stringify({
                    hora: pushAutoResult.at,
                    eventoGuardado: pushAutoResult.eventoGuardado ?? true,
                    novedadInternaCreada: pushAutoResult.novedadInternaCreada ?? Boolean(pushAutoResult.notificationId),
                    pushIntentado: pushAutoResult.pushIntentado ?? !pushAutoResult.skipped,
                    pushEnviado: pushAutoResult.pushEnviado ?? Number(pushAutoResult.body?.sent || 0) > 0,
                    notificationId: pushAutoResult.notificationId,
                    scheduleId: pushAutoResult.scheduleId,
                    songId: pushAutoResult.songId,
                    statusHttp: pushAutoResult.status,
                    source: pushAutoResult.body?.source,
                    deduplicado: pushAutoResult.body?.deduplicated || pushAutoResult.body?.duplicate || false,
                    tokensEncontrados: pushAutoResult.body?.tokensFound,
                    tokensActivos: pushAutoResult.body?.activeTokens,
                    tokensUnicos: pushAutoResult.body?.uniqueTokens,
                    tokensDuplicados: pushAutoResult.body?.duplicateTokens,
                    tokensIntentados: pushAutoResult.body?.tokensAttempted,
                    enviados: pushAutoResult.body?.sent,
                    fallidos: pushAutoResult.body?.failed,
                    invalidos: pushAutoResult.body?.invalidTokens,
                    code: pushAutoResult.body?.code,
                    etapa: pushAutoResult.body?.stage,
                    mensaje: pushAutoResult.body?.message || pushAutoResult.error
                  }, null, 2)}</pre>
                ) : <p>Sin envío automático registrado en este navegador.</p>}
                {tokenCleanupResult ? (
                  <div className="rounded-xl bg-ink/5 p-2 text-[11px] leading-5 dark:bg-white/10">
                    <p className="font-semibold text-ink">Limpieza de tokens</p>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white/60 p-2 dark:bg-white/10">{JSON.stringify(tokenCleanupResult, null, 2)}</pre>
                  </div>
                ) : null}
                <div className="rounded-xl bg-brass/10 p-2 text-[11px] leading-5 text-ink/70">
                  <p className="font-semibold text-ink">Si FCM envia pero no ves la notificación</p>
                  <p>Revisa que Chrome tenga notificaciones permitidas en Windows, que No molestar/Focus Assist este desactivado, que el sitio tenga permiso en Chrome y prueba con la app en segundo plano.</p>
                </div>
              </div>
              ) : null}
            </>
          ) : null}
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-brass/12 p-3 text-brass">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Instalar app</h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                Instala Roca Eterna Música para abrirla como app en tu celular o computadora.
              </p>
            </div>
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={installApp} disabled={isStandalone}>
            {isStandalone ? "App instalada" : "Instalar app"}
          </Button>
          {installStatus ? <p className="mt-3 rounded-2xl bg-ink/5 p-3 text-sm text-ink/65">{installStatus}</p> : null}
          {!installPromptEvent && !isStandalone ? (
            <p className="mt-3 text-xs leading-5 text-ink/55">
              Si el botón no abre un permiso de instalación, usa el menú del navegador y elige Instalar app o Agregar a pantalla principal.
            </p>
          ) : null}
        </Card>

        {!isViewer ? (
        <Card>
          <h2 className="text-xl font-bold text-ink">Actualizar app</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">Limpia caché local y recarga si la PWA muestra una versión vieja.</p>
          <dl className="mt-4 grid gap-2 rounded-2xl bg-ink/5 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink/55">Versión instalada</dt>
              <dd className="font-semibold text-ink">{appVersion}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink/55">Última versión disponible</dt>
              <dd className="font-semibold text-ink">{latestVersion?.displayVersion || (latestVersion ? appVersion : "sin revisar")}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink/55">Estado</dt>
              <dd className="font-semibold text-ink">{latestVersion?.version && compareVersions(latestVersion.version, appBuildVersion) > 0 ? "actualización disponible" : "actualizado"}</dd>
            </div>
          </dl>
          <Button className="mt-4 w-full" variant="secondary" onClick={refreshApp} disabled={isRefreshingApp}>
            {isRefreshingApp ? "Actualizando..." : latestVersion?.version && compareVersions(latestVersion.version, appBuildVersion) > 0 ? "Actualizar ahora" : "Buscar y actualizar"}
          </Button>
          {updateStatus ? <p className="mt-3 rounded-2xl bg-ink/5 p-3 text-sm text-ink/65">{updateStatus}</p> : null}
        </Card>
        ) : null}

      </aside>
    </div>

    {canViewUserActivity ? (
      <Modal
        open={Boolean(activityUser)}
        title={activityUser ? `Actividad de ${activityUser.displayName || activityUser.email}` : "Actividad"}
        onClose={() => setActivityUser(null)}
        wide
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-ink/10 bg-white/85 p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.07]">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-white/45">Tiempo acumulado</p>
              <p className="mt-2 text-2xl font-black text-ink dark:text-white">{formatDuration(activityUser?.activityTotalMs || 0)}</p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white/85 p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.07]">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-white/45">Última desconexión</p>
              <p className="mt-2 text-sm font-bold text-ink dark:text-white">{formatExactDate(activityUser?.lastDisconnectedAt, "Sin registro")}</p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white/85 p-4 shadow-soft dark:border-white/10 dark:bg-white/[0.07]">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-white/45">Eventos mostrados</p>
              <p className="mt-2 text-2xl font-black text-ink dark:text-white">{selectedUserActivity.length}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Día">
              <Select value={activityDayFilter} onChange={(event) => setActivityDayFilter(event.target.value)}>
                <option value="all">Todos los días</option>
                {activityDays.map((day) => <option key={day} value={day}>{formatActivityDay(day)}</option>)}
              </Select>
            </Field>
            <Field label="Sección">
              <Select value={activitySectionFilter} onChange={(event) => setActivitySectionFilter(event.target.value)}>
                <option value="all">Todas</option>
                {activitySections.map((section) => <option key={section} value={section}>{section}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de actividad">
              <Select value={activityTypeFilter} onChange={(event) => setActivityTypeFilter(event.target.value)}>
                <option value="all">Todas</option>
                {activityTypes.map((type) => <option key={type} value={type}>{activityTypeLabel(type)}</option>)}
              </Select>
            </Field>
          </div>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {selectedUserActivity.length ? selectedUserActivity.map((item) => (
              <div key={item.id || `${item.sessionId}-${item.clientTimestamp}-${item.targetLabel}`} className="rounded-2xl border border-ink/10 bg-white/90 p-4 text-sm shadow-soft dark:border-white/10 dark:bg-zinc-900/95">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brass/12 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-brass">
                        {item.eventType === "click" ? <MousePointerClick className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {activityTypeLabel(item.eventType)}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold text-ink/60 dark:bg-white/10 dark:text-white/70">{item.section || "sin sección"}</span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold text-ink/50 dark:bg-white/10 dark:text-white/60">{formatActivityDay(activityDateKey(item))}</span>
                    </div>
                    {item.targetLabel ? <p className="mt-2 font-bold text-ink dark:text-white">{item.targetLabel}</p> : null}
                    <p className="mt-1 break-all text-xs text-ink/50 dark:text-white/55">{item.route || "sin ruta"}</p>
                  </div>
                  <p className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold text-ink/55 dark:bg-white/10 dark:text-white/65">{formatExactDate(item.createdAt || item.clientTimestamp, "Sin hora")}</p>
                </div>
                {item.durationMs ? (
                  <p className="mt-3 text-xs font-semibold text-ink/60 dark:text-white/65">Duración: {formatDuration(item.durationMs)}</p>
                ) : null}
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-ink/15 p-5 text-sm text-ink/55 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/60">
                No hay actividad registrada con estos filtros.
              </div>
            )}
          </div>
        </div>
      </Modal>
    ) : null}
    </>
  );
}

function LogoPreview({ title, logo, source, alt, dark = false, invert = false, onDiagnose }) {
  const resolvedUrl = source ? resolvePublicAssetUrl(source) : "";
  const previewLabel = resolvedUrl || "Logo por defecto";

  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-white/10 bg-ink text-white" : "border-ink/10 bg-white text-ink"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-bold ${dark ? "text-white" : "text-ink"}`}>{title}</p>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${dark ? "bg-white/10 text-white/70" : "bg-ink/5 text-ink/55"}`}>
          {source ? "Configurado" : "Fallback"}
        </span>
      </div>
      <div className={`mt-3 flex h-28 items-center justify-center rounded-2xl border ${dark ? "border-white/10 bg-black" : "border-ink/10 bg-stonewash"}`}>
        <img src={logo || fallbackAppLogo} alt={alt} className={`max-h-24 max-w-full object-contain ${invert ? "invert" : ""}`} />
      </div>
      <div className={`mt-3 space-y-1 text-xs ${dark ? "text-white/60" : "text-ink/55"}`}>
        <p className="break-all">Ruta guardada: {source || "Logo por defecto"}</p>
        <p className="break-all">URL resuelta: {previewLabel}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onDiagnose} disabled={!source}>Probar logo</Button>
        <Button
          variant="subtle"
          disabled={!resolvedUrl}
          onClick={() => resolvedUrl && window.open(resolvedUrl, "_blank", "noopener,noreferrer")}
        >
          Abrir URL resuelta
        </Button>
      </div>
    </div>
  );
}

function PdfIndexSummary({ result }) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-semibold text-ink/60">
        Encontrados {result.found}, indexados {result.indexed}, reutilizados {result.reused || 0}, con OCR {(result.ocrItems || []).length}, sin texto {result.noText}, no encontrados {result.missing}, errores {result.failed}
      </p>
      <PdfIndexList title="Indexados correctamente" items={result.indexedItems} />
      <PdfIndexList title="Indexados con OCR" items={result.ocrItems} />
      <PdfIndexList title="Sin texto extraible" items={result.noTextItems} fallbackMessage="El PDF existe, pero no tiene texto seleccionable." />
      <PdfIndexList title="No encontrados" items={result.missingItems} showUrl />
      <PdfIndexList title="Errores" items={result.errorItems} showUrl />
    </div>
  );
}

function PdfIndexList({ title, items = [], showUrl = false, fallbackMessage = "" }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="rounded-full bg-ink/7 px-2 py-1 text-xs font-bold text-ink/55">{items.length}</span>
      </div>
      {items.length ? (
        <div className="mt-3 max-h-52 space-y-2 overflow-auto">
          {items.map((item, index) => (
            <div key={`${item.title}-${item.localPdfPath}-${index}`} className="rounded-xl bg-ink/5 p-3 text-xs text-ink/60 dark:bg-white/5 dark:text-white/65">
              <p className="font-bold text-ink">{item.title}</p>
              <p className="break-all">Ruta guardada: {item.localPdfPath || "--"}</p>
              {showUrl ? <p className="break-all">URL resuelta: {item.resolvedUrl || "--"}</p> : null}
              {item.statusHttp ? <p>Status HTTP: {item.statusHttp}</p> : null}
              {item.method ? <p>Método: {item.method === "ocr" ? "OCR automático" : "texto seleccionable"}</p> : null}
              {(item.message || fallbackMessage) ? <p>{item.message || fallbackMessage}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/45">Sin elementos.</p>
      )}
    </div>
  );
}


