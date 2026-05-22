import { useState } from "react";
import { appDarkLogo, appLogo } from "../../assets/logo";
import { getEffectiveThemeMode, resolvePublicAssetUrl } from "../../services/songUtils";

export function LoadingScreen() {
  const effectiveTheme = getEffectiveThemeMode(localStorage.getItem("roca-eterna-theme-mode") || "system");
  const logoSrc = resolvePublicAssetUrl((effectiveTheme === "dark"
    ? localStorage.getItem("roca-eterna-logo-dark-src")
    : localStorage.getItem("roca-eterna-logo-light-src")) || (effectiveTheme === "dark" ? appDarkLogo : appLogo));
  const logoAlt = localStorage.getItem("roca-eterna-logo-alt") || "Roca Eterna Musica";
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-6">
      <div className="text-center">
        {!imageFailed && logoSrc ? (
          <img
            src={logoSrc}
            onError={() => setImageFailed(true)}
            alt={logoAlt}
            className={`mx-auto h-20 w-20 animate-pulse rounded-3xl object-contain p-1 ${effectiveTheme === "dark" ? "bg-zinc-950" : "bg-white"}`}
          />
        ) : (
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-ink text-lg font-bold text-white">RE</div>
        )}
        <p className="mt-4 text-sm font-semibold text-ink/60">Cargando ministerio de musica...</p>
      </div>
    </div>
  );
}
