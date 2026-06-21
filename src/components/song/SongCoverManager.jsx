import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useMusicData } from "../../hooks/useMusicData";
import {
  COVER_BACKGROUND_MODES,
  COVER_POSITIONS,
  getSongCoverUrl,
  normalizeCoverBackgroundMode,
  normalizeCoverBackgroundOpacity,
  normalizeCoverPosition,
  processSongCoverImage,
  removeSongCover,
  uploadSongCover
} from "../../services/songCover";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import { SongCoverImage } from "./SongCoverArtwork";

function timestampLabel(value) {
  if (!value) return "";
  const date = typeof value.toDate === "function"
    ? value.toDate()
    : Number.isFinite(value.seconds)
      ? new Date(value.seconds * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export function SongCoverManager({ song, onCoverChanged }) {
  const { profile } = useAuth();
  const { useLocal, saveSongCoverMetadata } = useMusicData();
  const fileInputRef = useRef(null);
  const [localCover, setLocalCover] = useState({});
  const current = useMemo(() => ({ ...song, ...localCover }), [localCover, song]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [position, setPosition] = useState(normalizeCoverPosition(current.coverPosition));
  const [backgroundMode, setBackgroundMode] = useState(normalizeCoverBackgroundMode(current.coverBackgroundMode));
  const [backgroundOpacity, setBackgroundOpacity] = useState(normalizeCoverBackgroundOpacity(current.coverBackgroundOpacity));
  const [accentColor, setAccentColor] = useState(current.coverAccentColor || "#b6945f");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const canManage = ["admin", "editor"].includes(profile?.role);
  const canDeletePermanently = profile?.role === "admin";
  const coverUrl = getSongCoverUrl({ ...current, coverEnabled: true });

  useEffect(() => {
    setPosition(normalizeCoverPosition(current.coverPosition));
    setBackgroundMode(normalizeCoverBackgroundMode(current.coverBackgroundMode));
    setBackgroundOpacity(normalizeCoverBackgroundOpacity(current.coverBackgroundOpacity));
    setAccentColor(current.coverAccentColor || "#b6945f");
  }, [
    current.coverAccentColor,
    current.coverBackgroundMode,
    current.coverBackgroundOpacity,
    current.coverPosition
  ]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!canManage) return null;

  const applyState = (updates) => {
    setLocalCover((value) => ({ ...value, ...updates }));
    onCoverChanged?.(updates);
  };

  const selectFile = (file) => {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Solo se permiten imágenes JPG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen original supera 5 MB.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const updateMetadata = async (updates, actionType) => {
    setBusy(true);
    setError("");
    setProgress("Actualizando el canto…");
    try {
      await saveSongCoverMetadata(current.id, updates, actionType);
      applyState(updates);
      setProgress("Portada actualizada");
    } catch (updateError) {
      setError(updateError.message || "No se pudo actualizar la portada.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!selectedFile || !current.id) return;
    setBusy(true);
    setError("");
    setProgress("Validando imagen…");
    try {
      const processed = await processSongCoverImage(
        selectedFile,
        { zoom, offsetX: offsetX / 100, offsetY: offsetY / 100 },
        setProgress
      );
      setProgress("Subiendo a GitHub…");
      let result;
      if (useLocal) {
        result = {
          coverImagePath: URL.createObjectURL(processed.blob),
          coverFileName: `${current.title || "canto"}.webp`,
          coverVersion: Date.now(),
          coverEnabled: true,
          coverPosition: position,
          coverIntensity: "medium",
          coverBackgroundMode: backgroundMode,
          coverBackgroundOpacity: backgroundOpacity,
          coverAccentColor: processed.accentColor,
          coverUpdatedAt: new Date().toISOString(),
          coverUpdatedBy: profile.uid,
          coverUpdatedByName: profile.preferredDisplayName || profile.displayName || "Demo"
        };
        await saveSongCoverMetadata(current.id, result, coverUrl ? "song_cover_replaced" : "song_cover_uploaded");
      } else {
        result = await uploadSongCover(current, processed, {
          coverEnabled: true,
          coverPosition: position,
          coverIntensity: "medium",
          coverBackgroundMode: backgroundMode,
          coverBackgroundOpacity: backgroundOpacity
        });
      }
      setProgress("Actualizando el canto…");
      applyState(result);
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setProgress(`Portada actualizada · ${(processed.size / 1024).toFixed(0)} KB · WebP ${processed.width}×${processed.height}. Puede tardar unos instantes en reflejarse en todos los dispositivos.`);
    } catch (uploadError) {
      setProgress("");
      setError(uploadError.message || "No se pudo actualizar la portada.");
    } finally {
      setBusy(false);
    }
  };

  const editFraming = async () => {
    if (!coverUrl || busy) return;
    setBusy(true);
    setError("");
    setProgress("Preparando la portada actual…");
    try {
      const response = await fetch(coverUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo abrir la portada actual.");
      const blob = await response.blob();
      const file = new File([blob], current.coverFileName || "portada.webp", { type: blob.type || "image/webp" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setProgress("Ajusta el encuadre y guarda la portada.");
    } catch (framingError) {
      setProgress("");
      setError(framingError.message || "No se pudo preparar la portada actual.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (mode) => {
    const permanent = mode === "delete";
    if (permanent && !confirm("¿Eliminar definitivamente esta portada?\n\nSe quitará de la app y también del repositorio de GitHub.\nEsta acción no se puede deshacer fácilmente.")) return;
    if (!permanent && !confirm("¿Quitar esta portada de la app? El archivo permanecerá en GitHub.")) return;
    setBusy(true);
    setError("");
    setProgress(permanent ? "Eliminando portada…" : "Quitando portada…");
    try {
      if (useLocal) await saveSongCoverMetadata(current.id, { removeCover: true }, permanent ? "song_cover_deleted" : "song_cover_unlinked");
      else await removeSongCover(current, mode);
      applyState({
        coverImagePath: "",
        coverFileName: "",
        coverVersion: "",
        coverEnabled: false,
        coverBackgroundMode: "image",
        coverBackgroundOpacity: 22,
        coverAccentColor: "",
        coverUpdatedAt: ""
      });
      setProgress(permanent ? "Portada eliminada" : "Portada quitada de la app");
    } catch (removeError) {
      setError(removeError.message || "No se pudo quitar la portada.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  const enabled = current.coverEnabled !== false;
  const saveBackgroundStyle = () => updateMetadata({
    coverEnabled: true,
    coverBackgroundMode: backgroundMode,
    coverBackgroundOpacity: backgroundOpacity,
    coverAccentColor: accentColor
  }, "song_cover_background_changed");

  return (
    <section className="rounded-2xl border border-ink/10 bg-ink/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-ink/5 dark:border-white/10 dark:bg-black/30">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-ink/45">
            <ImagePlus className="h-8 w-8" />
            <span className="text-xs font-bold">Sin portada</span>
          </div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Vista previa de la portada"
              className="relative z-[1] h-full w-full object-cover"
              style={{
                transform: `scale(${zoom}) translate(${offsetX / zoom}%, ${offsetY / zoom}%)`,
                objectPosition: "center"
              }}
            />
          ) : (
            <SongCoverImage song={{ ...current, coverEnabled: true }} wrapperClassName="relative z-[1] h-full w-full rounded-2xl" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-ink">Portada visual</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${coverUrl ? enabled ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-100" : "bg-amber-500/14 text-amber-800 dark:text-amber-100" : "bg-ink/7 text-ink/55"}`}>
              {coverUrl ? enabled ? "Portada activa" : "Portada desactivada" : "Sin portada"}
            </span>
          </div>
          {current.coverImagePath ? <p className="mt-2 break-all text-xs text-ink/50">Ruta: {current.coverImagePath}</p> : null}
          {timestampLabel(current.coverUpdatedAt) ? <p className="mt-1 text-xs text-ink/50">Última actualización: {timestampLabel(current.coverUpdatedAt)}</p> : null}
          {current.coverUpdatedByName ? <p className="mt-1 text-xs text-ink/50">Actualizada por: {current.coverUpdatedByName}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/55">
            <span>Acento</span>
            <span className="h-6 w-6 rounded-full border border-ink/10" style={{ backgroundColor: current.coverAccentColor || "#b6945f" }} />
            <span>{current.coverAccentColor || "#b6945f"}</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => fileInputRef.current?.click()} disabled={busy}>
              {coverUrl ? <RefreshCw className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
              {coverUrl ? "Reemplazar portada" : "Subir portada"}
            </Button>
            {coverUrl && !selectedFile ? <Button variant="secondary" onClick={editFraming} disabled={busy}>Editar encuadre</Button> : null}
            {selectedFile ? <Button variant="secondary" onClick={upload} isLoading={busy}><UploadCloud className="h-4 w-4" />Guardar portada</Button> : null}
          </div>
        </div>
      </div>

      {selectedFile ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-ink/10 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20 md:grid-cols-3">
          <Field label={`Zoom ${zoom.toFixed(1)}×`}>
            <Input type="range" min="1" max="2.5" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </Field>
          <Field label="Desplazamiento horizontal">
            <Input type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} />
          </Field>
          <Field label="Desplazamiento vertical">
            <Input type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} />
          </Field>
          <Button variant="subtle" onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0); }}>Restablecer encuadre</Button>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-ink/10 bg-white/65 p-4 dark:border-white/10 dark:bg-black/20">
        <h4 className="font-bold text-ink">Fondo de las tarjetas</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
          <Field label="Estilo de fondo">
            <Select value={backgroundMode} disabled={busy} onChange={(event) => setBackgroundMode(event.target.value)}>
              {COVER_BACKGROUND_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Color de acento">
            <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
              <Input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#b6945f"}
                disabled={busy}
                className="cursor-pointer p-1"
                onChange={(event) => setAccentColor(event.target.value)}
                aria-label="Elegir color de acento"
              />
              <Input
                value={accentColor}
                disabled={busy}
                maxLength={7}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(value)) setAccentColor(value);
                }}
                aria-label="Color de acento hexadecimal"
              />
            </div>
          </Field>
          <Field label={`Intensidad del color · ${backgroundOpacity}%`}>
            <Input
              type="range"
              min="4"
              max="60"
              step="1"
              value={backgroundOpacity}
              disabled={busy}
              onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
            />
          </Field>
          <Button variant="secondary" disabled={busy || !/^#[0-9a-fA-F]{6}$/.test(accentColor)} onClick={saveBackgroundStyle}>
            Guardar fondo
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-ink/50">
          “Solo color de acento” conserva la miniatura, pero usa únicamente el color elegido detrás del contenido.
        </p>
      </div>

      {coverUrl ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Posición de la imagen">
            <Select value={position} disabled={busy} onChange={(event) => {
              const next = event.target.value;
              setPosition(next);
              updateMetadata({ coverPosition: next }, "song_cover_position_changed");
            }}>
              {COVER_POSITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </Field>
          <Button variant="secondary" disabled={busy} onClick={() => updateMetadata({ coverEnabled: !enabled }, enabled ? "song_cover_disabled" : "song_cover_enabled")}>
            {enabled ? "Desactivar portada" : "Mostrar portada"}
          </Button>
          <Button variant="subtle" disabled={busy} onClick={() => remove("unlink")}>Quitar de la app</Button>
          {canDeletePermanently ? (
            <Button variant="danger" disabled={busy} onClick={() => remove("delete")}>
              <Trash2 className="h-4 w-4" />
              Eliminar definitivamente
            </Button>
          ) : null}
        </div>
      ) : null}
      {progress ? <p className="mt-3 rounded-xl bg-brass/10 px-3 py-2 text-sm font-semibold text-brass">{progress}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/45 dark:text-red-200">{error}</p> : null}
      <p className="mt-3 text-xs leading-5 text-ink/50">La imagen se recorta a 800×800, se convierte a WebP y se comprime antes de enviarse.</p>
    </section>
  );
}
