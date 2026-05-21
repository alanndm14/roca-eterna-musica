import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, CalendarPlus, Clock, FileClock, ListPlus, Music2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getCurrentOrNextSchedule, getEstimatedServiceEndDate, getScheduleStartDate, getServiceDisplayLabel, todayString } from "../services/dateUtils";
import { getSongPdfUrl } from "../services/songUtils";
import { diagnosePushNotifications, enablePushNotificationsForUser } from "../services/pushNotifications";

const currentMonth = () => todayString().slice(0, 7);

const formatRemaining = (schedule, now = new Date()) => {
  const start = getScheduleStartDate(schedule);
  if (!start) return "--";
  const diff = start.getTime() - now.getTime();
  if (diff <= 0) {
    const end = getEstimatedServiceEndDate(schedule);
    return end && end.getTime() > now.getTime() ? "En curso" : "Finalizado";
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
  (Array.isArray(schedules) ? schedules : [])
    .filter((schedule) => schedule?.date?.startsWith(month) && schedule.date <= today)
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
  const { canEdit, profile, saveUserPreferences } = useAuth();
  const { songs = [], schedules = [] } = useMusicData();
  const [now, setNow] = useState(() => new Date());
  const [pushPrompt, setPushPrompt] = useState({ checked: false, show: false, status: "" });
  const isViewer = profile?.role === "viewer";
  const upcoming = useMemo(() => getCurrentOrNextSchedule(schedules, now), [schedules, now]);
  const missingPdfLinks = songs.filter((song) => !getSongPdfUrl(song)).length;
  const keynotePending = songs.filter((song) => song.keynoteReviewStatus !== "completado").length;
  const monthTopSongs = getMonthlyTopSongs(schedules);
  const topDetail = monthTopSongs.length
    ? monthTopSongs.map((song) => `${song.title} (${song.count})`).join(", ")
    : "Sin datos este mes";
  const remaining = formatRemaining(upcoming, now);
  const countdownActive = typeof remaining === "string" && remaining.includes(":");

  useEffect(() => {
    const intervalMs = countdownActive ? 1000 : 60000;
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [countdownActive]);

  useEffect(() => {
    let cancelled = false;
    const checkPushPrompt = async () => {
      if (!profile?.uid || profile.dismissedPushPromptByUser || localStorage.getItem(`roca-eterna-push-prompt-dismissed-${profile.uid}`) === "true") {
        setPushPrompt((current) => ({ ...current, checked: true, show: false }));
        return;
      }
      if (typeof Notification === "undefined") {
        setPushPrompt((current) => ({ ...current, checked: true, show: false }));
        return;
      }
      const diagnostic = await diagnosePushNotifications(profile).catch(() => null);
      if (cancelled) return;
      const permissionGranted = Notification.permission === "granted";
      const hasRegisteredDevice = Boolean(diagnostic?.tokenPath || diagnostic?.tokenObtained || diagnostic?.firestoreWrite === "token existente" || diagnostic?.firestoreWrite === "permitida");
      setPushPrompt({ checked: true, show: !permissionGranted || !hasRegisteredDevice, status: "" });
    };
    checkPushPrompt();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, profile?.dismissedPushPromptByUser]);

  const activatePushFromPrompt = async () => {
    const result = await enablePushNotificationsForUser(profile);
    setPushPrompt({
      checked: true,
      show: !(result.supported && (result.tokenObtained || result.firestoreWrite === "permitida")),
      status: result.reason || (result.supported ? "Notificaciones activadas." : "No se pudieron activar las notificaciones.")
    });
  };

  const dismissPushPrompt = async () => {
    if (profile?.uid) localStorage.setItem(`roca-eterna-push-prompt-dismissed-${profile.uid}`, "true");
    await saveUserPreferences?.({ dismissedPushPromptByUser: true });
    setPushPrompt({ checked: true, show: false, status: "" });
  };

  return (
    <div className="space-y-6">
      {pushPrompt.checked && pushPrompt.show ? (
        <Card className="border-brass/25 bg-brass/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brass text-white">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">Recibir novedades</h2>
                <p className="mt-1 text-sm leading-6 text-ink/62">Podemos avisarte cuando se agregue una nueva programación o un nuevo canto al repertorio.</p>
                {pushPrompt.status ? <p className="mt-2 text-sm font-semibold text-brass">{pushPrompt.status}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={activatePushFromPrompt}>Activar notificaciones</Button>
              <Button variant="subtle" onClick={dismissPushPrompt}>Ahora no</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="relative overflow-hidden bg-ink p-6 text-white">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/10" />
          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">{upcoming ? getServiceDisplayLabel(upcoming) : "Próximo servicio"}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal md:text-4xl">
              {upcoming ? formatDate(upcoming.date) : "Sin próxima programación."}
            </h2>
            {upcoming ? (
              <div className="mt-5 grid gap-3 text-sm text-white/72 sm:grid-cols-3">
                <span className="rounded-2xl bg-white/8 p-3">Servicio: {getServiceDisplayLabel(upcoming)}</span>
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
              <div key={`${song.songId || song.titleSnapshot}-${index}`} className="flex items-center justify-between rounded-2xl bg-ink/5 p-3">
                <div>
                  <p className="font-semibold text-ink">{index + 1}. {song.titleSnapshot || "Canto sin título"}</p>
                  <p className="text-sm text-ink/55">{song.notes || "Sin notas"}</p>
                </div>
                <span className="rounded-xl bg-white px-3 py-1 text-sm font-bold text-ink dark:bg-white/10 dark:text-white">{song.keySnapshot || "--"}</span>
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
