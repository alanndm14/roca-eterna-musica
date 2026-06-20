import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button";

export function Modal({
  open,
  title,
  children,
  onClose,
  wide = false,
  centered = false,
  panelClassName = "",
  contentClassName = ""
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-[11000] flex justify-center overflow-hidden bg-ink/55 p-2 backdrop-blur-sm sm:p-4 ${centered ? "items-center" : "items-end md:items-center"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={`max-h-[calc(100dvh-1rem)] w-full overflow-hidden rounded-3xl bg-stonewash p-3 shadow-2xl dark:border dark:border-white/10 dark:bg-zinc-950 sm:max-h-[calc(100dvh-2rem)] sm:p-5 ${wide ? "max-w-5xl" : "max-w-2xl"} ${panelClassName}`}
          >
            <div className="mb-3 flex shrink-0 items-center justify-between gap-4 sm:mb-5">
              <h2 className="text-xl font-bold text-ink">{title}</h2>
              <Button variant="subtle" className="h-10 w-10 px-0" onClick={onClose} aria-label="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className={contentClassName}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
