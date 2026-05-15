export const appVersion = "0.9.0";

export const changelog = [
  {
    version: "0.9.0",
    date: "2026-05-14",
    title: "Administracion, auditoria y PDFs locales",
    added: [
      "Preferencias visuales personales por usuario",
      "Registro de cambios de datos",
      "Notificaciones internas para programaciones futuras",
      "Busqueda manual dentro de PDFs locales",
      "Logo institucional configurable"
    ],
    changed: [
      "PDFs locales resuelven rutas correctamente en GitHub Pages",
      "Responsable ahora se muestra como Lider de adoracion",
      "La guia de uso ahora funciona como tour visual"
    ],
    fixed: [
      "Modo oscuro ya no depende de configuracion global compartida",
      "Las rutas /pdfs y /roca-eterna-musica/pdfs no se duplican"
    ],
    pending: [
      "Notificaciones push reales requieren backend seguro o Cloud Functions",
      "OCR para PDFs escaneados"
    ]
  },
  {
    version: "0.8.0",
    date: "2026-05-13",
    title: "Vista movil y flujos de PDFs",
    added: ["PDFs del servicio dentro de la app", "Union de PDFs desde archivos locales", "Navegacion movil con Mas"],
    changed: ["Vista para musicos enfocada en PDFs y enlaces de escucha"],
    fixed: ["Modal de PDFs con mas alto util"],
    pending: ["Auditoria detallada"]
  }
];
