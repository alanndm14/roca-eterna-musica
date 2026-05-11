import { Link } from "react-router-dom";
import { CalendarPlus, Clock, FileClock, ListPlus, Music2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useMusicData } from "../hooks/useMusicData";
import { daysUntil, formatDate, getUpcomingSchedule } from "../services/dateUtils";

const serviceLabel = (schedule) => schedule?.serviceLabel || schedule?.type || "Servicio pendiente";

export function Dashboard() {
  const { songs, schedules } = useMusicData();
  const upcoming = getUpcomingSchedule(schedules);
  const days = daysUntil(upcoming?.date);
  const pdfPending = songs.filter((song) => song.pdfReviewStatus !== "completado").length;
  const musicPending = songs.filter((song) => song.musicReviewStatus !== "completado").length;
  const withoutAppHistory = songs.filter((song) => !song.lastUsedAt).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="relative overflow-hidden bg-ink p-6 text-white">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/10" />
          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">Próximo servicio</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal md:text-4xl">
              {upcoming ? formatDate(upcoming.date) : "Sin programación cercana"}
            </h2>
            {upcoming ? (
              <div className="mt-5 grid gap-3 text-sm text-white/72 sm:grid-cols-3">
                <span className="rounded-2xl bg-white/8 p-3">Servicio: {serviceLabel(upcoming)}</span>
                <span className="rounded-2xl bg-white/8 p-3">Hora: {upcoming.time || "Sin hora"}</span>
                <span className="rounded-2xl bg-white/8 p-3">Responsable: {upcoming.leader || "Pendiente"}</span>
              </div>
            ) : null}
            <p className="mt-5 max-w-3xl text-sm leading-6 text-white/62">
              {upcoming?.generalNotes || "Crea una programación para que el equipo pueda revisar cantos, tonos, PDFs y notas desde cualquier dispositivo."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/repertorio">
                <Button variant="light">
                  <ListPlus className="h-4 w-4" />
                  Agregar canto
                </Button>
              </Link>
              <Link to="/programacion">
                <Button variant="darkSubtle">
                  <CalendarPlus className="h-4 w-4" />
                  Nueva programación
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink/55">Días restantes</p>
              <p className="mt-2 text-5xl font-bold text-ink">{days === null ? "--" : Math.max(days, 0)}</p>
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
                <span className="rounded-xl bg-white px-3 py-1 text-sm font-bold text-ink">{song.keySnapshot}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Music2} label="Cantos en repertorio" value={songs.length} detail="Disponibles para programar" />
        <StatCard icon={FileClock} label="PDFs pendientes" value={pdfPending} detail="Revisión PDF no completada" delay={0.05} />
        <StatCard icon={Sparkles} label="Revisión musical pendiente" value={musicPending} detail="Cantos por revisar musicalmente" delay={0.1} />
        <StatCard icon={RotateCcw} label="Sin historial en la app" value={withoutAppHistory} detail="Sin fecha de último uso registrada" delay={0.15} />
      </section>
    </div>
  );
}
