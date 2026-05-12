import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { Button } from "../ui/Button";
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

  const openGuide = () => window.dispatchEvent(new Event("roca-eterna-open-guide"));

  return (
    <div className="min-h-screen bg-stonewash text-ink" style={shellStyle}>
      <Sidebar profile={profile} collapsed={sidebarCollapsed} />
      <main className={`app-main pb-32 transition-all duration-200 lg:pb-0 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <header className="app-header sticky top-0 z-30 border-b border-ink/10 bg-stonewash/86 px-4 py-3 backdrop-blur md:px-8 md:py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={appLogo}
                onError={(event) => {
                  event.currentTarget.src = fallbackAppLogo;
                }}
                alt="Roca Eterna Música"
                className="h-11 w-11 shrink-0 rounded-2xl bg-white object-contain p-1 shadow-soft lg:hidden"
              />
              <Button
                variant="subtle"
                className="hidden h-10 w-10 px-0 lg:inline-flex"
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">
                  {settings.churchName || "Roca Eterna"}
                </p>
                <h1 className="truncate text-xl font-bold tracking-normal text-ink md:text-2xl">{pageTitle}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {useLocal ? (
                <span className="hidden rounded-full bg-brass/12 px-3 py-1 text-xs font-semibold text-brass sm:inline-flex">
                  Modo demo
                </span>
              ) : null}
              <Button variant="subtle" className="h-10 w-10 px-0" onClick={openGuide} aria-label="Guía de uso">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-6">
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
