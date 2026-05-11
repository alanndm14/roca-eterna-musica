import { ExternalLink, Maximize2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useMusicData } from "../hooks/useMusicData";
import { formatDate, getUpcomingSchedule } from "../services/dateUtils";

export function MusicianView() {
  const { schedules, songs } = useMusicData();
  const upcoming = getUpcomingSchedule(schedules);

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen?.();
  };

  if (!upcoming) {
    return <EmptyState title="No hay próxima programación" text="Cuando exista una programación futura, aparecerá aquí en una vista limpia para ensayo." />;
  }

  return (
    <div className="space-y-5">
      <Card className="bg-ink text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">Vista para músicos</p>
            <h2 className="mt-2 text-3xl font-bold">{formatDate(upcoming.date)}</h2>
            <p className="mt-2 text-white/60">{upcoming.time} · {upcoming.leader || "Responsable pendiente"}</p>
          </div>
          <Button variant="light" onClick={enterFullscreen}>
            <Maximize2 className="h-4 w-4" />
            Pantalla completa
          </Button>
        </div>
      </Card>

      <div className="grid gap-4">
        {(upcoming.songs || []).map((song, index) => (
          <Card key={`${song.songId}-${index}`} className="p-4 md:p-6">
            <div className="grid gap-4 md:grid-cols-[64px_1fr_100px] md:items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-white">{index + 1}</div>
              <div>
                <h3 className="text-2xl font-bold text-ink">{song.titleSnapshot}</h3>
                <p className="mt-2 text-base text-ink/60">{song.notes || "Sin notas para este canto."}</p>
                {(() => {
                  const fullSong = songs.find((item) => item.id === song.songId);
                  const pdf = song.pdfUrl || fullSong?.pdfPreviewUrl || fullSong?.pdfUrl || fullSong?.drivePdfUrl || fullSong?.chordsUrl;
                  return pdf ? (
                    <a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brass" href={pdf} target="_blank" rel="noreferrer">
                      Letra / acordes <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null;
                })()}
              </div>
              <div className="rounded-3xl bg-brass/12 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-brass">Tono</p>
                <p className="mt-1 text-4xl font-bold text-ink">{song.keySnapshot}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
