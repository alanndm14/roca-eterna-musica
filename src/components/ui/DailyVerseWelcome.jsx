import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { fallbackAppLogo } from "../../assets/logo";

export function DailyVerseWelcome({
  verse,
  logoSrc,
  logoAlt = "Roca Eterna Música",
  leaving = false,
  onContinue,
  onExited
}) {
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const exitReported = useRef(false);
  const duration = reduceMotion ? 0.2 : 0.85;

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), reduceMotion ? 180 : 950);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!leaving) exitReported.current = false;
  }, [leaving]);

  return (
    <motion.main
      className="fixed inset-0 z-[12000] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#0d1012] px-5 py-[max(1.5rem,env(safe-area-inset-top))] text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration, ease: "easeInOut" }}
      onAnimationComplete={() => {
        if (leaving && !exitReported.current) {
          exitReported.current = true;
          onExited?.();
        }
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(182,148,95,0.18),transparent_42%),linear-gradient(160deg,rgba(18,58,66,0.36),transparent_55%)]" />
      <motion.section
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center"
        animate={leaving && !reduceMotion ? { opacity: 0, y: 8, scale: 0.985 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0.18 : 0.65, ease: "easeInOut" }}
      >
        <motion.img
          src={logoSrc}
          onError={(event) => {
            event.currentTarget.src = fallbackAppLogo;
          }}
          alt={logoAlt}
          className="h-20 w-20 rounded-2xl bg-white object-contain p-2 shadow-2xl sm:h-24 sm:w-24"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: reduceMotion ? 0.2 : 0.75, ease: "easeOut" }}
        />
        <motion.div
          className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-brass"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: reduceMotion ? 0.2 : 0.75 }}
        >
          <BookOpen className="h-4 w-4" />
          Versículo del día
        </motion.div>
        <motion.blockquote
          className="mt-7 max-w-2xl text-[clamp(1.55rem,4.8vw,2.65rem)] font-semibold leading-[1.28] tracking-normal text-white"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: reduceMotion ? 0.22 : 1, ease: "easeOut" }}
        >
          “{verse?.text || "Nuevas son cada mañana; grande es tu fidelidad."}”
        </motion.blockquote>
        <motion.p
          className="mt-5 text-lg font-black text-brass"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: reduceMotion ? 0.2 : 0.65 }}
        >
          {verse?.reference || "Lamentaciones 3:23"}
        </motion.p>
        {verse?.translation ? (
          <motion.p
            className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/55"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: reduceMotion ? 0.2 : 0.55 }}
          >
            {verse.translation}
          </motion.p>
        ) : null}
        <motion.button
          type="button"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brass px-6 py-3 font-bold text-white shadow-xl transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass disabled:cursor-wait disabled:opacity-65"
          disabled={!ready || leaving}
          onClick={onContinue}
          aria-label="Continuar a Roca Eterna Música"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: reduceMotion ? 0.2 : 0.55 }}
        >
          Continuar
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </motion.section>
    </motion.main>
  );
}
