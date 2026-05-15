import { ExternalLink } from "lucide-react";
import { Button } from "./Button";

export function FileDiagnosticPanel({ result }) {
  if (!result) return null;

  return (
    <div className={`mt-4 rounded-2xl border p-4 text-sm ${result.ok ? "border-brass/30 bg-brass/10 text-ink" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100"}`}>
      <p className="font-bold">{result.message}</p>
      <dl className="mt-3 grid gap-2 break-words">
        <Row label="Ruta guardada" value={result.savedPath || "--"} />
        <Row label="Ruta normalizada" value={result.normalizedPath || "--"} />
        <Row label="URL final absoluta" value={result.finalUrl || "--"} />
        <Row label="Status HTTP" value={result.status || "--"} />
        <Row label="Content-Type" value={result.contentType || "--"} />
        <Row label="Tamaño aproximado" value={result.sizeBytes ? `${result.sizeBytes} bytes` : "--"} />
        <Row label="Parece PDF" value={result.isPdf ? "Si" : "No"} />
        <Row label="Parece imagen" value={result.isImage ? "Si" : "No"} />
        <Row label="HTML recibido" value={result.isHtml ? "Si" : "No"} />
      </dl>
      {result.finalUrl ? (
        <a href={result.finalUrl} target="_blank" rel="noreferrer">
          <Button className="mt-4" variant="secondary">
            <ExternalLink className="h-4 w-4" />
            Abrir URL resuelta
          </Button>
        </a>
      ) : null}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid gap-1 md:grid-cols-[160px_1fr]">
      <dt className="font-semibold text-ink/55 dark:text-white/60">{label}</dt>
      <dd className="font-semibold text-ink dark:text-white">{value}</dd>
    </div>
  );
}
