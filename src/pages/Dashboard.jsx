import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, Clock, FileClock, ListPlus, Music2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getUpcomingSchedule, todayString } from "../services/dateUtils";
import { getSongPdfUrl } from "../services/songUtils";

const serviceLabel = (schedule) => schedule?.serviceLabel || schedule?.type || "Servicio pendiente";
const currentMonth = () => todayString().slice(0, 7);

const getScheduleStart = (schedule) => {
  if (!schedule?.date) return null;
  const time = schedule.time || "00:00";
  const date = new Date(`${schedule.date}T${time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatRemaining = (schedule, now = new Date()) => {
  const start = getScheduleStart(schedule);
  if (!start) return "--";
  const diff = start.getTime() - now.getTime();
  if (diff <= 0) {
    const twoHours = 2 * 60 * 60 * 1000;
    return Math.abs(diff) <= twoHours ? "En curso" : "Finalizado";
  }
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff >= dayMs) {
    const days = Math.ceil(diff / dayMs);
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

const getMonthlyTopSongs = (schedules = []) => {
  const month = currentMonth();
  const today = todayString();
  const counts = new Map();
  schedules
    .filter((schedule) => schedule.date?.startsWith(month) && schedule.date <= today)
    .forEach((schedule) => {
      (schedule.songs || []).forEach((entry) => {
        const key = entry.songId || entry.titleSnapshot;
        if (!key) return;
        const current = counts.get(key) || { title: entry.titleSnapshot || "Canto", count: 0 };
        current.count += 1;
        counts.set(key, current);
      });
    });

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3);
};

export function Dashboard() {
  const { canEdit, profile } = useAuth();
  const { songs, schedules } = useMusicData();
  const [now, setNow] = useState(() => new Date());
  const isViewer = profile?.role === "viewer";
  const upcoming = getUpcomingSchedule(schedules);
  const missingPdfLinks = songs.filter((song) => !getSongPdfUrl(song)).length;
  const keynotePending = songs.filter((song) => song.keynoteReviewStatus !== "completado").length;
  const monthTopSongs = getMonthlyTopSongs(schedules);
  const topDetail = monthTopSongs.length
    ? monthTopSongs.map((song) => `${song.title} (${song.count})`).join(", ")
    : "Sin datos este mes";
  const remaining = formatRemaining(upcoming, now);
  const countdownActive = remaining.includes(":");

  useEffect(() => {
    if (!countdownActive) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [countdownActive]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="relative overflow-hidden bg-ink p-6 text-white">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/10" />
          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">Próximo servicio</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal md:text-4xl">
              {upcoming ? formatDate(upcoming.date) : "Sin próxima programación"}
            </h2>
            {upcoming ? (
              <div className="mt-5 grid gap-3 text-sm text-white/72 sm:grid-cols-3">
                <span className="rounded-2xl bg-white/8 p-3">Servicio: {serviceLabel(upcoming)}</span>
                <span className="rounded-2xl bg-white/8 p-3">Hora: {upcoming.time || "Sin hora"}</span>
                <span className="rounded-2xl bg-white/8 p-3">Líder de adoración: {upcoming.leader || "Pendiente"}</span>
              </div>
            ) : null}
            {upcoming?.generalNotes ? (
              <p className="mt-5 max-w-3xl text-sm leading-6 text-white/62">{upcoming.generalNotes}</p>
            ) : !upcoming ? (
              <p className="mt-5 max-w-3xl text-sm leading-6 text-white/62">No hay programación próxima registrada.</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {canEdit ? (
                <Link to="/repertorio">
                  <Button variant="light">
                    <ListPlus className="h-4 w-4" />
                    Agregar canto
                  </Button>
                </Link>
              ) : null}
              <Link to="/programacion">
                <Button variant="darkSubtle">
                  <CalendarPlus className="h-4 w-4" />
                  {canEdit ? "Nueva programación" : "Ver programación"}
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink/55">Tiempo restante</p>
              <p className="mt-2 text-5xl font-bold text-ink">{remaining}</p>
            </div>
            <div className="rounded-3xl bg-brass/12 p-4 text-brass">
              <Clock className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {(upcoming?.songs || []).map((song, index) => (
              <div key={`${song.songId}-${index}`} className="flex items-center justify-between rounded-2xl bg-ink/5 p-3">
                <div>
                  <p className="font-semibold text-ink">{index + 1}. {song.titleSnapshot}</p>
                  <p className="text-sm text-ink/55">{song.notes || "Sin notas"}</p>
                </div>
                <span className="rounded-xl bg-white px-3 py-1 text-sm font-bold text-ink dark:bg-white/10 dark:text-white">{song.keySnapshot}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {!isViewer ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Music2} label="Cantos en repertorio" value={songs.length} detail="Disponibles para programar" />
          <StatCard icon={FileClock} label="Faltan links de PDF" value={missingPdfLinks} detail="Cantos sin PDF principal registrado" delay={0.05} />
          <StatCard icon={Sparkles} label="Revisión Keynote pendiente" value={keynotePending} detail="Cantos sin Keynote completado" delay={0.1} />
          <StatCard icon={RotateCcw} label="Más usados este mes" value={monthTopSongs[0]?.count || "--"} detail={topDetail} delay={0.15} />
        </section>
      ) : null}
    </div>
  );
}
