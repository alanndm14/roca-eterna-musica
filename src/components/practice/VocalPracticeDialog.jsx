import { useEffect, useMemo, useState } from "react";
import { Music, Piano, Volume2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Field";
import { SongExternalLinks } from "../ui/SongExternalLinks";
import { Metronome } from "./Metronome";
import { PracticeGuidePlayer } from "./PracticeGuidePlayer";
import { loadPracticeGuides } from "../../services/practiceGuides";
import {
  calculateSemitoneDifference,
  clampBpm,
  formatSemitoneDifference,
  VOICE_PARTS
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
  const entry = song?.entry || {};
  const originalKey = source.originalKey || "";
  const originalBpm = Number(source.originalBpm || 0);
  const originalSignature = source.timeSignature || "4/4";
  const originalEntryNote = source.originalEntryNote || "";
  const serviceKey = entry.keySnapshot || song?.keyWithCapo || song?.mainKey || "";
  const serviceBpm = Number(entry.serviceBpm || 0);
  const serviceSignature = entry.serviceTimeSignature || source.timeSignature || "4/4";
  const serviceEntryNote = entry.serviceEntryNote || "";
  const difference = calculateSemitoneDifference(originalKey, serviceKey);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState(preferredVoice || "all");
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

  const visibleGuides = useMemo(
    () => guides.filter((guide) => voiceFilter === "all" || guide.voicePart === "all" || guide.voicePart === voiceFilter),
    [guides, voiceFilter]
  );

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

        <section className="rounded-2xl border border-brass/25 bg-brass/8 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Versión del servicio</p>
          {serviceKey ? (
            <>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div><dt className="text-ink/45">Tonalidad</dt><dd className="font-bold text-ink">{serviceKey}</dd></div>
                <div><dt className="text-ink/45">BPM</dt><dd className="font-bold text-ink">{serviceBpm || "Sin registrar"}</dd></div>
                <div><dt className="text-ink/45">Compás</dt><dd className="font-bold text-ink">{entry.serviceTimeSignature || "Sin registrar"}</dd></div>
              </dl>
              {Number.isFinite(difference) ? <p className="mt-3 rounded-xl bg-white/65 px-3 py-2 text-sm font-bold text-ink dark:bg-black/20">{formatSemitoneDifference(difference)}</p> : null}
              <ReferenceActions musicalKey={serviceKey} entryNote={serviceEntryNote} />
            </>
          ) : <p className="mt-3 text-sm leading-6 text-ink/60">Este canto todavía no tiene una tonalidad asignada para un servicio.</p>}
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-ink/10 bg-ink/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brass">Guías de ensayo</p>
            <p className="mt-1 text-sm text-ink/55">Grabaciones propias por sección y parte vocal.</p>
          </div>
          <Select className="w-full sm:w-52" value={voiceFilter} onChange={(event) => setVoiceFilter(event.target.value)} aria-label="Filtrar por voz">
            {VOICE_PARTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
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
            Aún no hay guías de ensayo para este canto. Puedes utilizar la versión original y las referencias del servicio.
          </p>
        )}
      </section>

      <div className="mt-4">
        <Metronome
          initialBpm={serviceBpm || originalBpm || 72}
          originalBpm={originalBpm}
          serviceBpm={serviceBpm}
          initialSignature={serviceSignature || originalSignature}
          onStart={() => setActiveGuideId("")}
          stopSignal={metronomeStopSignal}
        />
      </div>
    </Modal>
  );
}
