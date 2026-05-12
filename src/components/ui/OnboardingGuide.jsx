import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { appLogo, fallbackAppLogo } from "../../assets/logo";
import { Button } from "./Button";

const steps = [
  {
    title: "Bienvenido a Roca Eterna Música",
    text: "Esta app ayuda a organizar repertorio, programaciones, PDFs y preparación del ministerio de música."
  },
  {
    title: "Inicio",
    text: "Consulta el próximo servicio, los cantos programados, pendientes principales y accesos rápidos."
  },
  {
    title: "Repertorio",
    text: "Aquí se guardan los cantos con tono, capo, temas, revisión, PDF, YouTube, Spotify, filtros y búsqueda."
  },
  {
    title: "Detalle del canto",
    text: "Revisa datos musicales, PDF de letra y acordes, enlaces de escucha, historial y estado de revisión."
  },
  {
    title: "Programación",
    text: "Usa el calendario, crea servicios de miércoles o domingo, selecciona cantos y aprovecha la fecha elegida."
  },
  {
    title: "Vista para músicos",
    text: "Elige una programación, mira cantos en orden, abre PDFs, descarga la hoja del servicio y usa pantalla completa."
  },
  {
    title: "Historial",
    text: "Distingue programaciones realizadas dentro de la app de cantos marcados como cantados históricamente."
  },
  {
    title: "Estadísticas",
    text: "Analiza vista para músicos, vista para programación, filtros por categoría/tema y revisión PDF, Keynote y musical."
  },
  {
    title: "Configuración",
    text: "Administra temas, correos autorizados, importación, preferencias visuales y herramientas de mantenimiento."
  },
  {
    title: "Listo",
    text: "Puedes volver a abrir esta guía cuando quieras desde Ayuda, Configuración o el menú Más en móvil."
  }
];

export function OnboardingGuide({ open, onClose, onFinish }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  const finish = async () => {
    await onFinish?.();
    onClose?.();
    setIndex(0);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-3 backdrop-blur-sm md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-2xl rounded-3xl bg-stonewash p-5 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={appLogo}
                  onError={(event) => {
                    event.currentTarget.src = fallbackAppLogo;
                  }}
                  alt="Roca Eterna Música"
                  className="h-12 w-12 rounded-2xl bg-white object-contain p-1 shadow-soft"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brass">Guía de uso</p>
                  <p className="text-sm font-semibold text-ink/55">Paso {index + 1} de {steps.length}</p>
                </div>
              </div>
              <Button variant="subtle" className="h-10 w-10 px-0" onClick={onClose} aria-label="Cerrar guía">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/7">
              <motion.div className="h-full rounded-full bg-brass" initial={false} animate={{ width: `${progress}%` }} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step.title}
                className="min-h-52 py-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <h2 className="text-2xl font-bold text-ink md:text-3xl">{step.title}</h2>
                <p className="mt-4 text-base leading-7 text-ink/62">{step.text}</p>
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-col-reverse gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="subtle" onClick={finish}>Omitir</Button>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
                  <ArrowLeft className="h-4 w-4" />
                  Anterior
                </Button>
                {isLast ? (
                  <Button onClick={finish}>
                    <Check className="h-4 w-4" />
                    Finalizar
                  </Button>
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
