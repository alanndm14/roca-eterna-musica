import { useEffect, useMemo, useState } from "react";
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
import { Select } from "../components/ui/Field";
import { SongNameLink, findSongForNavigation } from "../components/ui/SongNameLink";
import { StatCard } from "../components/ui/StatCard";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate } from "../services/dateUtils";
import { collectSongThemes, getSongPdfUrl, normalizeThemeName, stripAccents } from "../services/songUtils";

const chartColors = ["#b6945f", "#60717d", "#8e989f", "#d7c7a7", "#6e6251", "#b8b0a4"];
const reviewColors = { pendiente: "#8e989f", "en revisión": "#d7c7a7", completado: "#b6945f" };
const percent = (count, total) => (total ? Math.round((count / total) * 100) : 0);

const countBy = (items, getter) =>
  items.reduce((acc, item) => {
    getter(item).forEach((value) => {
      if (!value) return;
      acc[value] = (acc[value] || 0) + 1;
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

const normalizeReviewValue = (value) => {
  const normalized = stripAccents(value || "pendiente").trim().toLowerCase();
  if (["revision", "en revision", "revisando"].includes(normalized)) return "en revisión";
  if (["completo", "completado", "done", "listo", "terminado"].includes(normalized)) return "completado";
  return "pendiente";
};

function useChartTheme() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark
    ? {
        axis: "#d6d3ca",
        muted: "rgba(245, 242, 235, 0.16)",
        tooltipBg: "#242424",
        tooltipText: "#f5f2eb",
        tooltipBorder: "rgba(245, 242, 235, 0.18)"
      }
    : {
        axis: "#4b4b4b",
        muted: "rgba(142, 152, 159, 0.25)",
        tooltipBg: "#ffffff",
        tooltipText: "#171717",
        tooltipBorder: "rgba(142, 152, 159, 0.28)"
      };
}

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

function chartTooltip(theme) {
  return {
    contentStyle: {
      borderRadius: 12,
      border: `1px solid ${theme.tooltipBorder}`,
      background: theme.tooltipBg,
      color: theme.tooltipText,
      boxShadow: "0 20px 50px rgba(0,0,0,.18)"
    },
    labelStyle: { color: theme.tooltipText, fontWeight: 700 },
    itemStyle: { color: theme.tooltipText }
  };
}

function BarGraph({ data, horizontal = false, theme }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={horizontal ? { left: 42, right: 12, top: 8, bottom: 8 } : { left: 0, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} />
        {horizontal ? (
          <>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
            <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
          </>
        )}
        <Tooltip {...chartTooltip(theme)} />
        <Bar dataKey="value" radius={horizontal ? [0, 8, 8, 0] : [8, 8, 0, 0]}>
          {data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieGraph({ data, theme }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
          {data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
        </Pie>
        <Tooltip {...chartTooltip(theme)} />
        <Legend wrapperStyle={{ color: theme.axis }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ReviewGraph({ data, theme }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
        <Tooltip {...chartTooltip(theme)} />
        <Legend wrapperStyle={{ color: theme.axis }} />
        <Bar dataKey="pendiente" stackId="estado" fill={reviewColors.pendiente} radius={[8, 8, 0, 0]} />
        <Bar dataKey="en revisión" stackId="estado" fill={reviewColors["en revisión"]} />
        <Bar dataKey="completado" stackId="estado" fill={reviewColors.completado} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SongTable({ rows, songs, columns }) {
  return (
    <div className="overflow-auto rounded-2xl border border-ink/10 bg-white">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-ink/5 text-xs uppercase tracking-wide text-ink/55">
          <tr>{columns.map((column) => <th key={column.key} className="p-3">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((song) => (
            <tr key={song.id} className="border-t border-ink/10">
              {columns.map((column) => (
                <td key={`${song.id}-${column.key}`} className="p-3 text-ink/65">
                  {column.key === "title" ? (
                    <SongNameLink songId={song.id} title={song.title} songs={songs}>{song.title}</SongNameLink>
                  ) : column.render ? column.render(song) : song[column.key] || "--"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stats() {
  const { songs, schedules, themes } = useMusicData();
  const chartTheme = useChartTheme();
  const [view, setView] = useState("musicians");
  const [keyMode, setKeyMode] = useState("main");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");

  const categories = useMemo(() => [...new Set(songs.map((song) => song.category || "normal"))].sort((a, b) => a.localeCompare(b, "es")), [songs]);
  const themeOptions = useMemo(() => collectSongThemes(songs, themes), [songs, themes]);
  const filteredSongs = useMemo(() => songs.filter((song) => {
    const songThemes = [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].map(normalizeThemeName);
    return (!categoryFilter || (song.category || "normal") === categoryFilter) && (!themeFilter || songThemes.includes(normalizeThemeName(themeFilter)));
  }), [categoryFilter, songs, themeFilter]);

  const byTheme = topWithOthers(toChartData(countBy(filteredSongs, (song) => [song.mainTheme, ...(song.otherThemes || [])].map(normalizeThemeName))), 10);
  const byKey = toChartData(countBy(filteredSongs, (song) => [keyMode === "main" ? song.mainKey : song.keyWithCapo]));
  const byCapo = toChartData(countBy(filteredSongs, (song) => [`Capo ${Number(song.capo || 0)}`])).sort((a, b) => Number(a.name.replace("Capo ", "")) - Number(b.name.replace("Capo ", "")));
  const byCategory = toChartData(countBy(filteredSongs, (song) => [song.category || "normal"]));
  const reviewData = useMemo(() => (
    [
      ["PDF", "pdfReviewStatus"],
      ["Keynote", "keynoteReviewStatus"],
      ["Musical", "musicReviewStatus"]
    ].map(([name, field]) => ({
      name,
      pendiente: filteredSongs.filter((song) => normalizeReviewValue(song[field]) === "pendiente").length,
      "en revisión": filteredSongs.filter((song) => normalizeReviewValue(song[field]) === "en revisión").length,
      completado: filteredSongs.filter((song) => normalizeReviewValue(song[field]) === "completado").length
    }))
  ), [filteredSongs]);

  const programmedSongEntries = schedules.flatMap((schedule) => (schedule.songs || []).map((entry) => ({ ...entry, schedule })));
  const programmedThemes = toChartData(countBy(programmedSongEntries, (entry) => {
    const song = findSongForNavigation({ songId: entry.songId, title: entry.titleSnapshot, songs });
    return song ? [song.mainTheme, ...(song.otherThemes || [])].map(normalizeThemeName) : [];
  }));
  const mostUsed = [...filteredSongs].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 10);
  const leastUsed = [...filteredSongs]
    .sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0) || (a.lastUsedAt || "0000").localeCompare(b.lastUsedAt || "0000"))
    .slice(0, 12);
  const rotationSuggestions = filteredSongs
    .filter((song) =>
      normalizeReviewValue(song.pdfReviewStatus) === "completado"
      && normalizeReviewValue(song.keynoteReviewStatus) === "completado"
      && normalizeReviewValue(song.musicReviewStatus) === "completado"
      && song.sungBefore
      && (!song.lastUsedAt || (song.usageCount || 0) <= 1)
    )
    .slice(0, 10);
  const changeKeySongs = filteredSongs.filter((song) => song.hasKeyChange);
  const incompleteMusicalData = filteredSongs.filter((song) =>
    !song.mainKey
    || song.capo === undefined
    || !getSongPdfUrl(song)
    || !song.musicReviewStatus
    || !song.keynoteReviewStatus
  );
  const total = filteredSongs.length;
  const pdfReady = filteredSongs.filter((song) => getSongPdfUrl(song)).length;
  const keynoteDone = filteredSongs.filter((song) => normalizeReviewValue(song.keynoteReviewStatus) === "completado").length;
  const musicDone = filteredSongs.filter((song) => normalizeReviewValue(song.musicReviewStatus) === "completado").length;
  const noCapo = filteredSongs.filter((song) => Number(song.capo || 0) === 0).length;

  const leastUsedColumns = [
    { key: "title", label: "Canto" },
    { key: "category", label: "Categoría" },
    { key: "mainTheme", label: "Tema" },
    { key: "mainKey", label: "Tono" },
    { key: "capo", label: "Capo", render: (song) => song.capo ?? 0 },
    { key: "usageCount", label: "Usos", render: (song) => song.usageCount || 0 },
    { key: "lastUsedAt", label: "Última vez", render: (song) => song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin historial" },
    { key: "sungBefore", label: "Histórico", render: (song) => song.sungBefore ? "Ya se ha cantado" : "No cantado históricamente" },
    { key: "state", label: "Estado", render: (song) => song.lastUsedAt ? "Poco usado en la app" : "Sin historial" }
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-4 xl:grid-cols-[1fr_220px_220px_auto] xl:items-end">
          <div>
            <h2 className="text-xl font-bold text-ink">Estadísticas</h2>
            <p className="mt-1 text-sm text-ink/55">Analizando {filteredSongs.length} de {songs.length} cantos.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant={view === "musicians" ? "primary" : "secondary"} onClick={() => setView("musicians")}>Para músicos</Button>
              <Button variant={view === "programming" ? "primary" : "secondary"} onClick={() => setView("programming")}>Para programación</Button>
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink/55">Categoría</span>
            <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink/55">Tema</span>
            <Select value={themeFilter} onChange={(event) => setThemeFilter(event.target.value)}>
              <option value="">Todos</option>
              {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
            </Select>
          </label>
          <Button variant="secondary" onClick={() => { setCategoryFilter(""); setThemeFilter(""); }}>Limpiar filtros</Button>
        </div>
      </Card>

      {view === "musicians" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Music2} label="Sin capo" value={`${percent(noCapo, total)}%`} detail={`${noCapo} de ${total}`} />
            <StatCard icon={FileCheck2} label="Con PDF disponible" value={`${percent(pdfReady, total)}%`} detail={`${pdfReady} de ${total}`} delay={0.05} />
            <StatCard icon={Presentation} label="Keynote completado" value={`${percent(keynoteDone, total)}%`} detail={`${keynoteDone} de ${total}`} delay={0.1} />
            <StatCard icon={BarChart3} label="Revisión musical" value={`${percent(musicDone, total)}%`} detail={`${musicDone} de ${total}`} delay={0.15} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard
              title="Tonalidades"
              aside={
                <div className="flex rounded-xl bg-ink/5 p-1">
                  <Button variant={keyMode === "main" ? "primary" : "subtle"} className="min-h-8 px-3 py-1 text-xs" onClick={() => setKeyMode("main")}>Principal</Button>
                  <Button variant={keyMode === "capo" ? "primary" : "subtle"} className="min-h-8 px-3 py-1 text-xs" onClick={() => setKeyMode("capo")}>Con capo</Button>
                </div>
              }
            >
              <BarGraph data={byKey} theme={chartTheme} />
            </ChartCard>
            <ChartCard title="Cantos por capo"><BarGraph data={byCapo} theme={chartTheme} /></ChartCard>
            <ChartCard title="Estados de revisión"><ReviewGraph data={reviewData} theme={chartTheme} /></ChartCard>
            <ChartCard title="PDFs disponibles"><PieGraph data={[{ name: "Con PDF", value: pdfReady }, { name: "Sin PDF", value: total - pdfReady }]} theme={chartTheme} /></ChartCard>
          </div>
          <Card>
            <h2 className="text-lg font-bold text-ink">Cantos con cambio de tono</h2>
            <div className="mt-4">
              <SongTable rows={changeKeySongs} songs={songs} columns={[
                { key: "title", label: "Canto" },
                { key: "mainKey", label: "Tono principal" },
                { key: "capo", label: "Capo", render: (song) => song.capo ?? 0 },
                { key: "keyWithCapo", label: "Tono con capo" },
                { key: "internalNotes", label: "Comentario" }
              ]} />
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-ink">Cantos sin datos musicales completos</h2>
            <div className="mt-4">
              <SongTable rows={incompleteMusicalData} songs={songs} columns={[
                { key: "title", label: "Canto" },
                { key: "mainKey", label: "Tono", render: (song) => song.mainKey || "Sin tonalidad" },
                { key: "capo", label: "Capo", render: (song) => song.capo ?? "Sin capo definido" },
                { key: "pdf", label: "PDF", render: (song) => getSongPdfUrl(song) ? "Con PDF" : "Sin PDF" },
                { key: "musicReviewStatus", label: "Revisión musical" },
                { key: "keynoteReviewStatus", label: "Keynote" }
              ]} />
            </div>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <h2 className="text-lg font-bold text-ink">Cantos más usados</h2>
              <div className="mt-4">
                <SongTable rows={mostUsed} songs={songs} columns={[
                  { key: "title", label: "Canto" },
                  { key: "usageCount", label: "Uso total", render: (song) => song.usageCount || 0 },
                  { key: "lastUsedAt", label: "Última vez", render: (song) => song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin historial" },
                  { key: "category", label: "Categoría" },
                  { key: "mainTheme", label: "Tema" }
                ]} />
              </div>
            </Card>
            <ChartCard title="Rotación por tema en programaciones">
              <BarGraph data={topWithOthers(programmedThemes, 10)} horizontal theme={chartTheme} />
            </ChartCard>
            <ChartCard title="Repertorio por categoría">
              <PieGraph data={byCategory} theme={chartTheme} />
            </ChartCard>
            <ChartCard title="Cantos por tema del repertorio">
              <BarGraph data={byTheme} horizontal theme={chartTheme} />
            </ChartCard>
          </div>
          <Card>
            <h2 className="text-lg font-bold text-ink">Cantos menos usados</h2>
            <div className="mt-4"><SongTable rows={leastUsed} songs={songs} columns={leastUsedColumns} /></div>
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-ink">Sugerencias de rotación</h2>
            <p className="mt-1 text-sm text-ink/55">Cantos listos para considerar: PDF, Keynote y revisión musical completados, históricamente cantados y con poco uso o sin historial en la app.</p>
            <div className="mt-4">
              <SongTable rows={rotationSuggestions} songs={songs} columns={[
                { key: "title", label: "Canto" },
                { key: "category", label: "Categoría" },
                { key: "mainTheme", label: "Tema" },
                { key: "mainKey", label: "Tono" },
                { key: "usageCount", label: "Usos", render: (song) => song.usageCount || 0 },
                { key: "lastUsedAt", label: "Última vez", render: (song) => song.lastUsedAt ? formatDate(song.lastUsedAt) : "Sin historial" }
              ]} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
