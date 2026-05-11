import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getPastSchedules } from "../services/dateUtils";

export function History() {
  const { songs, schedules } = useMusicData();
  const past = getPastSchedules(schedules);
  const mostRepeated = [...songs].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5);
  const leastRecent = [...songs].sort((a, b) => (a.lastUsedAt || "1900").localeCompare(b.lastUsedAt || "1900")).slice(0, 5);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {past.length ? past.map((schedule) => (
          <Card key={schedule.id}>
            <h2 className="text-xl font-bold text-ink">{formatDate(schedule.date)}</h2>
            <p className="mt-1 text-sm text-ink/55">{schedule.type} · {schedule.leader || "Sin responsable"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(schedule.songs || []).map((song, index) => (
                <span key={`${song.songId}-${index}`} className="rounded-full bg-ink/5 px-3 py-2 text-sm font-semibold text-ink">
                  {song.titleSnapshot} · {song.keySnapshot}
                </span>
              ))}
            </div>
          </Card>
        )) : <EmptyState title="Sin historial todavía" text="Las programaciones pasadas aparecerán en esta sección." />}
      </div>

      <aside className="space-y-4">
        <Card>
          <h3 className="font-bold text-ink">Cantos más repetidos</h3>
          <div className="mt-4 space-y-3">
            {mostRepeated.map((song) => (
              <div key={song.id} className="flex items-center justify-between rounded-2xl bg-ink/5 p-3">
                <span className="text-sm font-semibold">{song.title}</span>
                <span className="rounded-xl bg-white px-2 py-1 text-xs font-bold">{song.usageCount || 0}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-ink">No usados recientemente</h3>
          <div className="mt-4 space-y-3">
            {leastRecent.map((song) => (
              <div key={song.id} className="rounded-2xl bg-ink/5 p-3">
                <p className="text-sm font-semibold">{song.title}</p>
                <p className="text-xs text-ink/55">{song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin uso registrado"}</p>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
