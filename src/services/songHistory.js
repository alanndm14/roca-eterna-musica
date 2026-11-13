import { getPastSchedules } from "./dateUtils.js";
import { normalizeSearchText, stripAccents } from "./songUtils.js";

const cancelledStatuses = new Set(["cancelado", "cancelada", "canceled", "cancelled", "suspendido", "suspendida"]);
const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const relativeTime = new Intl.RelativeTimeFormat("es-MX");
const dayMs = 24 * 60 * 60 * 1000;
const titleKey = (title) => stripAccents(title || "").trim().toLowerCase();

export function getRecordedSongUsage(songs, schedules, now = new Date()) {
  const byId = new Map(songs.map((song) => [song.id, song]));
  const idsByTitle = new Map();
  songs.forEach((song) => {
    const title = titleKey(song.title);
    if (!title || !song.id) return;
    idsByTitle.set(title, idsByTitle.has(title) ? null : song.id);
  });

  const usage = new Map();
  getPastSchedules(schedules, now, { includeYouth: true }).forEach((schedule) => {
    if (schedule.deleted || schedule.active === false || schedule.relatedEntityDeleted || cancelledStatuses.has(normalizeSearchText(schedule.status))) return;
    const counted = new Set();
    for (const entry of schedule.songs || []) {
      const id = byId.get(entry.songId)?.id || idsByTitle.get(titleKey(entry.titleSnapshot || entry.title));
      if (!id || counted.has(id)) continue;
      counted.add(id);
      const previous = usage.get(id);
      usage.set(id, { count: (previous?.count || 0) + 1, lastDate: previous?.lastDate || schedule.date });
    }
  });
  return usage;
}

export function formatSongLastSung(date, today) {
  const timestamp = Date.parse(date);
  const days = Math.round((Date.parse(today) - timestamp) / dayMs);
  let relative = "hoy";
  if (days >= 365) relative = relativeTime.format(-Math.floor(days / 365), "year");
  else if (days >= 30) relative = relativeTime.format(-Math.floor(days / 30), "month");
  else if (days > 0) relative = relativeTime.format(-days, "day");
  return `${relative} · ${shortDate.format(timestamp)}`;
}
