import { getServiceDisplayLabel, isYouthSchedule } from "./dateUtils.js";
import { canonicalThemeKey, normalizeThemeName, stripAccents } from "./songUtils.js";

const dayMs = 86_400_000;
export const shortRepeatDays = 7;

export function calendarDaysBetween(earlier, later) {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / dayMs);
}

export function getSongThemeKeys(song) {
  return new Set([song.mainTheme, ...(song.otherThemes || []), ...(song.tags || [])].map(canonicalThemeKey).filter(Boolean));
}

export function isChristmasSong(song) {
  return canonicalThemeKey(song.category) === "navidad" || getSongThemeKeys(song).has("navidad");
}

export function getRotationServiceLabel(schedule) {
  return isYouthSchedule(schedule) ? "Jóvenes" : getServiceDisplayLabel(schedule);
}

export function normalizeReviewValue(value) {
  const normalized = stripAccents(value || "pendiente").trim().toLowerCase();
  if (["revision", "en revision", "revisando"].includes(normalized)) return "en revisión";
  if (["completo", "completado", "done", "listo", "terminado"].includes(normalized)) return "completado";
  return "pendiente";
}

export const hasKeynoteReady = (song) => normalizeReviewValue(song.keynoteReviewStatus) === "completado";

export function getRotationStartDate(period, today) {
  if (period === "all") return "";
  if (period === "year") return `${today.slice(0, 4)}-01-01`;
  return new Date(Date.parse(today) - (Number(period) - 1) * dayMs).toISOString().slice(0, 10);
}

export function summarizeRotation(songs, services, { startDate, serviceLabel }) {
  const rowsById = new Map(songs.map((song) => [song.id, { song, count: 0, lastSchedule: null }]));
  const allTimeBySong = new Map();
  const selectedServices = services.filter(({ schedule }) => schedule.date >= startDate
    && (!serviceLabel || getRotationServiceLabel(schedule) === serviceLabel));
  let uses = 0;
  let servicesWithMatches = 0;
  const sameDay = [];
  const shortRepeats = [];
  const otherGaps = [];

  services.forEach(({ schedule, songIds }) => {
    songIds.forEach((id) => {
      if (!allTimeBySong.has(id)) allTimeBySong.set(id, schedule);
    });
  });
  for (const { schedule, songIds } of [...selectedServices].reverse()) {
    let hasMatch = false;
    for (const id of songIds) {
      const row = rowsById.get(id);
      if (!row) continue;
      if (row.lastSchedule) {
        const days = calendarDaysBetween(row.lastSchedule.date, schedule.date);
        const repeat = { song: row.song, previous: row.lastSchedule, current: schedule, days };
        if (days === 0) sameDay.push(repeat);
        else if (days <= shortRepeatDays) shortRepeats.push(repeat);
        else otherGaps.push(days);
      }
      row.count += 1;
      row.lastSchedule = schedule;
      uses += 1;
      hasMatch = true;
    }
    if (hasMatch) servicesWithMatches += 1;
  }

  const themes = new Map();
  const rows = [...rowsById.values()].map((row) => {
    const { song, count } = row;
    const key = canonicalThemeKey(song.mainTheme);
    const theme = themes.get(key) || {
      key, label: normalizeThemeName(song.mainTheme) || "Sin tema principal",
      total: 0, uses: 0, used: 0, ready: 0, unusedReady: 0
    };
    theme.total += 1;
    theme.uses += count;
    if (count) theme.used += 1;
    if (hasKeynoteReady(song)) {
      theme.ready += 1;
      if (!count) theme.unusedReady += 1;
    }
    themes.set(key, theme);
    return { ...row, latest: allTimeBySong.get(song.id) || null };
  });
  const gaps = [...shortRepeats.map(({ days }) => days), ...otherGaps].sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);

  return {
    rows, uses, servicesWithMatches, serviceCount: selectedServices.length,
    unresolvedCount: selectedServices.reduce((sum, service) => sum + service.unresolvedCount, 0),
    distinct: rows.filter(({ count }) => count > 0).length,
    sameDay: sameDay.reverse(),
    shortRepeats: shortRepeats.reverse(),
    gapCount: gaps.length,
    medianDays: gaps.length ? (gaps[middle] + gaps[Math.floor((gaps.length - 1) / 2)]) / 2 : null,
    themes: [...themes.values()].sort((a, b) => b.uses - a.uses || a.label.localeCompare(b.label, "es"))
  };
}
