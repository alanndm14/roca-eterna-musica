import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { AppShell } from "./components/layout/AppShell";
import { OnboardingGuide } from "./components/ui/OnboardingGuide";
import { DailyVerseWelcome } from "./components/ui/DailyVerseWelcome";
import { WelcomeSplash } from "./components/ui/WelcomeSplash";
import { Button } from "./components/ui/Button";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { MusicDataProvider, useMusicData } from "./hooks/useMusicData";
import { appDarkLogo, appLogo } from "./assets/logo";
import { getEffectiveThemeMode, getInstitutionalLogo } from "./services/songUtils";
import { Dashboard } from "./pages/Dashboard";
import { AuditLogs } from "./pages/AuditLogs";
import { Changelog } from "./pages/Changelog";
import { History } from "./pages/History";
import { Login } from "./pages/Login";
import { MusicianView } from "./pages/MusicianView";
import { Schedules } from "./pages/Schedules";
import { Settings } from "./pages/Settings";
import { SongDetail } from "./pages/SongDetail";
import { Songs } from "./pages/Songs";
import { Stats } from "./pages/Stats";
import { Unauthorized } from "./pages/Unauthorized";
import { appVersion } from "./data/changelog";
import { activateLatestAppVersion, compareVersions, fetchLatestVersion, getInstalledVersion, markInstalledVersion, wasUpdateDismissed } from "./services/appUpdate";
import { fallbackLoginVerses, fetchDailyVerse, getDeterministicDailyVerse, getLocalDateKey } from "./services/dailyVerses";

function SilentStartupFrame() {
  return <div className="min-h-screen bg-stonewash" aria-hidden="true" />;
}

function ProtectedRoute({ children }) {
  const { user, profile, loading, unauthorized } = useAuth();
  let content = children;
  if (loading) content = <SilentStartupFrame />;
  else if (!user) content = <Navigate to="/login" replace />;
  else if (unauthorized || !profile?.active) content = <Unauthorized />;

  return <MusicDataProvider>{content}</MusicDataProvider>;
}

