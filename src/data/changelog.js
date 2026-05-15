export const appVersion = "0.9.2";

export const changelog = [
  {
    version: "0.9.2",
    date: "2026-05-15",
    title: "Roles, vista de consulta y flujo de servicio",
    added: [
      "Restricciones visuales para observadores",
      "Sustitucion rapida de cantos para administradores en Vista para musicos",
      "Vista lista compacta en Repertorio",
      "Progreso visible al indexar PDFs locales"
    ],
    changed: [
      "La programacion ya no muestra estados al usuario",
      "Los PDFs generados usan nombres en minusculas",
      "La guia interactiva evita bloquear clics y se adapta mejor por rol",
      "El login publico ahora es mas institucional y menos tecnico"
    ],
    fixed: [
      "Viewer ya no ve Historial, Estadisticas, Auditoria ni Actualizaciones",
      "Busqueda de repertorio normaliza artista/fuente, acentos, signos y mayusculas"
    ],
    pending: [
      "Validar sustitucion rapida con repertorio real y ajustes finos de ranking"
    ]
  },
  {
    version: "0.9.1",
    date: "2026-05-15",
    title: "Pulido de roles, logos y auditoria",
    added: [
      "Logos separados para modo claro y modo oscuro",
      "Restauracion segura desde registros de auditoria para cantos, programaciones y temas",
      "Ayuda interactiva adaptada al rol del usuario",
      "Vista compacta de temas del repertorio"
    ],
    changed: [
      "La navegacion y rutas visibles ahora respetan mejor los roles viewer, editor y admin",
      "La guia movil usa pasos mas cortos y evita desenfocar el elemento resaltado",
      "La etiqueta dorada de Vista para musicos ahora dice Servicio"
    ],
    fixed: [
      "La configuracion de logos ya prueba y muestra URLs resueltas por modo",
      "Auditoria muestra acciones restaurables como botones reales cuando hay datos suficientes"
    ],
    pending: [
      "Probar restauraciones con datos reales antes de usarlas como respaldo operativo principal"
    ]
  },
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
