import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { appVersion } from "../../data/changelog";

export function WelcomeSplash({
  profile,
  onDone,
  logoSrc = appLogo,
  logoAlt = "Roca Eterna Música",
  logoMode = "light",
  ready = true,
  progress = 100,
}) {
  const reduceMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const mountedAt = useRef(Date.now());
  const name = profile?.preferredDisplayName || profile?.displayName || profile?.email || "";
  const normalizedProgress = Math.max(4, Math.min(100, Number(progress || 0)));

  useEffect(() => {
    if (!ready) return undefined;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = reduceMotion ? 180 : Math.max(450, 2400 - elapsed);
    const fadeTimer = window.setTimeout(() => setLeaving(true), remaining);
    const doneTimer = window.setTimeout(() => onDone?.(), remaining + (reduceMotion ? 120 : 480));
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone, ready, reduceMotion]);

  return (
    <motion.div
      className="flex min-h-screen items-center justify-center bg-stonewash p-6 text-ink dark:bg-zinc-950 dark:text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.5, ease: "easeInOut" }}
    >
      <motion.div
        className="text-center"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <motion.img
          src={logoSrc}
          onError={(event) => {
            event.currentTarget.src = fallbackAppLogo;
          }}
          alt={logoAlt}
          className={`mx-auto h-28 w-28 rounded-3xl object-contain p-2 shadow-soft ${logoMode === "dark" ? "bg-zinc-950" : "bg-white"}`}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.h1
          className="mt-7 text-3xl font-bold tracking-normal md:text-4xl"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.55, ease: "easeOut" }}
        >
          {name ? `Bienvenido, ${name}` : "Bienvenido"}
        </motion.h1>
        <motion.p
          className="mt-4 text-base font-semibold text-brass"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.45 }}
        >
          Roca Eterna Música
        </motion.p>
        <motion.p
          className="mt-2 text-sm font-semibold text-ink/55 dark:text-white/65"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.18, duration: 0.45 }}
        >
          {ready ? "Todo listo" : "Preparando tu repertorio..."}
        </motion.p>
        <motion.p
          className="mt-3 text-xs font-bold uppercase tracking-wide text-ink/55 dark:text-white/75"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.28, duration: 0.4 }}
        >
          v{appVersion}
        </motion.p>
        <motion.div
          className="mx-auto mt-6 h-0.5 w-40 origin-left rounded-full bg-brass"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: normalizedProgress / 100, opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.25, duration: reduceMotion ? 0.01 : 0.45, ease: "easeOut" }}
        />
      </motion.div>
    </motion.div>
  );
}
