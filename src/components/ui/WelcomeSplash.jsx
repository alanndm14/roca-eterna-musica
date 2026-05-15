import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { appLogo, fallbackAppLogo } from "../../assets/logo";

export function WelcomeSplash({ profile, onDone, logoSrc = appLogo, logoAlt = "Roca Eterna Musica", logoInvert = false }) {
  const reduceMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const name = profile?.preferredDisplayName || profile?.displayName || profile?.email || "";

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLeaving(true), reduceMotion ? 700 : 2850);
    const doneTimer = window.setTimeout(onDone, reduceMotion ? 950 : 3350);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone, reduceMotion]);

  return (
    <motion.div
      className="flex min-h-screen items-center justify-center bg-stonewash p-6 text-ink"
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
          className={`mx-auto h-28 w-28 rounded-3xl bg-white object-contain p-2 shadow-soft ${logoInvert ? "invert" : ""}`}
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
          className="mt-2 text-sm font-semibold text-ink/55"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.18, duration: 0.45 }}
        >
          Preparando tu repertorio...
        </motion.p>
        <motion.div
          className="mx-auto mt-6 h-0.5 w-40 origin-left rounded-full bg-brass"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.35, duration: 0.9, ease: "easeInOut" }}
        />
      </motion.div>
    </motion.div>
  );
}
