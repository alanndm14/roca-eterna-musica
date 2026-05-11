import { useEffect, useMemo, useState } from "react";
import { Database, LogOut, Palette, Save, Tags, Upload, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { parseSongsTable } from "../services/importSongs";
import { collectSongThemes } from "../services/songUtils";

export function Settings() {
  const { profile, isAdmin, signOut } = useAuth();
  const {
    settings,
    songs,
    users,
    themes,
    allowedEmails,
    saveSettings,
    saveUser,
    saveTheme,
    importSongs,
    seedExampleData
  } = useMusicData();
  const [localSettings, setLocalSettings] = useState(settings);
  const [newUser, setNewUser] = useState({ email: "", displayName: "", role: "viewer", active: true });
  const [newTheme, setNewTheme] = useState("");
  const [editingTheme, setEditingTheme] = useState(null);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState("skip");
  const [importResult, setImportResult] = useState(null);
  const parsedSongs = useMemo(() => parseSongsTable(importText, localSettings.keyPreference || "sharps"), [importText, localSettings.keyPreference]);
  const themeRows = useMemo(() => {
    const used = collectSongThemes(songs, themes);
    const configured = new Map(themes.map((theme) => [theme.name, theme]));
    return used.map((name) => configured.get(name) || { id: `used-${name}`, name, active: true, usedOnly: true });
  }, [songs, themes]);
  const userRows = [
    ...users,
    ...allowedEmails.filter((allowed) => !users.some((user) => user.email === allowed.email))
  ];

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSettings = (field, value) => {
    setLocalSettings((current) => ({ ...current, [field]: value }));
  };

  const handleFile = async (file) => {
    if (!file) return;
    setImportText(await file.text());
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Card>
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Preferencias visuales</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre de la iglesia">
              <Input value={localSettings.churchName || ""} disabled={!isAdmin} onChange={(event) => updateSettings("churchName", event.target.value)} />
            </Field>
            <Field label="Nombre de la app">
              <Input value={localSettings.appName || ""} disabled={!isAdmin} onChange={(event) => updateSettings("appName", event.target.value)} />
            </Field>
            <Field label="Logo URL">
              <Input value={localSettings.logoUrl || ""} disabled={!isAdmin} placeholder="Opcional" onChange={(event) => updateSettings("logoUrl", event.target.value)} />
            </Field>
            <Field label="Modo">
              <Select value={localSettings.themeMode || "light"} disabled={!isAdmin} onChange={(event) => updateSettings("themeMode", event.target.value)}>
                <option value="light">claro</option>
                <option value="dark">oscuro</option>
              </Select>
            </Field>
            <Field label="Acento principal">
              <Input type="color" value={localSettings.accentColor || "#b6945f"} disabled={!isAdmin} onChange={(event) => updateSettings("accentColor", event.target.value)} />
            </Field>
            <Field label="Acento secundario">
              <Input type="color" value={localSettings.blueGrayColor || "#60717d"} disabled={!isAdmin} onChange={(event) => updateSettings("blueGrayColor", event.target.value)} />
            </Field>
            <Field label="Preferencia de tonalidad">
              <Select value={localSettings.keyPreference || "sharps"} disabled={!isAdmin} onChange={(event) => updateSettings("keyPreference", event.target.value)}>
                <option value="sharps">Sostenidos (#)</option>
                <option value="flats">Bemoles (b)</option>
              </Select>
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
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Temas del repertorio</h2>
          </div>
          <p className="mt-1 text-sm text-ink/55">Los filtros también incluyen temas detectados en cantos existentes.</p>
          {isAdmin ? (
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_140px]">
              <Input placeholder="Nuevo tema" value={newTheme} onChange={(event) => setNewTheme(event.target.value)} />
              <Button onClick={async () => {
                await saveTheme({ name: newTheme, active: true });
                setNewTheme("");
              }}>Agregar</Button>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {themeRows.map((theme) => (
              <div key={theme.id || theme.name} className="grid gap-3 rounded-2xl bg-ink/5 p-3 md:grid-cols-[1fr_120px] md:items-center">
                {editingTheme?.id === theme.id ? (
                  <Input value={editingTheme.name} onChange={(event) => setEditingTheme((current) => ({ ...current, name: event.target.value }))} />
                ) : (
                  <div>
                    <p className="font-semibold text-ink">{theme.name}</p>
                    {theme.usedOnly ? <p className="text-xs text-ink/45">Detectado en cantos</p> : null}
                  </div>
                )}
                {isAdmin && !theme.usedOnly ? (
                  editingTheme?.id === theme.id ? (
                    <Button onClick={async () => {
                      await saveTheme(editingTheme);
                      setEditingTheme(null);
                    }}>Guardar</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setEditingTheme(theme)}>Editar</Button>
                      <Button variant={theme.active ? "secondary" : "danger"} onClick={() => saveTheme({ ...theme, active: !theme.active })}>
                        {theme.active ? "Activo" : "Inactivo"}
                      </Button>
                    </div>
                  )
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Importar repertorio</h2>
          </div>
          <p className="mt-1 text-sm text-ink/55">
            Pega CSV/TSV con columnas: id, nombre, tema, otros_temas, categoria, cantado, tonalidad, capo, tonalidad_con_capo, cambio_de_tono, revision_musical, revision_keynote, revision_pdf, formato, comentario.
          </p>
          <div className="mt-5 grid gap-4">
            <Field label="Archivo CSV / TSV">
              <Input type="file" accept=".csv,.tsv,.txt" onChange={(event) => handleFile(event.target.files?.[0])} />
            </Field>
            <Field label="Texto CSV / TSV">
              <Textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Pega aquí tu tabla..." />
            </Field>
            <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
              <Field label="Duplicados por nombre">
                <Select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                  <option value="skip">Omitir existentes</option>
                  <option value="update">Actualizar existentes</option>
                </Select>
              </Field>
              <div className="rounded-2xl bg-ink/5 p-4 text-sm text-ink/62">
                Detectados: <strong>{parsedSongs.length}</strong> cantos. No se borra repertorio existente.
              </div>
            </div>
            {parsedSongs.length ? (
              <div className="max-h-56 overflow-auto rounded-2xl border border-ink/10 bg-white">
                {parsedSongs.slice(0, 8).map((song) => (
                  <div key={song.importId} className="grid grid-cols-[1fr_120px_120px] gap-3 border-b border-ink/10 p-3 text-sm last:border-b-0">
                    <span className="font-semibold">{song.title}</span>
                    <span>{song.mainTheme || "--"}</span>
                    <span>{song.mainKey || "--"} / {song.keyWithCapo || "--"}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={async () => setImportResult(await importSongs(parsedSongs, importMode))} disabled={!parsedSongs.length}>
                  Importar cantos
                </Button>
                {importResult ? (
                  <span className="text-sm font-semibold text-ink/60">
                    Creados {importResult.created}, actualizados {importResult.updated}, omitidos {importResult.skipped}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
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
              <Button onClick={async () => {
                if (!newUser.email) return;
                await saveUser(newUser);
                setNewUser({ email: "", displayName: "", role: "viewer", active: true });
              }}>
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
            La protección real está en Firebase Authentication y Firestore Rules. El archivo activo de reglas es `firebase2.rules`.
          </p>
        </Card>
      </aside>
    </div>
  );
}
