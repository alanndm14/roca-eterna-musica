import { useEffect, useMemo, useState } from "react";
import { Database, FileSearch, HelpCircle, Image as ImageIcon, LogOut, Palette, Save, Tags, Trash2, Upload, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { FileDiagnosticPanel } from "../components/ui/FileDiagnosticPanel";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../hooks/useAuth";
import { useMusicData } from "../hooks/useMusicData";
import { analyzeImport, parseSongsTable } from "../services/importSongs";
import { canonicalThemeKey, collectSongThemes, getInstitutionalLogo, normalizeThemeName, resolvePublicAssetUrl, shouldInvertInstitutionalLogo } from "../services/songUtils";
import { diagnosePublicAsset } from "../services/publicPdfTools";
import { appLogo, fallbackAppLogo } from "../assets/logo";

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
  const { profile, isAdmin, signOut, saveUserPreferences } = useAuth();
  const isEditor = profile?.role === "editor";
  const isViewer = profile?.role === "viewer";
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
    removeUserAccess,
    indexLocalPdfTexts,
    seedExampleData
  } = useMusicData();
  const [localSettings, setLocalSettings] = useState(settings);
  const [personalSettings, setPersonalSettings] = useState({
    preferredDisplayName: profile?.preferredDisplayName || "",
    themeMode: profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system",
    accentColor: profile?.accentColor || localStorage.getItem("roca-eterna-accent-color") || defaultColors.accentColor,
    blueGrayColor: profile?.blueGrayColor || defaultColors.blueGrayColor
  });
  const [newUser, setNewUser] = useState({ email: "", displayName: "", role: "viewer", active: true });
  const [newTheme, setNewTheme] = useState("");
  const [themeQuery, setThemeQuery] = useState("");
  const [themeFilter, setThemeFilter] = useState("all");
  const [editingTheme, setEditingTheme] = useState(null);
  const [mergeThemeSource, setMergeThemeSource] = useState(null);
  const [mergeThemeTarget, setMergeThemeTarget] = useState("");
  const [importText, setImportText] = useState("");
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState("skip");
  const [importResult, setImportResult] = useState(null);
  const [pdfIndexResult, setPdfIndexResult] = useState(null);
  const [isIndexingPdfs, setIsIndexingPdfs] = useState(false);
  const [pdfIndexProgress, setPdfIndexProgress] = useState(null);
  const [logoTest, setLogoTest] = useState(null);
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

    const duplicateKeys = new Set();
    const seen = new Map();
    rows.forEach((theme) => {
      const key = canonicalThemeKey(theme.name);
      if (seen.has(key)) duplicateKeys.add(key);
      seen.set(key, true);
    });

    return rows
      .filter((theme) => !theme.ignored)
      .filter((theme) => !themeQuery || theme.name.toLowerCase().includes(themeQuery.toLowerCase()))
      .filter((theme) => {
        if (themeFilter === "official") return !theme.detectedOnly;
        if (themeFilter === "detected") return theme.detectedOnly;
        if (themeFilter === "active") return theme.active !== false;
        if (themeFilter === "inactive") return theme.active === false;
        if (themeFilter === "duplicates") return duplicateKeys.has(canonicalThemeKey(theme.name));
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [songs, themes, themeFilter, themeQuery]);

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

  useEffect(() => {
    setPersonalSettings({
      preferredDisplayName: profile?.preferredDisplayName || "",
      themeMode: profile?.themeMode || localStorage.getItem("roca-eterna-theme-mode") || "system",
      accentColor: profile?.accentColor || localStorage.getItem("roca-eterna-accent-color") || defaultColors.accentColor,
      blueGrayColor: profile?.blueGrayColor || defaultColors.blueGrayColor
    });
  }, [profile]);

  const updateSettings = (field, value) => {
    setLocalSettings((current) => ({ ...current, [field]: value }));
  };

  const updatePersonal = (field, value) => {
    setPersonalSettings((current) => ({ ...current, [field]: value }));
  };

  const lightLogo = getInstitutionalLogo(localSettings, appLogo, "light");
  const darkLogo = getInstitutionalLogo(localSettings, appLogo, "dark");
  const lightLogoSource = localSettings.logoLightUrl || localSettings.logoFallbackUrl || localSettings.logoUrl || localSettings.logoLocalPath || "";
  const darkLogoSource = localSettings.logoDarkUrl || localSettings.logoFallbackUrl || localSettings.logoUrl || localSettings.logoLocalPath || "";

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

  const deleteAccessUser = async (user) => {
    const isSelf = user.email?.toLowerCase() === profile?.email?.toLowerCase();
    if (isSelf) {
      alert("No puedes eliminar tu propio acceso.");
      return;
    }
    if (user.role === "admin" && activeAdmins <= 1) {
      alert("Debe quedar al menos un administrador activo.");
      return;
    }
    if (!confirm("Esta persona perdera el acceso a la app. Esta accion quedara registrada.")) return;
    await removeUserAccess(user);
  };

  const statusForUser = (user) => {
    if (user.active === false) return "inactivo";
    return users.some((item) => item.email === user.email) ? "activo" : "pendiente de iniciar sesion";
  };

  const refreshApp = async () => {
    try {
      const keys = await caches?.keys?.();
      await Promise.all((keys || []).map((key) => caches.delete(key)));
      const registrations = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((registrations || []).map((registration) => registration.update().catch(() => registration.unregister())));
    } catch {
      // Algunos navegadores limitan esta limpieza; recargar sigue siendo seguro.
    }
    if (confirm("La app intento limpiar cache. Recarga para ver la version mas reciente.")) {
      window.location.reload();
    }
  };

  const runPdfIndex = async () => {
    setIsIndexingPdfs(true);
    setPdfIndexResult(null);
    setPdfIndexProgress({ current: 0, total: songs.filter((item) => item.localPdfPath).length, songTitle: "", found: 0, indexed: 0, noText: 0, missing: 0, failed: 0 });
    try {
      const result = await indexLocalPdfTexts(setPdfIndexProgress);
      setPdfIndexResult(result);
    } finally {
      setIsIndexingPdfs(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <Card>
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Mis preferencias</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre para mostrar">
              <Input value={personalSettings.preferredDisplayName || ""} placeholder={profile?.displayName || profile?.email || ""} onChange={(event) => updatePersonal("preferredDisplayName", event.target.value)} />
            </Field>
            <Field label="Modo">
              <Select value={personalSettings.themeMode || "system"} onChange={(event) => updatePersonal("themeMode", event.target.value)}>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
                <option value="system">Sistema</option>
              </Select>
            </Field>
            <Field label="Acento personal">
              <Input type="color" value={personalSettings.accentColor || defaultColors.accentColor} onChange={(event) => updatePersonal("accentColor", event.target.value)} />
            </Field>
            <Field label="Acento secundario personal">
              <Input type="color" value={personalSettings.blueGrayColor || defaultColors.blueGrayColor} onChange={(event) => updatePersonal("blueGrayColor", event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => saveUserPreferences(personalSettings)}><Save className="h-4 w-4" />Guardar mis preferencias</Button>
            <Button variant="secondary" onClick={() => {
              const next = { ...personalSettings, accentColor: defaultColors.accentColor, blueGrayColor: defaultColors.blueGrayColor };
              setPersonalSettings(next);
              saveUserPreferences(next);
            }}>Restaurar colores por defecto</Button>
          </div>
        </Card>

        {isAdmin ? (
        <Card>
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Configuracion institucional</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nombre de la iglesia">
              <Input value={localSettings.churchName || ""} disabled={!isAdmin} onChange={(event) => updateSettings("churchName", event.target.value)} />
            </Field>
            <Field label="Nombre de la app">
              <Input value={localSettings.appName || ""} disabled={!isAdmin} onChange={(event) => updateSettings("appName", event.target.value)} />
            </Field>
            <Field label="Logo para modo claro">
              <Input value={localSettings.logoLightUrl || ""} disabled={!isAdmin} placeholder="/icons/logo-roca-negro.png" onChange={(event) => updateSettings("logoLightUrl", event.target.value)} />
              <p className="mt-2 text-xs leading-5 text-ink/55">Si el archivo esta en public/icons/logo.png, escribe /icons/logo.png. No es necesario escribir public/.</p>
            </Field>
            <Field label="Logo para modo oscuro">
              <Input value={localSettings.logoDarkUrl || ""} disabled={!isAdmin} placeholder="/icons/logo-roca-blanco.png" onChange={(event) => updateSettings("logoDarkUrl", event.target.value)} />
            </Field>
            <Field label="Logo con fondo, opcional">
              <Input value={localSettings.logoFallbackUrl || ""} disabled={!isAdmin} placeholder="/icons/logo-roca-fondo.png" onChange={(event) => updateSettings("logoFallbackUrl", event.target.value)} />
            </Field>
            <Field label="Texto alternativo del logo">
              <Input value={localSettings.logoAltText || ""} disabled={!isAdmin} placeholder="Roca Eterna Musica" onChange={(event) => updateSettings("logoAltText", event.target.value)} />
            </Field>
            <Field label="Preferencia de tonalidad">
              <Select value={localSettings.keyPreference || "sharps"} disabled={!isAdmin} onChange={(event) => updateSettings("keyPreference", event.target.value)}>
                <option value="sharps">Sostenidos (#)</option>
                <option value="flats">Bemoles (b)</option>
              </Select>
            </Field>
            <label className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/5 p-3 text-sm font-semibold text-ink">
              <input type="checkbox" checked={Boolean(localSettings.logoAutoInvert)} disabled={!isAdmin} onChange={(event) => updateSettings("logoAutoInvert", event.target.checked)} />
              Invertir logo automaticamente si falta una version
            </label>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink/55">
            Si tu logo es blanco/transparente, usa una version oscura para modo claro y una version clara para modo oscuro.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <LogoPreview
              title="Vista en modo claro"
              logo={lightLogo}
              source={lightLogoSource}
              alt={localSettings.logoAltText || "Roca Eterna Musica"}
              invert={shouldInvertInstitutionalLogo(localSettings, "light")}
              onDiagnose={async () => setLogoTest(await diagnosePublicAsset(lightLogoSource, "image"))}
            />
            <LogoPreview
              title="Vista en modo oscuro"
              logo={darkLogo}
              source={darkLogoSource}
              alt={localSettings.logoAltText || "Roca Eterna Musica"}
              dark
              invert={shouldInvertInstitutionalLogo(localSettings, "dark")}
              onDiagnose={async () => setLogoTest(await diagnosePublicAsset(darkLogoSource, "image"))}
            />
          </div>
          <FileDiagnosticPanel result={logoTest} />
          {isAdmin ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => saveSettings(localSettings)}><Save className="h-4 w-4" />Guardar ajustes</Button>
              <Button variant="secondary" onClick={() => setLocalSettings((current) => ({ ...current, logoLightUrl: "", logoDarkUrl: "", logoFallbackUrl: "", logoAltText: "", logoAutoInvert: false }))}>Restaurar logo por defecto</Button>
            </div>
          ) : null}
        </Card>
        ) : null}

        {isAdmin || isEditor ? (
        <Card>
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Temas del repertorio</h2>
          </div>
          <p className="mt-1 text-sm text-ink/55">Los filtros tambien incluyen temas detectados automaticamente en el repertorio.</p>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_320px]">
            <Input placeholder="Buscar tema" value={themeQuery} onChange={(event) => setThemeQuery(event.target.value)} />
            <Select value={themeFilter} onChange={(event) => setThemeFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="official">Oficiales</option>
              <option value="detected">Detectados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="duplicates">Posibles duplicados</option>
            </Select>
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
          <div className="mt-4 text-sm font-semibold text-ink/55">{themeRows.length} temas visibles</div>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-white dark:border-white/10 dark:bg-white/5">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-ink/5 text-xs uppercase tracking-wide text-ink/45 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                <tr>
                  <th className="px-3 py-3">Tema</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Cantos</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {themeRows.map((theme) => (
                  <tr key={theme.id || theme.name} className="border-b border-ink/10 last:border-b-0 hover:bg-ink/5 dark:border-white/10 dark:hover:bg-white/5">
                    <td className="px-3 py-3">
                      {editingTheme?.id === theme.id ? (
                        <Input value={editingTheme.name} onChange={(event) => setEditingTheme((current) => ({ ...current, name: event.target.value }))} />
                      ) : (
                        <span className="font-semibold text-ink">{theme.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${theme.active === false ? "bg-ink/10 text-ink/55 dark:bg-white/10 dark:text-white/60" : "bg-brass/15 text-brass"}`}>
                        {theme.active === false ? "Inactivo" : "Activo"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink/60">{theme.count}</td>
                    <td className="px-3 py-3 text-ink/60">{theme.detectedOnly ? "Detectado automaticamente" : "Oficial"}</td>
                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {editingTheme?.id === theme.id ? (
                            <>
                              <Button onClick={async () => {
                                await saveTheme(editingTheme);
                                setEditingTheme(null);
                              }}>Guardar</Button>
                              <Button variant="subtle" onClick={() => setEditingTheme(null)}>Cancelar</Button>
                            </>
                          ) : theme.detectedOnly ? (
                            <>
                              <Button variant="secondary" onClick={() => saveTheme({ name: theme.name, active: true })}>Convertir</Button>
                              <Button variant="secondary" onClick={() => {
                                setMergeThemeSource(theme);
                                setMergeThemeTarget("");
                              }}>Fusionar</Button>
                              <Button variant="danger" onClick={() => saveTheme({ name: theme.name, active: false, ignored: true })}>Ignorar</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="secondary" onClick={() => setEditingTheme(theme)}>Editar</Button>
                              <Button variant="secondary" onClick={() => saveTheme({ ...theme, active: theme.active === false })}>
                                {theme.active !== false ? "Desactivar" : "Activar"}
                              </Button>
                              <Button variant="subtle" onClick={() => {
                                setMergeThemeSource(theme);
                                setMergeThemeTarget("");
                              }}>Fusionar</Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink/40">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!themeRows.length ? (
              <div className="p-6 text-center text-sm font-semibold text-ink/50">No hay temas con esos filtros.</div>
            ) : null}
          </div>
        </Card>
        ) : null}

        <Modal open={Boolean(mergeThemeSource)} title="Fusionar tema" onClose={() => setMergeThemeSource(null)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-ink/60">
              El tema <strong>{mergeThemeSource?.name}</strong> se reemplazara por el tema oficial que elijas.
            </p>
            <Field label="Tema destino">
              <Select value={mergeThemeTarget} onChange={(event) => setMergeThemeTarget(event.target.value)}>
                <option value="">Selecciona un tema oficial</option>
                {themeRows.filter((target) => target.name !== mergeThemeSource?.name && !target.detectedOnly).map((target) => (
                  <option key={target.id || target.name} value={target.name}>{target.name}</option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="subtle" onClick={() => setMergeThemeSource(null)}>Cancelar</Button>
              <Button disabled={!mergeThemeTarget} onClick={async () => {
                await mergeTheme(mergeThemeSource.name, mergeThemeTarget);
                setMergeThemeSource(null);
                setMergeThemeTarget("");
              }}>Fusionar</Button>
            </div>
          </div>
        </Modal>

        {isAdmin ? (
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
                <span className="text-sm text-ink/55">{fileName || "Ningun archivo seleccionado"}</span>
              </div>
            </Field>
            <Field label="Texto CSV / TSV">
              <Textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Pega aqui tu tabla..." />
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
                  "Pega tu tabla o sube un archivo para previsualizar la importacion."
                ) : (
                  <span>
                    Detectados <strong>{importSummary.detected}</strong> - Nuevos <strong>{importSummary.news}</strong> - Duplicados <strong>{importSummary.duplicates}</strong> - Con errores <strong>{parsedImport.errors.length}</strong>
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
        ) : null}

        {isAdmin ? (
        <Card>
          <div className="flex items-center gap-3">
            <FileSearch className="h-5 w-5 text-brass" />
            <h2 className="text-xl font-bold text-ink">Busqueda dentro de PDFs locales</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Indexa solo PDFs accesibles desde public/pdfs. No muestra letras completas; guarda texto normalizado para encontrar cantos por palabras.
          </p>
          <Button className="mt-4" variant="secondary" isLoading={isIndexingPdfs} disabled={isIndexingPdfs} onClick={runPdfIndex}>
            <FileSearch className="h-4 w-4" />
            {isIndexingPdfs ? "Indexando PDFs..." : "Indexar textos de PDFs locales"}
          </Button>
          {pdfIndexProgress ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/5 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink/70">
                <span>{isIndexingPdfs ? "Indexando PDFs..." : "Proceso terminado"}</span>
                <span>{pdfIndexProgress.current || 0} / {pdfIndexProgress.total || 0}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-brass transition-all" style={{ width: `${pdfIndexProgress.total ? Math.round(((pdfIndexProgress.current || 0) / pdfIndexProgress.total) * 100) : 0}%` }} />
              </div>
              <p className="mt-3 text-sm text-ink/55">{pdfIndexProgress.songTitle ? `Procesando: ${pdfIndexProgress.songTitle}` : "Preparando indice..."}</p>
              <p className="mt-2 text-xs font-semibold text-ink/50">
                Encontrados {pdfIndexProgress.found || 0} - Indexados {pdfIndexProgress.indexed || 0} - Sin texto {pdfIndexProgress.noText || 0} - No encontrados {pdfIndexProgress.missing || 0} - Errores {pdfIndexProgress.failed || 0}
              </p>
            </div>
          ) : null}
          {pdfIndexResult ? (
            <p className="mt-3 text-sm font-semibold text-ink/60">
              Encontrados {pdfIndexResult.found}, indexados {pdfIndexResult.indexed}, sin texto {pdfIndexResult.noText}, no encontrados {pdfIndexResult.missing}, errores {pdfIndexResult.failed}
            </p>
          ) : null}
        </Card>
        ) : null}

        {isAdmin ? (
          <Card data-tour="settings-access">
            <h2 className="text-xl font-bold text-ink">Correos autorizados</h2>
            <p className="mt-1 text-sm text-ink/55">Autoriza correos antes de que entren con Google. Los usuarios reales aparecen despues de iniciar sesion.</p>
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
                <div key={user.id || user.email} className="grid gap-3 rounded-2xl bg-ink/5 p-3 md:grid-cols-[1fr_140px_130px_105px_105px] md:items-center">
                  <div>
                    <p className="font-semibold text-ink">{user.displayName || user.email}</p>
                    <p className="text-sm text-ink/55">{user.email}</p>
                    <p className="text-xs text-ink/45">Ultimo acceso: {formatAccessDate(user.lastLogin)}</p>
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
                  <Button variant="danger" onClick={() => deleteAccessUser(user)}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar
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
              onClick={() => confirm("Ya tienes repertorio real. Cargar datos de ejemplo puede duplicar o ensuciar la base. Continuar?") && seedExampleData()}
            >
              <Database className="h-4 w-4" />
              Cargar datos de ejemplo
            </Button>
          </Card>
        ) : null}
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-xl font-bold text-ink">Mi sesion</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Nombre</dt><dd className="text-right font-semibold text-ink">{profile?.displayName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Correo</dt><dd className="text-right font-semibold text-ink">{profile?.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink/50">Rol</dt><dd className="font-semibold text-ink">{profile?.role}</dd></div>
          </dl>
          <Button variant="danger" className="mt-6 w-full" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-ink">Ayuda</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">Abre de nuevo la guia interactiva para repasar como usar cada seccion de la app.</p>
          <Button className="mt-4 w-full" variant="secondary" onClick={() => window.dispatchEvent(new Event("roca-eterna-open-guide"))}>
            <HelpCircle className="h-4 w-4" />
            Ver guia otra vez
          </Button>
        </Card>

        {!isViewer ? (
        <Card>
          <h2 className="text-xl font-bold text-ink">Actualizar app</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">Limpia cache local y pide recargar si la PWA muestra una version vieja.</p>
          <Button className="mt-4 w-full" variant="secondary" onClick={refreshApp}>Actualizar app</Button>
        </Card>
        ) : null}

        {!isViewer ? (
        <Card>
          <h2 className="text-xl font-bold text-ink">Seguridad</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            La proteccion real depende de Firebase Authentication y las reglas publicadas en Firestore. Archivo local de referencia: firebase2.rules.
          </p>
        </Card>
        ) : null}
      </aside>
    </div>
  );
}

function LogoPreview({ title, logo, source, alt, dark = false, invert = false, onDiagnose }) {
  const resolvedUrl = source ? resolvePublicAssetUrl(source) : "";
  const previewLabel = resolvedUrl || "Logo por defecto";

  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-white/10 bg-ink text-white" : "border-ink/10 bg-white text-ink"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-bold ${dark ? "text-white" : "text-ink"}`}>{title}</p>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${dark ? "bg-white/10 text-white/70" : "bg-ink/5 text-ink/55"}`}>
          {source ? "Configurado" : "Fallback"}
        </span>
      </div>
      <div className={`mt-3 flex h-28 items-center justify-center rounded-2xl border ${dark ? "border-white/10 bg-black" : "border-ink/10 bg-stonewash"}`}>
        <img src={logo || fallbackAppLogo} alt={alt} className={`max-h-24 max-w-full object-contain ${invert ? "invert" : ""}`} />
      </div>
      <div className={`mt-3 space-y-1 text-xs ${dark ? "text-white/60" : "text-ink/55"}`}>
        <p className="break-all">Ruta guardada: {source || "Logo por defecto"}</p>
        <p className="break-all">URL resuelta: {previewLabel}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onDiagnose} disabled={!source}>Probar logo</Button>
        <Button
          variant="subtle"
          disabled={!resolvedUrl}
          onClick={() => resolvedUrl && window.open(resolvedUrl, "_blank", "noopener,noreferrer")}
        >
          Abrir URL resuelta
        </Button>
      </div>
    </div>
  );
}
