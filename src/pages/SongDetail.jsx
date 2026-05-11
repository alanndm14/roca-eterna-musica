import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Copy, ExternalLink, FileText } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate } from "../services/dateUtils";
import { getSongPdfUrl, normalizeSong } from "../services/songUtils";

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
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${complete ? "bg-brass/15 text-brass" : "bg-ink/7 text-ink/60"}`}>
      {label}: {value || "pendiente"}
    </span>
  );
}

export function SongDetail() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const { songs, schedules, duplicateSong, settings } = useMusicData();
  const [showPdf, setShowPdf] = useState(false);
  const song = normalizeSong(songs.find((item) => item.id === songId), settings.keyPreference || "sharps");

  if (!song?.id) {
    return <EmptyState title="Canto no encontrado" text="Es posible que haya sido eliminado." />;
  }

  const pdfUrl = getSongPdfUrl(song);
  const usage = schedules
    .filter((schedule) => schedule.songs?.some((item) => item.songId === song.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const copyPdf = async () => {
    if (!pdfUrl) return;
    await navigator.clipboard?.writeText(pdfUrl);
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
                <Link to="/programacion">
                  <Button variant="light">
                    <CalendarPlus className="h-4 w-4" />
                    Agregar a programación
                  </Button>
                </Link>
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
                  <Button>
                    <ExternalLink className="h-4 w-4" />
                    Abrir PDF
                  </Button>
                </a>
                <Button variant="secondary" onClick={copyPdf}>
                  <Copy className="h-4 w-4" />
                  Copiar link
                </Button>
                <Button variant="subtle" onClick={() => setShowPdf(true)}>
                  Ver dentro de la app
                </Button>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-ink/5 p-4 text-sm text-ink/58">
                Este canto todavía no tiene PDF registrado.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-ink">Comentario</h3>
            <p className="mt-3 text-sm leading-6 text-ink/62">{song.internalNotes || "Sin comentarios."}</p>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-ink">Letra manual opcional</h3>
            <p className="mt-1 text-sm text-ink/55">Esta sección queda como respaldo. El flujo principal usa el PDF.</p>
            <div className="mt-4 space-y-4">
              {(song.lyricsSections || []).length ? (song.lyricsSections || []).map((section, index) => (
                <div key={`${section.type}-${index}`} className="rounded-2xl bg-ink/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-brass">{section.type}</p>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-base leading-8 text-ink/75">{section.text || "Placeholder de letra."}</pre>
                </div>
              )) : <p className="text-sm text-ink/55">Sin letra manual registrada.</p>}
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <h3 className="font-bold text-ink">Datos del canto</h3>
            <dl className="mt-4 space-y-2">
              <InfoRow label="Tema principal" value={song.mainTheme} />
              <InfoRow label="Otros temas" value={(song.otherThemes || []).join(", ")} />
              <InfoRow label="Tono principal" value={song.mainKey} />
              <InfoRow label="Capo" value={String(song.capo ?? 0)} />
              <InfoRow label="Tono con capo" value={song.keyWithCapo} />
              <InfoRow label="Cambio de tono" value={song.hasKeyChange ? "Sí" : "No"} />
              <InfoRow label="Formato" value={song.format} />
              <InfoRow label="Ya se ha cantado" value={song.sungBefore ? "Sí" : "No"} />
              <InfoRow label="Última vez" value={song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin registro"} />
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
            <h3 className="font-bold text-ink">Enlaces</h3>
            <div className="mt-4 space-y-2">
              {song.youtubeUrl ? (
                <a className="flex items-center justify-between rounded-2xl bg-ink/5 p-3 text-sm font-semibold" href={song.youtubeUrl} target="_blank" rel="noreferrer">
                  YouTube <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
              {song.chordsUrl ? (
                <a className="flex items-center justify-between rounded-2xl bg-ink/5 p-3 text-sm font-semibold" href={song.chordsUrl} target="_blank" rel="noreferrer">
                  PDF de letra y acordes <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-ink">Historial de uso</h3>
            <div className="mt-4 space-y-2">
              {usage.length ? usage.map((schedule) => (
                <div key={schedule.id} className="rounded-2xl bg-ink/5 p-3 text-sm">
                  <p className="font-semibold">{formatDate(schedule.date)}</p>
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
              <iframe
                title={`PDF ${song.title}`}
                src={pdfUrl}
                className="h-full w-full"
                onError={() => undefined}
              />
            </div>
            <p className="text-sm text-ink/55">
              No se pudo cargar la vista previa. Abre el PDF en una pestaña nueva.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
