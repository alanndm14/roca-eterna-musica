import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Edit3, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { meetingTypes, songKeys, songTags } from "../data/mockData";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";

const blankSong = {
  title: "",
  artist: "",
  mainKey: "G",
  tempo: "",
  timeSignature: "4/4",
  youtubeUrl: "",
  chordsUrl: "",
  lyricsSections: [{ type: "verso", text: "" }],
  tags: [],
  internalNotes: ""
};

function SongForm({ initialSong, onSubmit, onCancel }) {
  const [song, setSong] = useState(initialSong || blankSong);
  const update = (field, value) => setSong((current) => ({ ...current, [field]: value }));
  const updateSection = (index, field, value) => {
    setSong((current) => ({
      ...current,
      lyricsSections: current.lyricsSections.map((section, currentIndex) =>
        currentIndex === index ? { ...section, [field]: value } : section
      )
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!song.title.trim()) return;
    onSubmit({ ...song, title: song.title.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título">
          <Input value={song.title} onChange={(event) => update("title", event.target.value)} required />
        </Field>
        <Field label="Artista o fuente">
          <Input value={song.artist} onChange={(event) => update("artist", event.target.value)} />
        </Field>
        <Field label="Tono principal">
          <Select value={song.mainKey} onChange={(event) => update("mainKey", event.target.value)}>
            {songKeys.map((key) => <option key={key}>{key}</option>)}
          </Select>
        </Field>
        <Field label="Tempo">
          <Input value={song.tempo} onChange={(event) => update("tempo", event.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Compás">
          <Input value={song.timeSignature} onChange={(event) => update("timeSignature", event.target.value)} placeholder="4/4" />
        </Field>
        <Field label="YouTube">
          <Input value={song.youtubeUrl} onChange={(event) => update("youtubeUrl", event.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Acordes">
          <Input value={song.chordsUrl} onChange={(event) => update("chordsUrl", event.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Temas">
          <Select
            value=""
            onChange={(event) => {
              if (event.target.value && !song.tags.includes(event.target.value)) {
                update("tags", [...song.tags, event.target.value]);
              }
            }}
          >
            <option value="">Agregar tema</option>
            {songTags.map((tag) => <option key={tag}>{tag}</option>)}
          </Select>
        </Field>
      </div>

      {song.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {song.tags.map((tag) => (
            <button
              type="button"
              key={tag}
              className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white"
              onClick={() => update("tags", song.tags.filter((item) => item !== tag))}
            >
              {tag} ×
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-ink">Letra estructurada</p>
          <Button
            variant="subtle"
            onClick={() => update("lyricsSections", [...song.lyricsSections, { type: "coro", text: "" }])}
          >
            <Plus className="h-4 w-4" />
            Sección
          </Button>
        </div>
        {song.lyricsSections.map((section, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-ink/10 bg-white p-3 md:grid-cols-[180px_1fr]">
            <Select value={section.type} onChange={(event) => updateSection(index, "type", event.target.value)}>
              {["verso", "coro", "puente", "final", "instrumental"].map((type) => <option key={type}>{type}</option>)}
            </Select>
            <Textarea
              value={section.text}
              onChange={(event) => updateSection(index, "text", event.target.value)}
              placeholder="Placeholder de letra. Agrega texto manualmente."
            />
          </div>
        ))}
      </div>

      <Field label="Notas internas">
        <Textarea value={song.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} />
      </Field>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar canto</Button>
      </div>
    </form>
  );
}

export function Songs() {
  const { canEdit, canDelete } = useAuth();
  const { songs, deleteSong, saveSong } = useMusicData();
  const [query, setQuery] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [editingSong, setEditingSong] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const filteredSongs = useMemo(
    () =>
      songs.filter((song) => {
        const matchesQuery = song.title.toLowerCase().includes(query.toLowerCase());
        const matchesKey = !keyFilter || song.mainKey === keyFilter;
        const matchesTag = !tagFilter || song.tags?.includes(tagFilter);
        return matchesQuery && matchesKey && matchesTag;
      }),
    [keyFilter, query, songs, tagFilter]
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
            <p className="mt-1 text-sm text-ink/55">Busca, filtra y administra los cantos del ministerio.</p>
          </div>
          {canEdit ? (
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4" />
              Agregar canto
            </Button>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-ink/35" />
            <Input className="pl-9" placeholder="Buscar por título" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Select value={keyFilter} onChange={(event) => setKeyFilter(event.target.value)}>
            <option value="">Todos los tonos</option>
            {songKeys.map((key) => <option key={key}>{key}</option>)}
          </Select>
          <Select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="">Todos los temas</option>
            {songTags.map((tag) => <option key={tag}>{tag}</option>)}
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
                  <p className="mt-1 text-sm text-ink/55">{song.artist || "Sin fuente"}</p>
                </div>
                <span className="rounded-xl bg-ink px-3 py-1 text-sm font-bold text-white">{song.mainKey}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(song.tags || []).map((tag) => (
                  <span key={tag} className="rounded-full bg-brass/10 px-3 py-1 text-xs font-semibold text-brass">{tag}</span>
                ))}
              </div>
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-ink/58">{song.internalNotes || "Sin notas internas."}</p>
              <div className="mt-auto flex items-center justify-between pt-5">
                <Link to={`/repertorio/${song.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-gray">
                  Ver detalle <ExternalLink className="h-4 w-4" />
                </Link>
                <div className="flex gap-2">
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
