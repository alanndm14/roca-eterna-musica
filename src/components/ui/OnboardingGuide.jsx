import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { Button } from "./Button";

const steps = [
  { route: "/", target: '[data-tour="nav-inicio"]', title: "Inicio", text: "Aqui ves el proximo servicio, pendientes y accesos rapidos." },
  { route: "/repertorio", target: '[data-tour="nav-repertorio"]', title: "Repertorio", text: "Guarda cantos con tono, capo, temas, revision, PDF, YouTube y Spotify." },
  { route: "/repertorio", target: '[data-tour="song-add"]', title: "Agregar canto", text: "Desde aqui agregas un canto nuevo sin depender de escribir toda la letra en la base." },
  { route: "/programacion", target: '[data-tour="nav-programacion"]', title: "Programacion", text: "Usa calendario, servicios reales y buscador de cantos para armar cada reunion." },
  { route: "/programacion", target: '[data-tour="schedule-new"]', title: "Nueva programacion", text: "Si vienes desde calendario, la fecha seleccionada se carga automaticamente." },
  { route: "/musicos", target: '[data-tour="nav-musicos"]', title: "Vista para musicos", text: "Elige una programacion, abre PDFs, descarga la hoja del servicio y usa modo enfocado." },
  { route: "/musicos", target: '[data-tour="service-pdfs"]', title: "PDFs del servicio", text: "Navega los PDFs de los cantos sin salir de la app." },
  { route: "/estadisticas", target: '[data-tour="nav-estadisticas"]', title: "Estadisticas", text: "Analiza datos para musicos y para programacion usando filtros de categoria y tema." },
  { route: "/configuracion", target: '[data-tour="nav-configuracion"]', title: "Configuracion", text: "Administra temas, accesos, preferencias personales, importacion y mantenimiento." },
  { route: "/configuracion", target: null, title: "Listo", text: "Puedes volver a abrir este tour desde Ayuda, Configuracion o el menu Mas en movil." }
];

export function OnboardingGuide({ open, onClose, onFinish, logoSrc = appLogo, logoAlt = "Roca Eterna Musica" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = Math.round(((index + 1) / steps.length) * 100);

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
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
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
    const fitsBelow = rect.top + rect.height + 260 < window.innerHeight;
    const top = fitsBelow ? rect.top + rect.height + 16 : Math.max(16, rect.top - 244);
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - 360);
    return { left, top };
  }, [rect]);

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
            className="absolute w-[min(92vw,340px)] rounded-3xl border border-white/10 bg-stonewash p-5 text-ink shadow-2xl"
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
                  className="h-11 w-11 rounded-2xl bg-white object-contain p-1 shadow-soft"
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
            <h2 className="mt-5 text-xl font-bold text-ink">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">{step.text}</p>
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
