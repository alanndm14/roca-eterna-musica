import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, ClipboardCheck, Copy, Download, Edit3, Eye, FileText, Music2, Plus, Printer, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { SortableList, SortableHandle } from "../components/ui/SortableList";
import { SongNameLink } from "../components/ui/SongNameLink";
import { getRiskTone, ServiceReviewPanel } from "../components/smart/ServiceReviewPanel";
import { ServiceFollowUpPanel } from "../components/smart/ServiceFollowUpPanel";
import { SongFollowUpNotice } from "../components/smart/SongFollowUpNotice";
import { SongCoverImage } from "../components/song/SongCoverArtwork";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getCurrentOrNextSchedule, todayString } from "../services/dateUtils";
import { normalizeSearchText } from "../services/songUtils";
import { downloadBlob } from "../services/mergeServicePdfs";
import { getOutstandingSongFollowUps, reviewServiceSchedule } from "../services/smartRecommendations";
import { getServiceTypeOptions, getWorshipLeaderOptions } from "../services/serviceOptions";
import { resolveScheduleSongs } from "../services/scheduleSongSync";
import { calculateSemitoneDifference, formatSemitoneDifference } from "../services/vocalPracticeMusic";
import { canManageVocalPractice } from "../services/memberPresentation";
import { SmartCenter } from "./SmartCenter";
import {
  SPECIAL_PROGRAM_TYPES,
  SPECIAL_SONG_POSITIONS,
  SpecialProgramDocument,
  SpecialProgramFourUpDocument,
  buildSpecialProgramFromSchedule,
  emptySpecialProgramItem,
  getSpecialProgramFileName,
  getSpecialProgramTypeDefaultColor,
  isSpecialService,
  normalizeSpecialProgramItems
} from "../services/specialProgramPdf";

const blankSchedule = {
  date: "",
  serviceType: "domingo-manana",
  serviceLabel: "Domingo mañana",
  time: "11:00",
  leader: "",
  songs: [],
  generalNotes: "",
  slidesUrl: "",
  isSpecialService: false,
  specialProgram: [],
  status: "confirmed"
};

const plannedServiceOptions = [
  { value: "domingo_am", label: "Domingo AM" },
  { value: "domingo_pm", label: "Domingo PM" },
  { value: "miercoles", label: "Miércoles" },
  { value: "especial", label: "Especial" },
  { value: "otro", label: "Otro" }
];
const plannedStatusOptions = [
  { value: "planeado", label: "Planeado" },
  { value: "listo", label: "Listo" },
  { value: "estrenado", label: "Estrenado" },
  { value: "pospuesto", label: "Pospuesto" }
];
const blankPlannedNewSong = {
  songId: "",
  songTitle: "",
  plannedDate: "",
  serviceType: "",
  status: "planeado",
  notes: ""
};
const plannedOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value || "--";

const dateWeekday = (date) => (date ? new Date(`${date}T00:00:00`).getDay() : null);

const schedulePracticeSummary = (entry, songs) => {
  const source = songs.find((song) => song.id === entry.songId);
  if (!source) return "";
  const difference = calculateSemitoneDifference(source.originalKey, entry.keySnapshot);
  return [
    source.originalKey ? `Original: ${source.originalKey}${source.originalBpm ? ` · ${source.originalBpm} BPM` : ""}` : "",
    entry.keySnapshot ? `Servicio: ${entry.keySnapshot}${entry.serviceBpm ? ` · ${entry.serviceBpm} BPM` : ""}` : "",
    Number.isFinite(difference) ? formatSemitoneDifference(difference) : ""
  ].filter(Boolean).join(" · ");
};

