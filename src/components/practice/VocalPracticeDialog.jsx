import { useEffect, useMemo, useState } from "react";
import { Music, Piano, Volume2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { SongExternalLinks } from "../ui/SongExternalLinks";
import { Metronome } from "./Metronome";
import { PracticeGuidePlayer } from "./PracticeGuidePlayer";
import { loadPracticeGuides } from "../../services/practiceGuides";
import {
  calculateSemitoneDifference,
  formatSemitoneDifference
} from "../../services/vocalPracticeMusic";
import { playKeyChord, playKeyTonic, playReferenceNote, stopReferenceAudio } from "../../services/vocalPracticeAudio";

function ReferenceActions({ musicalKey, entryNote }) {
  const [error, setError] = useState("");
  const run = (action) => {
    setError("");
    action().catch((nextError) => setError(nextError.message || "No se pudo reproducir la referencia."));
  };
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {musicalKey ? <Button variant="secondary" onClick={() => run(() => playKeyTonic(musicalKey))}><Volume2 className="h-4 w-4" />Escuchar tónica</Button> : null}
        {musicalKey ? <Button variant="secondary" onClick={() => run(() => playKeyChord(musicalKey))}><Piano className="h-4 w-4" />Escuchar acorde</Button> : null}
        {entryNote ? <Button variant="secondary" onClick={() => run(() => playReferenceNote(entryNote))}><Music className="h-4 w-4" />Nota inicial</Button> : null}
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}
    </>
  );
}

export function VocalPracticeDialog({ open, onClose, song, useLocal = false, preferredVoice = "" }) {
  const source = song?.full || song?.merged || song || {};
  const churchKey = source.keyWithCapo || source.mainKey || "";
  const churchBpm = Number(source.churchBpm || 0);
  const churchSignature = source.churchTimeSignature || "4/4";
  const churchEntryNote = source.churchEntryNote || "";
  const originalKey = source.originalKey || "";
  const originalBpm = Number(source.originalBpm || 0);
  const originalSignature = source.timeSignature || "4/4";
  const originalEntryNote = source.originalEntryNote || "";
  const keyDifference = calculateSemitoneDifference(originalKey, churchKey);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeGuideId, setActiveGuideId] = useState("");
  const [guideError, setGuideError] = useState("");
  const [metronomeStopSignal, setMetronomeStopSignal] = useState(0);

  useEffect(() => {
    if (!open || !source.id) return undefined;
    let active = true;
    setLoading(true);
    setGuideError("");
    loadPracticeGuides(source.id, useLocal)
      .then((items) => {
        if (active) setGuides(items.filter((item) => item.enabled));
      })
      .catch(() => {
        if (active) setGuideError("No se pudieron cargar las guías de ensayo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      stopReferenceAudio();
      setActiveGuideId("");
    };
  }, [open, source.id, useLocal]);

  const visibleGuides = useMemo(() => guides.slice(0, 1), [guides]);

  const close = () => {
    stopReferenceAudio();
    setActiveGuideId("");
    setMetronomeStopSignal((value) => value + 1);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={`Practicar · ${song?.title || source.title || "Canto"}`}
      onClose={close}
      wide
      panelClassName="h-[92dvh] md:h-[88vh] flex flex-col"
      contentClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-brass/25 bg-brass/8 p-4 dark:bg-brass/10">
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Versión de la iglesia</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-ink/45">Tonalidad</dt><dd className="font-bold text-ink">{churchKey || "Sin registrar"}</dd></div>
            <div><dt className="text-ink/45">BPM</dt><dd className="font-bold text-ink">{churchBpm || "Sin registrar"}</dd></div>
            <div><dt className="text-ink/45">Compás</dt><dd className="font-bold text-ink">{source.churchTimeSignature || "Sin registrar"}</dd></div>
          </dl>
          {Number.isFinite(keyDifference) ? (
            <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-bold text-ink dark:bg-black/20">
              {formatSemitoneDifference(keyDifference)}
            </p>
          ) : null}
          <ReferenceActions musicalKey={churchKey} entryNote={churchEntryNote} />
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Versión original</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-ink/45">Tonalidad</dt><dd className="font-bold text-ink">{originalKey || "Sin registrar"}</dd></div>
            <div><dt className="text-ink/45">BPM</dt><dd className="font-bold text-ink">{originalBpm || "Sin registrar"}</dd></div>
            <div><dt className="text-ink/45">Compás</dt><dd className="font-bold text-ink">{source.timeSignature || "Sin registrar"}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <SongExternalLinks youtubeUrl={song?.youtubeUrl || source.youtubeUrl} spotifyUrl={song?.spotifyUrl || source.spotifyUrl} songTitle={song?.title || source.title} compact={false} />
          </div>
          <ReferenceActions musicalKey={originalKey} entryNote={originalEntryNote} />
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-ink/10 bg-ink/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brass">Audio de ensayo</p>
            <p className="mt-1 text-sm text-ink/55">Pista compartida para escucharla o descargarla.</p>
          </div>
        </div>
        {guideError ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{guideError}</p> : null}
        {loading ? <p className="mt-4 text-sm text-ink/55">Cargando guías…</p> : visibleGuides.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleGuides.map((guide) => (
              <PracticeGuidePlayer
                key={guide.id}
                guide={guide}
                active={activeGuideId === guide.id}
                onActivate={(guideId) => {
                  setActiveGuideId(guideId);
                  setMetronomeStopSignal((value) => value + 1);
                }}
                useLocal={useLocal}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-ink/60 dark:bg-black/20">
            Aún no hay audio de ensayo para este canto. Puedes utilizar las referencias de la versión de la iglesia y de la grabación original.
          </p>
        )}
      </section>

      <div className="mt-4">
        <Metronome
          initialBpm={churchBpm || originalBpm || 72}
          churchBpm={churchBpm}
          originalBpm={originalBpm}
          initialSignature={source.churchTimeSignature ? churchSignature : originalSignature}
          onStart={() => setActiveGuideId("")}
          stopSignal={metronomeStopSignal}
        />
      </div>
    </Modal>
  );
}
