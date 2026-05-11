import logo from "../../assets/logo-roca-eterna.svg";

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-6">
      <div className="text-center">
        <img src={logo} alt="Roca Eterna Música" className="mx-auto h-20 w-20 animate-pulse rounded-3xl" />
        <p className="mt-4 text-sm font-semibold text-ink/60">Cargando ministerio de música...</p>
      </div>
    </div>
  );
}
