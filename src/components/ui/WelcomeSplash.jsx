import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { appLogo, fallbackAppLogo } from "../../assets/logo";

export function WelcomeSplash({ profile, onDone }) {
  const reduceMotion = useReducedMotion();
  const name = profile?.displayName || profile?.email || "";

  useEffect(() => {
    const timeout = window.setTimeout(onDone, reduceMotion ? 900 : 1900);
    return () => window.clearTimeout(timeout);
  }, [onDone, reduceMotion]);

  const letters = "Bienvenido".split("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-stonewash p-6 text-ink">
      <motion.div
        className="text-center"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <motion.img
          src={appLogo}
          onError={(event) => {
            event.currentTarget.src = fallbackAppLogo;
          }}
          alt="Roca Eterna Música"
          className="mx-auto h-24 w-24 rounded-3xl bg-white object-contain p-2 shadow-soft"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
        <div className="mt-7 flex justify-center text-3xl font-bold tracking-normal md:text-4xl">
          {letters.map((letter, index) => (
            <motion.span
              key={`${letter}-${index}`}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 + index * 0.035, duration: 0.28 }}
            >
              {letter}
            </motion.span>
          ))}
        </div>
        {name ? (
          <motion.p
            className="mt-2 text-xl font-semibold text-brass"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68, duration: 0.34 }}
          >
            {name}
          </motion.p>
        ) : null}
        <motion.p
          className="mt-4 text-sm font-semibold text-ink/55"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.86, duration: 0.34 }}
        >
          Roca Eterna Música · Preparando tu repertorio...
        </motion.p>
        <motion.div
          className="mx-auto mt-6 h-0.5 w-36 rounded-full bg-brass"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.96, duration: 0.48 }}
        />
      </motion.div>
    </div>
  );
}
