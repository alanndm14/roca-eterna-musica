import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "../ui/Button";
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

const sidebarStorageKey = "roca-eterna-sidebar-collapsed";

export function AppShell() {
  const location = useLocation();
  const { profile } = useAuth();
  const { settings, useLocal } = useMusicData();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarStorageKey) === "true");
  const pageTitle = pageNames[location.pathname] || "Roca Eterna Música";
  const themeMode = settings.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "light";
  const shellStyle = {
    "--color-brass": hexToRgb(settings.accentColor || "#b6945f"),
    "--color-blue-gray": hexToRgb(settings.blueGrayColor || "#60717d")
  };

  useEffect(() => {
    localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const shouldUseDark = themeMode === "dark" || (themeMode === "system" && media?.matches);
      document.documentElement.classList.toggle("dark", Boolean(shouldUseDark));
      localStorage.setItem("roca-eterna-theme-mode", themeMode);
    };

    applyTheme();
    media?.addEventListener?.("change", applyTheme);
    return () => media?.removeEventListener?.("change", applyTheme);
  }, [themeMode]);

  return (
    <div className="min-h-screen bg-stonewash text-ink" style={shellStyle}>
      <Sidebar profile={profile} collapsed={sidebarCollapsed} />
      <main className={`app-main pb-24 transition-all duration-200 lg:pb-0 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <header className="app-header sticky top-0 z-30 border-b border-ink/10 bg-stonewash/86 px-4 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="subtle"
                className="hidden h-10 w-10 px-0 lg:inline-flex"
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                  {settings.churchName || "Roca Eterna"}
                </p>
                <h1 className="text-2xl font-bold tracking-normal text-ink">{pageTitle}</h1>
              </div>
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
