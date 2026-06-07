import { Navigate, Route, Routes } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { AppShell } from "./components/layout/AppShell";
import { OnboardingGuide } from "./components/ui/OnboardingGuide";
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
import { SmartCenter } from "./pages/SmartCenter";
import { SongDetail } from "./pages/SongDetail";
import { Songs } from "./pages/Songs";
import { Stats } from "./pages/Stats";
import { Unauthorized } from "./pages/Unauthorized";
import { appVersion } from "./data/changelog";
import { activateLatestAppVersion, compareVersions, fetchLatestVersion, getInstalledVersion, markInstalledVersion, wasUpdateDismissed } from "./services/appUpdate";

function SilentStartupFrame() {
  return <div className="min-h-screen bg-stonewash" aria-hidden="true" />;
}

function ProtectedRoute({ children }) {
  const { user, profile, loading, unauthorized } = useAuth();

  if (loading) return <SilentStartupFrame />;
  if (!user) return <Navigate to="/login" replace />;
  if (unauthorized || !profile?.active) return <Unauthorized />;

  return <MusicDataProvider>{children}</MusicDataProvider>;
}

function DataReady({ children }) {
  const { profile, completeOnboarding } = useAuth();
  const { loading, settings } = useMusicData();
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideChecked, setGuideChecked] = useState(false);
  const [updateCheck, setUpdateCheck] = useState({ checked: false, update: null });

  useEffect(() => {
    const openGuide = () => setShowGuide(true);
    window.addEventListener("roca-eterna-open-guide", openGuide);
    return () => window.removeEventListener("roca-eterna-open-guide", openGuide);
  }, []);

  useEffect(() => {
    if (loading || !profile?.active || !welcomeReady || guideChecked) return;
    const completed = profile.onboardingCompleted || localStorage.getItem(`roca-eterna-onboarding-${profile.uid}`) === "true";
    if (!completed) setShowGuide(true);
    setGuideChecked(true);
  }, [guideChecked, loading, profile, welcomeReady]);

  const finishWelcome = useCallback(() => {
    setWelcomeReady(true);
  }, []);

  const finishGuide = useCallback(async () => {
    await completeOnboarding?.();
  }, [completeOnboarding]);

  const themeMode = profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system";
  const effectiveTheme = getEffectiveThemeMode(themeMode);
  const logoSrc = getInstitutionalLogo(settings, effectiveTheme === "dark" ? appDarkLogo : appLogo, themeMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  }, [effectiveTheme]);

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
    return <div className="min-h-screen bg-stonewash" aria-hidden="true" />;
  }

  if (updateCheck.update) {
    return <StartupUpdateScreen update={updateCheck.update} />;
  }

  if (loading || !welcomeReady) {
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
          <Route path="programacion" element={<RoleRoute roles={["admin", "editor"]}><Schedules /></RoleRoute>} />
          <Route path="musicos" element={<MusicianView />} />
          <Route path="inteligente" element={<RoleRoute roles={["admin", "editor"]}><SmartCenter /></RoleRoute>} />
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
