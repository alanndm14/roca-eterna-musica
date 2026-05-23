export const appVersion = "0.9.9";

export const changelog = [
  {
    version: "0.9.9",
    date: "2026-05-23",
    title: "Programación Inteligente más clara",
    added: [
      "Programación inteligente por fecha y tipo de servicio",
      "Modo para crear programación nueva desde un bloque sugerido",
      "Explicación del score por canto",
      "Revisión del servicio agrupada por faltantes"
    ],
    changed: [
      "Cantidad automática de cantos para Miércoles, Domingo AM y Domingo PM",
      "Bloques sugeridos por posición dentro del servicio",
      "Preparación del servicio ahora se muestra en porcentaje",
      "Regenerar crea alternativas con los mismos criterios"
    ],
    fixed: [
      "Se eliminaron textos técnicos visibles del Centro Inteligente",
      "El score queda protegido contra valores inválidos y duplicados",
      "La revisión incluye Keynote, revisión PDF, PDF Drive, PDF local, enlaces, tono, tema y rotación"
    ],
    pending: [
      "Probar pesos del scoring con programaciones reales de varias semanas"
    ]
  },
  {
    version: "0.9.8",
    date: "2026-05-23",
    title: "Centro Inteligente",
    added: [
      "Nuevo Centro Inteligente para admin y editor",
      "Asistente de programación con puntajes y razones visibles",
      "Bloque sugerido para armar servicios completos",
      "Revisión inteligente del servicio con score y alertas",
      "Sustitución inteligente visual con compatibilidad",
      "Balance del repertorio con insights y pendientes",
      "Búsqueda por intención sin usar APIs externas"
    ],
    changed: [
      "Vista de músicos muestra una revisión inteligente compacta del servicio",
      "La sustitución en Vista de músicos ahora usa el panel visual inteligente",
      "Repertorio puede abrir filtros desde los pendientes inteligentes"
    ],
    fixed: [
      "Las recomendaciones evitan duplicados dentro de la programación seleccionada",
      "Los puntajes consideran preparación, rotación, PDF, enlaces, tema, categoría y tonalidad"
    ],
    pending: [
      "Ajustar pesos del scoring con el uso real del ministerio"
    ]
  },
  {
    version: "0.9.7",
    date: "2026-05-21",
    title: "Programa especial y Vista de músicos más limpia",
    added: [
      "Edición del programa especial directamente desde Programación",
      "Vista previa, impresión normal y formato 4 programas por hoja desde Programación",
      "La hoja imprimible del programa especial muestra Roca Eterna junto al evento"
    ],
    changed: [
      "Vista de músicos conserva solo Editar programa y Ver programa para servicios especiales",
      "Los botones de imprimir y 4 por hoja se movieron a Programación",
      "Documentos del servicio queda enfocado en el PDF unido para los músicos"
    ],
    fixed: [
      "Se evita saturar Vista de músicos con acciones administrativas de impresión",
      "El programa especial reutiliza el mismo guardado de Firestore desde Programación y Músicos"
    ],
    pending: [
      "Probar impresión física de 4 por hoja con la configuración real de la impresora"
    ]
  },
  {
    version: "0.9.6",
    date: "2026-05-17",
    title: "Hotfix de Inicio y notificaciones por fases",
    added: [
      "ErrorBoundary para evitar pantallas completamente en blanco",
      "Preparación de backend serverless externo para push real sin Firebase Blaze",
      "Service worker de FCM Web con apertura de la app al tocar una notificación"
    ],
    changed: [
      "Duración de Miércoles de oración ajustada a 19:00-20:00",
      "Duración de Domingo PM ajustada a 17:00-18:30",
      "Editar canto desde detalle vuelve a abrir el formulario en la misma vista"
    ],
    fixed: [
      "Inicio ya no truena con programaciones vacías o incompletas",
      "Textos corruptos de Inicio y helpers de fechas reemplazados por UTF-8 limpio",
      "Las notificaciones push muestran mensaje claro si falta VAPID key"
    ],
    pending: [
      "Configurar Vercel o Netlify si se desea push real fuera de la app"
    ]
  },
  {
    version: "0.9.5",
    date: "2026-05-17",
    title: "Servicios múltiples, historial y detalle de cantos",
    added: [
      "Inicio ahora avanza servicio por servicio en días con Domingo AM y Domingo PM",
      "Historial de cantos muestra el servicio específico junto con la fecha",
      "Botón Editar canto dentro de la vista de detalle"
    ],
    changed: [
      "El contador Tiempo restante usa horarios de fin estimados para detectar servicios en curso",
      "Vista para músicos muestra programaciones del mismo día con separadores claros",
      "El fallback de logo interno ya no carga el SVG antiguo recreado"
    ],
    fixed: [
      "Corrección de separadores que aparecían como signos de interrogación",
      "Limpieza de textos con codificación antigua en detalle e historial",
      "Domingo AM y Domingo PM ya no se muestran de forma ambigua en Inicio o Historial"
    ],
    pending: [
      "Validar duraciones reales si la iglesia cambia horarios de salida por temporada"
    ]
  },
  {
    version: "0.9.4",
    date: "2026-05-17",
    title: "Notificaciones, logos y seleccion de servicio",
    added: [
      "Notificaciones internas para nuevas programaciones futuras y cantos nuevos",
      "Preparacion de Firebase Cloud Messaging para activar push por dispositivo sin exponer llaves privadas",
      "Calendario mensual en Vista para musicos para seleccionar la programacion del dia",
      "Opciones predeterminadas para Lider de adoracion"
    ],
    changed: [
      "Los nombres de hojas y PDFs unidos ahora usan formato natural como Mayo 10 am.pdf o Aniversario 2026.pdf",
      "El indicador de Coincidencia en PDF/OCR queda separado de badges de revision y enlaces",
      "El sistema de logos se simplifico a logo claro y logo oscuro",
      "Inicio muestra Tiempo restante con cuenta regresiva cuando falta menos de un dia"
    ],
    fixed: [
      "Ultima conexion de usuarios ahora muestra fecha y hora",
      "Se elimino el texto innecesario para crear una nueva programacion desde Inicio",
      "El workflow acepta VITE_FIREBASE_VAPID_KEY como secret opcional"
    ],
    pending: [
      "Enviar push a todos los usuarios requiere backend seguro o Cloud Functions"
    ]
  },
  {
    version: "0.9.3",
    date: "2026-05-15",
    title: "Busqueda, exportaciones e indexacion detallada",
    added: [
      "Resumen detallado de indexacion con cantos indexados, sin texto, no encontrados y con error",
      "Exportacion CSV completa del repertorio",
      "Indicadores de coincidencia en resultados de busqueda",
      "Exportacion de historial con tonos, capo y notas por canto"
    ],
    changed: [
      "La busqueda del repertorio normaliza acentos, mayusculas, signos y texto indexado de PDFs",
      "Las sugerencias de rotacion y sustitucion rapida priorizan Keynote, tema, categoria y rotacion",
      "Las metricas de Inicio ahora muestran Keynote pendiente, links PDF faltantes y mas usados del mes",
      "El boton de sustitucion rapida queda separado de los enlaces PDF, YouTube y Spotify"
    ],
    fixed: [
      "Textos corruptos en Inicio reemplazados por textos limpios",
      "Badges del calendario movil ajustados para 375px y 414px",
      "Exportaciones CSV incluyen BOM para abrir mejor acentos en Excel"
    ],
    pending: [
      "Validar busqueda dentro de PDFs con documentos reales escaneados y seleccionables"
    ]
  },
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
