import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Edit3, Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { meetingTypes } from "../data/mockData";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, todayString } from "../services/dateUtils";

const blankSchedule = {
  date: "",
  time: "10:00",
  type: "domingo",
  leader: "",
  songs: [],
  generalNotes: ""
};

function ScheduleForm({ initialSchedule, songs, onSubmit, onCancel }) {
  const [schedule, setSchedule] = useState(initialSchedule || blankSchedule);
  const update = (field, value) => setSchedule((current) => ({ ...current, [field]: value }));

  const addSong = (songId) => {
    const song = songs.find((item) => item.id === songId);
    if (!song) return;
    update("songs", [
      ...(schedule.songs || []),
      {
        songId: song.id,
        titleSnapshot: song.title,
        keySnapshot: song.mainKey,
        notes: ""
      }
    ]);
  };

  const updateSong = (index, field, value) => {
    update(
      "songs",
      schedule.songs.map((song, currentIndex) => (currentIndex === index ? { ...song, [field]: value } : song))
    );
  };

  const moveSong = (index, direction) => {
    const next = [...schedule.songs];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update("songs", next);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!schedule.date) return;
    onSubmit(schedule);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fecha">
          <Input type="date" value={schedule.date} onChange={(event) => update("date", event.target.value)} required />
        </Field>
        <Field label="Hora">
          <Input type="time" value={schedule.time} onChange={(event) => update("time", event.target.value)} />
        </Field>
        <Field label="Tipo de reunión">
          <Select value={schedule.type} onChange={(event) => update("type", event.target.value)}>
            {meetingTypes.map((type) => <option key={type}>{type}</option>)}
          </Select>
        </Field>
        <Field label="Responsable / director">
          <Input value={schedule.leader} onChange={(event) => update("leader", event.target.value)} />
        </Field>
      </div>

      <Field label="Agregar canto">
        <Select value="" onChange={(event) => addSong(event.target.value)}>
          <option value="">Seleccionar del repertorio</option>
          {songs.map((song) => (
            <option key={song.id} value={song.id}>{song.title} - {song.mainKey}</option>
          ))}
        </Select>
      </Field>

      <div className="space-y-3">
        {(schedule.songs || []).map((song, index) => (
          <div key={`${song.songId}-${index}`} className="grid gap-3 rounded-2xl border border-ink/10 bg-white p-3 md:grid-cols-[48px_1fr_90px_1fr_112px]">
            <div className="flex h-11 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">{index + 1}</div>
            <Input value={song.titleSnapshot} onChange={(event) => updateSong(index, "titleSnapshot", event.target.value)} />
            <Input value={song.keySnapshot} onChange={(event) => updateSong(index, "keySnapshot", event.target.value)} />
            <Input value={song.notes} onChange={(event) => updateSong(index, "notes", event.target.value)} placeholder="Notas del canto" />
            <div className="flex gap-1">
              <Button variant="subtle" className="h-11 w-9 px-0" onClick={() => moveSong(index, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="subtle" className="h-11 w-9 px-0" onClick={() => moveSong(index, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="danger" className="h-11 w-9 px-0" onClick={() => update("songs", schedule.songs.filter((_, currentIndex) => currentIndex !== index))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Field label="Notas generales">
        <Textarea value={schedule.generalNotes} onChange={(event) => update("generalNotes", event.target.value)} />
      </Field>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar programación</Button>
      </div>
    </form>
  );
}

export function Schedules() {
  const { canEdit, canDelete } = useAuth();
  const { songs, schedules, saveSchedule, deleteSchedule, duplicateSchedule } = useMusicData();
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState("upcoming");
  const sortedSchedules = useMemo(
    () =>
      [...schedules]
        .filter((schedule) => (filter === "upcoming" ? schedule.date >= todayString() : schedule.date < todayString()))
        .sort((a, b) => (filter === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))),
    [filter, schedules]
  );

  const closeModal = () => {
    setEditingSchedule(null);
    setIsAdding(false);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Programación</h2>
            <p className="mt-1 text-sm text-ink/55">Crea y organiza cultos, ensayos y reuniones especiales.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={filter === "upcoming" ? "primary" : "secondary"} onClick={() => setFilter("upcoming")}>Próximas</Button>
            <Button variant={filter === "past" ? "primary" : "secondary"} onClick={() => setFilter("past")}>Pasadas</Button>
            {canEdit ? (
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4" />
                Nueva programación
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {sortedSchedules.length ? (
        <div className="grid gap-4">
          {sortedSchedules.map((schedule, index) => (
            <Card key={schedule.id} delay={index * 0.02}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-ink">{formatDate(schedule.date)}</h3>
                    <span className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{schedule.type}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink/55">{schedule.time || "Sin hora"} · {schedule.leader || "Sin responsable"}</p>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">{schedule.generalNotes || "Sin notas generales."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <>
                      <Button variant="subtle" onClick={() => setEditingSchedule(schedule)}><Edit3 className="h-4 w-4" />Editar</Button>
                      <Button variant="secondary" onClick={() => duplicateSchedule(schedule)}><Copy className="h-4 w-4" />Duplicar</Button>
                    </>
                  ) : null}
                  {canDelete ? (
                    <Button variant="danger" onClick={() => confirm("¿Eliminar esta programación?") && deleteSchedule(schedule.id)}>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(schedule.songs || []).map((song, songIndex) => (
                  <div key={`${song.songId}-${songIndex}`} className="rounded-2xl bg-ink/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">{songIndex + 1}. {song.titleSnapshot}</p>
                      <span className="rounded-xl bg-white px-3 py-1 text-sm font-bold">{song.keySnapshot}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink/55">{song.notes || "Sin notas"}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin programaciones" text="Crea una programación para la próxima reunión del ministerio." />
      )}

      <Modal open={isAdding || Boolean(editingSchedule)} title={editingSchedule ? "Editar programación" : "Nueva programación"} onClose={closeModal} wide>
        <ScheduleForm
          initialSchedule={editingSchedule || blankSchedule}
          songs={songs}
          onCancel={closeModal}
          onSubmit={async (schedule) => {
            await saveSchedule(schedule);
            closeModal();
          }}
        />
      </Modal>
    </div>
  );
}
