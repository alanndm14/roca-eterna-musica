import { useEffect, useState } from "react";
import { Edit3, Headphones, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { canManageVocalPractice } from "../../services/memberPresentation";
import { deletePracticeGuide, loadPracticeGuides, savePracticeGuide } from "../../services/practiceGuides";

const blankGuide = {
  title: "Audio de ensayo",
  sectionType: "full",
  customSectionName: "",
  voicePart: "all",
  key: "",
  bpm: 0,
  timeSignature: "4/4",
  entryNote: "",
  notes: "",
  order: 0,
  enabled: true
};

function GuideForm({ initialValue, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => ({ ...blankGuide, ...initialValue }));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  return (
    <form className="max-h-[72dvh] space-y-4 overflow-y-auto pr-1" onSubmit={async (event) => {
      event.preventDefault();
      if (!draft.title.trim() || (!draft.id && !file)) {
        setError("Escribe un nombre y selecciona un audio.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        await onSubmit({ ...draft, sectionType: "full", voicePart: "all", order: 0 }, file);
      } catch (submitError) {
        setError(submitError.message || "No se pudo guardar el audio.");
      } finally {
        setBusy(false);
      }
    }}>
      <Field label={draft.id ? "Reemplazar audio, opcional" : "Archivo de audio"}>
        <Input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <span className="mt-1 block text-xs text-ink/45">MP3, M4A, WAV u OGG · máximo 25 MB</span>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <Input value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="Audio de ensayo" />
        </Field>
        <Field label="Estado">
          <Select value={draft.enabled ? "active" : "inactive"} onChange={(event) => update("enabled", event.target.value === "active")}>
            <option value="active">Activo</option>
            <option value="inactive">Oculto</option>
          </Select>
        </Field>
      </div>
      <Field label="Indicaciones">
        <Textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
      </Field>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" isLoading={busy}><UploadCloud className="h-4 w-4" />Guardar audio</Button>
      </div>
    </form>
  );
}

export function PracticeGuideManager({ song }) {
  const { profile } = useAuth();
  const { useLocal } = useMusicData();
  const [guides, setGuides] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const allowed = canManageVocalPractice(profile);

  const refresh = async () => {
    if (!song?.id || !allowed) return;
    setLoading(true);
    try {
      setGuides(await loadPracticeGuides(song.id, useLocal));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [song?.id, allowed, useLocal]);

  if (!allowed || !song?.id) return null;
  const guide = guides[0] || null;

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-brass" />
            <h3 className="font-bold text-ink">Audio de ensayo</h3>
          </div>
          <p className="mt-1 text-sm text-ink/55">Una pista publicada en GitHub para escucharla o descargarla.</p>
        </div>
        {!guide ? <Button onClick={() => setEditing(blankGuide)}><Plus className="h-4 w-4" />Agregar audio</Button> : null}
      </div>

      {loading ? <p className="mt-4 text-sm text-ink/55">Cargando audio...</p> : guide ? (
        <div className="mt-4 flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-ink/5 p-3 dark:bg-white/5">
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{guide.title}</p>
            <p className="truncate text-xs text-ink/50">{guide.fileName || "Archivo de audio"}{guide.enabled ? "" : " · Oculto"}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="subtle" className="h-10 w-10 px-0" onClick={() => setEditing(guide)} aria-label={`Editar ${guide.title}`}><Edit3 className="h-4 w-4" /></Button>
            <Button variant="danger" className="h-10 w-10 px-0" onClick={async () => {
              if (!confirm(`¿Eliminar definitivamente el audio "${guide.title}"?`)) return;
              try {
                await deletePracticeGuide({ songId: song.id, guide, useLocal });
                await refresh();
              } catch (deleteError) {
                alert(deleteError.message || "No se pudo eliminar el audio.");
              }
            }} aria-label={`Eliminar ${guide.title}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : <p className="mt-4 rounded-2xl bg-ink/5 p-4 text-sm text-ink/55 dark:bg-white/5">Aún no hay audio de ensayo para este canto.</p>}

      <Modal open={Boolean(editing)} title={editing?.id ? "Editar audio de ensayo" : "Agregar audio de ensayo"} onClose={() => setEditing(null)}>
        {editing ? <GuideForm initialValue={editing} onCancel={() => setEditing(null)} onSubmit={async (nextGuide, file) => {
          await savePracticeGuide({ songId: song.id, guide: nextGuide, file, profile, useLocal });
          setEditing(null);
          await refresh();
        }} /> : null}
      </Modal>
    </section>
  );
}
