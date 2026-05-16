import { useMemo, useState } from "react";
import { Download, LayoutGrid, List } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, Select } from "../components/ui/Field";
import { SongNameLink } from "../components/ui/SongNameLink";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getPastSchedules } from "../services/dateUtils";

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function History() {
  const { songs, schedules } = useMusicData();
  const [view, setView] = useState("cards");
  const [query, setQuery] = useState("");
  const [serviceType, setServiceType] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sort, setSort] = useState("desc");
  const past = getPastSchedules(schedules).filter((schedule) => schedule.status === "realizado" || schedule.date);
  const withoutAppHistory = songs.filter((song) => !song.lastUsedAt).slice(0, 8);
  const sungBefore = songs.filter((song) => song.sungBefore).length;
  const realUsage = useMemo(() => {
    const counts = new Map();
    past.forEach((schedule) => {
      (schedule.songs || []).forEach((entry) => {
        const key = entry.songId || entry.titleSnapshot;
        if (!key) return;
        const existing = counts.get(key) || { id: entry.songId, title: entry.titleSnapshot, count: 0 };
        existing.count += 1;
        counts.set(key, existing);
      });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [past]);

  const serviceTypes = [...new Set(past.map((schedule) => schedule.serviceType || schedule.serviceLabel || schedule.type).filter(Boolean))];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = past.filter((schedule) => {
      const text = [
        schedule.date,
        schedule.serviceLabel,
        schedule.type,
        schedule.leader,
        schedule.status,
        ...(schedule.songs || []).map((song) => song.titleSnapshot)
      ].join(" ").toLowerCase();
      const matchesText = !term || text.includes(term);
      const matchesService = serviceType === "all" || [schedule.serviceType, schedule.serviceLabel, schedule.type].includes(serviceType);
      const matchesDate = !dateFilter || schedule.date === dateFilter;
      return matchesText && matchesService && matchesDate;
    });
    return list.sort((a, b) => sort === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }, [dateFilter, past, query, serviceType, sort]);

  const exportHistory = () => {
    const songById = new Map(songs.map((song) => [song.id, song]));
    const rows = [
      ["fecha", "servicio", "hora", "lider_de_adoracion", "cantos_en_orden", "tonos", "capo", "notas_por_canto", "notas_generales", "estado_interno", "creado_por", "actualizado_por"],
      ...filtered.map((schedule) => [
        schedule.date,
        schedule.serviceLabel || schedule.type || "",
        schedule.time || "",
        schedule.leader || "",
        (schedule.songs || []).map((song, index) => `${index + 1}. ${song.titleSnapshot}`).join(" | "),
        (schedule.songs || []).map((song) => song.keySnapshot || songById.get(song.songId)?.mainKey || "").join(" | "),
        (schedule.songs || []).map((song) => songById.get(song.songId)?.capo ?? "").join(" | "),
        (schedule.songs || []).map((song, index) => `${index + 1}. ${song.notes || ""}`).join(" | "),
        schedule.generalNotes || "",
        schedule.status || "",
        schedule.createdBy || "",
        schedule.updatedBy || ""
      ])
    ];
    const blob = new Blob([`\ufeff${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historial-programaciones-roca-eterna-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">Historial de programaciones realizadas</h2>
              <p className="mt-1 text-sm text-ink/55">{filtered.length} programaciones encontradas</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={view === "cards" ? "primary" : "secondary"} onClick={() => setView("cards")}><LayoutGrid className="h-4 w-4" />Tarjetas</Button>
              <Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}><List className="h-4 w-4" />Lista compacta</Button>
              <Button variant="secondary" onClick={exportHistory}><Download className="h-4 w-4" />Exportar historial</Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Input placeholder="Buscar canto, servicio o lider" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            <Select value={serviceType} onChange={(event) => setServiceType(event.target.value)}>
              <option value="all">Todos los servicios</option>
              {serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
            <Select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="desc">Fecha descendente</option>
              <option value="asc">Fecha ascendente</option>
            </Select>
          </div>
        </Card>

        {filtered.length && view === "cards" ? filtered.map((schedule) => (
          <Card key={schedule.id}>
            <h2 className="text-xl font-bold text-ink">{formatDate(schedule.date)}</h2>
            <p className="mt-1 text-sm text-ink/55">{schedule.serviceLabel || schedule.type || "Servicio"} · {schedule.leader || "Sin lider de adoracion"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(schedule.songs || []).map((song, index) => (
                <span key={`${song.songId}-${index}`} className="rounded-full bg-ink/5 px-3 py-2 text-sm font-semibold text-ink">
                  <SongNameLink songId={song.songId} title={song.titleSnapshot} songs={songs}>{song.titleSnapshot}</SongNameLink> · {song.keySnapshot}
                </span>
              ))}
            </div>
          </Card>
        )) : null}

        {filtered.length && view === "list" ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-ink/45">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Servicio</th>
                    <th className="px-3 py-2">Lider de adoracion</th>
                    <th className="px-3 py-2">Cantos</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((schedule) => (
                    <tr key={schedule.id} className="border-t border-ink/10">
                      <td className="px-3 py-3 font-semibold text-ink">{formatDate(schedule.date)}</td>
                      <td className="px-3 py-3 text-ink/60">{schedule.serviceLabel || schedule.type}</td>
                      <td className="px-3 py-3 text-ink/60">{schedule.leader || "--"}</td>
                      <td className="px-3 py-3 text-ink/70">{(schedule.songs || []).map((song) => song.titleSnapshot).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {!filtered.length ? (
          <EmptyState title="Aun no hay programaciones realizadas dentro de la app." text="Cuando marques o registres servicios pasados, apareceran en esta seccion." />
        ) : null}
      </div>

      <aside className="space-y-4">
        <Card>
          <h3 className="font-bold text-ink">Resumen del repertorio</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-2xl bg-ink/5 p-3"><dt className="text-ink/55">Cantos totales</dt><dd className="font-bold text-ink">{songs.length}</dd></div>
            <div className="flex justify-between gap-4 rounded-2xl bg-ink/5 p-3"><dt className="text-ink/55">Ya se ha cantado</dt><dd className="font-bold text-ink">{sungBefore}</dd></div>
            <div className="flex justify-between gap-4 rounded-2xl bg-ink/5 p-3"><dt className="text-ink/55">Sin historial</dt><dd className="font-bold text-ink">{withoutAppHistory.length}</dd></div>
          </dl>
        </Card>
        <Card>
          <h3 className="font-bold text-ink">Cantos mas usados en historial</h3>
          <p className="mt-1 text-xs text-ink/45">Segun programaciones registradas, no valores heredados.</p>
          <div className="mt-4 space-y-3">
            {realUsage.length ? realUsage.map((entry) => (
              <div key={entry.id || entry.title} className="flex items-center justify-between rounded-2xl bg-ink/5 p-3">
                <SongNameLink songId={entry.id} title={entry.title} songs={songs} className="text-sm">{entry.title}</SongNameLink>
                <span className="rounded-xl bg-white px-2 py-1 text-xs font-bold text-ink">{entry.count}</span>
              </div>
            )) : <p className="text-sm text-ink/55">Sin historial</p>}
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-ink">Sin fecha de ultimo uso registrada</h3>
          <div className="mt-4 space-y-3">
            {withoutAppHistory.map((song) => (
              <div key={song.id} className="rounded-2xl bg-ink/5 p-3">
                <SongNameLink songId={song.id} title={song.title} songs={songs} className="text-sm">{song.title}</SongNameLink>
                <p className="text-xs text-ink/55">{song.sungBefore ? "Ya se ha cantado historicamente" : "Sin historial previo marcado"}</p>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
