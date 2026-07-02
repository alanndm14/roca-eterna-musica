import { useEffect } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { appLogo, fallbackAppLogo } from "../../assets/logo";

export function UpdateProgressOverlay({
  open,
  progress = 0,
  label = "Preparando actualización...",
  stage = "",
  logoSrc = appLogo,
  logoAlt = "Roca Eterna Música"
}) {
  const reduceMotion = useReducedMotion();
  const normalizedProgress = Math.max(3, Math.min(100, Number(progress || 0)));
  const done = normalizedProgress >= 100;
  const closing = stage === "closing";
  const progressSpring = useSpring(normalizedProgress, {
    stiffness: reduceMotion ? 500 : 76,
    damping: reduceMotion ? 60 : 18,
    mass: reduceMotion ? 0.1 : 0.38
  });
  const progressScale = useTransform(progressSpring, [0, 100], [0, 1]);

  useEffect(() => {
    progressSpring.set(normalizedProgress);
  }, [normalizedProgress, progressSpring]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-stonewash/92 p-6 text-ink backdrop-blur-xl dark:bg-zinc-950/92 dark:text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: closing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.section
            className="w-full max-w-sm text-center"
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: "easeOut" }}
          >
            <motion.div
              className="relative mx-auto grid h-28 w-28 place-items-center rounded-3xl bg-white p-2 shadow-soft dark:bg-zinc-950"
              animate={done && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.48, ease: "easeOut" }}
            >
              <motion.img
                src={logoSrc}
                onError={(event) => {
                  event.currentTarget.src = fallbackAppLogo;
                }}
                alt={logoAlt}
                className="h-full w-full object-contain"
                animate={{ opacity: done ? 0.18 : 1, scale: done ? 0.94 : 1 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.28 }}
              />
              <motion.div
                className="absolute inset-0 grid place-items-center"
                initial={false}
                animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.82 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.35, ease: "easeOut" }}
              >
                <CheckCircle2 className="h-14 w-14 text-emerald-500 drop-shadow-sm" strokeWidth={2.3} />
              </motion.div>
            </motion.div>

            <motion.div
              className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full bg-brass/12 px-3 py-1 text-xs font-black uppercase tracking-wide text-brass"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.12, duration: 0.3 }}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4 animate-spin" />}
              {done ? "Listo" : "Actualizando"}
            </motion.div>

            <motion.h2
              className="mt-4 text-2xl font-black"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.18, duration: 0.34 }}
            >
              {done ? "Actualización completada" : "Actualizando la app"}
            </motion.h2>
            <p className="mt-2 min-h-6 text-sm font-semibold text-ink/60 dark:text-white/65">
              {done ? "La app se recargará automáticamente." : label}
            </p>

            <div className="mx-auto mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-ink/10 dark:bg-white/12">
              <motion.div
                className="h-full w-full origin-left rounded-full bg-brass shadow-[0_0_16px_rgba(182,148,95,0.45)]"
                style={{ scaleX: progressScale }}
              />
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
