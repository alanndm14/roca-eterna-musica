import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { getEffectiveThemeMode } from "../../services/songUtils";

export function LoadingScreen() {
  const effectiveTheme = getEffectiveThemeMode(localStorage.getItem("roca-eterna-theme-mode") || "system");
  const logoSrc = (effectiveTheme === "dark"
    ? localStorage.getItem("roca-eterna-logo-dark-src")
    : localStorage.getItem("roca-eterna-logo-light-src")) || localStorage.getItem("roca-eterna-logo-src") || appLogo;
  const logoAlt = localStorage.getItem("roca-eterna-logo-alt") || "Roca Eterna Música";

  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-6">
      <div className="text-center">
        <img
          src={logoSrc}
          onError={(event) => {
            event.currentTarget.src = fallbackAppLogo;
          }}
          alt={logoAlt}
          className={`mx-auto h-20 w-20 animate-pulse rounded-3xl object-contain p-1 ${effectiveTheme === "dark" ? "bg-zinc-950" : "bg-white"}`}
        />
        <p className="mt-4 text-sm font-semibold text-ink/60">Cargando ministerio de música...</p>
      </div>
    </div>
  );
}
