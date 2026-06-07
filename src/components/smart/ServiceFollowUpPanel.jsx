import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ClipboardCheck, Save } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field, Select, Textarea } from "../ui/Field";
import { isNoteworthySongFollowUp } from "../../services/songScoring";

const songDefault = {
  experience: "",
  result: "bien",
  difficulty: "normal",
  congregationResponse: "normal",
  keyComfort: "comoda",
  resourceIssues: "",
  notes: "",
  resolved: false
};

function buildInitialFollowUp(schedule = {}) {
  const existing = schedule.serviceFollowUp || {};
  const songs = {};
  (schedule.songs || []).forEach((entry) => {
    const existingSong = existing.songs?.[entry.songId || entry.titleSnapshot] || {};
    songs[entry.songId || entry.titleSnapshot] = {
      ...songDefault,
      ...existingSong,
      songId: entry.songId || "",
      title: entry.titleSnapshot || "Canto",
      notes: existingSong.notes || existingSong.resourceIssues || ""
    };
  });
  return {
    overall: existing.overall || "",
    wentWell: existing.wentWell || "",
    needsImprovement: existing.needsImprovement || "",
    generalObservations: existing.generalObservations || "",
    nextServiceNotes: existing.nextServiceNotes || "",
    songs
  };
}

export function ServiceFollowUpPanel({ schedule, canEdit = false, onSave, onCloseService, compact = false }) {
  const initial = useMemo(() => buildInitialFollowUp(schedule), [schedule]);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const entries = schedule?.songs || [];
  const alreadyClosed = schedule?.status === "cerrada" || schedule?.status === "realizado";
  const noteworthySongs = Object.values(draft.songs || {}).filter(isNoteworthySongFollowUp);
  const hasGeneralNotes = Boolean(draft.overall || draft.nextServiceNotes);
  const visibleEntries = compact && schedule?.serviceFollowUp
    ? entries.filter((entry) => isNoteworthySongFollowUp(draft.songs?.[entry.songId || entry.titleSnapshot] || {}))
    : entries;

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const updateSong = (key, field, value) => setDraft((current) => ({
    ...current,
    songs: {
      ...current.songs,
      [key]: { ...(current.songs[key] || songDefault), [field]: value }
    }
  }));

  const save = async ({ close = false } = {}) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      if (close) {
        await onCloseService?.(schedule.id, draft);
      } else {
        await onSave?.(schedule.id, draft);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={compact ? "p-4" : ""}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-brass" />
            <h3 className="font-bold text-ink">Seguimiento del servicio</h3>
          </div>
          <p className="mt-1 text-sm text-ink/55">Notas posteriores para aprender de este servicio y preparar mejor los próximos.</p>
        </div>
        {alreadyClosed ? (
          <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-200">Servicio cerrado</span>
        ) : null}
      </div>

      {compact ? (
        <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-ink/5 p-3 text-left text-sm text-ink dark:bg-white/7">
          <span>
            <span className="block font-bold">{hasGeneralNotes || noteworthySongs.length ? "Ver revisión guardada" : "Agregar revisión del servicio"}</span>
            <span className="mt-1 block text-xs text-ink/55">{noteworthySongs.length} canto(s) con observaciones</span>
          </span>
          <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
        </button>
      ) : null}

      {expanded ? <><div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Resumen del servicio">
          <Textarea value={draft.overall} onChange={(event) => update("overall", event.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Mejoras para próximos servicios">
          <Textarea value={draft.nextServiceNotes} onChange={(event) => update("nextServiceNotes", event.target.value)} disabled={!canEdit} />
        </Field>
      </div>

      <div className="mt-5 grid gap-3">
        <p className="text-sm font-black uppercase tracking-wide text-ink/45">Notas por canto</p>
        {visibleEntries.map((entry, index) => {
          const key = entry.songId || entry.titleSnapshot || String(index);
          const songDraft = draft.songs[key] || songDefault;
          return (
            <article key={key} className="rounded-2xl border border-ink/10 bg-ink/5 p-3 dark:border-white/10 dark:bg-white/6">
              <p className="font-bold text-ink">{index + 1}. {entry.titleSnapshot || "Canto"}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Resultado">
                  <Select value={songDraft.result} onChange={(event) => updateSong(key, "result", event.target.value)} disabled={!canEdit}>
                    <option value="bien">Funcionó bien</option>
                    <option value="regular">Regular</option>
                    <option value="no-funciono">No funcionó</option>
                  </Select>
                </Field>
                <Field label="Dificultad">
                  <Select value={songDraft.difficulty} onChange={(event) => updateSong(key, "difficulty", event.target.value)} disabled={!canEdit}>
                    <option value="facil">Fácil</option>
                    <option value="normal">Normal</option>
                    <option value="dificil">Difícil</option>
                  </Select>
                </Field>
                <Field label="Congregación">
                  <Select value={songDraft.congregationResponse} onChange={(event) => updateSong(key, "congregationResponse", event.target.value)} disabled={!canEdit}>
                    <option value="bien">Respondió bien</option>
                    <option value="normal">Normal</option>
                    <option value="poco">Respondió poco</option>
                  </Select>
                </Field>
                <Field label="Tonalidad">
                  <Select value={songDraft.keyComfort} onChange={(event) => updateSong(key, "keyComfort", event.target.value)} disabled={!canEdit}>
                    <option value="comoda">Cómoda</option>
                    <option value="alta">Alta</option>
                    <option value="baja">Baja</option>
                  </Select>
                </Field>
              </div>
              <Field label="Notas del canto" className="mt-3">
                <Textarea value={songDraft.notes} onChange={(event) => updateSong(key, "notes", event.target.value)} disabled={!canEdit} />
              </Field>
              {isNoteworthySongFollowUp(songDraft) ? (
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={songDraft.resolved === true} onChange={(event) => updateSong(key, "resolved", event.target.checked)} disabled={!canEdit} />
                  Este pendiente ya fue corregido
                </label>
              ) : null}
            </article>
          );
        })}
        {!visibleEntries.length ? <p className="rounded-2xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-800 dark:text-emerald-100">No hubo cantos con observaciones pendientes.</p> : null}
      </div>

      {canEdit ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" isLoading={saving} onClick={() => save()}>
            <Save className="h-4 w-4" />
            Guardar seguimiento
          </Button>
          {!alreadyClosed ? (
            <Button isLoading={saving} onClick={() => save({ close: true })}>
              Cerrar servicio y guardar revisión
            </Button>
          ) : null}
        </div>
      ) : null}</> : null}
    </Card>
  );
}
