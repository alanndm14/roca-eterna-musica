import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Edit3, ExternalLink, FileText, Plus, Search, Trash2 } from "lucide-react";
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
  normalizeDrivePdfUrl,
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
  storagePdfUrl: "",
  youtubeUrl: "",
  chordsUrl: "",
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

function SongForm({ initialSong, themes, keyPreference, onSubmit, onCancel }) {
  const [song, setSong] = useState(() => normalizeSong(initialSong || blankSong, keyPreference));
  const [manualKey, setManualKey] = useState(Boolean(initialSong?.keyWithCapo && initialSong?.keyWithCapo !== calculateKeyWithCapo(initialSong?.mainKey, initialSong?.capo, keyPreference)));
  const themeOptions = themes;

  const update = (field, value) => setSong((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!manualKey) {
      setSong((current) => ({
        ...current,
        keyWithCapo: calculateKeyWithCapo(current.mainKey, current.capo, keyPreference)
      }));
    }
  }, [song.mainKey, song.capo, keyPreference, manualKey]);

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

  const submit = (event) => {
    event.preventDefault();
    if (!song.title.trim()) return;
    const drivePreview = normalizeDrivePdfUrl(song.drivePdfUrl || song.pdfUrl || song.chordsUrl);
    const next = normalizeSong(
      {
        ...song,
        title: song.title.trim(),
        pdfPreviewUrl: song.pdfPreviewUrl || drivePreview,
        chordsUrl: song.chordsUrl || song.pdfUrl,
        tags: [...new Set([song.mainTheme, ...(song.otherThemes || [])].filter(Boolean))]
      },
      keyPreference
    );
    onSubmit(next);
  };

  return (
    <form onSubmit={submit} className="flex max-h-[74vh] flex-col overflow-hidden">
      <div className="space-y-4 overflow-y-auto pr-1">
        <Section title="Información básica">
          <div className="grid gap-4 md:grid-cols-2">
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
            <Field label="Formato">
              <Select value={song.format || "pdf"} onChange={(event) => update("format", event.target.value)}>
                {SONG_FORMATS.map((format) => <option key={format}>{format}</option>)}
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

        <Section title="Temas y categoría">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tema principal">
              <Select value={song.mainTheme || ""} onChange={(event) => update("mainTheme", event.target.value)}>
                <option value="">Sin tema</option>
                {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
              </Select>
            </Field>
            <Field label="Otros temas">
              <Select value="" onChange={(event) => addOtherTheme(event.target.value)}>
                <option value="">Agregar tema</option>
                {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
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
              <Input value={song.pdfUrl || ""} onChange={(event) => update("pdfUrl", event.target.value)} placeholder="https://drive.google.com/file/d/..." />
            </Field>
            <Field label="Google Drive original">
              <Input value={song.drivePdfUrl || ""} onChange={(event) => update("drivePdfUrl", event.target.value)} placeholder="Link compartido de Drive" />
            </Field>
            <Field label="Vista previa embebible">
              <Input value={song.pdfPreviewUrl || normalizeDrivePdfUrl(song.drivePdfUrl || song.pdfUrl)} onChange={(event) => update("pdfPreviewUrl", event.target.value)} />
            </Field>
            <Field label="PDF de letra y acordes">
              <Input value={song.chordsUrl || ""} onChange={(event) => update("chordsUrl", event.target.value)} />
            </Field>
            <Field label="YouTube">
              <Input value={song.youtubeUrl || ""} onChange={(event) => update("youtubeUrl", event.target.value)} />
            </Field>
            <Field label="Firebase Storage PDF URL (futuro)">
              <Input value={song.storagePdfUrl || ""} onChange={(event) => update("storagePdfUrl", event.target.value)} placeholder="Opcional" />
            </Field>
          </div>
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink/55">Campo secundario. La prioridad es el PDF de letra y acordes.</p>
            <Button variant="subtle" onClick={() => update("lyricsSections", [...(song.lyricsSections || []), { type: "verso", text: "" }])}>
              <Plus className="h-4 w-4" />
              Sección
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {(song.lyricsSections || []).map((section, index) => (
              <div key={index} className="grid gap-3 rounded-2xl border border-ink/10 bg-stonewash p-3 md:grid-cols-[180px_1fr]">
                <Select value={section.type} onChange={(event) => updateSection(index, "type", event.target.value)}>
                  {["verso", "coro", "puente", "final", "instrumental"].map((type) => <option key={type}>{type}</option>)}
                </Select>
                <Textarea value={section.text} onChange={(event) => updateSection(index, "text", event.target.value)} placeholder="Opcional" />
              </div>
            ))}
          </div>
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
  const { songs, themes, settings, deleteSong, saveSong } = useMusicData();
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
    format: ""
  });
  const [editingSong, setEditingSong] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const themeOptions = useMemo(() => collectSongThemes(songs, themes), [songs, themes]);
  const keyOptions = useMemo(() => collectSongKeys(songs), [songs]);
  const capoOptions = useMemo(() => [...new Set(songs.map((song) => song.capo).filter((capo) => capo !== undefined && capo !== ""))].sort((a, b) => Number(a) - Number(b)), [songs]);
  const categories = useMemo(() => [...new Set([...SONG_CATEGORIES, ...songs.map((song) => song.category).filter(Boolean)])], [songs]);
  const formats = useMemo(() => [...new Set([...SONG_FORMATS, ...songs.map((song) => song.format).filter(Boolean)])], [songs]);

  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

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
          song.internalNotes
        ].join(" ").toLowerCase();
        const matchesQuery = !filters.query || searchText.includes(filters.query.toLowerCase());
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
        return matchesQuery && matchesCategory && matchesMainTheme && matchesOtherTheme && matchesKey && matchesCapo && matchesMusic && matchesKeynote && matchesPdf && matchesSung && matchesFormat;
      }),
    [filters, songs]
  );

  const handleDelete = async (song) => {
    if (confirm(`¿Eliminar "${song.title}" del repertorio?`)) {
      await deleteSong(song.id);
    }
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
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4" />
              Agregar canto
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-ink/35" />
            <Input className="pl-9" placeholder="Buscar por nombre, tema, tono, comentario..." value={filters.query} onChange={(event) => setFilter("query", event.target.value)} />
          </div>
          <Select value={filters.category} onChange={(event) => setFilter("category", event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </Select>
          <Select value={filters.mainTheme} onChange={(event) => setFilter("mainTheme", event.target.value)}>
            <option value="">Tema principal</option>
            {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
          </Select>
          <Select value={filters.otherTheme} onChange={(event) => setFilter("otherTheme", event.target.value)}>
            <option value="">Todos los temas</option>
            {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
          </Select>
          <Select value={filters.key} onChange={(event) => setFilter("key", event.target.value)}>
            <option value="">Todos los tonos</option>
            {keyOptions.map((key) => <option key={key}>{key}</option>)}
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
            <option value="si">Sí se ha cantado</option>
            <option value="no">No se ha cantado</option>
          </Select>
          <Select value={filters.format} onChange={(event) => setFilter("format", event.target.value)}>
            <option value="">Todos los formatos</option>
            {formats.map((format) => <option key={format}>{format}</option>)}
          </Select>
        </div>
      </Card>

      {filteredSongs.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSongs.map((song, index) => (
            <Card key={song.id} delay={index * 0.02} className="flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to={`/repertorio/${song.id}`} className="text-lg font-bold text-ink hover:text-brass">
                    {song.title}
                  </Link>
                  <p className="mt-1 text-sm text-ink/55">{song.artistOrSource || "Sin fuente"}</p>
                </div>
                <span className="rounded-xl bg-ink px-3 py-1 text-sm font-bold text-white">{song.mainKey || "--"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {song.category ? <span className="rounded-full bg-ink/7 px-3 py-1 text-xs font-semibold text-ink/60">{song.category}</span> : null}
                {song.mainTheme ? <span className="rounded-full bg-brass/10 px-3 py-1 text-xs font-semibold text-brass">{song.mainTheme}</span> : null}
                {(song.otherThemes || []).map((theme) => (
                  <span key={theme} className="rounded-full bg-blue-gray/10 px-3 py-1 text-xs font-semibold text-blue-gray">{theme}</span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ReviewBadge label="PDF" value={song.pdfReviewStatus} />
                <ReviewBadge label="Keynote" value={song.keynoteReviewStatus} />
                <ReviewBadge label="Música" value={song.musicReviewStatus} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <span className="rounded-2xl bg-ink/5 p-2">Capo {song.capo || 0}</span>
                <span className="rounded-2xl bg-ink/5 p-2">Tono con capo: {song.keyWithCapo || "--"}</span>
                <span className="rounded-2xl bg-ink/5 p-2">{song.sungBefore ? "Ya se ha cantado" : "No se ha cantado"}</span>
              </div>
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-ink/58">{song.internalNotes || "Sin comentarios."}</p>
              <div className="mt-auto flex items-center justify-between pt-5">
                <Link to={`/repertorio/${song.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-gray">
                  Ver detalle <ExternalLink className="h-4 w-4" />
                </Link>
                <div className="flex gap-2">
                  {(song.pdfUrl || song.drivePdfUrl || song.chordsUrl) ? <FileText className="mt-2 h-4 w-4 text-brass" /> : null}
                  {canEdit ? (
                    <Button variant="subtle" className="h-10 w-10 px-0" onClick={() => setEditingSong(song)} aria-label="Editar">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button variant="danger" className="h-10 w-10 px-0" onClick={() => handleDelete(song)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
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
