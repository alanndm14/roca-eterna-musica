import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, CalendarPlus, Clock, ExternalLink, FileClock, ListPlus, Music2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getCurrentOrNextSchedule, getEstimatedServiceEndDate, getScheduleStartDate, getServiceDisplayLabel, isCountableSchedule, todayString } from "../services/dateUtils";
import { getSongPdfUrl, getSongSpotifyUrl, getSongYoutubeUrl, normalizeSearchText } from "../services/songUtils";
import { diagnosePushNotifications, enablePushNotificationsForUser, getCurrentPushTokenForUser } from "../services/pushNotifications";
import { AndroidNotificationPermissionWizard } from "../components/notifications/AndroidNotificationPermissionWizard";
import { isPushBackendConfigured, sendExternalPush } from "../services/externalPush";
import { isAndroidDevice } from "../services/notificationDevice";

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
    .filter((schedule) => isCountableSchedule(schedule) && schedule?.date?.startsWith(month) && schedule.date <= today)
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

const getNextPlannedNewSong = (plannedNewSongs = [], songs = [], now = new Date()) => {
  const today = todayString();
  const candidates = (Array.isArray(plannedNewSongs) ? plannedNewSongs : [])
    .filter((item) => {
      const status = normalizeSearchText(item?.status || "");
      return item?.plannedDate >= today && !["estrenado", "cancelado", "pospuesto"].includes(status);
    })
    .sort((left, right) => String(left.plannedDate).localeCompare(String(right.plannedDate)));
  const planned = candidates[0];
  if (!planned) return null;
  const song = songs.find((item) => item.id === planned.songId)
    || songs.find((item) => normalizeSearchText(item.title) === normalizeSearchText(planned.songTitle || planned.title || ""));
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(`${planned.plannedDate}T00:00:00`).getTime();
  const days = Math.max(0, Math.ceil((target - todayStart) / (24 * 60 * 60 * 1000)));
  return { planned, song, days };
};

