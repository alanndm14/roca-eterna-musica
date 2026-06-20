import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ClipboardCheck, MessageSquareText, Save } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field, Select, Textarea } from "../ui/Field";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import { getOutstandingSongFollowUps, isNoteworthySongFollowUp } from "../../services/songScoring";

const songDefault = {
  experience: "",
  result: "bien",
  difficulty: "normal",
  congregationResponse: "normal",
  keyComfort: "comoda",
  resourceIssues: "",
  notes: "",
  comments: [],
  commentDraft: "",
  resolved: false
};

const shortName = (profile = {}) => String(
  profile.preferredDisplayName || profile.displayName || profile.email || "Usuario"
).trim().split(/\s+/)[0] || "Usuario";

function normalizeComments(existingSong = {}, existing = {}) {
  if (Array.isArray(existingSong.comments) && existingSong.comments.length) return existingSong.comments;
  const legacyText = String(existingSong.notes || existingSong.resourceIssues || "").trim();
  if (!legacyText) return [];
  return [{
    id: `legacy-${existingSong.songId || existingSong.title || "song"}`,
    text: legacyText,
    authorName: existingSong.updatedByName || existing.updatedByName || "Registro anterior",
    createdAt: existingSong.updatedAt || existing.updatedAt || ""
  }];
}

function buildInitialFollowUp(schedule = {}) {
  const existing = schedule.serviceFollowUp || {};
  const songs = {};
  (schedule.songs || []).forEach((entry) => {
    const key = entry.songId || entry.titleSnapshot;
    const existingSong = existing.songs?.[key] || {};
    songs[key] = {
      ...songDefault,
      ...existingSong,
      comments: normalizeComments(existingSong, existing),
      commentDraft: "",
      songId: entry.songId || "",
      title: entry.titleSnapshot || "Canto"
    };
  });
  return {
    overall: existing.overall || "",
    wentWell: existing.wentWell || "",
    needsImprovement: existing.needsImprovement || "",
    generalObservations: existing.generalObservations || "",
    nextServiceNotes: existing.nextServiceNotes || "",
    updatedByName: existing.updatedByName || "",
    songs
  };
}

export function ServiceFollowUpPanel({ schedule, canEdit = false, onSave, onCloseService, compact = false }) {
  const { profile } = useAuth();
  const { schedules = [] } = useMusicData();
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

  const buildPayload = () => {
    const authorName = shortName(profile);
    const now = new Date().toISOString();
    const songs = Object.fromEntries(Object.entries(draft.songs || {}).map(([key, song]) => {
      const comment = String(song.commentDraft || "").trim();
      const comments = comment
        ? [...(song.comments || []), {
            id: `${profile?.uid || "user"}-${Date.now()}-${key}`,
            text: comment,
            authorName,
            authorUid: profile?.uid || "",
            createdAt: now
          }]
        : (song.comments || []);
      return [key, {
        ...song,
        comments,
        notes: comments.at(-1)?.text || song.notes || "",
        commentDraft: "",
        updatedAt: now,
        updatedByName: authorName,
        updatedByUid: profile?.uid || ""
      }];
    }));
    return {
      ...draft,
      songs,
      updatedAt: now,
      updatedByName: authorName,
      updatedByUid: profile?.uid || ""
    };
  };

  const save = async ({ close = false } = {}) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (close) await onCloseService?.(schedule.id, payload);
      else await onSave?.(schedule.id, payload);
      setDraft(payload);
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
          <p className="mt-1 text-sm text-ink/55">Registra únicamente lo que conviene recordar para el siguiente ensayo.</p>
          {draft.updatedByName ? <p className="mt-1 text-xs font-semibold text-ink/40">Última edición: {draft.updatedByName}</p> : null}
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

      {expanded ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Resumen del servicio">
              <Textarea value={draft.overall} onChange={(event) => update("overall", event.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Para el próximo servicio">
              <Textarea value={draft.nextServiceNotes} onChange={(event) => update("nextServiceNotes", event.target.value)} disabled={!canEdit} />
            </Field>
          </div>

          <div className="mt-5 grid gap-3">
            <p className="text-sm font-black uppercase tracking-wide text-ink/45">Notas por canto</p>
            {visibleEntries.map((entry, index) => {
              const key = entry.songId || entry.titleSnapshot || String(index);
              const songDraft = draft.songs[key] || songDefault;
              const inherited = getOutstandingSongFollowUps(entry.songId, schedules, schedule)[0] || null;
              const mayResolve = Boolean(inherited || compact || alreadyClosed);
              return (
                <article key={key} className="rounded-2xl border border-ink/10 bg-ink/5 p-3 dark:border-white/10 dark:bg-white/6">
                  <p className="font-bold text-ink">{index + 1}. {entry.titleSnapshot || "Canto"}</p>
                  {inherited ? (
                    <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400/35 dark:bg-amber-500/12 dark:text-amber-100">
                      <p className="font-bold">Pendiente del servicio anterior</p>
                      <p className="mt-1">{inherited.followUp?.notes || inherited.followUp?.comments?.at(-1)?.text || "Revisar la observación anterior."}</p>
                    </div>
                  ) : null}
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
                  {(songDraft.comments || []).length ? (
                    <div className="mt-3 space-y-2">
                      {songDraft.comments.map((comment) => (
                        <div key={comment.id || `${comment.authorName}-${comment.createdAt}`} className="rounded-xl bg-white/75 p-3 text-sm dark:bg-black/20">
                          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-brass">
                            <MessageSquareText className="h-3.5 w-3.5" />
                            {comment.authorName || "Registro anterior"}
                          </p>
                          <p className="mt-1 leading-6 text-ink/70">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {canEdit ? (
                    <Field label="Agregar comentario" className="mt-3">
                      <Textarea value={songDraft.commentDraft || ""} onChange={(event) => updateSong(key, "commentDraft", event.target.value)} />
                    </Field>
                  ) : null}
                  {mayResolve && (inherited || isNoteworthySongFollowUp(songDraft)) ? (
                    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
                      <input type="checkbox" checked={songDraft.resolved === true} onChange={(event) => updateSong(key, "resolved", event.target.checked)} disabled={!canEdit} />
                      {inherited ? "Se corrigió en este servicio" : "Marcar este pendiente como corregido"}
                    </label>
                  ) : null}
                </article>
              );
            })}
            {!visibleEntries.length ? <p className="smart-success-empty rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">No hubo cantos con observaciones pendientes.</p> : null}
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
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
