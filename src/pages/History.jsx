import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { SongNameLink } from "../components/ui/SongNameLink";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getPastSchedules } from "../services/dateUtils";

export function History() {
  const { songs, schedules } = useMusicData();
  const past = getPastSchedules(schedules).filter((schedule) => schedule.status === "realizado" || schedule.date);
  const mostRepeated = [...songs].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5);
  const withoutAppHistory = songs.filter((song) => !song.lastUsedAt).slice(0, 8);
  const sungBefore = songs.filter((song) => song.sungBefore).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card>
          <h2 className="text-xl font-bold text-ink">Historial de programaciones realizadas dentro de la app</h2>
          <p className="mt-1 text-sm text-ink/55">Este historial sale de programaciones pasadas registradas aquí. No sustituye la memoria histórica de la iglesia.</p>
        </Card>
        {past.length ? past.map((schedule) => (
          <Card key={schedule.id}>
            <h2 className="text-xl font-bold text-ink">{formatDate(schedule.date)}</h2>
            <p className="mt-1 text-sm text-ink/55">{schedule.serviceLabel || schedule.type || "Servicio"} · {schedule.leader || "Sin responsable"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(schedule.songs || []).map((song, index) => (
                <span key={`${song.songId}-${index}`} className="rounded-full bg-ink/5 px-3 py-2 text-sm font-semibold text-ink">
                  <SongNameLink songId={song.songId} title={song.titleSnapshot} songs={songs}>{song.titleSnapshot}</SongNameLink> · {song.keySnapshot}
                </span>
              ))}
            </div>
          </Card>
        )) : (
          <EmptyState title="Aún no hay programaciones realizadas dentro de la app." text="Cuando marques o registres servicios pasados, aparecerán en esta sección." />
        )}
      </div>

      <aside className="space-y-4">
        <Card>
          <h3 className="font-bold text-ink">Resumen del repertorio</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-2xl bg-ink/5 p-3">
              <dt className="text-ink/55">Cantos totales</dt>
              <dd className="font-bold text-ink">{songs.length}</dd>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl bg-ink/5 p-3">
              <dt className="text-ink/55">Ya se ha cantado</dt>
              <dd className="font-bold text-ink">{sungBefore}</dd>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl bg-ink/5 p-3">
              <dt className="text-ink/55">Sin historial en la app</dt>
              <dd className="font-bold text-ink">{withoutAppHistory.length}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h3 className="font-bold text-ink">Cantos más usados</h3>
          <p className="mt-1 text-xs text-ink/45">Conteo según datos registrados en la app.</p>
          <div className="mt-4 space-y-3">
            {mostRepeated.map((song) => (
              <div key={song.id} className="flex items-center justify-between rounded-2xl bg-ink/5 p-3">
                <SongNameLink songId={song.id} title={song.title} songs={songs} className="text-sm">{song.title}</SongNameLink>
                <span className="rounded-xl bg-white px-2 py-1 text-xs font-bold text-ink">{song.usageCount || 0}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-ink">Sin fecha de último uso registrada</h3>
          <div className="mt-4 space-y-3">
            {withoutAppHistory.map((song) => (
              <div key={song.id} className="rounded-2xl bg-ink/5 p-3">
                <SongNameLink songId={song.id} title={song.title} songs={songs} className="text-sm">{song.title}</SongNameLink>
                <p className="text-xs text-ink/55">{song.sungBefore ? "Ya se ha cantado históricamente" : "Sin historial previo marcado"}</p>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
