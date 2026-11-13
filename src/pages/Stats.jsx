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
import { Field, Select } from "../components/ui/Field";
import { SongNameLink } from "../components/ui/SongNameLink";
import { StatCard } from "../components/ui/StatCard";
import { RepertoireBalancePanel } from "../components/smart/RepertoireBalancePanel";
import { RotationPanel } from "../components/smart/RotationPanel";
import { useMusicData } from "../hooks/useMusicData";
import { getScheduleStartDate, todayString } from "../services/dateUtils";
import { getRecordedServices, isActiveService } from "../services/songHistory";
import { getRotationServiceLabel, getRotationStartDate, getSongThemeKeys, isChristmasSong, normalizeReviewValue, summarizeRotation } from "../services/rotationStats";
import { canonicalThemeKey, collectSongThemes, getSongPdfUrl } from "../services/songUtils";

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
    <Card className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {aside}
      </div>
      <div className="mt-5 h-72 min-h-0 min-w-0">{children}</div>
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

function BarGraph({ data, theme }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.muted }} tickLine={{ stroke: theme.muted }} />
        <Tooltip {...chartTooltip(theme)} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieGraph({ data, theme }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
  const [view, setView] = useState("programming");
  const [keyMode, setKeyMode] = useState("main");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [period, setPeriod] = useState("year");
  const [serviceLabel, setServiceLabel] = useState("");
  const [season, setSeason] = useState("regular");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = todayString(now);
  const startDate = getRotationStartDate(period, today);
  const catalog = useMemo(() => songs.filter((song) => !song.deleted && song.active !== false), [songs]);
  const seasonSongs = useMemo(() => catalog.filter((song) =>
    view !== "programming" || season === "all" || (season === "christmas") === isChristmasSong(song)
  ), [catalog, season, view]);
  const categories = useMemo(() => [...new Set(seasonSongs.map((song) => song.category || "normal"))].sort((a, b) => a.localeCompare(b, "es")), [seasonSongs]);
  const themeOptions = useMemo(() => collectSongThemes(seasonSongs, view === "programming" ? [] : themes), [seasonSongs, themes, view]);
  const selectedTheme = themeOptions.find((theme) => canonicalThemeKey(theme) === canonicalThemeKey(themeFilter)) || "";
  const selectedCategory = categories.includes(categoryFilter) ? categoryFilter : "";
  const filteredSongs = useMemo(() => seasonSongs.filter((song) =>
    (!selectedCategory || (song.category || "normal") === selectedCategory)
    && (!selectedTheme || getSongThemeKeys(song).has(canonicalThemeKey(selectedTheme)))
  ), [selectedCategory, selectedTheme, seasonSongs]);
  const recordedServices = useMemo(() => getRecordedServices(songs, schedules, now), [songs, schedules, now]);
  const serviceOptions = useMemo(() => [...new Set(schedules.filter(isActiveService).map(getRotationServiceLabel))]
    .sort((a, b) => a.localeCompare(b, "es")), [schedules]);
  const rotation = useMemo(() => summarizeRotation(filteredSongs, recordedServices, { startDate, serviceLabel }),
    [filteredSongs, recordedServices, startDate, serviceLabel]);
  const nextSchedule = useMemo(() => schedules
    .filter((schedule) => isActiveService(schedule) && (!serviceLabel || getRotationServiceLabel(schedule) === serviceLabel))
    .map((schedule) => ({ schedule, start: getScheduleStartDate(schedule) }))
    .filter(({ start }) => start && start > now)
    .sort((a, b) => a.start - b.start)[0]?.schedule || null, [schedules, serviceLabel, now]);
  const resetFilters = () => {
    setCategoryFilter("");
    setThemeFilter("");
    if (view === "programming") {
      setPeriod("year");
      setServiceLabel("");
      setSeason("regular");
    }
  };

  const byKey = toChartData(countBy(filteredSongs, (song) => [keyMode === "main" ? song.mainKey : song.keyWithCapo]));
  const byCapo = toChartData(countBy(filteredSongs, (song) => [`Capo ${Number(song.capo || 0)}`])).sort((a, b) => Number(a.name.replace("Capo ", "")) - Number(b.name.replace("Capo ", "")));
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

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-xl font-bold text-ink">Estadísticas</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={view === "programming" ? "primary" : "secondary"} onClick={() => setView("programming")}>Para programación</Button>
          <Button variant={view === "musicians" ? "primary" : "secondary"} onClick={() => setView("musicians")}>Para músicos</Button>
          <Button variant={view === "balance" ? "primary" : "secondary"} onClick={() => setView("balance")}>Preparación del repertorio</Button>
        </div>
        <div className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {view === "programming" ? (
            <>
              <Field label="Periodo">
                <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option value="year">Este año</option>
                  <option value="30">Últimos 30 días</option>
                  <option value="90">Últimos 90 días</option>
                  <option value="all">Todo el historial</option>
                </Select>
              </Field>
              <Field label="Tipo de servicio">
                <Select value={serviceLabel} onChange={(event) => setServiceLabel(event.target.value)}>
                  <option value="">Todos</option>
                  {serviceOptions.map((label) => <option key={label}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Temporada">
                <Select value={season} onChange={(event) => { setSeason(event.target.value); setCategoryFilter(""); setThemeFilter(""); }}>
                  <option value="regular">Sin Navidad</option>
                  <option value="christmas">Solo Navidad</option>
                  <option value="all">Todas</option>
                </Select>
              </Field>
            </>
          ) : null}
          <Field label="Categoría">
            <Select value={selectedCategory} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </Select>
          </Field>
          <Field label="Tema">
            <Select value={selectedTheme} onChange={(event) => setThemeFilter(event.target.value)}>
              <option value="">Todos</option>
              {themeOptions.map((theme) => <option key={theme}>{theme}</option>)}
            </Select>
          </Field>
          <Button variant="secondary" className="min-h-11" onClick={resetFilters}>Limpiar filtros</Button>
        </div>
      </Card>

      {view === "balance" ? (
        <RepertoireBalancePanel songs={filteredSongs} />
      ) : view === "musicians" ? (
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
        <RotationPanel summary={rotation} now={now} themeFilter={selectedTheme} onSelectTheme={setThemeFilter} nextSchedule={nextSchedule} />
      )}
    </div>
  );
}
