import { Navigate, Route, Routes } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { WelcomeSplash } from "./components/ui/WelcomeSplash";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { MusicDataProvider, useMusicData } from "./hooks/useMusicData";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Login } from "./pages/Login";
import { MusicianView } from "./pages/MusicianView";
import { Schedules } from "./pages/Schedules";
import { Settings } from "./pages/Settings";
import { SongDetail } from "./pages/SongDetail";
import { Songs } from "./pages/Songs";
import { Stats } from "./pages/Stats";
import { Unauthorized } from "./pages/Unauthorized";

function ProtectedRoute({ children }) {
  const { user, profile, loading, unauthorized } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (unauthorized || !profile?.active) return <Unauthorized />;

  return <MusicDataProvider>{children}</MusicDataProvider>;
}

function DataReady({ children }) {
  const { profile } = useAuth();
  const { loading } = useMusicData();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (loading || !profile?.active) return;
    if (sessionStorage.getItem("roca-eterna-welcome-shown") === "true") return;
    sessionStorage.setItem("roca-eterna-welcome-shown", "true");
    setShowWelcome(true);
  }, [loading, profile?.active]);

  const finishWelcome = useCallback(() => setShowWelcome(false), []);

  if (loading) return <LoadingScreen />;
  if (showWelcome) return <WelcomeSplash profile={profile} onDone={finishWelcome} />;
  return children;
}

function LoginRoute() {
  const { user, profile, loading, unauthorized } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && profile && !unauthorized) return <Navigate to="/" replace />;
  return <Login />;
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
          <Route path="historial" element={<History />} />
          <Route path="estadisticas" element={<Stats />} />
          <Route path="configuracion" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
