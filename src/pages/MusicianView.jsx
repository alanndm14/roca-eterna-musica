import { useEffect, useMemo, useState } from "react";
import { PDFDownloadLink, pdf } from "@react-pdf/renderer";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileStack, Maximize2, Minimize2, Trash2, Upload } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { SongNameLink } from "../components/ui/SongNameLink";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, todayString } from "../services/dateUtils";
import {
  ServiceSheetDocument,
  buildServiceSongs,
  getServiceDisplayLabel,
  getServiceFileName
} from "../services/serviceSheetPdf";
import { downloadBlob, getSongPdfSource, mergePdfFiles, mergeServiceLocalPdfs } from "../services/mergeServicePdfs";
import { getSongPdfUrl } from "../services/songUtils";

const compactDate = (dateString) => {
  if (!dateString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${dateString}T00:00:00`));
};

const selectorLabel = (schedule) => `${getServiceDisplayLabel(schedule)} · ${compactDate(schedule.date)} · ${schedule.time || "Sin hora"}`;

const linkButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft ring-1 ring-ink/10 transition hover:bg-linen";

const toLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function MusicianScheduleCalendar({ schedules, selectedDate, onSelectDate }) {
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
    if (!schedule.date) return acc;
    acc[schedule.date] = acc[schedule.date] || [];
    acc[schedule.date].push(schedule);
    return acc;
  }, {});
  const today = todayString();

  useEffect(() => {
    if (selectedDate) setCursor(new Date(`${selectedDate}T00:00:00`));
  }, [selectedDate]);

  return (
    <div className="rounded-3xl border border-ink/10 bg-white p-3 dark:border-white/10 dark:bg-white/5 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="secondary" className="px-3" onClick={() => setCursor(new Date(year, month - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h4 className="text-sm font-bold capitalize text-ink">
          {new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(cursor)}
        </h4>
        <Button variant="secondary" className="px-3" onClick={() => setCursor(new Date(year, month + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-ink/45 sm:gap-2">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day) => {
          const dateString = toLocalDateString(day);
          const count = byDate[dateString]?.length || 0;
          const isCurrentMonth = day.getMonth() === month;
          const isSelected = selectedDate === dateString;
          const isToday = dateString === today && isCurrentMonth;
          const stateClasses = isSelected
            ? `border-brass bg-brass/10 ${isToday ? "ring-2 ring-brass/35" : ""}`
            : isToday
              ? "border-brass/70 bg-brass/5 hover:border-brass"
              : "border-ink/10 bg-white hover:border-brass/40 dark:border-white/10 dark:bg-ink/30";
          return (
            <button
              key={dateString}
              type="button"
              onClick={() => onSelectDate(dateString)}
              className={`min-h-14 rounded-xl border p-1 text-left transition sm:min-h-16 sm:p-1.5 ${stateClasses} ${isCurrentMonth ? "text-ink" : "text-ink/30"}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold sm:text-sm">{day.getDate()}</span>
                {isToday ? <span className="rounded-full bg-brass/15 px-1 py-0.5 text-[8px] font-bold leading-none text-brass sm:text-[9px]">Hoy</span> : null}
              </span>
              {count ? (
                <span className="mt-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-bold text-white dark:bg-white dark:text-ink sm:h-5 sm:min-w-5 sm:text-[10px]">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MusicianView() {
  const { isAdmin } = useAuth();
  const { schedules, songs, settings, replaceScheduleSong } = useMusicData();
  const [selectedId, setSelectedId] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [showServicePdfs, setShowServicePdfs] = useState(false);
  const [showLocalMerge, setShowLocalMerge] = useState(false);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const [localFiles, setLocalFiles] = useState([]);
  const [mergeResult, setMergeResult] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [isMergingLocalFiles, setIsMergingLocalFiles] = useState(false);
  const [isMergingServiceLocal, setIsMergingServiceLocal] = useState(false);
  const today = todayString();
  const [pickerDate, setPickerDate] = useState(today);

  const scheduleOptions = useMemo(() => {
    const upcoming = schedules.filter((schedule) => schedule.date >= today).sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`));
    const recent = schedules.filter((schedule) => schedule.date < today).sort((a, b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`)).slice(0, 5);
    return [...upcoming, ...recent];
  }, [schedules, today]);

  useEffect(() => {
    if (!selectedId && scheduleOptions[0]?.id) setSelectedId(scheduleOptions[0].id);
  }, [scheduleOptions, selectedId]);

  useEffect(() => {
    document.documentElement.classList.toggle("musician-focus", focusMode);
    const onKeyDown = (event) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.classList.remove("musician-focus");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focusMode]);

  useEffect(() => () => {
    if (sheetUrl) URL.revokeObjectURL(sheetUrl);
  }, [sheetUrl]);

  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedId) || scheduleOptions[0];
  const daySchedules = useMemo(
    () => schedules.filter((schedule) => schedule.date === pickerDate).sort((a, b) => `${a.time || ""}`.localeCompare(`${b.time || ""}`)),
    [pickerDate, schedules]
  );
  const nextSchedule = scheduleOptions.find((schedule) => schedule.date >= today) || scheduleOptions[0];

  useEffect(() => {
    if (selectedSchedule?.date) setPickerDate(selectedSchedule.date);
  }, [selectedSchedule?.date]);
  const serviceSongs = useMemo(
    () => buildServiceSongs(selectedSchedule, songs, settings.keyPreference || "sharps"),
    [selectedSchedule, songs, settings.keyPreference]
  );
  const activePdfSong = serviceSongs[activePdfIndex] || serviceSongs[0];
  const serviceDocument = selectedSchedule ? <ServiceSheetDocument schedule={selectedSchedule} songs={songs} settings={settings} /> : null;
  const realUsageBySong = useMemo(() => {
    const counts = new Map();
    schedules.forEach((schedule) => {
      if (schedule.date > today) return;
      (schedule.songs || []).forEach((entry) => {
        if (!entry.songId) return;
        counts.set(entry.songId, (counts.get(entry.songId) || 0) + 1);
      });
    });
    return counts;
  }, [schedules, today]);
  const replacementSuggestions = useMemo(() => {
    if (!replaceTarget) return [];
    const current = replaceTarget.full || {};
    const scheduledIds = new Set((selectedSchedule?.songs || []).map((entry) => entry.songId).filter(Boolean));
    return songs
      .filter((song) => song.id !== replaceTarget.entry?.songId && !scheduledIds.has(song.id))
      .map((song) => {
        const themeMatches = [song.mainTheme, ...(song.otherThemes || [])].filter(Boolean).filter((theme) => [current.mainTheme, ...(current.otherThemes || [])].includes(theme)).length;
        const score =
          themeMatches * 5
          + (song.category && song.category === current.category ? 3 : 0)
          + (song.mainKey && song.mainKey === current.mainKey ? 2 : 0)
          + (song.keynoteReviewStatus === "completado" ? 3 : 0)
          + (getSongPdfUrl(song) ? 1 : 0)
          + ((realUsageBySong.get(song.id) || 0) <= 1 ? 1 : 0);
        return { song, score };
      })
      .sort((a, b) => b.score - a.score || (a.song.title || "").localeCompare(b.song.title || "", "es"))
      .slice(0, 8);
  }, [realUsageBySong, replaceTarget, selectedSchedule?.songs, songs]);

  const enterFocusMode = async () => {
    setFocusMode(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // El modo enfocado visual queda activo aunque el navegador no permita Fullscreen API.
    }
  };

  const exitFocusMode = async () => {
    setFocusMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  const viewServiceSheet = async () => {
    if (!serviceDocument) return;
    const blob = await pdf(serviceDocument).toBlob();
    if (sheetUrl) URL.revokeObjectURL(sheetUrl);
    setSheetUrl(URL.createObjectURL(blob));
    setShowSheet(true);
  };

  const addLocalFiles = (files) => {
    const nextFiles = [...files].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    setLocalFiles((current) => [
      ...current,
      ...nextFiles.map((file) => ({ id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file }))
    ]);
  };

  const moveLocalFile = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= localFiles.length) return;
    setLocalFiles((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const mergeLocalFiles = async () => {
    if (!localFiles.length) return;
    setIsMergingLocalFiles(true);
    try {
      const blob = await mergePdfFiles(localFiles.map((item) => item.file));
      downloadBlob(blob, getServiceFileName(selectedSchedule));
      setShowLocalMerge(false);
    } finally {
      setIsMergingLocalFiles(false);
    }
  };

  const mergeServiceFromPublicPdfs = async () => {
    setIsMergingServiceLocal(true);
    try {
      const result = await mergeServiceLocalPdfs(selectedSchedule, songs, settings.keyPreference || "sharps");
      if (result.omitted.length) {
        setMergeResult(result);
      } else if (result.blob) {
        downloadBlob(result.blob, result.fileName);
      } else {
        setMergeResult(result);
      }
    } finally {
      setIsMergingServiceLocal(false);
    }
  };

  const confirmReplacement = async (candidate) => {
    if (!replaceTarget || !selectedSchedule) return;
    if (!confirm(`Sustituir este canto en la programación?\n\n${replaceTarget.title} -> ${candidate.title}`)) return;
    await replaceScheduleSong(selectedSchedule.id, replaceTarget.entry, candidate);
    setReplaceTarget(null);
  };

  if (!scheduleOptions.length) {
    return <EmptyState title="No hay programaciones" text="Cuando exista una programación, aparecerá aquí en una vista limpia para ensayo." />;
  }

  return (
    <div className={`space-y-5 ${focusMode ? "mx-auto max-w-none" : ""}`}>
      <Card className="bg-ink text-white">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">Servicio</p>
            <h2 className="mt-2 text-3xl font-bold">{getServiceDisplayLabel(selectedSchedule)}</h2>
            <p className="mt-2 text-white/60">
              {formatDate(selectedSchedule?.date)} · {selectedSchedule?.time || "Sin hora"} · {selectedSchedule?.leader || "Líder de adoración pendiente"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextSchedule ? (
              <Button variant="light" onClick={() => setSelectedId(nextSchedule.id)}>
                Próxima programación
              </Button>
            ) : null}
            <Button variant="darkSubtle" onClick={() => setPickerDate(today)}>
              Hoy
            </Button>
            {focusMode ? (
              <Button variant="light" onClick={exitFocusMode}>
                <Minimize2 className="h-4 w-4" />
                Salir
              </Button>
            ) : (
              <Button variant="light" onClick={enterFocusMode}>
                <Maximize2 className="h-4 w-4" />
                Pantalla completa
              </Button>
            )}
          </div>        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-brass" />
          <h3 className="font-bold text-ink">Seleccionar programación</h3>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <MusicianScheduleCalendar schedules={schedules} selectedDate={pickerDate} onSelectDate={setPickerDate} />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink/55">{formatDate(pickerDate)}</p>
            {daySchedules.length ? daySchedules.map((schedule) => (
              <button
                key={schedule.id}
                type="button"
                onClick={() => setSelectedId(schedule.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${selectedSchedule?.id === schedule.id ? "border-brass bg-brass/10" : "border-ink/10 bg-white hover:border-brass/40 dark:border-white/10 dark:bg-white/5"}`}
              >
                <p className="font-bold text-ink">{getServiceDisplayLabel(schedule)}</p>
                <p className="mt-1 text-sm text-ink/55">{schedule.time || "Sin hora"} ? {schedule.leader || "Líder pendiente"} ? {(schedule.songs || []).length} cantos</p>
              </button>
            )) : (
              <p className="rounded-2xl bg-ink/5 p-4 text-sm text-ink/55">No hay programaciones en este día.</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink">Documentos del servicio</h3>
            <p className="mt-1 text-sm text-ink/55">Hoja resumida del día, PDFs del repertorio y unión local sin subir archivos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={viewServiceSheet}>
              <Eye className="h-4 w-4" />
              Ver hoja del servicio
            </Button>
            {serviceDocument ? (
              <PDFDownloadLink document={serviceDocument} fileName={getServiceFileName(selectedSchedule)} className={linkButtonClass}>
                {({ loading }) => (
                  <>
                    <Download className="h-4 w-4" />
                    {loading ? "Preparando..." : "Descargar hoja del servicio"}
                  </>
                )}
              </PDFDownloadLink>
            ) : null}
            <Button onClick={() => { setActivePdfIndex(0); setShowServicePdfs(true); }} data-tour="service-pdfs">
              <FileStack className="h-4 w-4" />
              Ver PDFs del servicio
            </Button>
            <Button variant="secondary" onClick={() => setShowLocalMerge(true)}>
              <Upload className="h-4 w-4" />
              Unir PDFs desde mi computadora
            </Button>
            <Button variant="secondary" isLoading={isMergingServiceLocal} onClick={mergeServiceFromPublicPdfs} data-tour="service-local-merge">
              <Download className="h-4 w-4" />
              Unir PDFs del servicio desde la app
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {serviceSongs.map((song) => (
          <Card key={`${song.index}-${song.title}`} className={`${focusMode ? "p-6 md:p-8" : "p-4 md:p-6"}`}>
            <div className="grid gap-4 md:grid-cols-[72px_1fr_240px] md:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-white">{song.index}</div>
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-bold">
                      <SongNameLink songId={song.entry.songId} title={song.title} songs={songs}>{song.title}</SongNameLink>
                    </h3>
                    {song.hasKeyChange ? <span className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">Cambio de tono</span> : null}
                  </div>
                  {isAdmin ? (
                    <Button variant="secondary" className="shrink-0" onClick={() => setReplaceTarget(song)}>
                      Sustituir canto
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-base text-ink/60">{song.notes || "Sin notas para este canto."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {song.pdfUrl ? <a className="inline-flex items-center gap-2 rounded-xl bg-brass/12 px-3 py-2 text-sm font-bold text-brass" href={song.pdfUrl} target="_blank" rel="noreferrer">PDF de letra y acordes <ExternalLink className="h-4 w-4" /></a> : null}
                  {song.youtubeUrl ? <a className="inline-flex items-center gap-2 rounded-xl bg-ink/5 px-3 py-2 text-sm font-bold text-ink" href={song.youtubeUrl} target="_blank" rel="noreferrer">YouTube <ExternalLink className="h-4 w-4" /></a> : null}
                  {song.spotifyUrl ? <a className="inline-flex items-center gap-2 rounded-xl bg-ink/5 px-3 py-2 text-sm font-bold text-ink" href={song.spotifyUrl} target="_blank" rel="noreferrer">Spotify <ExternalLink className="h-4 w-4" /></a> : null}
                </div>
              </div>
              <div className="rounded-3xl bg-brass/12 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brass">Tono</p>
                <p className="mt-1 text-lg font-bold text-ink">
                  {song.capo > 0 ? `Capo ${song.capo} · Suena en ${song.keyWithCapo || song.mainKey || "sin tono"}` : `Sin capo · Tono ${song.mainKey || song.keyWithCapo || "sin tono"}`}
                </p>
                {song.capo > 0 && song.mainKey ? <p className="mt-2 text-sm text-ink/55">Tono base: {song.mainKey}</p> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedSchedule.generalNotes ? (
        <Card>
          <h3 className="font-bold text-ink">Notas generales</h3>
          <p className="mt-2 leading-7 text-ink/62">{selectedSchedule.generalNotes}</p>
        </Card>
      ) : null}

      <Modal open={showSheet} title="Hoja del servicio" onClose={() => setShowSheet(false)} wide panelClassName="h-[92dvh] md:h-[90vh] max-w-6xl flex flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {sheetUrl ? <iframe title="Hoja del servicio" src={sheetUrl} className="h-full w-full" /> : null}
        </div>
      </Modal>

      <Modal open={showServicePdfs} title="PDFs del servicio" onClose={() => setShowServicePdfs(false)} wide panelClassName="h-[96dvh] md:h-[90vh] max-w-7xl flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-bold text-ink">{activePdfSong?.index}. {activePdfSong?.title}</p>
              <p className="text-sm text-ink/55">{getServiceDisplayLabel(selectedSchedule)} · {formatDate(selectedSchedule?.date)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={activePdfIndex <= 0} onClick={() => setActivePdfIndex((index) => Math.max(0, index - 1))}><ChevronLeft className="h-4 w-4" />Anterior</Button>
              <Select className="min-w-52" value={activePdfIndex} onChange={(event) => setActivePdfIndex(Number(event.target.value))}>
                {serviceSongs.map((song, index) => <option key={`${song.index}-${song.title}`} value={index}>{song.index}. {song.title}</option>)}
              </Select>
              <Button variant="secondary" disabled={activePdfIndex >= serviceSongs.length - 1} onClick={() => setActivePdfIndex((index) => Math.min(serviceSongs.length - 1, index + 1))}>Siguiente <ChevronRight className="h-4 w-4" /></Button>
              {activePdfSong?.pdfUrl ? <a className={linkButtonClass} href={activePdfSong.pdfUrl} target="_blank" rel="noreferrer">Abrir PDF <ExternalLink className="h-4 w-4" /></a> : null}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {serviceSongs.map((song, index) => {
              const source = getSongPdfSource({ ...song.full, localPdfPath: song.localPdfPath, pdfUrl: song.pdfUrl, pdfPreviewUrl: song.previewUrl });
              return (
                <button
                  key={`${song.index}-${song.title}-jump`}
                  type="button"
                  onClick={() => setActivePdfIndex(index)}
                  className={`min-w-48 rounded-2xl border p-3 text-left text-sm transition ${index === activePdfIndex ? "border-brass bg-brass/10" : "border-ink/10 bg-white hover:border-brass/40"}`}
                >
                  <span className="block font-bold text-ink">{song.index}. {song.title}</span>
                  <span className="mt-1 block text-xs text-ink/55">{source.label}</span>
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-ink/10 bg-white">
            {activePdfSong?.previewUrl ? (
              <iframe title={`PDF ${activePdfSong.title}`} src={activePdfSong.previewUrl} className="h-full min-h-[72dvh] w-full md:min-h-full" />
            ) : (
              <div className="flex h-full min-h-[60dvh] items-center justify-center p-6 text-center text-sm font-semibold text-ink/60">
                Este canto no tiene PDF registrado.
              </div>
            )}
          </div>
          {activePdfSong?.previewUrl ? (
            <p className="text-sm text-ink/55">Si la vista previa no carga o no se desplaza correctamente, abre el PDF en una pestaña nueva.</p>
          ) : null}
        </div>
      </Modal>

      <Modal open={showLocalMerge} title="Unir PDFs desde mi computadora" onClose={() => setShowLocalMerge(false)} wide>
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <input id="local-pdf-files" className="sr-only" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => addLocalFiles([...(event.target.files || [])])} />
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="local-pdf-files" className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-charcoal">
                Seleccionar PDFs
              </label>
              <p className="text-sm text-ink/55">Los archivos se procesan solo en tu navegador. No se suben a la nube.</p>
            </div>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto">
            {localFiles.length ? localFiles.map((item, index) => (
              <div key={item.id} className="grid gap-2 rounded-2xl bg-ink/5 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="truncate text-sm font-semibold text-ink">{index + 1}. {item.file.name}</p>
                <div className="flex gap-1">
                  <Button variant="subtle" className="h-10 w-10 px-0" disabled={index === 0} onClick={() => moveLocalFile(index, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="subtle" className="h-10 w-10 px-0" disabled={index === localFiles.length - 1} onClick={() => moveLocalFile(index, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="danger" className="h-10 w-10 px-0" onClick={() => setLocalFiles((current) => current.filter((file) => file.id !== item.id))} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            )) : <p className="rounded-2xl bg-ink/5 p-4 text-sm text-ink/55">Selecciona varios archivos PDF para unirlos en el orden deseado.</p>}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowLocalMerge(false)}>Cancelar</Button>
            <Button disabled={!localFiles.length} isLoading={isMergingLocalFiles} onClick={mergeLocalFiles}>Generar PDF unido</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(mergeResult)} title="No se pudo incluir todo" onClose={() => setMergeResult(null)}>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-ink/60">
            La app solo intentó unir archivos definidos con Ruta PDF local dentro de public/pdfs. Los enlaces de Drive quedan disponibles para vista previa y apertura individual.
          </p>
          {!mergeResult?.included?.length ? (
            <p className="rounded-2xl bg-brass/12 px-4 py-3 text-sm font-semibold text-brass">
              No fue posible generar el PDF unido desde public/pdfs. Revisa que cada archivo exista en la carpeta pública del proyecto.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-ink/5 p-4">
              <h3 className="font-bold text-ink">Incluidos</h3>
              <div className="mt-3 space-y-2 text-sm text-ink/60">
                {mergeResult?.included?.length ? mergeResult.included.map((item) => <p key={item.title}>{item.title} · {item.source}</p>) : <p>Ningún PDF pudo incluirse.</p>}
              </div>
            </div>
            <div className="rounded-2xl bg-ink/5 p-4">
              <h3 className="font-bold text-ink">Omitidos</h3>
              <div className="mt-3 space-y-2 text-sm text-ink/60">
                {mergeResult?.omitted?.map((item) => <p key={`${item.title}-${item.reason}`}>{item.title}: {item.reason}</p>)}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setMergeResult(null)}>Cancelar</Button>
            <Button disabled={!mergeResult?.blob} onClick={() => {
              downloadBlob(mergeResult.blob, mergeResult.fileName);
              setMergeResult(null);
            }}>
              Descargar PDF parcial
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(replaceTarget)} title="Sustitucion rapida" onClose={() => setReplaceTarget(null)} wide>
        <div className="space-y-4">
          <p className="text-sm text-ink/60">Reemplazar: <strong>{replaceTarget?.title}</strong>. Las sugerencias priorizan tema, categoría, tonalidad, Keynote completado y rotación.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {replacementSuggestions.map(({ song }) => (
              <button key={song.id} type="button" onClick={() => confirmReplacement(song)} className="rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-brass/50 hover:bg-brass/5">
                <p className="font-bold text-ink">{song.title}</p>
                <p className="mt-1 text-sm text-ink/55">{song.mainTheme || "Sin tema"} · {song.category || "sin categoría"}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{Number(song.capo || 0) > 0 ? `Capo ${song.capo} · Suena en ${song.keyWithCapo || song.mainKey || "--"}` : `Sin capo · Tono ${song.mainKey || "--"}`}</p>
                <p className="mt-2 text-xs text-ink/55">Keynote {song.keynoteReviewStatus || "pendiente"} - {getSongPdfUrl(song) ? "PDF disponible" : "Sin PDF registrado"}</p>
                <p className="mt-1 text-xs text-ink/45">{song.lastUsedAt ? `Última vez: ${formatDate(song.lastUsedAt)}` : "Sin historial"}</p>
              </button>
            ))}
          </div>
          {!replacementSuggestions.length ? <p className="rounded-2xl bg-ink/5 p-4 text-sm text-ink/55">No hay sugerencias disponibles fuera de esta programación.</p> : null}
        </div>
      </Modal>
    </div>
  );
}
