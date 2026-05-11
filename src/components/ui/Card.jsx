import { motion } from "framer-motion";

export function Card({ children, className = "", delay = 0 }) {
  const hasCustomBackground = /\bbg-/.test(className);
  const hasCustomPadding = /(?:^|\s)(p|px|py|pt|pr|pb|pl)-/.test(className);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay }}
      className={`rounded-2xl border border-ink/10 shadow-soft ${hasCustomBackground ? "" : "bg-white"} ${hasCustomPadding ? "" : "p-5"} ${className}`}
    >
      {children}
    </motion.section>
  );
}
