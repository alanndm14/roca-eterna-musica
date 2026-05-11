import { BarChart3, Music2, Tags } from "lucide-react";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useMusicData } from "../hooks/useMusicData";

const countBy = (items, getter) =>
  items.reduce((acc, item) => {
    const values = getter(item);
    values.forEach((value) => {
      if (!value) return;
      acc[value] = (acc[value] || 0) + 1;
    });
    return acc;
  }, {});

function Bars({ data }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <div className="space-y-3">
      {entries.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold text-ink">{label}</span>
            <span className="text-ink/55">{value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-ink/7">
            <div className="h-full rounded-full bg-brass" style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Stats() {
  const { songs, schedules } = useMusicData();
  const byTag = countBy(songs, (song) => song.tags || []);
  const byKey = countBy(songs, (song) => [song.mainKey]);
  const byMonth = countBy(schedules, (schedule) => [schedule.date?.slice(0, 7)]);
  const mostUsed = [...songs].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5);
  const leastUsed = [...songs].sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0)).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Music2} label="Total de cantos" value={songs.length} />
        <StatCard icon={BarChart3} label="Programaciones" value={schedules.length} delay={0.05} />
        <StatCard icon={Tags} label="Temas usados" value={Object.keys(byTag).length} delay={0.1} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-ink">Cantos por tema</h2>
          <div className="mt-5"><Bars data={byTag} /></div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink">Cantos por tono</h2>
          <div className="mt-5"><Bars data={byKey} /></div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink">Actividad mensual</h2>
          <div className="mt-5"><Bars data={byMonth} /></div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink">Uso del repertorio</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-bold text-ink/55">Más usados</p>
              {mostUsed.map((song) => <p key={song.id} className="mb-2 rounded-2xl bg-ink/5 p-3 text-sm font-semibold">{song.title} · {song.usageCount || 0}</p>)}
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-ink/55">Menos usados</p>
              {leastUsed.map((song) => <p key={song.id} className="mb-2 rounded-2xl bg-ink/5 p-3 text-sm font-semibold">{song.title} · {song.usageCount || 0}</p>)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
