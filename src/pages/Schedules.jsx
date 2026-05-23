import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ArrowDown, ArrowUp, CalendarDays, Copy, Download, Edit3, Eye, FileText, Plus, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { SongNameLink } from "../components/ui/SongNameLink";
import { ScoreBadge } from "../components/smart/ScoreBadge";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, todayString } from "../services/dateUtils";
import { normalizeSearchText } from "../services/songUtils";
import { downloadBlob } from "../services/mergeServicePdfs";
import { reviewServiceSchedule } from "../services/smartRecommendations";
import {
  SPECIAL_PROGRAM_TYPES,
  SpecialProgramDocument,
  SpecialProgramFourUpDocument,
  emptySpecialProgramItem,
  getSpecialProgramFileName,
  isSpecialService,
  normalizeSpecialProgramItems
} from "../services/specialProgramPdf";

const serviceOptions = [
  { value: "miercoles-oracion", label: "Miércoles de oración", time: "19:00", weekday: 3 },
  { value: "domingo-manana", label: "Domingo mañana", time: "11:00", weekday: 0 },
  { value: "domingo-tarde", label: "Domingo tarde", time: "17:00", weekday: 0 },
  { value: "especial", label: "Especial / aniversario / conferencia / otro", time: "", weekday: null }
];

const worshipLeaders = ["Ps. José Campos", "Ps. Eduardo", "Adrián", "Esaú", "Otro"];

const blankSchedule = {
  date: "",
  serviceType: "domingo-manana",
  serviceLabel: "Domingo mañana",
  time: "11:00",
  leader: "",
  songs: [],
  generalNotes: "",
  isSpecialService: false,
  specialProgram: [],
  status: "confirmed"
};

const getService = (value) => serviceOptions.find((item) => item.value === value) || serviceOptions[0];
const dateWeekday = (date) => (date ? new Date(`${date}T00:00:00`).getDay() : null);

