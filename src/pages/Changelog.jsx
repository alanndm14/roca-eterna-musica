import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { appVersion, changelog } from "../data/changelog";
import { fetchLatestVersion, getInstalledVersion } from "../services/appUpdate";

export function Changelog() {
  const [latestVersion, setLatestVersion] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestVersion()
      .then((result) => {
        if (!cancelled) setLatestVersion(result);
      })
      .catch(() => {
        if (!cancelled) setLatestVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
          <Sparkles className="h-5 w-5 text-brass" />
          <div>
            <h2 className="text-xl font-bold text-ink">Actualizaciones</h2>
            <p className="text-sm text-ink/55">Versión actual de la app: {appVersion}</p>
          </div>
          </div>
          <dl className="grid gap-2 rounded-2xl bg-ink/5 p-3 text-sm sm:min-w-72">
            <div className="flex justify-between gap-3">
              <dt className="text-ink/55">Instalada</dt>
              <dd className="font-semibold text-ink">{getInstalledVersion() || appVersion}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/55">Disponible</dt>
              <dd className="font-semibold text-ink">{latestVersion?.version || appVersion}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/55">Estado</dt>
              <dd className="font-semibold text-ink">{latestVersion?.version && latestVersion.version !== appVersion ? "actualización disponible" : "actualizado"}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {changelog.map((release) => (
        <Card key={release.version}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brass">Versión {release.version}</p>
              <h3 className="mt-1 text-lg font-bold text-ink">{release.title}</h3>
            </div>
            <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink/55">{release.date}</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <ChangeList title="Agregado" items={release.added} />
            <ChangeList title="Cambiado" items={release.changed} />
            <ChangeList title="Corregido" items={release.fixed} />
            <ChangeList title="Pendiente" items={release.pending} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ChangeList({ title, items = [] }) {
  return (
    <div className="rounded-2xl bg-ink/5 p-4">
      <p className="font-bold text-ink">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-5 text-ink/65">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
