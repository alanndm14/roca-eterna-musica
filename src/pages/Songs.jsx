import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Edit3, ExternalLink, FileText, Headphones, Plus, Search, Trash2, Youtube } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import {
  BASIC_KEYS,
  REVIEW_STATUSES,
  SONG_CATEGORIES,
  SONG_FORMATS,
  calculateKeyWithCapo,
  collectSongKeys,
  collectSongThemes,
  getSongExternalChordsUrl,
  getSongPdfUrl,
  getSongSpotifyUrl,
  getSongYoutubeUrl,
  normalizeDrivePdfUrl,
  normalizeSearchText,
  normalizeSong
} from "../services/songUtils";

const blankSong = {
  title: "",
  artistOrSource: "",
  category: "normal",
  mainTheme: "",
  otherThemes: [],
  mainKey: "",
  capo: 0,
  keyWithCapo: "",
  hasKeyChange: false,
  format: "pdf",
  pdfUrl: "",
  drivePdfUrl: "",
  pdfPreviewUrl: "",
  localPdfPath: "",
  storagePdfUrl: "",
  youtubeUrl: "",
  spotifyUrl: "",
  chordsUrl: "",
  externalChordsUrl: "",
  musicReviewStatus: "pendiente",
  keynoteReviewStatus: "pendiente",
  pdfReviewStatus: "pendiente",
  sungBefore: false,
  lyricsSections: [],
  tags: [],
  internalNotes: ""
};

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink/55">{title}</h3>
      {children}
    </section>
  );
}