function ScheduleForm({ initialSchedule, songs, onSubmit, onCancel }) {
  const initialService = initialSchedule?.serviceType ? getService(initialSchedule.serviceType) : getService("domingo-manana");
  const [schedule, setSchedule] = useState({
    ...blankSchedule,
    ...initialSchedule,
    serviceType: initialSchedule?.serviceType || initialService.value,
    serviceLabel: initialSchedule?.serviceLabel || initialService.label,
    time: initialSchedule?.time || initialService.time,
    isSpecialService: initialSchedule?.isSpecialService ?? isSpecialService(initialSchedule || { serviceType: initialService.value })
  });
  const initialLeaderChoice = worshipLeaders.includes(initialSchedule?.leader) ? initialSchedule.leader : initialSchedule?.leader ? "Otro" : "";
  const [leaderChoice, setLeaderChoice] = useState(initialLeaderChoice);
  const [manualLeader, setManualLeader] = useState(initialLeaderChoice === "Otro" ? initialSchedule?.leader || "" : "");
  const [songSearch, setSongSearch] = useState("");
  const service = getService(schedule.serviceType);
  const wrongDay = schedule.date && service.weekday !== null && dateWeekday(schedule.date) !== service.weekday;
  const selectedSongIds = new Set((schedule.songs || []).map((song) => song.songId).filter(Boolean));
  const songResults = useMemo(() => {
    const term = normalizeSearchText(songSearch);
    if (!term) return songs.slice(0, 10);
    return songs.filter((song) => {
      const songText = [
        song.title,
        song.artistOrSource,
        song.category,
        song.mainTheme,
        ...(song.otherThemes || []),
        song.mainKey,
        song.keyWithCapo,
        song.internalNotes
      ].join(" ");
      return normalizeSearchText(songText).includes(term);
    }).slice(0, 12);
  }, [songSearch, songs]);

  const update = (field, value) => setSchedule((current) => ({ ...current, [field]: value }));

  const updateLeader = (value) => {
    setLeaderChoice(value);
    if (value === "Otro") {
      setSchedule((current) => ({ ...current, leader: manualLeader }));
      return;
    }
    setManualLeader("");
    setSchedule((current) => ({ ...current, leader: value }));
  };

  const updateService = (serviceType) => {
    const nextService = getService(serviceType);
    setSchedule((current) => ({
      ...current,
      serviceType,
      isSpecialService: serviceType === "especial" ? true : current.isSpecialService,
      serviceLabel: nextService.value === "especial" ? current.serviceLabel || "Servicio especial" : nextService.label,
      time: nextService.time || current.time || "",
      type: nextService.value === "especial" ? current.serviceLabel || "Servicio especial" : nextService.label
    }));
  };

  const addSong = (songId) => {
    const song = songs.find((item) => item.id === songId);
    if (!song) return;
    if ((schedule.songs || []).some((item) => item.songId === song.id)) return;
    update("songs", [
      ...(schedule.songs || []),
      {
        songId: song.id,
        titleSnapshot: song.title,
        keySnapshot: song.keyWithCapo || song.mainKey,
        pdfUrl: song.pdfPreviewUrl || song.pdfUrl || song.drivePdfUrl || song.chordsUrl || "",
        notes: ""
      }
    ]);
    setSongSearch("");
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
    const nextService = getService(schedule.serviceType);
    const label = schedule.serviceType === "especial" ? schedule.serviceLabel || "Servicio especial" : nextService.label;
    onSubmit({
      ...schedule,
      serviceLabel: label,
      type: label,
      time: schedule.serviceType === "especial" ? schedule.time : nextService.time
    });
  };

  return (
    <form onSubmit={submit} className="flex max-h-[74vh] flex-col overflow-hidden">
      <div className="space-y-4 overflow-y-auto pr-1">
        <section className="rounded-2xl border border-ink/10 bg-white p-4">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink/55">Servicio</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Fecha">
              <Input type="date" value={schedule.date} onChange={(event) => update("date", event.target.value)} required />
            </Field>
            <Field label="Servicio">
              <Select value={schedule.serviceType} onChange={(event) => updateService(event.target.value)}>
                {serviceOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </Select>
            </Field>
            {schedule.serviceType === "especial" ? (
              <Field label="Nombre del evento">
                <Input value={schedule.serviceLabel || ""} onChange={(event) => update("serviceLabel", event.target.value)} placeholder="Aniversario, conferencia, otro" />
              </Field>
            ) : null}
            <Field label="¿Es servicio especial?">
              <Select value={schedule.isSpecialService ? "si" : "no"} onChange={(event) => update("isSpecialService", event.target.value === "si")}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </Select>
            </Field>
            <Field label={schedule.serviceType === "especial" ? "Hora manual" : "Hora automática"}>
              <Input type="time" value={schedule.time || ""} disabled={schedule.serviceType !== "especial"} onChange={(event) => update("time", event.target.value)} />
            </Field>
            <Field label="Líder de adoración">
              <Select value={leaderChoice} onChange={(event) => updateLeader(event.target.value)}>
                <option value="">Selecciona líder</option>
                {worshipLeaders.map((leader) => <option key={leader} value={leader}>{leader}</option>)}
              </Select>
            </Field>
            {leaderChoice === "Otro" ? (
              <Field label="Nombre del líder">
                <Input value={manualLeader} onChange={(event) => {
                  setManualLeader(event.target.value);
                  update("leader", event.target.value);
                }} placeholder="Escribe el nombre" />
              </Field>
            ) : null}
          </div>
          {wrongDay ? (
            <p className="mt-4 rounded-2xl bg-brass/12 px-4 py-3 text-sm font-semibold text-brass">
              Revisa la fecha: este servicio normalmente corresponde a {service.weekday === 0 ? "domingo" : "miércoles"}.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white p-4">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink/55">Cantos</h3>
          <Field label="Agregar canto">
            <Input value={songSearch} onChange={(event) => setSongSearch(event.target.value)} placeholder="Buscar por nombre, tema, categoría, tono o comentario" />
          </Field>
          <div className="mt-3 max-h-64 overflow-auto rounded-2xl border border-ink/10 bg-stonewash">
            {songResults.map((song) => {
              const alreadyAdded = selectedSongIds.has(song.id);
              const capoText = Number(song.capo || 0) > 0
                ? `Capo ${song.capo} · Suena en ${song.keyWithCapo || song.mainKey || "--"}`
                : `Sin capo · Tono ${song.mainKey || "--"}`;
              return (
                <button
                  key={song.id}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addSong(song.id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-ink/10 p-3 text-left last:border-b-0 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span>
                    <span className="block font-semibold text-ink">{song.title}</span>
                    <span className="text-xs text-ink/55">{song.mainTheme || "Sin tema"} · {capoText}</span>
                  </span>
                  <span className="rounded-full bg-ink/7 px-3 py-1 text-xs font-bold text-ink/55">{alreadyAdded ? "Ya agregado" : "Agregar"}</span>
                </button>
              );
            })}
            {!songResults.length ? <p className="p-3 text-sm text-ink/55">No se encontraron cantos.</p> : null}
          </div>

          <div className="mt-4 space-y-3">
            {(schedule.songs || []).map((song, index) => (
              <div key={`${song.songId}-${index}`} className="grid gap-3 rounded-2xl border border-ink/10 bg-stonewash p-3 md:grid-cols-[48px_1fr_90px_1fr_112px]">
                <div className="flex h-11 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">{index + 1}</div>
                <Input value={song.titleSnapshot} onChange={(event) => updateSong(index, "titleSnapshot", event.target.value)} />
                <Input value={song.keySnapshot} onChange={(event) => updateSong(index, "keySnapshot", event.target.value)} />
                <Input value={song.notes || ""} onChange={(event) => updateSong(index, "notes", event.target.value)} placeholder="Notas del canto" />
                <div className="flex gap-1">
                  <Button variant="subtle" className="h-11 w-9 px-0" onClick={() => moveSong(index, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="subtle" className="h-11 w-9 px-0" onClick={() => moveSong(index, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="danger" className="h-11 w-9 px-0" onClick={() => update("songs", schedule.songs.filter((_, currentIndex) => currentIndex !== index))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Field label="Notas generales">
          <Textarea value={schedule.generalNotes} onChange={(event) => update("generalNotes", event.target.value)} />
        </Field>
      </div>

      <div className="sticky bottom-0 mt-4 flex justify-end gap-3 border-t border-ink/10 bg-stonewash pt-4">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar programación</Button>
      </div>
    </form>
  );
}

function MonthCalendar({ schedules, selectedDate, onSelectDate }) {
  const [cursor, setCursor] = useState(() => new Date(`${selectedDate || todayString()}T00:00:00`));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const byDate = schedules.reduce((acc, schedule) => {
    acc[schedule.date] = acc[schedule.date] || [];
    acc[schedule.date].push(schedule);
    return acc;
  }, {});
  const today = todayString();

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setCursor(new Date(year, month - 1, 1))}>Anterior</Button>
        <h3 className="text-lg font-bold text-ink">
          {new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(cursor)}
        </h3>
        <Button variant="secondary" onClick={() => setCursor(new Date(year, month + 1, 1))}>Siguiente</Button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wide text-ink/45">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateString = day.toISOString().slice(0, 10);
          const count = byDate[dateString]?.length || 0;
          const isCurrentMonth = day.getMonth() === month;
          const isSelected = selectedDate === dateString;
          const isToday = dateString === today && isCurrentMonth;
          const stateClasses = isSelected
            ? `border-brass bg-brass/10 ${isToday ? "ring-2 ring-brass/35" : ""}`
            : isToday
              ? "border-brass/70 bg-brass/5 hover:border-brass"
              : "border-ink/10 bg-white hover:border-brass/40";
          return (
            <button
              key={dateString}
              type="button"
              onClick={() => onSelectDate(dateString)}
              className={`min-h-16 rounded-xl border p-1.5 text-left transition sm:min-h-20 sm:rounded-2xl sm:p-2 ${stateClasses} ${isCurrentMonth ? "text-ink" : "text-ink/30"}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold">{day.getDate()}</span>
                {isToday ? <span className="rounded-full bg-brass/15 px-1 py-0.5 text-[9px] font-bold leading-none text-brass sm:px-2 sm:text-[10px]">Hoy</span> : null}
              </span>
              {count ? (
                <span className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-center text-[10px] font-bold text-white sm:mt-2 sm:block sm:h-auto sm:px-2 sm:py-1 sm:text-[11px]">
                  <span className="sm:hidden">{count}</span>
                  <span className="hidden sm:inline">{count} prog.</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ScheduleCard({
  schedule,
  songs,
  canEdit,
  canDelete,
  onEdit,
  onDuplicate,
  onDelete,
  onEditSpecialProgram,
  onViewSpecialProgram,
  onPrintSpecialProgram,
  onPrintSpecialProgramFourUp
}) {
  const special = isSpecialService(schedule);
  const review = reviewServiceSchedule(schedule, songs);
  return (
    <Card>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-ink">{formatDate(schedule.date)}</h3>
            <span className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{schedule.serviceLabel || schedule.type}</span>
          </div>
          <p className="mt-1 text-sm text-ink/55">{schedule.time || "Sin hora"} · {schedule.leader || "Sin lider de adoracion"}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">{schedule.generalNotes || "Sin notas generales."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <Button variant="subtle" onClick={() => onEdit(schedule)}><Edit3 className="h-4 w-4" />Editar</Button>
              <Button variant="secondary" onClick={() => onDuplicate(schedule)}><Copy className="h-4 w-4" />Duplicar</Button>
            </>
          ) : null}
          {canDelete ? (
            <Button variant="danger" onClick={() => confirm("¿Eliminar esta programación?") && onDelete(schedule.id)}>
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-brass/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(182,148,95,0.12))] p-4 dark:border-brass/25 dark:bg-white/8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brass">Revisión inteligente</p>
            <p className="mt-1 font-bold text-ink">{review.status}</p>
            <p className="mt-1 text-sm text-ink/60">{review.alerts[0]?.message || "No hay alertas importantes."}</p>
          </div>
          <ScoreBadge score={review.score} label="Preparación" />
        </div>
      </div>
      {special ? (
        <div className="mt-5 rounded-2xl border border-brass/25 bg-brass/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 text-brass" />
              <div>
                <h4 className="font-bold text-ink">Programa especial</h4>
                <p className="mt-1 text-sm text-ink/60">Orden imprimible del servicio especial.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
              {canEdit ? (
                <Button variant="secondary" onClick={() => onEditSpecialProgram(schedule)}>
                  <Edit3 className="h-4 w-4" />
                  Editar programa
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => onViewSpecialProgram(schedule)}>
                <Eye className="h-4 w-4" />
                Ver programa
              </Button>
              <Button onClick={() => onPrintSpecialProgram(schedule)}>
                <Printer className="h-4 w-4" />
                Imprimir programa
              </Button>
              <Button variant="secondary" onClick={() => onPrintSpecialProgramFourUp(schedule)}>
                <Download className="h-4 w-4" />
                4 programas por hoja
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {(schedule.songs || []).map((song, songIndex) => (
          <div key={`${song.songId}-${songIndex}`} className="rounded-2xl bg-ink/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ink">
                {songIndex + 1}. <SongNameLink songId={song.songId} title={song.titleSnapshot} songs={songs}>{song.titleSnapshot}</SongNameLink>
              </p>
              <span className="rounded-xl bg-white px-3 py-1 text-sm font-bold text-ink">{song.keySnapshot}</span>
            </div>
            <p className="mt-1 text-sm text-ink/55">{song.notes || "Sin notas"}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Schedules() {
  const { canEdit, canDelete } = useAuth();
  const { songs, schedules, settings, saveSchedule, deleteSchedule, duplicateSchedule } = useMusicData();
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [newScheduleDraft, setNewScheduleDraft] = useState(null);
  const [specialProgramSchedule, setSpecialProgramSchedule] = useState(null);
  const [programDraft, setProgramDraft] = useState([]);
  const [programPreviewUrl, setProgramPreviewUrl] = useState("");
  const [programPreviewTitle, setProgramPreviewTitle] = useState("Programa especial");
  const [tab, setTab] = useState("calendar");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = todayString();
    return [...schedules].filter((schedule) => schedule.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]?.date || today;
  });
  const [query, setQuery] = useState("");

  const searchedSchedules = useMemo(() => {
    const term = query.toLowerCase();
    return schedules.filter((schedule) => {
      if (!term) return true;
      const text = [
        schedule.date,
        schedule.serviceType,
        schedule.serviceLabel,
        schedule.type,
        schedule.leader,
        schedule.generalNotes,
        ...(schedule.songs || []).map((song) => song.titleSnapshot)
      ].join(" ").toLowerCase();
      return text.includes(term);
    });
  }, [query, schedules]);

  const visibleSchedules = useMemo(() => {
    const today = todayString();
    const list = searchedSchedules.filter((schedule) => {
      if (tab === "upcoming") return schedule.date >= today;
      if (tab === "past") return schedule.date < today;
      if (tab === "calendar") return schedule.date === selectedDate;
      return true;
    });
    return [...list].sort((a, b) => (tab === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [searchedSchedules, selectedDate, tab]);

  const openNewSchedule = () => {
    const date = tab === "calendar" ? selectedDate || todayString() : todayString();
    setEditingSchedule(null);
    setNewScheduleDraft({ ...blankSchedule, date });
  };

  const closeModal = () => {
    setEditingSchedule(null);
    setNewScheduleDraft(null);
  };

  useEffect(() => () => {
    if (programPreviewUrl) URL.revokeObjectURL(programPreviewUrl);
  }, [programPreviewUrl]);

  const openSpecialProgramEditor = (schedule) => {
    const items = normalizeSpecialProgramItems(schedule?.specialProgram || []);
    setSpecialProgramSchedule(schedule);
    setProgramDraft(items.length ? items : [emptySpecialProgramItem(1)]);
  };

  const updateProgramItem = (index, field, value) => {
    setProgramDraft((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value };
      if (field === "songId" && value) {
        const song = songs.find((entry) => entry.id === value);
        if (song && !next.title) next.title = song.title;
      }
      return next;
    }));
  };

  const addProgramItem = () => {
    setProgramDraft((current) => [...current, emptySpecialProgramItem(current.length + 1)]);
  };

  const removeProgramItem = (index) => {
    setProgramDraft((current) => normalizeSpecialProgramItems(current.filter((_, itemIndex) => itemIndex !== index)));
  };

  const moveProgramItem = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= programDraft.length) return;
    setProgramDraft((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return normalizeSpecialProgramItems(next);
    });
  };

  const saveSpecialProgram = async () => {
    if (!specialProgramSchedule) return;
    await saveSchedule({
      ...specialProgramSchedule,
      isSpecialService: true,
      specialProgram: normalizeSpecialProgramItems(programDraft).filter((item) => item.title || item.type || item.notes || item.songId)
    });
    setSpecialProgramSchedule(null);
    setProgramDraft([]);
  };

  const viewSpecialProgram = async (schedule) => {
    const blob = await pdf(<SpecialProgramDocument schedule={schedule} songs={songs} settings={settings} />).toBlob();
    setProgramPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
    setProgramPreviewTitle("Programa especial");
  };

  const printSpecialProgram = async (schedule) => {
    const blob = await pdf(<SpecialProgramDocument schedule={schedule} songs={songs} settings={settings} />).toBlob();
    downloadBlob(blob, getSpecialProgramFileName(schedule));
  };

  const printSpecialProgramFourUp = async (schedule) => {
    const blob = await pdf(<SpecialProgramFourUpDocument schedule={schedule} songs={songs} settings={settings} />).toBlob();
    downloadBlob(blob, getSpecialProgramFileName(schedule, " 4 por hoja"));
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Programación</h2>
            <p className="mt-1 text-sm text-ink/55">Calendario, listas y servicios de la iglesia.</p>
          </div>
          {canEdit ? (
            <Button onClick={openNewSchedule} data-tour="schedule-new">
              <Plus className="h-4 w-4" />
              {tab === "calendar" ? "Nueva programación para este día" : "Nueva programación"}
            </Button>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["calendar", "Calendario"],
            ["upcoming", "Próximas"],
            ["past", "Pasadas"],
            ["all", "Todas"]
          ].map(([value, label]) => (
            <Button key={value} variant={tab === value ? "primary" : "secondary"} onClick={() => setTab(value)}>{label}</Button>
          ))}
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-ink/35" />
          <Input className="pl-9" placeholder="Buscar por fecha, servicio, canto o lider de adoracion" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </Card>

      {tab === "calendar" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <MonthCalendar schedules={searchedSchedules} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brass" />
              <h3 className="font-bold text-ink">{formatDate(selectedDate)}</h3>
            </div>
            <div className="space-y-3">
              {visibleSchedules.length ? visibleSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-2xl bg-ink/5 p-3">
                  <p className="font-semibold text-ink">{schedule.serviceLabel || schedule.type}</p>
                  <p className="text-sm text-ink/55">{schedule.time} · {schedule.leader || "Sin lider de adoracion"}</p>
                  <div className="mt-3 space-y-1">
                    {(schedule.songs || []).map((song, index) => (
                      <p key={`${song.songId || song.titleSnapshot}-${index}`} className="text-sm font-semibold text-ink/70">
                        {index + 1}. <SongNameLink songId={song.songId} title={song.titleSnapshot} songs={songs}>{song.titleSnapshot}</SongNameLink>
                      </p>
                    ))}
                  </div>
                </div>
              )) : <p className="text-sm text-ink/55">No hay programaciones para este día.</p>}
            </div>
          </Card>
        </div>
      ) : null}

      {visibleSchedules.length ? (
        <div className="grid gap-4">
          {visibleSchedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              songs={songs}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={setEditingSchedule}
              onDuplicate={duplicateSchedule}
              onDelete={deleteSchedule}
              onEditSpecialProgram={openSpecialProgramEditor}
              onViewSpecialProgram={viewSpecialProgram}
              onPrintSpecialProgram={printSpecialProgram}
              onPrintSpecialProgramFourUp={printSpecialProgramFourUp}
            />
          ))}
        </div>
      ) : tab !== "calendar" ? (
        <EmptyState title="Sin programaciones" text="Crea una programación para el próximo servicio del ministerio." />
      ) : null}

      <Modal open={Boolean(newScheduleDraft) || Boolean(editingSchedule)} title={editingSchedule ? "Editar programación" : "Nueva programación"} onClose={closeModal} wide>
        <ScheduleForm
          initialSchedule={editingSchedule || newScheduleDraft || blankSchedule}
          songs={songs}
          onCancel={closeModal}
          onSubmit={async (schedule) => {
            await saveSchedule(schedule);
            closeModal();
          }}
        />
      </Modal>
      <Modal open={Boolean(specialProgramSchedule)} title="Editar programa especial" onClose={() => setSpecialProgramSchedule(null)} wide>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-ink/60">Agrega el orden completo del servicio especial. Esto no reemplaza la lista normal de cantos.</p>
            <Button variant="secondary" onClick={addProgramItem}>
              <Plus className="h-4 w-4" />
              Agregar elemento
            </Button>
          </div>
          <div className="max-h-[58vh] space-y-3 overflow-auto pr-1">
            {programDraft.map((item, index) => (
              <div key={`${item.order}-${index}`} className="rounded-2xl border border-ink/10 bg-white p-3">
                <div className="grid gap-3 md:grid-cols-[80px_180px_1fr]">
                  <Field label="Orden">
                    <Input value={item.order} readOnly />
                  </Field>
                  <Field label="Tipo">
                    <Select value={item.type} onChange={(event) => updateProgramItem(index, "type", event.target.value)}>
                      {SPECIAL_PROGRAM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </Select>
                  </Field>
                  <Field label="Título o descripción">
                    <Input value={item.title || ""} onChange={(event) => updateProgramItem(index, "title", event.target.value)} placeholder="Ej. Oración inicial" />
                  </Field>
                </div>
                {item.type === "Canto" ? (
                  <Field label="Canto relacionado opcional" className="mt-3">
                    <Select value={item.songId || ""} onChange={(event) => updateProgramItem(index, "songId", event.target.value)}>
                      <option value="">Sin canto relacionado</option>
                      {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
                    </Select>
                  </Field>
                ) : null}
                <Field label="Notas opcionales" className="mt-3">
                  <Textarea value={item.notes || ""} onChange={(event) => updateProgramItem(index, "notes", event.target.value)} />
                </Field>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button variant="subtle" className="h-10 w-10 px-0" disabled={index === 0} onClick={() => moveProgramItem(index, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="subtle" className="h-10 w-10 px-0" disabled={index === programDraft.length - 1} onClick={() => moveProgramItem(index, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="danger" onClick={() => removeProgramItem(index)}>
                    <Trash2 className="h-4 w-4" />
                    Borrar
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSpecialProgramSchedule(null)}>Cancelar</Button>
            <Button onClick={saveSpecialProgram}>Guardar programa</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(programPreviewUrl)} title={programPreviewTitle} onClose={() => setProgramPreviewUrl("")} wide panelClassName="h-[92dvh] md:h-[90vh] max-w-6xl flex flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {programPreviewUrl ? <iframe title={programPreviewTitle} src={programPreviewUrl} className="h-full w-full" /> : null}
        </div>
      </Modal>
    </div>
  );
}
