import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { appDarkLogo, appLogo } from "../assets/logo";
import { Button } from "../components/ui/Button";
import { UpdateProgressOverlay } from "../components/ui/UpdateProgressOverlay";
import { useAuth } from "../hooks/useAuth";
import { firebaseMissingConfigKeys, isDemoModeAllowed } from "../lib/firebase";
import { fetchDailyVerse, fallbackLoginVerses, getDeterministicDailyVerse, getLocalDateKey } from "../services/dailyVerses";
import { getEffectiveThemeMode, resolvePublicAssetUrl } from "../services/songUtils";
import { activateLatestAppVersion } from "../services/appUpdate";

const isLocalDemo = import.meta.env.DEV && ["127.0.0.1", "localhost"].includes(window.location.hostname);

const demoUpdate = {
  version: "demo-local-update",
  displayVersion: "Demo local",
  changes: [
    "Vista previa de actualización",
    "Animación con barra de progreso",
    "Recarga automática al finalizar"
  ]
};

function ForcedUpdateDemo({ logoSrc, logoAlt, onClose }) {
  const [updateProgress, setUpdateProgress] = useState(null);
  const startUpdate = () => {
    setUpdateProgress({ progress: 4, label: "Preparando actualización...", stage: "starting" });
    activateLatestAppVersion(demoUpdate.version, { onProgress: setUpdateProgress }).catch((error) => {
      setUpdateProgress({
        progress: 0,
        label: error?.message || "No se pudo iniciar la actualización. Recarga la página.",
        stage: "error"
      });
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-5 text-ink dark:bg-zinc-950 dark:text-white">
      <motion.section
        className="w-full max-w-xl rounded-[2rem] border border-brass/35 bg-white p-6 shadow-2xl dark:border-brass/25 dark:bg-zinc-900"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-brass/12 px-3 py-1 text-xs font-black uppercase tracking-wide text-brass">
          Actualización disponible
        </div>
        <h1 className="mt-4 text-2xl font-black text-ink">Hay una nueva versión de Roca Eterna Música.</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">Esta es una simulación local del aviso obligatorio al iniciar.</p>
        <ul className="mt-4 space-y-2 text-sm font-semibold text-ink/70">
          {demoUpdate.changes.map((change) => <li key={change}>- {change}</li>)}
        </ul>
        <p className="mt-4 text-xs font-bold text-ink/45">Instalada: local · Disponible: {demoUpdate.displayVersion}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={startUpdate} disabled={Boolean(updateProgress)}>
            {updateProgress ? "Actualizando..." : "Actualizar ahora"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={Boolean(updateProgress)}>
            Volver
          </Button>
        </div>
      </motion.section>
      <UpdateProgressOverlay
        open={Boolean(updateProgress)}
        progress={updateProgress?.progress || 0}
        label={updateProgress?.label}
        stage={updateProgress?.stage}
        logoSrc={logoSrc}
        logoAlt={logoAlt}
      />
    </div>
  );
}

export function Login() {
  const { signInWithGoogle, enterDemoMode, error, isFirebaseConfigured } = useAuth();
  const dateKey = getLocalDateKey();
  const [dailyVerse, setDailyVerse] = useState(() => getDeterministicDailyVerse(fallbackLoginVerses, dateKey));
  const [showForcedUpdateDemo, setShowForcedUpdateDemo] = useState(false);
  const showDemoMode = isDemoModeAllowed;
  const themeMode = localStorage.getItem("roca-eterna-theme-mode") || "system";
  const effectiveTheme = getEffectiveThemeMode(themeMode);
  const logoSrc = resolvePublicAssetUrl((effectiveTheme === "dark"
    ? localStorage.getItem("roca-eterna-logo-dark-src")
    : localStorage.getItem("roca-eterna-logo-light-src")) || (effectiveTheme === "dark" ? appDarkLogo : appLogo));
  const logoAlt = localStorage.getItem("roca-eterna-logo-alt") || "Roca Eterna Música";
  const firebasePublishWarning =
    import.meta.env.PROD && !isFirebaseConfigured
      ? "La app fue publicada sin configuración de Firebase. Revisa GitHub Actions Secrets."
      : "";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
  }, [effectiveTheme]);

  useEffect(() => {
    let cancelled = false;
    fetchDailyVerse(dateKey).then((verse) => {
      if (!cancelled && verse) setDailyVerse(verse);
    });
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  if (showForcedUpdateDemo) {
    return <ForcedUpdateDemo logoSrc={logoSrc} logoAlt={logoAlt} onClose={() => setShowForcedUpdateDemo(false)} />;
  }

  return (
    <div className="grid min-h-screen bg-ink text-white lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative flex items-center justify-center overflow-hidden px-6 py-12 text-center md:px-12">
        <div className="absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(circle_at_28%_20%,rgba(182,148,95,0.22),transparent_34%),linear-gradient(180deg,transparent,rgba(255,255,255,0.06))]" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 flex max-w-xl flex-col items-center"
        >
          <img
            src={logoSrc}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            alt={logoAlt}
            className={`h-44 w-44 rounded-3xl object-contain p-3 shadow-2xl md:h-56 md:w-56 ${effectiveTheme === "dark" ? "bg-zinc-950" : "bg-white"}`}
          />
          <h1 className="mt-8 text-4xl font-bold leading-tight tracking-normal md:text-6xl">
            Roca Eterna Música
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/72">
            Organización del ministerio de música de Roca Eterna.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button variant="light" onClick={signInWithGoogle}>
              <FcGoogle className="h-5 w-5" aria-hidden="true" />
              Entrar con Google
            </Button>
            {showDemoMode ? (
              <Button variant="darkSubtle" onClick={enterDemoMode}>
                Modo demo local
              </Button>
            ) : null}
          </div>
          {isLocalDemo ? (
            <div className="mt-5 flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 p-3 text-sm sm:flex-row">
              <Button variant="darkSubtle" onClick={() => setShowForcedUpdateDemo(true)}>
                Demo aviso forzado
              </Button>
              <Button
                variant="darkSubtle"
                onClick={() => {
                  localStorage.setItem("roca-eterna-demo-internal-update", String(Date.now()));
                  alert("Demo listo: entra a la app en modo demo local para ver el aviso interno.");
                }}
              >
                Demo aviso interno
              </Button>
            </div>
          ) : null}
          {firebasePublishWarning ? (
            <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/12 p-4 text-sm leading-6 text-red-100">
              <p className="font-semibold">{firebasePublishWarning}</p>
              {firebaseMissingConfigKeys.length ? (
                <p className="mt-1 text-red-100/80">
                  Faltan variables de configuración en el build publicado.
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="mt-4 rounded-2xl bg-red-500/12 p-3 text-sm text-red-100">{error}</p> : null}
        </motion.div>
      </section>

      <section className="flex items-center bg-stonewash px-6 py-10 text-ink md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="w-full rounded-3xl border border-ink/10 bg-white p-6 shadow-soft dark:border-white/12 dark:bg-zinc-900 md:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-brass/12 p-3 text-brass">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Versículo del día</h2>
              {dailyVerse?.translation ? <p className="text-sm text-ink/55">{dailyVerse.translation}</p> : null}
            </div>
          </div>
          <blockquote className="text-[clamp(1.15rem,2.2vw,1.65rem)] font-semibold leading-[1.55] text-ink">
            “{dailyVerse?.text || fallbackLoginVerses[0].text}”
          </blockquote>
          <p className="mt-5 text-base font-black text-brass">{dailyVerse?.reference || fallbackLoginVerses[0].reference}</p>
        </motion.div>
      </section>
    </div>
  );
}