function ReviewBadge({ label, value }) {
  const complete = value === "completado";
  const reviewing = value === "en revisión";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${complete ? "bg-brass/15 text-brass" : reviewing ? "bg-blue-gray/15 text-blue-gray" : "bg-ink/7 text-ink/55"}`}>
      {label}: {value || "pendiente"}
    </span>
  );
}

const getVisiblePdfInput = (song) => song.pdfUrl || song.drivePdfUrl || (!song.pdfUrl && !song.drivePdfUrl ? song.chordsUrl : "") || "";

const toneSummary = (song) => {
  if (Number(song.capo || 0) > 0) return `Capo ${song.capo} · Suena en ${song.keyWithCapo || song.mainKey || "--"}`;
  return `Sin capo · Tono ${song.mainKey || song.keyWithCapo || "--"}`;
};

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const todayFile = () => new Date().toISOString().slice(0, 10);

const downloadCsv = (fileName, rows) => {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const getSearchMatches = (song, query) => {
  const term = normalizeSearchText(query);
  if (!term) return [];
  const fields = [
    { label: "Coincidencia en título", values: [song.title] },
    { label: "Coincidencia en artista/fuente", values: [song.artistOrSource] },
    { label: "Coincidencia en tema", values: [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])] },
    { label: "Coincidencia en categoría", values: [song.category] },
    { label: "Coincidencia en tono", values: [song.mainKey, song.keyWithCapo] },
    { label: "Coincidencia en comentario", values: [song.internalNotes] },
    { label: "Coincidencia en PDF", values: [song.pdfSearchText, ...(song.pdfSearchTokens || [])] }
  ];

  return fields
    .filter((field) => normalizeSearchText((field.values || []).filter(Boolean).join(" ")).includes(term))
    .map((field) => field.label);
};

function SongForm({ initialSong, themes, keyPreference, onSubmit, onCancel }) {
  const normalizedInitial = normalizeSong(initialSong || blankSong, keyPreference);
  const [song, setSong] = useState(() => ({
    ...normalizedInitial,
    externalChordsUrl: getSongExternalChordsUrl(normalizedInitial)
  }));
  const [manualKey, setManualKey] = useState(Boolean(initialSong?.keyWithCapo && initialSong?.keyWithCapo !== calculateKeyWithCapo(initialSong?.mainKey, initialSong?.capo, keyPreference)));
  const [showLyrics, setShowLyrics] = useState(Boolean(normalizedInitial.lyricsSections?.length));

  const update = (field, value) => setSong((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!manualKey) {
      setSong((current) => ({
        ...current,
        keyWithCapo: calculateKeyWithCapo(current.mainKey, current.capo, keyPreference)
      }));
    }
  }, [song.mainKey, song.capo, keyPreference, manualKey]);

  const updatePdf = (value) => {
    setSong((current) => ({
      ...current,
      pdfUrl: value,
      drivePdfUrl: value.includes("drive.google.com") ? value : "",
      pdfPreviewUrl: normalizeDrivePdfUrl(value),
      chordsUrl: current.chordsUrl && current.chordsUrl !== getVisiblePdfInput(current) ? current.chordsUrl : value
    }));
  };

  const updateSection = (index, field, value) => {
    setSong((current) => ({
      ...current,
      lyricsSections: (current.lyricsSections || []).map((section, currentIndex) =>
        currentIndex === index ? { ...section, [field]: value } : section
      )
    }));
  };

  const addOtherTheme = (value) => {
    if (!value || song.otherThemes.includes(value)) return;
    update("otherThemes", [...song.otherThemes, value]);
  };

  const addLyricsSection = () => {
    setShowLyrics(true);
    setSong((current) => ({
      ...current,
      lyricsSections: current.lyricsSections?.length ? current.lyricsSections : [{ type: "verso", text: "" }]
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!song.title.trim()) return;
    const visiblePdf = getVisiblePdfInput(song);
    const preview = normalizeDrivePdfUrl(song.drivePdfUrl || visiblePdf);
    const next = normalizeSong(
      {
        ...song,
        title: song.title.trim(),
        pdfUrl: visiblePdf || song.pdfUrl,
        drivePdfUrl: visiblePdf.includes("drive.google.com") ? visiblePdf : song.drivePdfUrl,
        pdfPreviewUrl: song.pdfPreviewUrl || preview,
        chordsUrl: song.externalChordsUrl || song.chordsUrl || visiblePdf,
        externalChordsUrl: song.externalChordsUrl || "",
        tags: [...new Set([song.mainTheme, ...(song.otherThemes || [])].filter(Boolean))],
        lyricsSections: showLyrics ? (song.lyricsSections || []).filter((section) => section.text?.trim() || section.type) : []
      },
      keyPreference
    );
    onSubmit(next);
  };

  return (
    <form onSubmit={submit} className="flex max-h-[78vh] flex-col overflow-hidden">
      <div className="space-y-4 overflow-y-auto pr-1">
        <Section title="Información básica">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nombre">
              <Input value={song.title} onChange={(event) => update("title", event.target.value)} required />
            </Field>
            <Field label="Artista o fuente">
              <Input value={song.artistOrSource || ""} onChange={(event) => update("artistOrSource", event.target.value)} />
            </Field>
            <Field label="Categoría">
              <Select value={song.category || "normal"} onChange={(event) => update("category", event.target.value)}>
                {SONG_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Tonalidad y capo">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Tonalidad principal">
              <Select value={song.mainKey || ""} onChange={(event) => update("mainKey", event.target.value)}>
                {BASIC_KEYS.map((key) => <option key={key} value={key}>{key || "Sin tono"}</option>)}
              </Select>
            </Field>
            <Field label="Capo">
              <Input type="number" min="0" max="12" value={song.capo ?? 0} onChange={(event) => update("capo", Number(event.target.value))} />
            </Field>
            <Field label="Tonalidad con capo">
              <Input value={song.keyWithCapo || ""} readOnly={!manualKey} onChange={(event) => update("keyWithCapo", event.target.value)} />
            </Field>
            <Field label="Cambio de tono">
              <Select value={song.hasKeyChange ? "si" : "no"} onChange={(event) => update("hasKeyChange", event.target.value === "si")}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </Select>
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink/60">
            <input type="checkbox" checked={manualKey} onChange={(event) => setManualKey(event.target.checked)} />
            Editar tonalidad con capo manualmente
          </label>
        </Section>

        <Section title="Temas">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tema principal">
              <Select value={song.mainTheme || ""} onChange={(event) => update("mainTheme", event.target.value)}>
                <option value="">Sin tema</option>
                {themes.map((theme) => <option key={theme}>{theme}</option>)}
              </Select>
            </Field>
            <Field label="Otros temas">
              <Select value="" onChange={(event) => addOtherTheme(event.target.value)}>
                <option value="">Agregar tema</option>
                {themes.map((theme) => <option key={theme}>{theme}</option>)}
              </Select>
            </Field>
          </div>
          {song.otherThemes?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {song.otherThemes.map((theme) => (
                <button key={theme} type="button" className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white" onClick={() => update("otherThemes", song.otherThemes.filter((item) => item !== theme))}>
                  {theme} ×
                </button>
              ))}
            </div>
          ) : null}
        </Section>

        <Section title="Archivos y enlaces">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="PDF de letra y acordes">
              <Input value={getVisiblePdfInput(song)} onChange={(event) => updatePdf(event.target.value)} placeholder="https://drive.google.com/file/d/..." />
            </Field>
            <Field label="Ruta PDF local, opcional">
              <Input value={song.localPdfPath || ""} onChange={(event) => update("localPdfPath", event.target.value)} placeholder="/pdfs/nombre-del-canto.pdf" />
              <p className="mt-2 text-xs leading-5 text-ink/55">
                Si el archivo esta en public/pdfs/Glorificate.pdf, escribe /pdfs/Glorificate.pdf. Tambien se aceptan rutas como pdfs/Glorificate.pdf; no es necesario escribir public/.
              </p>
            </Field>
            <Field label="YouTube">
              <Input value={song.youtubeUrl || ""} onChange={(event) => update("youtubeUrl", event.target.value)} placeholder="https://youtube.com/..." />
            </Field>
            <Field label="Spotify">
              <Input value={song.spotifyUrl || ""} onChange={(event) => update("spotifyUrl", event.target.value)} placeholder="https://open.spotify.com/..." />
            </Field>
            <Field label="Acordes externos opcional">
              <Input value={song.externalChordsUrl || ""} onChange={(event) => update("externalChordsUrl", event.target.value)} placeholder="Link externo si es distinto del PDF" />
            </Field>
          </div>
          <p className="mt-3 text-sm text-ink/55">Pega un link compartido de Google Drive o un link directo a PDF. La app intentará generar la vista previa automáticamente.</p>
          <p className="mt-2 text-sm text-ink/55">La ruta PDF local solo funciona si el archivo existe dentro de public/pdfs en el proyecto. Estos PDFs serán públicos en GitHub Pages.</p>
        </Section>

        <Section title="Estado de revisión">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Revisión musical">
              <Select value={song.musicReviewStatus} onChange={(event) => update("musicReviewStatus", event.target.value)}>
                {REVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </Select>
            </Field>
            <Field label="Revisión Keynote">
              <Select value={song.keynoteReviewStatus} onChange={(event) => update("keynoteReviewStatus", event.target.value)}>
                {REVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </Select>
            </Field>
            <Field label="Revisión PDF">
              <Select value={song.pdfReviewStatus} onChange={(event) => update("pdfReviewStatus", event.target.value)}>
                {REVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </Select>
            </Field>
            <Field label="Ya se ha cantado">
              <Select value={song.sungBefore ? "si" : "no"} onChange={(event) => update("sungBefore", event.target.value === "si")}>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Comentarios">
          <Field label="Comentarios internos">
            <Textarea value={song.internalNotes || ""} onChange={(event) => update("internalNotes", event.target.value)} />
          </Field>
        </Section>

        <Section title="Letra manual opcional">
          {!showLyrics ? (
            <Button variant="subtle" onClick={addLyricsSection}>
              <Plus className="h-4 w-4" />
              Agregar letra manual
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink/55">Solo usa esta sección si no quieres depender únicamente del PDF.</p>
                <Button variant="subtle" onClick={() => update("lyricsSections", [...(song.lyricsSections || []), { type: "verso", text: "" }])}>
                  <Plus className="h-4 w-4" />
                  Sección
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                {(song.lyricsSections || []).map((section, index) => (
                  <div key={index} className="grid gap-3 rounded-2xl border border-ink/10 bg-stonewash p-3 md:grid-cols-[180px_1fr_44px]">
                    <Select value={section.type} onChange={(event) => updateSection(index, "type", event.target.value)}>
                      {["verso", "coro", "puente", "final", "instrumental"].map((type) => <option key={type}>{type}</option>)}
                    </Select>
                    <Textarea value={section.text} onChange={(event) => updateSection(index, "text", event.target.value)} placeholder="Letra manual opcional" />
                    <Button variant="danger" className="h-11 w-11 px-0" onClick={() => update("lyricsSections", song.lyricsSections.filter((_, itemIndex) => itemIndex !== index))}>×</Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      <div className="sticky bottom-0 mt-4 flex justify-end gap-3 border-t border-ink/10 bg-stonewash pt-4">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar canto</Button>
      </div>
    </form>
  );
}

export function Songs() {
  const { canEdit, canDelete } = useAuth();
  const navigate = useNavigate();
  const { songs, schedules, themes, settings, deleteSong, saveSong } = useMusicData();
  const [filters, setFilters] = useState({
    query: "",
    category: "",
    mainTheme: "",
    otherTheme: "",
    key: "",
    capo: "",
    music: "",
    keynote: "",
    pdf: "",
    sung: "",
    format: "",
    keyChange: "",
    localPdf: "",
    artist: ""
  });
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("roca-eterna-song-view-mode") || "cards");
  const [editingSong, setEditingSong] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const themeOptions = useMemo(() => collectSongThemes(songs, themes), [songs, themes]);
  const keyOptions = useMemo(() => collectSongKeys(songs), [songs]);
  const capoOptions = useMemo(() => [...new Set(songs.map((song) => song.capo).filter((capo) => capo !== undefined && capo !== ""))].sort((a, b) => Number(a) - Number(b)), [songs]);
  const categories = useMemo(() => [...new Set([...SONG_CATEGORIES, ...songs.map((song) => song.category).filter(Boolean)])], [songs]);
  const formats = useMemo(() => [...new Set([...SONG_FORMATS, ...songs.map((song) => song.format).filter(Boolean)])], [songs]);
  const realUsageBySong = useMemo(() => {
    const today = todayFile();
    const counts = new Map();
    schedules.forEach((schedule) => {
      if (schedule.date && schedule.date > today) return;
      (schedule.songs || []).forEach((entry) => {
        if (!entry.songId) return;
        counts.set(entry.songId, (counts.get(entry.songId) || 0) + 1);
      });
    });
    return counts;
  }, [schedules]);

  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const clearFilters = () => setFilters({ query: "", category: "", mainTheme: "", otherTheme: "", key: "", capo: "", music: "", keynote: "", pdf: "", sung: "", format: "", keyChange: "", localPdf: "", artist: "" });

  const filteredSongs = useMemo(
    () =>
      songs.filter((song) => {
        const searchText = [
          song.title,
          song.artistOrSource,
          song.category,
          song.mainTheme,
          ...(song.otherThemes || []),
          ...(song.tags || []),
          song.mainKey,
          song.keyWithCapo,
          song.internalNotes,
          song.pdfSearchText,
          ...(song.pdfSearchTokens || [])
        ].join(" ");
        const matchesQuery = !filters.query || normalizeSearchText(searchText).includes(normalizeSearchText(filters.query));
        const matchesCategory = !filters.category || song.category === filters.category;
        const matchesMainTheme = !filters.mainTheme || song.mainTheme === filters.mainTheme;
        const matchesOtherTheme = !filters.otherTheme || (song.otherThemes || []).includes(filters.otherTheme) || (song.tags || []).includes(filters.otherTheme);
        const matchesKey = !filters.key || song.mainKey === filters.key || song.keyWithCapo === filters.key;
        const matchesCapo = filters.capo === "" || Number(song.capo || 0) === Number(filters.capo);
        const matchesMusic = !filters.music || song.musicReviewStatus === filters.music;
        const matchesKeynote = !filters.keynote || song.keynoteReviewStatus === filters.keynote;
        const matchesPdf = !filters.pdf || song.pdfReviewStatus === filters.pdf;
        const matchesSung = !filters.sung || (filters.sung === "si" ? song.sungBefore : !song.sungBefore);
        const matchesFormat = !filters.format || song.format === filters.format;
        const matchesKeyChange = !filters.keyChange || (filters.keyChange === "si" ? song.hasKeyChange : !song.hasKeyChange);
        const matchesArtist = !filters.artist || normalizeSearchText(song.artistOrSource).includes(normalizeSearchText(filters.artist));
        const hasLocalPdf = Boolean(song.localPdfPath);
        const matchesLocalPdf = !filters.localPdf
          || (filters.localPdf === "with" && hasLocalPdf)
          || (filters.localPdf === "without" && !hasLocalPdf)
          || (filters.localPdf === "invalid" && ["missing", "failed", "error"].includes(song.pdfIndexStatus || song.localPdfStatus));
        return matchesQuery && matchesCategory && matchesMainTheme && matchesOtherTheme && matchesKey && matchesCapo && matchesMusic && matchesKeynote && matchesPdf && matchesSung && matchesFormat && matchesKeyChange && matchesArtist && matchesLocalPdf;
      }),
    [filters, songs]
  );

  const handleDelete = async (song) => {
    if (confirm(`¿Eliminar "${song.title}" del repertorio?`)) await deleteSong(song.id);
  };

  const exportRepertoire = () => {
    const rows = [
      [
        "titulo",
        "artista_fuente",
        "categoria",
        "tema_principal",
        "otros_temas",
        "tono_principal",
        "capo",
        "tono_con_capo_suena_en",
        "cambio_de_tono",
        "pdf_google_drive",
        "ruta_pdf_local",
        "youtube",
        "spotify",
        "acordes_externos",
        "revision_keynote",
        "pdf_local_indexado",
        "estado_de_indexacion",
        "comentario",
        "ultima_vez_usado",
        "veces_usado_en_programaciones_reales"
      ],
      ...filteredSongs.map((song) => [
        song.title,
        song.artistOrSource,
        song.category,
        song.mainTheme,
        (song.otherThemes || []).join("; "),
        song.mainKey,
        song.capo ?? 0,
        song.keyWithCapo,
        song.hasKeyChange ? "si" : "no",
        song.drivePdfUrl || song.pdfUrl || "",
        song.localPdfPath || "",
        getSongYoutubeUrl(song),
        getSongSpotifyUrl(song),
        getSongExternalChordsUrl(song),
        song.keynoteReviewStatus || "",
        song.pdfIndexStatus === "indexed" ? "si" : "no",
        song.pdfIndexStatus || "",
        song.internalNotes || "",
        song.lastUsedAt || "",
        realUsageBySong.get(song.id) || 0
      ])
    ];
    downloadCsv(`repertorio-roca-eterna-${todayFile()}.csv`, rows);
  };

  const closeModal = () => {
    setEditingSong(null);
    setIsAdding(false);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Repertorio de cantos</h2>
            <p className="mt-1 text-sm text-ink/55">Gestor de canciones, PDFs, revisión y programación.</p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportRepertoire}>
                <Download className="h-4 w-4" />
                Exportar repertorio
              </Button>
              <Button onClick={() => setIsAdding(true)} data-tour="song-add">
                <Plus className="h-4 w-4" />
                Agregar canto
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.6fr_0.8fr_0.8fr_0.7fr]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-ink/35" />
            <Input className="pl-9" placeholder="Buscar por nombre, fuente, tema, tono o comentario" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} />
          </div>
          <Select value={filters.category} onChange={(event) => setFilter("category", event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </Select>
          <Select value={filters.mainTheme} onChange={(event) => setFilter("mainTheme", event.target.value)}>
            <option value="">Tema principal</option>
            {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
          </Select>
          <Select value={filters.key} onChange={(event) => setFilter("key", event.target.value)}>
            <option value="">Todos los tonos</option>
            {keyOptions.map((key) => <option key={key}>{key}</option>)}
          </Select>
        </div>

        <details className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-ink">Filtros avanzados</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select value={filters.otherTheme} onChange={(event) => setFilter("otherTheme", event.target.value)}>
              <option value="">Otros temas</option>
              {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
            </Select>
            <Select value={filters.capo} onChange={(event) => setFilter("capo", event.target.value)}>
              <option value="">Todos los capos</option>
              {capoOptions.map((capo) => <option key={capo} value={capo}>Capo {capo}</option>)}
            </Select>
            <Select value={filters.music} onChange={(event) => setFilter("music", event.target.value)}>
              <option value="">Revisión musical</option>
              {REVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
            <Select value={filters.keynote} onChange={(event) => setFilter("keynote", event.target.value)}>
              <option value="">Revisión Keynote</option>
              {REVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
            <Select value={filters.pdf} onChange={(event) => setFilter("pdf", event.target.value)}>
              <option value="">Revisión PDF</option>
              {REVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </Select>
            <Select value={filters.sung} onChange={(event) => setFilter("sung", event.target.value)}>
              <option value="">Ya se ha cantado</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </Select>
            <Select value={filters.format} onChange={(event) => setFilter("format", event.target.value)}>
              <option value="">Todos los formatos</option>
              {formats.map((format) => <option key={format}>{format}</option>)}
            </Select>
            <Select value={filters.keyChange} onChange={(event) => setFilter("keyChange", event.target.value)}>
              <option value="">Cambio de tono</option>
              <option value="si">Con cambio</option>
              <option value="no">Sin cambio</option>
            </Select>
            <Select value={filters.localPdf} onChange={(event) => setFilter("localPdf", event.target.value)}>
              <option value="">Ruta PDF local</option>
              <option value="with">Con ruta PDF local</option>
              <option value="without">Sin ruta PDF local</option>
              <option value="invalid">Ruta PDF local invalida</option>
            </Select>
            <Input value={filters.artist} onChange={(event) => setFilter("artist", event.target.value)} placeholder="Artista o fuente" />
          </div>
        </details>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink/55">Mostrando {filteredSongs.length} de {songs.length} cantos</p>
          <div className="flex gap-2">
            <Button variant={viewMode === "cards" ? "primary" : "secondary"} onClick={() => { setViewMode("cards"); localStorage.setItem("roca-eterna-song-view-mode", "cards"); }}>Tarjetas</Button>
            <Button variant={viewMode === "list" ? "primary" : "secondary"} onClick={() => { setViewMode("list"); localStorage.setItem("roca-eterna-song-view-mode", "list"); }}>Lista</Button>
            <Button variant="secondary" onClick={clearFilters}>Limpiar filtros</Button>
          </div>
        </div>
      </Card>

      {filteredSongs.length && viewMode === "list" ? (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-ink/5 text-xs uppercase tracking-wide text-ink/45">
                <tr>
                  <th className="px-4 py-3">Titulo</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Tema</th>
                  <th className="px-4 py-3">Tono</th>
                  <th className="px-4 py-3">Capo</th>
                  <th className="px-4 py-3">Enlaces</th>
                  <th className="px-4 py-3">Revision</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSongs.map((song) => {
                  const pdfUrl = getSongPdfUrl(song);
                  const youtubeUrl = getSongYoutubeUrl(song);
                  const spotifyUrl = getSongSpotifyUrl(song);
                  const matchLabels = getSearchMatches(song, filters.query);
                  return (
                    <tr key={song.id} className="border-b border-ink/10 last:border-b-0 hover:bg-ink/5">
                      <td className="px-4 py-3">
                        <Link to={`/repertorio/${song.id}`} className="font-bold text-ink hover:text-brass">{song.title}</Link>
                        <p className="text-xs text-ink/50">{song.artistOrSource || "Sin fuente"}</p>
                        {matchLabels.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {matchLabels.slice(0, 3).map((label) => (
                              <span key={label} className="rounded-full bg-brass/10 px-2 py-0.5 text-[10px] font-bold text-brass">{label}</span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink/60">{song.category || "--"}</td>
                      <td className="px-4 py-3 text-ink/60">{song.mainTheme || "--"}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{song.mainKey || "--"} / {song.keyWithCapo || "--"}</td>
                      <td className="px-4 py-3 text-ink/60">{Number(song.capo || 0) ? `Capo ${song.capo}` : "Sin capo"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {pdfUrl ? <a className="rounded-lg bg-brass/12 px-2 py-1 text-xs font-bold text-brass" href={pdfUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>PDF</a> : null}
                          {youtubeUrl ? <a className="rounded-lg bg-ink/5 px-2 py-1 text-xs font-bold text-ink" href={youtubeUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>YouTube</a> : null}
                          {spotifyUrl ? <a className="rounded-lg bg-ink/5 px-2 py-1 text-xs font-bold text-ink" href={spotifyUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Spotify</a> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink/60">PDF {song.pdfReviewStatus || "pendiente"} · Musica {song.musicReviewStatus || "pendiente"} · Keynote {song.keynoteReviewStatus || "pendiente"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="subtle" onClick={() => navigate(`/repertorio/${song.id}`)}>Ver</Button>
                          {canEdit ? <Button variant="secondary" onClick={() => setEditingSong(song)}>Editar</Button> : null}
                          {canDelete ? <Button variant="danger" onClick={() => handleDelete(song)}>Eliminar</Button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : filteredSongs.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSongs.map((song, index) => {
            const pdfUrl = getSongPdfUrl(song);
            const youtubeUrl = getSongYoutubeUrl(song);
            const spotifyUrl = getSongSpotifyUrl(song);
            const matchLabels = getSearchMatches(song, filters.query);
            return (
              <Card key={song.id} delay={index * 0.02} className="flex cursor-pointer flex-col transition hover:border-brass/35" onClick={() => navigate(`/repertorio/${song.id}`)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link to={`/repertorio/${song.id}`} className="text-lg font-bold text-ink hover:text-brass" onClick={(event) => event.stopPropagation()}>
                      {song.title}
                    </Link>
                    <p className="mt-1 text-sm text-ink/55">{song.artistOrSource || "Sin fuente"}</p>
                  </div>
                  <span className="rounded-xl bg-ink px-3 py-1 text-sm font-bold text-white">{song.mainKey || "--"}</span>
                </div>
                {matchLabels.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {matchLabels.slice(0, 4).map((label) => (
                      <span key={label} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${label.includes("PDF") ? "bg-brass/15 text-brass" : "bg-ink/7 text-ink/55"}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {song.category ? <span className="rounded-full bg-ink/7 px-3 py-1 text-xs font-semibold text-ink/60">{song.category}</span> : null}
                  {song.mainTheme ? <span className="rounded-full bg-brass/10 px-3 py-1 text-xs font-semibold text-brass">{song.mainTheme}</span> : null}
                  {song.hasKeyChange ? <span className="rounded-full bg-blue-gray/10 px-3 py-1 text-xs font-semibold text-blue-gray">Cambio de tono</span> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReviewBadge label="PDF" value={song.pdfReviewStatus} />
                  <ReviewBadge label="Keynote" value={song.keynoteReviewStatus} />
                  <ReviewBadge label="Música" value={song.musicReviewStatus} />
                </div>
                <p className="mt-4 rounded-2xl bg-ink/5 p-3 text-sm font-semibold text-ink">{toneSummary(song)}</p>
                <p className="mt-4 line-clamp-2 text-sm leading-6 text-ink/58">{song.internalNotes || "Sin comentarios."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {pdfUrl ? <a onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-xl bg-brass/12 px-3 py-2 text-xs font-bold text-brass" href={pdfUrl} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />PDF</a> : null}
                  {youtubeUrl ? <a onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-xl bg-ink/5 px-3 py-2 text-xs font-bold text-ink" href={youtubeUrl} target="_blank" rel="noreferrer"><Youtube className="h-4 w-4" />YouTube</a> : null}
                  {spotifyUrl ? <a onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-xl bg-ink/5 px-3 py-2 text-xs font-bold text-ink" href={spotifyUrl} target="_blank" rel="noreferrer"><Headphones className="h-4 w-4" />Spotify</a> : null}
                </div>
                <div className="mt-auto flex items-center justify-between pt-5">
                  <Link to={`/repertorio/${song.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-gray" onClick={(event) => event.stopPropagation()}>
                    Ver detalle <ExternalLink className="h-4 w-4" />
                  </Link>
                  <div className="flex gap-2">
                    {canEdit ? (
                      <Button variant="subtle" className="h-10 w-10 px-0" onClick={(event) => { event.stopPropagation(); setEditingSong(song); }} aria-label="Editar">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button variant="danger" className="h-10 w-10 px-0" onClick={(event) => { event.stopPropagation(); handleDelete(song); }} aria-label="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No hay cantos con esos filtros" text="Ajusta la búsqueda o agrega un canto al repertorio." />
      )}

      <Modal open={isAdding || Boolean(editingSong)} title={editingSong ? "Editar canto" : "Agregar canto"} onClose={closeModal} wide>
        <SongForm
          initialSong={editingSong || blankSong}
          themes={themeOptions}
          keyPreference={settings.keyPreference || "sharps"}
          onCancel={closeModal}
          onSubmit={async (song) => {
            await saveSong(song);
            closeModal();
          }}
        />
      </Modal>
    </div>
  );
}
