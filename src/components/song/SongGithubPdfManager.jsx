import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Link2, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import {
  DIRECT_PDF_UPLOAD_MAX_BYTES,
  importSongPdfFromUrl,
  uploadSongPdfFile
} from "../../services/githubPdfUpload";
import { resolvePublicPdfPath } from "../../services/songUtils";

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUpdatedAt(value) {
  const date = timestampToDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function SongGithubPdfManager({ song, onUploaded }) {
  const fileInputRef = useRef(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const localPath = result?.localPdfPath || song.localPdfPath || song.pdfLocalPath || "";
  const pdfVersion = result?.pdfVersion || song.pdfVersion || "";
  const localUrl = resolvePublicPdfPath(localPath, pdfVersion);
  const updatedAt = formatUpdatedAt(song.pdfUpdatedAt);
  const maxSizeMb = Math.round(DIRECT_PDF_UPLOAD_MAX_BYTES / (1024 * 1024));

  const completeUpload = (uploadResult) => {
    setResult(uploadResult);
    setProgress("PDF actualizado. Puede tardar unos minutos en publicarse.");
    onUploaded?.(uploadResult);
  };

  const runFileUpload = async (file) => {
    if (!file) return;
    setError("");
    setResult(null);
    setBusy(true);
    setProgress("Validando PDF...");
    try {
      if (file.size > DIRECT_PDF_UPLOAD_MAX_BYTES) {
        throw new Error("Este PDF es demasiado grande para subirlo directo. Usa Importar desde enlace o comprime el PDF.");
      }
      setProgress("Subiendo a GitHub...");
      const uploadResult = await uploadSongPdfFile(song, file);
      setProgress("Actualizando canto...");
      completeUpload(uploadResult);
    } catch (uploadError) {
      setProgress("");
      setError(uploadError.message || "No se pudo actualizar el PDF.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runUrlImport = async () => {
    setError("");
    setResult(null);
    setBusy(true);
    setProgress("Descargando y validando PDF...");
    try {
      const uploadResult = await importSongPdfFromUrl(song, sourceUrl);
      setProgress("Actualizando canto...");
      completeUpload(uploadResult);
      setSourceUrl("");
      setShowUrlImport(false);
    } catch (uploadError) {
      setProgress("");
      setError(uploadError.message || "No se pudo importar el PDF.");
    } finally {
      setBusy(false);
    }
  };

  const copyPath = async () => {
    if (localPath) await navigator.clipboard?.writeText(localPath);
  };

  const forceOpen = () => {
    if (!localUrl) return;
    const separator = localUrl.includes("?") ? "&" : "?";
    window.open(`${localUrl}${separator}reload=${Date.now()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="mt-5 border-t border-ink/10 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="font-bold text-ink">PDF local para unir servicios</h4>
          <p className="mt-1 text-sm text-ink/55">
            Estado: {localPath ? (song.pdfStatus === "actualizado" || result ? "Actualizado recientemente" : "PDF local disponible") : "Sin PDF local"}
          </p>
          {localPath ? <p className="mt-1 break-all text-xs font-semibold text-ink/45">Ruta actual: {localPath}</p> : null}
          {updatedAt ? <p className="mt-1 text-xs text-ink/45">Ultima actualizacion: {updatedAt}</p> : null}
        </div>
        {localPath ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" /> : <AlertCircle className="h-6 w-6 shrink-0 text-amber-600" />}
      </div>

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => runFileUpload(event.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button isLoading={busy && progress.includes("GitHub")} onClick={() => fileInputRef.current?.click()} disabled={busy}>
          <UploadCloud className="h-4 w-4" />
          Subir/Reemplazar PDF local
        </Button>
        <Button variant="secondary" onClick={() => setShowUrlImport((current) => !current)} disabled={busy}>
          <Link2 className="h-4 w-4" />
          Importar desde enlace
        </Button>
        {localUrl ? (
          <>
            <Button variant="secondary" onClick={() => window.open(localUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="h-4 w-4" />
              Abrir PDF local
            </Button>
            <Button variant="subtle" onClick={copyPath}>
              <Copy className="h-4 w-4" />
              Copiar ruta
            </Button>
            <Button variant="subtle" onClick={forceOpen}>
              <RefreshCw className="h-4 w-4" />
              Forzar recarga
            </Button>
          </>
        ) : null}
      </div>

      {showUrlImport ? (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3 dark:border-white/10 dark:bg-white/5">
          <label htmlFor="song-pdf-source-url" className="block text-xs font-bold uppercase tracking-wide text-ink/55">Enlace publico al PDF o Google Drive</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="song-pdf-source-url"
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              disabled={busy}
            />
            <Button onClick={runUrlImport} disabled={busy || !sourceUrl.trim()} isLoading={busy}>
              Importar PDF
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-ink/50">
        Subida directa: maximo {maxSizeMb} MB. GitHub y la publicacion de la app pueden tardar unos minutos en mostrar el archivo nuevo.
      </p>
      {progress ? (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${result ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200" : "bg-brass/10 text-brass"}`}>
          {progress}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/45 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
