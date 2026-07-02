export const appVersion = "1.3.1";
export const appBuildVersion = "1.0.30";

export const changelog = [
  {
    version: "1.3.1",
    date: "2026-07-02",
    title: "Asistente y exportación de letras",
    added: [
      "Animación de actualización con barra de progreso",
      "Exportación de letras del repertorio y de cada canto en PDF"
    ],
    changed: [
      "El asistente usa las categorías reales del repertorio",
      "La sustitución inteligente muestra la mejor opción con portada y último uso"
    ],
    fixed: [
      "El filtro de categoría también funciona en la búsqueda por historial"
    ],
    pending: []
  },
  {
    version: "1.3",
    date: "2026-06-28",
    title: "Filtro por artista o fuente",
    added: [
      "Filtro avanzado para artistas y fuentes en Repertorio"
    ],
    changed: [
      "Tocar el artista o fuente abre Repertorio filtrado por ese dato"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "1.2",
    date: "2026-06-28",
    title: "Corrección de tipos de canto",
    added: [],
    changed: [
      "Renombrar un tipo de canto actualiza los cantos que ya usaban ese tipo"
    ],
    fixed: [
      "Los cambios de mayúsculas y acentos en tipos de canto se aplican correctamente"
    ],
    pending: []
  },
  {
    version: "1.2",
    date: "2026-06-27",
    title: "Mejora visual",
    added: [],
    changed: [
      "El icono de sustitución queda más discreto dentro de las tarjetas de Servicios"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "1.2",
    date: "2026-06-27",
    title: "Correcciones de edición",
    added: [],
    changed: [
      "El panel de sustitución permite revisar más sugerencias con scroll interno"
    ],
    fixed: [
      "La portada y su fondo visual se pueden editar después de subir imagen",
      "Los tipos de canto se pueden escribir y guardar sin perder el cursor",
      "La versión visible sigue siendo 1.2 para todos"
    ],
    pending: []
  },
  {
    version: "1.2",
    date: "2026-06-22",
    title: "Práctica musical afinada",
    added: [],
    changed: [
      "Practicar distingue la versión original de la versión de la iglesia",
      "La tonalidad de la iglesia se toma directamente de la tonalidad con capo del canto",
      "Las referencias de tónica, acorde y nota inicial están disponibles para ambas versiones"
    ],
    fixed: [
      "Se recuperó la comparación de altura entre la grabación original y la versión de la iglesia",
      "El icono de sustitución es más visible sin aumentar el tamaño del botón"
    ],
    pending: []
  },
  {
    version: "1.2",
    date: "2026-06-22",
    title: "Permisos y práctica corregidos",
    added: [],
    changed: [
      "Todos los administradores vuelven a tener acceso completo",
      "Practicar usa una sola versión de Roca Eterna guardada en cada canto",
      "La creación tradicional de programaciones ya no solicita datos musicales por servicio"
    ],
    fixed: [
      "La edición de cantos funciona después de subir una portada",
      "Los versículos registrados pueden consultarse y administrarse desde Configuración",
      "Las tarjetas de Servicios comparten el fondo visual del detalle del canto"
    ],
    pending: []
  },
  {
    version: "1.2",
    date: "2026-06-21",
    title: "Acceso y herramientas mejoradas",
    added: [
      "Administracion completa de versiculos del dia",
      "Busqueda de versiculos registrados desde Configuracion"
    ],
    changed: [
      "Todos los administradores y editores autorizados comparten los permisos correspondientes a su rol",
      "Practicar esta disponible para todos los administradores y editores",
      "Servicios muestra acciones mas compactas y tarjetas mas claras en modo claro",
      "El metronomo permite escribir libremente el BPM y sus controles recorren de 0 a 100%"
    ],
    fixed: [
      "Los cantos nuevos vuelven a abrir correctamente desde Inicio y Repertorio",
      "Se corrigieron permisos de edicion, portadas, PDFs y guias de practica",
      "Se retiro el enlace de diapositivas de la vista de Servicios"
    ],
    pending: []
  },
  {
    version: "1.1",
    date: "2026-06-21",
    title: "Mejoras visuales en Servicios",
    added: [],
    changed: ["Mejoras visuales en Servicios"],
    fixed: [],
    pending: []
  },
  {
    version: "1.1",
    date: "2026-06-21",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: ["Corrección de notificaciones"],
    pending: []
  },
  {
    version: "1.1",
    date: "2026-06-21",
    title: "Modo de práctica vocal",
    added: [
      "Se añadió un espacio de práctica para aprender la versión original y preparar la tonalidad del servicio",
      "Ahora pueden registrarse BPM, compás y notas iniciales",
      "Se incorporaron referencias de tono, acordes y un metrónomo integrado",
      "Los administradores y editores musicales pueden añadir guías propias por canción, sección y parte vocal"
    ],
    changed: [
      "Las tarjetas de coristas permanecen compactas y sin información instrumental innecesaria"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "1.1",
    date: "2026-06-21",
    title: "Mejoras visuales",
    added: [],
    changed: ["Mejoras visuales"],
    fixed: [],
    pending: []
  },
  {
    version: "1.1",
    date: "2026-06-20",
    title: "Vista compacta para coristas y medios",
    added: [],
    changed: [
      "La vista de servicio oculta tono y capo para coristas y equipo de medios",
      "Las tarjetas se compactan automáticamente en móvil y escritorio",
      "Instrumentistas y líderes conservan la información musical completa",
      "Se mantienen portadas, PDFs y enlaces externos"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "1.1",
    date: "2026-06-20",
    title: "Portadas visuales para los cantos",
    added: [
      "Los administradores y editores pueden subir, reemplazar y configurar portadas desde el repertorio",
      "Las imágenes se recortan, comprimen y almacenan automáticamente en GitHub",
      "Tipos de canto editables desde Configuración"
    ],
    changed: [
      "Músicos muestra miniaturas y fondos visuales discretos sin afectar la legibilidad",
      "Las portadas aparecen de forma compacta en repertorio, programación y sustituciones",
      "Los cantos sin portada conservan el diseño original"
    ],
    fixed: [
      "El botón Guardar canto vuelve a guardar correctamente los cambios del repertorio"
    ],
    pending: []
  },
  {
    version: "1.0",
    date: "2026-06-19",
    title: "Bienvenida diaria con versículo",
    added: [
      "Bienvenida diaria con el versículo del día para la primera apertura de cada usuario y dispositivo",
      "Enlace de diapositivas de iCloud por servicio para administradores y el equipo de Medios",
      "Comentarios de seguimiento con autor identificado por nombre corto"
    ],
    changed: [
      "Inicio muestra el próximo canto nuevo con cuenta regresiva en días, horas o minutos",
      "Guardar seguimiento conserva el trabajo y cerrar el servicio deja únicamente las observaciones útiles",
      "La indexación de PDFs procesa solo cantos nuevos, pendientes o con archivo modificado",
      "Los viewers pueden consultar el artista de cada canto",
      "El equipo de Medios puede guardar el enlace de diapositivas del servicio",
      "Navegación más fluida con carga anticipada de secciones",
      "Datos de los cantos sincronizados en Inicio, Programación, Músicos y Servicios",
      "La bienvenida prepara todas las secciones cuando han pasado dos horas",
      "La barra de bienvenida refleja la carga confirmada de datos y secciones",
      "Las secciones se precargan antes de cambiar y aparecen con un fundido suave",
      "La vista previa del PDF abre centrada y aprovecha la altura disponible",
      "Cada sección conserva su posición al cambiar y regresar"
    ],
    fixed: [
      "Notas internas actualizadas en Inicio y navegación directa a cantos y programaciones",
      "Revisión del servicio sin textos repetidos ni explicaciones internas de penalización",
      "Controles de tipos de servicio contenidos correctamente dentro de su tarjeta",
      "Transiciones generales optimizadas para móvil y computadora",
      "Selección de servicio y posición de lectura conservadas al volver",
      "Contraste de enlaces de escucha y navegación móvil mejorado",
      "Transiciones de carga y navegación más suaves",
      "Inicio espera la programación confirmada antes de terminar la bienvenida",
      "Se eliminaron las tarjetas vacías durante el cambio de sección",
      "Acordes externos ya no reutiliza por error el enlace de Google Drive",
      "Campana de notificaciones más visible y fechas legibles en modo oscuro",
      "El visor de PDF permite desplazarse sin quedar oculto por las barras",
      "Tarjetas de revisión y sustitución legibles en modo oscuro",
      "Se limpiaron los enlaces antiguos de acordes externos"
    ],
    pending: []
  },
  {
    version: "0.9.137",
    date: "2026-06-19",
    title: "Corrección de vistas para el modo oscuro y de colores",
    added: [
      "Versículo del día administrable en la pantalla de acceso",
      "Opciones editables de líderes y tipos de servicio",
      "Iconos oficiales de YouTube, Spotify y Google"
    ],
    changed: [
      "Corrección de vistas para el modo oscuro y de colores"
    ],
    fixed: [
      "Los avisos, botones e indicadores destacados respetan el acento elegido"
    ],
    pending: []
  },
  {
    version: "0.9.136",
    date: "2026-06-18",
    title: "Búsqueda de cantos afinada",
    added: [
      "Sugerencias relacionadas por tema o categoría al buscar un canto por título",
      "Búsqueda conjunta por título y palabras o frases de letras/PDF"
    ],
    changed: [
      "La indexación procesa únicamente PDFs nuevos o modificados",
      "El contador del próximo canto nuevo muestra la fecha sin clasificar incorrectamente el servicio"
    ],
    fixed: [
      "Las coincidencias de letras ya no aceptan caracteres sueltos",
      "Las coincidencias exactas de palabras reciben más peso que sus variantes derivadas"
    ],
    pending: []
  },
  {
    version: "0.9.135",
    date: "2026-06-18",
    title: "Asistente de programación renovado",
    added: [
      "Búsqueda combinable por título, temas y palabras o frases de letras/PDF",
      "Selección manual de cantos con orden reacomodable antes de guardar"
    ],
    changed: [
      "El asistente sugiere cantos individuales y ya no arma automáticamente todo el servicio",
      "La fecha seleccionada en el calendario se conserva al abrir las sugerencias",
      "El historial muestra meses y días junto con el tipo del último servicio"
    ],
    fixed: [
      "Las penalizaciones de rotación ahora reducen el porcentaje aunque los puntos a favor superen 100",
      "Las coincidencias parciales muestran la palabra real encontrada en la letra"
    ],
    pending: []
  },
  {
    version: "0.9.134",
    date: "2026-06-18",
    title: "Asistente para nuevas programaciones",
    added: [
      "Creación de programaciones nuevas directamente desde el Asistente",
      "Contador del próximo canto nuevo con accesos a PDF, YouTube y Spotify"
    ],
    changed: [
      "Los criterios por tema, letra/PDF y cantos base se pueden combinar",
      "La rotación prioriza cantos con más tiempo sin usarse o sin historial",
      "Miércoles evita himnos por defecto y Navidad solo aparece cuando se solicita"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "0.9.133",
    date: "2026-06-18",
    title: "Actualización corregida",
    added: [],
    changed: [
      "El aviso de nueva versión vuelve a aparecer antes de entrar a la app",
      "Actualizar ahora activa la versión nueva y limpia la caché anterior desde el primer intento"
    ],
    fixed: [
      "Botón de actualización que podía recargar la misma versión",
      "Caché antigua de la PWA que impedía reflejar cambios recientes"
    ],
    pending: []
  },
  {
    version: "0.9.132",
    date: "2026-06-18",
    title: "Mejoras del Asistente",
    added: [],
    changed: [
      "Sugerir bloque ahora crea combinaciones completas para el servicio",
      "Se limpió la redundancia entre Sugerir bloque y Buscar por letra/PDF",
      "La rotación favorece cantos poco usados y evita repetidos recientes",
      "Completar desde cantos elegidos vuelve a funcionar como apoyo para armar servicios",
      "Se mantuvo el Balance del repertorio en Estadísticas"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "0.9.131",
    date: "2026-06-18",
    title: "Programación inteligente unificada",
    added: [
      "Workspace del servicio con Programa, Asistente, Revisión y Seguimiento",
      "Asistente contextual dentro de cada programación"
    ],
    changed: [
      "Centro Inteligente ahora abre Programación con el Asistente contextual",
      "El Balance del repertorio se movió a Estadísticas",
      "Se mantuvieron los cantos nuevos planeados y la subida automática de PDFs a GitHub"
    ],
    fixed: [
      "Textos visibles con caracteres dañados",
      "Navegación duplicada, calendarios internos y revisiones largas fuera de su pestaña"
    ],
    pending: []
  },
  {
    version: "0.9.130",
    date: "2026-06-17",
    title: "Nuevo botón para reemplazar el PDF desde la app",
    added: ["Nuevo botón para reemplazar el PDF desde la app"],
    changed: [],
    fixed: [],
    pending: []
  },
  {
    version: "0.9.129",
    date: "2026-06-16",
    title: "correccion de vistas",
    added: [],
    changed: [],
    fixed: ["correccion de vistas"],
    pending: []
  },
  {
    version: "0.9.128",
    date: "2026-06-16",
    title: "corrección de vistas",
    added: [],
    changed: [],
    fixed: ["corrección de vistas"],
    pending: []
  },
  {
    version: "0.9.127",
    date: "2026-06-15",
    title: "recordatorio de cantos nuevos añadidos",
    added: [],
    changed: [],
    fixed: ["recordatorio de cantos nuevos añadidos"],
    pending: []
  },
  {
    version: "0.9.126",
    date: "2026-06-15",
    title: "recordatorio de cantos nuevos añadidos",
    added: ["recordatorio de cantos nuevos añadidos"],
    changed: [],
    fixed: [],
    pending: []
  },
  {
    version: "0.9.125",
    date: "2026-06-15",
    title: "correccion de vistas",
    added: [],
    changed: [],
    fixed: ["correccion de vistas"],
    pending: []
  },
  {
    version: "0.9.124",
    date: "2026-06-15",
    title: "vistas mejoradas",
    added: [],
    changed: ["vistas mejoradas"],
    fixed: [],
    pending: []
  },
  {
    version: "0.9.123",
    date: "2026-06-15",
    title: "Corrección de errores",
    added: [],
    changed: [],
    fixed: ["Corrección de errores"],
    pending: []
  },
  {
    version: "0.9.122",
    date: "2026-06-15",
    title: "Cantos nuevos planeados",
    added: [
      "Registro de cantos nuevos planeados dentro del calendario de Programación",
      "Estados Planeado, Listo, Estrenado y Pospuesto"
    ],
    changed: [
      "Programación permite consultar cantos nuevos por día, búsqueda y pestañas"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "0.9.121",
    date: "2026-06-12",
    title: "Interfaces y notificaciones",
    added: [
      "Activación guiada de notificaciones en dispositivos móviles"
    ],
    changed: [
      "Mejoras visuales en Historial, Repertorio y Vista de músicos"
    ],
    fixed: [
      "El aviso de recibir novedades desaparece cuando el dispositivo ya está registrado"
    ],
    pending: []
  },
  {
    version: "0.9.120",
    date: "2026-06-08",
    title: "Mejoras del Centro Inteligente",
    added: [
      "Método para completar bloques desde cantos elegidos"
    ],
    changed: [
      "Programación Inteligente más limpia con métodos por tema, letra/PDF o cantos base",
      "Bloques y recomendaciones compactos con rotación y criterios claros"
    ],
    fixed: [
      "La programación actual ya no se considera como servicio anterior"
    ],
    pending: []
  },
  {
    version: "0.9.119",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.118",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.117",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.116",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.115",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.114",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.113",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.112",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.111",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.110",
    date: "2026-06-08",
    title: "Corrección de notificaciones",
    added: [],
    changed: [],
    fixed: [
      "Corrección de notificaciones"
    ],
    pending: []
  },
  {
    version: "0.9.109",
    date: "2026-06-07",
    title: "Corrección de errores",
    added: [],
    changed: [],
    fixed: [
      "Corrección de errores"
    ],
    pending: []
  },
  {
    version: "0.9.108",
    date: "2026-06-07",
    title: "Corrección de errores visuales",
    added: [],
    changed: [],
    fixed: [
      "Corrección de errores visuales"
    ],
    pending: []
  },
  {
    version: "0.9.107",
    date: "2026-06-06",
    title: "Seguimiento y vistas por rol",
    added: [
      "Pendientes musicales que reaparecen hasta marcarse como corregidos",
      "Filtros de historial para cantos por corregir y pendientes resueltos"
    ],
    changed: [
      "Las notas internas del canto se usan también en las programaciones",
      "La revisión del servicio tiene mejor contraste en modo oscuro",
      "Viewer accede a una vista simplificada del repertorio y Músicos"
    ],
    fixed: [
      "Viewer ya no puede abrir la sección Programación ni ver la revisión técnica del servicio"
    ],
    pending: []
  },
  {
    version: "0.9.106",
    date: "2026-06-06",
    title: "Avisos y programación inteligente",
    added: [
      "Recordatorios para cantos nuevos planeados por día",
      "Creación inteligente por tema, letra/PDF o ambos"
    ],
    changed: [
      "Los cambios de una programación futura avisan qué cambió"
    ],
    fixed: [
      "Ya no se envía una notificación solo por agregar un canto al repertorio"
    ],
    pending: []
  },
  {
    version: "0.9.105",
    date: "2026-06-03",
    title: "Centro Inteligente y seguridad",
    added: [
      "Busqueda independiente en letras/PDF para recomendaciones",
      "Orden manual con arrastre en bloques sugeridos, programaciones y programas especiales"
    ],
    changed: [
      "Rotacion con reglas visibles de 14 y 30 dias",
      "Score con coincidencias de letra/PDF y uso reciente mas claro",
      "Reglas de seguridad y backend push endurecidas"
    ],
    fixed: [
      "Correcciones de validacion y consistencia en revision inteligente"
    ],
    pending: []
  },
  {
    version: "0.9.104",
    date: "2026-05-30",
    title: "Corrección de carga",
    added: [],
    changed: [
      "La verificación de actualización compara contra la versión real que está corriendo"
    ],
    fixed: [
      "Corrección de casos donde el navegador podía quedarse con una versión vieja después de actualizar"
    ],
    pending: []
  },
  {
    version: "0.9.103",
    date: "2026-05-29",
    title: "Programas y revisión inteligente",
    added: [],
    changed: [
      "Mejor diseño tipográfico para programas especiales impresos",
      "Sustitución inteligente más estricta con categorías de cantos",
      "Revisión compacta con grupos desplegables de uno en uno",
      "Balance del Centro Inteligente más minimalista"
    ],
    fixed: [
      "El botón Actualizar ahora fuerza la recarga de assets nuevos desde el primer intento"
    ],
    pending: []
  },
  {
    version: "0.9.102",
    date: "2026-05-29",
    title: "Colores de programa especial",
    added: [
      "Colores editables para las categorías del programa especial"
    ],
    changed: [
      "Los programas imprimibles individual y 2 por hoja muestran el color asignado a cada categoría"
    ],
    fixed: [],
    pending: []
  },
  {
    version: "0.9.101",
    date: "2026-05-29",
    title: "Corrección de errores",
    added: [],
    changed: [
      "Corrección de errores"
    ],
    fixed: [
      "Corrección de errores"
    ],
    pending: []
  },
  {
    version: "0.9.100",
    date: "2026-05-29",
    title: "Corrección de errores",
    added: [],
    changed: [
      "Corrección de errores"
    ],
    fixed: [
      "Corrección de errores"
    ],
    pending: []
  },
  {
    version: "0.9.99",
    date: "2026-05-28",
    title: "Push y programas especiales",
    added: [],
    changed: [
      "El envío de push por nueva programación se dispara antes de la auditoría para evitar bloqueos",
      "El formato de 2 programas por hoja muestra tipo, acción, posición y notas",
      "El texto de los programas por media hoja ajusta tamaño y espaciado según la cantidad de elementos"
    ],
    fixed: [
      "La auditoría ya no puede impedir que se intente enviar la notificación de una nueva programación",
      "El formato compacto del programa especial deja de ocultar detalles importantes",
      "La media hoja mantiene su marco completo y reparte mejor el contenido"
    ],
    pending: [
      "Probar un envío real de push en producción con un dispositivo registrado activo"
    ]
  },
  {
    version: "0.9.98",
    date: "2026-05-25",
    title: "Corrección urgente de Programación",
    added: [],
    changed: [
      "La pantalla inicial de actualización ahora respeta la versión marcada al actualizar",
      "El aviso de actualización evita repetirse antes de entrar a la app"
    ],
    fixed: [
      "Corrección de la caída de la sección Programación",
      "La app ya no sobrescribe la versión instalada con una versión anterior durante la recarga",
      "El selector interno de cantos del programa especial tolera que todavía no haya programación seleccionada"
    ],
    pending: [
      "Seguir validando el flujo de actualización en PWA instalada y navegador móvil"
    ]
  },
  {
    version: "0.9.97",
    date: "2026-05-25",
    title: "Programas especiales y Vista de músicos",
    added: [
      "Programa especial en hoja carta horizontal con 2 copias por hoja",
      "Posiciones musicales simples para servicios especiales: Apertura, Antes de la prédica y Después de la prédica",
      "Editor especial que arranca desde los cantos ya incluidos en la programación"
    ],
    changed: [
      "El selector de canto del programa especial solo muestra cantos de esa programación",
      "La Vista de músicos mantiene solo acciones simples para ver o editar el programa especial",
      "El seguimiento del servicio fusiona comentarios abiertos para que la evaluación sea más rápida"
    ],
    fixed: [
      "Corrección del scroll en Sustitución inteligente desde Vista de músicos",
      "La impresión especial usa el programa guardado o genera uno básico desde la programación",
      "El snapshot de cierre toma notas desde los campos visibles del seguimiento"
    ],
    pending: [
      "Validar el formato impreso con una impresora real antes de producir muchos programas"
    ]
  },
  {
    version: "0.9.96",
    date: "2026-05-25",
    title: "Historial, calendario inteligente y seguimiento",
    added: [
      "Filtros avanzados en Historial por líder, estado, preparación, seguimiento y cantidad de cantos",
      "Selector de calendario para elegir programaciones existentes desde Centro Inteligente",
      "Seguimiento posterior del servicio con notas generales y por canto"
    ],
    changed: [
      "La invitación de notificaciones registra el dispositivo desde el mismo botón",
      "La bienvenida muestra la versión con mejor contraste en modo oscuro",
      "La revisión inteligente excluye la programación actual del historial de uso"
    ],
    fixed: [
      "Corrección del falso aviso de canto usado en el servicio anterior",
      "Servicios pasados pueden conservar snapshot de preparación al cierre",
      "Historial y Estadísticas ignoran programaciones eliminadas"
    ],
    pending: [
      "Seguir ajustando filtros según el uso real del historial"
    ]
  },
  {
    version: "0.9.95",
    date: "2026-05-23",
    title: "Revisión inteligente unificada",
    added: [
      "Panel de notificaciones internas en portal global",
      "Indexación de letras/PDF desde Centro Inteligente",
      "Revisión compacta clickeable en Programación y Músicos"
    ],
    changed: [
      "YouTube y Spotify quedan como datos informativos, no afectan score ni preparación",
      "Tarjetas de recomendaciones con etiqueta variable por porcentaje",
      "Avisos de Programación Inteligente aparecen junto al botón de acción"
    ],
    fixed: [
      "La campana ya no queda por detrás de las secciones",
      "La barra de riesgo/preparación usa la misma escala visual en todas las vistas",
      "Modo oscuro con mayor contraste en tarjetas, barras y avisos"
    ],
    pending: [
      "Afinar pesos del score con retroalimentación de músicos después de usarlo en servicios reales"
    ]
  },
  {
    version: "0.9.94",
    date: "2026-05-23",
    title: "Centro Inteligente más claro",
    added: [
      "Reglas visibles para historial reciente y poco uso",
      "Riesgo de la revisión inteligente con colores por nivel",
      "Aviso de actualización reforzado antes de la bienvenida"
    ],
    changed: [
      "Tarjetas de candidatos más compactas y minimalistas",
      "Modal de score con un solo resultado final y desglose útil",
      "El score muestra puntos a favor y en contra con mayor consistencia"
    ],
    fixed: [
      "La revisión inteligente mejora contraste en modo oscuro",
      "Se quitaron textos redundantes de las recomendaciones",
      "La versión instalada se sincroniza cuando no hay actualización pendiente"
    ],
    pending: [
      "Ajustar pesos con más historial real si el equipo quiere una rotación más estricta"
    ]
  },
  {
    version: "0.9.93",
    date: "2026-05-23",
    title: "Navegación reducida y OCR persistente",
    added: [
      "Versión visible en la bienvenida inicial",
      "Pantalla de actualización disponible antes de la bienvenida",
      "Fingerprint de PDF para reutilizar índices OCR ya guardados"
    ],
    changed: [
      "En vista reducida la barra muestra Inicio, Programación, Centro Inteligente, Músicos y Más",
      "Repertorio se movió al menú Más en móvil/ancho reducido",
      "Programación Inteligente inicia sin fecha, servicio ni temas predeterminados"
    ],
    fixed: [
      "Panel de notificaciones más compacto y alineado en móvil y PC",
      "Posiciones de cantos se ajustan dinámicamente y solo el último queda después de la prédica",
      "Centro Inteligente mantiene brillo visual sin repetir textos innecesarios"
    ],
    pending: [
      "Probar OCR persistente con PDFs escaneados pesados en celulares de gama baja"
    ]
  },
  {
    version: "0.9.92",
    date: "2026-05-23",
    title: "OCR y pulido del Centro Inteligente",
    added: [
      "OCR automático gratuito para indexar PDFs escaneados desde Ajustes",
      "Selección organizada de tema principal y varios temas adicionales",
      "Brillos sutiles en la navegación del Centro Inteligente"
    ],
    changed: [
      "Centro Inteligente usa el icono brillante y Actualizaciones usa un icono de historial",
      "Las tarjetas del bloque sugerido son más compactas y estables en PC",
      "El score ya no toma en cuenta enlaces de escucha"
    ],
    fixed: [
      "La revisión del servicio muestra una sola barra de riesgo/preparación",
      "Los temas secundarios aceptan varios valores escritos o seleccionados",
      "El panel de indexación distingue texto seleccionable y OCR automático"
    ],
    pending: [
      "OCR puede tardar varios minutos en bibliotecas grandes o PDFs escaneados pesados"
    ]
  },
  {
    version: "0.9.91",
    date: "2026-05-23",
    title: "Limpieza del Centro Inteligente",
    added: [
      "Temas adicionales múltiples en Programación Inteligente",
      "Búsqueda opcional en letras/PDF indexado",
      "Score explicado por canto con puntos a favor y en contra"
    ],
    changed: [
      "Programación Inteligente queda organizada en servicio, temas, bloque sugerido y candidatos",
      "Balance ahora abre Repertorio con filtros reales aplicados",
      "Centro Inteligente destaca visualmente en la navegación principal"
    ],
    fixed: [
      "Se quitó Santa Cena como tipo de servicio fijo del Centro Inteligente",
      "Se redujeron tarjetas y textos repetidos",
      "Las tarjetas de candidatos quedan más limpias y alineadas"
    ],
    pending: [
      "Ajustar los pesos del scoring con más historial real del ministerio"
    ]
  },
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