export function Dashboard() {
  const { canEdit, profile, saveUserPreferences } = useAuth();
  const { songs = [], schedules = [], plannedNewSongs = [] } = useMusicData();
  const [now, setNow] = useState(() => new Date());
  const [pushPrompt, setPushPrompt] = useState({ checked: false, show: false, status: "" });
  const [activatingPushPrompt, setActivatingPushPrompt] = useState(false);
  const [showNotificationWizard, setShowNotificationWizard] = useState(false);
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
  const nextNewSong = useMemo(
    () => getNextPlannedNewSong(plannedNewSongs, songs, now),
    [now, plannedNewSongs, songs]
  );
  const nextNewSongPdf = getSongPdfUrl(nextNewSong?.song);
  const nextNewSongYoutube = getSongYoutubeUrl(nextNewSong?.song);
  const nextNewSongSpotify = getSongSpotifyUrl(nextNewSong?.song);

  useEffect(() => {
    const intervalMs = countdownActive ? 1000 : 60000;
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [countdownActive]);

  useEffect(() => {
    let cancelled = false;
    const checkPushRegistration = async () => {
      if (!profile?.uid) {
        setPushPrompt({ checked: true, show: false, status: "" });
        return;
      }
      const diagnostic = await diagnosePushNotifications(profile).catch(() => null);
      if (cancelled) return;
      const permissionGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
      const deviceRegistered = Boolean(
        diagnostic?.tokenSaved
        || diagnostic?.tokenObtained
        || diagnostic?.tokenPath
        || diagnostic?.firestoreWrite === "permitida"
        || diagnostic?.firestoreWrite === "token existente"
      );
      setPushPrompt({ checked: true, show: !(permissionGranted && deviceRegistered), status: "" });
    };
    checkPushRegistration();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  const completePushActivation = async () => {
    setActivatingPushPrompt(true);
    try {
      const result = await enablePushNotificationsForUser(profile);
      const permissionAccepted = result.browserPermission === "granted" || (typeof Notification !== "undefined" && Notification.permission === "granted");
      const registered = Boolean(
        result.supported
        && (result.tokenObtained || result.tokenPath || result.firestoreWrite === "permitida" || result.firestoreWrite === "token existente")
      );
      if (permissionAccepted || registered) {
        await saveUserPreferences?.({
          dismissedPushPromptByUser: false,
          wantsPushNotifications: true,
          pushNotificationsEnabled: registered,
          pushNotificationsEnabledAt: new Date().toISOString()
        });
      }
      setPushPrompt({
        checked: true,
        show: !(permissionAccepted && registered),
        status: result.reason || (registered ? "Notificaciones activadas en este dispositivo." : "No se pudieron activar las notificaciones.")
      });
      return result;
    } catch (error) {
      const message = error?.message || "No se pudieron activar las notificaciones.";
      setPushPrompt({ checked: true, show: true, status: message });
      return { supported: false, reason: message, error: message };
    } finally {
      setActivatingPushPrompt(false);
    }
  };

  const activatePushFromPrompt = () => {
    if (isAndroidDevice()) {
      setShowNotificationWizard(true);
      return;
    }
    completePushActivation();
  };

  const sendSelfTest = async () => {
    if (!isPushBackendConfigured()) return { ok: false, error: "El backend push no está configurado." };
    const tokenResult = await getCurrentPushTokenForUser(profile);
    if (!tokenResult.supported || !tokenResult.token) return tokenResult;
    return sendExternalPush({
      mode: "self_test",
      type: "other",
      title: "Prueba de Roca Eterna Música",
      body: "Este dispositivo ya puede recibir notificaciones.",
      url: "/#/",
      token: tokenResult.token,
      tokenId: tokenResult.tokenId,
      notificationId: `dashboard-self-test-${Date.now()}`
    }, { kind: "test" });
  };

  const dismissPushPrompt = () => {
    setPushPrompt({ checked: true, show: false, status: "" });
  };

  return (
    <div className="space-y-6">
      <AndroidNotificationPermissionWizard
        open={showNotificationWizard}
        onClose={() => setShowNotificationWizard(false)}
        onActivate={completePushActivation}
        onTest={sendSelfTest}
        isWorking={activatingPushPrompt}
      />
      {pushPrompt.checked && pushPrompt.show ? (
        <Card className="border-brass/25 bg-brass/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brass text-white">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">Recibir novedades</h2>
                <p className="mt-1 text-sm leading-6 text-ink/62">Podemos avisarte cuando haya una nueva programación, cambios importantes o un canto nuevo por preparar.</p>
                {pushPrompt.status ? <p className="mt-2 text-sm font-semibold text-brass">{pushPrompt.status}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button isLoading={activatingPushPrompt} disabled={activatingPushPrompt} onClick={activatePushFromPrompt}>Activar notificaciones</Button>
              <Button variant="subtle" onClick={dismissPushPrompt}>Ahora no</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {nextNewSong ? (
        <Card className="overflow-hidden border-cyan-500/25 bg-cyan-50/80 p-0 dark:border-cyan-300/20 dark:bg-cyan-400/8">
          <div className="grid md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="flex items-center justify-center bg-cyan-500 px-5 py-6 text-center text-white dark:bg-cyan-400/85 dark:text-slate-950">
              <div>
                <Music2 className="mx-auto h-7 w-7" />
                <p className="mt-2 text-xs font-black uppercase tracking-wide">Próximo canto nuevo</p>
                <p className="mt-1 text-4xl font-black">{nextNewSong.days}</p>
                <p className="text-sm font-bold">{nextNewSong.days === 0 ? "Hoy" : nextNewSong.days === 1 ? "día" : "días"}</p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-200">
                {formatDate(nextNewSong.planned.plannedDate)}
              </p>
              <h2 className="mt-2 text-2xl font-black text-ink">{nextNewSong.song?.title || nextNewSong.planned.songTitle || "Canto nuevo"}</h2>
              <p className="mt-1 text-sm text-ink/58">Prepáralo desde aquí sin buscarlo en otra sección.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {nextNewSong.song?.id ? (
                  <Link to={`/repertorio/${nextNewSong.song.id}`}>
                    <Button>Ver canto</Button>
                  </Link>
                ) : null}
                {nextNewSongPdf ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-ink/25 dark:bg-white/10" href={nextNewSongPdf} target="_blank" rel="noreferrer">
                    PDF <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {nextNewSongYoutube ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-ink/5 px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/10 dark:bg-white/10" href={nextNewSongYoutube} target="_blank" rel="noreferrer">
                    YouTube <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {nextNewSongSpotify ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-ink/5 px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/10 dark:bg-white/10" href={nextNewSongSpotify} target="_blank" rel="noreferrer">
                    Spotify <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
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
              <Link to={canEdit ? "/programacion" : "/servicios"}>
                <Button variant="darkSubtle">
                  <CalendarPlus className="h-4 w-4" />
                  {canEdit ? "Nueva programación" : "Ver próximo servicio"}
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
