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
    artist: "Referencia congregacional",
    mainKey: "D",
    tempo: "72",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    lyricsSections: [
      { type: "verso", text: "Texto de ejemplo para reemplazar manualmente." },
      { type: "coro", text: "Placeholder de letra. No incluye letra protegida." }
    ],
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
    artist: "Referencia congregacional",
    mainKey: "G",
    tempo: "68",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    lyricsSections: [
      { type: "verso", text: "Texto de ejemplo para agregar letra propia." },
      { type: "puente", text: "Placeholder editable." }
    ],
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
    artist: "Referencia congregacional",
    mainKey: "E",
    tempo: "96",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    lyricsSections: [
      { type: "verso", text: "Texto de ejemplo." },
      { type: "coro", text: "Placeholder editable para letra." }
    ],
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
    artist: "Referencia congregacional",
    mainKey: "C",
    tempo: "64",
    timeSignature: "6/8",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    lyricsSections: [
      { type: "verso", text: "Texto de ejemplo sin letra protegida." },
      { type: "final", text: "Placeholder para cierre." }
    ],
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
    artist: "Referencia congregacional",
    mainKey: "F",
    tempo: "70",
    timeSignature: "4/4",
    youtubeUrl: "https://youtube.com",
    chordsUrl: "",
    lyricsSections: [
      { type: "verso", text: "Texto de ejemplo para completar." },
      { type: "coro", text: "Placeholder editable." }
    ],
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
    time: "10:00",
    type: "domingo",
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
    time: "19:30",
    type: "miércoles",
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
  logoUrl: ""
};
