import { motion, useReducedMotion } from "framer-motion";

export function SmartGradientBackground({ children }) {
  return (
    <div className="smart-shell relative overflow-hidden rounded-[2rem] border border-brass/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(237,233,223,0.72)_52%,rgba(182,148,95,0.12))] p-4 text-ink shadow-soft dark:border-brass/25 dark:bg-[linear-gradient(135deg,rgba(18,18,18,0.98),rgba(32,38,46,0.92)_55%,rgba(182,148,95,0.16))] sm:p-6">
      <div className="relative">{children}</div>
    </div>
  );
}

export function SmartPanel({ children, className = "" }) {
  return (
    <section className={`rounded-[1.75rem] border border-white/55 bg-white/72 p-4 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/8 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function SmartCard({ icon: Icon, title, description, metric, action, onClick, className = "" }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-[1.75rem] border border-white/60 bg-white/74 p-5 text-left shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-brass/45 hover:bg-brass/10 dark:border-white/10 dark:bg-white/8 dark:hover:bg-brass/12 ${className}`}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white shadow-soft dark:bg-brass">
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </span>
        {metric ? <span className="rounded-full bg-brass/15 px-3 py-1 text-xs font-bold text-brass">{metric}</span> : null}
      </div>
      <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/62">{description}</p>
      {action ? <p className="mt-4 text-sm font-bold text-brass">{action}</p> : null}
    </motion.button>
  );
}
