export const songTags = [
  "adoración",
  "gratitud",
  "cruz",
  "gracia",
  "esperanza",
  "alabanza",
  "santa cena"
];

export const meetingTypes = [
  "domingo",
  "miércoles",
  "ensayo",
  "especial",
  "santa cena",
  "jóvenes",
  "otro"
];

export const songKeys = ["C", "D", "E", "F", "G", "A", "B", "Am", "Bm", "Cm", "Dm", "Em", "F#m"];

export const sampleSongs = [
  {
    id: "song-vine-a-adorarte",
    title: "Vine a adorarte",
    artistOrSource: "Referencia congregacional",
    category: "normal",
    mainTheme: "adoración",
    otherThemes: ["gratitud"],
    mainKey: "D",
    capo: 0,
    keyWithCapo: "D",
    hasKeyChange: false,
    format: "pdf",
    pdfUrl: "",
    drivePdfUrl: "",
    pdfPreviewUrl: "",
    storagePdfUrl: "",
    tempo: "72",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    musicReviewStatus: "completado",
    keynoteReviewStatus: "pendiente",
    pdfReviewStatus: "pendiente",
    sungBefore: true,
    lyricsSections: [],
    tags: ["adoración", "gratitud"],
    internalNotes: "Buena para abrir un tiempo de adoración tranquilo.",
    usageCount: 4,
    lastUsedAt: "2026-04-19",
    createdAt: "2026-01-08",
    updatedAt: "2026-04-19",
    createdBy: "seed"
  },
  {
    id: "song-tu-gloria",
    title: "Tu gloria",
    artistOrSource: "Referencia congregacional",
    category: "normal",
    mainTheme: "adoración",
    otherThemes: ["esperanza"],
    mainKey: "G",
    capo: 2,
    keyWithCapo: "A",
    hasKeyChange: false,
    format: "pdf",
    pdfUrl: "",
    drivePdfUrl: "",
    pdfPreviewUrl: "",
    storagePdfUrl: "",
    tempo: "68",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    musicReviewStatus: "en revisión",
    keynoteReviewStatus: "pendiente",
    pdfReviewStatus: "pendiente",
    sungBefore: true,
    lyricsSections: [],
    tags: ["adoración", "esperanza"],
    internalNotes: "Cuidar dinámica antes del puente.",
    usageCount: 2,
    lastUsedAt: "2026-03-24",
    createdAt: "2026-01-09",
    updatedAt: "2026-03-24",
    createdBy: "seed"
  },
  {
    id: "song-te-alabamos",
    title: "Te alabamos",
    artistOrSource: "Referencia congregacional",
    category: "normal",
    mainTheme: "alabanza",
    otherThemes: ["gratitud"],
    mainKey: "E",
    capo: 0,
    keyWithCapo: "E",
    hasKeyChange: false,
    format: "pdf",
    pdfUrl: "",
    drivePdfUrl: "",
    pdfPreviewUrl: "",
    storagePdfUrl: "",
    tempo: "96",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    musicReviewStatus: "completado",
    keynoteReviewStatus: "completado",
    pdfReviewStatus: "completado",
    sungBefore: true,
    lyricsSections: [],
    tags: ["alabanza", "gratitud"],
    internalNotes: "Energía media, funciona después de bienvenida.",
    usageCount: 6,
    lastUsedAt: "2026-05-03",
    createdAt: "2026-01-10",
    updatedAt: "2026-05-03",
    createdBy: "seed"
  },
  {
    id: "song-su-manto",
    title: "Su manto por el mío",
    artistOrSource: "Referencia congregacional",
    category: "santa cena",
    mainTheme: "cruz",
    otherThemes: ["gracia", "santa cena"],
    mainKey: "C",
    capo: 2,
    keyWithCapo: "D",
    hasKeyChange: false,
    format: "pdf",
    pdfUrl: "",
    drivePdfUrl: "",
    pdfPreviewUrl: "",
    storagePdfUrl: "",
    tempo: "64",
    timeSignature: "6/8",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    musicReviewStatus: "completado",
    keynoteReviewStatus: "en revisión",
    pdfReviewStatus: "pendiente",
    sungBefore: true,
    lyricsSections: [],
    tags: ["cruz", "gracia", "santa cena"],
    internalNotes: "Ideal para santa cena o meditación.",
    usageCount: 3,
    lastUsedAt: "2026-04-05",
    createdAt: "2026-01-11",
    updatedAt: "2026-04-05",
    createdBy: "seed"
  },
  {
    id: "song-recordamos-hoy",
    title: "Recordamos hoy",
    artistOrSource: "Referencia congregacional",
    category: "santa cena",
    mainTheme: "santa cena",
    otherThemes: ["cruz"],
    mainKey: "F",
    capo: 0,
    keyWithCapo: "F",
    hasKeyChange: false,
    format: "pdf",
    pdfUrl: "",
    drivePdfUrl: "",
    pdfPreviewUrl: "",
    storagePdfUrl: "",
    tempo: "70",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    musicReviewStatus: "pendiente",
    keynoteReviewStatus: "pendiente",
    pdfReviewStatus: "pendiente",
    sungBefore: true,
    lyricsSections: [],
    tags: ["santa cena", "cruz"],
    internalNotes: "Mantener arreglo simple.",
    usageCount: 1,
    lastUsedAt: "2026-02-16",
    createdAt: "2026-01-12",
    updatedAt: "2026-02-16",
    createdBy: "seed"
  }
];

