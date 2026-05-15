import { appLogo, fallbackAppLogo } from "../../assets/logo";

export function LoadingScreen() {
  const logoSrc = localStorage.getItem("roca-eterna-logo-src") || appLogo;
  const logoAlt = localStorage.getItem("roca-eterna-logo-alt") || "Roca Eterna Musica";
  const logoInvert = localStorage.getItem("roca-eterna-logo-invert") === "true";

  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-6">
      <div className="text-center">
        <img
          src={logoSrc}
          onError={(event) => {
            event.currentTarget.src = fallbackAppLogo;
          }}
          alt={logoAlt}
          className={`mx-auto h-20 w-20 animate-pulse rounded-3xl bg-white object-contain p-1 ${logoInvert ? "invert" : ""}`}
        />
        <p className="mt-4 text-sm font-semibold text-ink/60">Cargando ministerio de musica...</p>
      </div>
    </div>
  );
}
