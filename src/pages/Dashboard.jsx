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
import { AndroidNotificationPermissionWizard } from "../components/notifications/AndroidNotificationPermissionWizard";
import { getCurrentPushTokenForUser } from "../services/pushNotifications";
import { isPushBackendConfigured, sendExternalPush } from "../services/externalPush";
import { getNotificationDeviceContext, isStagingNotificationFlowEnabled } from "../services/stagingNotificationFlow";

const currentMonth = () => todayString().slice(0, 7);
const pushAcceptedStorageKey = (uid) => `roca-eterna-push-prompt-accepted-${uid}`;
const stagingWizardCompletedStorageKey = (uid) => `roca-eterna-staging-notification-wizard-complete-${uid}`;

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
        const current = counts.get(key) || { id: entry.songId || "", title: entry.titleSnapshot || "Canto", count: 0 };
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
  const [activatingPushPrompt, setActivatingPushPrompt] = useState(false);
  const [showAndroidNotificationWizard, setShowAndroidNotificationWizard] = useState(false);
  const stagingNotificationFlow = isStagingNotificationFlowEnabled(profile, profile?.role);
  const stagedAndroidNotificationFlow = stagingNotificationFlow && getNotificationDeviceContext().android;
  const isViewer = profile?.role === "viewer";
  const upcoming = useMemo(() => getCurrentOrNextSchedule(schedules, now), [schedules, now]);
  const missingPdfLinks = songs.filter((song) => !getSongPdfUrl(song)).length;
  const keynotePending = songs.filter((song) => song.keynoteReviewStatus !== "completado").length;
  const monthTopSongs = getMonthlyTopSongs(schedules);
  const topDetail = monthTopSongs.length
    ? monthTopSongs.map((song) => `${song.title} (${song.count})`).join(", ")
    : "Sin datos este mes";
  const remaining = upcoming ? formatRemaining(upcoming, now) : "Sin servicio próximo";
  const countdownActive = typeof remaining === "string" && remaining.includes(":");

  useEffect(() => {
    const intervalMs = countdownActive ? 1000 : 60000;
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [countdownActive]);

  useEffect(() => {
    let cancelled = false;
    const checkPushPrompt = async () => {
      if (!profile?.uid) {
        setPushPrompt((current) => ({ ...current, checked: true, show: false }));
        return;
      }
      if (!stagingNotificationFlow && (profile.dismissedPushPromptByUser || localStorage.getItem(`roca-eterna-push-prompt-dismissed-${profile.uid}`) === "true")) {
        setPushPrompt((current) => ({ ...current, checked: true, show: false }));
        return;
      }
      if (typeof Notification === "undefined") {
        setPushPrompt((current) => ({ ...current, checked: true, show: false }));
        return;
      }
      const browserPermissionGranted = Notification.permission === "granted";
      const userAlreadyAccepted = Boolean(
        profile.pushNotificationsEnabled
        || profile.wantsPushNotifications
        || profile.pushPromptAcceptedAt
        || localStorage.getItem(pushAcceptedStorageKey(profile.uid)) === "true"
      );
      if (!stagingNotificationFlow && (browserPermissionGranted || userAlreadyAccepted)) {
        setPushPrompt((current) => ({ ...current, checked: true, show: false }));
        return;
      }
      const diagnostic = await diagnosePushNotifications(profile).catch(() => null);
      if (cancelled) return;
      const permissionGranted = Notification.permission === "granted" || diagnostic?.browserPermission === "granted";
      const hasRegisteredDevice = Boolean(diagnostic?.tokenPath || diagnostic?.tokenObtained || diagnostic?.firestoreWrite === "token existente" || diagnostic?.firestoreWrite === "permitida");
      const complete = stagingNotificationFlow
        ? permissionGranted
          && hasRegisteredDevice
          && localStorage.getItem(stagingWizardCompletedStorageKey(profile.uid)) === "true"
        : permissionGranted || hasRegisteredDevice;
      setPushPrompt({ checked: true, show: !complete, status: "" });
    };
    checkPushPrompt();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, profile?.dismissedPushPromptByUser, stagingNotificationFlow]);

  const completePushActivation = async () => {
    setActivatingPushPrompt(true);
    try {
      if (profile?.uid) localStorage.removeItem(`roca-eterna-push-prompt-dismissed-${profile.uid}`);
      const result = await enablePushNotificationsForUser(profile);
      const permissionAccepted = result.browserPermission === "granted" || (typeof Notification !== "undefined" && Notification.permission === "granted");
      const registered = Boolean(
        result.supported
        && (result.tokenObtained || result.tokenPath || result.firestoreWrite === "permitida" || result.firestoreWrite === "token existente")
      );
      if (profile?.uid && (permissionAccepted || registered)) {
        localStorage.setItem(pushAcceptedStorageKey(profile.uid), "true");
      }
      if (permissionAccepted || registered) {
        await saveUserPreferences?.({
          dismissedPushPromptByUser: false,
          wantsPushNotifications: true,
          pushNotificationsEnabled: registered,
          pushNotificationsEnabledAt: new Date().toISOString()
        });
      }
      const complete = stagingNotificationFlow
        ? permissionAccepted && registered
        : permissionAccepted || registered;
      if (stagingNotificationFlow && complete && profile?.uid) {
        localStorage.setItem(stagingWizardCompletedStorageKey(profile.uid), "true");
      }
      setPushPrompt({
        checked: true,
        show: !complete,
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
    if (stagedAndroidNotificationFlow) {
      setShowAndroidNotificationWizard(true);
      return;
    }
    completePushActivation();
  };

  const sendStagingSelfTest = async () => {
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
      notificationId: `staging-dashboard-self-test-${Date.now()}`
    }, { kind: "test" });
  };

  const dismissPushPrompt = async () => {
    if (stagingNotificationFlow) {
      setPushPrompt((current) => ({
        ...current,
        show: true,
        status: "La invitación seguirá disponible en staging hasta registrar este dispositivo."
      }));
      return;
    }
    if (profile?.uid) localStorage.setItem(`roca-eterna-push-prompt-dismissed-${profile.uid}`, "true");
    await saveUserPreferences?.({ dismissedPushPromptByUser: true });
    setPushPrompt({ checked: true, show: false, status: "" });
  };

  return (
    <div className="space-y-6">
      <AndroidNotificationPermissionWizard
        open={showAndroidNotificationWizard}
        onClose={() => setShowAndroidNotificationWizard(false)}
        onActivate={completePushActivation}
        onTest={sendStagingSelfTest}
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
              <Link to={canEdit ? "/programacion" : "/musicos"}>
                <Button variant={upcoming ? "darkSubtle" : "light"}>
                  <CalendarPlus className="h-4 w-4" />
                  {canEdit ? (upcoming ? "Abrir programación" : "Crear próxima programación") : "Ver próximo servicio"}
                </Button>
              </Link>
              {canEdit ? (
                <>
                  <Link to="/inteligente">
                    <Button variant="darkSubtle">
                      <Sparkles className="h-4 w-4" />
                      Ir al Centro Inteligente
                    </Button>
                  </Link>
                  <Link to="/repertorio">
                    <Button variant="darkSubtle">
                      <ListPlus className="h-4 w-4" />
                      Agregar canto
                    </Button>
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink/55">Tiempo restante</p>
              <p className={`${upcoming ? "text-5xl" : "text-2xl leading-tight"} mt-2 font-bold text-ink`}>{remaining}</p>
              {!upcoming ? <p className="mt-2 text-sm text-ink/55">Crea una programación para activar el contador.</p> : null}
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
          <StatCard icon={FileClock} label="PDF principal pendiente" value={missingPdfLinks} detail="Cantos sin PDF Drive o principal registrado" delay={0.05} />
          <StatCard icon={Sparkles} label="Revisión Keynote pendiente" value={keynotePending} detail="Cantos sin Keynote completado" delay={0.1} />
          <StatCard icon={RotateCcw} label="Más usados este mes" value={monthTopSongs[0]?.count || "--"} detail={monthTopSongs.length ? topDetail : "Sin historial este mes"} delay={0.15} />
        </section>
      ) : null}
      {!isViewer && monthTopSongs.length ? (
        <Card className="py-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm font-bold text-ink">Más usados este mes</p>
            {monthTopSongs.map((song) => (
              <Link key={song.id || song.title} to={song.id ? `/repertorio/${song.id}` : "/historial"} className="rounded-full bg-ink/5 px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-brass/12 hover:text-brass">
                {song.title} · {song.count}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
