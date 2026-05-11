import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

const pageNames = {
  "/": "Inicio",
  "/repertorio": "Repertorio",
  "/programacion": "Programación",
  "/musicos": "Vista para músicos",
  "/historial": "Historial",
  "/estadisticas": "Estadísticas",
  "/configuracion": "Configuración"
};

export function AppShell() {
  const location = useLocation();
  const { profile } = useAuth();
  const { settings, useLocal } = useMusicData();
  const pageTitle = pageNames[location.pathname] || "Roca Eterna Música";
  const isDark = settings.themeMode === "dark";
  const shellStyle = {
    "--color-brass": hexToRgb(settings.accentColor || "#b6945f"),
    "--color-blue-gray": hexToRgb(settings.blueGrayColor || "#60717d")
  };

  return (
    <div className={`min-h-screen bg-stonewash text-ink ${isDark ? "dark" : ""}`} style={shellStyle}>
      <Sidebar profile={profile} />
      <main className="pb-24 lg:ml-72 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-ink/10 bg-stonewash/86 px-4 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                {settings.churchName || "Roca Eterna"}
              </p>
              <h1 className="text-2xl font-bold tracking-normal text-ink">{pageTitle}</h1>
            </div>
            {useLocal ? (
              <span className="rounded-full bg-brass/12 px-3 py-1 text-xs font-semibold text-brass">
                Modo demo
              </span>
            ) : null}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "182 148 95";
  return `${parseInt(normalized.slice(0, 2), 16)} ${parseInt(normalized.slice(2, 4), 16)} ${parseInt(normalized.slice(4, 6), 16)}`;
}