export const sampleSchedules = [
  {
    id: "schedule-next-sunday",
    date: "2026-05-17",
    time: "11:00",
    type: "domingo",
    serviceType: "domingo-manana",
    serviceLabel: "Domingo mañana",
    status: "confirmado",
    leader: "Equipo de alabanza",
    songs: [
      {
        songId: "song-te-alabamos",
        titleSnapshot: "Te alabamos",
        keySnapshot: "E",
        notes: "Entrada con guitarra acústica."
      },
      {
        songId: "song-vine-a-adorarte",
        titleSnapshot: "Vine a adorarte",
        keySnapshot: "D",
        notes: "Bajar dinámica al final."
      },
      {
        songId: "song-su-manto",
        titleSnapshot: "Su manto por el mío",
        keySnapshot: "C",
        notes: "Preparar transición a oración."
      }
    ],
    generalNotes: "Ensayo breve antes del culto. Revisar tonos con vocalistas.",
    createdAt: "2026-05-05",
    updatedAt: "2026-05-10",
    createdBy: "seed"
  },
  {
    id: "schedule-midweek",
    date: "2026-05-13",
    time: "19:00",
    type: "miércoles",
    serviceType: "miercoles-oracion",
    serviceLabel: "Miércoles de oración",
    status: "confirmado",
    leader: "Director de música",
    songs: [
      {
        songId: "song-tu-gloria",
        titleSnapshot: "Tu gloria",
        keySnapshot: "G",
        notes: "Versión corta."
      },
      {
        songId: "song-recordamos-hoy",
        titleSnapshot: "Recordamos hoy",
        keySnapshot: "F",
        notes: "Solo piano y voces."
      }
    ],
    generalNotes: "Servicio entre semana, mantener lista compacta.",
    createdAt: "2026-05-01",
    updatedAt: "2026-05-09",
    createdBy: "seed"
  }
];

export const sampleUsers = [
  {
    id: "demo-admin",
    uid: "demo-admin",
    email: "admin@rocaeterna.local",
    displayName: "Admin Demo",
    role: "admin",
    active: true,
    createdAt: "2026-01-01",
    lastLogin: "2026-05-11"
  }
];

export const sampleSettings = {
  churchName: "Roca Eterna",
  appName: "Roca Eterna Música",
  logoLightUrl: "",
  logoDarkUrl: "",
  logoAltText: "Roca Eterna Música",
  keyPreference: "sharps",
  themeMode: "light",
  accentColor: "#b6945f",
  blueGrayColor: "#60717d"
};

export const sampleThemes = songTags.map((name, index) => ({
  id: `theme-${name.replace(/\s+/g, "-")}`,
  name,
  active: true,
  createdAt: `2026-01-${String(index + 1).padStart(2, "0")}`
}));
