import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { Button } from "./Button";

const allSteps = [
  { route: "/", target: '[data-tour="nav-inicio"]', title: "Inicio", text: "Proximo servicio, pendientes y accesos rapidos.", roles: ["admin", "editor", "viewer"] },
  { route: "/repertorio", target: '[data-tour="nav-repertorio"]', title: "Repertorio", text: "Consulta cantos, tonos, temas, PDFs y enlaces.", roles: ["admin", "editor", "viewer"] },
  { route: "/repertorio", target: '[data-tour="song-add"]', title: "Agregar canto", text: "Agrega o edita repertorio del ministerio.", roles: ["admin", "editor"] },
  { route: "/programacion", target: '[data-tour="nav-programacion"]', title: "Programacion", text: "Calendario, servicios y cantos en orden.", roles: ["admin", "editor", "viewer"] },
  { route: "/programacion", target: '[data-tour="schedule-new"]', title: "Nueva programacion", text: "Crea servicios usando la fecha seleccionada.", roles: ["admin", "editor"] },
  { route: "/musicos", target: '[data-tour="nav-musicos"]', title: "Vista para musicos", text: "Ensayo, PDFs y hoja del servicio.", roles: ["admin", "editor", "viewer"] },
  { route: "/musicos", target: '[data-tour="service-pdfs"]', title: "PDFs del servicio", text: "Abre los PDFs sin salir de la app.", roles: ["admin", "editor", "viewer"] },
  { route: "/estadisticas", target: '[data-tour="nav-estadisticas"]', title: "Estadisticas", text: "Analiza repertorio por tema, tono y uso.", roles: ["admin", "editor", "viewer"] },
  { route: "/configuracion", target: '[data-tour="nav-configuracion"]', title: "Configuracion", text: "Preferencias personales y ayuda.", roles: ["admin", "editor", "viewer"] },
  { route: "/configuracion", target: '[data-tour="settings-access"]', title: "Accesos", text: "Administra correos, roles y permisos.", roles: ["admin"] },
  { route: "/auditoria", target: '[data-tour="nav-auditoria"]', title: "Auditoria", text: "Revisa cambios y restaura versiones.", roles: ["admin"] },
  { route: "/actualizaciones", target: '[data-tour="nav-actualizaciones"]', title: "Actualizaciones", text: "Consulta cambios de cada version.", roles: ["admin", "editor"] },
  { route: "/configuracion", target: null, title: "Listo", text: "Puedes volver a abrir esta guia desde Ayuda.", roles: ["admin", "editor", "viewer"] }
];

export function OnboardingGuide({ open, onClose, onFinish, logoSrc = appLogo, logoAlt = "Roca Eterna Musica", logoInvert = false, role = "viewer" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const steps = useMemo(() => allSteps.filter((item) => item.roles.includes(role || "viewer")), [role]);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (index >= steps.length) setIndex(0);
  }, [index, steps.length]);

  useEffect(() => {
    if (!open || !step?.route || location.pathname === step.route) return;
    navigate(step.route);
  }, [location.pathname, navigate, open, step]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const findTarget = () => {
      if (!step.target) {
        setRect(null);
        return;
      }
      const element = document.querySelector(step.target);
      if (!element) {
        setRect(null);
        return;
      }
      element.scrollIntoView({ behavior: "smooth", block: isMobile ? "nearest" : "center", inline: "center" });
      window.setTimeout(() => {
        if (cancelled) return;
        const box = element.getBoundingClientRect();
        setRect({
          top: Math.max(12, box.top - 8),
          left: Math.max(12, box.left - 8),
          width: box.width + 16,
          height: box.height + 16
        });
      }, 260);
    };
    findTarget();
    window.addEventListener("resize", findTarget);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", findTarget);
    };
  }, [location.pathname, open, step]);

  const tooltipStyle = useMemo(() => {
    if (!rect) return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    const tooltipHeight = isMobile ? 220 : 260;
    const width = isMobile ? Math.min(window.innerWidth - 24, 320) : 340;
    const fitsBelow = rect.top + rect.height + tooltipHeight + 24 < window.innerHeight;
    const top = fitsBelow ? rect.top + rect.height + 12 : Math.max(12, rect.top - tooltipHeight - 12);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    return { left, top };
  }, [isMobile, rect]);

  const finish = async () => {
    await onFinish?.();
    onClose?.();
    setIndex(0);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {rect ? (
            <>
              <div className="absolute left-0 right-0 top-0 bg-ink/72" style={{ height: rect.top }} />
              <div className="absolute left-0 bg-ink/72" style={{ top: rect.top, width: rect.left, height: rect.height }} />
              <div className="absolute bg-ink/72" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
              <div className="absolute bottom-0 left-0 right-0 bg-ink/72" style={{ top: rect.top + rect.height }} />
            </>
          ) : (
            <div className="absolute inset-0 bg-ink/72" />
          )}
          {rect ? (
            <motion.div
              className="pointer-events-none absolute rounded-3xl border-2 border-brass shadow-[0_0_26px_rgba(182,148,95,0.45)]"
              animate={rect}
              transition={{ duration: 0.22 }}
            />
          ) : null}
          <motion.div
            className="absolute w-[min(92vw,340px)] rounded-3xl border border-white/10 bg-stonewash p-4 text-ink shadow-2xl sm:p-5"
            style={tooltipStyle}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={logoSrc}
                  onError={(event) => {
                    event.currentTarget.src = fallbackAppLogo;
                  }}
                  alt={logoAlt}
                  className={`h-10 w-10 rounded-2xl bg-white object-contain p-1 shadow-soft sm:h-11 sm:w-11 ${logoInvert ? "invert" : ""}`}
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brass">Guia interactiva</p>
                  <p className="text-xs font-semibold text-ink/55">Paso {index + 1} de {steps.length}</p>
                </div>
              </div>
              <Button variant="subtle" className="h-9 w-9 px-0" onClick={onClose} aria-label="Cerrar guia">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/7">
              <motion.div className="h-full rounded-full bg-brass" initial={false} animate={{ width: `${progress}%` }} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-ink sm:mt-5 sm:text-xl">{step.title}</h2>
            <p className="mt-2 text-sm leading-5 text-ink/65 sm:leading-6">{step.text}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="subtle" onClick={finish}>Omitir</Button>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {isLast ? (
                  <Button onClick={finish}><Check className="h-4 w-4" />Finalizar</Button>
                ) : (
                  <Button onClick={() => setIndex((current) => Math.min(steps.length - 1, current + 1))}>
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
