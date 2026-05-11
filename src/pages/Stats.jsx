import { useMemo, useState } from "react";
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
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, todayString } from "../services/dateUtils";
import { normalizeThemeName } from "../services/songUtils";

const chartColors = ["#b6945f", "#60717d", "#8e989f", "#d7c7a7", "#242424", "#b8b0a4"];
const reviewColors = { pendiente: "#8e989f", "en revisión": "#d7c7a7", completado: "#b6945f" };
const percent = (count, total) => (total ? Math.round((count / total) * 100) : 0);

const countBy = (items, getter) =>
  items.reduce((acc, item) => {
    getter(item).forEach((value) => {
      if (!value) return;
      const key = value;
      acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }, {});

const toChartData = (data) =>
  Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

const topWithOthers = (data, limit = 10) => {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((sum, item) => sum + item.value, 0);
  return rest ? [...top, { name: "Otros", value: rest }] : top;
};

const lastSixMonths = (schedules) => {
  const now = new Date(`${todayString()}T00:00:00`);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = date.toISOString().slice(0, 7);
    return { key, name: new Intl.DateTimeFormat("es-MX", { month: "short" }).format(date), value: 0 };
  });
  const byKey = new Map(months.map((month) => [month.key, month]));
  schedules
    .filter((schedule) => schedule.date <= todayString() || schedule.status === "realizado")
    .forEach((schedule) => {
      const key = schedule.date?.slice(0, 7);
      if (byKey.has(key)) byKey.get(key).value += schedule.songs?.length || 0;
    });
  return months;
};

function ChartCard({ title, children, aside }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {aside}
      </div>
      <div className="mt-5 h-72">{children}</div>
    </Card>
  );
}

function BarGraph({ data, horizontal = false }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={horizontal ? { left: 40, right: 12, top: 8, bottom: 8 } : { left: 0, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,152,159,0.22)" />
        {horizontal ? (
          <>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "currentColor" }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "currentColor" }} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "currentColor" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "currentColor" }} />
          </>
        )}
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(142,152,159,.25)" }} />
        <Bar dataKey="value" radius={horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]}>
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

function ReviewGraph({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,152,159,0.22)" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "currentColor" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "currentColor" }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="pendiente" stackId="estado" fill={reviewColors.pendiente} radius={[8, 8, 0, 0]} />
        <Bar dataKey="en revisión" stackId="estado" fill={reviewColors["en revisión"]} />
        <Bar dataKey="completado" stackId="estado" fill={reviewColors.completado} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Stats() {
  const { songs, schedules } = useMusicData();
  const [keyMode, setKeyMode] = useState("main");
  const byTheme = topWithOthers(toChartData(countBy(songs, (song) => [song.mainTheme, ...(song.otherThemes || [])].map(normalizeThemeName))), 10);
  const byKey = toChartData(countBy(songs, (song) => [keyMode === "main" ? song.mainKey : song.keyWithCapo]));
  const byMonth = lastSixMonths(schedules);
  const byCategory = toChartData(countBy(songs, (song) => [song.category || "normal"]));
  const reviewData = useMemo(() => (
    [
      ["PDF", "pdfReviewStatus"],
      ["Keynote", "keynoteReviewStatus"],
      ["Musical", "musicReviewStatus"]
    ].map(([name, field]) => ({
      name,
      pendiente: songs.filter((song) => (song[field] || "pendiente") === "pendiente").length,
      "en revisión": songs.filter((song) => song[field] === "en revisión").length,
      completado: songs.filter((song) => song[field] === "completado").length
    }))
  ), [songs]);
  const mostUsed = [...songs].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 8);
  const leastRecent = [...songs].filter((song) => !song.lastUsedAt).slice(0, 8);
  const total = songs.length;
  const pdfDone = songs.filter((song) => song.pdfReviewStatus === "completado").length;
  const keynoteDone = songs.filter((song) => song.keynoteReviewStatus === "completado").length;
  const musicDone = songs.filter((song) => song.musicReviewStatus === "completado").length;
  const sparseUsage = schedules.filter((schedule) => schedule.date <= todayString() || schedule.status === "realizado").length < 3;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Music2} label="Total de cantos" value={total} />
        <StatCard icon={FileCheck2} label="PDF completado" value={`${percent(pdfDone, total)}%`} detail={`${pdfDone} de ${total}`} delay={0.05} />
        <StatCard icon={Presentation} label="Keynote completado" value={`${percent(keynoteDone, total)}%`} detail={`${keynoteDone} de ${total}`} delay={0.1} />
        <StatCard icon={BarChart3} label="Revisión musical" value={`${percent(musicDone, total)}%`} detail={`${musicDone} de ${total}`} delay={0.15} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Cantos por tema">
          <BarGraph data={byTheme} horizontal />
        </ChartCard>
        <ChartCard
          title="Cantos por tonalidad"
          aside={
            <div className="flex rounded-xl bg-ink/5 p-1">
              <Button variant={keyMode === "main" ? "primary" : "subtle"} className="min-h-8 px-3 py-1 text-xs" onClick={() => setKeyMode("main")}>Principal</Button>
              <Button variant={keyMode === "capo" ? "primary" : "subtle"} className="min-h-8 px-3 py-1 text-xs" onClick={() => setKeyMode("capo")}>Tonalidad con capo</Button>
            </div>
          }
        >
          <BarGraph data={byKey} />
        </ChartCard>
        <ChartCard title="Uso mensual del repertorio">
          <BarGraph data={byMonth} />
        </ChartCard>
        <ChartCard title="Estados de revisión">
          <ReviewGraph data={reviewData} />
        </ChartCard>
        <ChartCard title="Categorías">
          <PieGraph data={byCategory} />
        </ChartCard>
        <Card>
          <h2 className="text-lg font-bold text-ink">Tablas útiles</h2>
          {sparseUsage ? (
            <p className="mt-2 rounded-2xl bg-brass/12 p-3 text-sm font-semibold text-brass">
              Esta gráfica se volverá más útil conforme registres más programaciones.
            </p>
          ) : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-bold text-ink/55">Cantos más usados</p>
              {mostUsed.map((song) => (
                <div key={song.id} className="mb-2 flex justify-between rounded-2xl bg-ink/5 p-3 text-sm">
                  <span className="font-semibold text-ink">{song.title}</span>
                  <span className="text-ink">{song.usageCount || 0}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-ink/55">Sin historial en la app</p>
              {leastRecent.map((song) => (
                <div key={song.id} className="mb-2 rounded-2xl bg-ink/5 p-3 text-sm">
                  <p className="font-semibold text-ink">{song.title}</p>
                  <p className="text-ink/55">{song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin fecha de último uso registrada"}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
