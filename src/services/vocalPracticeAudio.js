import { buildTriadFrequencies, noteToFrequency, parseMusicalKey } from "./vocalPracticeMusic";

let sharedContext = null;
let activeNodes = new Set();

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new Context();
  return sharedContext;
}

async function ensureContext() {
  const context = getAudioContext();
  if (!context) throw new Error("Este navegador no admite referencias de audio.");
  if (context.state === "suspended") await context.resume();
  return context;
}

function scheduleTone(context, frequency, start, duration, volume = 0.18, type = "sine") {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.035);
  gain.gain.setValueAtTime(Math.max(0.001, volume), Math.max(start + 0.05, start + duration - 0.18));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
  activeNodes.add(oscillator);
  oscillator.onended = () => {
    activeNodes.delete(oscillator);
    oscillator.disconnect();
    gain.disconnect();
  };
}

function schedulePianoTone(context, frequency, start, duration, volume = 0.18) {
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(5200, start);
  filter.frequency.exponentialRampToValueAtTime(1800, start + Math.min(duration, 2.5));
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.012);
  master.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.28), start + 0.42);
  master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  filter.connect(master).connect(context.destination);

  [
    { multiple: 1, gain: 1, type: "triangle" },
    { multiple: 2, gain: 0.32, type: "sine" },
    { multiple: 3, gain: 0.13, type: "sine" },
    { multiple: 4, gain: 0.06, type: "sine" }
  ].forEach((partial) => {
    const oscillator = context.createOscillator();
    const partialGain = context.createGain();
    oscillator.type = partial.type;
    oscillator.frequency.setValueAtTime(frequency * partial.multiple, start);
    oscillator.detune.setValueAtTime(partial.multiple === 1 ? -2 : 2, start);
    partialGain.gain.setValueAtTime(partial.gain, start);
    oscillator.connect(partialGain).connect(filter);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
    activeNodes.add(oscillator);
    oscillator.onended = () => {
      activeNodes.delete(oscillator);
      oscillator.disconnect();
      partialGain.disconnect();
    };
  });
}

export async function playReferenceNote(note, options = {}) {
  const frequency = noteToFrequency(note, options.octave || 4);
  if (!frequency) throw new Error("No se pudo interpretar la nota.");
  stopReferenceAudio();
  const context = await ensureContext();
  schedulePianoTone(context, frequency, context.currentTime + 0.02, options.duration || 2.8, options.volume || 0.2);
}

export async function playKeyTonic(key, options = {}) {
  const parsed = parseMusicalKey(key);
  if (!parsed) throw new Error("No se pudo interpretar la tonalidad.");
  return playReferenceNote(`${parsed.note}${options.octave || 4}`, options);
}

export async function playKeyChord(key, options = {}) {
  const frequencies = buildTriadFrequencies(key, options.octave || 4);
  if (!frequencies.length) throw new Error("No se pudo interpretar la tonalidad.");
  stopReferenceAudio();
  const context = await ensureContext();
  const start = context.currentTime + 0.02;
  frequencies.forEach((frequency) => schedulePianoTone(context, frequency, start, options.duration || 4.2, options.volume || 0.095));
}

export function stopReferenceAudio() {
  activeNodes.forEach((node) => {
    try {
      node.stop();
    } catch {
      // El nodo ya terminó.
    }
  });
  activeNodes = new Set();
}

export async function createMetronomeEngine({ onBeat } = {}) {
  const context = await ensureContext();
  let running = false;
  let timerId = 0;
  let nextBeatTime = 0;
  let beatIndex = 0;
  let bpm = 72;
  let signature = "4/4";
  let volume = 0.22;
  let countInBeatsRemaining = 0;
  let totalCountInBeats = 0;
  const lookaheadMs = 25;
  const scheduleAheadSeconds = 0.12;

  const beatsPerMeasure = () => Number(String(signature).split("/")[0]) || 4;
  const secondsPerBeat = () => signature === "6/8" ? 60 / bpm / 3 : 60 / bpm;
  const isAccent = (beat) => beat === 0 || (signature === "6/8" && beat === 3);

  const click = (time, accent) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(accent ? 1320 : 880, time);
    gain.gain.setValueAtTime(Math.max(0.001, volume), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.06);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  };

  const scheduler = () => {
    while (nextBeatTime < context.currentTime + scheduleAheadSeconds) {
      const currentBeat = beatIndex;
      click(nextBeatTime, isAccent(currentBeat));
      const inCountIn = countInBeatsRemaining > 0;
      const elapsedCountInBeats = totalCountInBeats - countInBeatsRemaining;
      onBeat?.(currentBeat, beatsPerMeasure(), {
        countIn: inCountIn,
        countInBeat: inCountIn ? elapsedCountInBeats + 1 : 0,
        countInBeatsRemaining
      });
      nextBeatTime += secondsPerBeat();
      beatIndex = (beatIndex + 1) % beatsPerMeasure();
      if (countInBeatsRemaining > 0) countInBeatsRemaining -= 1;
    }
    if (running) timerId = window.setTimeout(scheduler, lookaheadMs);
  };

  return {
    start(options = {}) {
      if (running) return;
      bpm = options.bpm || bpm;
      signature = options.signature || signature;
      volume = options.volume ?? volume;
      beatIndex = 0;
      totalCountInBeats = Math.max(0, Math.min(2, Number(options.countInMeasures || 0))) * beatsPerMeasure();
      countInBeatsRemaining = totalCountInBeats;
      nextBeatTime = context.currentTime + 0.08;
      running = true;
      scheduler();
    },
    stop() {
      running = false;
      window.clearTimeout(timerId);
      beatIndex = 0;
      countInBeatsRemaining = 0;
      totalCountInBeats = 0;
    },
    update(options = {}) {
      bpm = options.bpm || bpm;
      signature = options.signature || signature;
      volume = options.volume ?? volume;
      beatIndex %= beatsPerMeasure();
    },
    isRunning: () => running,
    destroy() {
      running = false;
      window.clearTimeout(timerId);
    }
  };
}
