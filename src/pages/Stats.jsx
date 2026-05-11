import { BarChart3, FileCheck2, Music2, Presentation } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate } from "../services/dateUtils";

const chartColors = ["#b6945f", "#60717d", "#242424", "#d7c7a7", "#8e989f", "#b8b0a4"];

const percent = (count, total) => (total ? Math.round((count / total) * 100) : 0);

const countBy = (items, getter) =>
  items.reduce((acc, item) => {
    const values = getter(item);
    values.forEach((value) => {
      if (!value) return;
      acc[value] = (acc[value] || 0) + 1;
    });
    return acc;
  }, {});

const toChartData = (data) =>
  Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

function ChartCard({ title, children }) {
  return (
    <Card>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-5 h-72">{children}</div>
    </Card>
  );
}

function BarGraph({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,17,17,0.08)" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieGraph({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
          {data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Stats() {
  const { songs, schedules } = useMusicData();
  const byTheme = toChartData(countBy(songs, (song) => [song.mainTheme, ...(song.otherThemes || [])]));
  const byKey = toChartData(countBy(songs, (song) => [song.mainKey, song.keyWithCapo]));
  const byMonth = toChartData(countBy(schedules, (schedule) => [schedule.date?.slice(0, 7)]));
  const byCategory = toChartData(countBy(songs, (song) => [song.category || "normal"]));
  const reviewData = [
    { name: "PDF completado", value: songs.filter((song) => song.pdfReviewStatus === "completado").length },
    { name: "Keynote completado", value: songs.filter((song) => song.keynoteReviewStatus === "completado").length },
    { name: "Música completada", value: songs.filter((song) => song.musicReviewStatus === "completado").length },
    { name: "Pendientes PDF", value: songs.filter((song) => song.pdfReviewStatus !== "completado").length }
  ];
  const mostUsed = [...songs].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 8);
  const leastRecent = [...songs].sort((a, b) => (a.lastUsedAt || "1900").localeCompare(b.lastUsedAt || "1900")).slice(0, 8);
  const total = songs.length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Music2} label="Total de cantos" value={total} />
        <StatCard icon={FileCheck2} label="PDF completado" value={`${percent(songs.filter((song) => song.pdfReviewStatus === "completado").length, total)}%`} delay={0.05} />
        <StatCard icon={Presentation} label="Keynote completado" value={`${percent(songs.filter((song) => song.keynoteReviewStatus === "completado").length, total)}%`} delay={0.1} />
        <StatCard icon={BarChart3} label="Revisión musical" value={`${percent(songs.filter((song) => song.musicReviewStatus === "completado").length, total)}%`} delay={0.15} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Cantos por tema">
          <BarGraph data={byTheme} />
        </ChartCard>
        <ChartCard title="Cantos por tonalidad">
          <BarGraph data={byKey} />
        </ChartCard>
        <ChartCard title="Uso mensual del repertorio">
          <BarGraph data={byMonth} />
        </ChartCard>
        <ChartCard title="Estados de revisión">
          <PieGraph data={reviewData} />
        </ChartCard>
        <ChartCard title="Categorías">
          <PieGraph data={byCategory} />
        </ChartCard>
        <Card>
          <h2 className="text-lg font-bold text-ink">Tablas útiles</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-bold text-ink/55">Cantos más usados</p>
              {mostUsed.map((song) => (
                <div key={song.id} className="mb-2 flex justify-between rounded-2xl bg-ink/5 p-3 text-sm">
                  <span className="font-semibold">{song.title}</span>
                  <span>{song.usageCount || 0}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-ink/55">No usados recientemente</p>
              {leastRecent.map((song) => (
                <div key={song.id} className="mb-2 rounded-2xl bg-ink/5 p-3 text-sm">
                  <p className="font-semibold">{song.title}</p>
                  <p className="text-ink/55">{song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin uso registrado"}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
