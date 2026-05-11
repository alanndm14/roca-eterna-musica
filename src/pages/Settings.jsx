import { useEffect, useMemo, useState } from "react";
import { Database, LogOut, Palette, Save, Tags, Upload, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { analyzeImport, parseSongsTable } from "../services/importSongs";
import { canonicalThemeKey, collectSongThemes, normalizeThemeName } from "../services/songUtils";

const defaultColors = {
  accentColor: "#b6945f",
  blueGrayColor: "#60717d"
};

const formatAccessDate = (value) => {
  if (!value) return "Pendiente";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pendiente" : date.toLocaleDateString("es-MX");
};

export function Settings() {
  const { profile, isAdmin, signOut } = useAuth();
  const {
    settings,
    songs,
    users,
    themes,
    authorizedEmails,
    saveSettings,
    saveUser,
    saveTheme,
    mergeTheme,
    importSongs,
    seedExampleData
  } = useMusicData();
  const [localSettings, setLocalSettings] = useState(settings);
  const [newUser, setNewUser] = useState({ email: "", displayName: "", role: "viewer", active: true });
  const [newTheme, setNewTheme] = useState("");
  const [themeQuery, setThemeQuery] = useState("");
  const [editingTheme, setEditingTheme] = useState(null);
  const [mergeTargets, setMergeTargets] = useState({});
  const [importText, setImportText] = useState("");
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState("skip");
  const [importResult, setImportResult] = useState(null);
  const parsedImport = useMemo(() => parseSongsTable(importText, localSettings.keyPreference || "sharps"), [importText, localSettings.keyPreference]);
  const importSummary = useMemo(() => analyzeImport(parsedImport.songs, songs), [parsedImport.songs, songs]);

  const themeRows = useMemo(() => {
    const counts = new Map();
    songs.forEach((song) => {
      [song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].forEach((theme) => {
        const name = normalizeThemeName(theme);
        if (!name) return;
        const key = canonicalThemeKey(name);
        counts.set(key, { name, count: (counts.get(key)?.count || 0) + 1 });
      });
    });

    const configuredByKey = new Map(themes.map((theme) => [canonicalThemeKey(theme.name), theme]));
    const rows = collectSongThemes(songs, themes).map((name) => {
      const key = canonicalThemeKey(name);
      const configured = configuredByKey.get(key);
      return {
        ...(configured || { id: `detected-${key}`, name, active: true, detectedOnly: true }),
        name: configured?.name || name,
        count: counts.get(key)?.count || 0,
        detectedOnly: !configured
      };
    });

    return rows
      .filter((theme) => !theme.ignored)
      .filter((theme) => !themeQuery || theme.name.toLowerCase().includes(themeQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [songs, themes, themeQuery]);

  const userRows = useMemo(() => {
    const byEmail = new Map();
    authorizedEmails.forEach((allowed) => byEmail.set(allowed.email, { ...allowed, source: "authorized" }));
    users.forEach((user) => {
      const existing = byEmail.get(user.email) || {};
      byEmail.set(user.email, { ...existing, ...user, source: "user" });
    });
    return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [authorizedEmails, users]);

  const activeAdmins = userRows.filter((user) => user.active !== false && user.role === "admin").length;

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSettings = (field, value) => {
    setLocalSettings((current) => ({ ...current, [field]: value }));
  };

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setImportText(await file.text());
  };

  const saveAccessUser = async (user) => {
    const isSelf = user.email?.toLowerCase() === profile?.email?.toLowerCase();
    const removingAdmin = user.role !== "admin" && userRows.find((row) => row.email === user.email)?.role === "admin";
    const deactivatingAdmin = user.active === false && userRows.find((row) => row.email === user.email)?.role === "admin";
    if (isSelf && (user.active === false || user.role !== "admin")) {
      alert("No puedes quitarte tu propio acceso de administrador.");
      return;
    }
    if ((removingAdmin || deactivatingAdmin) && activeAdmins <= 1) {
      alert("Debe quedar al menos un administrador activo.");
      return;
    }
    await saveUser(user);
  };

  const statusForUser = (user) => {
    if (user.active === false) return "inactivo";
    return users.some((item) => item.email === user.email) ? "activo" : "pendiente de iniciar sesión";
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
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
                <option value="system">Sistema</option>
              </Select>
            </Field>
            <Field label="Acento principal">
              <Input type="color" value={localSettings.accentColor || defaultColors.accentColor} disabled={!isAdmin} onChange={(event) => updateSettings("accentColor", event.target.value)} />
            </Field>
            <Field label="Acento secundario">
              <Input type="color" value={localSettings.blueGrayColor || defaultColors.blueGrayColor} disabled={!isAdmin} onChange={(event) => updateSettings("blueGrayColor", event.target.value)} />
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
              <Button variant="secondary" onClick={() => setLocalSettings((current) => ({ ...current, ...defaultColors }))}>Restaurar colores por defecto</Button>
            </div>
          ) : null}
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Temas del repertorio</h2>
          </div>
          <p className="mt-1 text-sm text-ink/55">Los filtros también incluyen temas detectados automáticamente en el repertorio.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <Input placeholder="Buscar tema" value={themeQuery} onChange={(event) => setThemeQuery(event.target.value)} />
            {isAdmin ? (
              <div className="flex gap-2">
                <Input placeholder="Nuevo tema" value={newTheme} onChange={(event) => setNewTheme(event.target.value)} />
                <Button onClick={async () => {
                  await saveTheme({ name: newTheme, active: true });
                  setNewTheme("");
                }}>Agregar</Button>
              </div>
            ) : null}
          </div>
          <div className="mt-5 space-y-3">
            {themeRows.map((theme) => {
              const mergeTarget = mergeTargets[theme.id] || "";
              return (
                <div key={theme.id || theme.name} className="rounded-2xl bg-ink/5 p-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_120px] md:items-center">
                    {editingTheme?.id === theme.id ? (
                      <Input value={editingTheme.name} onChange={(event) => setEditingTheme((current) => ({ ...current, name: event.target.value }))} />
                    ) : (
                      <div>
                        <p className="font-semibold text-ink">{theme.name}</p>
                        <p className="text-xs text-ink/45">
                          {theme.detectedOnly ? "Detectado automáticamente en el repertorio" : theme.active === false ? "Tema oficial inactivo" : "Tema oficial activo"} · {theme.count} cantos
                        </p>
                      </div>
                    )}
                    {isAdmin ? (
                      editingTheme?.id === theme.id ? (
                        <Button onClick={async () => {
                          await saveTheme(editingTheme);
                          setEditingTheme(null);
                        }}>Guardar</Button>
                      ) : theme.detectedOnly ? (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => saveTheme({ name: theme.name, active: true })}>Convertir</Button>
                          <Button variant="danger" onClick={() => saveTheme({ name: theme.name, active: false, ignored: true })}>Ignorar</Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => setEditingTheme(theme)}>Editar</Button>
                          <Button variant={theme.active !== false ? "secondary" : "danger"} onClick={() => saveTheme({ ...theme, active: theme.active === false })}>
                            {theme.active !== false ? "Activo" : "Inactivo"}
                          </Button>
                        </div>
                      )
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_130px]">
                      <Select value={mergeTarget} onChange={(event) => setMergeTargets((current) => ({ ...current, [theme.id]: event.target.value }))}>
                        <option value="">Fusionar con otro tema</option>
                        {themeRows.filter((target) => target.name !== theme.name && !target.detectedOnly).map((target) => (
                          <option key={target.id} value={target.name}>{target.name}</option>
                        ))}
                      </Select>
                      <Button variant="subtle" disabled={!mergeTarget} onClick={() => mergeTheme(theme.name, mergeTarget)}>Fusionar</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
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
              <div className="flex flex-wrap items-center gap-3">
                <input id="repertoire-file" className="sr-only" type="file" accept=".csv,.tsv,.txt" onChange={(event) => handleFile(event.target.files?.[0])} />
                <label htmlFor="repertoire-file" className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft ring-1 ring-ink/10 transition hover:ring-ink/25">
                  Seleccionar archivo
                </label>
                <span className="text-sm text-ink/55">{fileName || "Ningún archivo seleccionado"}</span>
              </div>
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
                {!importText.trim() ? (
                  "Pega tu tabla o sube un archivo para previsualizar la importación."
                ) : (
                  <span>
                    Detectados <strong>{importSummary.detected}</strong> · Nuevos <strong>{importSummary.news}</strong> · Duplicados <strong>{importSummary.duplicates}</strong> · Con errores <strong>{parsedImport.errors.length}</strong>
                  </span>
                )}
              </div>
            </div>
            {parsedImport.songs.length ? (
              <div className="max-h-72 overflow-auto rounded-2xl border border-ink/10 bg-white">
                <div className="grid grid-cols-[1.3fr_1fr_100px_90px] gap-3 border-b border-ink/10 p-3 text-xs font-bold uppercase tracking-wide text-ink/45">
                  <span>Nombre</span><span>Tema</span><span>Tono</span><span>Capo</span>
                </div>
                {parsedImport.songs.slice(0, 10).map((song) => (
                  <div key={song.importId} className="grid grid-cols-[1.3fr_1fr_100px_90px] gap-3 border-b border-ink/10 p-3 text-sm last:border-b-0">
                    <span className="font-semibold text-ink">{song.title}</span>
                    <span className="text-ink/60">{song.mainTheme || "--"}</span>
                    <span className="text-ink/60">{song.mainKey || "--"} / {song.keyWithCapo || "--"}</span>
                    <span className="text-ink/60">{song.capo || 0}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {parsedImport.errors.length ? (
              <div className="max-h-44 overflow-auto rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-bold">Errores detectados</p>
                {parsedImport.errors.slice(0, 8).map((error, index) => (
                  <p key={`${error.row}-${index}`}>Fila {error.row}: {error.message}</p>
                ))}
              </div>
            ) : null}
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={async () => setImportResult(await importSongs(parsedImport.songs, importMode))} disabled={!parsedImport.songs.length}>
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

        {isAdmin ? (
          <Card>
            <h2 className="text-xl font-bold text-ink">Correos autorizados</h2>
            <p className="mt-1 text-sm text-ink/55">Autoriza correos antes de que entren con Google. Los usuarios reales aparecen después de iniciar sesión.</p>
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
                await saveAccessUser(newUser);
                setNewUser({ email: "", displayName: "", role: "viewer", active: true });
              }}>
                <UserPlus className="h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {userRows.map((user) => (
                <div key={user.id || user.email} className="grid gap-3 rounded-2xl bg-ink/5 p-3 md:grid-cols-[1fr_150px_140px_120px] md:items-center">
                  <div>
                    <p className="font-semibold text-ink">{user.displayName || user.email}</p>
                    <p className="text-sm text-ink/55">{user.email}</p>
                    <p className="text-xs text-ink/45">Último acceso: {formatAccessDate(user.lastLogin)}</p>
                  </div>
                  <span className="text-sm font-semibold text-ink/60">{statusForUser(user)}</span>
                  <Select value={user.role || "viewer"} onChange={(event) => saveAccessUser({ ...user, role: event.target.value })}>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </Select>
                  <Button variant={user.active !== false ? "secondary" : "danger"} onClick={() => saveAccessUser({ ...user, active: user.active === false })}>
                    {user.active !== false ? "Activo" : "Inactivo"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {import.meta.env.DEV && isAdmin ? (
          <Card>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-brass" />
              <h2 className="text-xl font-bold text-ink">Herramientas de desarrollo</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Ya tienes repertorio real. Cargar datos de ejemplo puede duplicar o ensuciar la base.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => confirm("Ya tienes repertorio real. Cargar datos de ejemplo puede duplicar o ensuciar la base. ¿Continuar?") && seedExampleData()}
            >
              <Database className="h-4 w-4" />
              Cargar datos de ejemplo
            </Button>
          </Card>
        ) : null}
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-xl font-bold text-ink">Mi sesión</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Nombre</dt><dd className="text-right font-semibold text-ink">{profile?.displayName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Correo</dt><dd className="text-right font-semibold text-ink">{profile?.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Rol</dt><dd className="font-semibold text-ink">{profile?.role}</dd></div>
          </dl>
          <Button variant="danger" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-ink">Seguridad</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            La protección real depende de Firebase Authentication y las reglas publicadas en Firestore. Archivo local de referencia: firebase2.rules.
          </p>
        </Card>
      </aside>
    </div>
  );
}
