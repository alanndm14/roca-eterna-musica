import { useEffect, useState } from "react";
import { Database, LogOut, Save, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Field";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";

export function Settings() {
  const { profile, isAdmin, signOut } = useAuth();
  const { settings, users, allowedEmails, saveSettings, saveUser, seedExampleData } = useMusicData();
  const [localSettings, setLocalSettings] = useState(settings);
  const [newUser, setNewUser] = useState({ email: "", displayName: "", role: "viewer", active: true });
  const userRows = [
    ...users,
    ...allowedEmails.filter((allowed) => !users.some((user) => user.email === allowed.email))
  ];

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Card>
          <h2 className="text-xl font-bold text-ink">Preferencias</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre de la iglesia">
              <Input
                value={localSettings.churchName || ""}
                disabled={!isAdmin}
                onChange={(event) => setLocalSettings((current) => ({ ...current, churchName: event.target.value }))}
              />
            </Field>
            <Field label="Nombre de la app">
              <Input
                value={localSettings.appName || ""}
                disabled={!isAdmin}
                onChange={(event) => setLocalSettings((current) => ({ ...current, appName: event.target.value }))}
              />
            </Field>
            <Field label="Logo URL">
              <Input
                value={localSettings.logoUrl || ""}
                disabled={!isAdmin}
                placeholder="Opcional"
                onChange={(event) => setLocalSettings((current) => ({ ...current, logoUrl: event.target.value }))}
              />
            </Field>
          </div>
          {isAdmin ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => saveSettings(localSettings)}><Save className="h-4 w-4" />Guardar ajustes</Button>
              <Button variant="secondary" onClick={seedExampleData}><Database className="h-4 w-4" />Cargar datos de ejemplo</Button>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-ink">Correos autorizados</h2>
          <p className="mt-1 text-sm text-ink/55">Solo administradores pueden cambiar roles y acceso.</p>

          {isAdmin ? (
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_140px_120px]">
              <Input placeholder="correo@gmail.com" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} />
              <Input placeholder="Nombre visible" value={newUser.displayName} onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))} />
              <Select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}>
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </Select>
              <Button
                onClick={async () => {
                  if (!newUser.email) return;
                  await saveUser(newUser);
                  setNewUser({ email: "", displayName: "", role: "viewer", active: true });
                }}
              >
                <UserPlus className="h-4 w-4" />
                Agregar
              </Button>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {userRows.map((user) => (
              <div key={user.id || user.email} className="grid gap-3 rounded-2xl bg-ink/5 p-3 md:grid-cols-[1fr_150px_120px] md:items-center">
                <div>
                  <p className="font-semibold text-ink">{user.displayName || user.email}</p>
                  <p className="text-sm text-ink/55">{user.email}</p>
                </div>
                {isAdmin ? (
                  <Select value={user.role} onChange={(event) => saveUser({ ...user, role: event.target.value })}>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </Select>
                ) : <span className="text-sm font-semibold">{user.role}</span>}
                {isAdmin ? (
                  <Button variant={user.active ? "secondary" : "danger"} onClick={() => saveUser({ ...user, active: !user.active })}>
                    {user.active ? "Activo" : "Inactivo"}
                  </Button>
                ) : <span className="text-sm">{user.active ? "Activo" : "Inactivo"}</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-xl font-bold text-ink">Mi sesión</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Nombre</dt><dd className="text-right font-semibold">{profile?.displayName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Correo</dt><dd className="text-right font-semibold">{profile?.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Rol</dt><dd className="font-semibold">{profile?.role}</dd></div>
          </dl>
          <Button variant="danger" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-ink">Seguridad</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            La lista visual ayuda a administrar el ministerio, pero la protección real debe estar en Firestore Rules. Mantén `firestore.rules` actualizado antes de publicar.
          </p>
        </Card>
      </aside>
    </div>
  );
}
