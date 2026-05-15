import { useMemo, useState } from "react";
import { Download, FileClock, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const actionLabels = {
  create: "Creación",
  update: "Edición",
  delete: "Eliminación",
  restore: "Restauración",
  login: "Inicio de sesión",
  role_change: "Cambio de rol",
  access_added: "Acceso agregado",
  access_removed: "Acceso eliminado",
  access_disabled: "Acceso desactivado",
  access_enabled: "Acceso activado",
  import: "Importación",
  settings_update: "Configuración actualizada",
  notification_created: "Notificación creada"
};
const entityLabels = {
  song: "Canto",
  schedule: "Programación",
  theme: "Tema",
  user: "Usuario",
  authorizedEmail: "Correo autorizado",
  settings: "Configuración",
  pdf: "PDF",
  notification: "Notificación",
  other: "Otro"
};
const translateAuditAction = (value) => actionLabels[value] || value || "";
const translateEntityType = (value) => entityLabels[value] || value || "";

export function AuditLogs() {
  const { isAdmin } = useAuth();
  const { auditLogs, users, songs, schedules, themes, restoreFromAuditLog } = useMusicData();
  const [query, setQuery] = useState("");
  const [actionType, setActionType] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [userEmail, setUserEmail] = useState("all");
  const [restoreLog, setRestoreLog] = useState(null);
  const [restoreError, setRestoreError] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesText = !term || [log.summary, log.entityName, log.performedByName, log.performedByEmail].join(" ").toLowerCase().includes(term);
      const matchesAction = actionType === "all" || log.actionType === actionType;
      const matchesEntity = entityType === "all" || log.entityType === entityType;
      const matchesUser = userEmail === "all" || log.performedByEmail === userEmail;
      return matchesText && matchesAction && matchesEntity && matchesUser;
    });
  }, [actionType, auditLogs, entityType, query, userEmail]);

  if (!isAdmin) {
    return <Card><p className="text-sm text-ink/60">No tienes permiso para ver el registro de cambios.</p></Card>;
  }

  const getCurrentEntity = (log) => {
    if (log.entityType === "song") return songs.find((item) => item.id === log.entityId);
    if (log.entityType === "schedule") return schedules.find((item) => item.id === log.entityId);
    if (log.entityType === "theme") return themes.find((item) => item.id === log.entityId);
    return null;
  };

  const isRestorable = (log) => ["song", "schedule", "theme"].includes(log.entityType) && Boolean(log.beforeData && (log.entityId || log.beforeData.id));

  const hasLaterChanges = (log) => {
    const current = getCurrentEntity(log);
    if (!current || !log.afterData) return false;
    const clean = (value) => JSON.stringify(value || {}, Object.keys(value || {}).sort());
    return clean(current) !== clean({ ...log.afterData, id: log.entityId || log.afterData.id });
  };

  const confirmRestore = async () => {
    if (!restoreLog) return;
    setRestoreError("");
    try {
      await restoreFromAuditLog(restoreLog);
      setRestoreLog(null);
    } catch (error) {
      setRestoreError(error.message || "No se pudo restaurar este registro.");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["fecha", "accion", "entidad", "nombre", "usuario", "correo", "resumen"],
      ...filtered.map((log) => [log.createdAt, translateAuditAction(log.actionType), translateEntityType(log.entityType), log.entityName, log.performedByName, log.performedByEmail, log.summary])
    ];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "registro-de-cambios.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileClock className="h-5 w-5 text-brass" />
            <div>
              <h2 className="text-xl font-bold text-ink">Registro de cambios</h2>
              <p className="text-sm text-ink/55">Acciones hechas por usuarios en repertorio, programaciones, temas, accesos y configuracion.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" />Exportar CSV</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Input placeholder="Buscar accion, canto o usuario" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select value={actionType} onChange={(event) => setActionType(event.target.value)}>
            <option value="all">Todas las acciones</option>
            {[...new Set(auditLogs.map((log) => log.actionType).filter(Boolean))].map((value) => <option key={value} value={value}>{translateAuditAction(value)}</option>)}
          </Select>
          <Select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
            <option value="all">Todas las entidades</option>
            {[...new Set(auditLogs.map((log) => log.entityType).filter(Boolean))].map((value) => <option key={value} value={value}>{translateEntityType(value)}</option>)}
          </Select>
          <Select value={userEmail} onChange={(event) => setUserEmail(event.target.value)}>
            <option value="all">Todos los usuarios</option>
            {[...new Set([...users.map((user) => user.email), ...auditLogs.map((log) => log.performedByEmail)].filter(Boolean))].map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Accion</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Resumen</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Restaurar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-t border-ink/10">
                  <td className="px-3 py-3 text-ink/60">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-3 font-semibold text-ink">{translateAuditAction(log.actionType)}</td>
                  <td className="px-3 py-3 text-ink/60">{translateEntityType(log.entityType)}</td>
                  <td className="px-3 py-3 text-ink">{log.summary || log.entityName}</td>
                  <td className="px-3 py-3 text-ink/60">{log.performedByName || log.performedByEmail}</td>
                  <td className="px-3 py-3">
                    {isRestorable(log) ? (
                      <Button variant="secondary" onClick={() => setRestoreLog(log)}>
                        <RotateCcw className="h-4 w-4" />
                        Restaurar
                      </Button>
                    ) : ["song", "schedule", "theme"].includes(log.entityType) ? (
                      <span className="text-xs font-semibold text-ink/45">No disponible</span>
                    ) : (
                      <span className="text-xs font-semibold text-ink/45">No restaurable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="p-4 text-sm text-ink/55">No hay registros para esos filtros.</p> : null}
        </div>
      </Card>

      <Modal open={Boolean(restoreLog)} title="Restaurar desde auditoria" onClose={() => setRestoreLog(null)}>
        {restoreLog ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-ink/5 p-4 text-sm leading-6 text-ink/70">
              <p><strong>Entidad:</strong> {translateEntityType(restoreLog.entityType)}</p>
              <p><strong>Nombre:</strong> {restoreLog.entityName || restoreLog.beforeData?.title || restoreLog.beforeData?.serviceLabel || restoreLog.beforeData?.name || restoreLog.entityId}</p>
              <p><strong>Cambio:</strong> {translateAuditAction(restoreLog.actionType)} - {formatDate(restoreLog.createdAt)}</p>
              <p><strong>Usuario:</strong> {restoreLog.performedByName || restoreLog.performedByEmail || "Sin usuario"}</p>
            </div>
            {hasLaterChanges(restoreLog) ? (
              <p className="rounded-2xl border border-brass/30 bg-brass/10 p-4 text-sm font-semibold text-brass">
                Este elemento tuvo cambios posteriores. Restaurar podria sobrescribir informacion mas reciente.
              </p>
            ) : null}
            {restoreError ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/35 dark:text-red-100">{restoreError}</p> : null}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRestoreLog(null)}>Cancelar</Button>
              <Button onClick={confirmRestore}>
                <RotateCcw className="h-4 w-4" />
                Restaurar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("es-MX");
}
