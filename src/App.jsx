import { Navigate, Route, Routes } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { OnboardingGuide } from "./components/ui/OnboardingGuide";
import { WelcomeSplash } from "./components/ui/WelcomeSplash";
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
          <Route path="programacion" element={<Schedules />} />
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
