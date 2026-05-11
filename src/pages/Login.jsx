import { LogIn, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import logo from "../assets/logo-roca-eterna.svg";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signInWithGoogle, enterDemoMode, error, isFirebaseConfigured } = useAuth();

  return (
    <div className="grid min-h-screen bg-ink text-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative flex items-center overflow-hidden px-6 py-12 md:px-12">
        <div className="absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(circle_at_28%_20%,rgba(182,148,95,0.22),transparent_34%),linear-gradient(180deg,transparent,rgba(255,255,255,0.06))]" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 max-w-xl"
        >
          <img src={logo} alt="Roca Eterna Música" className="h-24 w-24 rounded-3xl shadow-2xl" />
          <h1 className="mt-8 text-4xl font-bold leading-tight tracking-normal md:text-6xl">
            Roca Eterna Música
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/68">
            Organización del ministerio de música de Roca Eterna.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button variant="light" onClick={signInWithGoogle}>
              <LogIn className="h-4 w-4" />
              Entrar con Google
            </Button>
            {!isFirebaseConfigured ? (
              <Button variant="darkSubtle" onClick={enterDemoMode}>
                Modo demo local
              </Button>
            ) : null}
          </div>
          {error ? <p className="mt-4 rounded-2xl bg-red-500/12 p-3 text-sm text-red-100">{error}</p> : null}
        </motion.div>
      </section>

      <section className="flex items-center bg-stonewash px-6 py-10 text-ink md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="w-full rounded-3xl border border-ink/10 bg-white p-6 shadow-soft md:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-brass/12 p-3 text-brass">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Acceso protegido</h2>
              <p className="text-sm text-ink/55">Solo correos autorizados del ministerio.</p>
            </div>
          </div>
          <div className="space-y-4 text-sm leading-6 text-ink/65">
            <p>La app usa Firebase Authentication con Google Sign-In.</p>
            <p>Los roles se validan contra Firestore y sus reglas de seguridad, no solo desde la interfaz.</p>
            <p>No se almacenan datos sensibles de miembros; solo repertorio, programación, notas musicales y usuarios autorizados.</p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
