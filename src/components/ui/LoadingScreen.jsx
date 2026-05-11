import { appLogo, fallbackAppLogo } from "../../assets/logo";

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-6">
      <div className="text-center">
        <img src={appLogo} onError={(event) => { event.currentTarget.src = fallbackAppLogo; }} alt="Roca Eterna Música" className="mx-auto h-20 w-20 animate-pulse rounded-3xl bg-white object-contain p-1" />
        <p className="mt-4 text-sm font-semibold text-ink/60">Cargando ministerio de música...</p>
      </div>
    </div>
  );
}