function ScheduleForm({ initialSchedule, songs, schedules, settings, onSubmit, onCancel }) {
  const { profile } = useAuth();
  const showVocalPracticeEditor = canManageVocalPractice(profile);
  const serviceOptions = useMemo(() => getServiceTypeOptions(settings), [settings]);
  const worshipLeaders = useMemo(() => [...getWorshipLeaderOptions(settings), "Otro"], [settings]);
  const getService = (value) => serviceOptions.find((item) => item.value === value) || serviceOptions[0];
  const initialService = initialSchedule?.serviceType ? getService(initialSchedule.serviceType) : getService("domingo-manana");
  const hasInitialService = serviceOptions.some((option) => option.value === initialSchedule?.serviceType);
  const [schedule, setSchedule] = useState(() => ({
    ...blankSchedule,
    ...initialSchedule,
    songs: resolveScheduleSongs(initialSchedule, songs, settings.keyPreference || "sharps").map((song) => ({
      ...song.entry,
      titleSnapshot: song.title,
      keySnapshot: song.keyWithCapo || song.mainKey || "",
      notes: song.notes
    })),
    serviceType: hasInitialService ? initialSchedule.serviceType : initialService.value,
    serviceLabel: initialSchedule?.serviceLabel || initialService.label,
    time: initialSchedule?.time || initialService.time,
    isSpecialService: initialSchedule?.isSpecialService ?? isSpecialService(initialSchedule || { serviceType: initialService.value })
  }));
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
    const special = Boolean(nextService.special || nextService.value === "especial");
    setSchedule((current) => ({
      ...current,
      serviceType,
      isSpecialService: special ? true : current.isSpecialService,
      serviceLabel: special ? current.serviceLabel || "Servicio especial" : nextService.label,
      time: nextService.time || current.time || "",
      type: special ? current.serviceLabel || "Servicio especial" : nextService.label
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
        notes: song.internalNotes || "",
        serviceBpm: Number(song.originalBpm || 0),
        serviceTimeSignature: song.timeSignature || "",
        serviceEntryNote: song.originalEntryNote || ""
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
    const special = Boolean(nextService.special || nextService.value === "especial");
    const label = special ? schedule.serviceLabel || "Servicio especial" : nextService.label;
    onSubmit({
      ...schedule,
      serviceLabel: label,
      type: label,
      time: special ? schedule.time : nextService.time
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
            {Boolean(service.special || service.value === "especial") ? (
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
            <Field label={service.special || service.value === "especial" ? "Hora manual" : "Hora automática"}>
              <Input type="time" value={schedule.time || ""} disabled={!(service.special || service.value === "especial")} onChange={(event) => update("time", event.target.value)} />
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
            <Field label="Enlace iCloud de diapositivas">
              <Input
                type="url"
                value={schedule.slidesUrl || ""}
                onChange={(event) => update("slidesUrl", event.target.value)}
                placeholder="https://www.icloud.com/keynote/..."
              />
            </Field>
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
                    {getOutstandingSongFollowUps(song.id, schedules, schedule).length ? <span className="mt-1 block text-xs font-bold text-amber-700 dark:text-amber-300">Tiene un pendiente del uso anterior</span> : null}
                  </span>
                  <span className="rounded-full bg-ink/7 px-3 py-1 text-xs font-bold text-ink/55">{alreadyAdded ? "Ya agregado" : "Agregar"}</span>
                </button>
              );
            })}
            {!songResults.length ? <p className="p-3 text-sm text-ink/55">No se encontraron cantos.</p> : null}
          </div>

          <SortableList
            items={schedule.songs || []}
            getId={(song, index) => `${song.songId || song.titleSnapshot}-${index}`}
            onReorder={(items) => update("songs", items)}
            className="mt-4 space-y-3"
          >
            {(song, index, dragHandleProps) => (
              <div className="grid gap-3 rounded-2xl border border-ink/10 bg-stonewash p-3 lg:grid-cols-[48px_48px_minmax(150px,1fr)_90px_minmax(150px,1fr)_112px]">
                <SortableHandle {...dragHandleProps} />
                <div className="flex h-11 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">{index + 1}</div>
                <Input value={song.titleSnapshot} onChange={(event) => updateSong(index, "titleSnapshot", event.target.value)} />
                <Input value={song.keySnapshot} onChange={(event) => updateSong(index, "keySnapshot", event.target.value)} />
                <Input value={song.notes || ""} onChange={(event) => updateSong(index, "notes", event.target.value)} placeholder="Notas del canto" />
                <div className="flex gap-1">
                  <Button variant="subtle" className="h-11 w-9 px-0" onClick={() => moveSong(index, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="subtle" className="h-11 w-9 px-0" onClick={() => moveSong(index, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="danger" className="h-11 w-9 px-0" onClick={() => update("songs", schedule.songs.filter((_, currentIndex) => currentIndex !== index))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
                </div>
                {showVocalPracticeEditor ? <div className="col-span-full grid gap-3 rounded-xl border border-ink/8 bg-white/60 p-3 sm:grid-cols-3 dark:bg-black/15">
                  <Field label="BPM del servicio">
                    <Input type="number" min="30" max="240" value={song.serviceBpm || ""} onChange={(event) => updateSong(index, "serviceBpm", event.target.value ? Number(event.target.value) : 0)} />
                  </Field>
                  <Field label="Compás del servicio">
                    <Select value={song.serviceTimeSignature || ""} onChange={(event) => updateSong(index, "serviceTimeSignature", event.target.value)}>
                      <option value="">Sin registrar</option>
                      {["2/4", "3/4", "4/4", "6/8"].map((item) => <option key={item}>{item}</option>)}
                    </Select>
                  </Field>
                  <Field label="Nota inicial del servicio">
                    <Input value={song.serviceEntryNote || ""} onChange={(event) => updateSong(index, "serviceEntryNote", event.target.value)} placeholder="C#4" />
                  </Field>
                  {schedulePracticeSummary(song, songs) ? <p className="col-span-full text-xs font-semibold text-ink/50">{schedulePracticeSummary(song, songs)}</p> : null}
                </div> : null}
              </div>
            )}
          </SortableList>
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

function PlannedNewSongForm({ initialValue, songs, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => ({ ...blankPlannedNewSong, ...initialValue }));
  const [error, setError] = useState("");
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const selectedSong = songs.find((song) => song.id === draft.songId);
    const payload = { ...draft, songTitle: String(selectedSong?.title || draft.songTitle || "").trim() };
    if (!payload.songTitle || !payload.plannedDate || !payload.serviceType || !payload.status) {
      setError("Completa canto, fecha, servicio y estado.");
      return;
    }
    setError("");
    try {
      await onSubmit(payload);
    } catch (submitError) {
      setError(submitError?.message || "No se pudo guardar el canto nuevo planeado.");
    }
  };
  return (
    <form className="max-h-[76dvh] space-y-4 overflow-y-auto pr-1" onSubmit={submit}>
      <Field label="Canto existente">
        <Select value={draft.songId || ""} onChange={(event) => {
          const songId = event.target.value;
          const song = songs.find((item) => item.id === songId);
          setDraft((current) => ({ ...current, songId, songTitle: song?.title || current.songTitle }));
        }}>
          <option value="">Escribir nombre manualmente</option>
          {songs.filter((song) => !song.deleted).map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
        </Select>
      </Field>
      {!draft.songId ? (
        <Field label="Nombre del canto">
          <Input value={draft.songTitle || ""} onChange={(event) => update("songTitle", event.target.value)} placeholder="Nombre del canto nuevo" />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha">
          <Input type="date" value={draft.plannedDate || ""} onChange={(event) => update("plannedDate", event.target.value)} />
        </Field>
        <Field label="Servicio">
          <Select value={draft.serviceType || ""} onChange={(event) => update("serviceType", event.target.value)}>
            <option value="">Seleccionar servicio</option>
            {plannedServiceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Estado">
        <Select value={draft.status || ""} onChange={(event) => update("status", event.target.value)}>
          {plannedStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </Field>
      <Field label="Notas opcionales">
        <Textarea className="min-h-20" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)} placeholder="Preparación o acuerdo pendiente" />
      </Field>
      {error ? <p className="rounded-xl bg-red-500/10 p-3 text-sm font-semibold text-red-700 dark:text-red-200">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-ink/10 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}

function PlannedNewSongCard({ item, songs, canEdit, canDelete, onEdit, onMarkIntroduced, onDelete }) {
  const liveSong = songs.find((song) => song.id === item.songId);
  const displayTitle = liveSong?.title || item.songTitle;
  return (
    <div className="rounded-2xl border border-brass/25 bg-brass/10 p-3 dark:border-brass/30 dark:bg-brass/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-bold text-ink">
            {item.songId ? <SongNameLink songId={item.songId} title={displayTitle} songs={songs}>{displayTitle}</SongNameLink> : displayTitle}
          </p>
          <p className="mt-1 text-sm font-semibold text-brass">
            {plannedOptionLabel(plannedServiceOptions, item.serviceType)} · {plannedOptionLabel(plannedStatusOptions, item.status)}
          </p>
          {item.notes ? <p className="mt-2 text-sm leading-6 text-ink/60">{item.notes}</p> : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" onClick={() => onEdit(item)}><Edit3 className="h-4 w-4" />Editar</Button>
            {item.status !== "estrenado" ? <Button variant="secondary" onClick={() => onMarkIntroduced(item.id)}><CheckCircle2 className="h-4 w-4" />Marcar como estrenado</Button> : null}
            {canDelete ? <Button variant="danger" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4" />Eliminar</Button> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MonthCalendar({ schedules, plannedNewSongs, selectedDate, onSelectDate }) {
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
  const plannedByDate = plannedNewSongs.reduce((acc, item) => {
    acc[item.plannedDate] = acc[item.plannedDate] || [];
    acc[item.plannedDate].push(item);
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
          const plannedCount = plannedByDate[dateString]?.length || 0;
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
              {plannedCount ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brass/15 px-1.5 py-1 text-[10px] font-bold text-brass sm:px-2 sm:text-[11px]">
                  <Music2 className="h-3 w-3" />
                  <span className="sm:hidden">{plannedCount}</span>
                  <span className="hidden sm:inline">{plannedCount} {plannedCount === 1 ? "nuevo" : "nuevos"}</span>
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
  schedules,
  canEdit,
  canDelete,
  onEdit,
  onDuplicate,
  onDelete,
  onEditSpecialProgram,
  onViewSpecialProgram,
  onPrintSpecialProgram,
  onPrintSpecialProgramFourUp,
  onOpenReview,
  workspace = false
}) {
  const special = isSpecialService(schedule);
  const liveSongs = resolveScheduleSongs(schedule, songs);
  const review = reviewServiceSchedule(schedule, songs, schedules);
  const risk = getRiskTone(review.score);
  const pendingReviews = (review.groups || [])
    .filter((group) => group.title === "Faltan revisiones")
    .reduce((total, group) => total + (group.items?.length || 0), 0);
  return (
    <Card>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        {!workspace ? <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-ink">{formatDate(schedule.date)}</h3>
            <span className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">{schedule.serviceLabel || schedule.type}</span>
          </div>
          <p className="mt-1 text-sm text-ink/55">{schedule.time || "Sin hora"} · {schedule.leader || "Sin líder de adoración"}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">{schedule.generalNotes || "Sin notas generales."}</p>
        </div> : (
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-ink/45">Notas generales</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">{schedule.generalNotes || "Sin notas generales."}</p>
          </div>
        )}
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
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-ink/10 bg-ink/5 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/6">
        <p className="text-sm font-bold text-ink">
          Preparación {review.score}% · {risk.label} · {pendingReviews} {pendingReviews === 1 ? "revisión pendiente" : "revisiones pendientes"}
        </p>
        <Button variant="secondary" onClick={onOpenReview}>
          <ClipboardCheck className="h-4 w-4" />
          Ver revisión
        </Button>
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
                  {normalizeSpecialProgramItems(schedule.specialProgram || []).length ? "Editar programa especial" : "Crear programa especial"}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => onViewSpecialProgram(schedule)}>
                <Eye className="h-4 w-4" />
                Vista previa
              </Button>
              <Button onClick={() => onPrintSpecialProgram(schedule)}>
                <Printer className="h-4 w-4" />
                Imprimir programa especial
              </Button>
              <Button variant="secondary" onClick={() => onPrintSpecialProgramFourUp(schedule)}>
                <Download className="h-4 w-4" />
                2 programas por hoja
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {liveSongs.map((song) => (
          <div key={`${song.songId}-${song.index}`} className="rounded-2xl bg-ink/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <SongCoverImage song={song} wrapperClassName="h-10 w-10 rounded-xl" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {song.index}. <SongNameLink songId={song.songId} title={song.title} songs={songs}>{song.title}</SongNameLink>
                  </p>
                  {song.artistOrSource ? <p className="mt-1 text-xs font-semibold text-ink/45">{song.artistOrSource}</p> : null}
                </div>
              </div>
              <span className="rounded-xl bg-white px-3 py-1 text-sm font-bold text-ink">{song.keyWithCapo || song.mainKey || "--"}</span>
            </div>
            <p className="mt-1 text-sm text-ink/55">{song.notes || "Sin notas"}</p>
            <SongFollowUpNotice issues={getOutstandingSongFollowUps(song.songId, schedules, schedule).slice(0, 1)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Schedules() {
  const { canEdit, canDelete, isAdmin, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    songs,
    schedules,
    plannedNewSongs = [],
    settings,
    saveSchedule,
    deleteSchedule,
    duplicateSchedule,
    saveServiceFollowUp,
    closeScheduleService,
    savePlannedNewSong,
    markPlannedNewSongIntroduced,
    deletePlannedNewSong
  } = useMusicData();
  const navigationStorageKey = `roca-eterna-schedule-view:${profile?.uid || profile?.role || "user"}`;
  const savedNavigation = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(navigationStorageKey) || "null") || {};
    } catch {
      return {};
    }
  })();
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [newScheduleDraft, setNewScheduleDraft] = useState(null);
  const [plannedNewSongDraft, setPlannedNewSongDraft] = useState(null);
  const [specialProgramSchedule, setSpecialProgramSchedule] = useState(null);
  const [programDraft, setProgramDraft] = useState([]);
  const [programPreviewUrl, setProgramPreviewUrl] = useState("");
  const [programPreviewTitle, setProgramPreviewTitle] = useState("Programa especial");
  const [tab, setTab] = useState(() => savedNavigation.tab || "calendar");
  const [selectedScheduleId, setSelectedScheduleId] = useState(() => searchParams.get("schedule") || savedNavigation.scheduleId || "");
  const [activeScheduleWorkspaceTab, setActiveScheduleWorkspaceTab] = useState(() => searchParams.get("tab") === "asistente" ? "assistant" : savedNavigation.workspaceTab || "program");
  const [selectedDate, setSelectedDate] = useState(() => {
    const requestedDate = searchParams.get("date");
    if (requestedDate) return requestedDate;
    if (savedNavigation.date) return savedNavigation.date;
    const today = todayString();
    return [...schedules].filter((schedule) => schedule.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]?.date || today;
  });
  const [query, setQuery] = useState("");
  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) || null;
  const nextAvailableSchedule = getCurrentOrNextSchedule(schedules);
  const selectedReview = useMemo(
    () => selectedSchedule ? reviewServiceSchedule(selectedSchedule, songs, schedules) : null,
    [schedules, selectedSchedule, songs]
  );

  useEffect(() => {
    const scheduleId = searchParams.get("schedule");
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "asistente") setActiveScheduleWorkspaceTab("assistant");
    if (scheduleId) {
      const schedule = schedules.find((item) => item.id === scheduleId);
      if (!schedule?.date) return;
      setSelectedScheduleId(schedule.id);
      setSelectedDate(schedule.date);
      setTab("calendar");
    }
  }, [schedules, searchParams]);

  useEffect(() => {
    sessionStorage.setItem(navigationStorageKey, JSON.stringify({
      tab,
      scheduleId: selectedScheduleId,
      date: selectedDate,
      workspaceTab: activeScheduleWorkspaceTab
    }));
  }, [activeScheduleWorkspaceTab, navigationStorageKey, selectedDate, selectedScheduleId, tab]);

  const selectSchedule = (schedule, workspaceTab = activeScheduleWorkspaceTab) => {
    if (!schedule?.id) return;
    setSelectedScheduleId(schedule.id);
    setSelectedDate(schedule.date || selectedDate);
    setActiveScheduleWorkspaceTab(workspaceTab);
    const next = new URLSearchParams(searchParams);
    next.set("schedule", schedule.id);
    if (workspaceTab === "assistant") next.set("tab", "asistente");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const setWorkspaceTab = (workspaceTab) => {
    setActiveScheduleWorkspaceTab(workspaceTab);
    const next = new URLSearchParams(searchParams);
    if (selectedScheduleId) next.set("schedule", selectedScheduleId);
    if (workspaceTab === "assistant") next.set("tab", "asistente");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

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
        ...resolveScheduleSongs(schedule, songs, settings.keyPreference || "sharps").map((song) => song.title)
      ].join(" ").toLowerCase();
      return text.includes(term);
    });
  }, [query, schedules, settings.keyPreference, songs]);
  const safePlannedNewSongs = Array.isArray(plannedNewSongs) ? plannedNewSongs : [];
  const searchedPlannedNewSongs = useMemo(() => {
    const term = normalizeSearchText(query);
    if (!term) return safePlannedNewSongs;
    return safePlannedNewSongs.filter((item) => normalizeSearchText([
      item.songTitle,
      item.plannedDate,
      plannedOptionLabel(plannedServiceOptions, item.serviceType),
      plannedOptionLabel(plannedStatusOptions, item.status),
      item.notes
    ].join(" ")).includes(term));
  }, [query, safePlannedNewSongs]);

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
  const visiblePlannedNewSongs = useMemo(() => {
    const today = todayString();
    return searchedPlannedNewSongs
      .filter((item) => {
        if (tab === "upcoming") return item.plannedDate >= today;
        if (tab === "past") return item.plannedDate < today;
        if (tab === "calendar") return item.plannedDate === selectedDate;
        return true;
      })
      .sort((a, b) => (tab === "past" ? b.plannedDate.localeCompare(a.plannedDate) : a.plannedDate.localeCompare(b.plannedDate)));
  }, [searchedPlannedNewSongs, selectedDate, tab]);

  const openNewSchedule = () => {
    const date = tab === "calendar" ? selectedDate || todayString() : todayString();
    setEditingSchedule(null);
    setNewScheduleDraft({ ...blankSchedule, date });
  };
  const openSmartScheduleCreator = () => {
    setSelectedScheduleId("");
    setActiveScheduleWorkspaceTab("assistant");
    const next = new URLSearchParams(searchParams);
    next.delete("schedule");
    next.set("tab", "asistente");
    setSearchParams(next, { replace: true });
  };
  const openNewPlannedSong = () => {
    const plannedDate = tab === "calendar" ? selectedDate || todayString() : todayString();
    setPlannedNewSongDraft({ ...blankPlannedNewSong, plannedDate });
  };
  const removePlannedSong = async (item) => {
    if (!confirm(`¿Eliminar este canto nuevo planeado?\n\n${item.songTitle}\n\nEsto no eliminará el canto del repertorio.`)) return;
    await deletePlannedNewSong(item.id);
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
    setProgramDraft(items.length ? items : buildSpecialProgramFromSchedule(schedule));
  };

  const updateProgramItem = (index, field, value) => {
    setProgramDraft((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value };
      if (field === "type") {
        const previousDefaultColor = getSpecialProgramTypeDefaultColor(item.type);
        const usesDefaultColor = !item.categoryColor || item.categoryColor.toLowerCase() === previousDefaultColor.toLowerCase();
        if (usesDefaultColor) next.categoryColor = getSpecialProgramTypeDefaultColor(value);
      }
      if (field === "songId" && value) {
        const option = getScheduledSongOptions(specialProgramSchedule, songs).find((entry) => entry.songId === value);
        const song = songs.find((entry) => entry.id === value);
        if (option || song) next.title = option?.title || song?.title || next.title;
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
    downloadBlob(blob, getSpecialProgramFileName(schedule, " 2 por hoja"));
  };

  const scheduledProgramSongs = getScheduledSongOptions(specialProgramSchedule, songs);
  const specialProgramExists = normalizeSpecialProgramItems(specialProgramSchedule?.specialProgram || []).length > 0;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Programación</h2>
            <p className="mt-1 text-sm text-ink/55">Calendario, listas y servicios de la iglesia.</p>
          </div>
          {canEdit || isAdmin ? (
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button onClick={openNewSchedule} data-tour="schedule-new">
                  <Plus className="h-4 w-4" />
                  {tab === "calendar" ? "Nueva programación para este día" : "Nueva programación"}
                </Button>
              ) : null}
              <Button variant="accent" onClick={openSmartScheduleCreator}>
                <Sparkles className="h-4 w-4" />
                Sugerir cantos
              </Button>
              {canEdit ? (
                <Button variant="secondary" onClick={openNewPlannedSong}>
                  <Music2 className="h-4 w-4" />
                  {tab === "calendar" ? "Canto nuevo para este día" : "Planear canto nuevo"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["calendar", "Calendario"],
            ["upcoming", "Próximas"],
            ["past", "Pasadas"],
            ["all", "Todas"]
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={tab === value && !(value === "calendar" && activeScheduleWorkspaceTab === "assistant" && !selectedSchedule) ? "primary" : "secondary"}
              onClick={() => {
                setTab(value);
                if (value === "calendar" && activeScheduleWorkspaceTab === "assistant" && !selectedSchedule) {
                  setActiveScheduleWorkspaceTab("program");
                }
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-ink/35" />
          <Input className="pl-9" placeholder="Buscar por fecha, servicio, canto o líder de adoración" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </Card>

      {tab === "calendar" && !(activeScheduleWorkspaceTab === "assistant" && !selectedSchedule) ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <MonthCalendar schedules={searchedSchedules} plannedNewSongs={searchedPlannedNewSongs} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brass" />
              <h3 className="font-bold text-ink">{formatDate(selectedDate)}</h3>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide text-ink/45">Programaciones del día</h4>
              <div className="mt-3 space-y-3">
              {visibleSchedules.length ? visibleSchedules.map((schedule) => (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => selectSchedule(schedule)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${selectedScheduleId === schedule.id ? "border-brass bg-brass/12" : "border-transparent bg-ink/5 hover:border-brass/35"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{schedule.serviceLabel || schedule.type}</p>
                      <p className="text-sm text-ink/55">{schedule.time} · {schedule.leader || "Sin líder de adoración"}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brass">Abrir</span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {resolveScheduleSongs(schedule, songs, settings.keyPreference || "sharps").map((song) => (
                      <div key={`${song.songId || song.title}-${song.index}`} className="flex items-center gap-2 text-sm font-semibold text-ink/70">
                        <SongCoverImage song={song} wrapperClassName="h-7 w-7 rounded-lg" />
                        <span className="truncate">{song.index}. {song.title}</span>
                      </div>
                    ))}
                  </div>
                </button>
              )) : <p className="text-sm text-ink/55">No hay programaciones para este día.</p>}
              </div>
            </div>
            {visiblePlannedNewSongs.length ? (
              <div className="mt-6 border-t border-ink/10 pt-5">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4 text-brass" />
                  <h4 className="text-xs font-black uppercase tracking-wide text-ink/45">Cantos nuevos planeados</h4>
                </div>
                <div className="mt-3 space-y-3">
                  {visiblePlannedNewSongs.map((item) => (
                    <PlannedNewSongCard
                      key={item.id}
                      item={item}
                      songs={songs}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEdit={setPlannedNewSongDraft}
                      onMarkIntroduced={markPlannedNewSongIntroduced}
                      onDelete={removePlannedSong}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab !== "calendar" && visibleSchedules.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleSchedules.map((schedule) => (
            <button
              key={schedule.id}
              type="button"
              onClick={() => selectSchedule(schedule)}
              className={`rounded-2xl border p-4 text-left shadow-soft transition ${selectedScheduleId === schedule.id ? "border-brass bg-brass/12" : "border-ink/10 bg-white hover:border-brass/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-ink">{schedule.serviceLabel || schedule.type || "Servicio"}</p>
                  <p className="mt-1 text-sm text-ink/55">{formatDate(schedule.date)} · {schedule.time || "Sin hora"}</p>
                  <p className="mt-1 text-xs font-semibold text-ink/45">{schedule.leader || "Sin líder de adoración"} · {(schedule.songs || []).length} cantos</p>
                </div>
                <span className="rounded-full bg-brass/12 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brass">Abrir</span>
              </div>
            </button>
          ))}
        </div>
      ) : tab !== "calendar" && !visiblePlannedNewSongs.length ? (
        <EmptyState title="Sin resultados" text="No hay programaciones ni cantos nuevos planeados para mostrar." />
      ) : null}

      {tab !== "calendar" && visiblePlannedNewSongs.length ? (
        <Card>
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-brass" />
            <h3 className="font-bold text-ink">Cantos nuevos planeados</h3>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visiblePlannedNewSongs.map((item) => (
              <div key={item.id}>
                <p className="mb-2 text-xs font-bold text-ink/45">{formatDate(item.plannedDate)}</p>
                <PlannedNewSongCard
                  item={item}
                  songs={songs}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={setPlannedNewSongDraft}
                  onMarkIntroduced={markPlannedNewSongIntroduced}
                  onDelete={removePlannedSong}
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {selectedSchedule ? (
        <section className="grid min-w-0 gap-4">
          <Card className="p-4">
            <p className="text-xs font-black uppercase tracking-wide text-brass">Servicio seleccionado</p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-black text-ink">{selectedSchedule.serviceLabel || selectedSchedule.type || "Servicio"}</h3>
                <p className="mt-1 text-sm font-semibold text-ink/55">
                  {formatDate(selectedSchedule.date)} · {selectedSchedule.time || "Sin hora"} · {selectedSchedule.leader || "Sin líder de adoración"} · {(selectedSchedule.songs || []).length} cantos
                </p>
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {[
                  ["program", "Programa", FileText],
                  ["assistant", "Asistente", Sparkles],
                  ["review", "Revisión", ClipboardCheck],
                  ["followup", "Seguimiento", CheckCircle2]
                ].map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWorkspaceTab(value)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${activeScheduleWorkspaceTab === value ? "bg-ink text-white dark:bg-brass dark:text-ink" : "bg-ink/5 text-ink/65 hover:bg-brass/12 hover:text-ink dark:bg-white/8"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {activeScheduleWorkspaceTab === "program" ? (
            <ScheduleCard
              schedule={selectedSchedule}
              songs={songs}
              schedules={schedules}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={setEditingSchedule}
              onDuplicate={duplicateSchedule}
              onDelete={deleteSchedule}
              onEditSpecialProgram={openSpecialProgramEditor}
              onViewSpecialProgram={viewSpecialProgram}
              onPrintSpecialProgram={printSpecialProgram}
              onPrintSpecialProgramFourUp={printSpecialProgramFourUp}
              onOpenReview={() => setWorkspaceTab("review")}
              workspace
            />
          ) : null}

          {activeScheduleWorkspaceTab === "assistant" ? (
            <SmartCenter embedded scheduleId={selectedSchedule.id} initialDate={selectedSchedule.date || selectedDate} />
          ) : null}

          {activeScheduleWorkspaceTab === "review" && selectedReview ? (
            <ServiceReviewPanel review={selectedReview} />
          ) : null}

          {activeScheduleWorkspaceTab === "followup" ? (
            <ServiceFollowUpPanel
              schedule={selectedSchedule}
              canEdit={canEdit}
              onSave={saveServiceFollowUp}
              onCloseService={closeScheduleService}
            />
          ) : null}
        </section>
      ) : activeScheduleWorkspaceTab === "assistant" ? (
        <SmartCenter embedded initialDate={selectedDate} />
      ) : null}

      <Modal open={Boolean(newScheduleDraft) || Boolean(editingSchedule)} title={editingSchedule ? "Editar programación" : "Nueva programación"} onClose={closeModal} wide>
        <ScheduleForm
          initialSchedule={editingSchedule || newScheduleDraft || blankSchedule}
          songs={songs}
          schedules={schedules}
          settings={settings}
          onCancel={closeModal}
          onSubmit={async (schedule) => {
            await saveSchedule(schedule);
            closeModal();
          }}
        />
      </Modal>
      <Modal open={Boolean(plannedNewSongDraft)} title={plannedNewSongDraft?.id ? "Editar canto nuevo planeado" : "Agregar canto nuevo"} onClose={() => setPlannedNewSongDraft(null)}>
        <PlannedNewSongForm
          initialValue={plannedNewSongDraft || blankPlannedNewSong}
          songs={songs}
          onCancel={() => setPlannedNewSongDraft(null)}
          onSubmit={async (plannedSong) => {
            await savePlannedNewSong(plannedSong);
            setPlannedNewSongDraft(null);
          }}
        />
      </Modal>
      <Modal open={Boolean(specialProgramSchedule)} title={specialProgramExists ? "Editar programa especial" : "Crear programa especial"} onClose={() => setSpecialProgramSchedule(null)} wide>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-ink/60">Agrega el orden completo del servicio especial. Esto no reemplaza la lista normal de cantos.</p>
            <Button variant="secondary" onClick={addProgramItem}>
              <Plus className="h-4 w-4" />
              Agregar elemento
            </Button>
          </div>
          <div className="max-h-[58vh] overflow-auto pr-1">
            <SortableList
              items={programDraft}
              getId={(item, index) => `${item.songId || item.title || item.type || "item"}-${index}`}
              onReorder={(items) => setProgramDraft(normalizeSpecialProgramItems(items))}
              className="space-y-3"
            >
            {(item, index, dragHandleProps) => (
              <div className="rounded-2xl border border-ink/10 bg-white p-3">
                <div className="grid gap-3 md:grid-cols-[48px_80px_180px_120px_1fr]">
                  <div className="pt-6"><SortableHandle {...dragHandleProps} /></div>
                  <Field label="Orden">
                    <Input value={item.order} readOnly />
                  </Field>
                  <Field label="Tipo">
                    <Select value={item.type} onChange={(event) => updateProgramItem(index, "type", event.target.value)}>
                      {SPECIAL_PROGRAM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </Select>
                  </Field>
                  <Field label="Color">
                    <Input type="color" value={item.categoryColor || getSpecialProgramTypeDefaultColor(item.type)} onChange={(event) => updateProgramItem(index, "categoryColor", event.target.value)} />
                  </Field>
                  <Field label="Título o descripción">
                    <Input value={item.title || ""} onChange={(event) => updateProgramItem(index, "title", event.target.value)} placeholder="Ej. Oración inicial" />
                  </Field>
                </div>
                {item.type === "Canto" ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Canto de esta programación">
                      <Select value={item.songId || ""} onChange={(event) => updateProgramItem(index, "songId", event.target.value)}>
                        <option value="">Selecciona un canto programado</option>
                        {scheduledProgramSongs.map((song) => <option key={song.id} value={song.songId}>{song.title}</option>)}
                      </Select>
                    </Field>
                    <Field label="Posición musical">
                      <Select value={item.position || "Antes de la prédica"} onChange={(event) => updateProgramItem(index, "position", event.target.value)}>
                        {SPECIAL_SONG_POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                      </Select>
                    </Field>
                  </div>
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
            )}
            </SortableList>
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

function getScheduledSongOptions(schedule = {}, songs = []) {
  return (schedule?.songs || []).map((entry, index) => {
    const fullSong = songs.find((song) => song.id === entry.songId);
    return {
      id: entry.songId || `${entry.titleSnapshot}-${index}`,
      songId: entry.songId || "",
      title: fullSong?.title || entry.titleSnapshot || "Canto",
      fullSong
    };
  });
}

