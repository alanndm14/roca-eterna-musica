import { useEffect, useRef, useState } from "react";
import { Minus, Play, Plus, Square, TimerReset } from "lucide-react";
import { Button } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import { calculateTapTempo, clampBpm, TIME_SIGNATURES } from "../../services/vocalPracticeMusic";
import { createMetronomeEngine } from "../../services/vocalPracticeAudio";

export function Metronome({
  initialBpm = 72,
  originalBpm = 0,
  serviceBpm = 0,
  initialSignature = "4/4",
  onStart,
  stopSignal = 0
}) {
  const initialValidBpm = clampBpm(initialBpm);
  const [bpm, setBpm] = useState(initialValidBpm);
  const [bpmInput, setBpmInput] = useState(String(initialValidBpm));
  const [signature, setSignature] = useState(TIME_SIGNATURES.includes(initialSignature) ? initialSignature : "4/4");
  const [volume, setVolume] = useState(22);
  const [countInMeasures, setCountInMeasures] = useState(0);
  const [countInBeat, setCountInBeat] = useState(0);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  const [error, setError] = useState("");
  const engineRef = useRef(null);
  const tapsRef = useRef([]);
  const lastValidBpmRef = useRef(initialValidBpm);

  useEffect(() => () => {
    engineRef.current?.destroy();
    engineRef.current = null;
  }, []);

  useEffect(() => {
    engineRef.current?.update({ bpm, signature, volume: volume / 100 });
  }, [bpm, signature, volume]);

  useEffect(() => {
    if (!running) {
      const nextBpm = clampBpm(initialBpm);
      setBpm(nextBpm);
      setBpmInput(String(nextBpm));
      lastValidBpmRef.current = nextBpm;
    }
  }, [initialBpm, running]);

  useEffect(() => {
    if (!stopSignal) return;
    engineRef.current?.stop();
    setRunning(false);
    setBeat(0);
    setCountInBeat(0);
  }, [stopSignal]);

  const stop = () => {
    engineRef.current?.stop();
    setRunning(false);
    setBeat(0);
    setCountInBeat(0);
  };

  const commitBpm = (value = bpmInput) => {
    const trimmed = String(value ?? "").trim();
    const nextBpm = trimmed
      ? clampBpm(trimmed, lastValidBpmRef.current)
      : lastValidBpmRef.current || clampBpm(initialBpm);
    setBpm(nextBpm);
    setBpmInput(String(nextBpm));
    lastValidBpmRef.current = nextBpm;
    return nextBpm;
  };

  const setConfirmedBpm = (value) => {
    const nextBpm = clampBpm(value, lastValidBpmRef.current);
    setBpm(nextBpm);
    setBpmInput(String(nextBpm));
    lastValidBpmRef.current = nextBpm;
  };

  const start = async () => {
    setError("");
    try {
      const confirmedBpm = commitBpm();
      onStart?.();
      if (!engineRef.current) {
        engineRef.current = await createMetronomeEngine({
          onBeat: (nextBeat, _beatsPerMeasure, metadata = {}) => {
            setBeat(nextBeat);
            setCountInBeat(metadata.countIn ? metadata.countInBeat : 0);
          }
        });
      }
      engineRef.current.start({ bpm: confirmedBpm, signature, volume: volume / 100, countInMeasures });
      setRunning(true);
    } catch (startError) {
      setError(startError.message || "No se pudo iniciar el metrónomo.");
    }
  };

  const tap = () => {
    const result = calculateTapTempo(tapsRef.current);
    tapsRef.current = result.timestamps;
    if (result.bpm) setConfirmedBpm(result.bpm);
  };

  return (
    <section className="rounded-2xl border border-ink/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brass">Metrónomo</p>
          <div className="mt-1 flex items-end gap-2">
            <Input
              className="h-12 w-28 text-center text-2xl font-black tabular-nums"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bpmInput}
              onChange={(event) => {
                const value = event.target.value;
                if (/^\d*$/.test(value)) setBpmInput(value);
              }}
              onBlur={() => commitBpm()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitBpm();
                  event.currentTarget.blur();
                }
              }}
              aria-label="BPM del metrónomo"
            />
            <span className="pb-2 text-sm font-bold text-ink/45">BPM</span>
          </div>
        </div>
        <div className="flex gap-2" aria-label="Pulso actual">
          {Array.from({ length: Number(signature.split("/")[0]) || 4 }, (_, index) => (
            <span key={index} className={`h-3 w-3 rounded-full transition ${running && beat === index ? "scale-125 bg-brass" : "bg-ink/15 dark:bg-white/20"}`} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[[-5, "-5"], [-1, "-1"], [1, "+1"], [5, "+5"]].map(([amount, label]) => (
          <Button key={amount} variant="subtle" className="px-2" onClick={() => setConfirmedBpm(bpm + amount)}>
            {amount < 0 ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{label.replace(/[+-]/, "")}
          </Button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Compás">
          <Select value={signature} onChange={(event) => setSignature(event.target.value)}>
            {TIME_SIGNATURES.map((item) => <option key={item}>{item}</option>)}
          </Select>
        </Field>
        <Field label={`Volumen · ${volume}%`}>
          <Input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
        </Field>
        <Field label="Cuenta de entrada">
          <Select value={countInMeasures} onChange={(event) => setCountInMeasures(Number(event.target.value))} disabled={running}>
            <option value={0}>Sin cuenta</option>
            <option value={1}>1 compás</option>
            <option value={2}>2 compases</option>
          </Select>
        </Field>
      </div>
      {running && countInBeat ? (
        <p className="mt-3 rounded-xl bg-brass/10 px-3 py-2 text-sm font-bold text-ink" role="status">
          Cuenta de entrada · {countInBeat}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={running ? "danger" : "primary"} onClick={running ? stop : start}>
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Detener" : "Iniciar"}
        </Button>
        <Button variant="secondary" onClick={tap}><TimerReset className="h-4 w-4" />Tap tempo</Button>
        {originalBpm ? <Button variant="subtle" onClick={() => setConfirmedBpm(originalBpm)}>BPM original</Button> : null}
        {serviceBpm ? <Button variant="subtle" onClick={() => setConfirmedBpm(serviceBpm)}>BPM del servicio</Button> : null}
      </div>
    </section>
  );
}
