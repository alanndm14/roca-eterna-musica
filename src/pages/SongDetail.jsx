import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, CheckCircle, Copy, Edit3, ExternalLink, FileText, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { FileDiagnosticPanel } from "../components/ui/FileDiagnosticPanel";
import { Modal } from "../components/ui/Modal";
import { SongGithubPdfManager } from "../components/song/SongGithubPdfManager";
import { SongCoverBackdrop, SongCoverImage, songCoverAccentStyle } from "../components/song/SongCoverArtwork";
import { SongCoverManager } from "../components/song/SongCoverManager";
import { SongExternalLinks } from "../components/ui/SongExternalLinks";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, formatScheduleDateWithService, getCurrentOrNextSchedule, getPastSchedules, getServiceDisplayLabel } from "../services/dateUtils";
import { testPublicPdfPath } from "../services/publicPdfTools";
import {
  getSongExternalChordsUrl,
  getSongPdfUrl,
  getSongSpotifyUrl,
  getSongYoutubeUrl,
  collectSongThemes,
  getSongCategoryOptions,
  normalizeSong
} from "../services/songUtils";
import { SongForm } from "./Songs";
import { shouldShowMusicalKeyForUser } from "../services/memberPresentation";

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
  const { canEdit, canDelete, profile } = useAuth();
  const isViewer = profile?.role === "viewer";
  const { songs, schedules, plannedNewSongs = [], themes, duplicateSong, deleteSong, saveSchedule, saveSong, settings, logAuditEvent } = useMusicData();
  const [showPdf, setShowPdf] = useState(false);
  const [pdfTest, setPdfTest] = useState(null);
  const [editingSong, setEditingSong] = useState(false);
  const song = normalizeSong(songs.find((item) => item.id === songId), settings.keyPreference || "sharps");
  const showMusicalKey = shouldShowMusicalKeyForUser(profile);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [songId]);

  if (!song?.id) return <EmptyState title="Canto no encontrado" text="Es posible que haya sido eliminado." />;

  const pdfUrl = getSongPdfUrl(song);
  const youtubeUrl = getSongYoutubeUrl(song);
  const spotifyUrl = getSongSpotifyUrl(song);
  const externalChordsUrl = getSongExternalChordsUrl(song);
  const lyricsSections = (song.lyricsSections || []).filter((section) => section.text?.trim());
  const themeOptions = collectSongThemes(songs, themes);
  const usage = getPastSchedules(schedules)
    .filter((schedule) => !schedule.deleted && schedule.songs?.some((item) => item.songId === song.id))
    .sort((a, b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`));
  const toneSummary = Number(song.capo || 0) > 0
    ? `Capo ${song.capo} · Suena en ${song.keyWithCapo || song.mainKey || "--"}`
    : `Sin capo · Tono ${song.mainKey || song.keyWithCapo || "--"}`;
  const plannedEntries = (Array.isArray(plannedNewSongs) ? plannedNewSongs : [])
    .filter((item) => item.songId === song.id)
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));
  const activePlannedEntries = plannedEntries.filter((item) => ["planeado", "listo", "pospuesto"].includes(item.status));
  const introducedEntry = plannedEntries.find((item) => item.status === "estrenado");
  const filterByArtist = (artist) => {
    const value = String(artist || "").trim();
    if (!value) return;
    navigate(`/repertorio?artist=${encodeURIComponent(value)}`);
  };

  const copyPdf = async () => {
    if (pdfUrl) await navigator.clipboard?.writeText(pdfUrl);
  };

  const scheduleSongEntry = () => ({
    songId: song.id,
    titleSnapshot: song.title,
    keySnapshot: song.keyWithCapo || song.mainKey || "",
    pdfUrl,
    notes: song.internalNotes || ""
  });

  const nextNormalService = () => {
    const options = [];
    const now = new Date();
    for (let offset = 0; offset < 14; offset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() + offset);
      const weekday = date.getDay();
      const day = date.toISOString().slice(0, 10);
      if (weekday === 3) options.push({ date: day, serviceType: "miercoles-oracion", serviceLabel: "Miércoles de oración", time: "19:00" });
      if (weekday === 0) {
        options.push({ date: day, serviceType: "domingo-manana", serviceLabel: "Domingo mañana", time: "11:00" });
        options.push({ date: day, serviceType: "domingo-tarde", serviceLabel: "Domingo tarde", time: "17:00" });
      }
    }
    return options.find((option) => new Date(`${option.date}T${option.time}`) > now) || options[0];
  };

  const addToNextSchedule = async () => {
    const nextSchedule = getCurrentOrNextSchedule(schedules);
    if (nextSchedule) {
      if ((nextSchedule.songs || []).some((item) => item.songId === song.id)) {
        alert("Este canto ya está en la siguiente programación.");
        return;
      }
      const label = `${getServiceDisplayLabel(nextSchedule)} · ${formatDate(nextSchedule.date)} · ${nextSchedule.time || ""}`;
      if (!confirm(`Agregar este canto a la siguiente programación: ${label}`)) return;
      await saveSchedule({ ...nextSchedule, songs: [...(nextSchedule.songs || []), scheduleSongEntry()] });
      await logAuditEvent?.({
        actionType: "update",
        entityType: "schedule",
        entityId: nextSchedule.id,
        entityName: nextSchedule.serviceLabel || nextSchedule.date,
        summary: `Canto agregado a programación: ${song.title}`
      });
      alert("Canto agregado a la siguiente programación.");
      return;
    }

    const service = nextNormalService();
    if (!confirm(`No hay programaciones futuras. ¿Crear ${service.serviceLabel} para ${formatDate(service.date)} con este canto incluido?`)) return;
    await saveSchedule({
      ...service,
      type: service.serviceLabel,
      leader: "",
      songs: [scheduleSongEntry()],
      generalNotes: "",
      status: "confirmed"
    });
    alert("Se creó la siguiente programación normal con este canto incluido.");
    navigate("/programacion");
  };

  const removeCurrentSong = async () => {
    if (!confirm(`¿Eliminar este canto del repertorio?\n\nEsta acción quitará "${song.title}" del repertorio y de futuras selecciones. El historial de programaciones pasadas conservará el nombre guardado.`)) return;
    try {
      await deleteSong(song.id);
      alert("Canto eliminado del repertorio.");
      navigate("/repertorio");
    } catch (error) {
      alert(error?.message || "No se pudo eliminar el canto.");
    }
  };

  return (
    <div className="space-y-5">
      <Button variant="subtle" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <Card className="relative overflow-hidden bg-white text-ink dark:bg-zinc-950 dark:text-white" style={songCoverAccentStyle(song)}>
        <SongCoverBackdrop song={song} />
        <div className="relative z-[1] flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <SongCoverImage song={song} wrapperClassName="h-24 w-24 rounded-3xl border border-white/15 shadow-2xl sm:h-32 sm:w-32" />
            <div className="min-w-0">
            {!isViewer ? <p className="text-sm font-semibold uppercase tracking-wide text-brass">{song.category || "normal"}</p> : null}
            <h2 className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">{song.title}</h2>
            {song.artistOrSource ? (
              <button
                type="button"
                className="mt-2 block text-left font-semibold text-ink/60 underline-offset-2 transition hover:text-brass hover:underline dark:text-white/65 dark:hover:text-brass"
                onClick={() => filterByArtist(song.artistOrSource)}
              >
                {song.artistOrSource}
              </button>
            ) : (
              <p className="mt-2 text-ink/60 dark:text-white/65">Sin artista registrado</p>
            )}
            {!isViewer ? <div className="mt-5 flex flex-wrap gap-2">
              {song.mainTheme ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brass">{song.mainTheme}</span> : null}
              {(song.otherThemes || []).map((theme) => (
                <span key={theme} className="rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/70 dark:bg-white/10 dark:text-white/70">{theme}</span>
              ))}
            </div> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {showMusicalKey ? <span className="rounded-2xl bg-ink px-4 py-3 text-2xl font-bold text-white dark:bg-white dark:text-ink">{song.mainKey || "--"}</span> : null}
            {canEdit ? (
              <>
                <Button variant="light" onClick={() => setEditingSong(true)}>
                  <Edit3 className="h-4 w-4" />
                  Editar canto
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <>
                <Button variant="danger" onClick={removeCurrentSong}>
                  <Trash2 className="h-4 w-4" />
                  Eliminar canto
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Card>

      {canEdit ? <SongCoverManager song={song} /> : null}

      <div className={`grid gap-5 ${isViewer ? "" : "xl:grid-cols-[1fr_380px]"}`}>
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-ink">PDF de letra y acordes</h3>
              </div>
              <FileText className="h-8 w-8 text-brass" />
            </div>
            {pdfUrl ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <Button><ExternalLink className="h-4 w-4" />Abrir PDF</Button>
                </a>
                {!isViewer ? <Button variant="secondary" onClick={copyPdf}><Copy className="h-4 w-4" />Copiar link</Button> : null}
                <Button variant="subtle" onClick={() => setShowPdf(true)}>Ver dentro de la app</Button>
                {song.localPdfPath && !isViewer ? (
                  <Button variant="secondary" onClick={async () => setPdfTest(await testPublicPdfPath(song.localPdfPath, song.pdfVersion))}>
                    <CheckCircle className="h-4 w-4" />
                    Diagnosticar archivo
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-ink/5 p-4 text-sm text-ink/58">Este canto todavía no tiene PDF registrado.</p>
            )}
            {!isViewer ? <FileDiagnosticPanel result={pdfTest} /> : null}
            {canEdit ? <SongGithubPdfManager song={song} /> : null}
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-ink">Escucha y enlaces</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <SongExternalLinks youtubeUrl={youtubeUrl} spotifyUrl={spotifyUrl} songTitle={song.title} compact={false} />
              {externalChordsUrl ? <a href={externalChordsUrl} target="_blank" rel="noreferrer"><Button variant="subtle"><ExternalLink className="h-4 w-4" />Acordes externos</Button></a> : null}
              {!youtubeUrl && !spotifyUrl && !externalChordsUrl ? <p className="text-sm text-ink/55">Sin enlaces de escucha registrados.</p> : null}
            </div>
          </Card>

          {!isViewer ? <Card>
            <h3 className="text-lg font-bold text-ink">Comentario</h3>
            <p className="mt-3 text-sm leading-6 text-ink/62">{song.internalNotes || "Sin comentarios."}</p>
          </Card> : null}

          {activePlannedEntries.length || introducedEntry ? (
            <Card>
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-brass" />
                <h3 className="text-lg font-bold text-ink">{activePlannedEntries.length ? "Canto nuevo planeado" : "Canto estrenado"}</h3>
              </div>
              <div className="mt-4 space-y-2">
                {(activePlannedEntries.length ? activePlannedEntries : [introducedEntry]).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-brass/10 p-3 text-sm">
                    <p className="font-bold text-ink">{item.status === "estrenado" ? `Estrenado el ${formatDate(item.plannedDate)}` : formatDate(item.plannedDate)}</p>
                    <p className="mt-1 capitalize text-ink/60">{String(item.serviceType || "").replaceAll("_", " ")} · {item.status}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

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

        {!isViewer ? <aside className="space-y-4">
          <Card>
            <h3 className="font-bold text-ink">Datos musicales</h3>
            <dl className="mt-4 space-y-2">
              <InfoRow label="Tema principal" value={song.mainTheme} />
              <InfoRow label="Otros temas" value={(song.otherThemes || []).join(", ")} />
              {showMusicalKey ? <InfoRow label="Tono" value={toneSummary} /> : null}
              {Number(song.capo || 0) > 0 ? <InfoRow label="Tono base" value={song.mainKey} /> : null}
              <InfoRow label="Cambio de tono" value={song.hasKeyChange ? "Sí" : "No"} />
              <InfoRow label="Formato" value={song.format} />
              <InfoRow label="Ya se ha cantado" value={song.sungBefore ? "Sí" : "No"} />
              <InfoRow label="Última vez en la app" value={usage[0] ? formatScheduleDateWithService(usage[0]) : song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin registro"} />
              <InfoRow label="Índice PDF" value={song.pdfIndexStatus === "indexed" ? "PDF indexado" : song.pdfIndexStatus === "no_text" ? "Sin texto seleccionable" : song.pdfIndexStatus === "failed" ? "Error al indexar" : "PDF no indexado"} />
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
                  <p className="font-semibold text-ink">{formatScheduleDateWithService(schedule)}</p>
                  <p className="text-ink/55">{schedule.time || "Sin hora"} · {schedule.leader || "Sin líder de adoración"}</p>
                </div>
              )) : <p className="text-sm text-ink/55">Sin historial de programación.</p>}
            </div>
          </Card>
        </aside> : null}
      </div>

      <Modal
        open={showPdf}
        title="PDF de letra y acordes"
        onClose={() => setShowPdf(false)}
        wide
        centered
        panelClassName="flex h-[min(94dvh,920px)] flex-col"
        contentClassName="min-h-0 flex-1"
      >
        {pdfUrl ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-inner dark:border-white/15 dark:bg-black">
              <iframe
                title={`PDF ${song.title}`}
                src={pdfUrl}
                className="h-full min-h-[55dvh] w-full touch-pan-y"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-[env(safe-area-inset-bottom)]">
              <p className="text-xs text-ink/55 dark:text-white/60 sm:text-sm">Puedes deslizar el documento dentro de esta ventana.</p>
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary"><ExternalLink className="h-4 w-4" />Abrir en otra pestaña</Button>
              </a>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={editingSong} title="Editar canto" onClose={() => setEditingSong(false)} wide>
        <SongForm
            initialSong={song}
            themes={themeOptions}
            categoryOptions={getSongCategoryOptions(settings, songs, song.category)}
          keyPreference={settings.keyPreference || "sharps"}
          onCancel={() => setEditingSong(false)}
          onSubmit={async (updatedSong) => {
            await saveSong({ ...updatedSong, id: song.id });
            setEditingSong(false);
          }}
        />
      </Modal>
    </div>
  );
}
