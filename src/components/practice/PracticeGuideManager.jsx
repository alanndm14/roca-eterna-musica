import { useEffect, useState } from "react";
import { Edit3, Headphones, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { canManageVocalPractice } from "../../services/memberPresentation";
import { deletePracticeGuide, loadPracticeGuides, savePracticeGuide } from "../../services/practiceGuides";
import { PRACTICE_SECTIONS, TIME_SIGNATURES, VOICE_PARTS } from "../../services/vocalPracticeMusic";

const blankGuide = {
  title: "",
  sectionType: "full",
  customSectionName: "",
  voicePart: "all",
  key: "",
  bpm: "",
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
        await onSubmit(draft, file);
      } catch (submitError) {
        setError(submitError.message || "No se pudo guardar la guía.");
      } finally {
        setBusy(false);
      }
    }}>
      <Field label={draft.id ? "Reemplazar audio, opcional" : "Archivo de audio"}>
        <Input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <span className="mt-1 block text-xs text-ink/45">MP3, M4A, WAV u OGG · máximo 3 MB</span>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input value={draft.title} onChange={(event) => update("title", event.target.value)} /></Field>
        <Field label="Sección">
          <Select value={draft.sectionType} onChange={(event) => update("sectionType", event.target.value)}>
            {PRACTICE_SECTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        {draft.sectionType === "other" ? <Field label="Nombre de la sección"><Input value={draft.customSectionName} onChange={(event) => update("customSectionName", event.target.value)} /></Field> : null}
        <Field label="Parte vocal">
          <Select value={draft.voicePart} onChange={(event) => update("voicePart", event.target.value)}>
            {VOICE_PARTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Tonalidad"><Input value={draft.key} onChange={(event) => update("key", event.target.value)} placeholder="A, Bb, F#m…" /></Field>
        <Field label="BPM"><Input type="number" min="30" max="240" value={draft.bpm} onChange={(event) => update("bpm", event.target.value)} /></Field>
        <Field label="Compás">
          <Select value={draft.timeSignature} onChange={(event) => update("timeSignature", event.target.value)}>
            {TIME_SIGNATURES.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </Field>
        <Field label="Nota inicial"><Input value={draft.entryNote} onChange={(event) => update("entryNote", event.target.value)} placeholder="C#4" /></Field>
        <Field label="Orden"><Input type="number" min="0" value={draft.order} onChange={(event) => update("order", Number(event.target.value))} /></Field>
        <Field label="Estado">
          <Select value={draft.enabled ? "active" : "inactive"} onChange={(event) => update("enabled", event.target.value === "active")}>
            <option value="active">Activa</option>
            <option value="inactive">Oculta</option>
          </Select>
        </Field>
      </div>
      <Field label="Indicaciones"><Textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} /></Field>
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" isLoading={busy}><UploadCloud className="h-4 w-4" />Guardar guía</Button>
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

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-brass" /><h3 className="font-bold text-ink">Guías de ensayo</h3></div>
          <p className="mt-1 text-sm text-ink/55">Audios propios publicados en GitHub, organizados por sección y voz.</p>
        </div>
        <Button onClick={() => setEditing({ ...blankGuide, order: guides.length })}><Plus className="h-4 w-4" />Agregar guía</Button>
      </div>
      {loading ? <p className="mt-4 text-sm text-ink/55">Cargando guías…</p> : guides.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {guides.map((guide) => (
            <div key={guide.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-ink/5 p-3 dark:bg-white/5">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{guide.title}</p>
                <p className="truncate text-xs text-ink/50">{guide.voicePart} · {guide.sectionType}{guide.enabled ? "" : " · Oculta"}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="subtle" className="h-10 w-10 px-0" onClick={() => setEditing(guide)} aria-label={`Editar ${guide.title}`}><Edit3 className="h-4 w-4" /></Button>
                <Button variant="danger" className="h-10 w-10 px-0" onClick={async () => {
                  if (!confirm(`¿Eliminar definitivamente la guía "${guide.title}"?`)) return;
                  try {
                    await deletePracticeGuide({ songId: song.id, guide, useLocal });
                    await refresh();
                  } catch (deleteError) {
                    alert(deleteError.message || "No se pudo eliminar la guía.");
                  }
                }} aria-label={`Eliminar ${guide.title}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="mt-4 rounded-2xl bg-ink/5 p-4 text-sm text-ink/55 dark:bg-white/5">Aún no hay guías de ensayo para este canto.</p>}

      <Modal open={Boolean(editing)} title={editing?.id ? "Editar guía" : "Agregar guía"} onClose={() => setEditing(null)}>
        {editing ? <GuideForm initialValue={editing} onCancel={() => setEditing(null)} onSubmit={async (guide, file) => {
          await savePracticeGuide({ songId: song.id, guide, file, profile, useLocal });
          setEditing(null);
          await refresh();
        }} /> : null}
      </Modal>
    </section>
  );
}
