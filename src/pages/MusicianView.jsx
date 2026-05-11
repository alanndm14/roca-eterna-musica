import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RotateCcw, Type } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Field";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, todayString } from "../services/dateUtils";
import { getSongPdfUrl } from "../services/songUtils";

const fontStorageKey = "roca-eterna-musician-font-scale";

const describeTone = (song, fullSong) => {
  const capo = Number(fullSong?.capo ?? song.capo ?? 0);
  const mainKey = fullSong?.mainKey || song.keySnapshot || "";
  const keyWithCapo = fullSong?.keyWithCapo || song.keySnapshot || "";
  if (capo > 0) return `Capo ${capo} · Suena en ${keyWithCapo || mainKey || "sin tono"}`;
  return `Sin capo · Tono ${mainKey || keyWithCapo || "sin tono"}`;
};

export function MusicianView() {
  const { schedules, songs } = useMusicData();
  const [selectedId, setSelectedId] = useState("");
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem(fontStorageKey) || 1));
  const [focusMode, setFocusMode] = useState(false);
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
    localStorage.setItem(fontStorageKey, String(fontScale));
  }, [fontScale]);

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

  const selectedSchedule = scheduleOptions.find((schedule) => schedule.id === selectedId) || scheduleOptions[0];

  const enterFocusMode = async () => {
    setFocusMode(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // El modo visual enfocado queda activo aunque el navegador no permita Fullscreen API.
    }
  };

  const exitFocusMode = async () => {
    setFocusMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  if (!scheduleOptions.length) {
    return <EmptyState title="No hay programaciones" text="Cuando exista una programación, aparecerá aquí en una vista limpia para ensayo." />;
  }

  return (
    <div className={`space-y-5 ${focusMode ? "mx-auto max-w-none" : ""}`} style={{ fontSize: `${fontScale}rem` }}>
      <Card className="bg-ink text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">Vista para músicos</p>
            <h2 className="mt-2 text-3xl font-bold">{selectedSchedule?.serviceLabel || selectedSchedule?.type || "Servicio"}</h2>
            <p className="mt-2 text-white/60">
              {formatDate(selectedSchedule?.date)} · {selectedSchedule?.time || "Sin hora"} · {selectedSchedule?.leader || "Responsable pendiente"}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[260px_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/55">Seleccionar programación</span>
              <Select value={selectedSchedule?.id || ""} onChange={(event) => setSelectedId(event.target.value)}>
                {scheduleOptions.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.serviceLabel || schedule.type || "Servicio"} · {formatDate(schedule.date)} · {schedule.time || "Sin hora"}
                  </option>
                ))}
              </Select>
            </label>
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
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink/55">Tamaño de letra</p>
            <p className="text-xs text-ink/45">Se guarda para tus próximos ensayos en este dispositivo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFontScale((value) => Math.max(0.9, Number((value - 0.1).toFixed(2))))}><Type className="h-4 w-4" />Disminuir</Button>
            <Button variant="secondary" onClick={() => setFontScale((value) => Math.min(1.45, Number((value + 0.1).toFixed(2))))}><Type className="h-4 w-4" />Aumentar</Button>
            <Button variant="subtle" onClick={() => setFontScale(1)}><RotateCcw className="h-4 w-4" />Restablecer</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {(selectedSchedule.songs || []).map((song, index) => {
          const fullSong = songs.find((item) => item.id === song.songId);
          const pdf = song.pdfUrl || getSongPdfUrl(fullSong);
          return (
            <Card key={`${song.songId}-${index}`} className={`${focusMode ? "p-6 md:p-8" : "p-4 md:p-6"}`}>
              <div className="grid gap-4 md:grid-cols-[72px_1fr_220px] md:items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-white">{index + 1}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-bold text-ink">{song.titleSnapshot}</h3>
                    {fullSong?.hasKeyChange ? <span className="rounded-full bg-brass/12 px-3 py-1 text-xs font-bold text-brass">Cambio de tono</span> : null}
                  </div>
                  <p className="mt-2 text-base text-ink/60">{song.notes || "Sin notas para este canto."}</p>
                  {pdf ? (
                    <a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brass" href={pdf} target="_blank" rel="noreferrer">
                      PDF de letra y acordes <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
                <div className="rounded-3xl bg-brass/12 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-brass">Tono</p>
                  <p className="mt-1 text-lg font-bold text-ink">{describeTone(song, fullSong)}</p>
                  {fullSong?.mainKey && fullSong?.keyWithCapo ? (
                    <p className="mt-2 text-sm text-ink/55">Principal: {fullSong.mainKey} · Tono con capo: {fullSong.keyWithCapo}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedSchedule.generalNotes ? (
        <Card>
          <h3 className="font-bold text-ink">Notas generales</h3>
          <p className="mt-2 leading-7 text-ink/62">{selectedSchedule.generalNotes}</p>
        </Card>
      ) : null}
    </div>
  );
}
