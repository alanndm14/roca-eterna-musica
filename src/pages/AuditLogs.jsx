import { useMemo, useState } from "react";
import { Download, FileClock } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Field";
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
  const { isAdmin, canEdit } = useAuth();
  const { auditLogs, users } = useMusicData();
  const [query, setQuery] = useState("");
  const [actionType, setActionType] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [userEmail, setUserEmail] = useState("all");

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

  if (!isAdmin && !canEdit) {
    return <Card><p className="text-sm text-ink/60">No tienes permiso para ver el registro de cambios.</p></Card>;
  }

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
                  <td className="px-3 py-3"><Button variant="subtle" disabled>Proxima version</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="p-4 text-sm text-ink/55">No hay registros para esos filtros.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("es-MX");
}
