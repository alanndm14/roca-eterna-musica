import { useEffect, useMemo, useState } from "react";
import { PDFDownloadLink, pdf } from "@react-pdf/renderer";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileStack, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, todayString } from "../services/dateUtils";
import {
  ServiceSheetDocument,
  buildServiceSongs,
  getServiceDisplayLabel,
  getServiceFileName
} from "../services/serviceSheetPdf";

const compactDate = (dateString) => {
  if (!dateString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${dateString}T00:00:00`));
};

const selectorLabel = (schedule) => {
  const label = getServiceDisplayLabel(schedule);
  return `${label} · ${compactDate(schedule.date)} · ${schedule.time || "Sin hora"}`;
};

const linkButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft ring-1 ring-ink/10 transition hover:bg-linen";

export function MusicianView() {
  const { schedules, songs, settings } = useMusicData();
  const [selectedId, setSelectedId] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [showServicePdfs, setShowServicePdfs] = useState(false);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const today = todayString();

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

  const selectedSchedule = scheduleOptions.find((schedule) => schedule.id === selectedId) || scheduleOptions[0];
  const serviceSongs = useMemo(
    () => buildServiceSongs(selectedSchedule, songs, settings.keyPreference || "sharps"),
    [selectedSchedule, songs, settings.keyPreference]
  );
  const activePdfSong = serviceSongs[activePdfIndex] || serviceSongs[0];
  const serviceDocument = selectedSchedule ? <ServiceSheetDocument schedule={selectedSchedule} songs={songs} settings={settings} /> : null;

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

  if (!scheduleOptions.length) {
    return <EmptyState title="No hay programaciones" text="Cuando exista una programación, aparecerá aquí en una vista limpia para ensayo." />;
  }

  return (
    <div className={`space-y-5 ${focusMode ? "mx-auto max-w-none" : ""}`}>
      <Card className="bg-ink text-white">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">Vista para músicos</p>
            <h2 className="mt-2 text-3xl font-bold">{getServiceDisplayLabel(selectedSchedule)}</h2>
            <p className="mt-2 text-white/60">
              {formatDate(selectedSchedule?.date)} · {selectedSchedule?.time || "Sin hora"} · {selectedSchedule?.leader || "Responsable pendiente"}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,420px)_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/55">Programación</span>
              <Select value={selectedSchedule?.id || ""} onChange={(event) => setSelectedId(event.target.value)}>
                {scheduleOptions.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>{selectorLabel(schedule)}</option>
                ))}
              </Select>
            </label>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink">Documentos del servicio</h3>
            <p className="mt-1 text-sm text-ink/55">Hoja resumida del día y vista rápida de PDFs del repertorio.</p>
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
            <Button onClick={() => { setActivePdfIndex(0); setShowServicePdfs(true); }}>
              <FileStack className="h-4 w-4" />
              Ver PDFs del servicio
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
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-bold text-ink">{song.title}</h3>
                  {song.hasKeyChange ? <span className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">Cambio de tono</span> : null}
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
                <p className="mt-2 text-sm text-ink/55">Principal: {song.mainKey || "--"} · Tono con capo: {song.keyWithCapo || "--"}</p>
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

      <Modal open={showSheet} title="Hoja del servicio" onClose={() => setShowSheet(false)} wide>
        <div className="h-[72vh] overflow-hidden rounded-2xl border border-ink/10 bg-white">
          {sheetUrl ? <iframe title="Hoja del servicio" src={sheetUrl} className="h-full w-full" /> : null}
        </div>
      </Modal>

      <Modal open={showServicePdfs} title="PDFs del servicio" onClose={() => setShowServicePdfs(false)} wide>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-bold text-ink">{activePdfSong?.index}. {activePdfSong?.title}</p>
              <p className="text-sm text-ink/55">{getServiceDisplayLabel(selectedSchedule)} · {formatDate(selectedSchedule?.date)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={activePdfIndex <= 0} onClick={() => setActivePdfIndex((index) => Math.max(0, index - 1))}><ChevronLeft className="h-4 w-4" />Anterior</Button>
              <Select value={activePdfIndex} onChange={(event) => setActivePdfIndex(Number(event.target.value))}>
                {serviceSongs.map((song, index) => <option key={`${song.index}-${song.title}`} value={index}>{song.index}. {song.title}</option>)}
              </Select>
              <Button variant="secondary" disabled={activePdfIndex >= serviceSongs.length - 1} onClick={() => setActivePdfIndex((index) => Math.min(serviceSongs.length - 1, index + 1))}>Siguiente <ChevronRight className="h-4 w-4" /></Button>
              {activePdfSong?.pdfUrl ? <a className={linkButtonClass} href={activePdfSong.pdfUrl} target="_blank" rel="noreferrer">Abrir PDF <ExternalLink className="h-4 w-4" /></a> : null}
            </div>
          </div>
          <div className="h-[68vh] overflow-hidden rounded-2xl border border-ink/10 bg-white">
            {activePdfSong?.previewUrl ? (
              <iframe title={`PDF ${activePdfSong.title}`} src={activePdfSong.previewUrl} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-ink/60">
                Este canto no tiene PDF registrado.
              </div>
            )}
          </div>
          {activePdfSong?.previewUrl ? (
            <p className="text-sm text-ink/55">Si la vista previa no carga, abre el PDF en una pestaña nueva.</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
