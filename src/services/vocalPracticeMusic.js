const NOTE_INDEX = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "6/8"];
export const PRACTICE_SECTIONS = [
  ["full", "Canción completa"],
  ["verse", "Verso"],
  ["prechorus", "Pre-coro"],
  ["chorus", "Coro"],
  ["bridge", "Puente"],
  ["final-chorus", "Coro final"],
  ["intro", "Intro"],
  ["outro", "Outro"],
  ["other", "Otra sección"]
];
export const VOICE_PARTS = [
  ["all", "Todas las voces"],
  ["melody", "Melodía principal"],
  ["soprano", "Soprano"],
  ["alto", "Alto"],
  ["tenor", "Tenor"],
  ["second", "Segunda voz"],
  ["other", "Otra"]
];

export function parseMusicalKey(value = "") {
  const clean = String(value || "")
    .trim()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/\s+/g, "");
  const match = clean.match(/^([A-Ga-g])([#b]?)(m|min|minor)?$/i);
  if (!match) return null;
  const note = `${match[1].toUpperCase()}${match[2] || ""}`;
  const index = NOTE_INDEX[note.toUpperCase()];
  if (index === undefined) return null;
  return {
    index,
    minor: Boolean(match[3]),
    note: NOTE_NAMES[index],
    normalized: `${NOTE_NAMES[index]}${match[3] ? "m" : ""}`
  };
}

export function normalizeMusicalKey(value = "") {
  return parseMusicalKey(value)?.normalized || "";
}

export function calculateSemitoneDifference(originalKey, serviceKey) {
  const original = parseMusicalKey(originalKey);
  const service = parseMusicalKey(serviceKey);
  if (!original || !service) return null;
  let difference = service.index - original.index;
  while (difference > 6) difference -= 12;
  while (difference < -6) difference += 12;
  return difference;
}

export function formatSemitoneDifference(value) {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "Mismo tono que la original";
  const amount = Math.abs(value);
  return `${amount} semitono${amount === 1 ? "" : "s"} ${value > 0 ? "arriba" : "abajo"}`;
}

export function parseNote(value = "", fallbackOctave = 4) {
  const clean = String(value || "").trim().replace(/♯/g, "#").replace(/♭/g, "b");
  const match = clean.match(/^([A-Ga-g])([#b]?)(-?\d+)?$/);
  if (!match) return null;
  const key = parseMusicalKey(`${match[1]}${match[2] || ""}`);
  if (!key) return null;
  const octave = match[3] === undefined ? fallbackOctave : Number(match[3]);
  if (!Number.isFinite(octave) || octave < 0 || octave > 8) return null;
  const midi = (octave + 1) * 12 + key.index;
  return {
    ...key,
    octave,
    midi,
    frequency: 440 * (2 ** ((midi - 69) / 12)),
    label: `${key.note}${octave}`
  };
}

export function noteToFrequency(value, fallbackOctave = 4) {
  return parseNote(value, fallbackOctave)?.frequency || null;
}

export function buildTriadFrequencies(keyValue, octave = 4) {
  const key = parseMusicalKey(keyValue);
  if (!key) return [];
  const rootMidi = (octave + 1) * 12 + key.index;
  const intervals = key.minor ? [0, 3, 7] : [0, 4, 7];
  return intervals.map((interval) => 440 * (2 ** ((rootMidi + interval - 69) / 12)));
}

export function clampBpm(value, fallback = 72) {
  const bpm = Number(value);
  return Number.isFinite(bpm) ? Math.min(240, Math.max(30, Math.round(bpm))) : fallback;
}

export function calculateTapTempo(timestamps = [], now = Date.now()) {
  const recent = [...timestamps, now].filter((time) => now - time <= 3000).slice(-6);
  if (recent.length < 2) return { bpm: null, timestamps: recent };
  const intervals = recent.slice(1).map((time, index) => time - recent[index]).filter((value) => value >= 200 && value <= 2000);
  if (!intervals.length) return { bpm: null, timestamps: [now] };
  const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  return { bpm: clampBpm(60000 / average), timestamps: recent };
}

export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

