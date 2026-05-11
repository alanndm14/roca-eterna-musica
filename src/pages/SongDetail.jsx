import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Copy, Edit3, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate } from "../services/dateUtils";

export function SongDetail() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const { songs, schedules, duplicateSong } = useMusicData();
  const song = songs.find((item) => item.id === songId);

  if (!song) {
    return <EmptyState title="Canto no encontrado" text="Es posible que haya sido eliminado." />;
  }

  const usage = schedules
    .filter((schedule) => schedule.songs?.some((item) => item.songId === song.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <Button variant="subtle" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <Card className="bg-ink text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-4xl font-bold tracking-normal">{song.title}</h2>
            <p className="mt-2 text-white/60">{song.artist || "Sin fuente registrada"}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(song.tags || []).map((tag) => (
                <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brass">{tag}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-2xl bg-white px-4 py-3 text-2xl font-bold text-ink">{song.mainKey}</span>
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

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {(song.lyricsSections || []).map((section, index) => (
            <Card key={`${section.type}-${index}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-brass">{section.type}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-base leading-8 text-ink/75">{section.text || "Placeholder de letra."}</pre>
            </Card>
          ))}
        </div>

        <aside className="space-y-4">
          <Card>
            <h3 className="font-bold text-ink">Datos musicales</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink/50">Tempo</dt><dd className="font-semibold">{song.tempo || "Opcional"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/50">Compás</dt><dd className="font-semibold">{song.timeSignature || "Opcional"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/50">Veces usado</dt><dd className="font-semibold">{song.usageCount || usage.length || 0}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/50">Última vez</dt><dd className="font-semibold">{song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin registro"}</dd></div>
            </dl>
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
                  Acordes <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-ink">Notas internas</h3>
            <p className="mt-3 text-sm leading-6 text-ink/62">{song.internalNotes || "Sin notas."}</p>
          </Card>

          <Card>
            <h3 className="font-bold text-ink">Historial de uso</h3>
            <div className="mt-4 space-y-2">
              {usage.length ? usage.map((schedule) => (
                <div key={schedule.id} className="rounded-2xl bg-ink/5 p-3 text-sm">
                  <p className="font-semibold">{formatDate(schedule.date)}</p>
                  <p className="text-ink/55">{schedule.type}</p>
                </div>
              )) : <p className="text-sm text-ink/55">Sin historial de programación.</p>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