function DataReady({ children }) {
  const { profile, completeOnboarding } = useAuth();
  const { loading, settings } = useMusicData();
  const dateKey = getLocalDateKey();
  const dailySeenKey = profile?.uid ? `dailyVerseSeen:${profile.uid}` : "";
  const [startupPhase, setStartupPhase] = useState(() => (
    dailySeenKey && localStorage.getItem(dailySeenKey) !== dateKey ? "showing-daily-verse" : "app"
  ));
  const [dailyVerse, setDailyVerse] = useState(() => getDeterministicDailyVerse(fallbackLoginVerses, dateKey));
  const [previewDailyVerse, setPreviewDailyVerse] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideChecked, setGuideChecked] = useState(false);
  const [updateCheck, setUpdateCheck] = useState({ checked: false, update: null });

  useEffect(() => {
    const openGuide = () => setShowGuide(true);
    window.addEventListener("roca-eterna-open-guide", openGuide);
    return () => window.removeEventListener("roca-eterna-open-guide", openGuide);
  }, []);

  useEffect(() => {
    if (loading || !profile?.active || startupPhase !== "app" || guideChecked) return;
    const completed = profile.onboardingCompleted || localStorage.getItem(`roca-eterna-onboarding-${profile.uid}`) === "true";
    if (!completed) setShowGuide(true);
    setGuideChecked(true);
  }, [guideChecked, loading, profile, startupPhase]);

  const finishWelcome = useCallback(() => {
    setStartupPhase("app");
  }, []);

  const finishGuide = useCallback(async () => {
    await completeOnboarding?.();
  }, [completeOnboarding]);

  const themeMode = profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system";
  const effectiveTheme = getEffectiveThemeMode(themeMode);
  const logoSrc = getInstitutionalLogo(settings, effectiveTheme === "dark" ? appDarkLogo : appLogo, themeMode);
  const loadDailyVerse = useCallback((nextDateKey = getLocalDateKey()) => {
    const fallback = getDeterministicDailyVerse(fallbackLoginVerses, nextDateKey);
    setDailyVerse(fallback);
    fetchDailyVerse(nextDateKey)
      .then((verse) => setDailyVerse((current) => verse || current || fallback))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  }, [effectiveTheme]);

  useEffect(() => {
    if (!profile?.uid || !profile.active) return;
    const today = getLocalDateKey();
    if (localStorage.getItem(`dailyVerseSeen:${profile.uid}`) !== today) {
      loadDailyVerse(today);
      setStartupPhase((current) => current === "showing-welcome" ? current : "showing-daily-verse");
    }
  }, [loadDailyVerse, profile?.active, profile?.uid]);

  useEffect(() => {
    const preview = () => {
      setPreviewDailyVerse(true);
      loadDailyVerse(getLocalDateKey());
      setStartupPhase("showing-daily-verse");
    };
    window.addEventListener("roca-eterna-preview-daily-verse", preview);
    return () => window.removeEventListener("roca-eterna-preview-daily-verse", preview);
  }, [loadDailyVerse]);

  useEffect(() => {
    const checkNewDay = () => {
      if (document.visibilityState !== "visible" || !profile?.uid || startupPhase !== "app") return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const today = getLocalDateKey();
      if (localStorage.getItem(`dailyVerseSeen:${profile.uid}`) === today) return;
      setPreviewDailyVerse(false);
      loadDailyVerse(today);
      setStartupPhase("showing-daily-verse");
    };
    document.addEventListener("visibilitychange", checkNewDay);
    return () => document.removeEventListener("visibilitychange", checkNewDay);
  }, [loadDailyVerse, profile?.uid, startupPhase]);

  useEffect(() => {
    let cancelled = false;
    fetchLatestVersion()
      .then((latest) => {
        if (cancelled) return;
        const installed = getInstalledVersion();
        const hasUpdate = latest?.version
          && compareVersions(latest.version, appVersion) > 0
          && (!wasUpdateDismissed(latest.version) || latest.critical);
        if (!hasUpdate) markInstalledVersion(appVersion);
        setUpdateCheck({ checked: true, update: hasUpdate ? { ...latest, installedVersion: installed || appVersion } : null });
      })
      .catch(() => {
        markInstalledVersion(appVersion);
        if (!cancelled) setUpdateCheck({ checked: true, update: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateCheck.checked) {
    return <SilentStartupFrame />;
  }

  if (updateCheck.update) {
    return <StartupUpdateScreen update={updateCheck.update} />;
  }

  if (startupPhase === "showing-daily-verse" || startupPhase === "leaving-daily-verse") {
    return (
      <DailyVerseWelcome
        verse={dailyVerse}
        logoSrc={logoSrc}
        logoAlt={settings?.logoAltText || "Roca Eterna Música"}
        leaving={startupPhase === "leaving-daily-verse"}
        onContinue={() => setStartupPhase("leaving-daily-verse")}
        onExited={() => {
          if (!previewDailyVerse && profile?.uid) {
            localStorage.setItem(`dailyVerseSeen:${profile.uid}`, getLocalDateKey());
            setStartupPhase("showing-welcome");
            return;
          }
          setPreviewDailyVerse(false);
          setStartupPhase("app");
        }}
      />
    );
  }

  if (startupPhase === "showing-welcome" || (loading && startupPhase !== "app")) {
    return (
      <WelcomeSplash
        profile={profile}
        onDone={finishWelcome}
        logoSrc={logoSrc}
        logoAlt={settings?.logoAltText || "Roca Eterna Música"}
        logoMode={effectiveTheme}
        ready={!loading && Boolean(profile?.active)}
      />
    );
  }

  return (
    <>
      {children}
      <OnboardingGuide
        open={showGuide}
        onClose={() => setShowGuide(false)}
        onFinish={finishGuide}
        logoSrc={logoSrc}
        logoAlt={settings?.logoAltText || "Roca Eterna Música"}
        logoMode={effectiveTheme}
        role={profile?.role || "viewer"}
        viewerType={profile?.viewerType || "corista"}
      />
    </>
  );
}

function StartupUpdateScreen({ update }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-5 text-ink">
      <motion.section
        className="w-full max-w-xl rounded-[2rem] border border-brass/35 bg-white p-6 shadow-2xl dark:border-brass/25 dark:bg-zinc-900"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-brass/12 px-3 py-1 text-xs font-black uppercase tracking-wide text-brass">
          <Sparkles className="h-4 w-4" />
          Actualización disponible
        </div>
        <h1 className="mt-4 text-2xl font-black text-ink">Hay una nueva versión de Roca Eterna Música.</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">Actualiza antes de cargar la app para usar la versión más reciente.</p>
        <ul className="mt-4 space-y-2 text-sm font-semibold text-ink/70">
          {(update.changes || []).slice(0, 3).map((change) => <li key={change}>- {change}</li>)}
        </ul>
        <p className="mt-4 text-xs font-bold text-ink/45">Instalada: {update.installedVersion || appVersion} · Disponible: {update.version}</p>
        <Button className="mt-5 w-full" onClick={() => activateLatestAppVersion(update.version)}>
          <RefreshCw className="h-4 w-4" />
          Actualizar ahora
        </Button>
      </motion.section>
    </div>
  );
}

function LoginRoute() {
  const { user, profile, loading, unauthorized } = useAuth();
  if (loading) return <SilentStartupFrame />;
  if (user && profile && !unauthorized) return <Navigate to="/" replace />;
  return <Login />;
}

function RoleRoute({ roles, children }) {
  const { profile } = useAuth();
  return roles.includes(profile?.role || "viewer") ? children : <Navigate to="/" replace />;
}

function ViewerExperienceRoute({ media = false, children }) {
  const { profile } = useAuth();
  const location = useLocation();
  if (media && profile?.role !== "viewer") return <Navigate to={`/programacion${location.search || ""}`} replace />;
  if (profile?.role !== "viewer") return children;
  if (!media) return <Navigate to={`/servicios${location.search || ""}`} replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          element={
            <ProtectedRoute>
              <DataReady>
                <AppShell />
              </DataReady>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="repertorio" element={<Songs />} />
          <Route path="repertorio/:songId" element={<SongDetail />} />
          <Route path="programacion" element={<ViewerExperienceRoute><Schedules /></ViewerExperienceRoute>} />
          <Route path="musicos" element={<ViewerExperienceRoute><MusicianView /></ViewerExperienceRoute>} />
          <Route path="servicios" element={<ViewerExperienceRoute media><MusicianView mediaMode /></ViewerExperienceRoute>} />
          <Route path="inteligente" element={<RoleRoute roles={["admin", "editor"]}><Navigate to="/programacion?tab=asistente" replace /></RoleRoute>} />
          <Route path="historial" element={<RoleRoute roles={["admin", "editor"]}><History /></RoleRoute>} />
          <Route path="estadisticas" element={<RoleRoute roles={["admin", "editor"]}><Stats /></RoleRoute>} />
          <Route path="configuracion" element={<Settings />} />
          <Route path="auditoria" element={<RoleRoute roles={["admin"]}><AuditLogs /></RoleRoute>} />
          <Route path="actualizaciones" element={<RoleRoute roles={["admin", "editor"]}><Changelog /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
