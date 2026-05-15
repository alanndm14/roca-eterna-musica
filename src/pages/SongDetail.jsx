import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, CheckCircle, Copy, ExternalLink, FileText, Headphones, Youtube } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FileDiagnosticPanel } from "../components/ui/FileDiagnosticPanel";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate } from "../services/dateUtils";
import { testPublicPdfPath } from "../services/publicPdfTools";
import {
  getSongExternalChordsUrl,
  getSongPdfUrl,
  getSongSpotifyUrl,
  getSongYoutubeUrl,
  normalizeSong
} from "../services/songUtils";

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 rounded-2xl bg-ink/5 p-3 text-sm">
      <dt className="text-ink/50">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value || "--"}</dd>
    </div>
  );
}

function StatusPill({ label, value }) {
  const complete = value === "completado";
  const reviewing = value === "en revisión";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${complete ? "bg-brass/15 text-brass" : reviewing ? "bg-blue-gray/15 text-blue-gray" : "bg-ink/7 text-ink/60"}`}>
      {label}: {value || "pendiente"}
    </span>
  );
}

export function SongDetail() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const { songs, schedules, duplicateSong, saveSchedule, settings, logAuditEvent } = useMusicData();
  const [showPdf, setShowPdf] = useState(false);
  const [pdfTest, setPdfTest] = useState(null);
  const song = normalizeSong(songs.find((item) => item.id === songId), settings.keyPreference || "sharps");

  if (!song?.id) return <EmptyState title="Canto no encontrado" text="Es posible que haya sido eliminado." />;

  const pdfUrl = getSongPdfUrl(song);
  const youtubeUrl = getSongYoutubeUrl(song);
  const spotifyUrl = getSongSpotifyUrl(song);
  const externalChordsUrl = getSongExternalChordsUrl(song);
  const lyricsSections = (song.lyricsSections || []).filter((section) => section.text?.trim());
  const usage = schedules
    .filter((schedule) => schedule.songs?.some((item) => item.songId === song.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const toneSummary = Number(song.capo || 0) > 0
    ? `Capo ${song.capo} · Suena en ${song.keyWithCapo || song.mainKey || "--"}`
    : `Sin capo · Tono ${song.mainKey || song.keyWithCapo || "--"}`;

  const copyPdf = async () => {
    if (pdfUrl) await navigator.clipboard?.writeText(pdfUrl);
  };

  const scheduleSongEntry = () => ({
    songId: song.id,
    titleSnapshot: song.title,
    keySnapshot: song.keyWithCapo || song.mainKey || "",
    pdfUrl,
    notes: ""
  });

  const nextNormalService = () => {
    const options = [];
    const now = new Date();
    for (let offset = 0; offset < 14; offset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() + offset);
      const weekday = date.getDay();
      const day = date.toISOString().slice(0, 10);
      if (weekday === 3) options.push({ date: day, serviceType: "miercoles-oracion", serviceLabel: "Miercoles de oracion", time: "19:00" });
      if (weekday === 0) {
        options.push({ date: day, serviceType: "domingo-manana", serviceLabel: "Domingo manana", time: "11:00" });
        options.push({ date: day, serviceType: "domingo-tarde", serviceLabel: "Domingo tarde", time: "17:00" });
      }
    }
    return options.find((option) => new Date(`${option.date}T${option.time}`) > now) || options[0];
  };

  const addToNextSchedule = async () => {
    const nowKey = new Date().toISOString().slice(0, 10);
    const futureSchedules = [...schedules].filter((schedule) => schedule.date >= nowKey).sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
    const nextSchedule = futureSchedules[0];
    if (nextSchedule) {
      if ((nextSchedule.songs || []).some((item) => item.songId === song.id)) {
        alert("Este canto ya esta en la siguiente programacion.");
        return;
      }
      const label = `${nextSchedule.serviceLabel || nextSchedule.type || "Servicio"} · ${formatDate(nextSchedule.date)} · ${nextSchedule.time || ""}`;
      if (!confirm(`Agregar este canto a la siguiente programacion: ${label}`)) return;
      await saveSchedule({ ...nextSchedule, songs: [...(nextSchedule.songs || []), scheduleSongEntry()] });
      await logAuditEvent?.({ actionType: "update", entityType: "schedule", entityId: nextSchedule.id, entityName: nextSchedule.serviceLabel || nextSchedule.date, summary: `Canto agregado a programacion: ${song.title}` });
      alert("Canto agregado a la siguiente programacion.");
      return;
    }

    const service = nextNormalService();
    if (!confirm(`No hay programaciones futuras. Crear ${service.serviceLabel} para ${formatDate(service.date)} con este canto incluido?`)) return;
    await saveSchedule({
      ...service,
      type: service.serviceLabel,
      leader: "",
      songs: [scheduleSongEntry()],
      generalNotes: "",
      status: "borrador"
    });
    alert("Se creo la siguiente programacion normal con este canto incluido.");
    navigate("/programacion");
  };

  return (
    <div className="space-y-5">
      <Button variant="subtle" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <Card className="bg-ink text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">{song.category || "normal"}</p>
            <h2 className="mt-2 text-4xl font-bold tracking-normal">{song.title}</h2>
            <p className="mt-2 text-white/60">{song.artistOrSource || "Sin fuente registrada"}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {song.mainTheme ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brass">{song.mainTheme}</span> : null}
              {(song.otherThemes || []).map((theme) => (
                <span key={theme} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">{theme}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-2xl bg-white px-4 py-3 text-2xl font-bold text-ink">{song.mainKey || "--"}</span>
            {canEdit ? (
              <>
                <span>
                  <Button variant="light" onClick={addToNextSchedule}>
                    <CalendarPlus className="h-4 w-4" />
                    Agregar a la siguiente programacion
                  </Button>
                </span>
                <Button variant="darkSubtle" onClick={() => duplicateSong(song)}>
                  <Copy className="h-4 w-4" />
                  Duplicar
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-ink">PDF de letra y acordes</h3>
                <p className="mt-1 text-sm text-ink/55">Acceso rápido al PDF del canto.</p>
              </div>
              <FileText className="h-8 w-8 text-brass" />
            </div>
            {pdfUrl ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <Button><ExternalLink className="h-4 w-4" />Abrir PDF</Button>
                </a>
                <Button variant="secondary" onClick={copyPdf}><Copy className="h-4 w-4" />Copiar link</Button>
                <Button variant="subtle" onClick={() => setShowPdf(true)}>Ver dentro de la app</Button>
                {song.localPdfPath ? (
                  <Button variant="secondary" onClick={async () => setPdfTest(await testPublicPdfPath(song.localPdfPath))}>
                    <CheckCircle className="h-4 w-4" />
                    Diagnosticar archivo
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-ink/5 p-4 text-sm text-ink/58">Este canto todavía no tiene PDF registrado.</p>
            )}
            <FileDiagnosticPanel result={pdfTest} />
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-ink">Escucha y enlaces</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {youtubeUrl ? <a href={youtubeUrl} target="_blank" rel="noreferrer"><Button variant="secondary"><Youtube className="h-4 w-4" />Abrir YouTube</Button></a> : null}
              {spotifyUrl ? <a href={spotifyUrl} target="_blank" rel="noreferrer"><Button variant="secondary"><Headphones className="h-4 w-4" />Abrir Spotify</Button></a> : null}
              {externalChordsUrl ? <a href={externalChordsUrl} target="_blank" rel="noreferrer"><Button variant="subtle"><ExternalLink className="h-4 w-4" />Acordes externos</Button></a> : null}
              {!youtubeUrl && !spotifyUrl && !externalChordsUrl ? <p className="text-sm text-ink/55">Sin enlaces de escucha registrados.</p> : null}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-ink">Comentario</h3>
            <p className="mt-3 text-sm leading-6 text-ink/62">{song.internalNotes || "Sin comentarios."}</p>
          </Card>

          {lyricsSections.length ? (
            <Card>
              <h3 className="text-lg font-bold text-ink">Letra manual opcional</h3>
              <div className="mt-4 space-y-4">
                {lyricsSections.map((section, index) => (
                  <div key={`${section.type}-${index}`} className="rounded-2xl bg-ink/5 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-brass">{section.type}</p>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-base leading-8 text-ink/75">{section.text}</pre>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <h3 className="font-bold text-ink">Datos musicales</h3>
            <dl className="mt-4 space-y-2">
              <InfoRow label="Tema principal" value={song.mainTheme} />
              <InfoRow label="Otros temas" value={(song.otherThemes || []).join(", ")} />
              <InfoRow label="Tono" value={toneSummary} />
              {Number(song.capo || 0) > 0 ? <InfoRow label="Tono base" value={song.mainKey} /> : null}
              <InfoRow label="Cambio de tono" value={song.hasKeyChange ? "Sí" : "No"} />
              <InfoRow label="Formato" value={song.format} />
              <InfoRow label="Ya se ha cantado" value={song.sungBefore ? "Sí" : "No"} />
              <InfoRow label="Última vez en la app" value={song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin registro"} />
              <InfoRow label="Indice PDF" value={song.pdfIndexStatus === "indexed" ? "PDF indexado" : song.pdfIndexStatus === "no_text" ? "Sin texto seleccionable" : song.pdfIndexStatus === "failed" ? "Error al indexar" : "PDF no indexado"} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-bold text-ink">Estado de revisión</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill label="Musical" value={song.musicReviewStatus} />
              <StatusPill label="Keynote" value={song.keynoteReviewStatus} />
              <StatusPill label="PDF" value={song.pdfReviewStatus} />
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-ink">Historial de uso</h3>
            <div className="mt-4 space-y-2">
              {usage.length ? usage.map((schedule) => (
                <div key={schedule.id} className="rounded-2xl bg-ink/5 p-3 text-sm">
                  <p className="font-semibold text-ink">{formatDate(schedule.date)}</p>
                  <p className="text-ink/55">{schedule.serviceLabel || schedule.type}</p>
                </div>
              )) : <p className="text-sm text-ink/55">Sin historial de programación.</p>}
            </div>
          </Card>
        </aside>
      </div>

      <Modal open={showPdf} title="PDF de letra y acordes" onClose={() => setShowPdf(false)} wide>
        {pdfUrl ? (
          <div className="space-y-3">
            <div className="h-[72vh] overflow-hidden rounded-2xl border border-ink/10 bg-white">
              <iframe title={`PDF ${song.title}`} src={pdfUrl} className="h-full w-full" />
            </div>
            <p className="text-sm text-ink/55">Si la vista previa no carga, abre el PDF en una pestaña nueva.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
