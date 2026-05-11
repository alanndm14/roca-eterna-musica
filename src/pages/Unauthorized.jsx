import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";

export function Unauthorized() {
  const { signOut, error } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-6">
      <div className="max-w-lg rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-700">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-ink">Acceso no autorizado</h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          Tu cuenta de Google inició sesión correctamente, pero tu correo no está autorizado para entrar al ministerio de música.
        </p>
        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={signOut}>Cerrar sesión</Button>
          <Link to="/login">
            <Button variant="secondary">Volver</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
