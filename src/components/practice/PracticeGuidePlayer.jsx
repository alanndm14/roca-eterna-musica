import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat2, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import { formatDuration, PRACTICE_SECTIONS, VOICE_PARTS } from "../../services/vocalPracticeMusic";
import { getPracticeGuideAudioUrl } from "../../services/practiceGuides";

const labelFor = (options, value) => options.find(([key]) => key === value)?.[1] || value;

export function PracticeGuidePlayer({ guide, active, onActivate, useLocal = false }) {
  const audioRef = useRef(null);
  const [url, setUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(guide.durationSeconds || 0));
  const [speed, setSpeed] = useState("1");
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(85);
  const [error, setError] = useState("");

  useEffect(() => {
    let activeRequest = true;
    getPracticeGuideAudioUrl(guide, useLocal)
      .then((value) => {
        if (activeRequest) setUrl(value);
      })
      .catch(() => {
        if (activeRequest) setError("No se pudo abrir este audio.");
      });
    return () => {
      activeRequest = false;
    };
  }, [guide, useLocal]);

  useEffect(() => {
    if (!active && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [active]);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  const toggle = async () => {
    if (!url) return;
    if (!active) onActivate(guide.id);
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setError("El navegador no pudo iniciar este audio.");
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <article className={`rounded-2xl border p-4 transition ${active ? "border-brass/45 bg-brass/8" : "border-ink/10 bg-white/70 dark:border-white/10 dark:bg-white/5"}`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        loop={loop}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
        onError={() => setError("No se pudo reproducir este audio.")}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-ink">{guide.title}</h4>
          <p className="mt-1 text-xs font-semibold text-ink/50">
            {labelFor(PRACTICE_SECTIONS, guide.sectionType)} · {labelFor(VOICE_PARTS, guide.voicePart)}
            {guide.key ? ` · ${guide.key}` : ""}{guide.bpm ? ` · ${guide.bpm} BPM` : ""}
          </p>
        </div>
        <Button className="h-11 w-11 px-0" onClick={toggle} disabled={!url} aria-label={playing ? "Pausar guía" : "Reproducir guía"}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
      </div>
      {guide.notes ? <p className="mt-3 text-sm leading-6 text-ink/62">{guide.notes}</p> : null}
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <span className="text-xs tabular-nums text-ink/50">{formatDuration(currentTime)}</span>
        <Input
          type="range"
          min="0"
          max={Math.max(duration, 1)}
          step="0.1"
          value={Math.min(currentTime, Math.max(duration, 1))}
          onChange={(event) => {
            if (audioRef.current) audioRef.current.currentTime = Number(event.target.value);
          }}
          aria-label={`Progreso de ${guide.title}`}
        />
        <span className="text-xs tabular-nums text-ink/50">{formatDuration(duration)}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_minmax(120px,1fr)]">
        <Button variant="subtle" className="px-3" onClick={() => {
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}><RotateCcw className="h-4 w-4" />Reiniciar</Button>
        <Button variant={loop ? "accent" : "subtle"} className="px-3" onClick={() => setLoop((value) => !value)}><Repeat2 className="h-4 w-4" />Repetir</Button>
        <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
          <Select value={speed} onChange={(event) => {
            setSpeed(event.target.value);
            if (audioRef.current) audioRef.current.playbackRate = Number(event.target.value);
          }} aria-label="Velocidad de reproducción">
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
          </Select>
          <Field label={`Vol. ${volume}%`} className="[&>span]:sr-only">
            <Input type="range" min="0" max="100" value={volume} onChange={(event) => {
              const value = Number(event.target.value);
              setVolume(value);
              if (audioRef.current) audioRef.current.volume = value / 100;
            }} aria-label="Volumen de la guía" />
          </Field>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}
    </article>
  );
}
