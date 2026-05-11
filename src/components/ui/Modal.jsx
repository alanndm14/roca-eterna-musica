import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button";

export function Modal({ open, title, children, onClose, wide = false }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 backdrop-blur-sm md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-stonewash p-5 shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-ink">{title}</h2>
              <Button variant="subtle" className="h-10 w-10 px-0" onClick={onClose} aria-label="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
