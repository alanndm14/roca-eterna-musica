import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, ExternalLink, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { requestSiteNotificationPermissionOnly } from "../../services/pushNotifications";
import { getNotificationDeviceContext } from "../../services/notificationDevice";

const permissionValue = () => (
  typeof Notification === "undefined" ? "no_soportado" : Notification.permission
);

export function AndroidNotificationPermissionWizard({
  open,
  onClose,
  onActivate,
  onTest,
  isWorking = false
}) {
  const [step, setStep] = useState(1);
  const [permission, setPermission] = useState(permissionValue);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const device = getNotificationDeviceContext();

  useEffect(() => {
    if (!open) return;
    const currentPermission = permissionValue();
    setPermission(currentPermission);
    setResult(null);
    setMessage("");
    setStep(currentPermission === "denied" ? 2 : 1);
  }, [open]);

  const requestDevicePermissionFromClick = async () => {
    setMessage("");
    const permissionResult = await requestSiteNotificationPermissionOnly();
    setPermission(permissionResult.permissionAfter);
    setStep(2);
    setMessage(permissionResult.error || (
      permissionResult.permissionAfter === "granted"
        ? "Permiso del dispositivo comprobado. Continúa para registrar esta página."
        : "Todavía falta permitir notificaciones para esta página."
    ));
  };

  const requestSitePermissionFromClick = async () => {
    setMessage("");
    const permissionResult = await requestSiteNotificationPermissionOnly();
    setPermission(permissionResult.permissionAfter);
    if (permissionResult.permissionAfter !== "granted") {
      setMessage(permissionResult.error || "Todavía falta permitir notificaciones para esta página.");
      return;
    }
    const activation = await onActivate();
    setResult(activation);
    setStep(activation?.supported ? 3 : 2);
    setMessage(activation?.reason || "");
  };

  return (
    <Modal open={open} title="Activar notificaciones" onClose={onClose} panelClassName="overflow-y-auto">
      <div className="max-h-[78dvh] space-y-4 overflow-y-auto overscroll-contain pr-1">
        <div className="flex flex-wrap gap-2 text-xs font-bold text-ink/55">
          <span className="rounded-full bg-ink/5 px-3 py-1">{device.standalone ? "App instalada" : "Chrome"}</span>
          <span className="rounded-full bg-ink/5 px-3 py-1">Android</span>
        </div>

        {step === 1 ? (
          <section className="rounded-2xl border border-brass/25 bg-brass/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-brass">Paso 1 de 2</p>
            <div className="mt-3 flex items-start gap-3">
              <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-brass" />
              <div>
                <h3 className="font-black text-ink">Permiso del dispositivo</h3>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  Android puede pedir primero permiso para que Chrome o la app instalada puedan mostrar notificaciones.
                </p>
              </div>
            </div>
            <Button className="mt-4 w-full" isLoading={isWorking} onClick={requestDevicePermissionFromClick}>
              Continuar
            </Button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-200">Paso 2 de 2</p>
            <div className="mt-3 flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-cyan-600 dark:text-cyan-300" />
              <div>
                <h3 className="font-black text-ink">Permiso de esta página</h3>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  Ahora falta autorizar este sitio para que Roca Eterna Música pueda enviarte avisos de nuevas programaciones y cantos.
                </p>
              </div>
            </div>
            {permission === "denied" ? (
              <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm leading-6 text-red-800 dark:text-red-100">
                Las notificaciones están bloqueadas para este sitio. Abre información del sitio, entra a Permisos y cambia Notificaciones a Permitir.
              </p>
            ) : (
              <Button className="mt-4 w-full" isLoading={isWorking} onClick={requestSitePermissionFromClick}>
                Permitir notificaciones de esta página
              </Button>
            )}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div>
                <h3 className="font-black text-ink">Este dispositivo ya puede recibir notificaciones.</h3>
                <p className="mt-1 text-sm leading-6 text-ink/65">
                  El permiso del sitio está concedido y el dispositivo quedó registrado.
                </p>
              </div>
            </div>
            <Button className="mt-4 w-full" variant="secondary" isLoading={isWorking} onClick={onTest}>
              <BellRing className="h-4 w-4" />
              Enviar prueba a este dispositivo
            </Button>
          </section>
        ) : null}

        {message ? <p className="rounded-xl bg-ink/5 p-3 text-sm leading-6 text-ink/65">{message}</p> : null}
        {result?.error ? <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-100">{result.error}</p> : null}

        {permission !== "granted" ? (
          <p className="flex gap-2 rounded-xl bg-ink/5 p-3 text-xs leading-5 text-ink/55">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
            Si Android bloqueó el permiso general, actívalo en Ajustes de Android, Notificaciones, Chrome o Roca Eterna Música.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
