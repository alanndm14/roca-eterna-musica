import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button";

const openModalStack = [];
let lockedBodyOverflow = "";

function lockBodyScroll(modalId) {
  if (!openModalStack.length) lockedBodyOverflow = document.body.style.overflow;
  openModalStack.push(modalId);
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll(modalId) {
  const stackIndex = openModalStack.lastIndexOf(modalId);
  if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
  if (!openModalStack.length) {
    document.body.style.overflow = lockedBodyOverflow;
    lockedBodyOverflow = "";
  } else {
    document.body.style.overflow = "hidden";
  }
}

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
  const panelRef = useRef(null);
  const modalIdRef = useRef(Symbol("modal"));
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const modalId = modalIdRef.current;
    const previousFocus = document.activeElement;
    lockBodyScroll(modalId);
    const closeOnEscape = (event) => {
      if (openModalStack[openModalStack.length - 1] !== modalId) return;
      if (event.key === "Escape") onCloseRef.current?.();
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter((element) => !element.hidden);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector("button, a[href], input, select, textarea")?.focus();
    }, 30);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.clearTimeout(focusTimer);
      unlockBodyScroll(modalId);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

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
            ref={panelRef}
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
